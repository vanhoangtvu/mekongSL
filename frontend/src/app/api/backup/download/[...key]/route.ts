import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
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
  });
}

const BUCKET = process.env.S3_BUCKET || 'c01-mekong-prod-01';

// GET /api/backup/download/[...key]
// Ví dụ: /api/backup/download/data/2024/photo.jpg
// → stream file data/2024/photo.jpg từ S3 về browser
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    await requireRoleFromRequest(request, ['ADMIN']);
  } catch (e) {
    return NextResponse.json({ error: 'Unauthorized: Admin only' }, { status: 401 });
  }

  const { key: keySegments } = await params;
  const key = keySegments.join('/');

  if (!key) {
    return NextResponse.json({ error: 'Missing key' }, { status: 400 });
  }

  try {
    const client = getS3Client();
    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const s3res = await client.send(cmd);

    if (!s3res.Body) {
      return NextResponse.json({ error: 'File rỗng hoặc không tồn tại' }, { status: 404 });
    }

    const filename = key.split('/').pop() || 'file';

    // AWS SDK v3: Body hỗ trợ transformToWebStream() — chuẩn Web Streams API
    const webStream = s3res.Body.transformToWebStream();

    const headers = new Headers();
    headers.set('Content-Type', s3res.ContentType || 'application/octet-stream');
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    headers.set('Cache-Control', 'no-store');
    if (s3res.ContentLength) {
      headers.set('Content-Length', String(s3res.ContentLength));
    }

    return new NextResponse(webStream, { status: 200, headers });
  } catch (err: any) {
    console.error(`[backup/download] key="${key}" error:`, err.message);
    return NextResponse.json(
      { error: `Không tải được file: ${err.message}` },
      { status: 500 }
    );
  }
}
