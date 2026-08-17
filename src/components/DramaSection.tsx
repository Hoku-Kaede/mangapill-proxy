import { useEffect, useState } from 'react';
import {
  Search,
  ChevronLeft,
  AlertTriangle,
  Tv,
  Globe,
  ExternalLink,
  Clock,
  Film,
  RefreshCw,
} from 'lucide-react';
import {
  DramaItem,
  DramaDetail,
  searchDramas,
  listDramas,
  getDramaDetail,
  DRAMA_COUNTRIES,
  DRAMA_STATUS,
} from '../services/kisskh';

export function DramaSection() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DramaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [countryFilter, setCountryFilter] = useState(0);
  const [statusFilter, setStatusFilter] = useState(0);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const [selected, setSelected] = useState<DramaDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [playing, setPlaying] = useState<{ drama: DramaDetail; episode: { id: number; number: number } } | null>(null);

  const PAGE_SIZE = 20;

  // Load initial feed
  useEffect(() => {
    (async () => {
      try {
        const { dramas, total: t } = await listDramas(1, PAGE_SIZE);
        setResults(dramas);
        setTotal(t);
        setPage(1);
      } catch (err) {
        console.error('[Drama] Failed to load:', err);
        setError('Could not load dramas. Check your connection and try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSearch = async (term: string = query) => {
    setLoading(true);
    setError('');
    setPage(1);
    try {
      if (term.trim()) {
        const list = await searchDramas(term);
        setResults(list);
        setTotal(list.length);
      } else {
        const { dramas, total: t } = await listDramas(1, PAGE_SIZE, countryFilter, statusFilter);
        setResults(dramas);
        setTotal(t);
      }
    } catch (err) {
      console.error(err);
      setError('Could not reach KissKH. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = async (country: number, status: number) => {
    setCountryFilter(country);
    setStatusFilter(status);
    setQuery('');
    setLoading(true);
    setError('');
    setPage(1);
    try {
      const { dramas, total: t } = await listDramas(1, PAGE_SIZE, country, status);
      setResults(dramas);
      setTotal(t);
    } catch (err) {
      console.error(err);
      setError('Could not load dramas.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      if (query.trim()) {
        // Search doesn't paginate, skip
      } else {
        const { dramas } = await listDramas(nextPage, PAGE_SIZE, countryFilter, statusFilter);
        setResults((prev) => [...prev, ...dramas]);
        setPage(nextPage);
      }
    } catch {
      // skip
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSelect = async (drama: DramaItem) => {
    setDetailLoading(true);
    try {
      const detail = await getDramaDetail(drama.id);
      setSelected(detail);
    } catch (err) {
      console.error('[Drama] detail failed:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePlay = async (drama: DramaDetail, ep: { id: number; number: number }) => {
    setPlaying({ drama, episode: ep });
  };

  // ---------- Player view ----------
  if (playing) {
    const epNum = playing.episode.number;
    const watchUrl = `https://kisskh.is/Watch/${playing.drama.id}-ep-${epNum}`;
    return (
      <div className="flex flex-col h-full rounded-xs border border-white/10 bg-[#0a0a0a] text-[#e0e0e0] overflow-hidden shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-[#0d0d0d] border-b border-white/10">
          <button
            onClick={() => { setPlaying(null); }}
            className="px-3 py-1.5 rounded-xs border border-white/20 hover:bg-white/10 text-white transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Episodes
          </button>
          <span className="font-serif italic text-sm text-white truncate max-w-[160px] sm:max-w-md">
            {playing.drama.title} — Ep {epNum}
          </span>
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xs border border-white/20 hover:bg-white/10 text-white transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
          >
            <ExternalLink className="w-3.5 h-3.5" /> KissKH
          </a>
        </div>

        <div className="flex-1 min-h-0">
          <iframe
            src={watchUrl}
            title={`${playing.drama.title} Ep ${epNum}`}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen; picture-in-picture"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    );
  }

  // ---------- Detail view ----------
  if (selected) {
    return (
      <div className="flex flex-col h-full rounded-xs border border-white/10 bg-[#0a0a0a] text-[#e0e0e0] overflow-hidden shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-[#0d0d0d] border-b border-white/10">
          <button
            onClick={() => setSelected(null)}
            className="px-3 py-1.5 rounded-xs border border-white/20 hover:bg-white/10 text-white transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Browse
          </button>
          <span className="font-serif italic text-sm text-white truncate max-w-[200px] sm:max-w-md">
            {selected.title}
          </span>
          <a
            href={`https://kisskh.is/Explore?type=Drama&id=${selected.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xs border border-white/20 hover:bg-white/10 text-white transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
          >
            <ExternalLink className="w-3.5 h-3.5" /> KissKH
          </a>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="relative">
            {selected.thumbnail && (
              <img
                src={selected.thumbnail}
                alt=""
                className="w-full h-40 sm:h-56 object-cover opacity-30"
                loading="lazy"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 pb-4 flex items-end gap-4">
              {selected.thumbnail && (
                <img
                  src={selected.thumbnail}
                  alt={selected.title}
                  className="w-24 h-36 sm:w-28 sm:h-40 rounded-xs border border-white/10 object-cover shadow-2xl"
                  loading="lazy"
                />
              )}
              <div className="min-w-0 pb-1">
                <h2 className="font-serif italic text-lg sm:text-2xl text-white leading-tight">
                  {selected.title}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {selected.country && (
                    <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 rounded-xs">
                      <Globe className="w-3 h-3 text-red-500" /> {selected.country}
                    </span>
                  )}
                  {selected.status && (
                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded-xs border ${
                      selected.status === 'Completed'
                        ? 'bg-green-600/15 border-green-500/40 text-green-400'
                        : 'bg-blue-600/15 border-blue-500/40 text-blue-400'
                    }`}>
                      {selected.status}
                    </span>
                  )}
                  {selected.type && (
                    <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 rounded-xs">
                      {selected.type}
                    </span>
                  )}
                  {selected.releaseDate && (
                    <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 rounded-xs">
                      <Clock className="w-3 h-3 text-red-500" /> {selected.releaseDate.slice(0, 4)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-5 space-y-5">
            <p className="text-[13px] leading-relaxed text-[#c0c0c0]">{selected.description || 'No description available.'}</p>

            {/* Episode List */}
            <div className="border-t border-white/10 pt-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white">
                  Episodes ({selected.episodes.length})
                </h3>
              </div>
              {selected.episodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 text-[#a0a0a0] py-8">
                  <Film className="w-6 h-6 text-red-500" />
                  <span className="text-xs uppercase tracking-widest">No episodes available</span>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                  {selected.episodes.map((ep) => (
                    <button
                      key={ep.id}
                      onClick={() => handlePlay(selected, ep)}
                      className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-xs border border-white/10 bg-white/5 hover:bg-red-600 hover:border-red-500 hover:text-white text-[#a0a0a0] transition-all text-center"
                    >
                      Ep {ep.number}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Search / Browse view ----------
  return (
    <div className="flex flex-col h-full rounded-xs border border-white/10 bg-[#0a0a0a] text-[#e0e0e0] overflow-hidden shadow-2xl">
      <div className="p-4 sm:p-5 border-b border-white/10 bg-[#0d0d0d] flex flex-wrap gap-3 items-center justify-between">
        <div className="flex-1 min-w-0 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#808080]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
            placeholder="Search Asian dramas (e.g. Squid Game, CLOY, Boy Over Flowers)..."
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
        {/* Country Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#808080] flex items-center gap-1 mr-1 whitespace-nowrap">
            <Globe className="w-3 h-3 text-red-500" /> Country
          </span>
          {DRAMA_COUNTRIES.map((c) => (
            <button
              key={c.id}
              onClick={() => handleFilterChange(c.id, statusFilter)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-xs border transition-colors whitespace-nowrap ${
                countryFilter === c.id
                  ? 'bg-red-600 border-red-500 text-white'
                  : 'bg-white/5 border-white/10 text-[#a0a0a0] hover:text-white hover:border-red-500'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-4 mb-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#808080] flex items-center gap-1 mr-1 whitespace-nowrap">
            <Tv className="w-3 h-3 text-red-500" /> Status
          </span>
          {DRAMA_STATUS.map((s) => (
            <button
              key={s.id}
              onClick={() => handleFilterChange(countryFilter, s.id)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-xs border transition-colors whitespace-nowrap ${
                statusFilter === s.id
                  ? 'bg-red-600 border-red-500 text-white'
                  : 'bg-white/5 border-white/10 text-[#a0a0a0] hover:text-white hover:border-red-500'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-[#a0a0a0]">
            <RefreshCw className="w-8 h-8 animate-spin text-red-500" />
            <span className="text-xs uppercase tracking-widest font-mono">Loading dramas...</span>
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
            <Tv className="w-10 h-10 text-red-500" />
            <span className="text-xs font-bold uppercase tracking-widest">No dramas found</span>
            <span className="text-[11px] opacity-70">Try a different search or filter.</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white">
                {query ? `Results for "${query}"` : 'Browse Dramas'}
              </h3>
              <span className="text-[10px] opacity-40 uppercase tracking-widest">{results.length} titles</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
              {results.map((drama) => (
                <button
                  key={drama.id}
                  onClick={() => handleSelect(drama)}
                  className="group text-left flex flex-col rounded-xs overflow-hidden border border-white/10 bg-white/5 hover:border-red-500/60 hover:bg-white/10 transition-all"
                >
                  <div className="relative aspect-[2/3] overflow-hidden">
                    {drama.thumbnail ? (
                      <img
                        src={drama.thumbnail}
                        alt={drama.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#141414]">
                        <Tv className="w-8 h-8 text-[#404040]" />
                      </div>
                    )}
                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-black/70 backdrop-blur rounded-xs text-white">
                      {drama.episodesCount} eps
                    </span>
                    {drama.label && (
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-red-600/80 backdrop-blur rounded-xs text-white">
                        {drama.label}
                      </span>
                    )}
                  </div>
                  <div className="p-2.5 flex flex-col flex-1 min-w-0">
                    <span className="text-[11px] font-semibold text-[#e0e0e0] leading-tight line-clamp-2 group-hover:text-white">
                      {drama.title}
                    </span>
                    <span className="text-[9px] uppercase tracking-widest opacity-40 mt-1 flex items-center gap-1">
                      <Film className="w-2.5 h-2.5" /> Drama
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {total > results.length && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-5 py-2.5 bg-white text-black font-bold uppercase text-[10px] tracking-[0.15em] hover:bg-red-500 hover:text-white rounded-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingMore ? 'animate-spin' : ''}`} />
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
