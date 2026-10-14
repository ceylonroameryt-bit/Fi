import { NextRequest, NextResponse } from 'next/server';

/**
 * Runtime proxy from the web app to the API.
 *
 * This replaces the old `rewrites()` in next.config.js. Rewrites are compiled at
 * `next build`, so the API address was frozen into the image (and fell back to a
 * hard-coded App Runner URL). This handler reads API_URL when each request arrives,
 * so the same image works in every environment.
 *
 * It also forwards the caller's X-Forwarded-For so the API can rate-limit and audit
 * by the real client IP (see TRUST_PROXY on the API).
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

function apiBase(): string | null {
  const raw = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (!raw) return process.env.NODE_ENV === 'production' ? null : 'http://localhost:4000';
  return raw.replace(/\/$/, '').replace(/\/api\/v1$/, '');
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const base = apiBase();
  if (!base) {
    return NextResponse.json(
      { error: { code: 'CONFIG_ERROR', message: 'The web app is not configured with an API_URL.' } },
      { status: 502 },
    );
  }

  const { path = [] } = await ctx.params;
  const target = new URL(`${base}/api/v1/${path.map(encodeURIComponent).join('/')}`);
  target.search = req.nextUrl.search;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set('x-forwarded-host', req.headers.get('host') ?? '');
  headers.set('x-forwarded-proto', req.nextUrl.protocol.replace(':', ''));

  const hasBody = !['GET', 'HEAD'].includes(req.method);
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'NETWORK_ERROR', message: 'The API could not be reached. Please try again shortly.' } },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    // fetch already decoded the body, and Set-Cookie is copied one by one below.
    if (HOP_BY_HOP.has(k) || k === 'content-encoding' || k === 'set-cookie') return;
    responseHeaders.set(key, value);
  });
  for (const cookie of upstream.headers.getSetCookie()) {
    responseHeaders.append('set-cookie', cookie);
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
