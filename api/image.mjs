// Vercel serverless function: /api/image
// Proxies images from MangaPill CDN (requires Referer: mangapill.com).

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

const IMAGE_HOSTS = ['readdetectiveconan.com', 'mangapill.com'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const target = req.query.url;
  if (!target) {
    return res.status(400).json({ error: 'Missing url param' });
  }

  try {
    const host = new URL(target).hostname;
    if (!IMAGE_HOSTS.some((h) => host === h || host.endsWith('.' + h))) {
      return res.status(400).json({ error: 'Invalid or disallowed image URL' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const upstream = await fetch(target, {
      headers: { 'User-Agent': UA, Referer: 'https://mangapill.com/' },
    });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` });
    }
    const type = upstream.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buf);
  } catch (err) {
    console.error('[image proxy] failed:', target, err);
    return res.status(502).json({ error: 'Failed to fetch image' });
  }
}

export const config = {
  api: { responseLimit: false },
};
