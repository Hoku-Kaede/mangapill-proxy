export const config = { runtime: 'edge' };

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const SITE_CSS = {
  'asuracomic.net': `
    <style id="hide-premium">
      [class*="announcement"], [class*="embla-announcements"],
      [class*="premium"], [class*="subscribe"], [class*="pricing"],
      [class*="plan"], [class*="banner-ad"], [class*="promo"] {
        display: none !important;
      }
    </style>`,
  'vortexscans.org': `
    <style id="hide-share-footer">
      [class*="share"], [class*="social"], [class*="discord"],
      [class*="report"], [class*="footer"], footer {
        display: none !important;
      }
    </style>`,
};

export default async function handler(req) {
  const url = new URL(req.url);
  const target = url.searchParams.get('url');

  if (!target) {
    return new Response('Missing ?url= param', { status: 400 });
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return new Response('Invalid URL', { status: 400 });
  }

  const base = parsed.origin;
  const hostname = parsed.hostname;

  const fetchOptions = {
    method: req.method,
    headers: {
      'User-Agent': UA,
      'Accept': req.headers.get('accept') || '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': base + '/',
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
      html = rewriteUrls(html, base, hostname);
      const siteCss = SITE_CSS[hostname] || '';
      if (siteCss) {
        html = injectCss(html, siteCss);
      }
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

function rewriteUrls(html, base, hostname) {
  html = html.replace(
    /((?:href|src|action)=["'])(https?:\/\/[^"']+)(["'])/g,
    (match, prefix, fullUrl, suffix) => {
      try {
        const u = new URL(fullUrl);
        if (u.hostname === hostname) {
          return prefix + '/api/proxy?url=' + encodeURIComponent(u.origin + u.pathname + u.search) + suffix;
        }
      } catch {}
      return match;
    }
  );
  html = html.replace(
    /((?:href|src|action)=["'])(\/[^"']*?)(["'])/g,
    (match, prefix, path, suffix) => {
      if (path.startsWith('//')) return match;
      if (path.startsWith('http://') || path.startsWith('https://')) return match;
      return prefix + '/api/proxy?url=' + encodeURIComponent(base + path) + suffix;
    }
  );
  html = html.replace(
    /((?:href|src|action)=)([^"'\s>]+)(?=[\s>])/g,
    (match, prefix, path) => {
      if (path.startsWith('//') || path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return match;
      if (path.startsWith('/')) return prefix + '/api/proxy?url=' + encodeURIComponent(base + path);
      return match;
    }
  );
  // Rewrite absolute domain URLs in JS strings
  const escaped = hostname.replace(/\./g, '\\.');
  html = html.replace(
    new RegExp(`"https?://${escaped}([^"]*)"`, 'g'),
    (_, path) => '"/api/proxy?url=' + encodeURIComponent(base + path)
  );
  html = html.replace(
    new RegExp(`'https?://${escaped}([^']*)'`, 'g'),
    (_, path) => "'/api/proxy?url=" + encodeURIComponent(base + path)
  );
  return html;
}

function injectCss(html, css) {
  if (html.includes('</head>')) {
    return html.replace('</head>', css + '</head>');
  }
  return css + html;
}
