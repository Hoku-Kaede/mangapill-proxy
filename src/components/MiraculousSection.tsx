import { useEffect, useRef, useState } from 'react';
import {
  Search,
  Play,
  ChevronLeft,
  RefreshCw,
  AlertTriangle,
  Tv,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
} from 'lucide-react';
import Hls from 'hls.js';
import {
  MiraculousEpisode,
  MiraculousVideoSource,
  getMiraculousEpisodes,
  getMiraculousSeasons,
  fetchMiraculousSources,
} from '../services/miraculous';

export function MiraculousSection() {
  const [episodes] = useState<MiraculousEpisode[]>(() => getMiraculousEpisodes());
  const [seasons] = useState<number[]>(() => getMiraculousSeasons());
  const [activeSeason, setActiveSeason] = useState(6);
  const [playing, setPlaying] = useState<MiraculousEpisode | null>(null);
  const [sources, setSources] = useState<MiraculousVideoSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const seasonEps = episodes.filter((e) => e.season === activeSeason);

  const handlePlay = async (ep: MiraculousEpisode) => {
    setPlaying(ep);
    setSources([]);
    setError('');
    setLoading(true);
    try {
      const srcs = await fetchMiraculousSources(ep.season, ep.episode);
      setSources(srcs);
    } catch (err) {
      console.error('[Miraculous] source fetch failed:', err);
      setError('Failed to load video sources. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // ---------- Player view ----------
  if (playing) {
    return (
      <div className="flex flex-col h-full rounded-xs border border-white/10 bg-[#0a0a0a] text-[#e0e0e0] overflow-hidden shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-[#0d0d0d] border-b border-white/10">
          <button
            onClick={() => { setPlaying(null); setSources([]); setError(''); }}
            className="px-3 py-1.5 rounded-xs border border-white/20 hover:bg-white/10 text-white transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Episodes
          </button>
          <span className="font-serif italic text-sm text-white truncate max-w-[160px] sm:max-w-md">
            S{playing.season}E{playing.episode} — {playing.title}
          </span>
        </div>

        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-[#a0a0a0]">
              <RefreshCw className="w-8 h-8 animate-spin text-red-500" />
              <span className="text-xs uppercase tracking-widest font-mono">Loading video...</span>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-[#a0a0a0] px-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <span className="text-xs uppercase tracking-widest text-center">{error}</span>
              <button
                onClick={() => handlePlay(playing)}
                className="mt-2 px-4 py-2 bg-white text-black font-bold uppercase text-[10px] tracking-[0.15em] hover:bg-red-500 hover:text-white rounded-xs transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <MiraculousPlayer sources={sources} episode={playing} />
          )}
        </div>
      </div>
    );
  }

  // ---------- Browse view ----------
  return (
    <div className="flex flex-col h-full rounded-xs border border-white/10 bg-[#0a0a0a] text-[#e0e0e0] overflow-hidden shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-[#0d0d0d] border-b border-white/10">
        <div className="flex items-center gap-3">
          <Tv className="w-4 h-4 text-red-500" />
          <span className="font-serif italic text-sm text-white">Miraculous Ladybug</span>
          <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-red-600/10 text-red-500 rounded-xs border border-red-600/30">
            Exclusive
          </span>
        </div>
        <span className="text-[10px] text-[#808080] uppercase tracking-widest">
          {episodes.length} episodes • 6 seasons
        </span>
      </div>

      {/* Season tabs */}
      <div className="flex items-center gap-1 px-4 sm:px-6 py-2 bg-[#0d0d0d] border-b border-white/5 overflow-x-auto">
        {seasons.map((s) => (
          <button
            key={s}
            onClick={() => setActiveSeason(s)}
            className={`px-3 py-1.5 rounded-xs text-[10px] font-bold uppercase tracking-widest transition-colors whitespace-nowrap ${
              activeSeason === s
                ? 'bg-red-600 text-white'
                : 'bg-white/5 text-[#808080] hover:bg-white/10 hover:text-white'
            }`}
          >
            Season {s}
          </button>
        ))}
      </div>

      {/* Episode grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
          {seasonEps.map((ep) => (
            <button
              key={`${ep.season}-${ep.episode}`}
              onClick={() => handlePlay(ep)}
              className="group text-left flex flex-col rounded-xs overflow-hidden border border-white/10 bg-white/5 hover:border-red-500/60 hover:bg-white/10 transition-all"
            >
              <div className="relative aspect-video overflow-hidden bg-[#141414]">
                <div className="w-full h-full flex items-center justify-center">
                  <Play className="w-8 h-8 text-red-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-black/70 backdrop-blur rounded-xs text-white">
                  S{ep.season}E{ep.episode}
                </span>
              </div>
              <div className="p-2.5 flex flex-col flex-1 min-w-0">
                <span className="text-[11px] font-semibold text-[#e0e0e0] leading-tight line-clamp-2 group-hover:text-white">
                  {ep.title}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- HLS Player sub-component ----------
function MiraculousPlayer({
  sources,
  episode,
}: {
  sources: MiraculousVideoSource[];
  episode: MiraculousEpisode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [activeSourceIdx, setActiveSourceIdx] = useState(0);

  const activeSrc = sources[activeSourceIdx];

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeSrc) return;

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const src = activeSrc.src;

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error('[MiraculousPlayer] HLS fatal error:', data);
          // Try next source
          if (activeSourceIdx < sources.length - 1) {
            setActiveSourceIdx((i) => i + 1);
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      video.src = src;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeSrc, activeSourceIdx, sources.length]);

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full h-full bg-black ${isFullscreen ? 'h-screen' : ''}`}>
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        playsInline
        muted={isMuted}
      />

      {/* Source switcher + controls overlay */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
        {sources.length > 1 && (
          <div className="flex items-center gap-1 bg-black/60 backdrop-blur rounded-xs px-1.5 py-1">
            {sources.map((s, i) => (
              <button
                key={i}
                onClick={() => setActiveSourceIdx(i)}
                className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded-xs transition-colors ${
                  i === activeSourceIdx
                    ? 'bg-red-600 text-white'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Srv {s.server || i + 1}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="p-1.5 bg-black/60 backdrop-blur rounded-xs text-white hover:bg-black/80 transition-colors"
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={toggleFullscreen}
          className="p-1.5 bg-black/60 backdrop-blur rounded-xs text-white hover:bg-black/80 transition-colors"
        >
          {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Episode info */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 z-10">
        <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">
          Season {episode.season} • Episode {episode.episode}
        </span>
        <h3 className="text-sm font-serif italic text-white mt-0.5">{episode.title}</h3>
      </div>
    </div>
  );
}
