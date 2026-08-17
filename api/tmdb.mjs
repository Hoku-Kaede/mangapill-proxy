// Vercel serverless function: /api/tmdb
// Proxies TMDB API calls for movie search + collection browsing.

const TMDB_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJkYjQwMTQ5MmJiMzdhNjI2MzYzNjVjNGM5MjM4MDk2NyIsIm5iZiI6MTcyMDcwMzgwNy40OTksInN1YiI6IjY2OTMwNmI5MDVmMTFkNjI0MDc2NjRhYiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.GpOKn0P3r1NfKqfEHf5U3sP5vV6H5c7gG5vQ6sJ7eX4';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const action = req.query.action;
  const q = req.query.q || '';
  const id = req.query.id || '';
  const page = req.query.page || '1';
  const sort = req.query.sort || 'release_date.asc';
  const genres = req.query.with_genres || '';

  try {
    let url = '';
    let cacheMaxAge = 600;

    if (action === 'search') {
      url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(q)}&page=${page}&include_adult=false`;
      cacheMaxAge = 300;
    } else if (action === 'multi') {
      url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(q)}&page=${page}&include_adult=false`;
      cacheMaxAge = 300;
    } else if (action === 'discover') {
      // Discover movies — supports with_keywords, with_genres, sort_by
      const parts = [`page=${page}`, 'include_adult=false'];
      if (genres) parts.push(`with_genres=${genres}`);
      else if (q) parts.push(`with_keywords=${encodeURIComponent(q)}`);
      parts.push(`sort_by=${sort || 'popularity.desc'}`);
      url = `https://api.themoviedb.org/3/discover/movie?${parts.join('&')}`;
      cacheMaxAge = 600;
    } else if (action === 'collection') {
      // Get all movies in a collection by collection ID
      url = `https://api.themoviedb.org/3/collection/${id}?language=en-US`;
      cacheMaxAge = 3600;
    } else if (action === 'movie') {
      // Get movie details + external IDs (IMDb) by TMDB movie ID
      url = `https://api.themoviedb.org/3/movie/${id}?append_to_response=external_ids&language=en-US`;
      cacheMaxAge = 3600;
    } else if (action === 'trending') {
      url = `https://api.themoviedb.org/3/trending/movie/week?page=${page}`;
      cacheMaxAge = 3600;
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const upstream = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TMDB_KEY}`,
        'Accept': 'application/json',
        'User-Agent': UA,
      },
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error('[tmdb proxy] upstream error:', upstream.status, err);
      return res.status(upstream.status).json({ error: `TMDB ${upstream.status}` });
    }

    const json = await upstream.json();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', `public, max-age=${cacheMaxAge}`);
    return res.send(json);
  } catch (err) {
    console.error('[tmdb proxy] failed:', err);
    return res.status(502).json({ error: 'Failed to fetch TMDB' });
  }
}

export const config = {
  api: { responseLimit: false },
};
