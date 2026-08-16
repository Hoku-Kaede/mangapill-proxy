// Image relay for the MangaPill CDN (cdn.readdetectiveconan.com), which only
// serves images to requests carrying a `Referer: https://mangapill.com/` header.
// Browsers cannot forge that header, so this tiny server fetches the image
// server-side and streams it back with permissive CORS headers.
//
// Deploy this for free (Render / Glitch / Railway), then point
// src/services/consumet.ts -> MANGAPILL_IMAGE_PROXY at the deployed URL:
//
//   https://<your-proxy>/image?url=<urlencoded-cdn-image-url>

import express from 'express';

const app = express();
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

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/image', async (req, res) => {
  const { url } = req.query;
  if (typeof url !== 'string' || !isAllowed(url)) {
    return res.status(400).json({ error: 'Invalid or disallowed image URL' });
  }
  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        Referer: 'https://mangapill.com/',
      },
    });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` });
    }
    const type = upstream.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.set('Content-Type', type);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (err) {
    console.error('[image proxy] failed:', url, err);
    res.status(502).json({ error: 'Failed to fetch image' });
  }
});

app.get('/health', (_req, res) => res.send('ok'));

app.listen(PORT, () => console.log(`[image proxy] listening on ${PORT}`));
