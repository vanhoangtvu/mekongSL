import { NextRequest, NextResponse } from 'next/server';
import { pool } from '../../../lib/db';
import { normalizeDataSource } from '../../../lib/constants/data-sources';

export async function GET(request: NextRequest) {
  try {
    const sourceParam = request.nextUrl.searchParams.get('source');
    const dateParam = request.nextUrl.searchParams.get('date');
    const source = normalizeDataSource(sourceParam);
    const tableName = source === 'ecowitt' ? 'ecowitt' : 'mekong';
    
    // For Mekong: Get latest record per sensor (by SensorNodeCode)
    // For Ecowitt: Get latest records by time
    let query = '';
    let queryParams: string[] = [];
    
    if (dateParam && source === 'mekong') {
      const dayStart = `${dateParam} 00:00:00`;
      const dayEnd = `${dateParam} 23:59:59`;

      query = `
        SELECT
          id,
          DATE_FORMAT(fetched_at, '%Y-%m-%d %H:%i:%s') AS fetched_at,
          source,
          record_index,
          _id,
          SensorNodeCode,
          Longitude,
          Latitude,
          ProvinceName,
          ProvinceCode,
          SNShortName,
          SNDescription,
          SNShortNameEN,
          SNDescriptionEN,
          SerialNumber,
          NameLine_1,
          NameLine_2,
          Salinity,
          PH,
          WaterLevel,
          Alkalinity
        FROM \`${tableName}\`
        WHERE fetched_at BETWEEN ? AND ?
        ORDER BY fetched_at DESC
      `;
      queryParams = [dayStart, dayEnd];
    } else if (source === 'mekong') {
      query = `
        SELECT m1.* 
        FROM \`${tableName}\` m1
        INNER JOIN (
          SELECT SensorNodeCode, MAX(fetched_at) as max_date
          FROM \`${tableName}\`
          GROUP BY SensorNodeCode
        ) m2 ON m1.SensorNodeCode = m2.SensorNodeCode AND m1.fetched_at = m2.max_date
        ORDER BY m1.fetched_at DESC
      `;
    } else {
      // Ecowitt: Get latest 100 records
      query = `SELECT * FROM \`${tableName}\` ORDER BY fetched_at DESC LIMIT 100`;
    }
    
    const [rows] = await pool.query(query, queryParams);
    
    return NextResponse.json({
      source,
      data: rows
    });
  } catch (error) {
    console.error('Database fetch error:', error);
    return NextResponse.json({ error: 'Database fetch failed', data: [] }, { status: 500 });
  }
}
