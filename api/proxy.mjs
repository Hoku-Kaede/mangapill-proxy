export const config = { runtime: 'edge' };

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const SITE_INJECT = {
  'manhuatop.org': `
    <style id="hide-clutter">
      [class*="share"], [class*="social"], [class*="discord"],
      [class*="report"], footer, [class*="footer"],
      .yarpp-related, .wp-caption-text {
        display: none !important;
      }
    </style>
    <script>
    (function() {
      var target = 'https://manhuatop.org';
      var proxyBase = '/api/proxy?url=' + encodeURIComponent(target);
      var s3proxy = '/api/proxy?url=' + encodeURIComponent('https://s3.manhuatop.org');

      function toProxy(path) {
        if (!path) return path;
        if (path.indexOf('/api/proxy') === 0) return path;
        if (path.indexOf('http') === 0) {
          try {
            var u = new URL(path);
            if (u.hostname === 'manhuatop.org' || u.hostname.endsWith('.manhuatop.org')) {
              return '/api/proxy?url=' + encodeURIComponent(path);
            }
          } catch(e) {}
          return path;
        }
        if (path.indexOf('/') === 0) return proxyBase + encodeURIComponent(path);
        return path;
      }

      var origPush = history.pushState;
      var origReplace = history.replaceState;
      history.pushState = function() {
        var a = Array.prototype.slice.call(arguments);
        if (a[2]) a[2] = toProxy(a[2]);
        return origPush.apply(this, a);
      };
      history.replaceState = function() {
        var a = Array.prototype.slice.call(arguments);
        if (a[2]) a[2] = toProxy(a[2]);
        return origReplace.apply(this, a);
      };

      document.addEventListener('click', function(e) {
        var a = e.target.closest('a');
        if (!a || !a.href) return;
        try {
          var url = new URL(a.href, location.href);
          if (url.origin === location.origin && url.pathname.indexOf('/api/proxy') !== 0) {
            e.preventDefault();
            e.stopPropagation();
            location.href = '/api/proxy?url=' + encodeURIComponent(target + url.pathname + url.search + url.hash);
          }
        } catch(ex) {}
      }, true);

      var origFetch = window.fetch;
      window.fetch = function(input, init) {
        if (typeof input === 'string' && input.indexOf('http') === 0) {
          try {
            var u = new URL(input);
            if (u.hostname === 'manhuatop.org' || u.hostname.endsWith('.manhuatop.org')) {
              input = '/api/proxy?url=' + encodeURIComponent(input);
            }
          } catch(e) {}
        }
        return origFetch.apply(this, arguments);
      };

      var origOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === 'string' && url.indexOf('http') === 0) {
          try {
            var u = new URL(url);
            if (u.hostname === 'manhuatop.org' || u.hostname.endsWith('.manhuatop.org')) {
              arguments[1] = '/api/proxy?url=' + encodeURIComponent(url);
            }
          } catch(e) {}
        }
        return origOpen.apply(this, arguments);
      };
    })();
    </script>`,
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

  const isSameSite = (h) => h === hostname || h.endsWith('.' + hostname);

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
    const isJs = contentType.includes('javascript') || contentType.includes('/x-javascript');

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
      html = rewriteHtml(html, base, isSameSite, proxyOrigin);
      const siteCss = SITE_INJECT[hostname] || '';
      if (siteCss) {
        html = injectCss(html, siteCss);
      }
      body = new TextEncoder().encode(html);
    } else if (isJs) {
      let js = await upstream.text();
      js = rewriteJs(js, base, isSameSite, proxyOrigin);
      body = new TextEncoder().encode(js);
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

function rewriteHtml(html, base, isSameSite, proxyOrigin) {
  // Rewrite all href attributes
  html = html.replace(
    /href=["']((?:https?:\/\/)?[^"']*?)["']/gi,
    (match, val) => {
      try {
        if (val.startsWith('#') || val.startsWith('javascript:') || val.startsWith('mailto:') || val.startsWith('tel:') || val.startsWith('data:')) {
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
        if (isSameSite(targetUrl.hostname)) {
          const full = targetUrl.origin + targetUrl.pathname + targetUrl.search + targetUrl.hash;
          return 'href="' + proxyOrigin + '/api/proxy?url=' + encodeURIComponent(full) + '"';
        }
      } catch {}
      return match;
    }
  );

  // Rewrite all src attributes
  html = html.replace(
    /src=["']((?:https?:\/\/)?[^"']*?)["']/gi,
    (match, val) => {
      try {
        if (val.startsWith('data:') || val.startsWith('javascript:')) {
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
        if (isSameSite(targetUrl.hostname)) {
          const full = targetUrl.origin + targetUrl.pathname + targetUrl.search;
          return 'src="' + proxyOrigin + '/api/proxy?url=' + encodeURIComponent(full) + '"';
        }
      } catch {}
      return match;
    }
  );

  // Rewrite srcset attributes
  html = html.replace(
    /srcset=["']([^"']*?)["']/gi,
    (match, val) => {
      const rewritten = val.replace(
        /((?:https?:\/\/)?[^\s,]+)/g,
        (urlMatch) => {
          try {
            let targetUrl;
            if (urlMatch.startsWith('http://') || urlMatch.startsWith('https://')) {
              targetUrl = new URL(urlMatch);
            } else if (urlMatch.startsWith('/')) {
              targetUrl = new URL(base + urlMatch);
            } else {
              return urlMatch;
            }
            if (isSameSite(targetUrl.hostname)) {
              const full = targetUrl.origin + targetUrl.pathname + targetUrl.search;
              return proxyOrigin + '/api/proxy?url=' + encodeURIComponent(full);
            }
          } catch {}
          return urlMatch;
        }
      );
      return 'srcset="' + rewritten + '"';
    }
  );

  // Rewrite action attributes (forms)
  html = html.replace(
    /action=["']((?:https?:\/\/)?[^"']*?)["']/gi,
    (match, val) => {
      try {
        let targetUrl;
        if (val.startsWith('http://') || val.startsWith('https://')) {
          targetUrl = new URL(val);
        } else if (val.startsWith('/')) {
          targetUrl = new URL(base + val);
        } else {
          return match;
        }
        if (isSameSite(targetUrl.hostname)) {
          const full = targetUrl.origin + targetUrl.pathname + targetUrl.search;
          return 'action="' + proxyOrigin + '/api/proxy?url=' + encodeURIComponent(full) + '"';
        }
      } catch {}
      return match;
    }
  );

  // Rewrite url() references in inline styles
  html = html.replace(
    /url\(["']?((?:https?:\/\/)?[^"')]+?)["']?\)/gi,
    (match, val) => {
      try {
        let targetUrl;
        if (val.startsWith('http://') || val.startsWith('https://')) {
          targetUrl = new URL(val);
        } else if (val.startsWith('/')) {
          targetUrl = new URL(base + val);
        } else {
          return match;
        }
        if (isSameSite(targetUrl.hostname)) {
          const full = targetUrl.origin + targetUrl.pathname + targetUrl.search;
          return 'url(' + proxyOrigin + '/api/proxy?url=' + encodeURIComponent(full) + ')';
        }
      } catch {}
      return match;
    }
  );

  return html;
}

function rewriteJs(js, base, isSameSite, proxyOrigin) {
  const proxyBase = proxyOrigin + '/api/proxy?url=';

  // Rewrite relative imports: from"./foo" from'./foo'
  js = js.replace(
    /\bfrom\s*["'](\.{1,2}\/[^"']+)["']/g,
    (match, relPath) => {
      const fullUrl = base + '/' + relPath;
      return match.replace(relPath, proxyBase + encodeURIComponent(fullUrl));
    }
  );

  // Rewrite dynamic imports: import("./foo")
  js = js.replace(
    /\bimport\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g,
    (match, relPath) => {
      const fullUrl = base + '/' + relPath;
      return match.replace(relPath, proxyBase + encodeURIComponent(fullUrl));
    }
  );

  // Rewrite absolute path imports: from"/foo"
  js = js.replace(
    /\bfrom\s*["'](\/[^"']+)["']/g,
    (match, absPath) => {
      const fullUrl = base + absPath;
      return match.replace(absPath, proxyBase + encodeURIComponent(fullUrl));
    }
  );

  // Rewrite dynamic imports with absolute paths: import("/foo")
  js = js.replace(
    /\bimport\s*\(\s*["'](\/[^"']+)["']\s*\)/g,
    (match, absPath) => {
      const fullUrl = base + absPath;
      return match.replace(absPath, proxyBase + encodeURIComponent(fullUrl));
    }
  );

  return js;
}

function injectCss(html, css) {
  if (html.includes('</head>')) {
    return html.replace('</head>', css + '</head>');
  }
  return css + html;
}
