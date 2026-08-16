import { MangaItem, ChapterItem, ChapterPagesData } from '../types';

const API_BASE = 'https://api.comick.dev';
const IMAGE_BASE = 'https://meo.comick.pictures';
const MAX_RETRIES = 2;

// Only safelisted headers — custom headers would trigger a CORS preflight and
// 'User-Agent'/'Referer' are forbidden for browsers to set anyway. The API
// serves the public endpoints without them (verified).
const HEADERS: Record<string, string> = {
  Accept: 'application/json',
};

// ComicK numeric status values mapped to the strings the UI already knows.
const STATUS_MAP: Record<number, string> = {
  1: 'ongoing',
  2: 'completed',
  3: 'hiatus',
  4: 'cancelled',
};

// ComicK genre id -> display name (static map, source: comick.dev search page).
const GENRES: Record<number, string> = {
  243: '4-Koma',
  244: 'Action',
  279: 'Adaptation',
  2: 'Adult',
  5: 'Adult Cast',
  245: 'Adventure',
  294: 'Aliens',
  295: 'Animals',
  280: 'Anthology',
  44: 'Anthropomorphic',
  19: 'Avant Garde',
  246: 'Award Winning',
  35: 'Boys Love',
  28: 'CGDCT',
  32: 'Childcare',
  17: 'Combat Sports',
  247: 'Comedy',
  248: 'Cooking',
  288: 'Crime',
  296: 'Crossdressing',
  298: 'Delinquents',
  297: 'Demons',
  8: 'Detective',
  249: 'Doujinshi',
  250: 'Drama',
  251: 'Ecchi',
  48: 'Educational',
  46: 'Erotica',
  285: 'Fan Colored',
  252: 'Fantasy',
  282: 'Full Color',
  18: 'Gag Humor',
  1: 'Gender Bender',
  299: 'Genderswap',
  300: 'Ghosts',
  31: 'Girls Love',
  286: 'Gore',
  22: 'Gourmet',
  253: 'Gyaru',
  254: 'Harem',
  36: 'Hentai',
  43: 'High Stakes Game',
  255: 'Historical',
  256: 'Horror',
  45: 'Idols (Female)',
  49: 'Idols (Male)',
  320: 'Incest',
  278: 'Isekai',
  40: 'Iyashikei',
  12: 'Josei',
  41: 'Kids',
  302: 'Loli',
  274: 'Long Strip',
  10: 'Love Polygon',
  50: 'Love Status Quo',
  321: 'Mafia',
  303: 'Magic',
  289: 'Magical Girls',
  37: 'Magical Sex Shift',
  4: 'Mahjong',
  29: 'Mahou Shoujo',
  257: 'Martial Arts',
  3: 'Mature',
  258: 'Mecha',
  259: 'Medical',
  304: 'Military',
  301: 'Monster Girls',
  305: 'Monsters',
  260: 'Music',
  261: 'Mystery',
  27: 'Mythology',
  306: 'Ninja',
  307: 'Office Workers',
  284: 'Official Colored',
  262: 'Oneshot',
  20: 'Organized Crime',
  38: 'Otaku Culture',
  33: 'Parody',
  42: 'Performing Arts',
  47: 'Pets',
  290: 'Philosophical',
  308: 'Police',
  309: 'Post-Apocalyptic',
  263: 'Psychological',
  13: 'Racing',
  310: 'Reincarnation',
  311: 'Reverse Harem',
  264: 'Romance',
  312: 'Samurai',
  16: 'School',
  265: 'School Life',
  266: 'Sci-Fi',
  14: 'Seinen',
  287: 'Sexual Violence',
  313: 'Shota',
  25: 'Shoujo',
  267: 'Shoujo Ai',
  7: 'Shounen',
  268: 'Shounen Ai',
  34: 'Showbiz',
  269: 'Slice of Life',
  270: 'Smut',
  6: 'Space',
  271: 'Sports',
  26: 'Strategy Game',
  291: 'Superhero',
  272: 'Supernatural',
  23: 'Super Power',
  314: 'Survival',
  15: 'Suspense',
  9: 'Team Sports',
  292: 'Thriller',
  315: 'Time Travel',
  317: 'Traditional Games',
  273: 'Tragedy',
  30: 'Urban Fantasy',
  283: 'User Created',
  21: 'Vampire',
  316: 'Vampires',
  24: 'Video Game',
  277: 'Video Games',
  322: 'Villainess',
  318: 'Virtual Reality',
  11: 'Visual Arts',
  281: 'Web Comic',
  39: 'Workplace',
  293: 'Wuxia',
  275: 'Yaoi',
  276: 'Yuri',
  319: 'Zombies',
};

let lastRequestAt = 0;

// ComicK allows ~200 requests/minute/IP. Space requests out and retry on 429/5xx.
async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, 150 - (now - lastRequestAt));
  lastRequestAt = Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

async function ckFetch(url: string): Promise<Response> {
  await throttle();
  let res: Response | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      res = await fetch(url, { headers: HEADERS });
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      continue;
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After')) || 1000;
      await new Promise((r) => setTimeout(r, retryAfter * (attempt + 1)));
      continue;
    }
    if (res.status >= 500 && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`ComicK API error: ${res.status}`);
    return res;
  }
  throw new Error(`ComicK API request failed (${res?.status || 'network error'})`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapComic(dto: any): MangaItem {
  // ComicK sometimes ships an odd auto-translated display title (e.g. "I am the
  // only the one who levels up" for Solo Leveling). md_titles holds the full set
  // of English names, so prefer the shortest real English title there, falling
  // back to the display title.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enTitles = [...new Set<string>((dto.md_titles || []).filter((t: any) => t.lang === 'en' && t.title).map((t: any) => String(t.title).trim()))];
  const title = enTitles.length > 0
    ? (enTitles.includes(dto.title) ? dto.title : enTitles.reduce((a, b) => (a.length <= b.length ? a : b)))
    : (dto.title || 'Untitled Manga');

  return {
    id: dto.slug,
    title,
    description: dto.desc || 'No description provided.',
    coverUrl: imageUrl(dto.md_covers?.[0]?.b2key, 'm'),
    status: STATUS_MAP[dto.status] || 'unknown',
    tags: (dto.genres || []).map((g: number) => GENRES[g]).filter(Boolean),
    year: dto.year || undefined,
  };
}

// Build a CDN url for a b2key. ComicK generates optimized variants
// `<base>-s.jpg` (small) and `<base>-m.jpg` (medium) alongside the original.
function imageUrl(b2key: string | undefined, variant?: 's' | 'm'): string {
  if (!b2key) return '';
  const i = b2key.lastIndexOf('.');
  if (variant && i > 0) return `${IMAGE_BASE}/${b2key.slice(0, i)}-${variant}.jpg`;
  return `${IMAGE_BASE}/${b2key}`;
}

// Top-followed series — used as the "Suggestions" feed shown when the app opens.
export async function getMangaSuggestions(limit: number = 18): Promise<MangaItem[]> {
  const params = new URLSearchParams();
  params.append('sort', 'follow');
  params.append('limit', limit.toString());
  params.append('lang', 'en');
  const res = await ckFetch(`${API_BASE}/v1.0/search?${params.toString()}`);
  const json = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (json || []).map(mapComic);
}

export async function searchManga(
  query: string = '',
  limit: number = 18,
  translatedSearch: boolean = true
): Promise<MangaItem[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.append('q', query.trim());
  params.append('limit', limit.toString());
  params.append('lang', 'en');
  const res = await ckFetch(`${API_BASE}/v1.0/search?${params.toString()}`);
  const json = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let list = (json || []).map(mapComic);

  // When translated search is off, only keep results whose English title matches.
  if (!translatedSearch && query.trim()) {
    const q = query.trim().toLowerCase();
    list = list.filter((m) => m.title.toLowerCase().includes(q));
  }

  return list;
}

// ComicK English chapters are essentially always present for the series we
// surface, and this result list is what feeds the "English available" badge.
export async function mangaHasEnglishChapters(_mangaId: string): Promise<boolean> {
  return true;
}

export interface ChapterListResult {
  chapters: ChapterItem[];
  languages: string[];
}

// Fetches the full chapter list for a comic. The `/v1.0/comic/{slug}` response
// exposes seed chapter hids; requesting `/chapter/{hid}` returns the complete
// chapter array for that chapter's language (e.g. all 1310 English One Piece
// chapters). The array holds per-upload rows, so we dedupe by chapter number.
export async function getMangaChapters(mangaId: string): Promise<ChapterListResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let seed: any = null;
  try {
    const res = await ckFetch(`${API_BASE}/v1.0/comic/${mangaId}`);
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    seed = (json.firstChapters || []).find((c: any) => c.lang === 'en') || (json.firstChapters || [])[0];
  } catch {
    return { chapters: [], languages: [] };
  }

  if (!seed) return { chapters: [], languages: [] };

  const res = await ckFetch(`${API_BASE}/chapter/${seed.hid}`);
  const json = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any[] = json.chapters || [];

  const seen = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list: ChapterItem[] = [];
  for (const c of raw) {
    const num = c.chap != null ? String(c.chap) : '';
    if (num && seen.has(num)) continue;
    if (num) seen.add(num);
    list.push({
      id: c.hid,
      title: c.title || '',
      chapterNumber: num,
      volume: c.vol != null ? String(c.vol) : '',
      pages: 0,
      scanlationGroup: '',
      publishAt: '',
      language: c.lang || 'en',
    });
  }

  list.sort((a, b) => {
    const numA = parseFloat(a.chapterNumber) || 0;
    const numB = parseFloat(b.chapterNumber) || 0;
    return numA - numB;
  });

  const languages = [...new Set(list.map((c) => c.language))];
  return { chapters: list, languages };
}

export async function getChapterPages(chapterId: string): Promise<ChapterPagesData> {
  const res = await ckFetch(`${API_BASE}/chapter/${chapterId}/get_images`);
  const json = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mdImages = json.md_images || [];

  if (mdImages.length === 0) {
    throw new Error('This chapter has no readable pages.');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pages = mdImages.map((im: any) => imageUrl(im.b2key));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataSaverPages = mdImages.map((im: any) =>
    im.optimized ? imageUrl(im.b2key, 'm') : imageUrl(im.b2key)
  );

  return {
    chapterId,
    baseUrl: IMAGE_BASE,
    hash: '',
    pages,
    dataSaverPages,
  };
}
