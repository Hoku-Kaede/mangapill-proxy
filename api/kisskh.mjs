// Vercel Edge Function: /api/kisskh
// Uses edge runtime to potentially bypass Cloudflare IP blocks.

export const config = { runtime: 'edge' };

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const BASE = 'https://kisskh.is/api';

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || '';
  const id = url.searchParams.get('id') || '';
  const q = url.searchParams.get('q') || '';
  const page = url.searchParams.get('page') || '1';
  const pageSize = url.searchParams.get('pageSize') || '20';
  const type = url.searchParams.get('type') || '0';
  const sub = url.searchParams.get('sub') || '0';
  const country = url.searchParams.get('country') || '0';
  const status = url.searchParams.get('status') || '0';

  let target = '';
  let cacheMaxAge = 300;

  if (action === 'list') {
    target = `${BASE}/DramaList/List?page=${page}&type=${type}&sub=${sub}&country=${country}&status=${status}&pageSize=${pageSize}`;
    cacheMaxAge = 600;
  } else if (action === 'search') {
    target = `${BASE}/DramaList/Search?q=${encodeURIComponent(q)}&type=${type}`;
    cacheMaxAge = 300;
  } else if (action === 'drama') {
    target = `${BASE}/DramaList/Drama/${id}`;
    cacheMaxAge = 600;
  } else if (action === 'episode') {
    const ts = url.searchParams.get('ts') || '';
    const time = url.searchParams.get('time') || '';
    const kkey = url.searchParams.get('kkey') || '';
    const err = url.searchParams.get('err') || '';
    target = `${BASE}/DramaList/Episode/${id}.png?err=${err}&ts=${ts}&time=${time}&kkey=${kkey}`;
    cacheMaxAge = 0;
  } else if (action === 'show') {
    target = `${BASE}/DramaList/Show`;
    cacheMaxAge = 600;
  } else if (action === 'lastupdate') {
    target = `${BASE}/DramaList/LastUpdate?ispc=true`;
    cacheMaxAge = 300;
  } else if (action === 'toprating') {
    target = `${BASE}/DramaList/TopRating?ispc=true`;
    cacheMaxAge = 600;
  } else if (action === 'mostview') {
    target = `${BASE}/DramaList/MostView?ispc=true&c=${page}`;
    cacheMaxAge = 600;
  } else {
    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': UA,
        'Accept': '*/*',
      },
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return new Response(JSON.stringify({ error: `Upstream ${upstream.status}`, detail: errText.substring(0, 200) }), {
        status: upstream.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const json = await upstream.json();
    return new Response(JSON.stringify(json), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${cacheMaxAge}`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch from KissKH', detail: String(err) }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
