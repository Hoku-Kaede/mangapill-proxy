export const config = { runtime: 'edge' };

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const SITE_CSS = {
  'vortexscans.org': `
    <style id="hide-share-footer">
      [class*="share"], [class*="social"], [class*="discord"],
      [class*="report"], footer, [class*="footer"] {
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
  const proxyOrigin = url.origin;

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

    let body;
    if (isHtml) {
      let html = await upstream.text();
      const siteCss = SITE_CSS[hostname] || '';

      // 1. Inject <base> first, BEFORE rewriting, so relative asset URLs resolve to original domain
      if (!html.includes('<base')) {
        html = html.replace(/<head([^>]*)>/i, '<head$1><base href="' + base + '/">');
      }

      // 2. Now rewrite <a href> navigation to go through proxy
      //    Skip <base> tag's own href
      html = rewriteNavigation(html, base, hostname, proxyOrigin);

      // 3. Inject site-specific CSS
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

function rewriteNavigation(html, base, hostname, proxyOrigin) {
  // Rewrite href attributes to absolute proxy URLs for same-origin navigation
  // Skip <base> tags — their href should stay pointing at the original domain
  return html.replace(
    /(<base\b[^>]*?)href=["']([^"']*)["']/gi,
    (match) => match // preserve <base> href as-is
  ).replace(
    /(<(?!base\b)(?:a|area)\b[^>]*?)href=["']((?:https?:\/\/)?[^"']*)["']/gi,
    (match, prefix, val) => {
      try {
        if (val.startsWith('#') || val.startsWith('javascript:') || val.startsWith('mailto:') || val.startsWith('tel:')) {
          return match;
        }
        let targetUrl;
        if (val.startsWith('http://') || val.startsWith('https://')) {
          targetUrl = new URL(val);
        } else if (val.startsWith('/')) {
          targetUrl = new URL(base + val);
        } else {
          return match;
        }
        if (targetUrl.hostname === hostname) {
          const full = targetUrl.origin + targetUrl.pathname + targetUrl.search + targetUrl.hash;
          return prefix + 'href="' + proxyOrigin + '/api/proxy?url=' + encodeURIComponent(full) + '"';
        }
      } catch {}
      return match;
    }
  );
}

function injectCss(html, css) {
  if (html.includes('</head>')) {
    return html.replace('</head>', css + '</head>');
  }
  return css + html;
}
