import { playlistService } from './PlaylistService';
import { videoEngine } from './VideoEngine';
import { getFile } from './localFiles';
import { usePlayerStore } from '../state/playerStore';


/**
 * Coordinador de reproducción (delgado por diseño):
 * - Cada acción de reproducción (play/next/prev/retry) recarga la pista
 *   desde 0:00 vía un contador loadKick en el store.
 * - Dos motores ruteados por tipo de pista: YouTube (videoId) y archivo
 *   local subido (song.local → HTMLAudio con blob de IndexedDB).
 * - Sin saltos automáticos: los fallos quedan en estado 'error' y decide
 *   el usuario (Reintentar / Siguiente). La única transición automática
 *   es reanudar al volver de pausa y avanzar al terminar (store.finish).
 * La UI nunca toca reproductores; solo llama a toggle()/retry()/setVolume().
 */
class AudioEngine {
  private unsub: (() => void) | null = null;
  /** Motor activo: ruta pausa/reanuda/volumen al reproductor correcto. */
  private active: 'yt' | 'local' | null = null;
  /** Pista en carga (guarda carreras del async de IndexedDB). */
  private trackId: string | null = null;
  private audio: HTMLAudioElement | null = null;
  private localUrl: string | null = null;
  private volume01 = 0.8;

  attach(): void {
    if (this.unsub) return;
    this.unsub = usePlayerStore.subscribe((s, prev) => {
      const curChanged = s.currentId !== prev.currentId;
      if (s.currentId && s.loadKick !== prev.loadKick) {
        // Carga nueva: play/next/prev/retry (siempre desde 0:00).
        void this.load(s.currentId);
      } else if (s.currentId && curChanged && prev.status === 'playing') {
        // Se quitó la que sonaba y sigue sonando: carga la vecina.
        void this.load(s.currentId);
      } else if (curChanged && s.currentId) {
        // Cambió la pista sin reproducción activa: corta rastro del motor.
        this.stopAll();
        if (s.status === 'paused' || s.status === 'error') {
          s.setStatus('idle');
          s.setError(null);
        }
      } else if (!s.currentId && prev.currentId) {
        this.stopAll();
        if (s.status !== 'error') s.setStatus('idle');
      }
      if (s.status === 'paused' && prev.status !== 'paused') this.pauseActive();
      if (s.status === 'playing' && prev.status === 'paused') this.resumeActive();
    });
  }

  detach(): void {
    this.unsub?.();
    this.unsub = null;
    this.stopAll();
  }

  /** Carga y reproduce la pista desde 0:00. Nunca salta a otra. */
  private async load(id: string): Promise<void> {
    const song = playlistService.snapshot().songs.find((s) => s.id === id);
    const st = usePlayerStore.getState();
    if (!song) {
      st.setStatus('idle');
      return;
    }
    this.trackId = id;
    st.setProgress(0, song.durationSec || null);
    st.setError(null);
    st.setErrorCode(null);

    if (song.local) {
      await this.loadLocal(id);
      return;
    }

    // Ruta YouTube: corta el motor local antes de arrancar el video.
    this.active = 'yt';
    this.pauseLocalAudio();
    st.setSource('video');
    if (!song.videoId) {
      // Sin fuente completa no se reproduce: se queda aquí con el motivo.
      st.setStatus('error');
      st.setError(`"${song.title}" no tiene versión completa en el catálogo.`);
      return;
    }
    st.setStatus('loading');
    videoEngine.load(song.videoId);
  }

  /** Archivo local: blob de IndexedDB → object URL → HTMLAudioElement. */
  private async loadLocal(id: string): Promise<void> {
    const st = usePlayerStore.getState();
    this.active = null;
    this.pauseLocalAudio();
    st.setStatus('loading');
    st.setSource('local');
    st.setDiag({ diagYt: 'archivo local' });
    // Deja de sonar el video de YouTube si lo había.
    videoEngine.stop();
    this.active = 'local';

    let blob: Blob | null = null;
    try {
      blob = await getFile(id);
    } catch {
      blob = null;
    }
    if (this.trackId !== id || usePlayerStore.getState().currentId !== id) return;
    if (!blob) {
      st.setStatus('error');
      st.setError('El archivo local ya no está en este navegador. Vuelve a subirlo desde "Subir música".');
      return;
    }

    if (this.localUrl) URL.revokeObjectURL(this.localUrl);
    this.localUrl = URL.createObjectURL(blob);
    const a = this.ensureAudio();
    a.src = this.localUrl;
    try {
      a.currentTime = 0;
    } catch {
      /* aún sin metadatos */
    }
    a.volume = this.volume01;
    try {
      await a.play();
    } catch {
      if (this.trackId === id) {
        st.setStatus('error');
        st.setError('El navegador bloqueó la reproducción del archivo local. Pulsa Reintentar.');
      }
    }
  }

  /** Crea el elemento <audio> una sola vez y conecta sus eventos. */
  private ensureAudio(): HTMLAudioElement {
    if (this.audio) return this.audio;
    const a = new Audio();
    a.preload = 'auto';
    a.addEventListener('playing', () => {
      if (this.active !== 'local') return;
      const st = usePlayerStore.getState();
      st.setStatus('playing');
      st.setError(null);
      st.setErrorCode(null);
    });
    a.addEventListener('pause', () => {
      if (this.active !== 'local') return;
      const st = usePlayerStore.getState();
      if (st.status !== 'loading') st.setStatus('paused');
    });
    a.addEventListener('ended', () => {
      if (this.active !== 'local') return;
      usePlayerStore.getState().finish();
    });
    a.addEventListener('error', () => {
      if (this.active !== 'local') return;
      const st = usePlayerStore.getState();
      if (st.status === 'idle') return;
      st.setStatus('error');
      st.setError('No se pudo leer el archivo de audio. Puede estar dañado o en un formato no soportado.');
    });
    a.addEventListener('timeupdate', () => {
      if (this.active !== 'local') return;
      const st = usePlayerStore.getState();
      const dur = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : st.durationSec;
      st.setProgress(a.currentTime, dur);
    });
    this.audio = a;
    return a;
  }

  private pauseLocalAudio(): void {
    this.audio?.pause();
  }

  private stopAll(): void {
    this.trackId = null;
    this.active = null;
    this.pauseLocalAudio();
    videoEngine.stop();
    usePlayerStore.getState().setSource(null);
  }

  private pauseActive(): void {
    if (this.active === 'local') this.pauseLocalAudio();
    else videoEngine.pause();
  }

  private resumeActive(): void {
    if (this.active === 'local') void this.audio?.play().catch(() => undefined);
    else videoEngine.resume();
  }

  seek(seconds: number): void {
    const st = usePlayerStore.getState();
    const duration = st.durationSec ?? 0;
    const target = Math.max(0, Math.min(duration, seconds));
    if (!Number.isFinite(target) || !duration) return;
    if (this.active === 'local' && this.audio) this.audio.currentTime = target;
    else if (this.active === 'yt') videoEngine.seek(target);
    st.setProgress(target, duration);
  }

  /** Volumen para los dos motores (la barra inferior lo envía aquí). */
  setVolume(v01: number): void {
    this.volume01 = v01;
    if (this.audio) this.audio.volume = v01;
    videoEngine.setVolume(v01);
  }

  /** Reintenta la pista actual (botón "Reintentar"). */
  retry(): void {
    const st = usePlayerStore.getState();
    if (!st.currentId) return;
    usePlayerStore.setState({
      status: 'loading',
      error: null,
      errorCode: null,
      loadKick: st.loadKick + 1,
    });
  }

  toggle(): void {
    const st = usePlayerStore.getState();
    if (!st.currentId) return;
    if (st.status === 'playing') {
      st.pause();
    } else if (st.status === 'paused') {
      this.resumeActive();
    } else {
      // idle | loading | error | fin: (re)carga la pista actual.
      this.retry();
    }
  }
}

export const audioEngine = new AudioEngine();
