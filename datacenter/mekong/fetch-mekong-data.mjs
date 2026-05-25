#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import CryptoJS from 'crypto-js';
import {
  buildMysqlColumnDefinitions,
  collectRowColumns,
  formatMysqlDateTime,
  markRowsInactiveNotInList,
  remapRowsForMysql,
  upsertRowsToMysql,
  syncRowsToMysql,
  writeCsvSnapshot,
} from '../lib/persistence.mjs';

const LOGIN_URL = 'https://mktokenv2.rynanmobile.com/api/LoginCustomer';
const DATA_URL = 'https://mktokenv2.rynanmobile.com/api/Mekong/GetNewIndexDeviceInProvince';

const HARD_CODED_CONFIG = {
  username: 'Tvunet',
  password: '123456',
  deviceUuid: '2FB96A47-B821-4260-809F-FA2A58CDEEE2',
  deviceInfo:
    '{"DeviceID":"cQFP41zkj0_wj0KfjMYS0S:APA91bGAdSSZaaBF6C8xzyh2g3Sms0oVRXpEgQDjEk6WVvobJoga5sDfDZyoA2WmfmrSXTz1t3MD7cX_aP3Tp8NqWzZiVc3l3agkwNwElyjBtOZOPO8_-4","DeviceIP":"192.168.0.1","DeviceName":"iPhone17,2","AppProject":"MEKONG","UUID":"2FB96A47-B821-4260-809F-FA2A58CDEEE2","OS":"iOS"}',
  customerCode: 'MK38582',
  provinceCode: '86',
  timezone: '7',
  appCode: 'MEKONG',
  loginUrl: LOGIN_URL,
  dataUrl: DATA_URL,
  loginMethod: 'POST',
};

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '1111',
  database: process.env.MYSQL_DATABASE || 'mekong',
};

function encryptPassword(username, password) {
  const derivedKey = username.substring(1, 4);
  return CryptoJS.AES.encrypt(password, derivedKey).toString();
}

function parseArgs(argv) {
  const result = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help' || token === '-h') {
      result.help = true;
      continue;
    }

    if (token.startsWith('--')) {
      const [flag, inlineValue] = token.split('=', 2);
      const key = flag.slice(2);

      if (inlineValue !== undefined) {
        result[key] = inlineValue;
        continue;
      }

      const nextValue = argv[index + 1];
      if (nextValue && !nextValue.startsWith('--')) {
        result[key] = nextValue;
        index += 1;
      } else {
        result[key] = true;
      }
    }
  }

  return result;
}

function printUsage() {
  console.log(`Usage:
  node Datacenter/mekong/fetch-mekong-data.mjs [--output result.json]

The script uses hard-coded Mekong credentials and request fields.
Each run also writes a CSV snapshot and syncs the rows into MySQL database "mekong".
Edit HARD_CODED_CONFIG in this file if you need to switch account.
`);
}

function buildCsvPath(outputPath) {
  const fallbackPath = resolve(process.cwd(), 'Datacenter/output/mekong.csv');
  if (!outputPath) {
    return fallbackPath;
  }

  return resolve(process.cwd(), String(outputPath)).replace(/\.json$/i, '.csv');
}

function buildMekongRows(records, fetchedAt) {
  return records.map((record, index) => ({
    fetched_at: fetchedAt,
    source: 'mekong',
    record_index: index + 1,
    ...record,
  }));
}

function buildMekongColumnDefinitions(rows) {
  const columns = collectRowColumns(rows);
  return buildMysqlColumnDefinitions(columns, {
    fetched_at: 'DATETIME NOT NULL',
    source: 'VARCHAR(32) NOT NULL',
    record_index: 'INT NOT NULL',
  });
}

function buildMekongSensorRows(records, fetchedAt) {
  return records.map((record) => ({
    source: 'mekong',
    _id: record._id ?? null,
    SensorNodeCode: record.SensorNodeCode ?? null,
    Longitude: record.Longitude ?? null,
    Latitude: record.Latitude ?? null,
    ProvinceName: record.ProvinceName ?? null,
    ProvinceCode: record.ProvinceCode ?? null,
    SNShortName: record.SNShortName ?? null,
    SNDescription: record.SNDescription ?? null,
    SNShortNameEN: record.SNShortNameEN ?? null,
    SNDescriptionEN: record.SNDescriptionEN ?? null,
    SerialNumber: record.SerialNumber ?? null,
    NameLine_1: record.NameLine_1 ?? null,
    NameLine_2: record.NameLine_2 ?? null,
    first_seen_at: fetchedAt,
    last_seen_at: fetchedAt,
    is_active: 1,
    inactive_at: null,
  }));
}

function buildMekongSensorColumnDefinitions(rows) {
  const columns = collectRowColumns(rows);
  return buildMysqlColumnDefinitions(columns, {
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
  });
}

function buildMekongMeasurementRows(records, fetchedAt, fetchRunId) {
  return records.map((record, index) => ({
    sensor_code: record.SensorNodeCode ?? null,
    fetched_at: fetchedAt,
    fetch_run_id: fetchRunId,
    source: 'mekong',
    record_index: index + 1,
    Salinity: record.Salinity ?? null,
    PH: record.PH ?? null,
    WaterLevel: record.WaterLevel ?? null,
    Alkalinity: record.Alkalinity ?? null,
  }));
}

function buildMekongMeasurementColumnDefinitions(rows) {
  const columns = collectRowColumns(rows);
  return buildMysqlColumnDefinitions(columns, {
    sensor_code: 'VARCHAR(64) NOT NULL',
    fetched_at: 'DATETIME NOT NULL',
    fetch_run_id: 'VARCHAR(64) NOT NULL',
    source: 'VARCHAR(32) NOT NULL',
    record_index: 'INT NOT NULL',
    Salinity: 'DECIMAL(12,3) NULL',
    PH: 'DECIMAL(12,3) NULL',
    WaterLevel: 'DECIMAL(12,3) NULL',
    Alkalinity: 'DECIMAL(12,3) NULL',
  });
}

function buildUrl(baseUrl, params) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function readResponseBody(response) {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function stringifyBody(body) {
  if (typeof body === 'string') {
    return body;
  }

  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return String(body);
  }
}

function findStringByKey(value, targetKey, seen = new Set()) {
  if (value == null || typeof value !== 'object') {
    return null;
  }

  if (seen.has(value)) {
    return null;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringByKey(item, targetKey, seen);
      if (found) {
        return found;
      }
    }
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (key === targetKey && typeof nestedValue === 'string' && nestedValue.trim()) {
      return nestedValue.trim();
    }

    const found = findStringByKey(nestedValue, targetKey, seen);
    if (found) {
      return found;
    }
  }

  return null;
}

function extractToken(value, seen = new Set()) {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(trimmed)) {
      return trimmed;
    }

    return null;
  }

  if (typeof value !== 'object') {
    return null;
  }

  if (seen.has(value)) {
    return null;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const token = extractToken(item, seen);
      if (token) {
        return token;
      }
    }
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (/token/i.test(key) && typeof nestedValue === 'string' && nestedValue.trim()) {
      return nestedValue.trim();
    }

    const token = extractToken(nestedValue, seen);
    if (token) {
      return token;
    }
  }

  return null;
}

async function loginCustomer(config) {
  const encryptedPassword = encryptPassword(config.username, config.password);
  
  const payload = new URLSearchParams({
    Timezone: config.timezone,
    Username: config.username,
    Password: encryptedPassword,
    AppCode: config.appCode,
    deviceuuid: config.deviceUuid,
    DeviceInfo: config.deviceInfo,
  });

  const loginMethod = config.loginMethod.toUpperCase();
  const loginUrl =
    loginMethod === 'GET' ? buildUrl(config.loginUrl, Object.fromEntries(payload.entries())) : config.loginUrl;

  const response = await fetch(loginUrl, {
    method: loginMethod,
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: loginMethod === 'GET' ? undefined : payload,
  });

  const body = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(
      `Login failed (${response.status} ${response.statusText}). The account may require an encrypted password instead of plaintext, or the credentials/device payload may be invalid: ${stringifyBody(body)}`,
    );
  }

  const token = extractToken(body);
  if (!token) {
    throw new Error(`Login response did not contain a token: ${stringifyBody(body)}`);
  }

  const customerCode = findStringByKey(body, 'CustomerCode') || config.customerCode;

  return { token, customerCode };
}

async function fetchProvinceData(config, token, customerCode) {
  const dataUrl = buildUrl(config.dataUrl, {
    token,
    Timezone: config.timezone,
    CustomerCode: customerCode,
    ProvinceCode: config.provinceCode,
  });

  const response = await fetch(dataUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain, */*',
    },
  });

  const body = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(`Data request failed (${response.status} ${response.statusText}): ${stringifyBody(body)}`);
  }

  return body;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  const config = {
    ...HARD_CODED_CONFIG,
    loginMethod: HARD_CODED_CONFIG.loginMethod,
  };

  const loginResult = await loginCustomer(config);
  const data = await fetchProvinceData(config, loginResult.token, loginResult.customerCode);
  const fetchedAt = formatMysqlDateTime();
  const fetchRunId = randomUUID();
  const records = Array.isArray(data?.data) ? data.data : [];
  const sensorRows = buildMekongSensorRows(records, fetchedAt);
  const measurementRows = buildMekongMeasurementRows(records, fetchedAt, fetchRunId);

  if (sensorRows.length) {
    const sensorColumnDefinitions = buildMekongSensorColumnDefinitions(sensorRows);
    const mysqlSensorRows = remapRowsForMysql(sensorRows, sensorColumnDefinitions);

    await upsertRowsToMysql({
      mysqlConfig: MYSQL_CONFIG,
      databaseName: MYSQL_CONFIG.database,
      tableName: 'mekong_sensor',
      rows: mysqlSensorRows,
      columnDefinitions: sensorColumnDefinitions,
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

    await markRowsInactiveNotInList({
      mysqlConfig: MYSQL_CONFIG,
      databaseName: MYSQL_CONFIG.database,
      tableName: 'mekong_sensor',
      keyColumn: 'SensorNodeCode',
      activeValues: records.map((record) => record.SensorNodeCode).filter(Boolean),
    });
  }

  if (measurementRows.length) {
    const measurementColumnDefinitions = buildMekongMeasurementColumnDefinitions(measurementRows);
    const mysqlMeasurementRows = remapRowsForMysql(measurementRows, measurementColumnDefinitions);

    await syncRowsToMysql({
      mysqlConfig: MYSQL_CONFIG,
      databaseName: MYSQL_CONFIG.database,
      tableName: 'mekong_measurement',
      rows: mysqlMeasurementRows,
      columnDefinitions: measurementColumnDefinitions,
      indexDefinitions: [
        { name: 'idx_mekong_measurement_fetched_at', columns: ['fetched_at'] },
        { name: 'idx_mekong_measurement_fetch_run_id', columns: ['fetch_run_id'] },
        { name: 'idx_mekong_measurement_sensor_code_fetched_at', columns: ['sensor_code', 'fetched_at'] },
      ],
    });
  }

  console.log(JSON.stringify({ success: true, recordCount: records.length, insertedRows: measurementRows.length, fetchRunId }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
