import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8084/api';

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
  }

  try {
    const backendUrl = new URL(`${API_URL}/s3/render`);
    backendUrl.searchParams.set('key', key);

    const headers = new Headers();
    const range = request.headers.get('range');
    if (range) {
      headers.set('Range', range);
    }

    const res = await fetch(backendUrl.toString(), {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return NextResponse.json(
        { error: body?.error || `Upstream error: ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.arrayBuffer();
    const responseHeaders: Record<string, string> = {
      'Content-Type': res.headers.get('content-type') || 'image/tiff',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Accept-Ranges': 'bytes',
    };
    const contentRange = res.headers.get('content-range');
    if (contentRange) {
      responseHeaders['Content-Range'] = contentRange;
    }
    const contentLength = res.headers.get('content-length');
    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength;
    }

    return new NextResponse(data, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
