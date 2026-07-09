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

function buildSign(params: Record<string, string>) {
  const sortedEntries = Object.keys(params)
    .sort()
    .map((key) => `${key}=${encodeFormComponent(params[key])}`)
    .join('&');
  return crypto.createHash('md5').update(`${sortedEntries}@ecowittnet`).digest('hex').toUpperCase();
}

function buildRequestBody(payload: Record<string, string>, requestPath: string) {
  const requestPayload: Record<string, string> = { ...payload, time: String(Math.floor(Date.now() / 1000)) };
  requestPayload.sign = buildSign(requestPayload);
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

export async function callEcowittApi(action: string, payload: Record<string, string>) {
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
