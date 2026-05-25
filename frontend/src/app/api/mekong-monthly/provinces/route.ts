import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { requireRoleFromRequest } from '../../../../lib/server-auth';

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '1111',
  database: process.env.MYSQL_DATABASE || 'mekong',
};

export async function GET(request: NextRequest) {
  try {
    await requireRoleFromRequest(request, ['DATA_MANAGER', 'ADMIN']);

    const connection = await mysql.createConnection(MYSQL_CONFIG);
    const [rows] = await connection.query(
      `SELECT DISTINCT ProvinceCode AS code, ProvinceName AS name FROM mekong_sensor WHERE ProvinceCode IS NOT NULL ORDER BY ProvinceName`,
    );
    await connection.end();

    return NextResponse.json({ provinces: rows });
  } catch (err) {
    console.error('Provinces fetch error', err);
    return NextResponse.json({ provinces: [] }, { status: 500 });
  }
}
