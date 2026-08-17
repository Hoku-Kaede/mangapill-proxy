// Multi-purpose relay server.
//
// 1. Image relay for MangaPill CDN (requires Referer: mangapill.com).
// 2. HLS relay for anime CDNs that require a specific Referer header.
//    Rewrites .m3u8 playlists so child URLs (variants + segments) are also
//    proxied, keeping the referer chain intact for the full playback session.
//
// Uses only Node built-ins (node:http + global fetch), so it runs anywhere
// with Node >= 18 and no npm install step.

import http from 'node:http';

const PORT = process.env.PORT || 3001;

// MangaPill image hosts
const IMAGE_HOSTS = ['readdetectiveconan.com', 'mangapill.com'];

// HLS anime CDN hosts allowed for the /hls relay
const HLS_HOSTS = [
  'cdn.watching.onl',
  'urcr2.cloudvideo.lat',
  'cdn1.bunny.net',
  'cdn2.bunny.net',
  'cdn.bunny.sh',
  'cdn.prod-streams.com',
  'megaplay.buzz',
  'cdn.anizara.store',
];

function hostMatches(hostname, list) {
  return list.some((h) => hostname === h || hostname.endsWith('.' + h));
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/health') {
    res.writeHead(200);
    return res.end('ok');
  }

  // ── Image relay ────────────────────────────────────────────────────────
  if (url.pathname === '/image') {
    const target = url.searchParams.get('url');
    if (!target) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing url param' }));
    }
    try {
      const host = new URL(target).hostname;
      if (!hostMatches(host, IMAGE_HOSTS)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid or disallowed image URL' }));
      }
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid URL' }));
    }
    try {
      const upstream = await fetch(target, {
        headers: { 'User-Agent': UA, Referer: 'https://mangapill.com/' },
      });
      if (!upstream.ok) {
        res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: `Upstream returned ${upstream.status}` }));
      }
      const type = upstream.headers.get('content-type') || 'image/jpeg';
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' });
      return res.end(buf);
    } catch (err) {
      console.error('[image proxy] failed:', target, err);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Failed to fetch image' }));
    }
  }

  // ── HLS relay ──────────────────────────────────────────────────────────
  if (url.pathname === '/hls') {
    const target = url.searchParams.get('url');
    const referer = url.searchParams.get('ref') || '';
    if (!target) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing url param' }));
    }
    try {
      const host = new URL(target).hostname;
      if (!hostMatches(host, HLS_HOSTS)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: `Host not allowed: ${host}` }));
      }
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid URL' }));
    }

    try {
      const headers = { 'User-Agent': UA };
      if (referer) headers.Referer = referer;
      const upstream = await fetch(target, { headers });
      if (!upstream.ok) {
        res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: `Upstream ${upstream.status}` }));
      }
      const contentType = upstream.headers.get('content-type') || '';
      const isM3U8 =
        contentType.includes('mpegurl') ||
        contentType.includes('m3u8') ||
        /\.m3u8($|\?)/i.test(target);

      if (!isM3U8) {
        const buf = Buffer.from(await upstream.arrayBuffer());
        res.writeHead(200, {
          'Content-Type': contentType || 'application/octet-stream',
          'Cache-Control': 'public, max-age=4',
        });
        return res.end(buf);
      }

      // Rewrite .m3u8: prefix every relative/absolute segment URL with our proxy.
      const text = await upstream.text();
      const base = new URL(target);
      const proxyBase = `/hls?ref=${encodeURIComponent(referer)}&url=`;
      const rewritten = text.replace(
        /^(?!#)(.+)$/gm,
        (line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;
          let abs;
          try {
            abs = new URL(trimmed, base).toString();
          } catch {
            abs = trimmed;
          }
          // Only proxy allowed hosts; pass through others unchanged.
          try {
            const segHost = new URL(abs).hostname;
            if (hostMatches(segHost, HLS_HOSTS)) {
              return proxyBase + encodeURIComponent(abs);
            }
          } catch { /* ignore */ }
          return line;
        }
      );
      res.writeHead(200, {
        'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      return res.end(rewritten);
    } catch (err) {
      console.error('[hls proxy] failed:', target, err);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Failed to fetch HLS' }));
    }
  }

  // ── HTML page relay ───────────────────────────────────────────────────
  if (url.pathname === '/page') {
    const target = url.searchParams.get('url');
    if (!target) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing url param' }));
    }
    try {
      new URL(target);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid URL' }));
    }
    try {
      const upstream = await fetch(target, {
        headers: {
          'User-Agent': UA,
          Referer: 'https://miraculous.to/',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      if (!upstream.ok) {
        res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: `Upstream ${upstream.status}` }));
      }
      const html = await upstream.text();
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      });
      return res.end(html);
    } catch (err) {
      console.error('[page proxy] failed:', target, err);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Failed to fetch page' }));
    }
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => console.log(`[proxy] listening on ${PORT}`));
