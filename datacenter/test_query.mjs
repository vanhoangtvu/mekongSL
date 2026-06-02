import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '111',
  database: 'mekong',
});

const testEcowitt = `SELECT * FROM ecowitt ORDER BY fetched_at DESC LIMIT 10`;
const testMekong = `
          SELECT
            sensor.id,
            sensor.SensorNodeCode,
            DATE_FORMAT(DATE_ADD(measurement.fetched_at, INTERVAL 7 HOUR), '%Y-%m-%d %H:%i:%s') AS fetched_at
          FROM mekong_sensor sensor
          INNER JOIN (
            SELECT m.*, ROW_NUMBER() OVER (PARTITION BY m.sensor_code ORDER BY m.fetched_at DESC, m.id DESC) AS rn
            FROM mekong_measurement m
          ) measurement ON measurement.sensor_code = sensor.SensorNodeCode AND measurement.rn = 1
          ORDER BY measurement.fetched_at DESC, sensor.SensorNodeCode
`;
        
async function run() {
  try {
    let [rows] = await pool.query(testMekong);
    console.log("mekong ok", rows.length);
  } catch(e) {
    console.error("Mekong Query Failed:", e.message);
  }
  
  try {
    let [rows] = await pool.query(testEcowitt);
    console.log("ecowitt ok", rows.length);
  } catch(e) {
    console.error("Ecowitt Query Failed:", e.message);
  }

  pool.end();
}
run();