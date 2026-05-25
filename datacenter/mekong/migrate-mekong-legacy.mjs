#!/usr/bin/env node

import mysql from 'mysql2/promise';
import {
  buildMysqlColumnDefinitions,
  formatMysqlDateTime,
  remapRowsForMysql,
  syncRowsToMysql,
  upsertRowsToMysql,
} from '../lib/persistence.mjs';

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '1111',
  database: process.env.MYSQL_DATABASE || 'mekong',
};

const SENSOR_COLUMN_DEFINITIONS = buildMysqlColumnDefinitions(
  [
    'source',
    '_id',
    'SensorNodeCode',
    'Longitude',
    'Latitude',
    'ProvinceName',
    'ProvinceCode',
    'SNShortName',
    'SNDescription',
    'SNShortNameEN',
    'SNDescriptionEN',
    'SerialNumber',
    'NameLine_1',
    'NameLine_2',
    'first_seen_at',
    'last_seen_at',
    'is_active',
    'inactive_at',
  ],
  {
    source: 'VARCHAR(32) NOT NULL',
    _id: 'CHAR(24) NULL',
    SensorNodeCode: 'VARCHAR(64) NOT NULL',
    Longitude: 'DECIMAL(12,9) NULL',
    Latitude: 'DECIMAL(12,9) NULL',
    ProvinceName: 'VARCHAR(255) NULL',
    ProvinceCode: 'INT NULL',
    SNShortName: 'VARCHAR(255) NULL',
    SNDescription: 'VARCHAR(255) NULL',
    SNShortNameEN: 'VARCHAR(255) NULL',
    SNDescriptionEN: 'VARCHAR(255) NULL',
    SerialNumber: 'VARCHAR(64) NULL',
    NameLine_1: 'VARCHAR(255) NULL',
    NameLine_2: 'VARCHAR(255) NULL',
    first_seen_at: 'DATETIME NOT NULL',
    last_seen_at: 'DATETIME NOT NULL',
    is_active: 'TINYINT(1) NOT NULL',
    inactive_at: 'DATETIME NULL',
  },
);

const MEASUREMENT_COLUMN_DEFINITIONS = buildMysqlColumnDefinitions(
  ['sensor_code', 'fetched_at', 'fetch_run_id', 'source', 'record_index', 'Salinity', 'PH', 'WaterLevel', 'Alkalinity'],
  {
    sensor_code: 'VARCHAR(64) NOT NULL',
    fetched_at: 'DATETIME NOT NULL',
    fetch_run_id: 'VARCHAR(64) NOT NULL',
    source: 'VARCHAR(32) NOT NULL',
    record_index: 'INT NOT NULL',
    Salinity: 'DECIMAL(12,3) NULL',
    PH: 'DECIMAL(12,3) NULL',
    WaterLevel: 'DECIMAL(12,3) NULL',
    Alkalinity: 'DECIMAL(12,3) NULL',
  },
);

function toMysqlDateTime(value) {
  if (value instanceof Date) {
    return formatMysqlDateTime(value);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return formatMysqlDateTime(parsed);
}

function toDateKey(value) {
  const dateTime = toMysqlDateTime(value);
  return dateTime ? dateTime.slice(0, 10) : null;
}

function buildSensorRows(rows, latestDateKey) {
  const sensorMap = new Map();

  for (const row of rows) {
    const sensorCode = row.SensorNodeCode;
    if (!sensorCode) {
      continue;
    }

    const fetchedAt = toMysqlDateTime(row.fetched_at);
    const dateKey = toDateKey(row.fetched_at);
    if (!fetchedAt || !dateKey) {
      continue;
    }

    const current = sensorMap.get(sensorCode);
    if (!current) {
      sensorMap.set(sensorCode, {
        source: 'mekong',
        _id: row._id ?? null,
        SensorNodeCode: sensorCode,
        Longitude: row.Longitude ?? null,
        Latitude: row.Latitude ?? null,
        ProvinceName: row.ProvinceName ?? null,
        ProvinceCode: row.ProvinceCode ?? null,
        SNShortName: row.SNShortName ?? null,
        SNDescription: row.SNDescription ?? null,
        SNShortNameEN: row.SNShortNameEN ?? null,
        SNDescriptionEN: row.SNDescriptionEN ?? null,
        SerialNumber: row.SerialNumber ?? null,
        NameLine_1: row.NameLine_1 ?? null,
        NameLine_2: row.NameLine_2 ?? null,
        first_seen_at: fetchedAt,
        last_seen_at: fetchedAt,
        is_active: dateKey === latestDateKey ? 1 : 0,
        inactive_at: dateKey === latestDateKey ? null : fetchedAt,
      });
      continue;
    }

    const currentFirstSeen = current.first_seen_at;
    const currentLastSeen = current.last_seen_at;

    if (fetchedAt < currentFirstSeen) {
      current.first_seen_at = fetchedAt;
    }

    if (fetchedAt > currentLastSeen) {
      current.last_seen_at = fetchedAt;
      current._id = row._id ?? current._id;
      current.Longitude = row.Longitude ?? current.Longitude;
      current.Latitude = row.Latitude ?? current.Latitude;
      current.ProvinceName = row.ProvinceName ?? current.ProvinceName;
      current.ProvinceCode = row.ProvinceCode ?? current.ProvinceCode;
      current.SNShortName = row.SNShortName ?? current.SNShortName;
      current.SNDescription = row.SNDescription ?? current.SNDescription;
      current.SNShortNameEN = row.SNShortNameEN ?? current.SNShortNameEN;
      current.SNDescriptionEN = row.SNDescriptionEN ?? current.SNDescriptionEN;
      current.SerialNumber = row.SerialNumber ?? current.SerialNumber;
      current.NameLine_1 = row.NameLine_1 ?? current.NameLine_1;
      current.NameLine_2 = row.NameLine_2 ?? current.NameLine_2;
      current.is_active = dateKey === latestDateKey ? 1 : current.is_active;
    }
  }

  return Array.from(sensorMap.values()).map((sensor) => ({
    ...sensor,
    inactive_at: sensor.is_active ? null : sensor.last_seen_at,
  }));
}

function buildMeasurementRows(rows) {
  return rows.map((row) => {
    const fetchedAt = toMysqlDateTime(row.fetched_at);
    const dateKey = toDateKey(row.fetched_at) || 'legacy';

    return {
      sensor_code: row.SensorNodeCode ?? null,
      fetched_at: fetchedAt,
      fetch_run_id: `legacy-${dateKey}`,
      source: 'mekong',
      record_index: row.record_index ?? 0,
      Salinity: row.Salinity ?? null,
      PH: row.PH ?? null,
      WaterLevel: row.WaterLevel ?? null,
      Alkalinity: row.Alkalinity ?? null,
    };
  });
}

async function main() {
  const connection = await mysql.createConnection(MYSQL_CONFIG);

  try {
    const [tableCheckRows] = await connection.query("SHOW TABLES LIKE 'mekong'");
    if (!tableCheckRows.length) {
      console.log(JSON.stringify({ success: false, message: 'Legacy table mekong not found' }, null, 2));
      return;
    }

    const [legacyRows] = await connection.query('SELECT * FROM mekong ORDER BY fetched_at ASC, id ASC');
    if (!legacyRows.length) {
      console.log(JSON.stringify({ success: true, message: 'Legacy table is empty', insertedSensors: 0, insertedMeasurements: 0 }, null, 2));
      return;
    }

    const latestDateKey = legacyRows.reduce((latest, row) => {
      const dateKey = toDateKey(row.fetched_at);
      return dateKey && (!latest || dateKey > latest) ? dateKey : latest;
    }, null);

    await connection.query('DROP TABLE IF EXISTS mekong_measurement');
    await connection.query('DROP TABLE IF EXISTS mekong_sensor');

    const sensorRows = buildSensorRows(legacyRows, latestDateKey);
    const measurementRows = buildMeasurementRows(legacyRows);

    const mysqlSensorRows = remapRowsForMysql(sensorRows, SENSOR_COLUMN_DEFINITIONS);
    await upsertRowsToMysql({
      mysqlConfig: MYSQL_CONFIG,
      databaseName: MYSQL_CONFIG.database,
      tableName: 'mekong_sensor',
      rows: mysqlSensorRows,
      columnDefinitions: SENSOR_COLUMN_DEFINITIONS,
      uniqueKeyColumns: ['SensorNodeCode'],
      updateColumnNames: [
        'source',
        '_id',
        'Longitude',
        'Latitude',
        'ProvinceName',
        'ProvinceCode',
        'SNShortName',
        'SNDescription',
        'SNShortNameEN',
        'SNDescriptionEN',
        'SerialNumber',
        'NameLine_1',
        'NameLine_2',
        'last_seen_at',
        'is_active',
        'inactive_at',
      ],
    });

    const mysqlMeasurementRows = remapRowsForMysql(measurementRows, MEASUREMENT_COLUMN_DEFINITIONS);
    await syncRowsToMysql({
      mysqlConfig: MYSQL_CONFIG,
      databaseName: MYSQL_CONFIG.database,
      tableName: 'mekong_measurement',
      rows: mysqlMeasurementRows,
      columnDefinitions: MEASUREMENT_COLUMN_DEFINITIONS,
      indexDefinitions: [
        { name: 'idx_mekong_measurement_fetched_at', columns: ['fetched_at'] },
        { name: 'idx_mekong_measurement_fetch_run_id', columns: ['fetch_run_id'] },
        { name: 'idx_mekong_measurement_sensor_code_fetched_at', columns: ['sensor_code', 'fetched_at'] },
      ],
    });

    console.log(
      JSON.stringify(
        {
          success: true,
          legacyRows: legacyRows.length,
          insertedSensors: sensorRows.length,
          insertedMeasurements: measurementRows.length,
          latestDateKey,
        },
        null,
        2,
      ),
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
