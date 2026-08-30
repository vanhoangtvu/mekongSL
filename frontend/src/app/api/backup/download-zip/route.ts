import { NextRequest, NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { requireRoleFromRequest } from '@/lib/server-auth';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';
import { ZipArchive } from 'archiver';

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

export async function GET(request: NextRequest) {
  try {
    await requireRoleFromRequest(request, ['ADMIN']);
  } catch (e) {
    return NextResponse.json({ error: 'Unauthorized: Admin only' }, { status: 401 });
  }

  const client = getS3Client();

  const archive = new ZipArchive({
    zlib: { level: 5 } // Mức nén cân bằng giữa tốc độ và dung lượng
  });

  const { PassThrough } = require('stream');
  const passThrough = new PassThrough();
  archive.pipe(passThrough);

  // Chuyển đổi Node.js stream sang Web ReadableStream để trả về Next.js
  const stream = Readable.toWeb(passThrough);

  // Chạy background process để tải và nén file
  (async () => {
    try {
      let token: string | undefined;
      let fileCount = 0;

      do {
        const cmd = new ListObjectsV2Command({
          Bucket: BUCKET,
          ContinuationToken: token,
          MaxKeys: 100, // Lấy từng mẻ nhỏ
        });
        const res = await client.send(cmd);

        for (const obj of res.Contents ?? []) {
          if (obj.Key && !obj.Key.endsWith('/')) {
            const getCmd = new GetObjectCommand({ Bucket: BUCKET, Key: obj.Key });
            const s3res = await client.send(getCmd);
            
            if (s3res.Body) {
              // @ts-ignore - transformToWebStream is available in AWS SDK v3
              const webStream = s3res.Body.transformToWebStream();
              const nodeStream = Readable.fromWeb(webStream as any);
              
              archive.append(nodeStream, { name: obj.Key });
              fileCount++;

              // Quan trọng: Đợi file hiện tại ghi xong vào archive rồi mới tải file tiếp theo
              // Giúp tránh bị tràn RAM và giới hạn số lượng connection
              await new Promise<void>((resolve, reject) => {
                nodeStream.on('end', () => resolve());
                nodeStream.on('error', (err) => reject(err));
              });
            }
          }
        }
        token = res.IsTruncated ? res.NextContinuationToken : undefined;
      } while (token);

      console.log(`[ZIP Backup] Hoàn tất nén ${fileCount} files.`);
      await archive.finalize();
    } catch (err) {
      console.error('[ZIP Backup] Lỗi khi tạo file nén:', err);
      archive.abort();
    }
  })();

  const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
  const headers = new Headers();
  headers.set('Content-Type', 'application/zip');
  headers.set('Content-Disposition', `attachment; filename="backup_mekong_${dateStr}.zip"`);
  
  return new NextResponse(stream as any, { headers });
}
