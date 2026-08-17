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
const PROBE_TIMEOUT_MS = 8000;

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
  const q = encodeURIComponent(query.trim());
  const json = await cinemeta(`/catalog/movie/top/search=${q}.json`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list: MovieItem[] = (json?.metas || [])
    .map(mapMeta)
    .filter((m: MovieItem) => m.id);
  return list.slice(0, limit);
}

export async function getMovieDetails(id: string): Promise<MovieItem> {
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
