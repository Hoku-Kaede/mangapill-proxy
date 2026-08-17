import { useState } from 'react';
import { ChevronLeft, ExternalLink, RefreshCw, AlertTriangle, Globe } from 'lucide-react';
import {
  DramaDetail,
  getDramaDetail,
} from '../services/kisskh';

export function DramaSection() {
  const [selected, setSelected] = useState<DramaDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [playing, setPlaying] = useState<{ drama: DramaDetail; episode: { id: number; number: number } } | null>(null);
  const [homeError, setHomeError] = useState(false);

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
                <span className="text-xs uppercase tracking-widest text-[#a0a0a0]">No episodes available</span>
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

  // ---------- Home: iframe of kisskh.is ----------
  if (homeError) {
    return (
      <div className="flex flex-col h-full rounded-xs border border-white/10 bg-[#0a0a0a] text-[#e0e0e0] overflow-hidden shadow-2xl">
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#a0a0a0] px-6">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <span className="text-xs uppercase tracking-widest text-center">Could not load KissKH</span>
          <button
            onClick={() => setHomeError(false)}
            className="mt-2 px-4 py-2 bg-white text-black font-bold uppercase text-[10px] tracking-[0.15em] hover:bg-red-500 hover:text-white rounded-xs transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full rounded-xs border border-white/10 bg-[#0a0a0a] text-[#e0e0e0] overflow-hidden shadow-2xl">
      <iframe
        src="https://kisskh.is"
        title="KissKH"
        className="w-full h-full border-0"
        allow="autoplay; fullscreen; picture-in-picture"
        referrerPolicy="no-referrer"
        onError={() => setHomeError(true)}
      />
    </div>
  );
}
