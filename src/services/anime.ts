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
  language?: string;
  isDefault?: boolean;
}

export interface EpisodeStream {
  sources: VideoSource[];
  subtitles: EpisodeSubtitle[];
  episodeId: string;
  episodeTitle: string;
  serverName: string;
  embedUrl?: string;
}

// ---------- Multi-server support ----------

export type ServerProvider = 'anixo' | 'anivault' | 'aniwatch' | 'kuhi';

export interface StreamServerMeta {
  id: string;
  name: string;
  provider: ServerProvider;
  category: 'sub' | 'dub';
  /** AniVault: server name to request (e.g. "HD-2") */
  vaultServer?: string;
  /** AniVault: upstream source (e.g. "anikoto", "animeheaven") */
  vaultSource?: string;
  /** AniXo: the host that returned this server */
  anixoHost?: string;
  /** AniXo: server label from the watch response */
  anixoServerLabel?: string;
  /** Aniwatch: the server ID from the API */
  aniwatchServerId?: string;
  /** Aniwatch: category for the server request */
  aniwatchCategory?: 'sub' | 'dub';
  /** Aniwatch: episode server ID */
  aniwatchEpisodeId?: string;
  /** Kuhi: upstream provider (e.g. "neko", "egg", "koto") */
  kuhiProvider?: string;
  /** Kuhi: episode ID string (e.g. "watch/neko/178789/sub/neko-5") */
  kuhiEpisodeId?: string;
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

// Free HF Spaces spin down when idle and can take a while to cold-start, so
// the AniXo path is retried with this generous timeout before giving up.
const ANIXO_COLD_TIMEOUT_MS = 45000;

// Fire-and-forget ping to wake the AniXo HF Space out of its idle spin-down.
export function warmAnixo(): void {
  for (const host of ANIXO_HOSTS) {
    fetch(host, { mode: 'no-cors', keepalive: true }).catch(() => {});
  }
}

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

async function getAniwatchStream(title: string, episodeNumber: number): Promise<EpisodeStream> {
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

export async function getEpisodeStream(
  title: string,
  episodeNumber: number,
  anilistId?: number
): Promise<EpisodeStream> {
  // Primary path: AniXo (Anikoto via AniList ID).
  if (anilistId) {
    try {
      return await getAnixoStream(anilistId, episodeNumber);
    } catch (err) {
      // The bundled aniwatch hosts are all dead (500/402), so only attempt that
      // path when the user has configured a custom instance. This avoids a long,
      // pointless wait before surfacing the real error.
      if (getCustomStreamHost()) {
        return getAniwatchStream(title, episodeNumber);
      }
      throw err;
    }
  }
  return getAniwatchStream(title, episodeNumber);
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
  language?: string;
}

// Real per-episode data (numbers + titles) for a title, keyed by AniList ID.
async function tryAnixoEpisodes(host: string, anilistId: number, timeoutMs: number): Promise<AnimeEpisode[]> {
  const res = await fetchWithTimeout(`${host}/api/episodes/${anilistId}`, timeoutMs);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const sub: AnixoEpisodeDto[] = json?.episodes?.sub || json?.sub || [];
  const list = sub
    .filter((e) => e && e.number != null)
    .map((e) => ({ number: Number(e.number), title: e.title || '' }));
  if (list.length > 0) return list;
  throw new Error('no sub episodes');
}

export async function getAnixoEpisodes(anilistId: number): Promise<AnimeEpisode[]> {
  let lastErr: unknown = null;
  for (const timeoutMs of [PROBE_TIMEOUT_MS, ANIXO_COLD_TIMEOUT_MS]) {
    for (const host of ANIXO_HOSTS) {
      try {
        return await tryAnixoEpisodes(host, anilistId, timeoutMs);
      } catch (err) {
        lastErr = err;
      }
    }
  }
  throw lastErr || new Error('AniXo episode list unavailable');
}

// MegaPlay serves its embed pages with an HTTP 200 even when the underlying
// file was removed (it renders a branded "Error Code: 404" page instead). Check
// the page content so the player doesn't iframe a dead embed.
async function isEmbedAlive(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'text/html' } });
    clearTimeout(timer);
    if (!res.ok) return false;
    const html = await res.text();
    // Detect various error patterns from megaplay.buzz / filemoon embeds
    return !/error[- ]code/i.test(html) && !/error - megaplay/i.test(html) && !/not found/i.test(html);
  } catch {
    return false;
  }
}

async function tryAnixoWatch(
  host: string,
  anilistId: number,
  audio: 'sub' | 'dub',
  epNum: number,
  timeoutMs: number
): Promise<EpisodeStream> {
  const res = await fetchWithTimeout(`${host}/api/watch/${anilistId}/${audio}/${epNum}`, timeoutMs);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = json?.ssub || json?.sdub || (json as any);
  const streams: AnixoStreamDto[] = data?.streams || [];
  const hls = streams
    .filter((s) => s?.type === 'hls' && s?.url)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const embeds = streams
    .filter((s) => s?.type === 'embed' && s?.url)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  if (hls.length === 0 && embeds.length === 0) throw new Error('No playable source returned');

  const base = host.replace(/\/+$/, '');
  const episodeId = `${anilistId}/${audio}/${epNum}`;
  const episodeTitle = `${audio === 'dub' ? 'Dub' : 'Episode'} ${epNum}`;

  // Some episodes only come as an embed player (megaplay.buzz), with no HLS
  // stream to play natively. Verify the embed is live before offering it.
  if (hls.length === 0) {
    for (const e of embeds) {
      if (!(await isEmbedAlive(e.url!))) continue;
      return {
        sources: [],
        subtitles: [],
        embedUrl: e.url!,
        episodeId,
        episodeTitle,
        serverName: `${e.server || 'Embed'}${data?.provider ? ` • ${data.provider}` : ''}`,
      };
    }
    throw new Error('This episode is only available via an embed provider that is currently offline');
  }

  const best = hls[0];
  const referer = best.referer || '';
  // Route both the HLS stream and its subtitles through the AniXo proxy so
  // the files are fetched with the required Referer and served with CORS
  // headers (otherwise the browser refuses to load them in-app).
  const proxyPath = (u: string) =>
    `${base}/api/proxy?url=${encodeURIComponent(/^https?:\/\//i.test(u) ? u : new URL(u, base).toString())}&referer=${encodeURIComponent(referer)}`;
  const proxyUrl = proxyPath(best.url!);
  // AniXo repeats the same subtitle set per provider (Nexus/Aurora/Orbit);
  // dedupe by label, preferring the entry flagged as the default one.
  const seenSubs = new Map<string, AnixoSubtitleDto>();
  for (const s of data?.subtitles || []) {
    if (!s?.file) continue;
    const key = String(s.label || s.language || '');
    const prev = seenSubs.get(key);
    if (!prev || s.default) seenSubs.set(key, s);
  }
  const subtitles: EpisodeSubtitle[] = [...seenSubs.values()].map((s) => ({
    file: proxyPath(String(s.file)),
    label: String(s.label || ''),
    language: String(s.language || ''),
    isDefault: !!s.default,
  }));

  return {
    sources: [{ url: proxyUrl, quality: 'auto', isM3U8: true }],
    subtitles,
    episodeId,
    episodeTitle,
    serverName: `${best.server || 'Anikoto'}${data?.provider ? ` • ${data.provider}` : ''}`,
  };
}

async function getAnixoWatch(anilistId: number, audio: 'sub' | 'dub', epNum: number): Promise<EpisodeStream> {
  let lastErr: unknown = null;
  for (const timeoutMs of [PROBE_TIMEOUT_MS, ANIXO_COLD_TIMEOUT_MS]) {
    for (const host of ANIXO_HOSTS) {
      try {
        return await tryAnixoWatch(host, anilistId, audio, epNum, timeoutMs);
      } catch (err) {
        lastErr = err;
      }
    }
  }
  throw lastErr || new Error('AniXo stream unavailable');
}

export async function getAnixoStream(anilistId: number, episodeNumber: number): Promise<EpisodeStream> {
  return getAnixoWatch(anilistId, 'sub', episodeNumber);
}

// ---------- AniVault provider ----------

const ANIVAULT_API = 'https://anivault-scraper.vercel.app';

// AniVault aggregates multiple upstream sources. Each source covers different
// episodes — anikoto has eps 1-7 for many shows, animeheaven fills later eps.
const ANIVAULT_SOURCES = ['anikoto', 'animeheaven'] as const;

interface AnivaultResponse {
  anilistId?: number;
  title?: string;
  episode?: number;
  type?: string;
  source?: string;
  server?: string;
  availableServers?: string[];
  embedUrl?: string;
  streamUrl?: string;
  rawStreamUrl?: string;
  mp4?: string;
  mp4ProxyUrl?: string;
  m3u8?: string;
  hlsProxyUrl?: string;
  playbackMode?: string;
  iframeOnly?: boolean;
  subtitles?: { url: string; lang: string; default?: boolean }[];
  error?: string;
  detail?: string;
}

async function fetchAnivaultSource(
  source: string,
  anilistId: number,
  episode: number,
  type: 'sub' | 'dub',
  server?: string
): Promise<AnivaultResponse> {
  let url = `${ANIVAULT_API}/api/watch/${source}/${anilistId}/${episode}/${type}`;
  if (server) url += `?server=${encodeURIComponent(server)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.detail || json.error);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

async function getAnivaultServersForEpisode(
  anilistId: number,
  episodeNumber: number
): Promise<StreamServerMeta[]> {
  const allServers: StreamServerMeta[] = [];

  // Try each AniVault source for both sub and dub
  for (const source of ANIVAULT_SOURCES) {
    for (const type of ['sub', 'dub'] as const) {
      try {
        const resp = await fetchAnivaultSource(source, anilistId, episodeNumber, type);
        const servers: string[] = resp.availableServers || [];
        const hasStream = resp.m3u8 || resp.mp4 || resp.streamUrl;
        if (servers.length === 0 && !hasStream) continue;
        if (servers.length === 0 && resp.server) servers.push(resp.server);

        const sourceLabel = source === 'animeheaven' ? 'AH' : '';

        for (const name of servers) {
          const displayName = sourceLabel ? `${sourceLabel} ${name}` : name;
          const id = `av-${source}-${anilistId}-${episodeNumber}-${type}-${name}`;
          if (allServers.some((s) => s.id === id)) continue;
          allServers.push({
            id,
            name: type === 'dub' ? `${displayName} (Dub)` : displayName,
            provider: 'anivault' as ServerProvider,
            category: type,
            vaultServer: name,
            vaultSource: source,
          });
        }
      } catch {
        // Skip failed source/type
      }
    }
  }
  return allServers;
}

function buildProxyUrl(m3u8Url: string, referer: string): string {
  // Use AniVault's built-in HLS proxy which handles referer + URL rewriting.
  return `${ANIVAULT_API}/api/proxy/hls?url=${encodeURIComponent(m3u8Url)}&ref=${encodeURIComponent(referer)}`;
}

function proxySubtitleUrl(url: string, referer: string): string {
  // Subtitle files on cdn.watching.onl also require the megaplay.buzz referer.
  // Route them through AniVault's HLS proxy so they load in-app.
  return `${ANIVAULT_API}/api/proxy/hls?url=${encodeURIComponent(url)}&ref=${encodeURIComponent(referer)}`;
}

async function resolveAnivaultServer(
  meta: StreamServerMeta,
  anilistId: number,
  episodeNumber: number
): Promise<EpisodeStream> {
  const source = meta.vaultSource || 'anikoto';
  const resp = await fetchAnivaultSource(source, anilistId, episodeNumber, meta.category, meta.vaultServer);

  const subtitles: EpisodeSubtitle[] = (resp.subtitles || []).map((s) => ({
    file: proxySubtitleUrl(s.url, 'https://megaplay.buzz/'),
    label: s.lang || 'English',
    language: s.lang || 'en',
    isDefault: !!s.default,
  }));

  // Handle MP4 playback (animeheaven returns direct MP4)
  if (resp.streamUrl || resp.mp4ProxyUrl || resp.mp4) {
    const mp4Url = resp.streamUrl || resp.mp4ProxyUrl || resp.mp4!;
    return {
      sources: [{ url: mp4Url, quality: 'auto', isM3U8: false }],
      subtitles,
      episodeId: `anivault-${source}-${anilistId}-${episodeNumber}`,
      episodeTitle: `Episode ${episodeNumber}`,
      serverName: `AniVault • ${resp.server || meta.name}`,
    };
  }

  // Handle HLS playback (anikoto returns m3u8)
  if (!resp.m3u8) throw new Error('No stream returned from AniVault');

  const referer = 'https://megaplay.buzz/';
  const proxyUrl = buildProxyUrl(resp.m3u8, referer);
  return {
    sources: [{ url: proxyUrl, quality: 'auto', isM3U8: true }],
    subtitles,
    episodeId: `anivault-${source}-${anilistId}-${episodeNumber}`,
    episodeTitle: `Episode ${episodeNumber}`,
    serverName: `AniVault • ${resp.server || meta.name}`,
  };
}

// ---------- Multi-server API ----------

// ---------- Kuhi provider (anime-scraper-v2.vercel.app) ----------

const KUHI_API = 'https://anime-scraper-v2.vercel.app';

// Kuhi aggregates multiple upstream sources. Best coverage:
// - neko: HLS + subtitles, eps 1-11 for currently airing shows
// - egg: MP4 (up to 1080p), broader episode range but no embedded subs
// - koto: limited (often only ep 1)
const KUHI_PROVIDERS = ['neko', 'egg'] as const;

interface KuhiEpisodeEntry {
  number: number;
  title?: string;
  id: string;
  audio: 'sub' | 'dub';
}

interface KuhiEpisodesResponse {
  [provider: string]: {
    episodes?: {
      sub?: KuhiEpisodeEntry[];
      dub?: KuhiEpisodeEntry[];
    };
  };
}

interface KuhiStreamEntry {
  url: string;
  type: 'hls' | 'mp4' | 'embed';
  quality?: string;
  referer?: string;
  server?: string;
  embed?: string;
  audio?: string;
  isActive?: boolean;
}

interface KuhiWatchResponse {
  anilistId?: number;
  episode?: number;
  audio?: string;
  streams?: KuhiStreamEntry[];
}

async function fetchKuhiEpisodes(anilistId: number): Promise<KuhiEpisodesResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${KUHI_API}/episodes/${anilistId}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchKuhiWatch(episodeId: string): Promise<KuhiWatchResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${KUHI_API}/${episodeId}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getKuhiServersForEpisode(
  anilistId: number,
  episodeNumber: number
): Promise<StreamServerMeta[]> {
  const allServers: StreamServerMeta[] = [];

  try {
    const episodesData = await fetchKuhiEpisodes(anilistId);

    for (const provider of KUHI_PROVIDERS) {
      const providerData = episodesData[provider];
      if (!providerData?.episodes) continue;

      for (const audioType of ['sub', 'dub'] as const) {
        const eps = providerData.episodes[audioType] || [];
        const match = eps.find((e) => e.number === episodeNumber);
        if (!match) continue;

        const id = `kuhi-${provider}-${anilistId}-${episodeNumber}-${audioType}`;
        const displayName = provider.toUpperCase();
        allServers.push({
          id,
          name: audioType === 'dub' ? `${displayName} (Dub)` : displayName,
          provider: 'kuhi' as ServerProvider,
          category: audioType,
          kuhiProvider: provider,
          kuhiEpisodeId: match.id,
        });
      }
    }
  } catch {
    // Kuhi API is down or unreachable
  }

  return allServers;
}

async function resolveKuhiServer(
  meta: StreamServerMeta,
  _anilistId: number,
  _episodeNumber: number
): Promise<EpisodeStream> {
  if (!meta.kuhiEpisodeId) throw new Error('No Kuhi episode ID');

  const watchData = await fetchKuhiWatch(meta.kuhiEpisodeId);
  const streams = watchData.streams || [];

  if (streams.length === 0) throw new Error('No streams returned from Kuhi');

  // Pick the best HLS stream first, then MP4, skip embeds
  const hls = streams.filter((s) => s.type === 'hls' && s.url);
  const mp4 = streams.filter((s) => s.type === 'mp4' && s.url);
  const ordered = [...hls, ...mp4];

  if (ordered.length === 0) throw new Error('No playable streams returned from Kuhi');

  const best = ordered[0];
  const isHls = best.type === 'hls';

  // Extract subtitles from the stream URL params or use known patterns.
  // Kuhi/AniNeko embeds subtitle URLs in the referer or embed URL.
  const subtitles: EpisodeSubtitle[] = [];
  // The VTT subtitle file can often be extracted from the embed URL's sub param
  for (const s of streams) {
    const refUrl = s.referer || s.embed || '';
    const subMatch = refUrl.match(/sub(?:_1)?=([^&]+)/);
    if (subMatch) {
      const subUrl = decodeURIComponent(subMatch[1]);
      if (subUrl.endsWith('.vtt')) {
        // Route through our proxy for CORS
        const proxied = `/hls?url=${encodeURIComponent(subUrl)}&ref=${encodeURIComponent(s.referer || '')}`;
        subtitles.push({ file: proxied, label: 'English', language: 'en', isDefault: true });
        break;
      }
    }
  }

  const epId = meta.kuhiEpisodeId;
  const epNum = _episodeNumber;
  const serverLabel = best.server || meta.kuhiProvider?.toUpperCase() || 'Kuhi';

  if (isHls) {
    // HLS streams from vibevibe.workers.dev already have CORS.
    // But we may need to proxy for referer or if CORS is missing.
    const streamUrl = best.url;
    return {
      sources: [{ url: streamUrl, quality: best.quality || 'auto', isM3U8: true }],
      subtitles,
      episodeId: epId,
      episodeTitle: `Episode ${epNum}`,
      serverName: `Kuhi • ${serverLabel}`,
    };
  }

  // MP4 streams (egg provider)
  // Map quality strings to proper format
  const mappedSources = mp4.map((s) => ({
    url: s.url,
    quality: s.quality || 'auto',
    isM3U8: false,
  }));

  return {
    sources: mappedSources.length > 0 ? mappedSources : [{ url: best.url, quality: best.quality || 'auto', isM3U8: false }],
    subtitles,
    episodeId: epId,
    episodeTitle: `Episode ${epNum}`,
    serverName: `Kuhi • ${serverLabel}`,
  };
}

// ---------- Multi-server API ----------

export async function listEpisodeServers(
  title: string,
  episodeNumber: number,
  anilistId?: number
): Promise<StreamServerMeta[]> {
  const servers: StreamServerMeta[] = [];

  // AniVault servers (if we have an AniList ID)
  if (anilistId) {
    const vaultServers = await getAnivaultServersForEpisode(anilistId, episodeNumber);
    servers.push(...vaultServers);
  }

  // Kuhi servers (if we have an AniList ID)
  if (anilistId) {
    const kuhiServers = await getKuhiServersForEpisode(anilistId, episodeNumber);
    servers.push(...kuhiServers);
  }

  return servers;
}

export async function resolveEpisodeServer(
  meta: StreamServerMeta,
  title: string,
  episodeNumber: number,
  anilistId?: number
): Promise<EpisodeStream> {
  if (meta.provider === 'anivault' && anilistId) {
    return resolveAnivaultServer(meta, anilistId, episodeNumber);
  }
  if (meta.provider === 'kuhi' && anilistId) {
    return resolveKuhiServer(meta, anilistId, episodeNumber);
  }
  // Fallback: use the existing getEpisodeStream for anixo/aniwatch
  return getEpisodeStream(title, episodeNumber, anilistId);
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
