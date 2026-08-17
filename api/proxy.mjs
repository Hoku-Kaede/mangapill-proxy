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
      html = injectBase(html, base);
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

function injectBase(html, base) {
  const baseTag = `<base href="${base}">`;
  if (html.includes('<head')) {
    return html.replace(/<head[^>]*>/i, (match) => match + baseTag);
  }
  return baseTag + html;
}

const THEME_CSS = `
<style id="comic-theme-override">
  :root {
    color-scheme: dark !important;
  }

  html, body {
    background: #0a0a0a !important;
    color: #e0e0e0 !important;
  }

  body * {
    background-color: inherit !important;
    color: inherit !important;
    border-color: #222 !important;
  }

  html, body, div, section, article, aside, main, footer, header, nav,
  #root, #__next, .app, .site-content, .content-area, .page-content,
  .main-content, .wrapper, #content, #main, .wrap, .container,
  .bixbox, .listupd, .bigcontent, .section-story,
  .manga, .chapter, .page-item-detail, .bsx, .bs, .bigor, .detpost,
  .postbody, .releases, .chapterlist, .chapter-list, .listing-chapters,
  .imptdt, .tsinfo, .infotable, .seriestucon, .seriestuhead,
  .widget, .sidebar, aside, .widget-area,
  .soratest, .series-genre, .manga-genre,
  .nextprev, .nav-links, .pagination,
  [class*="bg-"], [class*="background"], [class*="card"], [class*="panel"],
  [class*="modal"], [class*="dropdown"], [class*="menu"], [class*="list"],
  [class*="grid"], [class*="item"], [class*="post"], [class*="entry"],
  [class*="page"], [class*="section"], [class*="row"], [class*="col"],
  [class*="header"], [class*="footer"], [class*="nav"], [class*="bar"],
  [class*="banner"], [class*="top-"], [class*="bottom-"],
  [class*="sidebar"], [class*="aside"], [class*="content"],
  [class*="site-"], [class*="page-"], [class*="main-"],
  [class*="body"], [class*="text-"], [class*="font-"],
  table, thead, tbody, tfoot, tr, td, th {
    background-color: #0a0a0a !important;
    color: #e0e0e0 !important;
    border-color: #222 !important;
  }

  *, *::before, *::after {
    color: #e0e0e0 !important;
    border-color: #222 !important;
  }

  a, a *, a span, a div, a p, a h1, a h2, a h3, a h4, a h5, a h6,
  a li, a td, a strong, a em, a b, a i, a small {
    color: #ef4444 !important;
  }
  a:hover, a:hover *, a:hover span, a:hover div, a:hover p,
  a:hover h1, a:hover h2, a:hover h3, a:hover h4 {
    color: #f87171 !important;
  }

  h1, h2, h3, h4, h5, h6, strong, b, .title, .name, .heading {
    color: #f5f5f5 !important;
  }

  p, span, li, td, th, label, small, em, i, blockquote, code, pre,
  .chapter-date, .chapternum, .eph-num, .listing-chapters_wrap,
  [class*="text-"], [class*="font-"] {
    color: #c0c0c0 !important;
  }

  nav, header, footer, .navbar, .header, .footer, .sidebar, aside,
  .site-header, .site-footer, .top-header, .bottom-nav,
  [class*="navbar"], [class*="header"], [class*="footer"],
  [class*="nav-"], [class*="top-"], [class*="bottom-"],
  [class*="sidebar"], [class*="banner"], [class*="bar"] {
    background-color: #111111 !important;
    color: #e0e0e0 !important;
    border-color: #222 !important;
  }

  .btn, button, .button, input[type="submit"], input[type="button"],
  [class*="btn"], [class*="button"], [role="button"] {
    background-color: #dc2626 !important;
    color: #ffffff !important;
    border-color: #991b1b !important;
  }
  .btn:hover, button:hover, .button:hover, input[type="submit"]:hover,
  [class*="btn"]:hover, [class*="button"]:hover, [role="button"]:hover {
    background-color: #ef4444 !important;
  }

  .rating, .num, .ratingx, .numscore, .score, [class*="rating"],
  [class*="score"], [class*="star"] {
    color: #ef4444 !important;
  }

  .genre-item, .genre, .mgen, .wd-full, .spe, span.item,
  [class*="genre"], [class*="tag"], [class*="badge"],
  [class*="chip"], [class*="pill"], [class*="label"] {
    background-color: #1a1a1a !important;
    color: #c0c0c0 !important;
    border-color: #333 !important;
  }
  a.genre-item:hover, a.genre:hover, [class*="genre"]:hover,
  [class*="tag"]:hover, [class*="badge"]:hover {
    background-color: #dc2626 !important;
    color: #ffffff !important;
  }

  a.page-numbers, .page-numbers a, .page-numbers.current,
  [class*="pagination"] a, [class*="page-"] a, [class*="page-"] span {
    background-color: #1a1a1a !important;
    color: #ef4444 !important;
    border-color: #333 !important;
  }
  .page-numbers.current, span.page-numbers.current,
  [class*="pagination"] [class*="active"], [class*="page-"][class*="active"] {
    background-color: #dc2626 !important;
    color: #ffffff !important;
  }

  input, select, textarea, .search-form input, .search {
    background-color: #1a1a1a !important;
    color: #e0e0e0 !important;
    border-color: #333 !important;
  }

  img { opacity: 0.95; }

  ::-webkit-scrollbar { background: #111 !important; width: 8px !important; }
  ::-webkit-scrollbar-thumb { background: #dc2626 !important; border-radius: 4px !important; }
  ::-webkit-scrollbar-track { background: #1a1a1a !important; }

  *::selection { background: #dc2626 !important; color: #ffffff !important; }
  ::-moz-selection { background: #dc2626 !important; color: #ffffff !important; }

  *, *::before, *::after {
    color-scheme: dark !important;
  }

  /* Override yellow/amber/gold/orange — force to red */
  [style*="color: yellow" i], [style*="color: gold" i],
  [style*="color: #ff" i], [style*="color: orange" i],
  [style*="color: amber" i], [style*="background: yellow" i],
  [style*="background: gold" i], [style*="background: orange" i],
  [style*="background: amber" i], [style*="background-color: yellow" i],
  [style*="background-color: gold" i], [style*="background-color: orange" i],
  [style*="background-color: amber" i],
  [style*="color:#ff" i], [style*="color: #f59" i],
  [style*="background:#ff" i], [style*="background: #ff" i],
  [class*="yellow"], [class*="gold"], [class*="amber"],
  [class*="orange"], [class*="warning"], [class*="warn"],
  [class*="alert-"], [class*="notice"], [class*="info-box"],
  [class*="highlight"], [class*="accent"], [class*="brand"],
  [class*="primary"], [class*="theme-"], [class*="colored"] {
    color: #ef4444 !important;
    background-color: #1a1a1a !important;
    border-color: #333 !important;
  }

  [class*="yellow"] > *, [class*="gold"] > *, [class*="amber"] > *,
  [class*="orange"] > *, [class*="warning"] > *, [class*="warn"] > *,
  [class*="alert-"] > *, [class*="notice"] > *, [class*="info-box"] > *,
  [class*="highlight"] > *, [class*="accent"] > *, [class*="brand"] > *,
  [class*="primary"] > *, [class*="theme-"] > *, [class*="colored"] > * {
    color: #e0e0e0 !important;
    background-color: transparent !important;
  }

  a[class*="yellow"], a[class*="gold"], a[class*="amber"],
  a[class*="orange"], a[class*="warning"], a[class*="accent"],
  a[class*="primary"], a[class*="brand"] {
    color: #ef4444 !important;
  }

  /* Force all background colors to dark variants */
  [style*="background-color:" i] {
    background-color: #0a0a0a !important;
  }
  [style*="background:" i]:not([style*="background: url" i]):not([style*="background-image" i]) {
    background: #0a0a0a !important;
  }
</style>`;

function injectTheme(html) {
  if (html.includes('</head>')) {
    return html.replace('</head>', THEME_CSS + '</head>');
  }
  return THEME_CSS + html;
}
