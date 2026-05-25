import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import mysql from 'mysql2/promise';

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = value instanceof Date ? value.toISOString() : typeof value === 'object' ? JSON.stringify(value) : String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function collectColumns(rows) {
  const columns = [];
  const seen = new Set();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }

  return columns;
}

function quoteIdentifier(identifier) {
  return `\`${String(identifier).replaceAll('`', '``')}\``;
}

function normalizeMysqlValue(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 19).replace('T', ' ');
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return value;
}

export function formatMysqlDateTime(date = new Date()) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function normalizeColumnName(name) {
  const normalized = String(name)
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^([0-9])/, '_$1');

  return normalized || 'column';
}

export function buildCsvContent(rows, columns = collectColumns(rows)) {
  if (!rows.length) {
    return '';
  }

  const headerColumns = columns.length ? columns : collectColumns(rows);
  const lines = [headerColumns.map(escapeCsvValue).join(',')];

  for (const row of rows) {
    lines.push(headerColumns.map((column) => escapeCsvValue(row[column])).join(','));
  }

  return lines.join('\n');
}

export async function writeCsvSnapshot(csvPath, rows, columns) {
  const absolutePath = resolve(csvPath);
  await mkdir(dirname(absolutePath), { recursive: true });

  const csvContent = buildCsvContent(rows, columns);
  await writeFile(absolutePath, csvContent ? `${csvContent}\n` : '', 'utf8');

  return absolutePath;
}

function buildColumnDefinitionSql(column) {
  return `${quoteIdentifier(column.name)} ${column.type}`;
}

async function ensureMysqlTable(connection, databaseName, tableName, columnDefinitions) {
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(databaseName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await connection.query(`USE ${quoteIdentifier(databaseName)}`);

  const [existingColumns] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [databaseName, tableName],
  );

  const existingColumnNames = new Set(existingColumns.map((row) => row.COLUMN_NAME));

  if (existingColumnNames.size === 0) {
    const createColumns = [
      '`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT',
      ...columnDefinitions.map(buildColumnDefinitionSql),
      'PRIMARY KEY (`id`)',
    ].join(',\n  ');

    await connection.query(
      `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(tableName)} (\n  ${createColumns}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );
    return;
  }

  for (const column of columnDefinitions) {
    if (!existingColumnNames.has(column.name)) {
      await connection.query(`ALTER TABLE ${quoteIdentifier(tableName)} ADD COLUMN ${buildColumnDefinitionSql(column)}`);
    }
  }
}

function buildInsertSql(tableName, columnNames, rowCount) {
  const rowPlaceholders = `(${columnNames.map(() => '?').join(', ')})`;
  const allPlaceholders = Array.from({ length: rowCount }, () => rowPlaceholders).join(', ');
  const quotedColumns = columnNames.map(quoteIdentifier).join(', ');

  return `INSERT INTO ${quoteIdentifier(tableName)} (${quotedColumns}) VALUES ${allPlaceholders}`;
}

export async function syncRowsToMysql({
  mysqlConfig,
  databaseName,
  tableName,
  rows,
  columnDefinitions,
  batchSize = 200,
}) {
  if (!rows.length) {
    return { insertedRows: 0 };
  }

  const { database: _ignoredDatabase, ...connectionConfig } = mysqlConfig || {};
  const connection = await mysql.createConnection(connectionConfig);

  try {
    await ensureMysqlTable(connection, databaseName, tableName, columnDefinitions);

    const columnNames = columnDefinitions.map((column) => column.name);
    let insertedRows = 0;

    for (let index = 0; index < rows.length; index += batchSize) {
      const batch = rows.slice(index, index + batchSize);
      const sql = buildInsertSql(tableName, columnNames, batch.length);
      const values = batch.flatMap((row) => columnNames.map((columnName) => normalizeMysqlValue(row[columnName])));
      await connection.query(sql, values);
      insertedRows += batch.length;
    }

    return { insertedRows };
  } finally {
    await connection.end();
  }
}

export async function deleteRowsByDate({
  mysqlConfig,
  databaseName,
  tableName,
  dateColumn = 'fetched_at',
  dateValue,
  whereClause = '',
  whereParams = [],
}) {
  if (!dateValue) {
    return { deletedRows: 0 };
  }

  const { database: _ignoredDatabase, ...connectionConfig } = mysqlConfig || {};
  const connection = await mysql.createConnection(connectionConfig);

  try {
    await connection.query(`USE ${quoteIdentifier(databaseName)}`);

    const sql = `DELETE FROM ${quoteIdentifier(tableName)} WHERE DATE(${quoteIdentifier(dateColumn)}) = DATE(?)${whereClause ? ` AND ${whereClause}` : ''}`;
    const params = [dateValue, ...whereParams];
    const [result] = await connection.query(sql, params);

    return { deletedRows: Number(result?.affectedRows || 0) };
  } finally {
    await connection.end();
  }
}

export function buildMysqlColumnDefinitions(columns, overrides = {}) {
  return columns.map((name) => {
    const normalizedName = normalizeColumnName(name);
    return {
      name: normalizedName,
      sourceName: name,
      type: overrides[normalizedName] || 'LONGTEXT NULL',
    };
  });
}

export function remapRowsForMysql(rows, columnDefinitions) {
  return rows.map((row) => {
    const mappedRow = {};

    for (const column of columnDefinitions) {
      mappedRow[column.name] = row[column.sourceName];
    }

    return mappedRow;
  });
}

export function collectRowColumns(rows) {
  return collectColumns(rows);
}
