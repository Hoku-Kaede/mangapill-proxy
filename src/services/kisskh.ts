// KissKH Asian Drama service — browse, search, play

const PROXY = '/api/kisskh';

async function kfetch(path: string): Promise<any> {
  const res = await fetch(`${PROXY}${path}`);
  if (!res.ok) throw new Error(`KissKH error: ${res.status}`);
  return res.json();
}

export interface DramaItem {
  id: number;
  title: string;
  thumbnail: string;
  episodesCount: number;
  label: string;
}

export interface DramaDetail {
  id: number;
  title: string;
  thumbnail: string;
  description: string;
  country: string;
  status: string;
  type: string;
  releaseDate: string;
  episodesCount: number;
  episodes: { id: number; number: number; sub: number }[];
}

// Country filter IDs
export const DRAMA_COUNTRIES = [
  { id: 0, name: 'All' },
  { id: 1, name: 'China' },
  { id: 2, name: 'Korea' },
  { id: 3, name: 'Japan' },
  { id: 4, name: 'Hong Kong' },
  { id: 5, name: 'Thailand' },
] as const;

// Status filter IDs
export const DRAMA_STATUS = [
  { id: 0, name: 'All' },
  { id: 1, name: 'Airing' },
  { id: 2, name: 'Completed' },
] as const;

// Type filter IDs
export const DRAMA_TYPES = [
  { id: 0, name: 'All' },
  { id: 1, name: 'Series' },
  { id: 2, name: 'Movie' },
] as const;

export async function searchDramas(query: string): Promise<DramaItem[]> {
  const json = await kfetch(`?action=search&q=${encodeURIComponent(query)}`);
  return Array.isArray(json) ? json.map(mapDrama) : [];
}

export async function listDramas(
  page: number = 1,
  pageSize: number = 20,
  country: number = 0,
  status: number = 0,
  type: number = 0,
): Promise<{ dramas: DramaItem[]; total: number }> {
  const json = await kfetch(
    `?action=list&page=${page}&pageSize=${pageSize}&type=${type}&sub=0&country=${country}&status=${status}`
  );
  return {
    dramas: (json?.data || []).map(mapDrama),
    total: json?.totalCount || 0,
  };
}

export async function getDramaDetail(id: number): Promise<DramaDetail> {
  const json = await kfetch(`?action=drama&id=${id}`);
  return {
    id: json?.id || id,
    title: json?.title || 'Untitled',
    thumbnail: json?.thumbnail || '',
    description: json?.description || '',
    country: json?.country || '',
    status: json?.status || '',
    type: json?.type || '',
    releaseDate: json?.releaseDate || '',
    episodesCount: json?.episodesCount || 0,
    episodes: (json?.episodes || []).map((e: any) => ({
      id: e?.id || 0,
      number: e?.number || 0,
      sub: e?.sub || 0,
    })).sort((a: any, b: any) => a.number - b.number),
  };
}

export async function getShow(): Promise<DramaItem[]> {
  const json = await kfetch(`?action=show`);
  return (Array.isArray(json) ? json : []).map(mapDrama);
}

export async function getLastUpdated(): Promise<DramaItem[]> {
  const json = await kfetch(`?action=lastupdate`);
  return (Array.isArray(json) ? json : []).map(mapDrama);
}

export async function getTopRated(): Promise<DramaItem[]> {
  const json = await kfetch(`?action=toprating`);
  return (Array.isArray(json) ? json : []).map(mapDrama);
}

export async function getMostViewed(page: number = 1): Promise<DramaItem[]> {
  const json = await kfetch(`?action=mostview&page=${page}`);
  return (Array.isArray(json) ? json : []).map(mapDrama);
}

function mapDrama(dto: any): DramaItem {
  return {
    id: dto?.id || 0,
    title: dto?.title || 'Untitled',
    thumbnail: dto?.thumbnail || '',
    episodesCount: dto?.episodesCount || 0,
    label: dto?.label || '',
  };
}
