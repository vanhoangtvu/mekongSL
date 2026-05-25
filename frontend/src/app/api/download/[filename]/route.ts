import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { stat } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { getDataSourceOption, inferDataSourceFromFilename, normalizeDataSource } from '../../../../lib/constants/data-sources';

function formatTimestampForFilename(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const source = normalizeDataSource(request.nextUrl.searchParams.get('source') ?? inferDataSourceFromFilename(filename));
    const config = getDataSourceOption(source);
    const dataDir = resolve(process.cwd(), config.outputFolder);
    const filePath = resolve(dataDir, filename);
    const fileStat = await stat(filePath);
    const content = await readFile(filePath);
    const extensionIndex = filename.lastIndexOf('.');
    const baseName = extensionIndex >= 0 ? filename.slice(0, extensionIndex) : filename;
    const extension = extensionIndex >= 0 ? filename.slice(extensionIndex) : '';
    const timestampedFilename = `${baseName}_${formatTimestampForFilename(fileStat.mtime)}${extension}`;
    const normalizedExtension = extension.toLowerCase();
    const contentType = normalizedExtension === '.xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : normalizedExtension === '.csv'
        ? 'text/csv'
        : 'application/octet-stream';
    
    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${timestampedFilename}"`
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
