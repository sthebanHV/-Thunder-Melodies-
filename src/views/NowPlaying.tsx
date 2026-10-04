import { usePlayerStore, currentSong } from '../state/playerStore';
import { audioEngine } from '../services/AudioEngine';
import { Cover, fmt } from '../components/ui';
import { FavHeart } from '../state/favStore';

/** Tira de waveform reactiva: se mueve mientras suena, se congela en pausa. */
function WaveStrip({ play }: { play: boolean }): React.JSX.Element {
  return (
    <div className="wave-live h-8" data-play={play} aria-hidden>
      {Array.from({ length: 40 }, (_, i) => (
        <span
          key={i}
          className="wave-bar"
          style={{
            height: `${8 + ((i * 7) % 24)}px`,
            animationDelay: `${(i % 6) * 90}ms`,
            animationDuration: `${700 + (i % 5) * 110}ms`,
            opacity: 0.45 + (i % 4) * 0.15,
          }}
        />
      ))}
    </div>
  );
}

export function NowPlaying(): React.JSX.Element {
  const { songs, currentId, play, next, prev, status, videoExpanded, setVideoExpanded, durationSec, posSec, source, error, diagApi, diagYt, diagErr, repeatAll } = usePlayerStore();
  const song = currentSong(songs, currentId);
  const upNext = songs.filter((s) => s.id !== currentId).slice(0, 6);
  const live = status === 'playing';
  const dur = durationSec ?? song?.durationSec ?? 0;

  return (
    <div className="grid gap-5 px-4 py-5 md:px-6 md:py-6">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-xl font-bold">Sonando</h2>
        <p className="text-[11px] tracking-[0.3em] text-neon/70">{live ? 'REPRODUCIENDO' : status === 'loading' ? 'CARGANDO' : status === 'error' ? 'NO DISPONIBLE' : song ? 'EN PAUSA' : 'SIN CANCIÓN'}</p>
      </div>

      <section className="card-ring grid items-start gap-6 rounded-2xl bg-panel p-5 shadow-card md:p-6 xl:grid-cols-[minmax(0,340px)_1fr] 2xl:grid-cols-[minmax(0,420px)_1fr]">
        {/* Portada: respira y con anillo orbital mientras suena */}
        <div className={`cover-live mx-auto w-full max-w-[340px] 2xl:max-w-[420px] ${live ? 'is-live' : ''}`}>
          <span className="cover-ring" aria-hidden />
          <div className="overflow-hidden rounded-xl">
            <Cover url={song?.coverUrl} title={song?.title ?? 'Elige tu frecuencia'} className="cover-breathe h-64 w-full text-4xl md:h-[320px] 2xl:h-[400px]" />
          </div>
        </div>

        {/* Columna de información y controles */}
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-3">
            <p className="truncate text-[11px] tracking-[0.35em] text-neon/80">{song?.artist ?? 'SIN CANCIÓN SELECCIONADA'}</p>
            {song?.videoId && source === 'video' && (
              <button
                onClick={() => setVideoExpanded(!videoExpanded)}
                aria-pressed={videoExpanded}
                className={`btn-press ml-auto shrink-0 rounded-full border px-3 py-0.5 text-xs font-bold transition-colors ${videoExpanded ? 'border-neon bg-neon/20 text-white' : 'border-white/15 text-white/60 hover:border-neon/60 hover:text-white'}`}
              >
                {videoExpanded ? 'Minimizar video' : '▶ Ver video'}
              </button>
            )}
          </div>

          <h1 className="mt-1 break-words font-script text-4xl leading-tight text-neon text-glow sm:text-5xl md:text-6xl">
            {song?.title ?? 'Elige tu frecuencia'}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {song && <FavHeart song={song} />}
            <p className="text-sm text-white/55">
              {song ? `${song.artist}${song.album ? ` • ${song.album}` : ''}` : 'Busca una canción o sube tu música'}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {source === 'video' && (
              <p className="inline-flex items-center gap-1 rounded-full border border-accent2/40 bg-accent2/10 px-2.5 py-0.5 text-[11px] text-accent2">
                Canción completa · desde el inicio
              </p>
            )}
            {source === 'local' && (
              <p className="inline-flex items-center gap-1 rounded-full border border-neon/40 bg-neon/10 px-2.5 py-0.5 text-[11px] text-neon">
                Archivo local · reproducción directa
              </p>
            )}
          </div>

          {/* Progreso */}
          <div className="mt-4">
            <input type="range" min={0} max={dur || 1} step={1} value={Math.min(posSec, dur)} disabled={!dur} onChange={e => audioEngine.seek(Number(e.target.value))} aria-label="Posición de la canción" className="w-full accent-[#d926f9]" />
            <div className="mt-1.5 flex justify-between text-xs text-white/50 tnum">
              <span>{fmt(posSec)}</span>
              <span>{dur ? fmt(dur) : '—:—'}</span>
            </div>
          </div>

          <WaveStrip play={live} />

          {/* Controles */}
          <div className="mt-4 flex items-center justify-center gap-7 md:gap-9">
            <button disabled aria-label="Aleatorio" title="Aleatorio no disponible" className="text-lg text-white/45 transition-colors hover:text-neon">⤨</button>
            <button onClick={prev} aria-label="Anterior" className="btn-press text-2xl text-white/85 hover:text-white">⏮</button>
            <button
              onClick={() => audioEngine.toggle()}
              aria-label={status === 'playing' ? 'Pausar' : 'Reproducir'}
              className={`flex h-16 w-16 items-center justify-center rounded-full border-2 border-neon text-2xl shadow-glow transition-transform duration-200 hover:scale-105 active:scale-95 ${live ? 'glow-pulse bg-neon/15' : ''}`}
            >
              {status === 'playing' ? '⏸' : status === 'loading' ? '…' : '▶'}
            </button>
            <button onClick={next} aria-label="Siguiente" className="btn-press text-2xl text-white/85 hover:text-white">⏭</button>
            <button aria-pressed={repeatAll} onClick={() => usePlayerStore.setState(s => ({ repeatAll: !s.repeatAll }))} aria-label="Repetir" className="text-lg text-white/45 transition-colors hover:text-neon">⤾</button>
          </div>

          <p className="mt-4 font-mono text-[11px] text-white/40" role="status">
            motor: {source === 'local' ? 'archivo' : 'YT'} {diagApi} · {diagYt}{diagErr !== null ? ` · error ${diagErr}` : ''}
          </p>

          {status === 'error' && error && (
            <div role="alert" className="mt-3 rounded-xl border border-accent2/50 bg-accent2/10 p-3 text-sm">
              <p className="font-bold text-accent2">No se pudo reproducir</p>
              <p className="mt-1 text-white/70">{error}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {song?.videoId && <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(song.videoId)}`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-neon/50 px-3 py-1 text-xs font-bold text-neon">Abrir en YouTube ↗</a>}
                <button
                  onClick={() => audioEngine.retry()}
                  className="btn-press rounded-full bg-neon px-3 py-1 text-xs font-bold text-black"
                >
                  Reintentar
                </button>
                <button
                  onClick={next}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 transition-colors hover:border-neon/60"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {upNext.length > 0 && (
        <section className="card-ring rounded-2xl bg-panel p-4 md:p-5">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display font-bold">A continuación</h3>
            <span className="text-[11px] tracking-[0.2em] text-white/40">{upNext.length} EN COLA</span>
          </div>
          <ul className="stagger mt-3 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {upNext.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => play(s.id)}
                  className="lift flex w-full items-center gap-2.5 rounded-xl border border-transparent bg-white/[0.03] px-2.5 py-2 text-left"
                >
                  <Cover url={s.coverUrl} title={s.title} className="h-10 w-10 shrink-0 rounded-lg text-xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{s.title}</span>
                    <span className="block truncate text-[11px] text-white/50">{s.artist}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-white/40 tnum">{fmt(s.durationSec)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
