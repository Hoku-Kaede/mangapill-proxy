export const config = { runtime: 'edge' };

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const BASE = 'https://manhuatop.org';

export default async function handler(req) {
  const url = new URL(req.url);
  const path = url.searchParams.get('path') || '/';
  const target = `${BASE}${path}`;

  const fetchOptions = {
    method: req.method,
    headers: {
      'User-Agent': UA,
      'Accept': req.headers.get('accept') || '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://manhuatop.org/',
    },
    redirect: 'follow',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    fetchOptions.body = await req.text();
    fetchOptions.headers['Content-Type'] = req.headers.get('content-type') || 'application/x-www-form-urlencoded';
  }

  try {
    const upstream = await fetch(target, fetchOptions);

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
    (match, prefix, _origin, path, suffix) => {
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
  // Rewrite absolute manhuatop.org URLs inside JS strings
  html = html.replace(/"https?:\/\/manhuatop\.org/g, '"/api/manhuatop?path=');
  html = html.replace(/'https?:\/\/manhuatop\.org/g, "'/api/manhuatop?path=");
  html = html.replace(/https?:\\\/\\\/manhuatop\.org/g, '/api/manhuatop?path=');
  // Fix double-encoded paths
  html = html.replace(/\/api\/manhuatop\?path=https%3A%2F%2Fmanhuatop\.org/g, '/api/manhuatop?path=');
  html = html.replace(/\/api\/manhuatop\?path=https:\/\/manhuatop\.org/g, '/api/manhuatop?path=');
  return html;
}
