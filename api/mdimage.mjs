// Vercel serverless function: /api/mdimage
// Proxies MangaDex uploads (covers + chapter pages) to avoid CORS/hotlink issues.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

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
    if (!host.endsWith('mangadex.org')) {
      return res.status(400).json({ error: 'Only MangaDex URLs allowed' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const upstream = await fetch(target, {
      headers: { 'User-Agent': UA },
    });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream ${upstream.status}` });
    }
    const type = upstream.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buf);
  } catch (err) {
    console.error('[mdimage proxy] failed:', target, err);
    return res.status(502).json({ error: 'Failed to fetch image' });
  }
}

export const config = {
  api: { responseLimit: false },
};
