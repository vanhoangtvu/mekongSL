import { NextRequest, NextResponse } from 'next/server';
import { callEcowittApi } from '../../../../lib/ecowitt-client';

export async function GET(request: NextRequest) {
  try {
    const action = request.nextUrl.searchParams.get('action') || 'get_data';
    const deviceId = request.nextUrl.searchParams.get('deviceId') || '';

    if (!deviceId) {
      return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 });
    }

    const payload: Record<string, string> = { device_id: deviceId };

    if (action === 'get_data') {
      let sdate = request.nextUrl.searchParams.get('sdate') || '';
      let edate = request.nextUrl.searchParams.get('edate') || '';
      if (!sdate || !edate) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const today = `${y}-${m}-${d}`;
        sdate = `${today} 00:00`;
        edate = `${today} 23:59`;
      }
      payload.is_list = '0';
      payload.mode = '0';
      payload.sdate = sdate;
      payload.edate = edate;
      payload.page = '1';
      payload.sortList = '1|3|4|5|6';
      payload.hideList = '';
    }

    const result = await callEcowittApi(action, payload);

    if (!result.ok) {
      return NextResponse.json(
        { error: `Ecowitt API error (${result.status})`, data: result.data },
        { status: 502 },
      );
    }

    return NextResponse.json({
      source: 'ecowitt',
      deviceId,
      action,
      data: result.data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Ecowitt proxy error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
