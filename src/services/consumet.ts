import { MangaItem, ChapterItem, ChapterPagesData } from '../types';

// Consumet-backed MangaPill provider (consumet-api.onrender.com). Used for
// licensed series that are absent from MangaDex's readable catalog (e.g.
// Nagatoro). Verified working end-to-end: search -> info -> read pages.
// The official api.consumet.org host is dead (DMCA'd), so we use the community
// Render mirror. Full docs: https://docs.consumet.org/rest-api/Manga/mangapill

const BASE = 'https://consumet-api.onrender.com';

// MangaPill images come from a hotlink-protected CDN that only serves requests
// carrying `Referer: https://mangapill.com/`. Browsers can't send that header,
// so images are relayed through the small Node proxy in server/proxy.mjs
// (deployed on Render). Keep the trailing `/image?url=`.
const MANGAPILL_IMAGE_PROXY = 'https://mangapill-image-proxy.onrender.com/image?url=';

function mangaPillImage(img: string): string {
  return MANGAPILL_IMAGE_PROXY ? MANGAPILL_IMAGE_PROXY + encodeURIComponent(img) : img;
}

async function consumetFetch(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`Consumet request failed (${res.status})`);
  }
  return res.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asText(value: any, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

// Search MangaPill by title. Returns bare MangaItem stubs (id, title, cover);
// metadata is filled in by getMangaPillInfo when the series is opened.
export async function searchMangaPill(query: string): Promise<MangaItem[]> {
  const json = await consumetFetch(`/manga/mangapill/${encodeURIComponent(query.trim())}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = (json as any)?.results || [];
  return results.map((r: { id?: string; title?: string; image?: string }): MangaItem => ({
    id: asText(r.id),
    title: asText(r.title),
    description: '',
    coverUrl: mangaPillImage(asText(r.image)),
    status: '',
    tags: [],
    source: 'mangapill',
  }));
}

// Fallback helper: find a series on MangaPill by title. Used when a MangaDex
// hit has no readable chapters (e.g. licensed titles absent from MangaDex).
export async function resolveMangaPillByTitle(title: string): Promise<MangaItem | null> {
  const results = await searchMangaPill(title);
  return results[0] || null;
}

// Fetch a series' full chapter list from MangaPill. The API returns chapters
// newest-first, so sort ascending for the reader.
export async function getMangaPillInfo(id: string): Promise<ChapterItem[]> {
  const json = await consumetFetch(`/manga/mangapill/info?id=${encodeURIComponent(id)}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chapters = ((json as any)?.chapters || []) as { id?: string; title?: string; chapter?: string }[];
  return chapters
    .map((c) => ({
      id: asText(c.id),
      title: asText(c.title),
      chapterNumber: asText(c.chapter),
      volume: '',
      pages: 0,
      publishAt: '',
      language: 'en',
      source: 'mangapill' as const,
    }))
    .sort((a, b) => chapterNumber(a) - chapterNumber(b));
}

function chapterNumber(chapter: ChapterItem): number {
  const n = parseFloat(chapter.chapterNumber);
  return Number.isFinite(n) ? n : 0;
}

// Fetch a single chapter's page images. Response is an array of {page, img}.
export async function getMangaPillChapterPages(chapterId: string): Promise<ChapterPagesData> {
  const json = await consumetFetch(`/manga/mangapill/read?chapterId=${encodeURIComponent(chapterId)}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pages = (json as any[]) || [];
  const imgs = pages.map((p) => mangaPillImage(asText(p?.img))).filter(Boolean);
  return {
    chapterId,
    baseUrl: '',
    hash: '',
    pages: imgs,
    dataSaverPages: [],
  };
}
