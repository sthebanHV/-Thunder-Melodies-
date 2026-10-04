import { create } from 'zustand';

const KEY = 'wavely:theme';
export type Theme = 'dark' | 'light';

function load(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function applyDom(theme: Theme): void {
  try {
    document.documentElement.setAttribute('data-theme', theme);
  } catch {
    /* sin DOM (tests): solo estado */
  }
}

interface ThemeState {
  theme: Theme;
  set: (t: Theme) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: load(),
  set: (t) => {
    applyDom(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* storage bloqueado: el tema vive solo en memoria */
    }
    set({ theme: t });
  },
  toggle: () => get().set(get().theme === 'dark' ? 'light' : 'dark'),
}));

// Aplica el tema guardado al importar (respaldo del script inline de index.html).
if (typeof document !== 'undefined') applyDom(load());
