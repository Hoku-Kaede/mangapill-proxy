// Vercel serverless function: /api/embed
// Proxies embed provider pages through our own domain so SmartScreen
// doesn't flag third-party iframes.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

export default async function handler(req, res) {
  const target = req.query.url;
  if (!target) {
    return res.status(400).json({ error: 'Missing url param' });
  }

  try {
    new URL(target);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': new URL(target).origin + '/',
      },
      redirect: 'follow',
    });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream ${upstream.status}` });
    }
    const html = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'text/html; charset=utf-8';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    return res.send(html);
  } catch (err) {
    console.error('[embed proxy] failed:', target, err);
    return res.status(502).json({ error: 'Failed to fetch embed' });
  }
}

export const config = {
  api: { responseLimit: false },
};
