import { usePlayerStore } from '../state/playerStore';

/** Estados del reproductor de YouTube (YT.PlayerState). */
const YT_ENDED = 0;
const YT_PLAYING = 1;
const YT_PAUSED = 2;
const YT_CUED = 5;

interface YTPlayerLike {
  loadVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  setVolume(v: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getVideoData(): { video_id?: string };
}

interface YTNamespace {
  Player: new (
    elId: string,
    opts: {
      height: string;
      width: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: (e: { target: { setVolume(v: number): void } }) => void;
        onStateChange: (e: { data: number }) => void;
        onError: (e: { data: number }) => void;
        onAutoplayBlocked: () => void;
      };
    },
  ) => YTPlayerLike;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Mensaje humano para los códigos de error del reproductor. */
function hintFor(code: number): string {
  if (code === 101 || code === 150) {
    return `Este video no permite la reproducción integrada (código ${code}). Ábrelo en YouTube o elige otra canción.`;
  }
  if (code === 100) return 'Video no encontrado (código 100). Prueba con otra canción.';
  if (code === 5) return 'YouTube rechazó la reproducción (código 5). Revisa tu conexión o prueba otra canción.';
  if (code === 153) return 'YouTube no recibió la identificación del sitio (153). Abre la app desde su servidor local, no como archivo HTML.';
  if (code === 2) return 'Video inválido (código 2). Prueba con otra canción.';
  return `YouTube no pudo reproducir este video (código ${code}).`;
}

/**
 * Reproductor único de YouTube (audio completo desde 0:00 hasta el fin).
 * Reglas: carga siempre desde el inicio; si termina, avanza solo; si falla,
 * se queda en la pista con estado 'error' (sin saltos automáticos: decide
 * el usuario con Reintentar / Siguiente). Se comunica solo vía el store.
 */
class VideoEngine {
  private player: YTPlayerLike | null = null;
  private ready = false;
  /** Video pedido antes de que el player esté listo: se carga en onReady. */
  private pendingId: string | null = null;
  private poll: number | null = null;
  private attaching = false;
  private volume01 = 0.8;
  private expectedId: string | null = null;
  private bootTimer: number | null = null;
  private loadTimer: number | null = null;

  static readonly EL_ID = 'yt-full-audio';

  private diag(d: { api?: 'cargando' | 'lista' | 'fallo'; yt?: string; err?: number | null }): void {
    const patch: { diagApi?: 'cargando' | 'lista' | 'fallo'; diagYt?: string; diagErr?: number | null } = {};
    if (d.api) patch.diagApi = d.api;
    if (d.yt !== undefined) patch.diagYt = d.yt;
    if (d.err !== undefined) patch.diagErr = d.err;
    usePlayerStore.getState().setDiag(patch);
  }

  attach(): void {
    if (this.player || this.attaching) return;
    this.attaching = true;
    this.diag({ api: 'cargando', err: null });
    const failed = () => {
      this.attaching = false;
      this.diag({ api: 'fallo', yt: 'sin conexión' });
      document.querySelector('script[data-yt-api]')?.remove();
      if (this.pendingId && usePlayerStore.getState().source === 'video') {
        this.onError(-1);
        usePlayerStore.getState().setError('No se pudo conectar con el reproductor de YouTube. Revisa la conexión y pulsa Reintentar.');
      }
    };
    this.bootTimer = window.setTimeout(failed, 15000);
    if (window.YT?.Player) { this.create(); return; }
    window.onYouTubeIframeAPIReady = () => this.create();
    if (!document.querySelector('script[data-yt-api]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.dataset.ytApi = '1';
      tag.onerror = failed;
      document.head.appendChild(tag);
    }
  }

  private create(): void {
    if (this.player || !window.YT?.Player) return;
    if (!document.getElementById(VideoEngine.EL_ID)) {
      // El div aún no existe (App lo monta): reintenta en el próximo tick.
      window.setTimeout(() => this.create(), 300);
      return;
    }
    this.player = new window.YT.Player(VideoEngine.EL_ID, {
      height: '200',
      width: '320',
      playerVars: { rel: 0, playsinline: 1, origin: window.location.origin },
      events: {
        onReady: (e) => {
          if (this.bootTimer !== null) window.clearTimeout(this.bootTimer);
          this.ready = true;
          this.attaching = false;
          try {
            e.target.setVolume(Math.round(this.volume01 * 100));
          } catch {
            /* volumen por defecto si falla */
          }
          this.diag({ api: 'lista', yt: 'listo' });
          if (this.pendingId) {
            this.player?.loadVideoById(this.pendingId);
            this.pendingId = null;
          }
        },
        onStateChange: (e) => this.onState(e.data),
        onError: (e) => this.onError(e.data),
        onAutoplayBlocked: () => {
          if (usePlayerStore.getState().source !== 'video') return;
          this.clearLoadTimer();
          usePlayerStore.getState().setStatus('paused');
          this.diag({ yt: 'pulsa reproducir' });
        },
      },
    });
  }

  /**
   * Carga y reproduce una canción desde 0:00. Si el player aún no está
   * listo, se guarda como pendiente y se carga apenas esté.
   */
  load(videoId: string): void {
    this.expectedId = videoId;
    this.clearLoadTimer();
    this.diag({ yt: 'cargando video…', err: null });
    this.loadTimer = window.setTimeout(() => {
      const st = usePlayerStore.getState();
      if (st.source === 'video' && st.status === 'loading') {
        st.setStatus('error');
        st.setError('YouTube no inició la reproducción. Pulsa Reintentar o prueba otra canción.');
      }
    }, 25000);
    if (this.ready && this.player) {
      this.pendingId = null;
      this.player.loadVideoById(videoId); // siempre desde el inicio
      this.diag({ yt: 'video pedido' });
    } else {
      this.pendingId = videoId;
      this.attach();
    }
    this.startPoll();
  }

  pause(): void {
    if (this.ready && this.player) this.player.pauseVideo();
    this.stopPoll();
  }

  resume(): void {
    if (this.ready && this.player) this.player.playVideo();
    this.startPoll();
  }

  stop(): void {
    this.pendingId = null;
    this.expectedId = null;
    this.clearLoadTimer();
    if (this.ready && this.player) this.player.stopVideo();
    this.stopPoll();
  }

  setVolume(v01: number): void {
    this.volume01 = v01;
    if (this.ready && this.player) this.player.setVolume(Math.round(v01 * 100));
  }

  private onState(state: number): void {
    const st = usePlayerStore.getState();
    if (st.source !== 'video' || !this.expectedId) return;
    const actualId = this.player?.getVideoData().video_id;
    if (actualId && actualId !== this.expectedId) return;
    const names: Record<number, string> = {
      [-1]: 'sin iniciar',
      0: 'terminado',
      1: 'sonando',
      2: 'pausado',
      3: 'cargando datos',
      5: 'en cola',
    };
    this.diag({ yt: names[state] ?? `estado ${state}` });

    if (state === YT_PLAYING) {
      this.clearLoadTimer();
      this.sampleProgress();
      st.setStatus('playing');
      st.setError(null);
      st.setErrorCode(null);
      this.startPoll();
    } else if (state === YT_PAUSED) {
      this.sampleProgress();
      // Si hay una carga en curso ('loading'), un PAUSED tardío de la pista
      // anterior no debe pausar la nueva.
      if (st.status !== 'loading') st.setStatus('paused');
      this.stopPoll();
    } else if (state === YT_CUED) {
      // Tras cargar, el player queda "en cola": se pide reproducción.
      this.player?.playVideo();
    } else if (state === YT_ENDED) {
      // Único avance automático: la canción terminó sola (store.finish decide).
      this.stopPoll();
      usePlayerStore.getState().finish();
    }
  }

  private onError(code: number): void {
    // Sin saltos automáticos: la pista se queda en 'error' y decide el usuario.
    if (usePlayerStore.getState().source !== 'video' || !this.expectedId) return;
    this.clearLoadTimer();
    this.stopPoll();
    this.diag({ err: code, yt: `error ${code}` });
    const st = usePlayerStore.getState();
    st.setErrorCode(code);
    st.setError(hintFor(code));
    st.setStatus('error');
  }

  seek(seconds: number): void {
    if (this.ready && this.player) this.player.seekTo(Math.max(0, seconds), true);
  }

  private clearLoadTimer(): void {
    if (this.loadTimer !== null) window.clearTimeout(this.loadTimer);
    this.loadTimer = null;
  }

  private sampleProgress(): void {
    try {
      const duration = this.player?.getDuration() ?? 0;
      const position = this.player?.getCurrentTime() ?? 0;
      if (duration > 0 && usePlayerStore.getState().source === 'video' && this.expectedId) {
        usePlayerStore.getState().setProgress(position, duration);
      }
    } catch { /* YouTube todavía no tiene los metadatos. */ }
  }

  private startPoll(): void {
    this.stopPoll();
    this.poll = window.setInterval(() => this.sampleProgress(), 500);
  }

  private stopPoll(): void {
    if (this.poll !== null) {
      window.clearInterval(this.poll);
      this.poll = null;
    }
  }
}

export const videoEngine = new VideoEngine();
