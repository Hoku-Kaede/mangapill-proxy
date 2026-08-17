export const config = { runtime: 'edge' };

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const BASE = 'https://toonily.com';

export default async function handler(req) {
  const url = new URL(req.url);
  const path = url.searchParams.get('path') || '/';
  const target = `${BASE}${path}`;

  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    const respHeaders = new Headers();
    upstream.headers.forEach((v, k) => {
      const lower = k.toLowerCase();
      if (lower === 'x-frame-options') return;
      if (lower === 'content-security-policy') {
        const stripped = v.replace(/frame-ancestors[^;]*(;|$)/gi, '').trim();
        if (stripped) respHeaders.set(k, stripped);
        return;
      }
      if (lower === 'cross-origin-embedder-policy') return;
      if (lower === 'cross-origin-opener-policy') return;
      if (lower === 'cross-origin-resource-policy') return;
      respHeaders.set(k, v);
    });

    respHeaders.set('Access-Control-Allow-Origin', '*');

    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: respHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
