export interface DBFField {
  name: string;
  type: string;
  length: number;
  decimal: number;
}

export interface DBFRecord {
  [key: string]: string;
}

export interface DBFResult {
  fields: DBFField[];
  records: DBFRecord[];
  numRecords: number;
}

export function parseDBF(buf: ArrayBuffer, encoding = "windows-1258"): DBFResult {
  const dv = new DataView(buf);

  const numRecords = dv.getUint32(4, true);
  const headerLen = dv.getUint16(8, true);
  const recordLen = dv.getUint16(10, true);

  const numFields = (headerLen - 32 - 1) / 32;
  const fields: DBFField[] = [];
  let offset = 32;

  for (let i = 0; i < numFields; i++) {
    const nameBytes = new Uint8Array(buf, offset, 11);
    let end = 0;
    while (end < 11 && nameBytes[end] !== 0) end++;
    const name = new TextDecoder("ascii").decode(nameBytes.slice(0, end));
    fields.push({
      name,
      type: String.fromCharCode(dv.getUint8(offset + 11)),
      length: dv.getUint8(offset + 16),
      decimal: dv.getUint8(offset + 17),
    });
    offset += 32;
  }

  const decoder = new TextDecoder(encoding, { fatal: false });
  const records: DBFRecord[] = [];
  const recordStart = headerLen;

  for (let r = 0; r < numRecords; r++) {
    const recOff = recordStart + r * recordLen;
    if (recOff + recordLen > buf.byteLength) break;
    if (dv.getUint8(recOff) === 0x2a) continue;

    const record: DBFRecord = {};
    let fieldOff = recOff + 1;

    for (const field of fields) {
      const raw = new Uint8Array(buf, fieldOff, field.length);
      let value: string;
      if (field.type === "C") {
        value = decoder.decode(raw).replace(/\x00/g, "").trim();
      } else {
        value = decoder.decode(raw).trim();
      }
      record[field.name] = value;
      fieldOff += field.length;
    }

    records.push(record);
  }

  return { fields, records, numRecords: records.length };
}

export function findDbfKeyField(fields: DBFField[]): DBFField {
  return fields.find((f) => f.type === "N") || fields[0];
}

export function buildDbfLookup(
  records: DBFRecord[],
  keyField: DBFField
): Record<string, DBFRecord> {
  const map: Record<string, DBFRecord> = {};
  for (const rec of records) {
    const key = rec[keyField.name]?.trim();
    if (key) map[key] = rec;
  }
  return map;
}
