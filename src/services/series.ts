import {
  MovieItem,
  MovieServer,
  ServerStatus,
  mapMeta,
  cinemeta,
  testMovieServers,
  pickBestMovieServer,
  getActiveMovieServerId,
} from './movies';

export type SeriesItem = MovieItem;

export interface SeriesEpisode {
  id: string; // `${season}-${episode}`
  number: number;
  title: string;
}

export interface SeriesSeason {
  number: number;
  episodes: SeriesEpisode[];
}

export interface SeriesDetails {
  item: SeriesItem;
  seasons: SeriesSeason[];
}

// Trending / popular series shown when the section opens.
export async function getPopularSeries(limit: number = 24): Promise<SeriesItem[]> {
  const json = await cinemeta('/catalog/series/top.json');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list: SeriesItem[] = (json?.metas || [])
    .map(mapMeta)
    .filter((m: SeriesItem) => m.id);
  return list.slice(0, limit);
}

export async function searchSeries(query: string, limit: number = 24): Promise<SeriesItem[]> {
  const q = encodeURIComponent(query.trim());
  const json = await cinemeta(`/catalog/series/top/search=${q}.json`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list: SeriesItem[] = (json?.metas || [])
    .map(mapMeta)
    .filter((m: SeriesItem) => m.id);
  return list.slice(0, limit);
}

// Full metadata plus episodes grouped by season. Cinemeta's `videos` array holds
// one entry per episode with season/episode numbers and names.
export async function getSeriesDetails(id: string): Promise<SeriesDetails> {
  const json = await cinemeta(`/meta/series/${encodeURIComponent(id)}.json`);
  const meta = json?.meta;
  if (!meta) throw new Error('Series details not found');

  const item: SeriesItem = mapMeta(meta);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const videos: any[] = meta?.videos || [];

  const bySeason = new Map<number, SeriesEpisode[]>();
  for (const v of videos) {
    const season = Number(v?.season ?? 0);
    const episode = Number(v?.episode ?? 0);
    if (!episode) continue;
    if (!bySeason.has(season)) bySeason.set(season, []);
    bySeason.get(season)!.push({
      id: `${season}-${episode}`,
      number: episode,
      title: v?.name ? String(v.name) : `Episode ${episode}`,
    });
  }

  const seasons: SeriesSeason[] = [...bySeason.entries()]
    .map(([number, episodes]) => ({
      number,
      episodes: episodes.sort((a, b) => a.number - b.number),
    }))
    .sort((a, b) => a.number - b.number);

  return { item, seasons };
}

// Embed providers for a specific episode. SuperEmbed (multiembed.mov) is the
// primary source; VidSrc / Vid-src accept both TMDB and IMDb ids; 2Embed needs
// a TMDB id so it's skipped when one is missing.
export function buildSeriesServers(
  series: SeriesItem,
  season: number,
  episode: number
): MovieServer[] {
  const id = series.tmdbId || series.id;
  const tmdbSuffix = series.tmdbId ? '&tmdb=1' : '';
  const servers: MovieServer[] = [
    {
      id: 'superembed-vip',
      name: 'SuperEmbed VIP',
      url: `https://multiembed.mov/directstream.php?video_id=${encodeURIComponent(id)}${tmdbSuffix}&s=${season}&e=${episode}`,
    },
    {
      id: 'superembed',
      name: 'SuperEmbed',
      url: `https://multiembed.mov/?video_id=${encodeURIComponent(id)}${tmdbSuffix}&s=${season}&e=${episode}`,
    },
    {
      id: 'vidsrc',
      name: 'VidSrc',
      url: `https://vidsrc.to/embed/tv/${encodeURIComponent(id)}/${season}/${episode}`,
    },
    {
      id: 'vidsrcto',
      name: 'Vid-src',
      url: `https://vid-src.top/embed/tv/${encodeURIComponent(id)}/${season}/${episode}`,
    },
  ];
  if (series.tmdbId) {
    servers.push({
      id: '2embed',
      name: '2Embed',
      url: `https://2embed.stream/embed/${series.tmdbId}?tmdb=${series.tmdbId}&season=${season}&episode=${episode}`,
    });
  }
  return servers;
}

export { testMovieServers, pickBestMovieServer, getActiveMovieServerId };
export type { MovieServer, ServerStatus };
