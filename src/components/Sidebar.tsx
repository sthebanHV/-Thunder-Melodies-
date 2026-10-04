import { usePlayerStore, currentSong } from '../state/playerStore';
import { audioEngine } from '../services/AudioEngine';
import { Cover, fmt } from './ui';
import type { View } from '../App';

const NAV: Array<{ id: View; label: string; icon: string }> = [
  { id: 'home', label: 'Inicio', icon: '⌂' },
  { id: 'upload', label: 'Subir música', icon: '⬆' },
  { id: 'lists', label: 'Listas', icon: '♪' },
  { id: 'favs', label: 'Favoritos', icon: '♡' },
  { id: 'playing', label: 'Sonando', icon: '◎' },
];

/** Mini ecualizador de 3 barras: se mueve mientras suena. */
function Eq({ play }: { play: boolean }): React.JSX.Element {
  return (
    <span className="wave-live h-3 items-end" data-play={play} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="wave-bar"
          style={{ height: 6 + i * 3, width: 3, animationDelay: `${i * 140}ms`, animationDuration: `${650 + i * 120}ms` }}
        />
      ))}
    </span>
  );
}

export function Sidebar({ view, go }: { view: View; go: (v: View) => void }): React.JSX.Element {
  const { songs, currentId, status } = usePlayerStore();
  const song = currentSong(songs, currentId);
  const live = status === 'playing';
  return (
    <aside className="app-sidebar hidden w-[220px] shrink-0 flex-col gap-4 border-r border-white/5 bg-black/40 px-3 py-5 md:flex">
      <button onClick={() => go('home')} className="flex items-center gap-2 px-2 text-left">
        <span className="glow-pulse text-2xl text-neon">✦</span>
        <span className="font-display text-xl font-extrabold italic text-neon text-glow">Thunder Melodies</span>
      </button>
      <nav className="grid gap-1 text-sm">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => go(n.id)}
            aria-current={view === n.id ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-all duration-200 ${
              view === n.id
                ? 'translate-x-1 bg-neon/15 text-white shadow-glow'
                : 'text-white/60 hover:translate-x-1 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="w-5 text-center text-neon">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>
      <div className="mt-3 border-t border-white/5 px-2 pt-4 text-[11px] leading-relaxed tracking-[0.25em] text-neon/70">
        TU BIBLIOTECA
      </div>
      <div className="sidebar-landscape" aria-hidden /><p className="mt-auto px-2 text-[10px] leading-relaxed tracking-[0.25em] text-neon/50">
        TU NOCHE. TU FRECUENCIA.
      </p>
      <div className="lift card-ring flex items-center gap-2 rounded-xl bg-panel px-2 py-2">
        <Cover url={song?.coverUrl} title={song?.title ?? 'TM'} className="h-9 w-9 rounded-md text-xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold">{song?.title ?? 'Nada en cola'}</p>
          <p className="truncate text-[11px] text-white/50">{song?.artist ?? 'Agrega desde Inicio'}</p>
        </div>
        {song && <Eq play={live} />}
      </div>
    </aside>
  );
}

export function QueuePanel({ onOpen }: { onOpen: () => void }): React.JSX.Element {
  const { songs, currentId, play, next, prev, status, posSec, durationSec, repeatAll } = usePlayerStore();
  const song = currentSong(songs, currentId);
  const live = status === 'playing';
  const dur = durationSec ?? song?.durationSec ?? 0;
  const frac = dur ? Math.min(1, posSec / dur) : 0;
  return (
    <aside className="queue-panel hidden w-[280px] shrink-0 flex-col gap-3 px-3 py-5 lg:flex">
      <p className="eyebrow">REPRODUCIENDO AHORA</p><div className="card-ring lift overflow-hidden rounded-2xl bg-panel">
        <button onClick={onOpen} className="block w-full text-left">
          <Cover url={song?.coverUrl} title={song?.title ?? 'Tu próxima canción'} className="h-44 w-full" />
        </button>
        <div className="p-3">
          <p className="truncate font-display text-lg font-bold">{song?.title ?? 'Night Drive'}</p>
          <p className="truncate text-xs tracking-[0.2em] text-white/50">{song?.artist ?? 'Elige música para empezar'}</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-neon shadow-glow transition-[width] duration-500 ease-out"
              style={{ width: `${frac * 100}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-white/40 tnum">
            <span>{fmt(posSec)}</span>
            <span>{dur ? fmt(dur) : '—:—'}</span>
          </div>
          <div className="mt-2.5 flex items-center justify-center gap-4 text-lg">
            <button disabled title="Aleatorio no disponible" aria-label="Aleatorio" className="text-white/45 transition-colors hover:text-neon">⤨</button>
            <button onClick={prev} aria-label="Anterior" className="btn-press text-white/85 hover:text-white">⏮</button>
            <button
              onClick={() => audioEngine.toggle()}
              aria-label={status === 'playing' ? 'Pausar' : 'Reproducir'}
              className={`flex h-11 w-11 items-center justify-center rounded-full border-2 border-neon text-xl shadow-glow transition-transform duration-200 hover:scale-110 active:scale-95 ${live ? 'glow-pulse bg-neon/15' : ''}`}
            >
              {status === 'playing' ? '⏸' : status === 'loading' ? '…' : '▶'}
            </button>
            <button onClick={next} aria-label="Siguiente" className="btn-press text-white/85 hover:text-white">⏭</button>
            <button aria-pressed={repeatAll} onClick={() => usePlayerStore.setState({repeatAll: !repeatAll})} aria-label="Repetir" className="text-white/45 transition-colors hover:text-neon">⤾</button>
          </div>
        </div>
      </div>
      <div className="card-ring flex min-h-0 flex-1 flex-col rounded-2xl bg-panel p-3">
        <p className="text-xs font-bold tracking-wide">Cola de reproducción</p>
        <ul className="mt-2 grid max-h-[380px] gap-1 overflow-auto">
          {songs.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => play(s.id)}
                className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors duration-200 ${
                  s.id === currentId ? 'bg-neon/20' : 'hover:bg-white/5'
                }`}
              >
                <Cover url={s.coverUrl} title={s.title} className="h-9 w-9 rounded-md text-xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{s.title}</span>
                  <span className="block truncate text-[11px] text-white/50">{s.artist}</span>
                </span>
                {s.id === currentId && <Eq play={live} />}
              </button>
            </li>
          ))}
          {songs.length === 0 && <li className="text-xs text-white/40">Cola vacía: busca y pulsa + Cola.</li>}
        </ul>
        <p className="mt-3 text-center font-script text-lg leading-tight text-neon/80">
          Las buenas canciones
          <br />
          siempre encuentran su momento
        </p>
      </div>
    </aside>
  );
}
