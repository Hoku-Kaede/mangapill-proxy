export const config = { runtime: 'edge' };

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const BASE = 'https://manhuatop.org';

export default async function handler(req) {
  const url = new URL(req.url);
  const path = url.searchParams.get('path') || '/manga-release-schedule/';
  const target = `${BASE}${path}`;

  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://manhuatop.org/',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
      },
      redirect: 'follow',
    });

    const contentType = upstream.headers.get('content-type') || '';
    const isHtml = contentType.includes('text/html');

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
    respHeaders.delete('content-security-policy-report-only');

    let body;
    if (isHtml) {
      let html = await upstream.text();
      html = rewriteUrls(html, BASE);
      body = new TextEncoder().encode(html);
    } else {
      body = await upstream.arrayBuffer();
    }

    return new Response(body, {
      status: upstream.status,
      headers: respHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function rewriteUrls(html, base) {
  html = html.replace(
    /((?:href|src|action)=["'])(https?:\/\/manhuatop\.org)(\/[^"']*?)(["'])/g,
    (match, prefix, origin, path, suffix) => {
      return prefix + '/api/manhuatop?path=' + encodeURIComponent(path) + suffix;
    }
  );
  html = html.replace(
    /((?:href|src|action)=["'])(\/[^"']*?)(["'])/g,
    (match, prefix, path, suffix) => {
      if (path.startsWith('//')) return match;
      if (path.startsWith('http://') || path.startsWith('https://')) return match;
      return prefix + '/api/manhuatop?path=' + encodeURIComponent(path) + suffix;
    }
  );
  html = html.replace(
    /((?:href|src|action)=)([^"'\s>]+)(?=[\s>])/g,
    (match, prefix, path) => {
      if (path.startsWith('//') || path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return match;
      if (path.startsWith('/')) return prefix + '/api/manhuatop?path=' + encodeURIComponent(path);
      return match;
    }
  );
  return html;
}
