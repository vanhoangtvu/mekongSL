import { readdir, stat } from 'fs/promises';
import { resolve } from 'path';
import { NextResponse } from 'next/server';
import { getDataSourceOption } from '../../../../lib/constants/data-sources';

export async function GET() {
  try {
    const config = getDataSourceOption('mekong');
    const dataDir = resolve(process.cwd(), config.outputFolder);
    const files = await readdir(dataDir);

    const xlsxFiles = await Promise.all(
      files
        .filter((fileName) => fileName.endsWith('.xlsx') && fileName.startsWith('mekong-'))
        .map(async (fileName) => {
          const fileStat = await stat(resolve(dataDir, fileName));

          return {
            name: fileName,
            modifiedAt: fileStat.mtime.toISOString(),
            size: fileStat.size,
          };
        }),
    );

    xlsxFiles.sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));

    return NextResponse.json({ files: xlsxFiles });
  } catch (error) {
    return NextResponse.json({ error: 'Cannot read files', files: [] }, { status: 500 });
  }
}
