import { usePlayerStore, currentSong } from '../state/playerStore';
import { audioEngine } from '../services/AudioEngine';
import { Cover, fmt } from './ui';
import { ThemeToggle } from './ThemeToggle';

export function Topbar({ onSearch }: { onSearch: (q: string) => void }): React.JSX.Element {
  const { query, setQuery } = usePlayerStore();
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/5 bg-void/85 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex w-full max-w-xl items-center gap-2 rounded-full border border-neon/25 bg-panel px-4 py-2 transition-shadow duration-300 focus-within:border-neon/70 focus-within:shadow-glow">
        <span className="text-white/50">⌕</span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onSearch(e.target.value);
          }}
          placeholder="Buscar canciones, artistas, álbumes…"
          aria-label="Buscar canciones, artistas, álbumes"
          className="w-full bg-transparent text-sm placeholder:text-white/35"
        />
      </div>
      <div className="ml-auto flex items-center gap-3 text-white/70">
        <ThemeToggle />
        <button aria-label="Notificaciones" className="transition-transform duration-200 hover:scale-110">🔔</button>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neon/25 text-sm">◍</span>
      </div>
    </div>
  );
}

export function BottomPlayer(): React.JSX.Element {
  const { songs, currentId, status, durationSec, posSec, prev, next, repeatAll } = usePlayerStore();
  const song = currentSong(songs, currentId);
  const duration = durationSec ?? song?.durationSec ?? 0;
  return <footer className="bottom-player">

    <div className="player-track"><Cover url={song?.coverUrl} title={song?.title ?? 'TM'} className="h-12 w-12 rounded-lg" /><div><strong>{song?.title ?? 'Tu música empieza aquí'}</strong><small>{song?.artist ?? 'Busca una canción o sube tus archivos'}</small></div></div>
    <div className="player-center"><div className="transport"><button onClick={prev} disabled={!song} aria-label="Anterior">⏮</button><button className="main-play" onClick={() => audioEngine.toggle()} disabled={!song} aria-label={status === 'playing' ? 'Pausar' : 'Reproducir'}>{status === 'playing' ? '⏸' : status === 'loading' ? '…' : '▶'}</button><button onClick={next} disabled={!song} aria-label="Siguiente">⏭</button><button aria-label="Repetir cola" aria-pressed={repeatAll} onClick={() => usePlayerStore.setState({repeatAll: !repeatAll})}>⤾</button></div><div className="player-timeline"><span>{fmt(posSec)}</span><div role="progressbar" aria-label="Progreso" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={posSec}><i style={{width: `${duration ? Math.min(100,posSec / duration * 100) : 0}%`}} /></div><span>{fmt(duration)}</span></div></div>
    <label className="player-volume"><span aria-hidden>◖))</span><input type="range" aria-label="Volumen" defaultValue={80} onChange={e => audioEngine.setVolume(Number(e.target.value)/100)} /></label>
  </footer>;
}
