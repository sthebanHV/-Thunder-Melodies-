import { useState } from 'react';
import { usePlayerStore } from '../state/playerStore';
import { playlistService } from '../services/PlaylistService';
import { Cover, fmt } from '../components/ui';
import { FavHeart } from '../state/favStore';
import { toSong } from '../api/ytmusic';
import type { YTArtist, YTSearchItem } from '../api/ytmusic';
import type { CatalogActions, SearchType } from '../App';

export function HomeView({ items, stype, actions, onPlayMix, onDiscover }: {
  items: YTSearchItem[];
  stype: SearchType;
  actions: CatalogActions;
  onPlayMix: () => void;
  onDiscover: (query: string) => void;
}): React.JSX.Element {
  const { error, songs, currentId, play } = usePlayerStore();
  const [openArtist, setOpenArtist] = useState<string | null>(null);
  const [artistData, setArtistData] = useState<YTArtist | null>(null);
  const [loadingArtist, setLoadingArtist] = useState(false);
  const upNext = songs.filter((s) => s.id !== currentId).slice(0, 4);

  async function showArtist(browseId: string | null | undefined, title: string): Promise<void> {
    if (!browseId) return;
    if (openArtist === browseId) {
      setOpenArtist(null);
      return;
    }
    setOpenArtist(browseId);
    setLoadingArtist(true);
    try {
      setArtistData(await actions.expandArtist(browseId));
    } catch {
      setArtistData({ browseId, name: title, topSongs: [] });
    } finally {
      setLoadingArtist(false);
    }
  }
  return (
    <div className="grid gap-6 px-4 py-5 md:px-6 md:py-6">
      <header className="welcome"><p className="eyebrow">TU UNIVERSO SONORO</p><h1>Tu noche, <span>tu música.</span></h1><p>La banda sonora perfecta para cada momento.</p></header>
      <section className="frequency-hero card-ring">
        <div className="city-art" aria-hidden />
        <div className="hero-copy"><p className="eyebrow">MIX DESTACADO · THUNDER MELODIES</p><h2>EN TU<br /><span>FRECUENCIA</span></h2><p>Sonidos que te acompañan cuando la ciudad se apaga. Encuentra tu próxima canción favorita.</p><button onClick={onPlayMix} className="neon-button">▶ <span>Reproducir mix</span></button></div>
        <span className="hero-coordinate" aria-hidden>夜の音楽 / NIGHT FREQUENCY</span>
      </section>
      <section><div className="section-heading"><div><h2>Encuentra tu frecuencia</h2><p>Un ambiente para cada versión de ti.</p></div><span className="eyebrow">EXPLORA</span></div>
        <div className="mood-grid">{[
          ['Lluvia en la ciudad', 'Beats para noches introspectivas', 'night drive', 'city'],
          ['Viaje sin destino', 'Synthwave, retrowave y más', 'synthwave', 'sunset'],
          ['Mente en órbita', 'Electrónica para volar más alto', 'electronic', 'orbit'],
          ['Noches tranquilas', 'Lo-fi y atmósferas suaves', 'lofi chill', 'quiet'],
        ].map(([title, description, query, art]) => <button key={title} className={`mood-card lift ${art}`} onClick={() => {usePlayerStore.getState().setQuery(query); onDiscover(query);}}><span className="mood-art" aria-hidden /><span className="mood-copy"><span className="mood-play" aria-hidden>▶</span><span><strong>{title}</strong><small>{description}</small></span><span aria-hidden>↗</span></span></button>)}</div>
      </section>

      {/* RESULTADOS YTM EN VIVO POR TIPO */}
      {items.length > 0 && (
        <section>
          <h2 className="font-display font-bold">
            {stype === 'songs' ? 'Canciones' : stype === 'videos' ? 'Videos' : stype === 'albums' ? 'Álbumes' : stype === 'artists' ? 'Artistas' : 'Playlists'} en YouTube Music
          </h2>

          {(stype === 'songs' || stype === 'videos') && (
            <ul className="stagger mt-3 grid gap-2">
              {items.map((r, i) => {
                const s = toSong(r);
                return (
                  <li key={`${s.id}-${i}`} className="lift card-ring flex items-center gap-2 rounded-xl bg-panel px-3 py-2">
                    <Cover url={s.coverUrl} title={s.title} className="h-10 w-10 rounded-lg text-xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{s.title}</p>
                      <p className="truncate text-xs text-white/50">{s.artist}{s.durationSec ? ` · ${fmt(s.durationSec)}` : ''}</p>
                    </div>
                    <FavHeart song={s} />
                    <button
                      onClick={() => actions.playNow(s)}
                      aria-label={`Reproducir ${s.title}`}
                      title="Encolar y reproducir"
                      className="btn-press rounded-lg bg-neon px-2.5 py-1 text-sm font-bold text-black"
                    >
                      ▶
                    </button>
                    <button onClick={() => actions.playNext(s)} title="Encolar como siguiente" className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/70 transition-colors hover:border-neon/50 hover:text-white">⏭</button>
                    <button onClick={() => actions.enqueue(s)} className="btn-press rounded-lg bg-neon px-3 py-1 text-sm font-bold text-black">+ Cola</button>
                  </li>
                );
              })}
            </ul>
          )}

          {(stype === 'albums' || stype === 'playlists') && (
            <div className="stagger mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {items.map((r, i) => (
                <article key={`${r.browseId ?? r.playlistId ?? r.title}-${i}`} className="lift card-ring overflow-hidden rounded-xl bg-panel">
                  <Cover url={r.coverUrl} title={r.title} className="h-32 w-full text-2xl" />
                  <div className="p-2.5">
                    <p className="truncate text-xs font-bold">{r.title}</p>
                    <p className="truncate text-[11px] text-white/45">{r.artist}</p>
                    <button
                      onClick={() => stype === 'albums'
                        ? void actions.importAlbumById(r.browseId ?? '')
                        : void actions.importPlaylistById(r.playlistId ?? r.browseId ?? '')}
                      className="btn-press mt-2 w-full rounded-lg border border-neon/40 bg-neon/20 px-2 py-1 text-xs font-bold"
                    >
                      Importar a la cola
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {stype === 'artists' && (
            <div className="stagger mt-3 grid gap-2">
              {items.map((r, i) => (
                <div key={`${r.browseId ?? r.title}-${i}`} className="lift card-ring rounded-xl bg-panel px-3 py-2">
                  <button onClick={() => void showArtist(r.browseId, r.title)} className="flex w-full items-center gap-3 text-left">
                    <Cover url={r.coverUrl} title={r.title} className="h-12 w-12 rounded-full text-sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{r.title}</span>
                      <span className="block text-xs text-neon">{openArtist === r.browseId ? 'Ocultar top ▴' : 'Ver top ▾'}</span>
                    </span>
                  </button>
                  {openArtist === r.browseId && (
                    <div className="mt-2 border-t border-white/5 pt-2">
                      {loadingArtist && <p className="text-xs text-white/50">Cargando top…</p>}
                      {!loadingArtist && (artistData?.topSongs ?? []).map((t, j) => {
                        const s = toSong(t);
                        return (
                          <div key={`${s.id}-${j}`} className="flex items-center gap-2 py-1">
                            <span className="min-w-0 flex-1 truncate text-xs">{s.title} <span className="text-white/40">— {s.artist}</span></span>
                            <FavHeart song={s} />
                            <button
                              onClick={() => actions.playNow(s)}
                              aria-label={`Reproducir ${s.title}`}
                              title="Encolar y reproducir"
                              className="rounded-lg bg-neon px-2 py-0.5 text-xs font-bold text-black"
                            >
                              ▶
                            </button>
                            <button onClick={() => actions.enqueue(s)} className="rounded-lg bg-neon px-2 py-0.5 text-xs font-bold text-black">+ Cola</button>
                          </div>
                        );
                      })}
                      {!loadingArtist && (artistData?.topSongs ?? []).length === 0 && (
                        <p className="text-xs text-white/50">Sin top disponible.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      {/* Sin búsqueda activa: la cola mantiene viva la página */}
      {items.length === 0 && !error && (
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="font-display font-bold">Siguiente en tu cola</h2>
            <span className="text-[11px] tracking-[0.2em] text-white/40">{songs.length} EN COLA</span>
          </div>
          {songs.length === 0 ? (
            <p className="mt-3 card-ring rounded-xl bg-panel p-4 text-sm text-white/50">
              Tu cola está vacía. Busca arriba algo que te guste y pulsa ▶ para empezar.
            </p>
          ) : (
            <ul className="stagger mt-3 grid gap-2 sm:grid-cols-2">
              {(upNext.length > 0 ? upNext : songs.slice(0, 4)).map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => play(s.id)}
                    title="Reproducir ahora"
                    className="lift flex w-full items-center gap-2.5 rounded-xl border border-transparent bg-panel px-3 py-2 text-left"
                  >
                    <Cover url={s.coverUrl} title={s.title} className="h-11 w-11 shrink-0 rounded-lg text-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{s.title}</span>
                      <span className="block truncate text-xs text-white/50">{s.artist}</span>
                    </span>
                    <span className="shrink-0 text-xs text-neon">▶</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* TALLER: estructura visible pero discreta */}
      <details className="card-ring rounded-xl bg-panel px-4 py-3 text-xs text-white/60 transition-colors hover:border-neon/40">
        <summary className="cursor-pointer font-bold text-white/80">Estructura lista doble (sustentación)</summary>
        <p className="mt-2 break-words font-mono">{playlistService.list.debugChain()}</p>
      </details>
    </div>
  );
}
