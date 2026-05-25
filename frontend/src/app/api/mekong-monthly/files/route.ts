import { readdir, stat } from 'fs/promises';
import { resolve } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getDataSourceOption } from '../../../../lib/constants/data-sources';
import { requireRoleFromRequest } from '../../../../lib/server-auth';

export async function GET(request: NextRequest) {
  try {
    await requireRoleFromRequest(request, ['DATA_MANAGER', 'ADMIN']);

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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized. DATA_MANAGER or ADMIN role required.', files: [] }, { status: 403 });
    }
    return NextResponse.json({ error: 'Cannot read files', files: [] }, { status: 500 });
  }
}
