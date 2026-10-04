import { usePlayerStore } from '../state/playerStore';
import { playlistService } from '../services/PlaylistService';
import { useFavStore } from '../state/favStore';
import { Cover, fmt } from '../components/ui';

/** Vista Favoritos: canciones marcadas con ♥, persisten en localStorage. */
export function FavsView(): React.JSX.Element {
  const { favs, remove } = useFavStore();
  const { play, refresh } = usePlayerStore();

  function playFav(f: { id: string; title: string; artist: string; durationSec: number; album?: string; coverUrl?: string; videoId?: string | null }): void {
    // Si no está en la cola, entra primero; luego suena (encolar y sonar).
    const inQueue = playlistService.snapshot().songs.some((s) => s.id === f.id);
    if (!inQueue) {
      try {
        playlistService.addLast({ ...f });
      } catch {
        /* duplicado de carrera: sigue a reproducir */
      }
      refresh();
    }
    play(f.id);
  }

  return (
    <div className="grid gap-4 px-4 py-5 md:px-6 md:py-6">
      <h2 className="font-display text-xl font-bold">Favoritos — {favs.length}</h2>
      {favs.length === 0 ? (
        <p className="card-ring rounded-xl bg-panel p-4 text-sm text-white/50">
          Sin favoritos todavía: pulsa ♡ en cualquier canción de Inicio o Listas.
        </p>
      ) : (
        <ul className="stagger grid gap-2">
          {favs.map((f) => (
            <li key={f.id} className="lift card-ring flex items-center gap-2 rounded-xl bg-panel px-3 py-2">
              <Cover url={f.coverUrl} title={f.title} className="h-10 w-10 rounded-lg text-xs" />
              <button onClick={() => playFav(f)} className="min-w-0 flex-1 text-left" title="Encolar y sonar">
                <p className="truncate text-sm font-semibold">{f.title}</p>
                <p className="truncate text-xs text-white/50">{f.artist} · {fmt(f.durationSec)}</p>
              </button>
              <button
                onClick={() => playFav(f)}
                className="rounded-lg bg-neon/20 border border-neon/40 px-2 py-1 text-xs font-bold"
              >
                ▶ Sonar
              </button>
              <button
                onClick={() => remove(f.id)}
                aria-label={`Quitar ${f.title} de favoritos`}
                className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/60 hover:border-red-400/50 hover:text-red-300"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
