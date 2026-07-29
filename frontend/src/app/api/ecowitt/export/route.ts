/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { pool } from '../../../../lib/db';
import { requireRoleFromRequest } from '../../../../lib/server-auth';

/**
 * Known Ecowitt display columns with labels (subset).
 * We dynamically detect all columns from the table.
 */
const KNOWN_COLUMN_LABELS: Record<string, string> = {
  device_id: 'Thiết bị',
  record_time: 'Thời gian',
  record_index: 'STT',
  fetched_at: 'Thời điểm thu thập',
  fetch_run_id: 'Mã đợt thu thập',
  source: 'Nguồn',
  tempf_tempf: 'Nhiệt độ (°F)',
  humidity_humidity: 'Độ ẩm ngoài trời (%)',
  vpd_vpd: 'VPD',
  so_uv_solarradiation: 'Bức xạ mặt trời',
  rain_rainratein: 'Cường độ mưa (in/h)',
  rain_dailyrainin: 'Mưa hôm nay (in)',
  wind_speed_windspeedmph: 'Tốc độ gió (mph)',
  wind_speed_windgustmph: 'Gió giật (mph)',
  winddir_winddir: 'Hướng gió (°)',
  pressure_baromrelin: 'Áp suất tương đối (inHg)',
  pressure_baromabsin: 'Áp suất tuyệt đối (inHg)',
  solar_uv_uv: 'UV Index',
  solar_uv_solarradiation: 'Bức xạ mặt trời (W/m²)',
  dewpoint_dewpoint: 'Nhiệt độ điểm sương (°F)',
  feelslike_feelslike: 'Cảm giác như (°F)',
  heatindex_heatindex: 'Chỉ số nhiệt (°F)',
  windchill_windchill: 'Gió lạnh (°F)',
};

function formatValue(value: unknown): string | number {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (!Number.isNaN(num) && String(value).trim() !== '') return num;
  return String(value);
}

/**
 * Get local date range for a given date string (YYYY-MM-DD) in UTC+7.
 */
function getLocalDateRange(dateParam: string) {
  const startLocal = new Date(`${dateParam}T00:00:00+07:00`);
  const endLocal = new Date(startLocal);
  endLocal.setDate(endLocal.getDate() + 1);
  return {
    startUtc: startLocal.toISOString().slice(0, 19).replace('T', ' '),
    endUtc: endLocal.toISOString().slice(0, 19).replace('T', ' '),
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireRoleFromRequest(request, ['DATA_MANAGER', 'ADMIN']);

    const { searchParams } = request.nextUrl;
    const dateFromParam = searchParams.get('dateFrom'); // YYYY-MM-DD (start)
    const dateToParam = searchParams.get('dateTo');     // YYYY-MM-DD (end, exclusive)
    const dateParam = searchParams.get('date');         // YYYY-MM-DD (single day - kept for backward compat)
    const deviceIdParam = searchParams.get('deviceId');
    const isPreview = Boolean(searchParams.get('preview'));

    // Detect all columns in the ecowitt table
    const [colCheck] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ecowitt'
       ORDER BY ORDINAL_POSITION ASC`,
    );
    const allColumns = (colCheck as Array<Record<string, string>>).map((r) => r.COLUMN_NAME);

    // Filter out internal columns we don't want to export
    const excludeColumns = new Set(['id']);
    const exportColumns = allColumns.filter((col) => !excludeColumns.has(col));

    // Build query
    let query: string;
    let queryParams: any[];

    if (dateFromParam && dateToParam) {
      // Custom date range
      const startUtc = new Date(`${dateFromParam}T00:00:00+07:00`).toISOString().slice(0, 19).replace('T', ' ');
      const endUtc = new Date(`${dateToParam}T23:59:59+07:00`).toISOString().slice(0, 19).replace('T', ' ');
      if (deviceIdParam) {
        query = `SELECT * FROM ecowitt WHERE fetched_at >= ? AND fetched_at <= ? AND device_id = ? ORDER BY device_id, record_time ASC`;
        queryParams = [startUtc, endUtc, deviceIdParam];
      } else {
        query = `SELECT * FROM ecowitt WHERE fetched_at >= ? AND fetched_at <= ? ORDER BY device_id, record_time ASC`;
        queryParams = [startUtc, endUtc];
      }
    } else if (dateParam) {
      const { startUtc, endUtc } = getLocalDateRange(dateParam);
      if (deviceIdParam) {
        query = `SELECT * FROM ecowitt WHERE fetched_at >= ? AND fetched_at < ? AND device_id = ? ORDER BY device_id, record_time ASC`;
        queryParams = [startUtc, endUtc, deviceIdParam];
      } else {
        query = `SELECT * FROM ecowitt WHERE fetched_at >= ? AND fetched_at < ? ORDER BY device_id, record_time ASC`;
        queryParams = [startUtc, endUtc];
      }
    } else {
      // No date filter - get recent data (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const startUtc = weekAgo.toISOString().slice(0, 19).replace('T', ' ');
      if (deviceIdParam) {
        query = `SELECT * FROM ecowitt WHERE fetched_at >= ? AND device_id = ? ORDER BY device_id, record_time ASC`;
        queryParams = [startUtc, deviceIdParam];
      } else {
        query = `SELECT * FROM ecowitt WHERE fetched_at >= ? ORDER BY device_id, record_time ASC`;
        queryParams = [startUtc];
      }
    }

    const [rows] = await pool.query(query, queryParams);
    const data = rows as Array<Record<string, unknown>>;

    // Build Excel columns - use all export columns with their labels
    const headerColumns = exportColumns.map((col) => ({
      key: col,
      label: KNOWN_COLUMN_LABELS[col] || col,
    }));

    // Convert data to rows
    const excelData = data.map((row) => {
      const r: Record<string, any> = {};
      for (const col of exportColumns) {
        r[col] = formatValue(row[col]);
      }
      return r;
    });

    if (isPreview) {
      // Return preview (first 200 rows)
      return NextResponse.json({
        columns: headerColumns.map((c) => c.label),
        rows: excelData.slice(0, 200),
        totalRows: excelData.length,
      });
    }

    // Create Excel workbook
    const wb = XLSX.utils.book_new();
    const headerLabels = headerColumns.map((c) => c.label);
    const ws = XLSX.utils.json_to_sheet(excelData, { header: exportColumns });

    // Rename headers to Vietnamese labels
    // XLSX.utils.json_to_sheet uses the keys as headers, we need to relabel
    // We'll rebuild the sheet with proper headers
    const wsData = [headerLabels, ...excelData.map((row) => exportColumns.map((col) => row[col] || ''))];
    const ws2 = XLSX.utils.aoa_to_sheet(wsData);

    // Auto-fit column widths
    const colWidths = headerLabels.map((label, i) => {
      const maxDataLen = excelData.reduce((max, row) => {
        const val = String(row[exportColumns[i]] || '');
        return Math.max(max, val.length);
      }, 0);
      return { wch: Math.max(label.length, maxDataLen, 12) };
    });
    ws2['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws2, 'Ecowitt');

    // Generate filename
    const datePart = dateParam || `last7days`;
    const devicePart = deviceIdParam ? `_${deviceIdParam}` : '';
    const filename = `ecowitt_export${devicePart}_${datePart}.xlsx`;

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Ecowitt export error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized. DATA_MANAGER or ADMIN role required.' }, { status: 403 });
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Export failed',
    }, { status: 500 });
  }
}
