import mysql from 'mysql2/promise';

async function test() {
  const pool = mysql.createPool({ host: '127.0.0.1', user: 'root', password: '1111', database: 'mekong' });
  const startUtc = "2026-05-30 17:00:00";
  const endUtc = "2026-05-31 17:00:00";
  const localFetchedAt = "DATE_ADD(fetched_at, INTERVAL 7 HOUR)";
  
  const query = `
    SELECT DISTINCT
      CONCAT(fetched_at, '_', COALESCE(device_id, 'unknown')) AS fetch_run_id,
      device_id,
      DATE_FORMAT(${localFetchedAt}, '%Y-%m-%d %H:%i:%s') AS fetched_at
    FROM ecowitt
    WHERE fetched_at >= ? AND fetched_at < ?
    ORDER BY fetched_at DESC, device_id
  `;
  const [rows] = await pool.query(query, [startUtc, endUtc]);
  console.log('Timeframes:', rows);
  process.exit(0);
}
test();