import mysql from 'mysql2/promise';

export const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '1111',
  database: process.env.MYSQL_DATABASE || 'mekong',
};

declare global {
  var _mysqlPool: mysql.Pool | undefined;
}

export const pool = global._mysqlPool || mysql.createPool({
  ...MYSQL_CONFIG,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

if (process.env.NODE_ENV !== 'production') {
  global._mysqlPool = pool;
}
