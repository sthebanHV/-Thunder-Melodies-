import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from './state/playerStore';
import { playlistService } from './services/PlaylistService';
import { audioEngine } from './services/AudioEngine';
import { searchYTM, getAlbum, getArtist, getPlaylist, toSong } from './api/ytmusic';
import type { YTAlbum, YTArtist, YTPlaylist, YTSearchItem } from './api/ytmusic';
import type { Song } from './domain/playlist/DoublyLinkedList';
import { Sidebar, QueuePanel } from './components/Sidebar';
import { Topbar, BottomPlayer } from './components/Chrome';
import { HomeView } from './views/Home';
import { ListsView } from './views/Lists';
import { FavsView } from './views/Favs';
import { UploadView } from './views/Upload';
import { YouTubePlayer } from './components/YouTubePlayer';
import { NowPlaying } from './views/NowPlaying';

export type View = 'home' | 'lists' | 'favs' | 'playing' | 'upload';
export type SearchType = 'songs' | 'videos' | 'albums' | 'artists' | 'playlists';

export interface CatalogActions {
  enqueue: (t: Song) => void;
  playNext: (t: Song) => void;
  playNow: (t: Song) => void;
  importAlbumById: (browseId: string) => Promise<void>;
  importPlaylistById: (playlistId: string) => Promise<void>;
  expandArtist: (browseId: string) => Promise<YTArtist>;
}

export default function App(): React.JSX.Element {
  const { query, setQuery, setError } = usePlayerStore();
  const [view, setView] = useState<View>('home');
  const [items, setItems] = useState<YTSearchItem[]>([]);
  const [stype, setStype] = useState<SearchType>('songs');
  const [searchKick, setSearchKick] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    audioEngine.attach();
    return () => audioEngine.detach();
  }, []);

  useEffect(() => {
    setItems([]);
    setNotice(null);
    if (query.trim().length < 2) return;
    const ctrl = new AbortController();
    timer.current = window.setTimeout(() => {
      setNotice('Buscando en YouTube Music…');
      void searchYTM(query, stype, ctrl.signal).then(res => {
        if (ctrl.signal.aborted) return;
        setItems(res);
        setNotice(res.length ? null : 'No se encontraron resultados. Prueba con otro título o artista.');
      }).catch(error => {
        if (!ctrl.signal.aborted) setNotice(error instanceof Error ? error.message : 'No se pudo buscar.');
      });
    }, 280);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      ctrl.abort();
    };
  }, [query, stype, searchKick]);

  function enqueue(t: Song): void {
    try {
      playlistService.addLast(t);
      usePlayerStore.getState().refresh();
      setError(null);
      // Si nada estaba sonando (cola vacía o fin de cola), el primer
      // "encolar" arranca la música como en un reproductor normal.
      const st = usePlayerStore.getState();
      if (st.status === 'idle') st.play(t.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duplicado');
    }
  }

  function playNext(t: Song): void {
    try {
      playlistService.playNext(t);
      usePlayerStore.getState().refresh();
      setError(null);
      const st = usePlayerStore.getState();
      if (st.status === 'idle') st.play(t.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo encolar siguiente');
    }
  }

  /** Encola si falta y reproduce inmediatamente (botón ▶ de resultados). */
  function playNow(t: Song): void {
    try {
      playlistService.addLast(t);
    } catch {
      /* ya estaba en la cola */
    }
    setError(null);
    usePlayerStore.getState().play(t.id);
  }

  function importTracks(tracks: YTSearchItem[], label: string): void {
    let n = 0;
    for (const t of tracks) {
      try {
        playlistService.addLast(toSong(t));
        n += 1;
      } catch { /* duplicado */ }
    }
    usePlayerStore.getState().refresh();
    setNotice(`${label}: ${n} pistas a la cola`);
  }

  async function importAlbumById(browseId: string): Promise<void> {
    try {
      const a: YTAlbum = await getAlbum(browseId);
      importTracks(a.tracks, `Álbum "${a.title}" importado`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'No se pudo importar álbum');
    }
  }

  async function importPlaylistById(playlistId: string): Promise<void> {
    try {
      const p: YTPlaylist = await getPlaylist(playlistId);
      importTracks(p.tracks, `Playlist "${p.title}" importada`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'No se pudo importar playlist');
    }
  }

  async function expandArtist(browseId: string): Promise<YTArtist> {
    return getArtist(browseId);
  }

  async function playMix(): Promise<void> {
    const pool = (stype === 'songs' || stype === 'videos') && items.length > 0 ? items.filter(t => t.videoId).map(toSong) : await searchYTM('night drive', 'songs').then(res => res.map(toSong)).catch(() => []);
    const take = pool.slice(0, 5);
    if (take.length === 0) {
      setNotice('Mix no disponible: enciende el backend YT (:3001/:8001)');
      return;
    }
    for (const t of take) {
      try {
        playlistService.addLast(t);
      } catch { /* duplicado */ }
    }
    const snap = playlistService.snapshot();
    usePlayerStore.getState().refresh();
    if (snap.songs.length > 0) {
      usePlayerStore.getState().play(snap.songs[0].id);
      setView('playing');
    }
  }

  const actions: CatalogActions = { enqueue, playNext, playNow, importAlbumById, importPlaylistById, expandArtist };

  return (
    <div className="min-h-screen bg-void font-body text-white">
      {/* Aurora de fondo: deriva lenta detrás de todo el contenido */}
      <div className="aurora" aria-hidden>
        <i className="a1" />
        <i className="a2" />
        <i className="a3" />
      </div>
      {/* Barra móvil */}
      <div className="relative z-10 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/5 bg-black/60 px-4 py-2.5 md:hidden">
        <span className="text-neon text-xl">✦</span>
        <span className="font-display text-lg font-extrabold italic text-neon">Thunder Melodies</span>
        <div className="ml-auto flex gap-0.5 text-xs">
          {([
            ['home', 'Inicio'],
            ['upload', 'Subir'],
            ['lists', 'Listas'],
            ['favs', 'Favs'],
            ['playing', 'Sonando'],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-lg px-2 py-1 ${view === v ? 'bg-neon/25' : 'text-white/60'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-10 mx-auto flex max-w-[1800px] items-start">
        <Sidebar view={view} go={setView} />
        <main className="min-w-0 flex-1 pb-24">
          <Topbar onSearch={setQuery} />
          {(view === 'home') && (
            <div className="flex flex-wrap items-center gap-2 px-4 pt-4 text-xs md:px-6">
              {(['songs', 'videos', 'albums', 'artists', 'playlists'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setStype(t)}
                  aria-pressed={stype === t}
                  className={`rounded-full border px-3 py-1 transition-colors duration-200 ${stype === t ? 'border-neon bg-neon/20 text-white' : 'border-white/15 text-white/55 hover:border-neon/50 hover:text-white'}`}
                >
                  {t === 'songs' ? 'Canciones' : t === 'videos' ? 'Videos' : t === 'albums' ? 'Álbumes' : t === 'artists' ? 'Artistas' : 'Playlists'}
                </button>
              ))}
              <button onClick={() => setSearchKick(k => k + 1)} className="btn-press rounded-full bg-neon px-3 py-1 font-bold text-black">Buscar YT</button>
            </div>
          )}
          {notice && <p className="px-4 pt-2 text-xs text-accent2 md:px-6">{notice}</p>}
          <div key={view} className="view-enter">
            {view === 'home' && <HomeView items={items} stype={stype} actions={actions} onPlayMix={playMix} onDiscover={(q) => { setStype('songs'); setQuery(q); }} />}
            {view === 'upload' && <UploadView />}
            {view === 'lists' && <ListsView />}
            {view === 'favs' && <FavsView />}
            {view === 'playing' && <NowPlaying />}
          </div>
        </main>
        <QueuePanel onOpen={() => setView('playing')} />
      </div>
      <BottomPlayer /><YouTubePlayer />
    </div>
  );
}
