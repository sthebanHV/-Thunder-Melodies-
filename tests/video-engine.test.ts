import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { usePlayerStore } from '../src/state/playerStore';

type Events = { onReady: (e: {target: {setVolume: (v: number) => void}}) => void; onStateChange: (e: {data: number}) => void; onAutoplayBlocked: () => void; };
let events: Events;
const player = {loadVideoById: vi.fn(), playVideo: vi.fn(), pauseVideo: vi.fn(), stopVideo: vi.fn(), setVolume: vi.fn(), getCurrentTime: () => 12, getDuration: () => 200, getVideoData: () => ({video_id: 'test-video'}), seekTo: vi.fn(), destroy: vi.fn()};
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); vi.resetModules();
  vi.stubGlobal('window', {setTimeout, clearTimeout, setInterval, clearInterval, location:{origin:'http://localhost:5173'}, YT:{Player: class {constructor(_id: string, opts: {events: Events}) {events=opts.events; return player;}}}});
  vi.stubGlobal('document', {getElementById: () => ({}), querySelector: () => null});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('Reproductor único de YouTube', () => {
  it('cancela la carga pendiente cuando cambia a archivo local', async () => {
    const {videoEngine}=await import('../src/services/VideoEngine');
    videoEngine.load('test-video'); videoEngine.stop(); events.onReady({target:player});
    expect(player.loadVideoById).not.toHaveBeenCalled();
  });
  it('un evento tardío de YouTube no modifica la reproducción local', async () => {
    const {videoEngine}=await import('../src/services/VideoEngine');
    const {usePlayerStore: store}=await import('../src/state/playerStore');
    videoEngine.load('test-video'); events.onReady({target:player});
    store.setState({source:'local',status:'playing'});
    events.onStateChange({data:2});
    expect(store.getState().status).toBe('playing'); videoEngine.stop();
  });
  it('autoplay bloqueado permite continuar con Play sin reiniciar la canción', async () => {
    const {videoEngine}=await import('../src/services/VideoEngine');
    const {usePlayerStore: store}=await import('../src/state/playerStore');
    store.setState({source:'video',status:'loading'});
    videoEngine.load('test-video'); events.onReady({target:player}); events.onAutoplayBlocked();
    expect(store.getState().status).toBe('paused');
    videoEngine.resume(); expect(player.playVideo).toHaveBeenCalled();
    expect(player.loadVideoById).toHaveBeenCalledTimes(1); videoEngine.stop();
  });
  it('actualiza duración y posición incluso si se pausa antes del primer intervalo', async () => {
    const {videoEngine}=await import('../src/services/VideoEngine');
    const {usePlayerStore: store}=await import('../src/state/playerStore');
    store.setState({source:'video',status:'playing',durationSec:null});
    videoEngine.load('test-video'); events.onReady({target:player}); events.onStateChange({data:2});
    expect(store.getState().durationSec).toBe(200);
    expect(store.getState().posSec).toBe(12); videoEngine.stop();
  });
  it('ampliar el video solo cambia su presentación', () => {
    usePlayerStore.setState({posSec:42,status:'paused'});
    usePlayerStore.getState().setVideoExpanded(true);
    expect(usePlayerStore.getState().posSec).toBe(42);
    expect(usePlayerStore.getState().status).toBe('paused');
    expect(player.loadVideoById).not.toHaveBeenCalled();
  });
});
