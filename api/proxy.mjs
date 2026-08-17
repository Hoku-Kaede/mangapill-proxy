export const config = { runtime: 'edge' };

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

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

  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': base + '/',
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
      html = rewriteUrls(html, base);
      html = injectTheme(html);
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
    /((?:href|src|action)=["'])(\/[^"']*?)(["'])/g,
    (match, prefix, path, suffix) => {
      if (path.startsWith('//')) return match;
      if (path.startsWith('http://') || path.startsWith('https://')) return match;
      return prefix + base + path + suffix;
    }
  );
  html = html.replace(
    /((?:href|src|action)=)([^"'\s>]+)(?=[\s>])/g,
    (match, prefix, path) => {
      if (path.startsWith('//') || path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return match;
      if (path.startsWith('/')) return prefix + base + path;
      return match;
    }
  );
  return html;
}

const THEME_CSS = `
<style id="comic-theme-override">
  *, *::before, *::after {
    color-scheme: dark !important;
  }
  html, body, #root, #__next, .app, main, .site-content, .content-area, .page-content, .main-content, .container, .wrapper, #content, #main {
    background-color: #0a0a0a !important;
    color: #e0e0e0 !important;
  }
  body {
    background: #0a0a0a !important;
  }
  a, a *, .entry-title a, h2 a, h3 a, h4 a, .chapter-link, .listupd a, .bsx a, .bs a, .bigtitle a, .post-title a, .series-title a {
    color: #ef4444 !important;
  }
  a:hover, a:hover * {
    color: #f87171 !important;
  }
  h1, h2, h3, h4, h5, h6, .entry-title, .post-title, .series-title, .bigtitle, .section-title, .page-title, .tit {
    color: #f5f5f5 !important;
  }
  p, span, li, td, th, label, input, select, textarea, div, .chapter-date, .chapternum, .eph-num, .listing-chapters_wrap {
    color: #c0c0c0 !important;
  }
  nav, header, footer, .navbar, .header, .footer, .sidebar, aside, .site-header, .site-footer, .top-header, .bottom-nav {
    background-color: #111111 !important;
    color: #e0e0e0 !important;
    border-color: #222 !important;
  }
  .btn, button, .button, input[type="submit"], input[type="button"], .wp-block-button__link {
    background-color: #dc2626 !important;
    color: #ffffff !important;
    border-color: #991b1b !important;
  }
  .btn:hover, button:hover, .button:hover, input[type="submit"]:hover {
    background-color: #ef4444 !important;
  }
  table, tr, td, th {
    background-color: #141414 !important;
    color: #d0d0d0 !important;
    border-color: #222 !important;
  }
  .widget, .sidebar, aside, .widget-area {
    background-color: #111111 !important;
    color: #d0d0d0 !important;
    border-color: #222 !important;
  }
  input, select, textarea, .search-form input, .search {
    background-color: #1a1a1a !important;
    color: #e0e0e0 !important;
    border-color: #333 !important;
  }
  ::-webkit-scrollbar {
    background: #111 !important;
    width: 8px !important;
  }
  ::-webkit-scrollbar-thumb {
    background: #dc2626 !important;
    border-radius: 4px !important;
  }
  img {
    opacity: 0.92;
  }
  .dark, [data-theme="light"], [class*="light"] {
    background-color: #0a0a0a !important;
    color: #e0e0e0 !important;
  }
  .container, .wrap, .bixbox, .listupd, .bigcontent, .section-story, .chapter-location {
    background-color: #0a0a0a !important;
  }
  .manga, .chapter, .page-item-detail, .bsx, .bs, .bigor, .detpost, .postbody {
    background-color: #111111 !important;
    border-color: #222 !important;
  }
  .releases, .chapterlist, .chapter-list, .listing-chapters, .eph-num {
    background-color: #111111 !important;
    color: #c0c0c0 !important;
  }
  .imptdt, .tsinfo, .infotable, .seriestucon, .seriestuhead {
    background-color: #111111 !important;
  }
  .rating, .num, .ratingx, .numscore {
    background-color: #1a1a1a !important;
    color: #ef4444 !important;
  }
  .genre-item, .genre, .mgen, .wd-full, .spe, span.item {
    background-color: #1a1a1a !important;
    color: #c0c0c0 !important;
  }
  a.genre-item:hover, a.genre:hover {
    background-color: #dc2626 !important;
    color: #ffffff !important;
  }
  .soratest, .series-genre, .manga-genre {
    background-color: #1a1a1a !important;
  }
  .nextprev, .nav-links, .pagination, .page-numbers {
    background-color: #111111 !important;
    color: #c0c0c0 !important;
  }
  a.page-numbers, .page-numbers a, .page-numbers.current {
    background-color: #1a1a1a !important;
    color: #ef4444 !important;
    border-color: #333 !important;
  }
  .page-numbers.current, span.page-numbers.current {
    background-color: #dc2626 !important;
    color: #ffffff !important;
  }
  *::selection {
    background: #dc2626 !important;
    color: #ffffff !important;
  }
  ::-moz-selection {
    background: #dc2626 !important;
    color: #ffffff !important;
  }
</style>`;

function injectTheme(html) {
  if (html.includes('</head>')) {
    return html.replace('</head>', THEME_CSS + '</head>');
  }
  return THEME_CSS + html;
}
