# Design — Thunder Melodies (mundo violeta nocturno)

<!-- impeccable:design-schema 1 -->

## Tokens

- Fondo `void #08070d`, paneles `panel #120e22` / `panel2 #1a1330`, borde `neon/22`.
- Acento `neon #a855f7`, profundo `#7c3aed`, glow `0 0 24px rgba(168,85,247,.45)`.
- Display `Sora 800` mayúsculas hero; script `Caveat` solo frases ("Good Vibes Only" → "Las buenas canciones…"); cuerpo sistema.
- Portadas: `coverUrl` YTM real o fallback degradado violeta con iniciales (sintético, no finge foto).

## Superficies

- Home (Operate): sidebar 220px + centro (hero 16:7, resultados vivos, Tendencias 4, Álbumes 6) + cola 300px + player inferior waveform.
- NowPlaying: cover vivo (respira + anillo orbital al sonar) + progreso + waveform reactiva + controles + "A continuación" (apilado hasta `xl`, 2 columnas desde `xl`, cover a 420px en `2xl`).
- Listas: sección "Tus playlists" (crear / guardar cola / renombrar / eliminar con confirmación en 2 pasos / cargar en cola / detalle con canciones manuales) + sección Cola con la `DoublyLinkedList` y `debugChain()` en `<details>`.
- La cadena `debugChain()` vive en `<details>` "Estructura lista doble" para la sustentación.

## Componentes

`Sidebar/QueuePanel` (`components/Sidebar.tsx`), `Topbar/BottomPlayer` (`components/Chrome.tsx`),
`Hero/TrendGrid/AlbumRow` (en `views/Home.tsx`), `NowPlaying` (`views/NowPlaying.tsx`),
`Cover` + `fmt` (`components/ui.tsx`). Un componente por archivo, PascalCase.

## Movimiento

- Aurora de fondo (3 manchas con drift lento, `pointer-events:none`) detrás de todo.
- Cada vista entra con `view-enter` (rise-in 0.45s) y las listas con `stagger` escalonado; hovers `lift` / `btn-press`.
- Portada: `breathe` + anillo orbital (`@property --ring-angle`, máscara exclude) solo mientras suena; waveform `wave-live` se congela en pausa; `glow-pulse` en botones activos.
- Todo se anula en `@media (prefers-reduced-motion: reduce)`.

## Reglas

- Dark por defecto; modo claro conmutable (toggle ☀/☾ en el Topbar). Paleta 100% por variables CSS en `:root` (oscuro) y `html[data-theme='light']` (claro) — Tailwind compila `white/black/void/panel/neon…` contra esas variables, así que `text-white/50` o `bg-black/90` cambian de significado sin tocar componentes. Persistencia `wavely:theme` + script inline en `index.html` (sin parpadeo). Foco visible, controles con `aria-label`.
- Sin `dangerouslySetInnerHTML`; artistas/títulos se escapan por React.
- Responsive: `lg:` 3 col → `md:` 2 col (cola oculta) → móvil tabs Inicio/Subir/Listas/Favs/Sonando + bottom player (barra con `flex-wrap`, sin scroll horizontal desde 360px). NowPlaying y hero de Home pasan a 2 columnas recién en `xl`; nada de texto `6xl` en columnas <340px.
