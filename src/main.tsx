import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Depuración en dev: permite inspeccionar store/motor desde la consola
// (window.__tm). En build de producción se elimina (import.meta.env.DEV).
if (import.meta.env.DEV) {
  void import('./state/playerStore').then(({ usePlayerStore }) => {
    void import('./services/VideoEngine').then(({ videoEngine }) => {
      void import('./services/AudioEngine').then(({ audioEngine }) => {
        void import('./services/PlaylistService').then(({ playlistService }) => {
          (window as unknown as Record<string, unknown>).__tm = {
            store: usePlayerStore,
            videoEngine,
            audioEngine,
            playlistService,
          };
        });
      });
    });
  });
}
