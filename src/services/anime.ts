// Anime catalog via AniList GraphQL, plus best-effort episode streaming through
// public aniwatch-api (hianime) hosts. Streaming hosts are community-run and may
// be offline at any time; callers should fall back to browser playback.

export interface AnimeItem {
  id: number;
  title: string;
  altTitle?: string;
  description: string;
  coverUrl: string;
  bannerUrl?: string;
  episodes: number | null;
  status: string;
  format: string;
  genres: string[];
  averageScore: number | null;
  year: number | null;
  season?: string | null;
}

export interface AnimeEpisode {
  number: number;
  title: string;
}

export interface VideoSource {
  url: string;
  quality: string;
  isM3U8: boolean;
}

export interface EpisodeSubtitle {
  file: string;
  label: string;
}

export interface EpisodeStream {
  sources: VideoSource[];
  subtitles: EpisodeSubtitle[];
  episodeId: string;
  episodeTitle: string;
  serverName: string;
}

// ---------- AniList catalog ----------

const ANILIST_URL = 'https://graphql.anilist.co';

const MEDIA_FIELDS = `
  id
  title { romaji english }
  description
  episodes
  status
  format
  genres
  averageScore
  seasonYear
  season
  coverImage { extraLarge large }
  bannerImage
`;

const MEDIA_LIST_QUERY = `
query MediaList($page: Int, $perPage: Int, $search: String, $sort: [MediaSort]) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, search: $search, sort: $sort, isAdult: false) {
      ${MEDIA_FIELDS}
    }
  }
}`;

const MEDIA_ID_QUERY = `
query MediaId($id: Int) {
  Media(id: $id, type: ANIME) {
    ${MEDIA_FIELDS}
  }
}`;

const STATUS_LABELS: Record<string, string> = {
  FINISHED: 'Finished',
  RELEASING: 'Airing',
  NOT_YET_RELEASED: 'Upcoming',
  CANCELLED: 'Cancelled',
  HIATUS: 'Hiatus',
};

const FORMAT_LABELS: Record<string, string> = {
  TV: 'TV',
  TV_SHORT: 'TV Short',
  MOVIE: 'Movie',
  OVA: 'OVA',
  ONA: 'ONA',
  SPECIAL: 'Special',
  MUSIC: 'Music',
};

function stripHtml(html: string | null | undefined): string {
  if (!html) return 'No description available.';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMedia(dto: any): AnimeItem {
  const romaji = dto?.title?.romaji || '';
  const english = dto?.title?.english || '';
  const title = english || romaji || 'Untitled Anime';
  const alt = english ? romaji : undefined;
  return {
    id: dto?.id,
    title,
    altTitle: alt && alt !== title ? alt : undefined,
    description: stripHtml(dto?.description),
    coverUrl: dto?.coverImage?.extraLarge || dto?.coverImage?.large || '',
    bannerUrl: dto?.bannerImage || '',
    episodes: dto?.episodes ?? null,
    status: STATUS_LABELS[dto?.status] || dto?.status || 'Unknown',
    format: FORMAT_LABELS[dto?.format] || dto?.format || '',
    genres: dto?.genres || [],
    averageScore: dto?.averageScore ?? null,
    year: dto?.seasonYear ?? null,
    season: dto?.season || null,
  };
}

async function anilist(query: string, variables: Record<string, unknown>): Promise<any> {
  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList error: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || 'AniList request failed');
  return json;
}

// Trending / popular series shown when the app opens.
export async function getAnimeSuggestions(limit: number = 18): Promise<AnimeItem[]> {
  const json = await anilist(MEDIA_LIST_QUERY, {
    page: 1,
    perPage: limit,
    sort: ['TRENDING_DESC'],
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (json?.data?.Page?.media || []).map(mapMedia);
}

export async function searchAnime(query: string, limit: number = 24): Promise<AnimeItem[]> {
  const json = await anilist(MEDIA_LIST_QUERY, {
    page: 1,
    perPage: limit,
    search: query.trim(),
    sort: ['SEARCH_MATCH', 'POPULARITY_DESC'],
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (json?.data?.Page?.media || []).map(mapMedia);
}

export async function getAnimeById(id: number): Promise<AnimeItem | null> {
  const json = await anilist(MEDIA_ID_QUERY, { id });
  const media = json?.data?.Media;
  return media ? mapMedia(media) : null;
}

// AniList doesn't expose individual episodes, so generate 1..N from the episode
// count (AniList counts movies as 1 episode).
export function getAnimeEpisodes(anime: AnimeItem): AnimeEpisode[] {
  let count = anime.episodes;
  if (!count || count <= 0) {
    count = anime.format === 'Movie' ? 1 : 12;
  }
  const list: AnimeEpisode[] = [];
  for (let n = 1; n <= count; n++) list.push({ number: n, title: '' });
  return list;
}

// ---------- Streaming (aniwatch-api / hianime) ----------

// Community-run hosts that proxy hianime.to. As of 2026 hianime is frequently
// offline and most public instances are dead or disabled, so the app also
// supports a user-supplied custom instance (see setCustomStreamHost). Hosts are
// probed concurrently and the first healthy one is reused for the session.
const ANIWATCH_API_HOSTS = [
  'https://aniwatch-api-net.vercel.app',
  'https://hianime-api-virid.vercel.app',
  'https://quantum-anime.vercel.app',
  'https://hi-anime-api.vercel.app',
];

const CUSTOM_HOST_KEY = 'comick.reader.aniwatchHost';
const PROBE_TIMEOUT_MS = 8000;

// AniXo API (public Hugging Face Space) scrapes anikototv.to and returns streams
// by AniList ID, plus an HLS proxy that rewrites segments with the required
// Referer header so streams are playable in-app. This is the primary source.
const ANIXO_HOSTS = ['https://anivexaapi-aniko2.hf.space'];

export function getCustomStreamHost(): string | null {
  try {
    const v = localStorage.getItem(CUSTOM_HOST_KEY);
    return v && v.trim() ? v.trim().replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
}

export function setCustomStreamHost(url: string | null): void {
  try {
    if (url && url.trim()) {
      localStorage.setItem(CUSTOM_HOST_KEY, url.trim().replace(/\/+$/, ''));
    } else {
      localStorage.removeItem(CUSTOM_HOST_KEY);
    }
  } catch {
    // ignore storage errors (e.g. private browsing)
  }
  sessionWinner = null;
  customBlockedUntil = 0;
}

let sessionWinner: string | null = null;
let customBlockedUntil = 0;
let lastHostUsed: string | null = null;

// Host that served the most recent stream request (informational only).
export function getActiveStreamHost(): string | null {
  return lastHostUsed;
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
  } finally {
    clearTimeout(timer);
  }
}

// A healthy aniwatch-api response is `{ success: true, data: {...} }`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validatePayload(json: any): boolean {
  if (!json || typeof json !== 'object') return false;
  if (json.success === false) return false;
  const data = json.data ?? json;
  return !!data && (!Array.isArray(data) || data.length > 0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tryHost(host: string, path: string): Promise<any> {
  const res = await fetchWithTimeout(`${host}${path}`, PROBE_TIMEOUT_MS);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!validatePayload(json)) throw new Error('empty provider response');
  lastHostUsed = host;
  return json;
}

// Start every host at once and resolve with the first successful response.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function raceHosts(hosts: string[], path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    let pending = hosts.length;
    let done = false;
    if (pending === 0) {
      reject(new Error('No streaming hosts configured'));
      return;
    }
    const fail = (err: unknown) => {
      if (done) return;
      pending -= 1;
      if (pending === 0) {
        done = true;
        reject(err);
      }
    };
    for (const host of hosts) {
      tryHost(host, path).then(
        (json) => {
          if (done) return;
          done = true;
          sessionWinner = host;
          resolve(json);
        },
        fail
      );
    }
  });
}

function orderedHosts(): string[] {
  const custom = getCustomStreamHost();
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (host: string | null) => {
    if (host && !seen.has(host)) {
      seen.add(host);
      out.push(host);
    }
  };
  if (custom && Date.now() >= customBlockedUntil) push(custom);
  push(sessionWinner);
  ANIWATCH_API_HOSTS.forEach(push);
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function aniwatchFetch(path: string): Promise<any> {
  const custom = getCustomStreamHost();
  if (custom && Date.now() >= customBlockedUntil) {
    try {
      return await tryHost(custom, path);
    } catch {
      // Custom host is down; don't block on it again for a few minutes.
      customBlockedUntil = Date.now() + 5 * 60 * 1000;
    }
  }
  try {
    return await raceHosts(orderedHosts(), path);
  } catch {
    sessionWinner = null;
    throw new Error('All streaming hosts are unreachable');
  }
}

export interface HostStatus {
  url: string;
  ok: boolean;
  latencyMs: number | null;
  error?: string;
}

// Live health check of every known host (including a custom one, if set).
export async function testStreamingHosts(): Promise<HostStatus[]> {
  const custom = getCustomStreamHost();
  const hosts: { url: string; probe: string }[] = [];
  if (custom) hosts.push({ url: custom, probe: '/api/v2/hianime/home' });
  for (const h of ANIWATCH_API_HOSTS) {
    if (!hosts.some((x) => x.url === h)) hosts.push({ url: h, probe: '/api/v2/hianime/home' });
  }
  for (const h of ANIXO_HOSTS) {
    if (!hosts.some((x) => x.url === h)) hosts.push({ url: h, probe: '/' });
  }
  return Promise.all(
    hosts.map(async ({ url, probe }) => {
      const start = Date.now();
      try {
        await tryHost(url, probe);
        return { url, ok: true, latencyMs: Date.now() - start };
      } catch (err) {
        return {
          url,
          ok: false,
          latencyMs: Date.now() - start,
          error: err instanceof Error ? err.message : 'unreachable',
        };
      }
    })
  );
}

const streamSearchCache = new Map<string, string>();
const streamEpisodesCache = new Map<string, { id: string; number: number }[]>();

async function searchStreamAnime(title: string): Promise<string> {
  const cached = streamSearchCache.get(title.toLowerCase());
  if (cached) return cached;

  const json = await aniwatchFetch(
    `/api/v2/hianime/search?q=${encodeURIComponent(title)}&page=1`
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const animes: any[] = json?.data?.animes || json?.animes || [];
  const match = animes.find((a) => a?.id) || animes[0];
  if (!match?.id) throw new Error('No stream source found for this title');

  const id = String(match.id);
  streamSearchCache.set(title.toLowerCase(), id);
  return id;
}

async function getStreamEpisodes(animeId: string): Promise<{ id: string; number: number }[]> {
  const cached = streamEpisodesCache.get(animeId);
  if (cached) return cached;

  const json = await aniwatchFetch(`/api/v2/hianime/anime/${animeId}/episodes`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eps: any[] = json?.data?.episodes || json?.episodes || [];
  const list = eps
    .map((e) => ({ id: String(e.id), number: Number(e.number) }))
    .filter((e) => e.id && !Number.isNaN(e.number));
  if (list.length === 0) throw new Error('No episodes found for this title');

  streamEpisodesCache.set(animeId, list);
  return list;
}

interface StreamServer {
  serverId: string;
  serverName: string;
  category: 'sub' | 'dub';
}

async function getEpisodeServers(episodeId: string): Promise<StreamServer[]> {
  const json = await aniwatchFetch(
    `/api/v2/hianime/episode/servers?animeEpisodeId=${encodeURIComponent(episodeId)}`
  );
  const eps = json?.data?.episodes || json?.episodes || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub: any[] = eps.sub || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dub: any[] = eps.dub || [];
  const category: 'sub' | 'dub' = sub.length > 0 ? 'sub' : 'dub';
  const all = category === 'sub' ? sub : dub;
  if (all.length === 0) throw new Error('No streaming servers available');

  // Prefer the vidstreaming "HD-2"/"HD-1" servers, they tend to be the most stable.
  const score = (name: string) =>
    /hd-?2/i.test(name) ? 0 : /hd-?1/i.test(name) ? 1 : /megacloud/i.test(name) ? 2 : 3;
  const ranked = [...all]
    .sort((a, b) => score(String(a?.serverName || '')) - score(String(b?.serverName || '')))
    .map((s) => ({
      serverId: String(s?.serverId || s?.id),
      serverName: String(s?.serverName || 'Server'),
      category,
    }))
    .filter((s) => s.serverId);
  if (ranked.length === 0) throw new Error('No streaming servers available');
  return ranked;
}

export async function getEpisodeStream(
  title: string,
  episodeNumber: number,
  anilistId?: number
): Promise<EpisodeStream> {
  // Primary path: AniXo (Anikoto via AniList ID) — reliable and working today.
  if (anilistId) {
    try {
      return await getAnixoStream(anilistId, episodeNumber);
    } catch {
      // fall through to the title-based aniwatch path
    }
  }
  const animeId = await searchStreamAnime(title);
  const episodes = await getStreamEpisodes(animeId);

  const ep =
    episodes.find((e) => e.number === episodeNumber) ||
    episodes.find((e) => e.number === 1 && episodeNumber === 1) ||
    episodes[0];
  if (!ep) throw new Error(`Episode ${episodeNumber} not found`);

  const servers = await getEpisodeServers(ep.id);
  let lastErr: unknown = null;
  for (const server of servers.slice(0, 3)) {
    try {
      const json = await aniwatchFetch(
        `/api/v2/hianime/episode/sources?animeEpisodeId=${encodeURIComponent(ep.id)}&server=${encodeURIComponent(server.serverId)}&category=${server.category}`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sources: any[] = json?.data?.sources || json?.sources || [];
      if (sources.length === 0) throw new Error('No playable source returned');

      const mapped = sources
        .filter((s) => s?.url)
        .map((s) => ({
          url: String(s.url),
          quality: String(s.quality || 'auto'),
          isM3U8: s.isM3U8 !== false,
        }));

      return {
        sources: mapped,
        subtitles: (json?.data?.subtitles || []).map((s: any) => ({
          file: String(s.file),
          label: String(s.label || ''),
        })),
        episodeId: ep.id,
        episodeTitle: `${title} - Episode ${episodeNumber}`,
        serverName: server.serverName,
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('No playable source returned');
}

// ---------- AniXo (Anikoto) provider ----------

interface AnixoEpisodeDto {
  number?: number;
  title?: string;
  duration?: number;
  filler?: boolean;
}

interface AnixoStreamDto {
  url?: string;
  type?: string;
  referer?: string;
  server?: string;
  priority?: number;
}

interface AnixoSubtitleDto {
  file?: string;
  label?: string;
  kind?: string;
  default?: boolean;
}

// Real per-episode data (numbers + titles) for a title, keyed by AniList ID.
export async function getAnixoEpisodes(anilistId: number): Promise<AnimeEpisode[]> {
  let lastErr: unknown = null;
  for (const host of ANIXO_HOSTS) {
    try {
      const res = await fetchWithTimeout(`${host}/api/episodes/${anilistId}`, PROBE_TIMEOUT_MS);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const sub: AnixoEpisodeDto[] = json?.episodes?.sub || json?.sub || [];
      const list = sub
        .filter((e) => e && e.number != null)
        .map((e) => ({ number: Number(e.number), title: e.title || '' }));
      if (list.length > 0) return list;
      throw new Error('no sub episodes');
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('AniXo episode list unavailable');
}

async function getAnixoWatch(anilistId: number, audio: 'sub' | 'dub', epNum: number): Promise<EpisodeStream> {
  let lastErr: unknown = null;
  for (const host of ANIXO_HOSTS) {
    try {
      const res = await fetchWithTimeout(
        `${host}/api/watch/${anilistId}/${audio}/${epNum}`,
        PROBE_TIMEOUT_MS
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = json?.ssub || json?.sdub || (json as any);
      const streams: AnixoStreamDto[] = data?.streams || [];
      const hls = streams
        .filter((s) => s?.type === 'hls' && s?.url)
        .sort((a, b) => (b.priority || 0) - (a.priority || 0));
      if (hls.length === 0) throw new Error('No HLS source returned');

      const base = host.replace(/\/+$/, '');
      const best = hls[0];
      const proxyUrl = `${base}/api/proxy?url=${encodeURIComponent(best.url!)}&referer=${encodeURIComponent(best.referer || '')}`;
      const subtitles: EpisodeSubtitle[] = (data?.subtitles || [])
        .filter((s: AnixoSubtitleDto) => s?.file)
        .map((s: AnixoSubtitleDto) => ({ file: String(s.file), label: String(s.label || '') }));

      return {
        sources: [{ url: proxyUrl, quality: 'auto', isM3U8: true }],
        subtitles,
        episodeId: `${anilistId}/${audio}/${epNum}`,
        episodeTitle: `${audio === 'dub' ? 'Dub' : 'Episode'} ${epNum}`,
        serverName: `${best.server || 'Anikoto'}${data?.provider ? ` • ${data.provider}` : ''}`,
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('AniXo stream unavailable');
}

export async function getAnixoStream(anilistId: number, episodeNumber: number): Promise<EpisodeStream> {
  return getAnixoWatch(anilistId, 'sub', episodeNumber);
}

// ---------- Browser fallback URLs ----------

export interface WatchFallbackUrls {
  hianime: string;
  anitaku: string;
}

export function getWatchFallbackUrls(title: string, streamEpisodeId?: string): WatchFallbackUrls {
  const q = encodeURIComponent(title);
  return {
    hianime: streamEpisodeId
      ? `https://hianime.to/watch/${streamEpisodeId}`
      : `https://hianime.to/search?keyword=${q}`,
    anitaku: `https://anitaku.pe/search.html?keyword=${q}`,
  };
}
