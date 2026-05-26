/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import proj4 from 'proj4';
import * as XLSX from 'xlsx';
import { requireRoleFromRequest } from '../../../../lib/server-auth';

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '1111',
  database: process.env.MYSQL_DATABASE || 'mekong',
};

const METRICS = [
  { key: 'Salinity', label: 'Độ mặn', slug: 'salinity' },
  { key: 'PH', label: 'pH', slug: 'ph' },
  { key: 'WaterLevel', label: 'Mực nước', slug: 'waterlevel' },
  { key: 'Alkalinity', label: 'Alkalinity', slug: 'alkalinity' },
];

const UTM48_EPSG = 'EPSG:32648';

function formatUtcDateTime(date: Date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function getLocalMonthRange(year: number, month: number) {
  const startLocal = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+07:00`);
  const endLocal = new Date(startLocal);
  endLocal.setMonth(endLocal.getMonth() + 1);

  return {
    startUtc: formatUtcDateTime(startLocal),
    endUtc: formatUtcDateTime(endLocal),
  };
}

if (!proj4.defs(UTM48_EPSG)) {
  proj4.defs(UTM48_EPSG, '+proj=utm +zone=48 +datum=WGS84 +units=m +no_defs');
}

function toUtm48(longitude: unknown, latitude: unknown) {
  const lon = Number(longitude);
  const lat = Number(latitude);

  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return null;
  }

  const [x, y] = proj4('EPSG:4326', UTM48_EPSG, [lon, lat]);
  return { x, y };
}

function buildDayColumns(year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    return `${day}/${String(month).padStart(2, '0')}`;
  });
}

function formatMetricValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const normalizedText = String(value).trim().replace(',', '.');
  if (/^0+(?:\.0+)?$/.test(normalizedText)) {
    return '';
  }

  const numericValue = Number(normalizedText);
  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  return numericValue.toFixed(2);
}

export async function GET(request: NextRequest) {
  try {
    await requireRoleFromRequest(request, ['DATA_MANAGER', 'ADMIN']);

    const { searchParams } = request.nextUrl;
    const mode = (searchParams.get('mode') || 'monthly').toLowerCase(); // 'monthly' or 'daily'
    const province = searchParams.get('province') || null;
    const region = (searchParams.get('region') || '').trim().toUpperCase() || null;

    const metricsParam = searchParams.get('metrics') || searchParams.get('metric') || 'salinity';
    const metricSlugs = metricsParam.split(',').map((s) => s.trim()).filter(Boolean);
    const metricConfigs = metricSlugs
      .map((slug) => METRICS.find((m) => m.slug === slug))
      .filter(Boolean) as { key: string; label: string; slug: string }[];

    if (!metricConfigs.length) {
      return NextResponse.json({ error: 'Invalid metric(s)' }, { status: 400 });
    }

    const connection = await mysql.createConnection(MYSQL_CONFIG);

    const isPreview = Boolean(searchParams.get('preview'));

    if (mode === 'monthly') {
      const year = Number(searchParams.get('year')) || new Date().getFullYear();
      const month = Number(searchParams.get('month')) || new Date().getMonth() + 1;
      const monthRange = getLocalMonthRange(year, month);

      // For multi-metric monthly export: create one sheet per metric (keeps existing format)
      const wb = XLSX.utils.book_new();

      const previewSheets: any[] = [];
      for (const metricConfig of metricConfigs) {
        const params: any[] = [monthRange.startUtc, monthRange.endUtc];
        let whereClause = '';
        if (province) {
          whereClause = ' AND (s.ProvinceCode = ? OR s.ProvinceName LIKE ?)';
          params.push(province, `%${province}%`);
        }

        // Apply region abbreviation filter (e.g., 'TV', 'BT', 'VL') if provided
        let regionClause = '';
        if (region) {
          regionClause = ` AND (UPPER(s.SNShortName) LIKE ? OR UPPER(s.SNDescription) LIKE ? OR UPPER(s.SNShortNameEN) LIKE ? OR UPPER(s.SNDescriptionEN) LIKE ?)`;
          const regionPattern = `% - ${region}%`;
          params.push(regionPattern, regionPattern, regionPattern, regionPattern);
        }

        const [rows] = await connection.query(
          `SELECT 
            s.SensorNodeCode, s.SNShortName, s.ProvinceName, s.Longitude, s.Latitude,
            m.${metricConfig.key}, DATE_FORMAT(DATE_ADD(m.fetched_at, INTERVAL 7 HOUR), '%Y-%m-%d %H:%i:%s') AS fetched_at
          FROM mekong_measurement m
          INNER JOIN mekong_sensor s ON s.SensorNodeCode = m.sensor_code
          WHERE m.fetched_at >= ? AND m.fetched_at < ? ${whereClause} ${regionClause}
          ORDER BY s.SensorNodeCode, m.fetched_at, m.id`,
          params,
        );

        // Build Excel structure per metric
        const BASE_COLUMNS = ['ID', 'Address', 'X', 'Y'];
        const dayColumns = buildDayColumns(year, month);
        const allColumns = [...BASE_COLUMNS, ...dayColumns];

        const sensorMap = new Map<string, Record<string, any>>();
        const monthlyRows = rows as any[];

        for (const row of monthlyRows) {
          const sensorCode = row.SensorNodeCode || row.SerialNumber || 'UNKNOWN';

          if (!sensorMap.has(sensorCode)) {
            const utm = toUtm48(row.Longitude, row.Latitude);
            sensorMap.set(sensorCode, {
              ID: sensorCode,
              Address: row.SNShortName || row.SNDescription || sensorCode,
              X: utm ? utm.x : '',
              Y: utm ? utm.y : '',
            });
          }

          if (row.fetched_at) {
            const fetchedAt = String(row.fetched_at);
            const day = fetchedAt.slice(8, 10);
            const dayCol = `${day}/${String(month).padStart(2, '0')}`;

            if (dayColumns.includes(dayCol)) {
              const sensor = sensorMap.get(sensorCode)!;
              sensor[dayCol] = formatMetricValue(row[metricConfig.key]);
            }
          }
        }

        const data = Array.from(sensorMap.values()).map((sensor) => {
          const r: Record<string, any> = {};
          for (const col of allColumns) {
            r[col] = sensor[col] || '';
          }
          return r;
        });

        if (isPreview) {
          previewSheets.push({ metric: metricConfig.label, columns: allColumns, rows: data.slice(0, 200) });
        } else {
          const ws = XLSX.utils.json_to_sheet(data, { header: allColumns });
          XLSX.utils.book_append_sheet(wb, ws, metricConfig.label);
        }
      }

      // Determine filename prefix based on region or province
      let namePart = 'all';
      const REGION_MAP: Record<string,string> = { TV: 'TraVinh', BT: 'BenTre', VL: 'VinhLong' };
      if (region) {
        namePart = (REGION_MAP as any)[region] || region;
      } else if (province) {
        try {
          const [provRows] = await connection.query('SELECT DISTINCT ProvinceName FROM mekong_sensor WHERE ProvinceCode = ? LIMIT 1', [province]);
          const provRowsAny = provRows as any[];
          if (Array.isArray(provRowsAny) && provRowsAny[0] && provRowsAny[0].ProvinceName) {
            namePart = String(provRowsAny[0].ProvinceName).replace(/\s+/g, '').replace(/[^a-zA-Z0-9_-]/g, '');
          } else {
            namePart = String(province);
          }
        } catch (e) {
          // ignore
        }
      }

      await connection.end();

      if (isPreview) {
        return NextResponse.json({ sheets: previewSheets });
      }

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const filename = `mekong-monthly-${namePart}-${String(month).padStart(2, '0')}-${year}.xlsx`;

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Daily mode: export by date with time columns
    if (mode === 'daily') {
      const dateStr = searchParams.get('date');
      if (!dateStr) {
        await connection.end();
        return NextResponse.json({ error: 'date is required for daily export (YYYY-MM-DD)' }, { status: 400 });
      }

      const params: any[] = [dateStr, dateStr];
      let whereClause = '';
      if (province) {
        whereClause = ' AND (s.ProvinceCode = ? OR s.ProvinceName LIKE ?)';
        params.push(province, `%${province}%`);
      }

      // region abbreviation filter
      if (region) {
        const regionPattern = `% - ${region}%`;
        whereClause += ` AND (UPPER(s.SNShortName) LIKE ? OR UPPER(s.SNDescription) LIKE ? OR UPPER(s.SNShortNameEN) LIKE ? OR UPPER(s.SNDescriptionEN) LIKE ?)`;
        params.push(regionPattern, regionPattern, regionPattern, regionPattern);
      }

      const metricCols = metricConfigs.map((m) => `m.${m.key}`).join(', ');
      
      // We need to fetch data for the whole local day (00:00:00 to 23:59:59 local time).
      // Since fetched_at is in UTC, and local time is UTC+7, we filter by DATE(DATE_ADD(fetched_at, INTERVAL 7 HOUR))
      const query = `
        SELECT 
          s.SensorNodeCode, s.SNShortName, s.Longitude, s.Latitude, 
          ${metricCols}, 
          DATE_FORMAT(DATE_ADD(m.fetched_at, INTERVAL 7 HOUR),'%Y-%m-%d %H:%i:%s') AS fetched_at,
          HOUR(DATE_ADD(m.fetched_at, INTERVAL 7 HOUR)) AS fetch_hour
        FROM mekong_measurement m 
        INNER JOIN mekong_sensor s ON s.SensorNodeCode = m.sensor_code 
        WHERE DATE(DATE_ADD(m.fetched_at, INTERVAL 7 HOUR)) = ? 
        ${whereClause} 
        ORDER BY s.SensorNodeCode, m.fetched_at
      `;

      // The query uses DATE(...) = ? so we only pass dateStr once in params
      // Let's rewrite params properly:
      const dailyParams: any[] = [dateStr];
      let dailyWhereClause = '';
      if (province) {
        dailyWhereClause += ' AND (s.ProvinceCode = ? OR s.ProvinceName LIKE ?)';
        dailyParams.push(province, `%${province}%`);
      }
      if (region) {
        const regionPattern = `% - ${region}%`;
        dailyWhereClause += ` AND (UPPER(s.SNShortName) LIKE ? OR UPPER(s.SNDescription) LIKE ? OR UPPER(s.SNShortNameEN) LIKE ? OR UPPER(s.SNDescriptionEN) LIKE ?)`;
        dailyParams.push(regionPattern, regionPattern, regionPattern, regionPattern);
      }
      
      const queryStr = `
        SELECT 
          s.SensorNodeCode, s.SNShortName, s.Longitude, s.Latitude, 
          ${metricCols}, 
          DATE_FORMAT(DATE_ADD(m.fetched_at, INTERVAL 7 HOUR),'%Y-%m-%d %H:%i:%s') AS fetched_at,
          HOUR(DATE_ADD(m.fetched_at, INTERVAL 7 HOUR)) as fetch_hour
        FROM mekong_measurement m 
        INNER JOIN mekong_sensor s ON s.SensorNodeCode = m.sensor_code 
        WHERE DATE(DATE_ADD(m.fetched_at, INTERVAL 7 HOUR)) = ? 
        ${dailyWhereClause} 
        ORDER BY s.SensorNodeCode, m.fetched_at
      `;

      const [rows] = await connection.query(queryStr, dailyParams);

      let namePart = 'all';
      const REGION_MAP = { TV: 'TraVinh', BT: 'BenTre', VL: 'VinhLong' };
      if (region) {
        namePart = (REGION_MAP as any)[region] || region;
      } else if (province) {
        try {
          const [provRows] = await connection.query('SELECT DISTINCT ProvinceName FROM mekong_sensor WHERE ProvinceCode = ? LIMIT 1', [province]);
          const provRowsAny = provRows as any[];
          if (Array.isArray(provRowsAny) && provRowsAny[0] && provRowsAny[0].ProvinceName) {
            namePart = String(provRowsAny[0].ProvinceName).replace(/\s+/g, '').replace(/[^a-zA-Z0-9_-]/g, '');
          } else {
            namePart = String(province);
          }
        } catch (e) {
          // ignore
        }
      }

      await connection.end();

      const timeColumns = ['00h', '05h', '10h', '15h', '20h'];
      // Create one sheet per metric, similar to monthly
      const wb = XLSX.utils.book_new();
      const previewSheets: any[] = [];
      const BASE_COLUMNS = ['ID', 'Address', 'X', 'Y'];
      const allColumns = [...BASE_COLUMNS, ...timeColumns];

      for (const metricConfig of metricConfigs) {
        const sensorMap = new Map<string, Record<string, any>>();
        const dailyRows = rows as any[];

        for (const row of dailyRows) {
          const sensorCode = row.SensorNodeCode || 'UNKNOWN';

          if (!sensorMap.has(sensorCode)) {
            const utm = toUtm48(row.Longitude, row.Latitude);
            sensorMap.set(sensorCode, {
              ID: sensorCode,
              Address: row.SNShortName || sensorCode,
              X: utm ? utm.x : '',
              Y: utm ? utm.y : '',
            });
          }

          const hour = Number(row.fetch_hour);
          // Snap hour to nearest expected time (0, 5, 10, 15, 20)
          let timeCol = '';
          if (hour >= 0 && hour < 3) timeCol = '00h';
          else if (hour >= 3 && hour < 8) timeCol = '05h';
          else if (hour >= 8 && hour < 13) timeCol = '10h';
          else if (hour >= 13 && hour < 18) timeCol = '15h';
          else if (hour >= 18 && hour < 24) timeCol = '20h';

          if (timeCol) {
            const sensor = sensorMap.get(sensorCode)!;
            // Only update if it hasn't been set for this time slot yet (keep first/closest)
            if (!sensor[timeCol]) {
               sensor[timeCol] = formatMetricValue(row[metricConfig.key]);
            }
          }
        }

        const data = Array.from(sensorMap.values()).map((sensor) => {
          const r: Record<string, any> = {};
          for (const col of allColumns) {
            r[col] = sensor[col] || '';
          }
          return r;
        });

        if (isPreview) {
          previewSheets.push({ metric: metricConfig.label, columns: allColumns, rows: data.slice(0, 200) });
        } else {
          const ws = XLSX.utils.json_to_sheet(data, { header: allColumns });
          XLSX.utils.book_append_sheet(wb, ws, metricConfig.label);
        }
      }

      if (isPreview) {
        return NextResponse.json({ sheets: previewSheets });
      }

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const filename = `mekong-daily-${namePart}-${dateStr}.xlsx`;

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    await connection.end();
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error) {
    console.error('Export error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized. DATA_MANAGER or ADMIN role required.' }, { status: 403 });
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Export failed',
    }, { status: 500 });
  }
}
