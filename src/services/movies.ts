// Movie catalog via Stremio's Cinemeta (keyless JSON) plus embed-based streaming
// through public embed providers. Providers are community-run and may go offline
// at any time, so the player probes every server and auto-selects the fastest one.

export interface MovieItem {
  id: string; // IMDb id (tt...)
  tmdbId?: string;
  title: string;
  description: string;
  coverUrl: string;
  backgroundUrl?: string;
  year: string;
  rating: string;
  genres: string[];
  cast: string[];
  director: string[];
  runtime?: string;
  country?: string;
}

export interface MovieServer {
  id: string;
  name: string;
  url: string;
}

export interface ServerStatus extends MovieServer {
  ok: boolean;
  latencyMs: number | null;
  error?: string;
}

const CINEMETA = 'https://v3-cinemeta.strem.io';
const TMDB_PROXY = '/api/tmdb';
const PROBE_TIMEOUT_MS = 8000;

// Known franchise keyword mappings for TMDB discover (keyword_id → display name).
// When a search matches one of these, we fetch the full collection sorted by
// release date so the user sees the correct storyline order.
const FRANCHISE_KEYWORDS: Record<string, { keywordId: string; label: string; collectionId?: string }> = {
  'marvel': { keywordId: '180319', label: 'Marvel Cinematic Universe', collectionId: '115651' },
  'mcu': { keywordId: '180319', label: 'Marvel Cinematic Universe', collectionId: '115651' },
  'avengers': { keywordId: '180319', label: 'Marvel Cinematic Universe', collectionId: '115651' },
  'spider-man': { keywordId: '4195', label: 'Spider-Man' },
  'spiderman': { keywordId: '4195', label: 'Spider-Man' },
  'batman': { keywordId: '825', label: 'Batman' },
  'dc': { keywordId: '179430', label: 'DC Universe' },
  'star wars': { keywordId: '1', label: 'Star Wars', collectionId: '10' },
  'fast and furious': { keywordId: '42782', label: 'Fast & Furious' },
  'fast & furious': { keywordId: '42782', label: 'Fast & Furious' },
  'jurassic': { keywordId: '58771', label: 'Jurassic Park', collectionId: '342' },
  'harry potter': { keywordId: '851', label: 'Harry Potter', collectionId: '1241' },
  'lord of the rings': { keywordId: '12179', label: 'Lord of the Rings', collectionId: '119' },
  'hobbit': { keywordId: '12179', label: 'Lord of the Rings', collectionId: '119' },
  'pixar': { keywordId: '3955', label: 'Pixar' },
  'disney': { keywordId: '3955', label: 'Disney' },
  'transformers': { keywordId: '9076', label: 'Transformers' },
  'mission impossible': { keywordId: '6360', label: 'Mission: Impossible' },
  'x-men': { keywordId: '3936', label: 'X-Men' },
  'xmen': { keywordId: '3936', label: 'X-Men' },
  'iron man': { keywordId: '180319', label: 'Marvel Cinematic Universe', collectionId: '115651' },
  'thor': { keywordId: '180319', label: 'Marvel Cinematic Universe', collectionId: '115651' },
  'captain america': { keywordId: '180319', label: 'Marvel Cinematic Universe', collectionId: '115651' },
  'guardians': { keywordId: '180319', label: 'Marvel Cinematic Universe', collectionId: '115651' },
  'ant-man': { keywordId: '180319', label: 'Marvel Cinematic Universe', collectionId: '115651' },
  'black panther': { keywordId: '180319', label: 'Marvel Cinematic Universe', collectionId: '115651' },
  'doctor strange': { keywordId: '180319', label: 'Marvel Cinematic Universe', collectionId: '115651' },
  'superman': { keywordId: '179430', label: 'DC Universe' },
  'wonder woman': { keywordId: '179430', label: 'DC Universe' },
  'aquaman': { keywordId: '179430', label: 'DC Universe' },
  'the flash': { keywordId: '179430', label: 'DC Universe' },
  'dark knight': { keywordId: '825', label: 'Batman' },
  'matrix': { keywordId: '6624', label: 'The Matrix' },
  'indiana jones': { keywordId: '568', label: 'Indiana Jones' },
  'toy story': { keywordId: '3955', label: 'Pixar' },
  'shrek': { keywordId: '4064', label: 'Shrek' },
  'die hard': { keywordId: '10793', label: 'Die Hard' },
  'alien': { keywordId: '787', label: 'Alien' },
  'predator': { keywordId: '348', label: 'Predator' },
  'terminator': { keywordId: '559', label: 'Terminator' },
  'rocky': { keywordId: '228', label: 'Rocky' },
  'rambo': { keywordId: '228', label: 'Rocky' },
  'hunger games': { keywordId: '10290', label: 'Hunger Games' },
  'twilight': { keywordId: '2215', label: 'Twilight' },
  'dune': { keywordId: '2347', label: 'Dune' },
};

function detectFranchise(query: string): { keywordId: string; label: string; collectionId?: string } | null {
  const q = query.toLowerCase().trim();
  // Exact match first
  if (FRANCHISE_KEYWORDS[q]) return FRANCHISE_KEYWORDS[q];
  // Word-boundary match: query contains the key as a whole word
  for (const [key, val] of Object.entries(FRANCHISE_KEYWORDS)) {
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(q)) return val;
  }
  return null;
}

async function tmdbFetch(path: string): Promise<any> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
  return res.json();
}

// Fetch trending movies from TMDB (used for franchise + fallback)
export async function getTmdbTrending(limit: number = 24): Promise<MovieItem[]> {
  const json = await tmdbFetch(`${TMDB_PROXY}?action=trending&page=1`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (json?.results || []).map(tmdbMapMovie).filter((m: MovieItem) => m.title).slice(0, limit);
}

// TMDB genre ID mapping for the genre filter UI.
export const TMDB_GENRES: { id: number; name: string }[] = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Sci-Fi' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
];

// Fetch movies by TMDB genre (sorted by popularity).
export async function getMoviesByGenre(genreId: number, limit: number = 24): Promise<MovieItem[]> {
  const json = await tmdbFetch(
    `${TMDB_PROXY}?action=discover&page=1&with_genres=${genreId}&sort_by=popularity.desc`
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (json?.results || []).map(tmdbMapMovie).filter((m: MovieItem) => m.title).slice(0, limit);
}

function tmdbMapMovie(dto: any): MovieItem {
  const tmdbId = String(dto?.id || '');
  return {
    id: String(dto?.imdb_id || ''),
    tmdbId,
    title: String(dto?.title || 'Untitled'),
    description: String(dto?.overview || 'No description available.'),
    coverUrl: dto?.poster_path ? `https://image.tmdb.org/t/p/w500${dto.poster_path}` : '',
    backgroundUrl: dto?.backdrop_path ? `https://image.tmdb.org/t/p/w780${dto.backdrop_path}` : undefined,
    year: dto?.release_date ? dto.release_date.slice(0, 4) : '',
    rating: dto?.vote_average ? String(dto.vote_average) : '',
    genres: [],
    cast: [],
    director: [],
  };
}

// Upgrade small/low-res metahub artwork so the grid and detail view look sharp.
function upgradeArtwork(url: string, kind: 'poster' | 'background'): string {
  if (!url) return url;
  if (url.includes('/poster/small/')) return url.replace('/poster/small/', `/poster/${kind === 'poster' ? 'medium' : 'large'}/`);
  if (url.includes('/background/medium/')) return url.replace('/background/medium/', '/background/large/');
  return url;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapMeta(dto: any): MovieItem {
  const genres: string[] = dto?.genres || dto?.genre || [];
  const year = dto?.year || dto?.releaseInfo || '';
  return {
    id: String(dto?.imdb_id || dto?.id || ''),
    tmdbId: dto?.moviedb_id != null ? String(dto.moviedb_id) : undefined,
    title: String(dto?.name || 'Untitled Movie'),
    description: String(dto?.description || 'No description available.'),
    coverUrl: upgradeArtwork(String(dto?.poster || ''), 'poster'),
    backgroundUrl: upgradeArtwork(String(dto?.background || ''), 'background'),
    year,
    rating: String(dto?.imdbRating || ''),
    genres,
    cast: Array.isArray(dto?.cast) ? dto.cast.map(String) : [],
    director: Array.isArray(dto?.director) ? dto.director.map(String) : [],
    runtime: dto?.runtime ? String(dto.runtime) : undefined,
    country: dto?.country ? String(dto.country) : undefined,
  };
}

export async function cinemeta(path: string): Promise<any> {
  const res = await fetch(`${CINEMETA}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Cinemeta error: ${res.status}`);
  return res.json();
}

// Trending / popular movies shown when the section opens.
export async function getPopularMovies(limit: number = 24): Promise<MovieItem[]> {
  const json = await cinemeta('/catalog/movie/top.json');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list: MovieItem[] = (json?.metas || [])
    .map(mapMeta)
    .filter((m: MovieItem) => m.id);
  return list.slice(0, limit);
}

export async function searchMovies(query: string, limit: number = 24): Promise<MovieItem[]> {
  const franchise = detectFranchise(query);

  // If a known franchise is detected, try collection endpoint first, then multi-page search
  if (franchise) {
    try {
      // Strategy 1: If we have a collection ID, fetch the whole collection (best for MCU, Star Wars, etc.)
      if (franchise.collectionId) {
        const colJson = await tmdbFetch(`${TMDB_PROXY}?action=collection&id=${franchise.collectionId}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let colList: MovieItem[] = (colJson?.parts || [])
          .filter((m: any) => m.release_date && m.media_type !== 'tv')
          .map(tmdbMapMovie)
          .filter((m: MovieItem) => m.title);
        colList.sort((a, b) => (parseInt(a.year) || 9999) - (parseInt(b.year) || 9999));
        if (colList.length > 0) return colList;
      }

      // Strategy 2: Multi-page TMDB search — fetch up to 5 pages (100 results)
      const searchTerm = franchise.label.replace('Cinematic Universe', '').replace('Universe', '').trim();
      const allResults: any[] = [];
      for (let pg = 1; pg <= 5; pg++) {
        const json = await tmdbFetch(`${TMDB_PROXY}?action=search&q=${encodeURIComponent(searchTerm)}&page=${pg}`);
        const results = json?.results || [];
        allResults.push(...results);
        // Stop early if no more results
        if (results.length < 20) break;
      }

      let list: MovieItem[] = allResults
        .filter((m: any) => m.release_date && m.media_type !== 'tv')
        .map(tmdbMapMovie)
        .filter((m: MovieItem) => m.title);

      // Deduplicate by title + year
      const seen = new Set<string>();
      list = list.filter((m) => {
        const key = `${m.title}|${m.year}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Sort by release date (oldest first = chronological storyline order)
      list.sort((a, b) => (parseInt(a.year) || 9999) - (parseInt(b.year) || 9999));

      if (list.length > 0) return list;
    } catch {
      // Fall through to Cinemeta
    }
  }

  // Default: Cinemeta search
  const q = encodeURIComponent(query.trim());
  const json = await cinemeta(`/catalog/movie/top/search=${q}.json`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list: MovieItem[] = (json?.metas || [])
    .map(mapMeta)
    .filter((m: MovieItem) => m.id);
  return list.slice(0, limit);
}

export async function getMovieDetails(id: string, tmdbId?: string): Promise<MovieItem> {
  // If we have a tmdbId, try TMDB first to get full details + IMDb ID for embeds
  if (tmdbId) {
    try {
      const json = await tmdbFetch(`${TMDB_PROXY}?action=movie&id=${tmdbId}`);
      const m = json?.movie || json;
      const imdbId = m?.external_ids?.imdb_id || '';
      return {
        id: imdbId || String(m?.imdb_id || ''),
        tmdbId: String(m?.id || tmdbId),
        title: String(m?.title || 'Untitled'),
        description: String(m?.overview || 'No description available.'),
        coverUrl: m?.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '',
        backgroundUrl: m?.backdrop_path ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}` : undefined,
        year: m?.release_date ? m.release_date.slice(0, 4) : '',
        rating: m?.vote_average ? String(m.vote_average) : '',
        genres: (m?.genres || []).map((g: any) => String(g.name || '')),
        cast: [],
        director: (m?.credits?.crew || []).filter((c: any) => c.job === 'Director').map((c: any) => c.name),
        runtime: m?.runtime ? String(m.runtime) : undefined,
        country: m?.production_countries?.[0]?.name ? String(m.production_countries[0].name) : undefined,
      };
    } catch {
      // Fall through to Cinemeta
    }
  }

  // Default: Cinemeta
  const json = await cinemeta(`/meta/movie/${encodeURIComponent(id)}.json`);
  const meta = json?.meta;
  if (!meta) throw new Error('Movie details not found');
  return mapMeta(meta);
}

// Embed providers that accept a movie id. SuperEmbed (multiembed.mov) is the
// primary source and is listed first so it wins the auto-best pick; the VIP
// player offers multi-quality HLS with built-in subtitles. VidSrc is more
// reliable with a TMDB id, the rest accept IMDb ids directly.
export function buildMovieServers(movie: MovieItem): MovieServer[] {
  const imdb = movie.id;
  const tmdb = movie.tmdbId;
  // multiembed.mov expects `?video_id={tmdb}&tmdb=1` for TMDB ids or a bare
  // `?video_id={imdb}` for IMDb ids.
  const embedId = `${encodeURIComponent(tmdb || imdb)}${tmdb ? '&tmdb=1' : ''}`;
  const tmdbId = tmdb || imdb;
  return [
    { id: 'vidsrc-hair', name: 'VidSrc Hair', url: `https://vidsrc.hair/embed/movie/${tmdb || imdb}` },
    { id: 'vidsrc-sbs', name: 'VidSrc SBS', url: `https://vidsrc.sbs/embed/movie/${tmdb || imdb}` },
    { id: 'vidcore', name: 'VidCore', url: `https://vidcore.org/embed/movie/${tmdb || imdb}` },
    { id: 'pro-multi', name: 'Pro Multi', url: `https://web.nxsha.app/embed/movie/${encodeURIComponent(tmdbId)}?server=AwsPly-[Multi-Lang]` },
    { id: 'cinesrc', name: 'CineSrc', url: `https://cinesrc.st/embed/movie/${encodeURIComponent(tmdbId)}` },
    { id: '4k', name: '4K', url: `https://player.videasy.net/movie/${encodeURIComponent(tmdbId)}` },
    { id: 'superembed-vip', name: 'SuperEmbed VIP', url: `https://multiembed.mov/directstream.php?video_id=${embedId}` },
    { id: 'superembed', name: 'SuperEmbed', url: `https://multiembed.mov/?video_id=${embedId}` },
    { id: 'vidsrc', name: 'VidSrc', url: `https://vidsrc.to/embed/movie/${tmdb || imdb}` },
    { id: '2embed', name: '2Embed', url: `https://2embed.stream/embed/movie/${imdb}` },
    { id: 'vidsrcto', name: 'Vid-src', url: `https://vid-src.top/embed/movie/${imdb}` },
  ];
}

async function fetchWithTimeout(url: string, ms: number): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    // mode: 'no-cors' skips the CORS handshake, which these embed providers don't
    // implement. A resolved (opaque) response means the server answered at all;
    // a rejection means it is unreachable. Latency is measured by callers.
    await fetch(url, { mode: 'no-cors', signal: ctrl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Live health + latency check of every embed server. Reachability is what
// matters here — opaque responses hide the HTTP status, but a server that
// answers at all is one we can render in the player iframe.
export async function testMovieServers(servers: MovieServer[]): Promise<ServerStatus[]> {
  return Promise.all(
    servers.map(async (s) => {
      const start = Date.now();
      const ok = await fetchWithTimeout(s.url, PROBE_TIMEOUT_MS);
      return {
        ...s,
        ok,
        latencyMs: ok ? Date.now() - start : null,
        error: ok ? undefined : 'unreachable',
      };
    })
  );
}

let lastServerId: string | null = null;

// Server that auto-selected as the best for the most recent movie.
export function getActiveMovieServerId(): string | null {
  return lastServerId;
}

// Race health checks and mark the fastest healthy server as the session default.
export async function pickBestMovieServer(servers: MovieServer[]): Promise<ServerStatus[]> {
  const statuses = await testMovieServers(servers);
  const healthy = statuses
    .filter((s) => s.ok)
    .sort((a, b) => (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity));
  lastServerId = healthy.length > 0 ? healthy[0].id : null;
  return statuses;
}
