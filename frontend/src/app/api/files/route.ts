import { readdir, stat } from 'fs/promises';
import { resolve } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getDataSourceOption, normalizeDataSource } from '../../../lib/constants/data-sources';

export async function GET(request: NextRequest) {
  try {
    const source = normalizeDataSource(request.nextUrl.searchParams.get('source'));
    const config = getDataSourceOption(source);
    const dataDir = resolve(process.cwd(), config.outputFolder);
    const files = await readdir(dataDir);
    const csvFiles = await Promise.all(
      files
        .filter((fileName) => fileName.endsWith('.csv'))
        .map(async (fileName) => {
          const fileStat = await stat(resolve(dataDir, fileName));

          return {
            name: fileName,
            modifiedAt: fileStat.mtime.toISOString(),
            size: fileStat.size,
          };
        }),
    );

    csvFiles.sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));

    return NextResponse.json({ source, files: csvFiles });
  } catch (error) {
    return NextResponse.json({ error: 'Cannot read files', files: [], source: 'mekong' }, { status: 500 });
  }
}
