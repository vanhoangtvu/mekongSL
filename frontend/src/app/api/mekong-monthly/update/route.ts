import { spawn } from 'child_process';
import { resolve } from 'path';
import { NextResponse } from 'next/server';

async function runUpdate() {
  const repoRoot = resolve(process.cwd(), '..');
  const scriptPath = resolve(repoRoot, 'data/mekong/scripts/update-mekong-monthly-xlsx.mjs');

  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn('node', [scriptPath], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(stderr.trim() || stdout.trim() || `Update failed with code ${code}`));
    });
  });
}

export async function POST() {
  try {
    await runUpdate();
    return NextResponse.json({ message: 'Đã cập nhật file Excel theo tháng.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ message: 'Lỗi khi cập nhật: ' + message }, { status: 500 });
  }
}
