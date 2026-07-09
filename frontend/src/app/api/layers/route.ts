import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://123.22.61.134:8084/api';

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/gis/layers?page=0&size=100`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return NextResponse.json({ content: [], totalElements: 0, totalPages: 0, size: 100, number: 0 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ content: [], totalElements: 0, totalPages: 0, size: 100, number: 0 });
  }
}
