// Vercel serverless function: /api/page
// Proxies HTML pages from miraculous.to for initialSources extraction.

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
    new URL(target);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
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
      return res.status(upstream.status).json({ error: `Upstream ${upstream.status}` });
    }
    const html = await upstream.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(html);
  } catch (err) {
    console.error('[page proxy] failed:', target, err);
    return res.status(502).json({ error: 'Failed to fetch page' });
  }
}

export const config = {
  api: { responseLimit: false },
};
