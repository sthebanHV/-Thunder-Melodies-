import { create } from 'zustand';
import type { Song } from '../domain/playlist/DoublyLinkedList';

const KEY = 'wavely:favs:v1';

function load(): Song[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Song[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

interface FavState {
  favs: Song[];
  toggle: (s: Song) => void;
  remove: (id: string) => void;
  has: (id: string) => boolean;
}

export const useFavStore = create<FavState>((set, get) => ({
  favs: load(),
  toggle: (s) => {
    const has = get().favs.some((f) => f.id === s.id);
    const favs = has ? get().favs.filter((f) => f.id !== s.id) : [...get().favs, s];
    try {
      localStorage.setItem(KEY, JSON.stringify(favs));
    } catch {
      /* storage lleno: mantiene en memoria */
    }
    set({ favs });
  },
  remove: (id) => {
    const favs = get().favs.filter((f) => f.id !== id);
    try {
      localStorage.setItem(KEY, JSON.stringify(favs));
    } catch {
      /* ignora */
    }
    set({ favs });
  },
  has: (id) => get().favs.some((f) => f.id === id),
}));

export function FavHeart({ song }: { song: Song }): React.JSX.Element {
  const { toggle, favs } = useFavStore();
  const on = favs.some((f) => f.id === song.id);
  return (
    <button
      onClick={() => toggle(song)}
      aria-label={on ? `Quitar ${song.title} de favoritos` : `Agregar ${song.title} a favoritos`}
      aria-pressed={on}
      className={on ? 'text-neon' : 'text-white/40 hover:text-neon'}
    >
      {on ? '♥' : '♡'}
    </button>
  );
}
