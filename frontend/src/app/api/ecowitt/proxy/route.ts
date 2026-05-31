import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const ECOWITT_ACCOUNT = process.env.ECOWITT_ACCOUNT || 'lethuy2026n@gmail.com';
const ECOWITT_PASSWORD = process.env.ECOWITT_PASSWORD || '200417a@';
const ECOWITT_AUTHORIZE = process.env.ECOWITT_AUTHORIZE || '';

let cachedCookie = process.env.ECOWITT_COOKIE || '';
let cookieFetchedAt = 0;

function encodeFormComponent(value: string) {
  return encodeURIComponent(String(value))
    .replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
}

function buildSign(params: Record<string, string>, path: string) {
  const sortedEntries = Object.keys(params)
    .sort()
    .map((key) => `${key}=${encodeFormComponent(params[key])}`)
    .join('&');
  return crypto.createHash('md5').update(`${sortedEntries}@ecowittnet`).digest('hex').toUpperCase();
}

function buildRequestBody(payload: Record<string, string>, requestPath: string) {
  const requestPayload: Record<string, string> = { ...payload, time: String(Math.floor(Date.now() / 1000)) };
  requestPayload.sign = buildSign(requestPayload, requestPath);
  return new URLSearchParams(requestPayload).toString();
}

function mergeCookies(cookieHeader: string, jar: Map<string, string>) {
  const merged = new Map(jar);
  for (const pair of String(cookieHeader).split('; ')) {
    if (!pair) continue;
    const equalsIndex = pair.indexOf('=');
    if (equalsIndex > 0) {
      merged.set(pair.slice(0, equalsIndex), pair.slice(equalsIndex + 1));
    }
  }
  return merged;
}

function jarToCookieHeader(jar: Map<string, string>) {
  return Array.from(jar, ([name, value]) => `${name}=${value}`).join('; ');
}

function captureResponseCookies(response: Response, jar: Map<string, string>) {
  const headerValues = response.headers.getSetCookie?.() || [];
  for (const headerValue of headerValues) {
    const [nameValue] = headerValue.split(';', 1);
    const equalsIndex = nameValue.indexOf('=');
    if (equalsIndex > 0) {
      jar.set(nameValue.slice(0, equalsIndex), nameValue.slice(equalsIndex + 1));
    }
  }
  return jar;
}

async function ensureLoggedIn() {
  const now = Date.now();
  if (cachedCookie && now - cookieFetchedAt < 600000) return cachedCookie;

  const jar = new Map<string, string>();
  if (cachedCookie) {
    mergeCookies(cachedCookie, jar);
  }

  const homeRes = await fetch('https://www.ecowitt.net/', {
    headers: { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
  });
  captureResponseCookies(homeRes, jar);

  const body = new URLSearchParams({
    account: ECOWITT_ACCOUNT,
    password: ECOWITT_PASSWORD,
    authorize: ECOWITT_AUTHORIZE,
  }).toString();

  const loginRes = await fetch('https://www.ecowitt.net/user/site/login', {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Cookie: jarToCookieHeader(jar),
    },
    body,
  });

  captureResponseCookies(loginRes, jar);
  cachedCookie = jarToCookieHeader(jar);
  cookieFetchedAt = now;
  return cachedCookie;
}

async function callEcowittApi(action: string, payload: Record<string, string>) {
  const cookie = await ensureLoggedIn();
  const requestPath = `/index/${action}`;
  const body = buildRequestBody(payload, requestPath);

  const res = await fetch(`https://www.ecowitt.net/index/${action}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-EcowittLang': 'en',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Web-Version': '1',
      Cookie: cookie,
    },
    body,
  });

  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }

  return { ok: res.ok, status: res.status, data };
}

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
