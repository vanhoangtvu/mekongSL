import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8084/api';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const prefix = searchParams.get('prefix') || '';
  const authHeader = request.headers.get('authorization');

  try {
    const url = `${API_URL}/s3/list?prefix=${encodeURIComponent(prefix)}`;
    const headers: HeadersInit = {};
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const body = await response.text();
      console.error("[s3-list proxy] backend error", response.status, body.slice(0, 300));
      return NextResponse.json(
        { files: [], count: 0, _error: `Backend returned ${response.status}`, _detail: body.slice(0, 200) },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[s3-list proxy] network error:", error);
    return NextResponse.json(
      { files: [], count: 0, _error: `Network error: ${String(error)}` },
      { status: 502 },
    );
  }
}
