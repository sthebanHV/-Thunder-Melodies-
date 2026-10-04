import { create } from 'zustand';
import { playlistService } from '../services/PlaylistService';
import type { Song } from '../domain/playlist/DoublyLinkedList';

type Status = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface PlayerState {
  status: Status;
  songs: Song[];
  currentId: string | null;
  query: string;
  repeatAll: boolean;
  videoExpanded: boolean;
  setVideoExpanded: (expanded: boolean) => void;
  error: string | null;
  /** Código YouTube del último fallo (2/5/100/101/150) para diagnóstico. */
  errorCode: number | null;
  /**
   * Contador de "cargar (de nuevo) la pista actual". Cada acción de
   * reproducción (play/next/prev/retry) lo incrementa y AudioEngine
   * recarga desde 0:00. Así "misma pista" también suena, sin estado fantasma.
   */
  loadKick: number;
  refresh: () => void;
  play: (id: string) => void;
  next: () => void;
  prev: () => void;
  /** Fin de pista (evento ended): avanza si hay siguiente; si no, idle. */
  finish: () => void;
  remove: (id: string) => void;
  pause: () => void;
  resume: () => void;
  setStatus: (s: Status) => void;
  /** Duración real de la pista en curso (s) y posición actual (s). */
  durationSec: number | null;
  posSec: number;
  setProgress: (pos: number, dur: number | null) => void;
  /** Fuente de audio: vídeo completo de YouTube o archivo local subido. */
  source: 'video' | 'local' | null;
  setSource: (s: 'video' | 'local' | null) => void;
  /** Diagnóstico del motor YouTube para la línea de estado en Sonando. */
  diagApi: 'cargando' | 'lista' | 'fallo';
  diagYt: string;
  diagErr: number | null;
  setDiag: (d: Partial<Pick<PlayerState, 'diagApi' | 'diagYt' | 'diagErr'>>) => void;
  setQuery: (q: string) => void;
  setError: (e: string | null) => void;
  setErrorCode: (c: number | null) => void;
}

function sync(): Pick<PlayerState, 'songs' | 'currentId'> {
  return playlistService.snapshot();
}

function kick(): Pick<PlayerState, 'loadKick'> {
  return { loadKick: usePlayerStore.getState().loadKick + 1 };
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  status: 'idle',
  songs: sync().songs,
  currentId: sync().currentId,
  query: '',
  repeatAll: false,
  videoExpanded: false,
  setVideoExpanded: (videoExpanded) => set({ videoExpanded }),
  error: null,
  errorCode: null,
  loadKick: 0,
  refresh: () => set({ ...sync() }),
  play: (id) => {
    const ok = playlistService.play(id);
    if (ok) {
      // Sin estado "sonando" fantasma: el motor confirma al arrancar.
      set({ ...sync(), status: 'loading', error: null, errorCode: null, ...kick() });
    } else {
      set({ error: 'Esa canción ya no está en la cola' });
    }
  },
  next: () => {
    playlistService.next(get().repeatAll);
    const snap = sync();
    set({
      ...snap,
      status: snap.currentId ? 'loading' : 'idle',
      error: null,
      errorCode: null,
      ...(snap.currentId ? kick() : {}),
    });
  },
  prev: () => {
    playlistService.previous();
    const snap = sync();
    set({
      ...snap,
      status: snap.currentId ? 'loading' : 'idle',
      error: null,
      errorCode: null,
      ...(snap.currentId ? kick() : {}),
    });
  },
  finish: () => {
    const st = get();
    const idx = st.songs.findIndex((s) => s.id === st.currentId);
    const hasNext = st.repeatAll ? st.songs.length > 0 : idx >= 0 && idx < st.songs.length - 1;
    if (hasNext) {
      st.next();
    } else {
      st.setStatus('idle');
    }
  },
  remove: (id) => {
    playlistService.removeById(id);
    // Si se quitó la pista actual, currentId cambia y el motor carga la vecina.
    set({ ...sync() });
  },
  pause: () => set({ status: 'paused' }),
  resume: () => set({ status: 'playing' }),
  setStatus: (status) => set({ status }),
  durationSec: null,
  posSec: 0,
  setProgress: (posSec, durationSec) => set({ posSec, durationSec }),
  source: null,
  setSource: (source) => set({ source }),
  diagApi: 'cargando',
  diagYt: '—',
  diagErr: null,
  setDiag: (d) => set(d),
  setQuery: (query) => set({ query }),
  setError: (error) => set({ error }),
  setErrorCode: (errorCode) => set({ errorCode }),
}));

export function currentSong(songs: Song[], currentId: string | null): Song | null {
  return songs.find((s) => s.id === currentId) ?? null;
}
