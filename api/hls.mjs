// Vercel serverless function: /api/hls
// Proxies HLS m3u8 playlists and segments for anime CDNs.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const target = req.query.url;
  const referer = req.query.ref || '';
  if (!target) {
    return res.status(400).json({ error: 'Missing url param' });
  }

  try {
    const host = new URL(target).hostname;
    if (!hostMatches(host, HLS_HOSTS)) {
      return res.status(400).json({ error: `Host not allowed: ${host}` });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const headers = { 'User-Agent': UA };
    if (referer) headers.Referer = referer;
    const upstream = await fetch(target, { headers });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream ${upstream.status}` });
    }
    const contentType = upstream.headers.get('content-type') || '';
    const isM3U8 =
      contentType.includes('mpegurl') ||
      contentType.includes('m3u8') ||
      /\.m3u8($|\?)/i.test(target);

    if (!isM3U8) {
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', contentType || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=4');
      return res.send(buf);
    }

    const text = await upstream.text();
    const base = new URL(target);
    const proxyBase = `/api/hls?ref=${encodeURIComponent(referer)}&url=`;
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
        try {
          const segHost = new URL(abs).hostname;
          if (hostMatches(segHost, HLS_HOSTS)) {
            return proxyBase + encodeURIComponent(abs);
          }
        } catch { /* ignore */ }
        return line;
      }
    );
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    return res.send(rewritten);
  } catch (err) {
    console.error('[hls proxy] failed:', target, err);
    return res.status(502).json({ error: 'Failed to fetch HLS' });
  }
}

export const config = {
  api: { responseLimit: false },
};
