// Vercel serverless function: /api/mangadex
// Proxies MangaDex API calls to avoid CORS issues from the browser.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // The full MangaDex path is passed as the `path` query parameter
  const mdPath = req.query.path;
  if (!mdPath) {
    return res.status(400).json({ error: 'Missing path param' });
  }

  try {
    const upstream = await fetch(`https://api.mangadex.org${mdPath}`, {
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json',
      },
    });
    const contentType = upstream.headers.get('content-type') || 'application/json';
    const body = await upstream.arrayBuffer();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=15');
    return res.send(Buffer.from(body));
  } catch (err) {
    console.error('[mangadex proxy] failed:', mdPath, err);
    return res.status(502).json({ error: 'Failed to fetch MangaDex API' });
  }
}

export const config = {
  api: { responseLimit: false },
};
