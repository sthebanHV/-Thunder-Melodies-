import { useThemeStore } from '../state/theme';

/** Alterna modo oscuro / modo claro de toda la app (paleta por variables CSS). */
export function ThemeToggle({ className = '' }: { className?: string }): React.JSX.Element {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const toLight = theme === 'dark';
  return (
    <button
      onClick={toggle}
      aria-label={toLight ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-pressed={!toLight}
      title={toLight ? 'Modo claro' : 'Modo oscuro'}
      className={`btn-press flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neon/40 bg-neon/10 text-sm text-neon transition-colors hover:bg-neon/25 ${className}`}
    >
      {toLight ? '☀' : '☾'}
    </button>
  );
}
