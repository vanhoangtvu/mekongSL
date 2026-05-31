import mysql from 'mysql2/promise';

async function test() {
  const pool = mysql.createPool({ host: '127.0.0.1', user: 'root', password: '1111', database: 'mekong' });
  const [rows] = await pool.query('SELECT * FROM ecowitt ORDER BY fetched_at DESC LIMIT 100');
  console.log(`Fetched ${rows.length} rows.`);
  if (rows.length > 0) {
    const item = rows[0];
    const fetchedAtStr = JSON.parse(JSON.stringify(item.fetched_at));
    console.log('first item fetched_at:', fetchedAtStr);
  }
  process.exit(0);
}
test();