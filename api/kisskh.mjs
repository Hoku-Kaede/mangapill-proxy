// Vercel serverless function: /api/kisskh
// Proxies kisskh.is API calls with CORS headers.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';
const BASE = 'https://kisskh.is/api';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const action = req.query.action || '';
  const id = req.query.id || '';
  const q = req.query.q || '';
  const page = req.query.page || '1';
  const pageSize = req.query.pageSize || '20';
  const type = req.query.type || '0';
  const sub = req.query.sub || '0';
  const country = req.query.country || '0';
  const status = req.query.status || '0';

  try {
    let url = '';
    let cacheMaxAge = 300;

    if (action === 'list') {
      url = `${BASE}/DramaList/List?page=${page}&type=${type}&sub=${sub}&country=${country}&status=${status}&pageSize=${pageSize}`;
      cacheMaxAge = 600;
    } else if (action === 'search') {
      url = `${BASE}/DramaList/Search?q=${encodeURIComponent(q)}&type=${type}`;
      cacheMaxAge = 300;
    } else if (action === 'drama') {
      url = `${BASE}/DramaList/Drama/${id}`;
      cacheMaxAge = 600;
    } else if (action === 'episode') {
      // Try to fetch episode video source (may need kkey from client)
      const ts = req.query.ts || '';
      const time = req.query.time || '';
      const kkey = req.query.kkey || '';
      const err = req.query.err || '';
      url = `${BASE}/DramaList/Episode/${id}.png?err=${err}&ts=${ts}&time=${time}&kkey=${kkey}`;
      cacheMaxAge = 0;
    } else if (action === 'show') {
      url = `${BASE}/DramaList/Show`;
      cacheMaxAge = 600;
    } else if (action === 'lastupdate') {
      url = `${BASE}/DramaList/LastUpdate?ispc=true`;
      cacheMaxAge = 300;
    } else if (action === 'toprating') {
      url = `${BASE}/DramaList/TopRating?ispc=true`;
      cacheMaxAge = 600;
    } else if (action === 'mostview') {
      url = `${BASE}/DramaList/MostView?ispc=true&c=${page}`;
      cacheMaxAge = 600;
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const upstream = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json',
      'Referer': 'https://kisskh.is/',
      'Origin': 'https://kisskh.is',
      },
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error('[kisskh proxy] upstream error:', upstream.status, errText.substring(0, 200));
      return res.status(upstream.status).json({ error: `Upstream ${upstream.status}` });
    }

    const json = await upstream.json();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', `public, max-age=${cacheMaxAge}`);
    return res.send(json);
  } catch (err) {
    console.error('[kisskh proxy] failed:', err);
    return res.status(502).json({ error: 'Failed to fetch from KissKH' });
  }
}

export const config = {
  api: { responseLimit: false },
};
