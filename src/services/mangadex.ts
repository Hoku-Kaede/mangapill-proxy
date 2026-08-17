import { MangaItem, ChapterItem, ChapterPagesData } from '../types';

// MangaDex-backed manga service (replaces the ComicK integration, whose chapter
// endpoints are Cloudflare-blocked). MangaDex is verified working end-to-end:
// search -> feed -> at-home server -> page images.

const MANGADEX_API_PROXY = '/api/mangadex?path=';
const MANGADEX_IMG_PROXY = '/api/mdimage?url=';

function mdApiUrl(path: string): string {
  return MANGADEX_API_PROXY + encodeURIComponent(path);
}

function mdImageUrl(url: string): string {
  return MANGADEX_IMG_PROXY + encodeURIComponent(url);
}

// Direct URLs used as fallback on Capacitor (no CORS issues there)
const API_BASE = 'https://api.mangadex.org';
const IMAGE_BASE = 'https://uploads.mangadex.org';
const MAX_RETRIES = 2;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IS_CAPACITOR = typeof (globalThis as any).window !== 'undefined' && !!(globalThis as any).window?.Capacitor;

function apiUrl(path: string): string {
  return IS_CAPACITOR ? `${API_BASE}${path}` : mdApiUrl(path);
}

function imgUrl(url: string): string {
  return IS_CAPACITOR ? url : mdImageUrl(url);
}

// Origin filter for search/suggestions. MangaDex exposes a series' country of
// origin via `attributes.originalLanguage` ('ja' = Japanese manga, 'ko' = Korean
// manhwa, 'zh'/'zh-hk' = Chinese manhua). Webtoons are a format, so that filter
// uses the "Web Comic" / "Long Strip" tags instead.
export type MangaOrigin = 'all' | 'manga' | 'manhwa' | 'manhua' | 'webtoon';

const ORIGIN_LANGS: Record<'manga' | 'manhwa' | 'manhua', string[]> = {
  manga: ['ja'],
  manhwa: ['ko'],
  manhua: ['zh', 'zh-hk'],
};

// Tag UUIDs resolved once from the API's tag list and then cached (for the
// webtoon format filter). Falls back to no filter if the lookup fails.
const WEBTOON_TAG_NAMES = ['Web Comic', 'Long Strip'];
let webtoonTagIds: string[] | null = null;
let webtoonTagFetch: Promise<string[]> | null = null;

async function loadWebtoonTagIds(): Promise<string[]> {
  if (webtoonTagIds) return webtoonTagIds;
  if (!webtoonTagFetch) {
    webtoonTagFetch = (async () => {
      const res = await mdFetch(apiUrl('/manga/tag'));
      const json = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const idByName: Record<string, string> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const t of json?.data || []) {
        const name = localizedTagName(t);
        if (name) idByName[name] = t?.id;
      }
      webtoonTagIds = WEBTOON_TAG_NAMES.map((n) => idByName[n]).filter(Boolean) as string[];
      return webtoonTagIds;
    })().catch(() => {
      webtoonTagIds = [];
      return webtoonTagIds;
    });
  }
  return webtoonTagFetch;
}

// Returns the query params for an origin filter.
async function originFilterParams(origin: MangaOrigin): Promise<URLSearchParams> {
  const params = new URLSearchParams();
  if (origin === 'all') return params;
  if (origin === 'webtoon') {
    const ids = await loadWebtoonTagIds();
    ids.forEach((id) => params.append('includedTags[]', id));
    return params;
  }
  ORIGIN_LANGS[origin].forEach((lang) => params.append('originalLanguage[]', lang));
  return params;
}

// Detect a series' origin from its original language + tags so cards can show
// a badge (Manhwa / Manhua / Webtoon).
function detectOrigin(originalLanguage: string, tagNames: string[]): string {
  if (originalLanguage === 'ko') return 'manhwa';
  if (originalLanguage === 'zh' || originalLanguage === 'zh-hk') return 'manhua';
  if (tagNames.some((t) => t === 'Webtoon' || t === 'Web Comic' || t === 'Long Strip')) return 'webtoon';
  return 'manga';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function localizedTagName(tag: any): string {
  return String(tag?.attributes?.name?.en || Object.values(tag?.attributes?.name || {})[0] || '');
}

const HEADERS: Record<string, string> = {
  Accept: 'application/json',
};

let lastRequestAt = 0;

// MangaDex allows ~5 requests/second per IP. Space requests out and retry on 429/5xx.
async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, 120 - (now - lastRequestAt));
  lastRequestAt = Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

async function mdFetch(url: string): Promise<Response> {
  await throttle();
  let res: Response | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      res = await fetch(url, { headers: HEADERS });
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      continue;
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After')) || 1000;
      await new Promise((r) => setTimeout(r, retryAfter * (attempt + 1)));
      continue;
    }
    if (res.status >= 500 && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`MangaDex API error: ${res.status}`);
    return res;
  }
  throw new Error(`MangaDex API request failed (${res?.status || 'network error'})`);
}

// MangaDex localizes most fields; pick a sane title/description.
function localizedText(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: any,
  fallback = ''
): string {
  if (!obj) return fallback;
  for (const lang of ['en', 'ja', 'ko', 'zh']) {
    if (obj[lang]) return String(obj[lang]);
  }
  const first = Object.values(obj).find((v) => v);
  return first ? String(first) : fallback;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function relationshipName(dto: any, type: string): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rel = (dto?.relationships || []).find((r: any) => r.type === type);
  return rel?.attributes?.name;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function coverFileName(dto: any): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rel = (dto?.relationships || []).find((r: any) => r.type === 'cover_art');
  return rel?.attributes?.fileName;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapManga(dto: any): MangaItem {
  const attrs = dto?.attributes || {};
  const title = localizedText(attrs.title, 'Untitled Manga');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const altTitles: any[] = attrs.altTitles || [];
  const alt = altTitles.map((t) => localizedText(t)).find((t) => t && t !== title);
  const tagNames: string[] = (attrs.tags || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((t: any) => localizedText(t?.attributes?.name))
    .filter(Boolean);
  return {
    id: dto?.id,
    title,
    translatedTitle: alt,
    description: localizedText(attrs.description, 'No description provided.'),
    coverUrl: coverFileName(dto)
      ? imgUrl(`${IMAGE_BASE}/covers/${dto.id}/${coverFileName(dto)}.256.jpg`)
      : '',
    status: attrs.status || 'unknown',
    tags: tagNames,
    year: attrs.year || undefined,
    author: relationshipName(dto, 'author'),
    artist: relationshipName(dto, 'artist'),
    origin: detectOrigin(attrs.originalLanguage || '', tagNames),
  };
}

// Shared query bits: English-translated, non-adult content, with covers/people.
const COMMON_PARAMS = [
  'contentRating[]=safe',
  'contentRating[]=suggestive',
  'availableTranslatedLanguage[]=en',
  'includes[]=cover_art',
  'includes[]=author',
  'includes[]=artist',
];

// Most-followed series — used as the "Suggestions" feed when the app opens.
export async function getMangaSuggestions(
  limit: number = 18,
  offset: number = 0,
  origin: MangaOrigin = 'all'
): Promise<MangaItem[]> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  params.set('order[followedCount]', 'desc');
  COMMON_PARAMS.forEach((p) => {
    const [k, v] = p.split('=');
    params.append(k, v);
  });
  const originParams = await originFilterParams(origin);
  originParams.forEach((v, k) => params.append(k, v));
  const res = await mdFetch(apiUrl(`/manga?${params.toString()}`));
  const json = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (json?.data || []).map(mapManga);
}

export async function searchManga(
  query: string = '',
  limit: number = 18,
  translatedSearch: boolean = true,
  offset: number = 0,
  origin: MangaOrigin = 'all'
): Promise<MangaItem[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set('title', query.trim());
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  params.set('order[relevance]', 'desc');
  COMMON_PARAMS.forEach((p) => {
    const [k, v] = p.split('=');
    params.append(k, v);
  });
  const originParams = await originFilterParams(origin);
  originParams.forEach((v, k) => params.append(k, v));
  const res = await mdFetch(apiUrl(`/manga?${params.toString()}`));
  const json = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let list = (json?.data || []).map(mapManga);

  // When translated search is off, only keep results whose English title matches.
  if (!translatedSearch && query.trim()) {
    const q = query.trim().toLowerCase();
    list = list.filter((m) => m.title.toLowerCase().includes(q));
  }

  return list;
}

// Search results are already restricted to manga with English chapters, so the
// "English available" badge is always accurate without extra feed requests.
export async function mangaHasEnglishChapters(_mangaId: string): Promise<boolean> {
  return true;
}

export interface ChapterListResult {
  chapters: ChapterItem[];
  languages: string[];
}

// Fetches the full English chapter list for a manga, walking the feed's offset
// pagination. Chapters are ordered by number ascending.
export async function getMangaChapters(mangaId: string): Promise<ChapterListResult> {
  const chapters: ChapterItem[] = [];
  const pageSize = 500;
  let offset = 0;

  for (let page = 0; page < 6; page++) {
    const params = new URLSearchParams();
    params.set('translatedLanguage[]', 'en');
    params.set('order[chapter]', 'asc');
    params.set('limit', String(pageSize));
    params.set('offset', String(offset));
    params.set('includes[]', 'scanlation_group');
    const res = await mdFetch(apiUrl(`/manga/${mangaId}/feed?${params.toString()}`));
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = json?.data || [];
    if (data.length === 0) break;

    for (const ch of data) {
      const attrs = ch?.attributes || {};
      chapters.push({
        id: ch?.id,
        title: attrs.title || '',
        chapterNumber: attrs.chapter != null ? String(attrs.chapter) : '',
        volume: attrs.volume != null ? String(attrs.volume) : '',
        pages: attrs.pages || 0,
        scanlationGroup: relationshipName(ch, 'scanlation_group') || '',
        publishAt: attrs.publishAt || '',
        language: attrs.translatedLanguage || 'en',
        externalUrl: attrs.externalUrl || undefined,
      });
    }

    const total = json?.total ?? data.length;
    offset += data.length;
    if (offset >= total) break;
  }

  chapters.sort((a, b) => (parseFloat(a.chapterNumber) || 0) - (parseFloat(b.chapterNumber) || 0));
  const languages = [...new Set(chapters.map((c) => c.language))];
  return { chapters, languages };
}

export async function getChapterPages(chapterId: string): Promise<ChapterPagesData> {
  const res = await mdFetch(apiUrl(`/at-home/server/${chapterId}`));
  const json = await res.json();
  const baseUrl = json?.baseUrl;
  const hash = json?.chapter?.hash;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const files: string[] = json?.chapter?.data || [];
  if (!baseUrl || !hash || files.length === 0) {
    throw new Error('This chapter has no readable pages.');
  }

  const pages = files.map((f: string) => imgUrl(`${baseUrl}/data/${hash}/${f}`));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataSaver = (json?.chapter?.['data-saver'] || []) as string[];
  const dataSaverPages = dataSaver.map((f: string) => imgUrl(`${baseUrl}/data-saver/${hash}/${f}`));

  return {
    chapterId,
    baseUrl,
    hash,
    pages,
    dataSaverPages,
  };
}
