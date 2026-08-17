import { useRef, useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, Gauge, Maximize, Minimize, MonitorPlay, Play, RefreshCw, Subtitles, XCircle } from 'lucide-react';
import { MovieServer, ServerStatus } from '../services/movies';

interface EmbedPlayerProps {
  title: string;
  backLabel: string;
  servers: MovieServer[];
  statuses: ServerStatus[] | null;
  activeServerId: string | null;
  scanning: boolean;
  onBack: () => void;
  onSelectServer: (id: string) => void;
  onRescan: () => void;
}

export function EmbedPlayer({
  title,
  backLabel,
  servers,
  statuses,
  activeServerId,
  scanning,
  onBack,
  onSelectServer,
  onRescan,
}: EmbedPlayerProps) {
  const activeStatus = statuses?.find((s) => s.id === activeServerId) || null;
  const activeUrl = activeStatus?.url || '';
  const online = statuses?.filter((s) => s.ok).length ?? 0;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(
        !!document.fullscreenElement || !!(document as any).webkitFullscreenElement
      );
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    const fs = document.fullscreenElement || (document as any).webkitFullscreenElement;
    if (fs) {
      (document.exitFullscreen || (document as any).webkitExitFullscreen)?.call(document);
    } else {
      (el.requestFullscreen || (el as any).webkitRequestFullscreen)?.call(el);
    }
  };

  return (
    <div id="embed-player-view" className="flex flex-col h-full rounded-xs border border-white/10 bg-[#0a0a0a] text-[#e0e0e0] overflow-hidden shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-[#0d0d0d] border-b border-white/10">
        <button
          onClick={onBack}
          className="px-3 py-1.5 rounded-xs border border-white/20 hover:bg-white/10 text-white transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> {backLabel}
        </button>
        <span className="font-serif italic text-sm text-white truncate max-w-[160px] sm:max-w-md">
          {title}
        </span>
        <button
          onClick={onRescan}
          disabled={scanning}
          className="px-3 py-1.5 rounded-xs border border-white/20 hover:bg-white/10 text-white transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
        >
          {scanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Gauge className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{scanning ? 'Scanning...' : 'Find best server'}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-black">
        {scanning && statuses === null ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-[#a0a0a0]">
            <RefreshCw className="w-8 h-8 animate-spin text-red-500" />
            <span className="text-xs uppercase tracking-widest font-mono">Probing servers...</span>
            <span className="text-[10px] opacity-50">Auto-selecting the fastest one</span>
          </div>
        ) : activeUrl ? (
          <div ref={containerRef} className="p-4 sm:p-6">
            <div className="relative bg-black rounded-xs overflow-hidden group" style={isFullscreen ? { aspectRatio: 'unset', height: '100%' } : { aspectRatio: '16/9' }}>
              <iframe
                src={activeUrl}
                className="absolute inset-0 w-full h-full border-0"
                title={title}
                allowFullScreen
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                sandbox="allow-scripts allow-same-origin allow-presentation"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
              <button
                onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                className="absolute bottom-3 right-3 p-2 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                aria-label="Toggle fullscreen"
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </div>
            {activeStatus && (
              <p className="mt-3 text-center text-[10px] uppercase tracking-widest opacity-50">
                Playing on {activeStatus.name}
                {activeStatus.latencyMs != null ? ` • ${activeStatus.latencyMs}ms` : ''}
                {activeStatus.id === activeServerId && activeStatus.ok ? ' • auto-selected' : ''}
              </p>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-[#a0a0a0] px-6">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-center max-w-md">
              No streaming server is responding
            </span>
            <span className="text-[11px] text-center max-w-sm leading-relaxed opacity-70">
              Public embed providers are frequently blocked or offline. Pick a server below to try
              again, or retry the scan in a moment.
            </span>
            <button
              onClick={onRescan}
              disabled={scanning}
              className="mt-1 px-4 py-2 bg-white text-black font-bold uppercase text-[10px] tracking-[0.15em] hover:bg-red-500 hover:text-white rounded-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} /> Rescan servers
            </button>
          </div>
        )}

        {servers.length > 0 && (
          <div className="px-4 sm:px-6 pb-6">
            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white flex items-center gap-2">
                  <MonitorPlay className="w-4 h-4 text-red-500" /> Servers
                </span>
                {statuses && (
                  <span className="text-[9px] uppercase tracking-widest opacity-50">
                    {online}/{statuses.length} online
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {servers.map((srv) => {
                  const st = statuses?.find((s) => s.id === srv.id);
                  const active = srv.id === activeServerId;
                  return (
                    <button
                      key={srv.id}
                      onClick={() => onSelectServer(srv.id)}
                      disabled={scanning}
                      className={`px-3 py-2 rounded-xs text-[10px] font-bold uppercase tracking-wider border transition-colors flex items-center gap-1.5 disabled:opacity-50 ${
                        active
                          ? 'bg-white text-black border-white'
                          : 'border-white/10 text-[#a0a0a0] hover:text-white hover:border-white/30'
                      }`}
                      title={st?.ok ? `${srv.name} — ${st.latencyMs}ms` : `${srv.name} — ${st?.error || 'unchecked'}`}
                    >
                      {active && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                      {st && !st.ok && <XCircle className="w-3 h-3 text-red-500" />}
                      {srv.name}
                      {active && st?.ok && (
                        <span className="ml-0.5 text-[8px] font-bold bg-red-600 text-white px-1 py-0.5 rounded-xs">BEST</span>
                      )}
                      {st?.ok && st.latencyMs != null && (
                        <span className="text-[8px] opacity-60">{st.latencyMs}ms</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {servers.length > 0 && (
        <div className="px-4 sm:px-6 pb-5">
          <p className="flex items-center gap-1.5 text-[10px] text-[#808080] uppercase tracking-widest">
            <Subtitles className="w-3.5 h-3.5 text-red-500" />
            Subtitles: open the player's CC (closed captions) menu.
          </p>
        </div>
      )}
    </div>
  );
}
