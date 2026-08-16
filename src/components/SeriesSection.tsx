import { useEffect, useState } from 'react';
import { Search, Play, ChevronLeft, Star, Calendar, RefreshCw, AlertTriangle, MonitorPlay, Clapperboard, Layers } from 'lucide-react';
import { EmbedPlayer } from './EmbedPlayer';
import {
  SeriesItem,
  SeriesDetails,
  getPopularSeries,
  searchSeries,
  getSeriesDetails,
  buildSeriesServers,
} from '../services/series';
import { MovieServer, ServerStatus, pickBestMovieServer, getActiveMovieServerId } from '../services/movies';

interface PlayingEpisode {
  series: SeriesItem;
  season: number;
  episode: number;
}

export function SeriesSection() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SeriesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<SeriesItem | null>(null);
  const [details, setDetails] = useState<SeriesDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [playing, setPlaying] = useState<PlayingEpisode | null>(null);
  const [servers, setServers] = useState<MovieServer[]>([]);
  const [statuses, setStatuses] = useState<ServerStatus[] | null>(null);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  // Load the trending feed when the section opens.
  useEffect(() => {
    (async () => {
      try {
        const list = await getPopularSeries(24);
        setResults(list);
      } catch (err) {
        console.error('[Series] Failed to load trending:', err);
        setError('Could not load trending series. Check your connection and try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSearch = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    try {
      const list = await searchSeries(trimmed);
      setResults(list);
    } catch (err) {
      console.error('[Series] Search failed:', err);
      setError('Search failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (item: SeriesItem) => {
    setSelected(item);
    setDetails(null);
    setDetailLoading(true);
    try {
      const d = await getSeriesDetails(item.id);
      setDetails(d);
    } catch (err) {
      console.error('[Series] Failed to load details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const scanServers = async (ep: PlayingEpisode) => {
    const list = buildSeriesServers(ep.series, ep.season, ep.episode);
    setServers(list);
    setScanning(true);
    setStatuses(null);
    try {
      const result = await pickBestMovieServer(list);
      setStatuses(result);
      const best = getActiveMovieServerId();
      setActiveServerId(best || result.find((s) => s.ok)?.id || null);
    } catch (err) {
      console.error('[Series] server scan failed:', err);
      setStatuses(
        list.map((s) => ({ ...s, ok: false, latencyMs: null, error: 'unreachable' }))
      );
    } finally {
      setScanning(false);
    }
  };

  const handlePlay = async (series: SeriesItem, season: number, episode: number) => {
    const ep = { series, season, episode };
    setPlaying(ep);
    setActiveServerId(null);
    await scanServers(ep);
  };

  // ---------- Player view ----------
  if (playing) {
    const epLabel = `S${String(playing.season).padStart(2, '0')}E${String(playing.episode).padStart(2, '0')}`;
    return (
      <EmbedPlayer
        title={`${playing.series.title} • ${epLabel}`}
        backLabel="Back to Series"
        servers={servers}
        statuses={statuses}
        activeServerId={activeServerId}
        scanning={scanning}
        onBack={() => { setPlaying(null); setServers([]); setStatuses(null); setActiveServerId(null); }}
        onSelectServer={setActiveServerId}
        onRescan={() => scanServers(playing)}
      />
    );
  }

  // ---------- Detail view ----------
  if (selected) {
    return (
      <div id="series-detail-view" className="flex flex-col h-full rounded-xs border border-white/10 bg-[#0a0a0a] text-[#e0e0e0] overflow-hidden shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-[#0d0d0d] border-b border-white/10">
          <button
            onClick={() => setSelected(null)}
            className="px-3 py-1.5 rounded-xs border border-white/20 hover:bg-white/10 text-white transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Browse
          </button>
          <span className="font-serif italic text-sm text-white truncate max-w-[160px] sm:max-w-md">
            {selected.title}
          </span>
          {details && details.seasons.length > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">
              {details.seasons.length} Season{details.seasons.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="relative">
            {selected.backgroundUrl && (
              <img
                src={selected.backgroundUrl}
                alt=""
                className="w-full h-40 sm:h-56 object-cover opacity-30"
                loading="lazy"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 pb-4 flex items-end gap-4">
              {selected.coverUrl ? (
                <img
                  src={selected.coverUrl}
                  alt={selected.title}
                  className="w-24 h-36 sm:w-28 sm:h-40 rounded-xs border border-white/10 object-cover shadow-2xl"
                  loading="lazy"
                />
              ) : (
                <div className="w-24 h-36 sm:w-28 sm:h-40 flex items-center justify-center bg-[#141414] rounded-xs border border-white/10">
                  <Clapperboard className="w-8 h-8 text-[#404040]" />
                </div>
              )}
              <div className="min-w-0 pb-1">
                <h2 className="font-serif italic text-lg sm:text-2xl text-white leading-tight">
                  {selected.title}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {selected.rating && (
                    <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 rounded-xs">
                      <Star className="w-3 h-3 text-yellow-400" /> {selected.rating}
                    </span>
                  )}
                  {selected.year && (
                    <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 rounded-xs">
                      <Calendar className="w-3 h-3 text-red-500" /> {selected.year}
                    </span>
                  )}
                  {selected.runtime && (
                    <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 rounded-xs">
                      {selected.runtime}
                    </span>
                  )}
                  {selected.country && (
                    <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 rounded-xs">
                      {selected.country}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-5 space-y-5">
            {detailLoading ? (
              <p className="text-xs text-[#808080] flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-500" /> Loading episodes...
              </p>
            ) : (
              <>
                <p className="text-[13px] leading-relaxed text-[#c0c0c0]">{selected.description}</p>

                {selected.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.genres.map((g) => (
                      <span key={g} className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 text-[#a0a0a0] rounded-xs">
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                {details && details.seasons.length > 0 ? (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white mb-3 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-red-500" /> Episodes
                    </h3>
                    <div className="space-y-6">
                      {details.seasons.map((season) => (
                        <div key={season.number}>
                          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a0a0a0] mb-2">
                            Season {season.number}
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {season.episodes.map((ep) => (
                              <button
                                key={ep.id}
                                onClick={() => handlePlay(selected, season.number, ep.number)}
                                className="group flex items-center gap-2.5 px-3 py-2.5 rounded-xs border border-white/10 bg-white/5 hover:border-red-500/60 hover:bg-white/10 text-left transition-all"
                              >
                                <span className="flex-shrink-0 w-9 h-9 rounded-xs bg-[#141414] border border-white/10 flex items-center justify-center group-hover:bg-red-600 group-hover:border-red-600 transition-colors">
                                  <Play className="w-3.5 h-3.5 text-[#a0a0a0] group-hover:text-white" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-[10px] font-bold uppercase tracking-widest text-red-500">
                                    E{String(ep.number).padStart(2, '0')}
                                  </span>
                                  <span className="block text-[11px] text-[#e0e0e0] leading-tight line-clamp-1">
                                    {ep.title}
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-[#a0a0a0]">
                    <MonitorPlay className="w-8 h-8 text-red-500" />
                    <span className="text-xs uppercase tracking-widest">No episodes found</span>
                    <span className="text-[11px] opacity-70">Cinemeta did not return episode data for this series.</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Search / Browse view ----------
  return (
    <div id="series-search-view" className="flex flex-col h-full rounded-xs border border-white/10 bg-[#0a0a0a] text-[#e0e0e0] overflow-hidden shadow-2xl">
      <div className="p-4 sm:p-5 border-b border-white/10 bg-[#0d0d0d] flex flex-wrap gap-3 items-center justify-between">
        <div className="flex-1 min-w-0 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#808080]" />
          <input
            id="series-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
            placeholder="Search series (e.g. Breaking Bad, Game of Thrones)..."
            className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xs border border-white/10 bg-[#141414] text-[#e0e0e0] placeholder-[#606060] focus:outline-none focus:border-red-500 transition-colors"
          />
        </div>
        <button
          onClick={() => handleSearch(query)}
          className="px-4 py-2 bg-white text-black font-bold uppercase text-[10px] tracking-[0.15em] hover:bg-red-500 hover:text-white rounded-xs transition-colors"
        >
          Search
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-[#a0a0a0]">
            <RefreshCw className="w-8 h-8 animate-spin text-red-500" />
            <span className="text-xs uppercase tracking-widest font-mono">
              {query.trim() ? 'Searching series...' : 'Loading Trending...'}
            </span>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-[#a0a0a0] px-6">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <span className="text-xs uppercase tracking-widest text-center">{error}</span>
            <button
              onClick={() => handleSearch(query)}
              className="mt-2 px-4 py-2 bg-white text-black font-bold uppercase text-[10px] tracking-[0.15em] hover:bg-red-500 hover:text-white rounded-xs transition-colors"
            >
              Retry
            </button>
          </div>
        ) : results.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-[#a0a0a0]">
            <MonitorPlay className="w-10 h-10 text-red-500" />
            <span className="text-xs font-bold uppercase tracking-widest">No series found</span>
            <span className="text-[11px] opacity-70">Try a different search term.</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
            {results.map((series) => (
              <button
                key={series.id}
                onClick={() => handleSelect(series)}
                className="group text-left flex flex-col rounded-xs overflow-hidden border border-white/10 bg-white/5 hover:border-red-500/60 hover:bg-white/10 transition-all"
              >
                <div className="relative aspect-[2/3] overflow-hidden">
                  {series.coverUrl ? (
                    <img
                      src={series.coverUrl}
                      alt={series.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#141414]">
                      <Clapperboard className="w-8 h-8 text-[#404040]" />
                    </div>
                  )}
                  {series.rating && (
                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-black/70 backdrop-blur rounded-xs flex items-center gap-0.5 text-yellow-300">
                      <Star className="w-2.5 h-2.5" /> {series.rating}
                    </span>
                  )}
                  {series.year && (
                    <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-black/70 backdrop-blur rounded-xs text-white">
                      {series.year}
                    </span>
                  )}
                </div>
                <div className="p-2.5 flex flex-col flex-1 min-w-0">
                  <span className="text-[11px] font-semibold text-[#e0e0e0] leading-tight line-clamp-2 group-hover:text-white">
                    {series.title}
                  </span>
                  <span className="text-[9px] uppercase tracking-widest opacity-40 mt-1 truncate">
                    {series.genres[0] || 'Series'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
