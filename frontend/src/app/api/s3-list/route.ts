import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://14.227.143.142:8084/api';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const prefix = searchParams.get('prefix') || '';

  try {
    const url = `${API_URL}/s3/list?prefix=${encodeURIComponent(prefix)}`;
    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json({ files: [], count: 0 }, { status: 200 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('S3 list proxy error:', error);
    return NextResponse.json({ files: [], count: 0 }, { status: 200 });
  }
}
