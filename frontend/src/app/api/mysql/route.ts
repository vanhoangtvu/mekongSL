import { NextRequest, NextResponse } from 'next/server';
import { pool } from '../../../lib/db';
import { normalizeDataSource } from '../../../lib/constants/data-sources';
import { requireRoleFromRequest } from '../../../lib/server-auth';

function formatUtcDateTime(date: Date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function getLocalDateRange(dateParam: string) {
  const startLocal = new Date(`${dateParam}T00:00:00+07:00`);
  const endLocal = new Date(startLocal);
  endLocal.setDate(endLocal.getDate() + 1);

  return {
    startUtc: formatUtcDateTime(startLocal),
    endUtc: formatUtcDateTime(endLocal),
  };
}

// Local fetched_at expressions (UTC stored in DB, display in UTC+7)
const localMeasurementFetchedAt = "DATE_ADD(measurement.fetched_at, INTERVAL 7 HOUR)";

export async function GET(request: NextRequest) {
  try {
    await requireRoleFromRequest(request, ['DATA_MANAGER', 'ADMIN']);

    const sourceParam = request.nextUrl.searchParams.get('source');
    const dateParam = request.nextUrl.searchParams.get('date');
    const viewParam = request.nextUrl.searchParams.get('view');
    const runIdParam = request.nextUrl.searchParams.get('runId');
    const source = normalizeDataSource(sourceParam);
    const tableName = source === 'ecowitt' ? 'ecowitt' : 'mekong';

    let query = '';
    let queryParams: string[] = [];

    if (source === 'mekong') {
      const view = viewParam || 'latest';
      const localFetchedAt = "DATE_ADD(fetched_at, INTERVAL 7 HOUR)";
      const dateRange = dateParam ? getLocalDateRange(dateParam) : null;

      if (view === 'timeframes' && dateParam) {
        query = `
          SELECT DISTINCT
            fetch_run_id,
            DATE_FORMAT(${localFetchedAt}, '%Y-%m-%d %H:%i:%s') AS fetched_at
          FROM mekong_measurement
          WHERE fetched_at >= ? AND fetched_at < ?
          ORDER BY fetched_at DESC
        `;
        queryParams = [dateRange!.startUtc, dateRange!.endUtc];
      } else if (runIdParam) {
        query = `
          SELECT
            sensor.id,
            sensor._id,
            sensor.SensorNodeCode,
            sensor.Longitude,
            sensor.Latitude,
            sensor.ProvinceName,
            sensor.ProvinceCode,
            sensor.SNShortName,
            sensor.SNDescription,
            sensor.SNShortNameEN,
            sensor.SNDescriptionEN,
            sensor.SerialNumber,
            sensor.NameLine_1,
            sensor.NameLine_2,
            sensor.source,
            DATE_FORMAT(DATE_ADD(sensor.first_seen_at, INTERVAL 7 HOUR), '%Y-%m-%d %H:%i:%s') AS first_seen_at,
            DATE_FORMAT(DATE_ADD(sensor.last_seen_at, INTERVAL 7 HOUR), '%Y-%m-%d %H:%i:%s') AS last_seen_at,
            sensor.is_active,
            sensor.inactive_at,
            DATE_FORMAT(${localMeasurementFetchedAt}, '%Y-%m-%d %H:%i:%s') AS fetched_at,
            measurement.fetch_run_id,
            measurement.record_index,
            measurement.Salinity,
            measurement.PH,
            measurement.WaterLevel,
            measurement.Alkalinity
          FROM mekong_sensor sensor
          INNER JOIN mekong_measurement measurement ON measurement.sensor_code = sensor.SensorNodeCode
          WHERE measurement.fetch_run_id = ?
          ORDER BY measurement.fetched_at DESC, sensor.SensorNodeCode, measurement.id DESC
        `;
        queryParams = [runIdParam];
      } else if (dateParam && view === 'all') {
        query = `
          SELECT
            sensor.id,
            sensor._id,
            sensor.SensorNodeCode,
            sensor.Longitude,
            sensor.Latitude,
            sensor.ProvinceName,
            sensor.ProvinceCode,
            sensor.SNShortName,
            sensor.SNDescription,
            sensor.SNShortNameEN,
            sensor.SNDescriptionEN,
            sensor.SerialNumber,
            sensor.NameLine_1,
            sensor.NameLine_2,
            sensor.source,
            DATE_FORMAT(DATE_ADD(sensor.first_seen_at, INTERVAL 7 HOUR), '%Y-%m-%d %H:%i:%s') AS first_seen_at,
            DATE_FORMAT(DATE_ADD(sensor.last_seen_at, INTERVAL 7 HOUR), '%Y-%m-%d %H:%i:%s') AS last_seen_at,
            sensor.is_active,
            sensor.inactive_at,
            DATE_FORMAT(${localMeasurementFetchedAt}, '%Y-%m-%d %H:%i:%s') AS fetched_at,
            measurement.fetch_run_id,
            measurement.record_index,
            measurement.Salinity,
            measurement.PH,
            measurement.WaterLevel,
            measurement.Alkalinity
          FROM mekong_sensor sensor
          INNER JOIN mekong_measurement measurement ON measurement.sensor_code = sensor.SensorNodeCode
          WHERE measurement.fetched_at >= ? AND measurement.fetched_at < ?
          ORDER BY measurement.fetched_at DESC, sensor.SensorNodeCode, measurement.id DESC
        `;
        queryParams = [dateRange!.startUtc, dateRange!.endUtc];
      } else {
        const dateFilterSql = dateParam ? 'WHERE m.fetched_at >= ? AND m.fetched_at < ?' : '';

        query = `
          SELECT
            sensor.id,
            sensor._id,
            sensor.SensorNodeCode,
            sensor.Longitude,
            sensor.Latitude,
            sensor.ProvinceName,
            sensor.ProvinceCode,
            sensor.SNShortName,
            sensor.SNDescription,
            sensor.SNShortNameEN,
            sensor.SNDescriptionEN,
            sensor.SerialNumber,
            sensor.NameLine_1,
            sensor.NameLine_2,
            sensor.source,
            DATE_FORMAT(DATE_ADD(sensor.first_seen_at, INTERVAL 7 HOUR), '%Y-%m-%d %H:%i:%s') AS first_seen_at,
            DATE_FORMAT(DATE_ADD(sensor.last_seen_at, INTERVAL 7 HOUR), '%Y-%m-%d %H:%i:%s') AS last_seen_at,
            sensor.is_active,

            sensor.inactive_at,
            DATE_FORMAT(DATE_ADD(measurement.fetched_at, INTERVAL 7 HOUR), '%Y-%m-%d %H:%i:%s') AS fetched_at,
            measurement.fetch_run_id,
            measurement.record_index,
            measurement.Salinity,
            measurement.PH,
            measurement.WaterLevel,
            measurement.Alkalinity
          FROM mekong_sensor sensor
          INNER JOIN (
            SELECT m.*, ROW_NUMBER() OVER (PARTITION BY m.sensor_code ORDER BY m.fetched_at DESC, m.id DESC) AS rn
            FROM mekong_measurement m
            ${dateFilterSql}
          ) measurement ON measurement.sensor_code = sensor.SensorNodeCode AND measurement.rn = 1
          ORDER BY measurement.fetched_at DESC, sensor.SensorNodeCode
        `;

        queryParams = dateParam ? [dateRange!.startUtc, dateRange!.endUtc] : [];
      }
    } else {
      query = `SELECT * FROM \`${tableName}\` ORDER BY fetched_at DESC LIMIT 100`;
    }

    const [rows] = await pool.query(query, queryParams);

    return NextResponse.json({
      source,
      data: rows
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized. DATA_MANAGER role required.' }, 
        { status: 403 }
      );
    }
    console.error('Database fetch error:', error);
    return NextResponse.json({ error: 'Database fetch failed', data: [] }, { status: 500 });
  }
}
