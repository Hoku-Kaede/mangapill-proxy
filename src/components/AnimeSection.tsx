import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Search,
  Play,
  ChevronLeft,
  Star,
  Calendar,
  Layers,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  Clapperboard,
  Tv,
  Settings,
  X,
  CheckCircle2,
  XCircle,
  Activity,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import {
  AnimeItem,
  AnimeEpisode,
  EpisodeStream,
  VideoSource,
  HostStatus,
  getAnimeSuggestions,
  searchAnime,
  getAnimeEpisodes,
  getEpisodeStream,
  getAnixoEpisodes,
  getWatchFallbackUrls,
  WatchFallbackUrls,
  getCustomStreamHost,
  setCustomStreamHost,
  testStreamingHosts,
  getActiveStreamHost,
} from '../services/anime';

interface AnimePlayerProps {
  url: string;
  title: string;
  onFatalError: () => void;
}

function AnimePlayer({ url, title, onFatalError }: AnimePlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fatalRef = useRef(onFatalError);
  fatalRef.current = onFatalError;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let hlsInstance: Hls | null = null;

    const isHls = url.includes('.m3u8');
    if (isHls) {
      if (Hls.isSupported()) {
        hlsInstance = new Hls({ enableWorker: true });
        hlsInstance.loadSource(url);
        hlsInstance.attachMedia(video);
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
        hlsInstance.on(Hls.Events.ERROR, (_evt, data) => {
          if (data.fatal) {
            hlsInstance?.destroy();
            hlsInstance = null;
            fatalRef.current();
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.play().catch(() => {});
      } else {
        fatalRef.current();
        return;
      }
    } else {
      video.src = url;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsInstance) hlsInstance.destroy();
      if (video.src) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [url]);

  return (
    <div className="bg-black w-full flex items-center justify-center">
      <video
        ref={videoRef}
        controls
        playsInline
        autoPlay
        className="w-full max-h-[65vh] object-contain"
        aria-label={title}
      />
    </div>
  );
}

function openInBrowser(url: string) {
  if (Capacitor.isNativePlatform()) {
    Browser.open({ url });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

const FORMAT_ICON: Record<string, string> = {
  Movie: 'movie',
  TV: 'series',
  OVA: 'ova',
  ONA: 'ona',
};

function StreamSettingsOverlay({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState(getCustomStreamHost() || '');
  const [saved, setSaved] = useState<string | null>(getCustomStreamHost());
  const [statuses, setStatuses] = useState<HostStatus[] | null>(null);
  const [testing, setTesting] = useState(false);

  const save = () => {
    setCustomStreamHost(input.trim() || null);
    setSaved(getCustomStreamHost());
    setStatuses(null);
  };

  const test = async () => {
    setTesting(true);
    setStatuses(null);
    try {
      setStatuses(await testStreamingHosts());
    } finally {
      setTesting(false);
    }
  };

  const clear = () => {
    setCustomStreamHost(null);
    setInput('');
    setSaved(null);
    setStatuses(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xs border border-white/10 bg-[#111] p-5 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-red-500" /> Streaming servers
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-xs hover:bg-white/10 text-[#a0a0a0]"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-[#a0a0a0] leading-relaxed">
          In-app playback primarily uses the bundled AniXo (Anikoto) provider, with aniwatch-api
          instances as fallback. If a fallback instance is needed, self-host{' '}
          <code className="text-red-400">ghoshRitesh12/aniwatch-api</code> (Vercel/Render) and paste
          its URL below.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://your-api.onrender.com"
            className="flex-1 px-3 py-2 text-xs rounded-xs border border-white/10 bg-[#141414] text-[#e0e0e0] placeholder-[#606060] focus:outline-none focus:border-red-500 transition-colors"
          />
          <button
            onClick={save}
            className="px-3 py-2 bg-white text-black font-bold uppercase text-[10px] tracking-widest hover:bg-red-500 hover:text-white rounded-xs transition-colors"
          >
            Save
          </button>
        </div>
        {saved && (
          <div className="flex items-center justify-between gap-2 text-[11px] text-[#a0a0a0]">
            <span className="truncate">
              Using: <span className="text-green-400">{saved}</span>
            </span>
            <button onClick={clear} className="text-red-500 hover:underline shrink-0">
              Clear
            </button>
          </div>
        )}
        <div className="border-t border-white/10 pt-3 space-y-2">
          <button
            onClick={test}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#a0a0a0] hover:text-white transition-colors"
          >
            {testing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
            Test all hosts
          </button>
          {statuses && (
            <ul className="space-y-1 max-h-44 overflow-y-auto">
              {statuses.map((s) => (
                <li key={s.url} className="flex items-center gap-2 text-[11px]">
                  {s.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  )}
                  <span className="truncate flex-1 text-[#c0c0c0]">{s.url.replace(/^https?:\/\//, '')}</span>
                  <span className="text-[#808080] shrink-0">{s.ok ? `${s.latencyMs}ms` : s.error || 'offline'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function AnimeSection() {
  const searchInputId = 'anime-search-input';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AnimeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<AnimeItem | null>(null);
  const [episodes, setEpisodes] = useState<AnimeEpisode[]>([]);

  const [playing, setPlaying] = useState<AnimeEpisode | null>(null);
  const [stream, setStream] = useState<EpisodeStream | null>(null);
  const [streamError, setStreamError] = useState('');
  const [loadingStream, setLoadingStream] = useState(false);
  const [activeSource, setActiveSource] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  // Load the Trending feed when the app opens.
  useEffect(() => {
    (async () => {
      try {
        const list = await getAnimeSuggestions(18);
        setResults(list);
      } catch (err) {
        console.error('[Anime] Failed to load trending:', err);
        setError('Could not load trending anime. Check your connection and try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSearch = async (term: string = query) => {
    setLoading(true);
    setError('');
    try {
      const list = term.trim()
        ? await searchAnime(term, 24)
        : await getAnimeSuggestions(18);
      setResults(list);
    } catch (err) {
      console.error(err);
      setError('Could not reach AniList. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (anime: AnimeItem) => {
    setSelected(anime);
    setPlaying(null);
    setStream(null);
    setStreamError('');
    setEpisodes(getAnimeEpisodes(anime));
    try {
      const real = await getAnixoEpisodes(anime.id);
      if (real.length > 0) setEpisodes(real);
    } catch {
      // Keep the AniList-derived episode list.
    }
  };

  const handlePlay = async (episode: AnimeEpisode) => {
    if (!selected) return;
    setPlaying(episode);
    setStream(null);
    setStreamError('');
    setActiveSource(0);
    setLoadingStream(true);
    try {
      const result = await getEpisodeStream(selected.title, episode.number, selected.id);
      setStream(result);
    } catch (err) {
      console.error('[Anime] stream fetch failed:', err);
      setStreamError(err instanceof Error ? err.message : 'Could not load a stream for this episode.');
    } finally {
      setLoadingStream(false);
    }
  };

  const sources = stream?.sources || [];
  const currentUrl = sources[activeSource]?.url || '';
  const fallbackUrls: WatchFallbackUrls = selected
    ? getWatchFallbackUrls(selected.title, stream?.episodeId)
    : getWatchFallbackUrls('');

  // ---------- Player view ----------
  if (playing) {
    return (
      <div id="anime-player-view" className="flex flex-col h-full rounded-xs border border-white/10 bg-[#0a0a0a] text-[#e0e0e0] overflow-hidden shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-[#0d0d0d] border-b border-white/10">
          <button
            onClick={() => { setPlaying(null); setStream(null); setStreamError(''); }}
            className="px-3 py-1.5 rounded-xs border border-white/20 hover:bg-white/10 text-white transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Anime
          </button>
          <span className="font-serif italic text-sm text-white truncate max-w-[140px] sm:max-w-md">
            {selected?.title} • Ep. {playing.number}
          </span>
          {stream && sources.length > 1 && (
            <div className="flex items-center gap-1.5">
              {sources.map((s: VideoSource, i: number) => (
                <button
                  key={`${s.quality}-${i}`}
                  onClick={() => setActiveSource(i)}
                  className={`px-2.5 py-1 rounded-xs text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                    i === activeSource
                      ? 'bg-white text-black border-white'
                      : 'border-white/10 text-[#a0a0a0] hover:text-white'
                  }`}
                >
                  {s.quality}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto bg-black">
          {loadingStream ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-[#a0a0a0]">
              <RefreshCw className="w-8 h-8 animate-spin text-red-500" />
              <span className="text-xs uppercase tracking-widest font-mono">Resolving stream...</span>
              <span className="text-[10px] opacity-50">Searching available sources</span>
            </div>
          ) : streamError ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-[#a0a0a0] px-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <span className="text-xs font-bold uppercase tracking-widest text-center max-w-md">
                In-app streaming is unavailable for this episode
              </span>
              <span className="text-[11px] text-center max-w-sm leading-relaxed opacity-70">
                Public stream providers are frequently blocked or offline. You can still watch this
                episode in your phone's browser.
              </span>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                <button
                  onClick={() => openInBrowser(fallbackUrls.hianime)}
                  className="px-4 py-2 bg-white text-black font-bold uppercase text-[10px] tracking-[0.15em] hover:bg-red-500 hover:text-white rounded-xs transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Watch on HiAnime
                </button>
                <button
                  onClick={() => openInBrowser(fallbackUrls.anitaku)}
                  className="px-4 py-2 border border-white/20 text-white font-bold uppercase text-[10px] tracking-[0.15em] hover:bg-white/10 rounded-xs transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Watch on Anitaku
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-4 py-2 border border-white/20 text-white font-bold uppercase text-[10px] tracking-[0.15em] hover:bg-white/10 rounded-xs transition-colors flex items-center gap-1.5"
                >
                  <Settings className="w-3.5 h-3.5" /> Server settings
                </button>
                <button
                  onClick={() => handlePlay(playing)}
                  className="px-4 py-2 border border-white/20 text-white font-bold uppercase text-[10px] tracking-[0.15em] hover:bg-white/10 rounded-xs transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </button>
              </div>
            </div>
          ) : currentUrl ? (
            <div className="p-4 sm:p-6">
              <AnimePlayer
                url={currentUrl}
                title={`${selected?.title} Ep. ${playing.number}`}
                onFatalError={() => setStreamError('The video stream failed to play in-app.')}
              />
              {stream && stream.serverName && (
                <p className="mt-3 text-center text-[10px] uppercase tracking-widest opacity-50">
                  Source: {stream.serverName}
                  {getActiveStreamHost() ? ` • ${getActiveStreamHost()!.replace(/^https?:\/\//, '')}` : ''}
                </p>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-[#a0a0a0]">
              <RefreshCw className="w-8 h-8 animate-spin text-red-500" />
              <span className="text-xs uppercase tracking-widest font-mono">Preparing player...</span>
            </div>
          )}
        </div>

        {showSettings && <StreamSettingsOverlay onClose={() => setShowSettings(false)} />}
      </div>
    );
  }

  // ---------- Detail view ----------
  if (selected) {
    return (
      <div id="anime-detail-view" className="flex flex-col h-full rounded-xs border border-white/10 bg-[#0a0a0a] text-[#e0e0e0] overflow-hidden shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-[#0d0d0d] border-b border-white/10">
          <button
            onClick={() => setSelected(null)}
            className="px-3 py-1.5 rounded-xs border border-white/20 hover:bg-white/10 text-white transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Search
          </button>
          <span className="font-serif italic text-sm text-white truncate max-w-[160px] sm:max-w-md">
            {selected.title}
          </span>
          {selected.format && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">
              {FORMAT_ICON[selected.format] || 'series'}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="relative">
            {selected.bannerUrl && (
              <img
                src={selected.bannerUrl}
                alt=""
                className="w-full h-40 sm:h-56 object-cover opacity-30"
                loading="lazy"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 pb-4 flex items-end gap-4">
              <img
                src={selected.coverUrl}
                alt={selected.title}
                className="w-24 h-36 sm:w-28 sm:h-40 rounded-xs border border-white/10 object-cover shadow-2xl"
                loading="lazy"
              />
              <div className="min-w-0 pb-1">
                <h2 className="font-serif italic text-lg sm:text-2xl text-white leading-tight">
                  {selected.title}
                </h2>
                {selected.altTitle && (
                  <p className="text-xs text-[#a0a0a0] italic mt-0.5 truncate">{selected.altTitle}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {selected.averageScore != null && (
                    <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 rounded-xs">
                      <Star className="w-3 h-3 text-yellow-400" /> {selected.averageScore}%
                    </span>
                  )}
                  {selected.year && (
                    <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 rounded-xs">
                      <Calendar className="w-3 h-3 text-red-500" /> {selected.year}
                    </span>
                  )}
                  <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 rounded-xs">
                    {selected.format || 'Series'}
                  </span>
                  <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 rounded-xs">
                    {selected.status}
                  </span>
                  {selected.episodes != null && (
                    <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 rounded-xs">
                      <Tv className="w-3 h-3 text-red-500" /> {selected.episodes} eps
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-5 space-y-5">
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

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-red-500" />
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white">
                  Episodes ({episodes.length})
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                {episodes.map((ep) => (
                  <button
                    key={ep.number}
                    onClick={() => handlePlay(ep)}
                    className="group flex flex-col items-center gap-1.5 px-3 py-3 rounded-xs border border-white/10 bg-white/5 hover:bg-red-600/15 hover:border-red-500/50 transition-colors"
                  >
                    <Play className="w-4 h-4 text-[#a0a0a0] group-hover:text-red-400 transition-colors" />
                    <span className="text-xs font-bold text-white">Ep. {ep.number}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {showSettings && <StreamSettingsOverlay onClose={() => setShowSettings(false)} />}
      </div>
    );
  }

  // ---------- Search / Browse view ----------
  return (
    <div id="anime-search-view" className="flex flex-col h-full rounded-xs border border-white/10 bg-[#0a0a0a] text-[#e0e0e0] overflow-hidden shadow-2xl">
      <div className="p-4 sm:p-5 border-b border-white/10 bg-[#0d0d0d] flex flex-wrap gap-3 items-center justify-between">
        <div className="flex-1 min-w-0 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#808080]" />
          <input
            id={searchInputId}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
            placeholder="Search anime (e.g. Frieren, One Piece, Solo Leveling)..."
            className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xs border border-white/10 bg-[#141414] text-[#e0e0e0] placeholder-[#606060] focus:outline-none focus:border-red-500 transition-colors"
          />
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2.5 rounded-xs border border-white/10 text-[#a0a0a0] hover:text-white hover:bg-white/5 transition-colors"
          title="Streaming server settings"
          aria-label="Streaming server settings"
        >
          <Settings className="w-4 h-4" />
        </button>
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
              {query.trim() ? 'Searching AniList...' : 'Loading Trending...'}
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
            <Clapperboard className="w-10 h-10 text-red-500" />
            <span className="text-xs font-bold uppercase tracking-widest">No anime found</span>
            <span className="text-[11px] opacity-70">Try a different search term.</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
            {results.map((anime) => (
              <button
                key={anime.id}
                onClick={() => handleSelect(anime)}
                className="group text-left flex flex-col rounded-xs overflow-hidden border border-white/10 bg-white/5 hover:border-red-500/60 hover:bg-white/10 transition-all"
              >
                <div className="relative aspect-[3/4] overflow-hidden">
                  {anime.coverUrl ? (
                    <img
                      src={anime.coverUrl}
                      alt={anime.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#141414]">
                      <Clapperboard className="w-8 h-8 text-[#404040]" />
                    </div>
                  )}
                  {anime.averageScore != null && (
                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-black/70 backdrop-blur rounded-xs flex items-center gap-0.5 text-yellow-300">
                      <Star className="w-2.5 h-2.5" /> {anime.averageScore}
                    </span>
                  )}
                  {anime.year && (
                    <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-black/70 backdrop-blur rounded-xs text-white">
                      {anime.year}
                    </span>
                  )}
                </div>
                <div className="p-2.5 flex flex-col flex-1 min-w-0">
                  <span className="text-[11px] font-semibold text-[#e0e0e0] leading-tight line-clamp-2 group-hover:text-white">
                    {anime.title}
                  </span>
                  <span className="text-[9px] uppercase tracking-widest opacity-40 mt-1 truncate">
                    {anime.format || 'Series'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showSettings && <StreamSettingsOverlay onClose={() => setShowSettings(false)} />}
    </div>
  );
}
