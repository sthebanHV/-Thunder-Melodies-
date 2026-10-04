import { useRef, useState } from 'react';
import { usePlayerStore } from '../state/playerStore';
import { playlistService } from '../services/PlaylistService';
import { putFile, probeDuration } from '../services/localFiles';
import { Cover, fmt } from '../components/ui';
import type { Song } from '../domain/playlist/DoublyLinkedList';

const AUDIO_RE = /\.(mp3|wav|ogg|m4a|flac|aac|opus|webm)$/i;

/**
 * Vista "Subir música": arrastra o elige archivos de audio (mp3, wav,
 * ogg, m4a, flac…). Se guardan en IndexedDB dentro del navegador, entran
 * a la cola como canciones locales y suenan por el motor de audio nativo
 * (sin YouTube). Nada sale de este equipo.
 */
export function UploadView(): React.JSX.Element {
  const { songs, play, refresh } = usePlayerStore();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const localSongs = songs.filter((s) => s.local);

  async function addFiles(list: FileList | File[]): Promise<void> {
    const files = [...list].filter((f) => f.type.startsWith('audio/') || AUDIO_RE.test(f.name));
    if (files.length === 0) {
      setMsg('Ese archivo no parece audio. Acepta mp3, wav, ogg, m4a, flac, aac u opus.');
      return;
    }
    setBusy(true);
    setMsg(null);
    let n = 0;
    for (const f of files) {
      const id = `file:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      try {
        await putFile(id, f);
      } catch {
        setMsg('No se pudo guardar un archivo en este navegador (almacén bloqueado).');
        continue;
      }
      const dur = await probeDuration(f);
      const song: Song = {
        id,
        title: f.name.replace(/\.[^.]+$/, ''),
        artist: 'Archivo local',
        durationSec: Math.round(dur ?? 0),
        local: true,
      };
      try {
        playlistService.addLast(song);
        n += 1;
      } catch {
        /* duplicado de carrera */
      }
    }
    refresh();
    setBusy(false);
    setMsg(
      n === 0
        ? null
        : `${n} archivo${n > 1 ? 's' : ''} subido${n > 1 ? 's' : ''} — ya ${n > 1 ? 'están' : 'está'} en tu cola.`,
    );
  }

  function playLocal(id: string): void {
    const inQueue = playlistService.snapshot().songs.some((s) => s.id === id);
    if (!inQueue) {
      setMsg('Ese archivo ya no está en la cola. Vuelve a subirlo.');
      return;
    }
    play(id);
  }

  function removeFromQueue(id: string): void {
    playlistService.removeById(id);
    refresh();
    setMsg('Archivo quitado de la cola (el archivo sigue guardado).');
  }

  return (
    <div className="grid gap-5 px-4 py-5 md:px-6 md:py-6">
      <div>
        <h2 className="font-display text-xl font-bold">Subir música</h2>
        <p className="mt-1 text-xs text-white/50">
          Tus archivos (mp3 y otros formatos) se guardan solo en este navegador y suenan directo, sin YouTube.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void addFiles(e.dataTransfer.files);
        }}
        className={`card-ring flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
          drag ? 'border-neon bg-neon/10 shadow-glow' : 'border-white/15 bg-panel hover:border-neon/40'
        }`}
      >
        <span className="drop-bob text-3xl text-neon" aria-hidden>
          ⬆
        </span>
        <p className="text-sm text-white/70">Arrastra archivos de audio aquí</p>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="btn-press rounded-full bg-neon px-4 py-1.5 text-sm font-bold text-black disabled:opacity-50"
        >
          {busy ? 'Subiendo…' : 'Elegir archivos'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.opus"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {msg && (
        <p role="status" className="text-sm text-neon">
          {msg}
        </p>
      )}

      <section>
        <h3 className="font-display font-bold">
          Archivos subidos — {localSongs.length}
        </h3>
        {localSongs.length === 0 ? (
          <p className="mt-3 card-ring rounded-xl bg-panel p-4 text-sm text-white/50">
            Aún no has subido nada. Tus archivos aparecerán aquí y en tu cola.
          </p>
        ) : (
          <ul className="stagger mt-3 grid gap-2">
            {localSongs.map((s) => (
              <li key={s.id} className="lift card-ring flex items-center gap-2 rounded-xl bg-panel px-3 py-2">
                <Cover title={s.title} className="h-10 w-10 rounded-lg text-xs" />
                <button onClick={() => playLocal(s.id)} className="min-w-0 flex-1 text-left" title="Sonar ahora">
                  <p className="truncate text-sm font-semibold">{s.title}</p>
                  <p className="truncate text-xs text-white/50">
                    {s.artist} · {s.durationSec > 0 ? fmt(s.durationSec) : 'duración al sonar'}
                  </p>
                </button>
                <button
                  onClick={() => playLocal(s.id)}
                  className="rounded-lg border border-neon/40 bg-neon/20 px-2 py-1 text-xs font-bold"
                >
                  ▶ Sonar
                </button>
                <button
                  onClick={() => removeFromQueue(s.id)}
                  aria-label={`Quitar ${s.title} de la cola`}
                  className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/60 hover:border-red-400/50 hover:text-red-300"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
