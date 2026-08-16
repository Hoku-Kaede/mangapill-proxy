// Image relay for the MangaPill CDN (cdn.readdetectiveconan.com), which only
// serves images to requests carrying a `Referer: https://mangapill.com/` header.
// Browsers cannot forge that header, so this tiny server fetches the image
// server-side and streams it back with permissive CORS headers.
//
// Uses only Node built-ins (node:http + global fetch), so it runs anywhere
// with Node >= 18 and no npm install step.
//
//   https://<your-proxy>/image?url=<urlencoded-cdn-image-url>

import http from 'node:http';

const PORT = process.env.PORT || 3000;

// Only relay known MangaPill CDN hosts so this cannot be abused as an open proxy.
const ALLOWED_HOSTS = ['readdetectiveconan.com', 'mangapill.com'];

function isAllowed(url) {
  try {
    const host = new URL(url).hostname;
    return ALLOWED_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

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
  if (url.pathname !== '/image') {
    res.writeHead(404);
    return res.end('Not found');
  }

  const target = url.searchParams.get('url');
  if (!target || !isAllowed(target)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Invalid or disallowed image URL' }));
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        Referer: 'https://mangapill.com/',
      },
    });
    if (!upstream.ok) {
      res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `Upstream returned ${upstream.status}` }));
    }
    const type = upstream.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' });
    res.end(buf);
  } catch (err) {
    console.error('[image proxy] failed:', target, err);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to fetch image' }));
  }
});

server.listen(PORT, () => console.log(`[image proxy] listening on ${PORT}`));
