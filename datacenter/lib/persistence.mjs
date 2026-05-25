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

function buildUniqueKeySql(uniqueKeyColumns = []) {
  if (!uniqueKeyColumns.length) {
    return '';
  }

  const uniqueName = `uniq_${uniqueKeyColumns.join('_')}`;
  const quotedColumns = uniqueKeyColumns.map(quoteIdentifier).join(', ');
  return `UNIQUE KEY ${quoteIdentifier(uniqueName)} (${quotedColumns})`;
}

function buildIndexSql(indexDefinition) {
  const quotedColumns = indexDefinition.columns.map(quoteIdentifier).join(', ');
  return `${indexDefinition.unique ? 'UNIQUE KEY' : 'KEY'} ${quoteIdentifier(indexDefinition.name)} (${quotedColumns})`;
}

function sameColumns(leftColumns, rightColumns) {
  return leftColumns.length === rightColumns.length && leftColumns.every((column, index) => column === rightColumns[index]);
}

async function getExistingIndexes(connection, databaseName, tableName) {
  const [indexRows] = await connection.query(
    `SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
    [databaseName, tableName],
  );

  const indexes = new Map();
  for (const row of indexRows) {
    if (row.INDEX_NAME === 'PRIMARY') {
      continue;
    }

    const entry = indexes.get(row.INDEX_NAME) || {
      unique: Number(row.NON_UNIQUE) === 0,
      columns: [],
    };
    entry.columns.push(row.COLUMN_NAME);
    indexes.set(row.INDEX_NAME, entry);
  }

  return indexes;
}

function hasMatchingIndex(existingIndexes, indexDefinition) {
  for (const [existingName, existingIndex] of existingIndexes.entries()) {
    if (existingName === indexDefinition.name) {
      return existingIndex.unique === Boolean(indexDefinition.unique) && sameColumns(existingIndex.columns, indexDefinition.columns);
    }

    if (existingIndex.unique === Boolean(indexDefinition.unique) && sameColumns(existingIndex.columns, indexDefinition.columns)) {
      return true;
    }
  }

  return false;
}

async function ensureMysqlTable(connection, databaseName, tableName, columnDefinitions, uniqueKeyColumns = [], indexDefinitions = []) {
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(databaseName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await connection.query(`USE ${quoteIdentifier(databaseName)}`);

  const [existingColumns] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [databaseName, tableName],
  );

  const existingColumnNames = new Set(existingColumns.map((row) => row.COLUMN_NAME));
  const existingIndexes = await getExistingIndexes(connection, databaseName, tableName);
  const normalizedUniqueDefinitions = uniqueKeyColumns.map((columns) => ({
    name: `uniq_${columns.join('_')}`,
    columns,
    unique: true,
  }));
  const normalizedIndexDefinitions = indexDefinitions.map((indexDefinition) => ({
    name: indexDefinition.name,
    columns: indexDefinition.columns,
    unique: Boolean(indexDefinition.unique),
  }));

  if (existingColumnNames.size === 0) {
    const createColumns = [
      '`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT',
      ...columnDefinitions.map(buildColumnDefinitionSql),
      ...normalizedUniqueDefinitions.map(buildIndexSql),
      ...normalizedIndexDefinitions.map(buildIndexSql),
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

  for (const uniqueDefinition of normalizedUniqueDefinitions) {
    if (!hasMatchingIndex(existingIndexes, uniqueDefinition)) {
      await connection.query(`ALTER TABLE ${quoteIdentifier(tableName)} ADD ${buildIndexSql(uniqueDefinition)}`);
    }
  }

  for (const indexDefinition of normalizedIndexDefinitions) {
    if (!hasMatchingIndex(existingIndexes, indexDefinition)) {
      await connection.query(`ALTER TABLE ${quoteIdentifier(tableName)} ADD ${buildIndexSql(indexDefinition)}`);
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
  uniqueKeyColumns = [],
  indexDefinitions = [],
  batchSize = 200,
}) {
  if (!rows.length) {
    return { insertedRows: 0 };
  }

  const { database: _ignoredDatabase, ...connectionConfig } = mysqlConfig || {};
  const connection = await mysql.createConnection(connectionConfig);

  try {
    await ensureMysqlTable(connection, databaseName, tableName, columnDefinitions, uniqueKeyColumns, indexDefinitions);

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

function buildUpsertSql(tableName, columnNames, updateColumnNames, rowCount) {
  const insertSql = buildInsertSql(tableName, columnNames, rowCount);
  const updates = updateColumnNames.map((columnName) => `${quoteIdentifier(columnName)} = VALUES(${quoteIdentifier(columnName)})`).join(', ');
  return `${insertSql} ON DUPLICATE KEY UPDATE ${updates}`;
}

export async function upsertRowsToMysql({
  mysqlConfig,
  databaseName,
  tableName,
  rows,
  columnDefinitions,
  uniqueKeyColumns = [],
  indexDefinitions = [],
  updateColumnNames = null,
  batchSize = 200,
}) {
  if (!rows.length) {
    return { affectedRows: 0 };
  }

  const { database: _ignoredDatabase, ...connectionConfig } = mysqlConfig || {};
  const connection = await mysql.createConnection(connectionConfig);

  try {
    await ensureMysqlTable(connection, databaseName, tableName, columnDefinitions, uniqueKeyColumns, indexDefinitions);

    const columnNames = columnDefinitions.map((column) => column.name);
    const resolvedUpdateColumns = updateColumnNames || columnNames.filter((columnName) => !uniqueKeyColumns.includes(columnName));
    let affectedRows = 0;

    for (let index = 0; index < rows.length; index += batchSize) {
      const batch = rows.slice(index, index + batchSize);
      const sql = buildUpsertSql(tableName, columnNames, resolvedUpdateColumns, batch.length);
      const values = batch.flatMap((row) => columnNames.map((columnName) => normalizeMysqlValue(row[columnName])));
      const [result] = await connection.query(sql, values);
      affectedRows += Number(result?.affectedRows || 0);
    }

    return { affectedRows };
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

export async function markRowsInactiveNotInList({
  mysqlConfig,
  databaseName,
  tableName,
  keyColumn,
  activeValues = [],
  inactiveClause = 'is_active = 0, inactive_at = NOW()',
}) {
  const { database: _ignoredDatabase, ...connectionConfig } = mysqlConfig || {};
  const connection = await mysql.createConnection(connectionConfig);

  try {
    await connection.query(`USE ${quoteIdentifier(databaseName)}`);

    if (!activeValues.length) {
      const sql = `UPDATE ${quoteIdentifier(tableName)} SET ${inactiveClause}`;
      const [result] = await connection.query(sql);
      return { affectedRows: Number(result?.affectedRows || 0) };
    }

    const placeholders = activeValues.map(() => '?').join(', ');
    const sql = `UPDATE ${quoteIdentifier(tableName)} SET ${inactiveClause} WHERE ${quoteIdentifier(keyColumn)} NOT IN (${placeholders})`;
    const [result] = await connection.query(sql, activeValues);

    return { affectedRows: Number(result?.affectedRows || 0) };
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
