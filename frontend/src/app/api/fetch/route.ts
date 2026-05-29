import { spawn } from 'child_process';
import { resolve } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeDataSource } from '../../../lib/constants/data-sources';
import { requireRoleFromRequest } from '../../../lib/server-auth';

async function runFetch(request: NextRequest) {
  try {
    await requireRoleFromRequest(request, ['DATA_MANAGER', 'ADMIN']);

    const source = normalizeDataSource(request.nextUrl.searchParams.get('source'));
    const deviceIdParam = request.nextUrl.searchParams.get('deviceId');
    
    const scriptMap: Record<string, string> = {
      mekong: resolve(process.cwd(), '../datacenter/mekong/fetch-mekong-data.mjs'),
      ecowitt: resolve(process.cwd(), '../datacenter/ecowitt/fetch-ecowitt-data.mjs'),
    };

    const fetchScript = scriptMap[source];
    if (!fetchScript) {
      return NextResponse.json({ message: 'Invalid data source' }, { status: 400 });
    }

    const scriptArgs = [fetchScript];
    if (source === 'ecowitt' && deviceIdParam) {
      scriptArgs.push('--device-id', deviceIdParam);
    }

    // Run fetch script (saves directly to MySQL)
    const result = await new Promise<{ recordCount: number; insertedRows: number }>((resolve, reject) => {
      const fetchProcess = spawn('node', scriptArgs, {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      fetchProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      fetchProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      fetchProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const parsed = JSON.parse(stdout);
            resolve({ recordCount: parsed.recordCount || 0, insertedRows: parsed.insertedRows || 0 });
          } catch {
            resolve({ recordCount: 0, insertedRows: 0 });
          }
        } else {
          reject(new Error(`Fetch failed: ${stderr || stdout}`));
        }
      });
    });

    return NextResponse.json({ 
      message: `Đã cập nhật ${result.insertedRows} bản ghi vào database`,
      source,
      recordCount: result.recordCount,
      insertedRows: result.insertedRows,
      timestamp: new Date().toLocaleString('vi-VN')
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Unauthorized') {
      return NextResponse.json({ 
        message: 'Unauthorized. DATA_MANAGER or ADMIN role required.' 
      }, { status: 403 });
    }
    return NextResponse.json({ 
      message: 'Lỗi khi lấy dữ liệu: ' + message
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return runFetch(request);
}

export async function POST(request: NextRequest) {
  return runFetch(request);
}
