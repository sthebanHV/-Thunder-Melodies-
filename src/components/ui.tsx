import { useState } from 'react';

export function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const PALETTES: Array<[string, string]> = [
  ['#7c3aed', '#2e1065'],
  ['#a855f7', '#4c1d95'],
  ['#6d28d9', '#0f0520'],
  ['#9333ea', '#1e1b4b'],
  ['#c026d3', '#3b0764'],
  ['#8b5cf6', '#312e81'],
];

/** Portada con fallback violeta cuando no hay coverUrl (sintético, no finge foto real). */
export function Cover({ url, title, className = '' }: { url?: string | null; title: string; className?: string }): React.JSX.Element {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return <img src={url} alt={title} loading="lazy" onError={() => setBroken(true)} className={`object-cover ${className}`} />;
  }
  const i = title.length % PALETTES.length;
  const [a, b] = PALETTES[i];
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center font-display font-extrabold text-white/80 ${className}`}
      style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
    >
      {title.slice(0, 2).toUpperCase()}
    </div>
  );
}
