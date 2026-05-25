export type DataRecord = Record<string, unknown>;

function isDataRecord(value: unknown): value is DataRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function pickRecordArray(candidate: unknown): DataRecord[] | null {
  if (!Array.isArray(candidate)) {
    return null;
  }

  return candidate.filter(isDataRecord);
}

function normalizeEcowittSeries(payload: DataRecord): DataRecord[] | null {
  const data = isDataRecord(payload.data) ? payload.data : null;
  const groupedList = isDataRecord(data?.list) ? data.list : null;
  const timestamps = Array.isArray(data?.times) ? data.times : null;

  if (!groupedList || !timestamps?.length) {
    return null;
  }

  return timestamps.map((timestamp, rowIndex) => {
    const record: DataRecord = { time: timestamp };
    const timeDate = data && Array.isArray(data.timeDate) ? data.timeDate : null;

    if (timeDate && timeDate[rowIndex] !== undefined) {
      record.timeDate = timeDate[rowIndex];
    }

    for (const [groupKey, groupValue] of Object.entries(groupedList)) {
      if (!isDataRecord(groupValue) || !isDataRecord(groupValue.list)) {
        continue;
      }

      for (const [metricKey, metricValues] of Object.entries(groupValue.list)) {
        if (!Array.isArray(metricValues) || metricValues[rowIndex] === undefined) {
          continue;
        }

        record[`${groupKey}_${metricKey}`] = metricValues[rowIndex];
      }
    }

    return record;
  });
}

export function normalizeRecordList(payload: unknown): DataRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(isDataRecord);
  }

  if (!isDataRecord(payload)) {
    return [];
  }

  const maybeData = isDataRecord(payload.data) ? payload.data : null;

  const ecowittRecords = normalizeEcowittSeries(payload);
  if (ecowittRecords) {
    return ecowittRecords;
  }

  const candidates = [
    pickRecordArray(maybeData?.data),
    pickRecordArray(maybeData?.rows),
    pickRecordArray(maybeData?.list),
    pickRecordArray(maybeData?.records),
    pickRecordArray(payload.records),
    pickRecordArray(payload.rows),
    pickRecordArray(payload.list),
    pickRecordArray(payload.data),
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }

  return [];
}

export function collectRecordKeys(records: DataRecord[]): string[] {
  const keySet = new Set<string>();

  for (const record of records) {
    for (const key of Object.keys(record)) {
      keySet.add(key);
    }
  }

  return Array.from(keySet);
}

export function formatRecordValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function recordsToCsv(records: DataRecord[]): string {
  if (!records.length) {
    return 'No data available';
  }

  const headers = collectRecordKeys(records);

  const escapeValue = (value: unknown) => {
    const text = formatRecordValue(value);

    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
  };

  const rows = records.map((record) => headers.map((header) => escapeValue(record[header])).join(','));

  return [headers.join(','), ...rows].join('\n');
}
