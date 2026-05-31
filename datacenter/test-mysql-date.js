const mysql = require('mysql2/promise');
async function test() {
  const pool = mysql.createPool({ host: '127.0.0.1', user: 'root', password: '1111', database: 'mekong' });
  const [rows] = await pool.query('SELECT fetched_at, record_time FROM ecowitt LIMIT 1');
  console.log('Raw from mysql2:', rows[0].fetched_at);
  console.log('JSON.stringify:', JSON.stringify(rows[0].fetched_at));
  process.exit(0);
}
test();
