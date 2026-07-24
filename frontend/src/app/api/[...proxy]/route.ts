import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8084/api';

type RouteContext = { params: Promise<{ proxy: string[] }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const { proxy } = await context.params;
  return proxyRequest(req, proxy, 'GET');
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { proxy } = await context.params;
  return proxyRequest(req, proxy, 'POST');
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { proxy } = await context.params;
  return proxyRequest(req, proxy, 'PUT');
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { proxy } = await context.params;
  return proxyRequest(req, proxy, 'DELETE');
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { proxy } = await context.params;
  return proxyRequest(req, proxy, 'PATCH');
}

async function proxyRequest(req: NextRequest, segments: string[], method: string) {
  const path = segments.join('/');
  const search = req.nextUrl.search;
  const url = `${API_URL}/${path}${search}`;

  const body = method !== 'GET' && method !== 'HEAD' ? await req.text() : undefined;

  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (!['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
      headers[key] = value;
    }
  });

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body || undefined,
    });

    const data = await res.arrayBuffer();
    let ct = res.headers.get('content-type') || 'application/octet-stream';
    if (ct === 'application/octet-stream' || ct === 'binary/octet-stream') {
      const fullUrl = path + search;
      const ext = fullUrl.split('.').pop()?.split('&')[0]?.toLowerCase();
      const mimeMap: Record<string, string> = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
        ico: 'image/x-icon', pdf: 'application/pdf',
        json: 'application/json', csv: 'text/csv',
      };
      if (ext && mimeMap[ext]) ct = mimeMap[ext];
    }
    const respHeaders: Record<string, string> = {
      'Content-Type': ct,
    };
    const contentLen = res.headers.get('content-length');
    if (contentLen) respHeaders['Content-Length'] = contentLen;
    const contentDisp = res.headers.get('content-disposition');
    if (contentDisp) respHeaders['Content-Disposition'] = contentDisp;

    return new NextResponse(data, {
      status: res.status,
      headers: respHeaders,
    });
  } catch {
    return NextResponse.json({ error: 'Proxy error' }, { status: 502 });
  }
}
