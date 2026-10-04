import { useEffect, useRef } from 'react';
import { usePlayerStore, currentSong } from '../state/playerStore';

/** Un único iframe permanece montado al navegar y al ampliar el video. */
export function YouTubePlayer(): React.JSX.Element {
  const source = usePlayerStore(s => s.source);
  const expanded = usePlayerStore(s => s.videoExpanded);
  const setExpanded = usePlayerStore(s => s.setVideoExpanded);
  const song = usePlayerStore(s => currentSong(s.songs, s.currentId));
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.activeElement;
    closeRef.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('keydown', escape); if (previous instanceof HTMLElement) previous.focus(); };
  }, [expanded, setExpanded]);
  return <section className={`youtube-surface ${expanded ? 'expanded' : 'docked'} ${source === 'video' ? 'visible' : 'inactive'}`} aria-label="Video de la canción" aria-hidden={source !== 'video'}>
    <header><span>{song?.title ?? 'YouTube Music'}</span><button ref={closeRef} onClick={() => setExpanded(!expanded)} aria-label={expanded ? 'Minimizar video' : 'Ampliar video'}>{expanded ? '↙' : '↗'}</button></header>
    <div className="youtube-host"><div id="yt-full-audio" /></div>
  </section>;
}
