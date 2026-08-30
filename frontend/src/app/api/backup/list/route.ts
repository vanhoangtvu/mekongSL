import { NextRequest, NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { requireRoleFromRequest } from '@/lib/server-auth';
import { readFileSync } from 'fs';
import { join } from 'path';

// manage.sh không truyền .env của root cho frontend, nên ta tự đọc nếu thiếu
function loadParentEnv() {
  if (process.env.S3_ACCESS_KEY) return;
  try {
    const content = readFileSync(join(process.cwd(), '../.env'), 'utf-8');
    content.split('\n').forEach(line => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    });
  } catch (e) {
    console.error('Không thể đọc file ../.env', e);
  }
}
loadParentEnv();

function getS3Client() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT || 'https://backup.hci.vn',
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY!,
      secretAccessKey: process.env.S3_SECRET_KEY!,
    },
    forcePathStyle: true,
    requestHandler: {
      requestTimeout: 30_000, // 30s timeout per request
    } as any,
  });
}

const BUCKET = process.env.S3_BUCKET || 'c01-mekong-prod-01';

// GET /api/backup/list?prefix=...
// Trả về toàn bộ danh sách objects trong bucket
export async function GET(request: NextRequest) {
  try {
    await requireRoleFromRequest(request, ['ADMIN']);
  } catch (e) {
    return NextResponse.json({ error: 'Unauthorized: Admin only' }, { status: 401 });
  }

  const prefix = request.nextUrl.searchParams.get('prefix') || '';

  try {
    const client = getS3Client();
    const objects: { key: string; size: number; lastModified: string }[] = [];
    let token: string | undefined;
    let pageCount = 0;

    console.log(`[backup/list] Listing bucket="${BUCKET}" prefix="${prefix}"`);

    do {
      pageCount++;
      const cmd = new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix || undefined,
        ContinuationToken: token,
        MaxKeys: 1000,
      });
      const res = await client.send(cmd);

      for (const obj of res.Contents ?? []) {
        if (obj.Key && !obj.Key.endsWith('/')) {
          objects.push({
            key: obj.Key,
            size: obj.Size ?? 0,
            lastModified: obj.LastModified?.toISOString() ?? '',
          });
        }
      }

      console.log(`[backup/list] Page ${pageCount}: ${res.Contents?.length ?? 0} objects (total so far: ${objects.length})`);
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);

    const totalSize = objects.reduce((s, o) => s + o.size, 0);
    console.log(`[backup/list] Done: ${objects.length} objects, ${totalSize} bytes`);

    return NextResponse.json({ objects, total: objects.length, totalSize });
  } catch (err: any) {
    console.error('[backup/list] Error:', err.message);
    return NextResponse.json(
      { error: `Không thể liệt kê S3: ${err.message}` },
      { status: 500 }
    );
  }
}
