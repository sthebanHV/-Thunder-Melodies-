    # Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: React + TypeScript + Vite + Tailwind (frontend), Node Fastify + Zod (gateway API), Python FastAPI + ytmusicapi (ytm-service microservicio solo-catálogo), PostgreSQL + Prisma + Redis (cuando haya backend persistente). Package manager: npm (pnpm no disponible en máquina). Decisión tomada con usuario 2026-10-04.

## Users

Estudiantes del taller Listas Dobles + oyentes que quieren experiencia tipo Spotify/YouTube Music con identidad propia. Contexto: desktop nocturno y móvil, audífonos, sesiones de estudio/sustentación y escucha diaria.

## Product Purpose

Thunder Melodies: buscar/explorar catálogo musical vía YouTube Music API no-oficial, gestionar cola de reproducción modelada como lista doblemente enlazada y reproducir canciones completas o archivos de audio subidos por el usuario. Éxito = búsqueda tolerante <400ms con caché, player persistente sin cortes, prev/next O(1), sustentación del taller aprobada.

## Positioning

La cola no es un array: es una `DoublyLinkedList` real (`head/tail/current`, `prev ⇄ next`) visible y explicable, alimentada por catálogo vivo de YouTube Music vía microservicio Python aislado. Competidores no muestran la estructura de datos como parte del producto.

## Operating Context

Flujos: buscar (debounce 250ms) → encolar (addFirst/addLast/addAt) → play → next/previous → guardar playlist/historial. Playlists manuales locales: crear/renombrar/eliminar en Listas, agregar canciones a mano, guardar la cola actual como playlist y cargarla de vuelta a la cola (persistencia `wavely:playlists:v1`, patrón zustand igual que favoritos; la carga a cola sigue pasando por la `DoublyLinkedList`). Ritual de sustentación: mostrar nodos `null ⇄ [A] ⇄ [B] ⇄ null` con head/tail/current. Restricción académica: TypeScript estricto sin `any`, pruebas Vitest de bordes.

## Capabilities and Constraints

Confirmado: YT Music solo catálogo/metadata (search, artist, album, playlist, lyrics, charts). Reproducción: canción completa desde 0:00 hasta el fin vía reproductor oficial de YouTube en modo audio; sin previews de 30s; sin saltos automáticos: lo irreproducible (embebido bloqueado, temas sin video) queda en estado de error con Reintentar/Siguiente y decide el usuario. Subida local: vista "Subir música" acepta mp3/wav/ogg/m4a/flac (drag & drop o selector), guarda blobs en IndexedDB del navegador, se encola como `Song.local` y suena con HTMLAudio nativo (mismo store/estados: play, pausa, fin → siguiente, error con Reintentar). `ytmusicapi` Python 3.10+ con `headers_auth.json`/`oauth.json` solo en backend, nunca en frontend. Gateway Node valida con Zod, rate-limit en `/search` y `/auth`, caché Redis + TanStack Query. Persistencia: Postgres local por ahora (Railway diferido). Lista vacía → null; `addAt` fuera de rango = RangeError en toast; repeat off|all|one, shuffle conserva orden original.

## Brand Commitments

Nombre: Thunder Melodies. Dark mode por defecto con modo claro conmutable (toggle en topbar, paleta por variables CSS, persiste sin parpadeo), minimalista, acento propio (no Spotify green), tipografía clara, barra inferior persistente, cards álbum/artista, skeletons/empty/error/toasts, modal Agregar a playlist. Superficies: landing Persuade + app Operate.

## Evidence on Hand

AGENTS (2).md (594 líneas, 15 skills + taller §1.1). Código existente: `src/domain/playlist/DoublyLinkedList.ts` + `src/services/PlaylistService.ts`, `src/state/playerStore.ts` (Zustand), vistas `src/views/Home.tsx` / `NowPlaying.tsx` / `Upload.tsx`, motores `src/services/VideoEngine.ts` (YouTube) y `AudioEngine.ts` (coordinador + HTMLAudio local con blobs en `localFiles.ts`), gateway Fastify + Zod en `server/src`, microservicio `ytm-service/app.py` con ytmusicapi, pruebas Vitest en `tests/` + diagnóstico e2e Playwright en `scripts/diag-*.mjs`. ytmusicapi https://github.com/sigma67/ytmusicapi (search, artist, album, watch playlists, lyrics, charts, library, playlists). Sin assets reales todavía — secciones de demo eliminadas del Home (búsqueda real en su lugar).

## Product Principles

1. La estructura de datos es el producto: toda acción de cola pasa por la lista doble.
2. Catálogo vivo, audio honesto: si no hay licencia, no se finge stream.
3. Un solo player, un solo estado: `playerStore` es fuente de verdad.
4. Operar primero, persuadir después: la app debe funcionar sin landing.
5. Sin secretos en frontend: auth YT vive en backend.

## Accessibility & Inclusion

Controles por teclado en player/cola, ARIA en reproductor, contraste AA en dark, foco visible. i18n es-MX por defecto (V2).
