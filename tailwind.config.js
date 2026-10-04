/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Paleta por variables CSS: `:root` = oscuro, `html[data-theme=light]` = claro.
      // white/black también son variables para que text-white/50 o bg-black/90
      // cambien de significado según el tema sin tocar cada componente.
      colors: {
        white: 'rgb(var(--c-white) / <alpha-value>)',
        black: 'rgb(var(--c-black) / <alpha-value>)',
        void: 'rgb(var(--c-void) / <alpha-value>)',
        panel: 'rgb(var(--c-panel) / <alpha-value>)',
        panel2: 'rgb(var(--c-panel2) / <alpha-value>)',
        neon: 'rgb(var(--c-neon) / <alpha-value>)',
        accent2: 'rgb(var(--c-accent2) / <alpha-value>)',
        neonDeep: '#7c3aed',
        muted: '#8e8a9e',
        accent: '#a855f7',
      },
      fontFamily: {
        display: ['Sora', 'system-ui', 'sans-serif'],
        body: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        script: ['Caveat', 'Segoe Script', 'cursive'],
      },
      boxShadow: {
        glow: 'var(--shadow-glow)',
        card: 'var(--shadow-card)',
      },
    },
  },
  plugins: [],
};
