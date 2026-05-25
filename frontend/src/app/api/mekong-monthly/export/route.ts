import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import proj4 from 'proj4';
import * as XLSX from 'xlsx';

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
];

const UTM48_EPSG = 'EPSG:32648';

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const year = Number(searchParams.get('year')) || new Date().getFullYear();
    const month = Number(searchParams.get('month')) || new Date().getMonth() + 1;
    const metric = searchParams.get('metric') || 'salinity';

    const metricConfig = METRICS.find(m => m.slug === metric);
    if (!metricConfig) {
      return NextResponse.json({ error: 'Invalid metric' }, { status: 400 });
    }

    const connection = await mysql.createConnection(MYSQL_CONFIG);

    // Query data for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()} 23:59:59`;

    const [rows] = await connection.query<any[]>(
      `SELECT 
        SensorNodeCode, SNShortName, ProvinceName, Longitude, Latitude,
        ${metricConfig.key}, DATE_FORMAT(fetched_at, '%Y-%m-%d %H:%i:%s') AS fetched_at
      FROM mekong 
      WHERE fetched_at BETWEEN ? AND ?
      ORDER BY SensorNodeCode, fetched_at`,
      [startDate, endDate]
    );

    await connection.end();

    // Build Excel structure
    const BASE_COLUMNS = ['ID', 'Address', 'X', 'Y'];
    const dayColumns = buildDayColumns(year, month);
    const allColumns = [...BASE_COLUMNS, ...dayColumns];

    // Group by sensor
    const sensorMap = new Map<string, any>();
    
    for (const row of rows) {
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

      // Add value to corresponding day column
      if (row.fetched_at) {
        const fetchedAt = String(row.fetched_at);
        const day = fetchedAt.slice(8, 10);
        const dayCol = `${day}/${String(month).padStart(2, '0')}`;
        
        if (dayColumns.includes(dayCol)) {
          const sensor = sensorMap.get(sensorCode)!;
          sensor[dayCol] = row[metricConfig.key] || '';
        }
      }
    }

    // Convert to array and fill missing columns
    const data = Array.from(sensorMap.values()).map(sensor => {
      const row: any = {};
      for (const col of allColumns) {
        row[col] = sensor[col] || '';
      }
      return row;
    });

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(data, { header: allColumns });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, metricConfig.label);

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Return file
    const filename = `mekong-${metric}-${year}-${String(month).padStart(2, '0')}.xlsx`;
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Export failed' 
    }, { status: 500 });
  }
}
