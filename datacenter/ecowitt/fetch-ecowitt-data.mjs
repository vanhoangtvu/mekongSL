#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import crypto from 'node:crypto';
import {
  buildMysqlColumnDefinitions,
  collectRowColumns,
  formatMysqlDateTime,
  remapRowsForMysql,
  syncRowsToMysql,
  writeCsvSnapshot,
} from '../lib/persistence.mjs';

const DEFAULT_PAYLOAD = {
  device_id: '281727',
  is_list: '0',
  mode: '0',
  sdate: '2026-05-12 00:00',
  edate: '2026-05-12 23:59',
  page: '1',
  sortList: '1|3|4|5|6',
  hideList: '',
};

const DEFAULT_LOGIN_PAYLOAD = {
  account: process.env.ECOWITT_ACCOUNT || 'lethuy2026n@gmail.com',
  password: process.env.ECOWITT_PASSWORD || '200417a@',
  authorize: process.env.ECOWITT_AUTHORIZE || '',
};

const LOGIN_COOKIE = process.env.ECOWITT_COOKIE || '';

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '1111',
  database: process.env.MYSQL_DATABASE || 'mekong',
};

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }

    if (!token.startsWith('--')) {
      continue;
    }

    const [flag, inlineValue] = token.split('=', 2);
    const key = flag.slice(2);

    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const nextValue = argv[index + 1];
    if (nextValue && !nextValue.startsWith('--')) {
      args[key] = nextValue;
      index += 1;
    } else {
      args[key] = true;
    }
  }

  return args;
}

function printUsage() {
  console.log(`Usage:
  node Datacenter/ecowitt/fetch-ecowitt-data.mjs [--output result.json] [--cookie "name=value; ..."] [--cookie-file cookies.txt] [--account email] [--password secret] [--authorize value]

The script posts the Ecowitt form payload with the same time/sign logic used by the web app.
If account/password are provided, the script logs in first, captures the session cookie,
and then calls get_data with that cookie.
Each run also writes a CSV snapshot and syncs the rows into MySQL database "mekong".
`);
}

function buildCsvPath(outputPath) {
  const fallbackPath = resolve(process.cwd(), 'Datacenter/output/ecowitt.csv');
  if (!outputPath) {
    return fallbackPath;
  }

  return resolve(process.cwd(), String(outputPath)).replace(/\.json$/i, '.csv');
}

function buildEcowittRows(data, fetchedAt) {
  const times = Array.isArray(data?.times) ? data.times : [];
  const rows = times.map((time, index) => ({
    fetched_at: fetchedAt,
    source: 'ecowitt',
    record_index: index + 1,
    record_time: time,
  }));

  for (const [groupKey, groupValue] of Object.entries(data?.list || {})) {
    const seriesMap = groupValue?.list;

    if (!seriesMap || typeof seriesMap !== 'object') {
      continue;
    }

    for (const [seriesKey, seriesValues] of Object.entries(seriesMap)) {
      if (!Array.isArray(seriesValues)) {
        continue;
      }

      const columnName = `${groupKey}__${seriesKey}`;

      for (let index = 0; index < rows.length; index += 1) {
        rows[index][columnName] = seriesValues[index] ?? '';
      }
    }
  }

  return rows;
}

function buildEcowittColumnDefinitions(rows) {
  const columns = collectRowColumns(rows);
  return buildMysqlColumnDefinitions(columns, {
    fetched_at: 'DATETIME NOT NULL',
    source: 'VARCHAR(32) NOT NULL',
    record_index: 'INT NOT NULL',
    record_time: 'VARCHAR(32) NULL',
  });
}

function encodeFormComponent(value) {
  return encodeURIComponent(String(value))
    .replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
}

function buildSign(params, path) {
  const sortedEntries = Object.keys(params)
    .sort()
    .map((key) => `${key}=${encodeFormComponent(params[key])}`)
    .join('&');

  return crypto.createHash('md5').update(`${sortedEntries}@ecowittnet`).digest('hex').toUpperCase();
}

function buildRequestBody(payload, requestPath) {
  const requestPayload = { ...payload, time: String(Math.floor(Date.now() / 1000)) };
  requestPayload.sign = buildSign(requestPayload, requestPath);
  return new URLSearchParams(requestPayload).toString();
}

async function readBody(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function stringify(value) {
  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function parseCookieHeader(cookieHeader) {
  return String(cookieHeader)
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .join('; ');
}

function mergeCookies(cookieHeader, jar) {
  const merged = new Map(jar);

  for (const pair of parseCookieHeader(cookieHeader).split('; ')) {
    if (!pair) {
      continue;
    }

    const equalsIndex = pair.indexOf('=');
    if (equalsIndex > 0) {
      merged.set(pair.slice(0, equalsIndex), pair.slice(equalsIndex + 1));
    }
  }

  return merged;
}

function jarToCookieHeader(jar) {
  return Array.from(jar, ([name, value]) => `${name}=${value}`).join('; ');
}

function captureResponseCookies(response, jar) {
  const headerValues = response.headers.getSetCookie?.() || [];

  for (const headerValue of headerValues) {
    const [nameValue] = headerValue.split(';', 1);
    const equalsIndex = nameValue.indexOf('=');
    if (equalsIndex > 0) {
      jar.set(nameValue.slice(0, equalsIndex), nameValue.slice(equalsIndex + 1));
    }
  }

  return jar;
}

async function readCookieFile(cookieFile) {
  const fileText = await readFile(cookieFile, 'utf8');
  const cookies = [];

  for (const line of fileText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const parts = trimmed.split('\t');
    if (parts.length >= 7) {
      const name = parts[5];
      const value = parts[6];
      if (name && value) {
        cookies.push(`${name}=${value}`);
      }
    }
  }

  return cookies.join('; ');
}

async function bootstrapCookies() {
  const jar = new Map();

  const homeResponse = await fetch('https://www.ecowitt.net/', {
    method: 'GET',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  captureResponseCookies(homeResponse, jar);

  return jarToCookieHeader(jar);
}

async function loginEcowitt(loginPayload, existingCookie) {
  const jar = new Map();

  if (existingCookie) {
    mergeCookies(existingCookie, jar).forEach((value, key) => jar.set(key, value));
  }

  const body = new URLSearchParams({
    account: String(loginPayload.account || ''),
    password: String(loginPayload.password || ''),
    authorize: String(loginPayload.authorize || ''),
  }).toString();

  const response = await fetch('https://www.ecowitt.net/user/site/login', {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      ...(existingCookie ? { Cookie: existingCookie } : {}),
    },
    body,
  });

  captureResponseCookies(response, jar);

  const data = await readBody(response);

  if (!response.ok) {
    throw new Error(`Ecowitt login failed (${response.status} ${response.statusText}): ${stringify(data)}`);
  }

  if (data && typeof data === 'object' && 'errcode' in data && String(data.errcode) !== '0') {
    throw new Error(`Ecowitt login returned ${String(data.errcode)}: ${stringify(data)}`);
  }

  return {
    cookie: jarToCookieHeader(jar),
    data,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  let cookie = args.cookie || LOGIN_COOKIE;

  if (!cookie && args.cookieFile) {
    cookie = await readCookieFile(String(args.cookieFile));
  }

  const loginPayload = {
    account: args.account || DEFAULT_LOGIN_PAYLOAD.account,
    password: args.password || DEFAULT_LOGIN_PAYLOAD.password,
    authorize: args.authorize !== undefined ? String(args.authorize) : DEFAULT_LOGIN_PAYLOAD.authorize,
  };

  const shouldLogin = Boolean(loginPayload.account && loginPayload.password);

  if (!cookie && args.bootstrap !== false && !shouldLogin) {
    cookie = await bootstrapCookies();
  }

  let loginResult = null;
  if (shouldLogin) {
    loginResult = await loginEcowitt(loginPayload, cookie);
    cookie = loginResult.cookie;
  }

  const payload = {
    ...DEFAULT_PAYLOAD,
    ...(args.deviceId ? { device_id: String(args.deviceId) } : {}),
    ...(args.isList ? { is_list: String(args.isList) } : {}),
    ...(args.mode ? { mode: String(args.mode) } : {}),
    ...(args.sdate ? { sdate: String(args.sdate) } : {}),
    ...(args.edate ? { edate: String(args.edate) } : {}),
    ...(args.page ? { page: String(args.page) } : {}),
    ...(args.sortList ? { sortList: String(args.sortList) } : {}),
    ...(args.hideList !== undefined ? { hideList: String(args.hideList) } : {}),
  };

  const requestPath = '/index/get_data';
  const body = buildRequestBody(payload, requestPath);

  const response = await fetch('https://www.ecowitt.net/index/get_data', {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-EcowittLang': 'en',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Web-Version': '1',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body,
  });

  const data = await readBody(response);

  if (!response.ok) {
    throw new Error(`Ecowitt request failed (${response.status} ${response.statusText}): ${stringify(data)}`);
  }

  if (data && typeof data === 'object' && 'errcode' in data && String(data.errcode) !== '0') {
    throw new Error(`Ecowitt returned ${String(data.errcode)}: ${stringify(data)}`);
  }

  const output = {
    login: loginResult,
    request: payload,
    data,
  };

  const fetchedAt = formatMysqlDateTime();
  const rows = buildEcowittRows(data, fetchedAt);
  const csvPath = buildCsvPath(args.output);
  const csvColumns = collectRowColumns(rows);

  await writeCsvSnapshot(csvPath, rows, csvColumns);

  if (rows.length) {
    const columnDefinitions = buildEcowittColumnDefinitions(rows);
    const mysqlRows = remapRowsForMysql(rows, columnDefinitions);

    await syncRowsToMysql({
      mysqlConfig: MYSQL_CONFIG,
      databaseName: MYSQL_CONFIG.database,
      tableName: 'ecowitt',
      rows: mysqlRows,
      columnDefinitions,
      indexDefinitions: [
        { name: 'idx_ecowitt_fetched_at', columns: ['fetched_at'] },
        { name: 'idx_ecowitt_record_time', columns: ['record_time'] },
      ],
    });
  }

  if (args.output) {
    const absolutePath = resolve(process.cwd(), String(args.output));
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, JSON.stringify(output, null, 2), 'utf8');
  }

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
