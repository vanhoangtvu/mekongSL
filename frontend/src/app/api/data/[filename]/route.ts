import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getDataSourceOption, inferDataSourceFromFilename, normalizeDataSource } from '../../../../lib/constants/data-sources';
import { normalizeRecordList } from '../../../../lib/utils/record-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const source = normalizeDataSource(request.nextUrl.searchParams.get('source') ?? inferDataSourceFromFilename(filename));
    const config = getDataSourceOption(source);
    const dataDir = resolve(process.cwd(), config.outputFolder);
    
    // Convert CSV filename to JSON filename
    let jsonFilename = filename;
    if (jsonFilename.endsWith('.csv')) {
      jsonFilename = jsonFilename.replace('.csv', '.json');
    }
    if (jsonFilename === config.defaultFile.replace('.csv', '.json')) {
      jsonFilename = config.resultFile;
    }
    
    const filePath = resolve(dataDir, jsonFilename);
    const content = await readFile(filePath, 'utf-8');
    const jsonData = JSON.parse(content);
    
    return NextResponse.json({
      source,
      data: normalizeRecordList(jsonData)
    });
  } catch (error) {
    return NextResponse.json({ error: 'File not found', data: [] }, { status: 404 });
  }
}
