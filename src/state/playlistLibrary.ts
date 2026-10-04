import { create } from 'zustand';
import type { Song } from '../domain/playlist/DoublyLinkedList';

const KEY = 'wavely:playlists:v1';

export interface Playlist {
  id: string;
  name: string;
  songs: Song[];
  createdAt: number;
}

function load(): Playlist[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Playlist[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function persist(playlists: Playlist[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(playlists));
  } catch {
    /* storage lleno o bloqueado: mantiene en memoria */
  }
}

interface LibraryState {
  playlists: Playlist[];
  /** Crea una playlist (nombre único, case-insensitive). Devuelve su id. */
  create: (name: string, songs?: Song[]) => string;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  addSong: (id: string, song: Song) => void;
  removeSong: (id: string, songId: string) => void;
}

export const usePlaylistStore = create<LibraryState>((set, get) => {
  function checkName(name: string, ignoreId?: string): string {
    const clean = name.trim();
    if (!clean) throw new Error('Ponle un nombre a la playlist');
    const dup = get().playlists.some(
      (p) => p.id !== ignoreId && p.name.toLowerCase() === clean.toLowerCase(),
    );
    if (dup) throw new Error(`Ya existe una playlist llamada "${clean}"`);
    return clean;
  }

  function commit(playlists: Playlist[]): void {
    persist(playlists);
    set({ playlists });
  }

  return {
    playlists: load(),

    create: (name, songs = []) => {
      const clean = checkName(name);
      const pl: Playlist = {
        id: `pl:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
        name: clean,
        songs: [...songs],
        createdAt: Date.now(),
      };
      commit([...get().playlists, pl]);
      return pl.id;
    },

    rename: (id, name) => {
      const clean = checkName(name, id);
      commit(
        get().playlists.map((p) => (p.id === id ? { ...p, name: clean } : p)),
      );
    },

    remove: (id) => {
      commit(get().playlists.filter((p) => p.id !== id));
    },

    addSong: (id, song) => {
      const pl = get().playlists.find((p) => p.id === id);
      if (!pl) throw new Error('Playlist no encontrada');
      if (pl.songs.some((s) => s.id === song.id)) {
        throw new Error(`"${song.title}" ya está en la playlist`);
      }
      commit(
        get().playlists.map((p) =>
          p.id === id ? { ...p, songs: [...p.songs, song] } : p,
        ),
      );
    },

    removeSong: (id, songId) => {
      commit(
        get().playlists.map((p) =>
          p.id === id ? { ...p, songs: p.songs.filter((s) => s.id !== songId) } : p,
        ),
      );
    },
  };
});
