import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import { getDataSourceOption } from '../../../../lib/constants/data-sources';
import { requireRoleFromRequest } from '../../../../lib/server-auth';

export async function GET(request: NextRequest) {
  try {
    await requireRoleFromRequest(request, ['DATA_MANAGER', 'ADMIN']);

    const filename = request.nextUrl.searchParams.get('filename');

    if (!filename) {
      return NextResponse.json({ data: [] }, { status: 400 });
    }

    const config = getDataSourceOption('mekong');
    const dataDir = resolve(process.cwd(), config.outputFolder);
    const filePath = resolve(dataDir, filename);

    const buffer = await readFile(filePath);
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    if (!sheet) {
      return NextResponse.json({ data: [] }, { status: 404 });
    }

    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: true });
    return NextResponse.json({ data: rows });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ data: [], error: 'Unauthorized. DATA_MANAGER or ADMIN role required.' }, { status: 403 });
    }
    return NextResponse.json({ data: [], error: 'Cannot read Excel' }, { status: 500 });
  }
}
