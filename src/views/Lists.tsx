import { useState } from 'react';
import { usePlayerStore, currentSong } from '../state/playerStore';
import { playlistService } from '../services/PlaylistService';
import { Cover, fmt } from '../components/ui';
import { FavHeart } from '../state/favStore';
import { usePlaylistStore, type Playlist } from '../state/playlistLibrary';
import type { Song } from '../domain/playlist/DoublyLinkedList';

/** Vista Listas: playlists manuales + gestión de la cola (la DoublyLinkedList). */
export function ListsView(): React.JSX.Element {
  const { songs, currentId, play, refresh, setError, error } = usePlayerStore();
  const song = currentSong(songs, currentId);
  const { playlists, create, rename, remove, addSong, removeSong } = usePlaylistStore();

  const [form, setForm] = useState({ title: '', artist: '', pos: 'end', index: 0 });
  const [newName, setNewName] = useState('');
  const [libErr, setLibErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [plForm, setPlForm] = useState({ title: '', artist: '' });

  const selected: Playlist | null = playlists.find((p) => p.id === selectedId) ?? null;

  /** Ejecuta una operación de playlists mostrando su error en la vista. */
  function libRun(fn: () => void): boolean {
    try {
      fn();
      setLibErr(null);
      return true;
    } catch (e) {
      setLibErr(e instanceof Error ? e.message : 'Operación inválida');
      return false;
    }
  }

  function run(fn: () => void): void {
    try {
      fn();
      refresh();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operación inválida');
    }
  }

  function handleCreate(e: React.FormEvent): void {
    e.preventDefault();
    const ok = libRun(() => {
      const id = create(newName);
      setSelectedId(id);
    });
    if (ok) setNewName('');
  }

  /** Guarda la cola actual (lista doble) como una playlist nueva. */
  function handleSaveQueue(): void {
    if (songs.length === 0) {
      setLibErr('La cola está vacía: agrega canciones antes de guardarla');
      return;
    }
    const ok = libRun(() => {
      create(newName.trim() || `Cola ${new Date().toLocaleDateString('es-ES')}`, songs);
    });
    if (ok) setNewName('');
  }

  /** Reemplaza la cola con las canciones de la playlist y arranca en la primera. */
  function loadIntoQueue(pl: Playlist): void {
    if (pl.songs.length === 0) {
      setLibErr(`"${pl.name}" está vacía`);
      return;
    }
    libRun(() => {
      playlistService.clear();
      for (const s of pl.songs) playlistService.addLast(s);
      refresh();
      setError(null);
      play(pl.songs[0].id);
    });
  }

  function addToQueueFromPlaylist(s: Song): void {
    libRun(() => {
      playlistService.addLast(s);
      refresh();
      setError(null);
    });
  }

  function handleRename(e: React.FormEvent): void {
    e.preventDefault();
    if (!selectedId) return;
    if (libRun(() => rename(selectedId, renameVal))) setRenaming(false);
  }

  function handleDeletePlaylist(id: string): void {
    if (confirmDel !== id) {
      setConfirmDel(id);
      return;
    }
    if (libRun(() => remove(id))) {
      setConfirmDel(null);
      if (selectedId === id) {
        setSelectedId(null);
        setRenaming(false);
      }
    }
  }

  function addManualToPlaylist(e: React.FormEvent): void {
    e.preventDefault();
    if (!selectedId) return;
    const s: Song = {
      id: `local:${Date.now()}`,
      title: plForm.title.trim() || 'Sin título',
      artist: plForm.artist.trim() || 'Desconocido',
      durationSec: 200,
    };
    if (libRun(() => addSong(selectedId, s))) setPlForm({ title: '', artist: '' });
  }

  function addManual(e: React.FormEvent): void {
    e.preventDefault();
    const s: Song = {
      id: `local:${Date.now()}`,
      title: form.title.trim() || 'Sin título',
      artist: form.artist.trim() || 'Desconocido',
      durationSec: 200,
    };
    run(() => {
      if (form.pos === 'start') playlistService.addFirst(s);
      else if (form.pos === 'index') playlistService.addAt(form.index, s);
      else playlistService.addLast(s);
    });
    setForm({ title: '', artist: '', pos: 'end', index: 0 });
  }

  return (
    <div className="grid gap-4 px-4 py-5 md:px-6 md:py-6">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-xl font-bold">Listas</h2>
        <p className="text-xs text-white/50">Crea playlists manuales y gestiona la cola (lista doble).</p>
      </div>

      {/* ── PLAYLISTS MANUALES ─────────────────────────────── */}
      <section className="card-ring grid gap-3 rounded-2xl bg-panel p-4 shadow-card">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display font-bold">Tus playlists</h3>
          <span className="text-[11px] tracking-[0.2em] text-white/40">{playlists.length} GUARDADAS</span>
        </div>

        <form onSubmit={handleCreate} className="flex flex-wrap gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre de la playlist nueva"
            aria-label="Nombre de la playlist nueva"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-void px-3 py-2 text-sm"
          />
          <button className="btn-press rounded-lg bg-neon px-4 py-2 text-sm font-bold text-black">Crear playlist</button>
          <button
            type="button"
            onClick={handleSaveQueue}
            disabled={songs.length === 0}
            className="rounded-lg border border-neon/40 bg-neon/10 px-4 py-2 text-sm font-bold transition-colors hover:bg-neon/20 disabled:opacity-40"
          >
            Guardar cola ({songs.length})
          </button>
        </form>

        {libErr && <p role="alert" className="text-sm text-red-400">{libErr}</p>}

        {playlists.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/50">
            Aún no tienes playlists. Escribe un nombre arriba y pulsa «Crear playlist», o guarda tu cola actual con «Guardar cola».
          </p>
        ) : (
          <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {playlists.map((pl) => (
              <article
                key={pl.id}
                className={`lift card-ring flex flex-col gap-2 rounded-xl bg-panel p-3 ${selectedId === pl.id ? 'border-neon shadow-glow' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-neon" aria-hidden>♫</span>
                  <h4 className="min-w-0 flex-1 truncate font-display text-sm font-bold">{pl.name}</h4>
                  <span className="tnum text-[11px] text-white/40">{pl.songs.length}</span>
                </div>
                <p className="text-xs text-white/45">
                  {pl.songs.length} {pl.songs.length === 1 ? 'canción' : 'canciones'} · {new Date(pl.createdAt).toLocaleDateString('es-ES')}
                </p>
                <div className="mt-auto flex flex-wrap gap-1.5 text-xs">
                  <button
                    onClick={() => loadIntoQueue(pl)}
                    className="btn-press rounded-lg bg-neon px-2.5 py-1 font-bold text-black"
                  >
                    Cargar en cola
                  </button>
                  <button
                    onClick={() => {
                      setSelectedId(pl.id);
                      setRenaming(false);
                      setConfirmDel(null);
                    }}
                    aria-expanded={selectedId === pl.id}
                    className="rounded-lg border border-white/15 px-2.5 py-1 text-white/70 transition-colors hover:border-neon/50 hover:text-white"
                  >
                    {selectedId === pl.id ? 'Editando…' : 'Ver'}
                  </button>
                  <button
                    onClick={() => handleDeletePlaylist(pl.id)}
                    className={`rounded-lg border px-2.5 py-1 transition-colors ${confirmDel === pl.id ? 'border-red-400 bg-red-400/15 text-red-300' : 'border-white/15 text-white/60 hover:border-red-400/50 hover:text-red-300'}`}
                  >
                    {confirmDel === pl.id ? '¿Seguro?' : 'Eliminar'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ── DETALLE DE LA PLAYLIST SELECCIONADA ────────────── */}
      {selected && (
        <section className="card-ring grid gap-3 rounded-2xl bg-panel p-4 shadow-card" aria-label={`Detalle de ${selected.name}`}>
          <div className="flex flex-wrap items-center gap-2">
            {renaming ? (
              <form onSubmit={handleRename} className="flex min-w-0 flex-1 items-center gap-2">
                <input
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  aria-label="Nuevo nombre de la playlist"
                  autoFocus
                  className="min-w-0 flex-1 rounded-lg border border-neon/50 bg-void px-3 py-1.5 text-sm"
                />
                <button className="rounded-lg bg-neon px-3 py-1.5 text-xs font-bold text-black">Guardar</button>
                <button type="button" onClick={() => setRenaming(false)} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70">
                  Cancelar
                </button>
              </form>
            ) : (
              <>
                <h3 className="font-display text-lg font-bold">{selected.name}</h3>
                <span className="text-[11px] tracking-[0.2em] text-white/40">{selected.songs.length} CANCIONES</span>
                <div className="ml-auto flex flex-wrap gap-1.5 text-xs">
                  <button
                    onClick={() => {
                      setRenaming(true);
                      setRenameVal(selected.name);
                    }}
                    className="rounded-lg border border-white/15 px-2.5 py-1 text-white/70 transition-colors hover:border-neon/50 hover:text-white"
                  >
                    Renombrar
                  </button>
                  <button onClick={() => loadIntoQueue(selected)} className="btn-press rounded-lg bg-neon px-2.5 py-1 font-bold text-black">
                    Cargar en cola
                  </button>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="rounded-lg border border-white/15 px-2.5 py-1 text-white/60 transition-colors hover:border-white/30 hover:text-white"
                  >
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>

          <ul className="stagger grid gap-1.5">
            {selected.songs.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2 rounded-xl border border-transparent bg-white/[0.03] px-2.5 py-2">
                <span className="tnum w-5 shrink-0 text-xs text-white/40">{i}</span>
                <Cover url={s.coverUrl} title={s.title} className="h-9 w-9 shrink-0 rounded-lg text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.title}</p>
                  <p className="truncate text-xs text-white/50">{s.artist} · {fmt(s.durationSec)}</p>
                </div>
                <button
                  onClick={() => addToQueueFromPlaylist(s)}
                  title="Añadir esta canción a la cola"
                  className="shrink-0 rounded-lg border border-white/15 px-2 py-1 text-xs text-white/70 transition-colors hover:border-neon/50 hover:text-white"
                >
                  → Cola
                </button>
                <button
                  onClick={() => libRun(() => removeSong(selected.id, s.id))}
                  aria-label={`Quitar ${s.title} de la playlist`}
                  className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-xs text-white/50 transition-colors hover:border-red-400/50 hover:text-red-300"
                >
                  ✕
                </button>
              </li>
            ))}
            {selected.songs.length === 0 && (
              <li className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/50">
                Playlist vacía: agrega canciones manuales abajo o usa «Guardar cola» para llenarla.
              </li>
            )}
          </ul>

          <form onSubmit={addManualToPlaylist} className="grid gap-2 border-t border-white/5 pt-3">
            <p className="text-sm font-semibold">Agregar canción manual a «{selected.name}»</p>
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <input value={plForm.title} onChange={(e) => setPlForm({ ...plForm, title: e.target.value })} placeholder="Título" aria-label="Título de la canción" className="rounded-lg border border-white/10 bg-void px-3 py-2 text-sm" />
              <input value={plForm.artist} onChange={(e) => setPlForm({ ...plForm, artist: e.target.value })} placeholder="Artista" aria-label="Artista de la canción" className="rounded-lg border border-white/10 bg-void px-3 py-2 text-sm" />
              <button className="btn-press rounded-lg bg-neon px-4 py-2 text-sm font-bold text-black">Agregar</button>
            </div>
          </form>
        </section>
      )}

      {/* ── COLA (lista doble viva) ────────────────────────── */}
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display font-bold">Cola — {songs.length} canciones</h3>
          <span className="ml-auto flex gap-2 text-xs">
            <button
              onClick={() => run(() => playlistService.clear())}
              disabled={songs.length === 0}
              className="rounded-full border border-red-400/40 px-3 py-1 text-red-300 transition-colors hover:border-red-400 hover:bg-red-400/10 disabled:opacity-40"
            >
              Vaciar lista
            </button>
          </span>
        </div>

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

        <ul className="stagger grid gap-2">
          {songs.map((s, i) => (
            <li
              key={s.id}
              className={`lift card-ring flex items-center gap-2 rounded-xl bg-panel px-3 py-2 ${s.id === currentId ? 'border-neon shadow-glow' : ''}`}
            >
              <span className="w-6 text-xs text-white/40">{i}</span>
              <Cover url={s.coverUrl} title={s.title} className="h-10 w-10 rounded-lg text-xs" />
              <button onClick={() => play(s.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold">{s.title}</p>
                <p className="truncate text-xs text-white/50">{s.artist} · {fmt(s.durationSec)}</p>
              </button>
              <FavHeart song={s} />
              <span className="flex flex-col text-white/60">
                <button
                  onClick={() => run(() => playlistService.move(i, i - 1))}
                  disabled={i === 0}
                  aria-label={`Subir ${s.title}`}
                  className="px-1 disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  onClick={() => run(() => playlistService.move(i, i + 1))}
                  disabled={i === songs.length - 1}
                  aria-label={`Bajar ${s.title}`}
                  className="px-1 disabled:opacity-30"
                >
                  ▼
                </button>
              </span>
              <button
                onClick={() => run(() => playlistService.removeAt(i))}
                aria-label={`Eliminar ${s.title}`}
                className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/60 hover:border-red-400/50 hover:text-red-300"
              >
                Eliminar
              </button>
            </li>
          ))}
          {songs.length === 0 && (
            <li className="card-ring rounded-xl bg-panel p-4 text-sm text-white/50">
              Vacía: busca en Inicio y pulsa + Cola, o agrega manual abajo.
            </li>
          )}
        </ul>

        {song && (
          <p className="text-xs text-white/50">
            Sonando: <span className="font-semibold text-white">{song.title}</span> — pulsa un título para cambiar el current.
          </p>
        )}

        <form onSubmit={addManual} className="card-ring grid gap-2 rounded-xl bg-panel p-3">
          <p className="text-sm font-semibold">Agregar canción (inicio / final / posición)</p>
          <div className="grid gap-2 md:grid-cols-2">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título" aria-label="Título" className="rounded-lg border border-white/10 bg-void px-3 py-2 text-sm" />
            <input value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} placeholder="Artista" aria-label="Artista" className="rounded-lg border border-white/10 bg-void px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {(['start', 'end', 'index'] as const).map((p) => (
              <label key={p} className="flex items-center gap-1 text-white/70">
                <input type="radio" checked={form.pos === p} onChange={() => setForm({ ...form, pos: p })} />
                {p === 'start' ? 'Inicio' : p === 'end' ? 'Final' : 'Posición N'}
              </label>
            ))}
            {form.pos === 'index' && (
              <input type="number" min={0} max={songs.length} value={form.index} onChange={(e) => setForm({ ...form, index: Number(e.target.value) })} aria-label="Posición" className="w-20 rounded-lg border border-white/10 bg-void px-2 py-1" />
            )}
            <button className="ml-auto rounded-lg bg-neon px-4 py-1.5 font-bold text-black">Agregar</button>
          </div>
        </form>

        <details className="card-ring rounded-xl bg-panel px-4 py-3 text-xs text-white/60 transition-colors hover:border-neon/40">
          <summary className="cursor-pointer font-bold text-white/80">Estructura lista doble (sustentación)</summary>
          <p className="mt-2 break-words font-mono">{playlistService.list.debugChain()}</p>
        </details>
      </section>
    </div>
  );
}
