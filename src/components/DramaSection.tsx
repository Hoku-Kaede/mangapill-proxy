import { useEffect, useRef, useState } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Tv,
  Globe,
  ExternalLink,
  Clock,
  Film,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import {
  DramaItem,
  DramaDetail,
  searchDramas,
  listDramas,
  getDramaDetail,
  getShow,
  getLastUpdated,
  getTopRated,
  getMostViewed,
  DRAMA_COUNTRIES,
  DRAMA_STATUS,
} from '../services/kisskh';

export function DramaSection() {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DramaItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showFilters, setShowFilters] = useState(false);
  const [countryFilter, setCountryFilter] = useState(0);
  const [statusFilter, setStatusFilter] = useState(0);

  const [featured, setFeatured] = useState<DramaItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<DramaItem[]>([]);
  const [topRated, setTopRated] = useState<DramaItem[]>([]);
  const [mostViewed, setMostViewed] = useState<DramaItem[]>([]);

  const [selected, setSelected] = useState<DramaDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [playing, setPlaying] = useState<{ drama: DramaDetail; episode: { id: number; number: number } } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [f, l, t, m] = await Promise.all([
          getShow(),
          getLastUpdated(),
          getTopRated(),
          getMostViewed(),
        ]);
        setFeatured(f);
        setLastUpdated(l);
        setTopRated(t);
        setMostViewed(m);
      } catch (err) {
        console.error('[Drama] Failed to load homepage:', err);
        setError('Could not load dramas. Check your connection and try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSearch = async (term: string = query) => {
    const q = term.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const list = await searchDramas(q);
      setSearchResults(list);
    } catch {
      setError('Could not reach KissKH.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterBrowse = async () => {
    setLoading(true);
    setError('');
    try {
      const { dramas } = await listDramas(1, 60, countryFilter, statusFilter);
      setSearchResults(dramas);
    } catch {
      setError('Could not load dramas.');
    } finally {
      setLoading(false);
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

  const handlePlay = (drama: DramaDetail, ep: { id: number; number: number }) => {
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
            onClick={() => setPlaying(null)}
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
            <ChevronLeft className="w-3.5 h-3.5" /> Back
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
              <img src={selected.thumbnail} alt="" className="w-full h-40 sm:h-56 object-cover opacity-30" loading="lazy" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 pb-4 flex items-end gap-4">
              {selected.thumbnail && (
                <img src={selected.thumbnail} alt={selected.title} className="w-24 h-36 sm:w-28 sm:h-40 rounded-xs border border-white/10 object-cover shadow-2xl" loading="lazy" />
              )}
              <div className="min-w-0 pb-1">
                <h2 className="font-serif italic text-lg sm:text-2xl text-white leading-tight">{selected.title}</h2>
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
                    <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 rounded-xs">{selected.type}</span>
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
            <div className="border-t border-white/10 pt-5">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white mb-4">
                Episodes ({selected.episodes.length})
              </h3>
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

  // ---------- Homepage ----------
  const hasSearch = searchResults !== null;
  const showHomepage = !hasSearch && !loading && !error;

  return (
    <div className="flex flex-col h-full rounded-xs border border-white/10 bg-[#0a0a0a] text-[#e0e0e0] overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-white/10 bg-[#0d0d0d] flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-0 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#808080]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
            placeholder="Search Asian dramas..."
            className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xs border border-white/10 bg-[#141414] text-[#e0e0e0] placeholder-[#606060] focus:outline-none focus:border-red-500 transition-colors"
          />
        </div>
        <button
          onClick={() => handleSearch(query)}
          className="px-4 py-2 bg-white text-black font-bold uppercase text-[10px] tracking-[0.15em] hover:bg-red-500 hover:text-white rounded-xs transition-colors"
        >
          Search
        </button>
        <button
          onClick={() => { setShowFilters(!showFilters); }}
          className={`px-3 py-2 rounded-xs border transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${
            showFilters ? 'bg-red-600 border-red-500 text-white' : 'border-white/20 hover:bg-white/10 text-white'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
        </button>
        {hasSearch && (
          <button
            onClick={() => { setSearchResults(null); setQuery(''); }}
            className="px-3 py-2 rounded-xs border border-white/20 hover:bg-white/10 text-white transition-colors text-[10px] font-bold uppercase tracking-widest"
          >
            Home
          </button>
        )}
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="px-4 sm:px-5 py-3 border-b border-white/10 bg-[#0d0d0d] space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#808080] flex items-center gap-1 mr-1 whitespace-nowrap">
              <Globe className="w-3 h-3 text-red-500" /> Country
            </span>
            {DRAMA_COUNTRIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCountryFilter(c.id)}
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
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#808080] flex items-center gap-1 mr-1 whitespace-nowrap">
              <Tv className="w-3 h-3 text-red-500" /> Status
            </span>
            {DRAMA_STATUS.map((s) => (
              <button
                key={s.id}
                onClick={() => setStatusFilter(s.id)}
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
          <button
            onClick={handleFilterBrowse}
            className="px-4 py-1.5 bg-white text-black font-bold uppercase text-[10px] tracking-[0.15em] hover:bg-red-500 hover:text-white rounded-xs transition-colors"
          >
            Apply Filters
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && !showHomepage ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-[#a0a0a0]">
            <RefreshCw className="w-8 h-8 animate-spin text-red-500" />
            <span className="text-xs uppercase tracking-widest font-mono">Loading dramas...</span>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-[#a0a0a0] px-6">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <span className="text-xs uppercase tracking-widest text-center">{error}</span>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 bg-white text-black font-bold uppercase text-[10px] tracking-[0.15em] hover:bg-red-500 hover:text-white rounded-xs transition-colors"
            >
              Retry
            </button>
          </div>
        ) : hasSearch ? (
          <SearchResults results={searchResults} onSelect={handleSelect} />
        ) : showHomepage ? (
          <div className="pb-6">
            {featured.length > 0 && <CarouselSection title="Featured" items={featured} onSelect={handleSelect} />}
            {lastUpdated.length > 0 && <DramaRow title="Recently Updated" items={lastUpdated} onSelect={handleSelect} />}
            {topRated.length > 0 && <DramaRow title="Top Rated" items={topRated} onSelect={handleSelect} />}
            {mostViewed.length > 0 && <DramaRow title="Most Viewed" items={mostViewed} onSelect={handleSelect} />}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------- Search results grid ----------
function SearchResults({ results, onSelect }: { results: DramaItem[]; onSelect: (d: DramaItem) => void }) {
  if (results.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-[#a0a0a0]">
        <Tv className="w-10 h-10 text-red-500" />
        <span className="text-xs font-bold uppercase tracking-widest">No dramas found</span>
        <span className="text-[11px] opacity-70">Try a different search or filter.</span>
      </div>
    );
  }
  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white">{results.length} results</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
        {results.map((drama) => (
          <div key={drama.id}>
            <DramaCard drama={drama} onClick={() => onSelect(drama)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Featured carousel ----------
function CarouselSection({ title, items, onSelect }: { title: string; items: DramaItem[]; onSelect: (d: DramaItem) => void }) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setIdx((prev) => (prev + 1) % items.length);
    }, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [items.length]);

  const goTo = (i: number) => {
    setIdx(i);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    timerRef.current = setInterval(() => setIdx((prev) => (prev + 1) % items.length), 5000);
  };

  const prev = () => goTo((idx - 1 + items.length) % items.length);
  const next = () => goTo((idx + 1) % items.length);

  const current = items[idx];
  if (!current) return null;

  return (
    <div className="mb-6">
      <SectionHeader title={title} />
      <div className="relative group">
        <button
          onClick={prev}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/60 backdrop-blur rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={next}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/60 backdrop-blur rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div className="relative overflow-hidden cursor-pointer" onClick={() => onSelect(current)}>
          <div className="relative aspect-[16/7] sm:aspect-[16/6]">
            {current.thumbnail && (
              <img
                src={current.thumbnail}
                alt={current.title}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-red-400 mb-2 block">{title}</span>
              <h2 className="font-serif italic text-xl sm:text-3xl text-white leading-tight mb-2">{current.title}</h2>
              <span className="text-[10px] uppercase tracking-widest text-[#a0a0a0]">{current.episodesCount} episodes</span>
            </div>
          </div>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-1 rounded-full transition-all ${
                i === idx ? 'w-6 bg-red-500' : 'w-1.5 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Horizontal scroll row ----------
function DramaRow({ title, items, onSelect }: { title: string; items: DramaItem[]; onSelect: (d: DramaItem) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <div className="mb-6">
      <SectionHeader title={title} />
      <div className="relative group/row">
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 w-12 z-10 bg-gradient-to-r from-[#0a0a0a] to-transparent flex items-center justify-start pl-1 opacity-0 group-hover/row:opacity-100 transition-opacity"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 w-12 z-10 bg-gradient-to-l from-[#0a0a0a] to-transparent flex items-center justify-end pr-1 opacity-0 group-hover/row:opacity-100 transition-opacity"
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-1 px-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {items.map((drama) => (
            <div key={drama.id} className="snap-start shrink-0 w-[130px] sm:w-[150px]">
              <DramaCard drama={drama} onClick={() => onSelect(drama)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Section header ----------
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 px-4 sm:px-6 mb-3">
      <span className="w-1 h-4 bg-red-500 rounded-full" />
      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white">{title}</h3>
    </div>
  );
}

// ---------- Drama card ----------
function DramaCard({ drama, onClick }: { drama: DramaItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group text-left flex flex-col rounded-xs overflow-hidden border border-white/10 bg-white/5 hover:border-red-500/60 hover:bg-white/10 transition-all w-full"
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
        {drama.label && drama.label.trim() && (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-red-600/80 backdrop-blur rounded-xs text-white">
            {drama.label.trim()}
          </span>
        )}
      </div>
      <div className="p-2.5 flex flex-col flex-1 min-w-0">
        <span className="text-[11px] font-semibold text-[#e0e0e0] leading-tight line-clamp-2 group-hover:text-white">
          {drama.title}
        </span>
      </div>
    </button>
  );
}
