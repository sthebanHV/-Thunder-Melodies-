# AGENTS.md — Wavely Music Player

Guía para agentes de IA y desarrolladores que trabajan en este proyecto. Describe qué se construye, cómo está organizado, qué reglas se siguen y qué capacidades (Skills) tiene el sistema.

---

## 1. Resumen del proyecto

Aplicación web de reproducción de música, con experiencia similar a Spotify / Apple Music / YouTube Music pero con identidad propia. Permite buscar, reproducir, ver letras sincronizadas, gestionar playlists y biblioteca, explorar artistas con su trayectoria, y recibir recomendaciones.

**Stack propuesto**

| Capa | Tecnología |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind |
| Estado | Zustand (player) + TanStack Query (datos del servidor) |
| Backend | Node.js + Fastify (o Express) + Zod |
| Base de datos | PostgreSQL + Prisma |
| Caché | Redis |
| Pruebas | Vitest + Testing Library + Playwright |
| Despliegue | Vercel / Netlify (front), Railway / Render (API) |

**APIs externas (con licencia o uso permitido)**

- Búsqueda: iTunes Search API, Deezer, MusicBrainz
- Audio: Jamendo, Audius, previews de Deezer (30 s)
- Letras: LRCLIB (sincronizadas, `.lrc`), Musixmatch (licenciada)
- Artista: Wikipedia / Wikidata, MusicBrainz, Last.fm

---

## 1.1 Requisito académico: Taller Listas Dobles

**Enunciado:** crear una app en **TypeScript** aplicando el concepto de **listas dobles** (lista doblemente enlazada) que simule una **lista de reproducción de canciones**, con un **frontend** donde el usuario pueda interactuar.

**Requerimientos obligatorios**

| # | Requerimiento | Operación en la lista |
|---|---|---|
| R1 | Frontend con el que el usuario pueda interactuar | UI en React que muestra la lista y llama a las operaciones |
| R2 | Agregar canción **al inicio** | `addFirst(song)` |
| R3 | Agregar canción **al final** | `addLast(song)` |
| R4 | Agregar canción **en cualquier posición** | `addAt(index, song)` |
| R5 | **Eliminar** una canción de la lista | `removeAt(index)` / `removeById(id)` |
| R6 | **Adelantar** canción | `next()` |
| R7 | **Retroceder** canción | `previous()` |
| R8 | Otras funcionalidades pertinentes | Ver extras más abajo |

### Pasos de implementación

1. **Definir el modelo.** Crear `Song` (`id`, `title`, `artist`, `album?`, `durationSec`, `coverUrl?`) y `SongNode` con los punteros `prev` y `next`.
2. **Implementar la lista doblemente enlazada** en `src/domain/playlist/DoublyLinkedList.ts`, sin dependencias de React. Debe mantener `head`, `tail`, `current` y `size`.
3. **Implementar agregar:** `addFirst`, `addLast` y `addAt(index)`. Cada una debe actualizar correctamente `prev`/`next` de los nodos vecinos y de `head`/`tail`.
4. **Implementar eliminar:** `removeAt(index)` y `removeById(id)`. Reconectar los vecinos y contemplar los casos de cabeza, cola y único elemento.
5. **Implementar navegación:** `next()` y `previous()` moviendo el puntero `current`. Definir el comportamiento en los extremos (ver reglas).
6. **Implementar utilidades:** `toArray()`, `find(id)`, `isEmpty()`, `clear()`, `getCurrent()`, `size`.
7. **Escribir pruebas unitarias** de todas las operaciones y de los casos borde antes de conectar la interfaz.
8. **Crear el servicio** `PlaylistService` que envuelve la lista y expone acciones a la UI. La UI nunca toca los nodos directamente.
9. **Conectar el estado de React.** Guardar en el store una copia en arreglo (`toArray()`) y el `currentId`; no guardar los nodos mutables en el estado de React.
10. **Construir el frontend:**
    - Formulario para crear la canción con selector de posición: *Inicio*, *Final* o *Posición N*.
    - Lista visible de canciones, con la canción actual resaltada.
    - Botón de eliminar por canción.
    - Botones **Anterior** y **Siguiente**, y panel "Reproduciendo ahora".
11. **Agregar los extras** (ver abajo) que el equipo decida, sin romper los requerimientos obligatorios.
12. **Persistir** la lista en `localStorage` (serializando con `toArray()`) y reconstruirla al abrir la app.
13. **Visualizar la estructura** (recomendado para la sustentación): mostrar los nodos como `null ⇄ [A] ⇄ [B] ⇄ [C] ⇄ null`, indicando `head`, `tail` y `current`.
14. **Validar con el checklist** de criterios de aceptación y preparar la explicación de complejidad.

### Diseño de la estructura

```ts
export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  durationSec: number;
  coverUrl?: string;
}

export class SongNode {
  prev: SongNode | null = null;
  next: SongNode | null = null;
  constructor(public song: Song) {}
}

export class DoublyLinkedList {
  private head: SongNode | null = null;
  private tail: SongNode | null = null;
  private current: SongNode | null = null;
  private count = 0;

  get size(): number { return this.count; }

  addFirst(song: Song): void { /* ... */ }
  addLast(song: Song): void { /* ... */ }
  addAt(index: number, song: Song): void { /* lanza RangeError si index < 0 o > size */ }
  removeAt(index: number): Song { /* lanza RangeError si el índice es inválido */ }
  removeById(id: string): Song | null { /* ... */ }
  next(): Song | null { /* ... */ }
  previous(): Song | null { /* ... */ }
  getCurrent(): Song | null { /* ... */ }
  setCurrentById(id: string): boolean { /* ... */ }
  find(id: string): SongNode | null { /* ... */ }
  move(from: number, to: number): void { /* reordenar */ }
  toArray(): Song[] { /* ... */ }
  clear(): void { /* ... */ }
}
```

### Complejidad esperada

| Operación | Complejidad |
|---|---|
| `addFirst`, `addLast` | O(1) |
| `addAt(index)` | O(n), se puede recorrer desde `head` o `tail` según el más cercano |
| `removeAt(index)` / `removeById` | O(n) para buscar, O(1) para reconectar |
| `next()`, `previous()` | O(1) |
| `toArray()`, `find` | O(n) |

**Por qué lista doble:** cada nodo conoce a su anterior y a su siguiente, por lo que retroceder es O(1) y se puede recorrer desde la cola. Con una lista simple, retroceder obligaría a recorrer desde el inicio.

### Reglas y casos borde

- Lista vacía: `next()`, `previous()` y `getCurrent()` devuelven `null`; eliminar lanza error controlado.
- Primera canción agregada: se convierte en `head`, `tail` y `current` a la vez.
- `addAt(0)` equivale a `addFirst`; `addAt(size)` equivale a `addLast`; fuera de rango es un error validado y mostrado en la UI.
- Eliminar la canción **actual**: `current` pasa al siguiente; si era la cola, pasa al anterior; si era la única, queda en `null`.
- Eliminar `head` o `tail`: actualizar el puntero correspondiente y poner a `null` el `prev`/`next` del nuevo extremo.
- `next()` en la cola y `previous()` en la cabeza: si el modo repetir está activo, se vuelve al otro extremo (lista circular lógica); si no, permanece en el extremo y la UI deshabilita el botón.
- Evitar duplicados exactos (mismo `id`) o pedir confirmación al usuario.
- Limpiar las referencias (`prev`/`next` a `null`) del nodo eliminado para evitar fugas de memoria.

### Funcionalidades extra sugeridas (R8)

- Reproducir/pausar y barra de progreso simulada con temporizador.
- Reproducir una canción al hacer clic en ella (`setCurrentById`).
- Modos **repeat** (`off | all | one`) y **shuffle**.
- Reordenar con drag & drop o botones subir/bajar (`move`).
- Buscar y filtrar por título o artista.
- Mostrar duración total y cantidad de canciones.
- Deshacer la última eliminación.
- Persistencia en `localStorage` e importar/exportar la lista en JSON.
- Visualización gráfica de los nodos enlazados (`prev ⇄ next`).
- Mensajes con toast para errores y confirmaciones.

### Criterios de aceptación del taller

- [ ] Las tres formas de agregar (inicio, final, posición) funcionan y mantienen `prev`/`next` consistentes.
- [ ] Eliminar funciona en cabeza, cola, medio y único elemento.
- [ ] Adelantar y retroceder funcionan y respetan los extremos.
- [ ] La lista actual se resalta correctamente después de agregar o eliminar.
- [ ] Hay pruebas unitarias de la lista con los casos borde.
- [ ] La UI es usable, muestra errores claros y refleja siempre el estado real de la lista.
- [ ] El código está en TypeScript estricto, sin `any`.
- [ ] El equipo puede explicar la complejidad de cada operación y por qué se eligió una lista doble.

---

## 2. Comandos

Ajusta los nombres si tu `package.json` es distinto.

```bash
pnpm install          # instalar dependencias
pnpm dev              # frontend + API en desarrollo
pnpm build            # build de producción
pnpm lint             # ESLint
pnpm typecheck        # tsc --noEmit
pnpm test             # pruebas unitarias (Vitest)
pnpm test:e2e         # pruebas end-to-end (Playwright)
pnpm db:migrate       # migraciones de Prisma
pnpm db:seed          # datos de ejemplo
```

**Antes de dar una tarea por terminada:** `lint`, `typecheck` y `test` deben pasar.

---

## 3. Arquitectura

```
src/
├── ui/             # design system: botones, inputs, modal, toast, skeleton
├── components/     # componentes compartidos: TrackRow, AlbumCard, ArtistCard
├── features/       # una carpeta por Skill (player, search, lyrics, playlists...)
│   └── <feature>/
│       ├── components/
│       ├── hooks/
│       ├── store/
│       └── index.ts     # única API pública de la feature
├── domain/         # entidades, tipos y reglas de negocio puras (sin React)
├── services/       # lógica de aplicación (PlayerService, HistoryService)
├── api/            # cliente HTTP, endpoints tipados, mappers DTO -> dominio
├── state/          # stores globales
├── data-access/    # repositorios (solo backend: Prisma)
└── utils/          # formateo de tiempo, debounce, parser LRC
```

**Reglas de dependencia**

- `domain` no importa nada de React, HTTP ni de la base de datos.
- `features` solo se comunican entre sí mediante su `index.ts` o mediante los stores.
- Los componentes de UI no llaman a `fetch` directamente; usan hooks de `api/`.
- Un componente nunca modifica el elemento `<audio>`; solo envía acciones al `PlayerService`.

**Principios:** SOLID, DRY, Separation of Concerns, Single Responsibility, componentes reutilizables y Clean Architecture donde aporte valor.

---

## 4. Convenciones de código

- TypeScript en modo `strict`; no usar `any`.
- Componentes funcionales; un componente por archivo; nombres en `PascalCase`.
- Hooks con prefijo `use`; stores con sufijo `Store`.
- Validar con Zod toda entrada externa (body, query, params y respuestas de APIs de terceros).
- Mensajes de commit: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`.
- Accesibilidad: controles operables con teclado, atributos ARIA en el reproductor, contraste suficiente.
- No dejar `console.log` ni secretos en el código.

---

## 5. Roles de agentes

| Agente | Responsabilidad | Skills |
|---|---|---|
| **Architect** | Capas, límites, decisiones (ADR), revisión de diseño | 14 |
| **Data Structures** | Lista doblemente enlazada del taller, casos borde y pruebas de complejidad | 12, 14, Taller (§1.1) |
| **Player** | Motor de audio, máquina de estados, cola | 01, 12, 14 |
| **Search/Discovery** | Búsqueda, autocomplete, descubrimiento | 02, 13 |
| **Lyrics** | Letras sincronizadas y parser LRC | 03 |
| **Library** | Playlists, biblioteca, favoritos, historial | 04, 08, 09, 10 |
| **Catalog** | Artistas, trayectoria, álbumes | 05, 06, 07 |
| **Recommendation** | Motor de recomendaciones | 11 |
| **UI** | Diseño responsive y sistema visual | 15 |
| **Backend/Security** | API, base de datos, autenticación, seguridad | todas |
| **QA** | Pruebas, rendimiento, criterios de aceptación | transversal |

**Orden sugerido:** Architect → Data Structures → Backend/Security → Player → UI → Search → Lyrics → Library → Catalog → Recommendation → QA.

**Reglas para todos los agentes**

1. Leer este archivo antes de modificar código.
2. No tocar código fuera de la feature asignada sin avisar.
3. No duplicar estado del reproductor: la fuente de verdad es `playerStore`.
4. Nunca incluir claves de API en el frontend; viven en variables de entorno del backend.
5. Usar solo audio y letras de fuentes con licencia o previews oficiales.
6. No ejecutar comandos destructivos ni migraciones sobre producción sin confirmación.
7. Cada cambio incluye pruebas o explica por qué no aplican.

---

## 6. Skills

Cada Skill es un módulo independiente en `src/features/<nombre>`.

### Skill 01 — Music Player

**Objetivo:** reproductor principal.

**Funcionalidades:** play/pause, anterior/siguiente, barra de progreso, volumen y mute, duración actual/total, autoplay, repeat (`off | all | one`), shuffle, mini-player y full player.

**Máquina de estados**

```
IDLE → LOADING → PLAYING ⇄ PAUSED
                    ↓  ↑
                BUFFERING
PLAYING → ENDED → (siguiente pista | IDLE)
cualquier estado → ERROR → (reintentar → LOADING | saltar pista)
```

**Reglas**
- Un único elemento `<audio>` para toda la app.
- Cambiar de pista no desmonta el reproductor ni corta la interfaz.
- Precargar la siguiente pista cuando falten ~10 s.
- Integrar Media Session API (teclas multimedia, pantalla de bloqueo).

**Errores:** URL de audio inválida, pérdida de red (mostrar BUFFERING y reintentar), formato no soportado (saltar a la siguiente).

**Criterios de aceptación**
- Las transiciones de estado solo ocurren a través de la máquina de estados, con pruebas unitarias.
- Al terminar una pista con repeat `off` y cola vacía, el estado pasa a `ENDED` → `IDLE`.
- El volumen y el mute persisten entre sesiones.

### Skill 02 — Music Search

**Objetivo:** buscador musical profesional.

**Funcionalidades:** buscar canciones, artistas, álbumes y playlists; autocomplete; resultados instantáneos; historial y búsquedas recientes; filtros; ordenamiento; tolerancia a errores de escritura; búsqueda parcial; estado de resultados vacíos.

**Reglas**
- Debounce de 250–300 ms y cancelación de requests anteriores (`AbortController`).
- Mínimo 2 caracteres para consultar.
- En backend, usar `pg_trgm` o equivalente para tolerancia a errores.
- Resultados agrupados por tipo, con paginación.

**Errores:** API externa caída (mostrar resultados en caché y aviso), sin resultados (sugerir otra búsqueda).

**Criterios de aceptación:** escribir "coldplya" devuelve resultados de Coldplay; el autocomplete responde en menos de 400 ms con datos en caché.

### Skill 03 — Lyrics

**Objetivo:** mostrar letras, sincronizadas cuando existan marcas de tiempo.

**Funcionalidades:** parser de `.lrc` (`[mm:ss.xx] texto`), resaltado de línea actual, scroll automático, scroll manual, botón "Resincronizar", estado alternativo si no hay letra.

**Reglas**
- La línea activa es la última cuyo `timestamp <= currentTime`.
- Si el usuario hace scroll manual, se pausa el auto-scroll hasta pulsar "Resincronizar" o pasar 5 s.
- Letra sin timestamps: mostrar como texto plano.
- Cachear por `trackId`. Escapar todo el texto.

**Errores:** letra no encontrada, formato `.lrc` malformado (ignorar líneas inválidas).

**Criterios de aceptación:** al hacer seek, la línea resaltada cambia en menos de 200 ms.

### Skill 04 — Playlist Manager

**Funcionalidades:** crear, editar, eliminar, cambiar nombre, descripción y portada; agregar/quitar canciones; reordenar con drag & drop; pública/privada; compartir; duplicar; mostrar cantidad de canciones y duración total.

**Reglas**
- Solo el dueño edita o elimina una playlist.
- Una canción no se repite dos veces seguidas sin confirmar.
- Las playlists privadas solo se acceden con autenticación; las públicas por enlace.
- El orden se guarda con `position` y se reindexa al reordenar.
- Portada: solo `jpg/png/webp`, máximo 2 MB, validada en backend.

**Criterios de aceptación:** reordenar es optimista y se revierte si el servidor falla; al duplicar, la copia es privada por defecto.

### Skill 05 — Artist Profile

**Contenido:** nombre, imagen, biografía, género, país, inicio de carrera, discografía, álbumes, singles, colaboraciones, canciones populares y artistas relacionados.

**Reglas:** indicar la fuente de la biografía; cachear datos externos; paginar discografía.

### Skill 06 — Artist Career / Timeline

**Objetivo:** línea de tiempo moderna de la trayectoria.

**Eventos:** inicio de carrera, primer lanzamiento, álbumes importantes, cambios de estilo, colaboraciones relevantes, premios, eventos importantes.

**Reglas**
- Los eventos se ordenan por fecha y se agrupan por década.
- Los datos provienen de MusicBrainz y Wikidata; los eventos sin fuente no se muestran.
- Visualización horizontal en desktop y vertical en móvil.

**Criterios de aceptación:** pulsar un álbum en la línea de tiempo abre su detalle; si faltan datos, se muestra un estado vacío informativo.

### Skill 07 — Album Explorer

**Contenido:** portada, nombre, artista, año, género, número de canciones, duración, lista de canciones, información del álbum y canciones más reproducidas.

### Skill 08 — User Library

Administra favoritos, álbumes guardados, artistas seguidos, playlists e historial. Descargas solo si la arquitectura lo permite (V3, requiere PWA + IndexedDB y licencias).

### Skill 09 — Favorites

Marcar/desmarcar canciones, guardar álbumes, seguir artistas, consultar favoritos y sincronizar entre dispositivos.

**Reglas:** operación idempotente (`PUT`/`DELETE`); actualización optimista; restricción única `(user_id, entity_type, entity_id)`.

### Skill 10 — Listening History

**Registra:** canción, artista, álbum, fecha, hora, tiempo reproducido y porcentaje.

**Consultas:** últimas canciones, más escuchadas, artistas y álbumes más escuchados.

**Reglas:** una reproducción cuenta como válida a partir de 30 s o 50 % de la pista (lo que ocurra primero); el cliente envía el evento al finalizar o al saltar; el endpoint no acepta duplicados con el mismo `clientEventId`.

### Skill 11 — Recommendation Engine

**Secciones:** "Porque escuchaste…", "También te puede gustar", "Descubre nuevos artistas", "Nuevos lanzamientos", "Tu mezcla personalizada".

**Señales:** historial, géneros, artistas favoritos, canciones repetidas, playlists, horario de escucha, canciones similares.

**Estrategia por fases**
1. **MVP/V1:** reglas y conteos (géneros y artistas más escuchados, similares por género).
2. **V2:** filtrado colaborativo y similitud por tags.
3. **V3 (IA):** embeddings de canciones/artistas y explicaciones generadas. La IA interviene solo para calcular similitud y redactar el motivo de la recomendación; necesita géneros, tags y agregados del historial, nunca datos personales identificables.

**Criterios de aceptación:** usuario nuevo sin historial recibe tendencias; las recomendaciones no repiten canciones ya escuchadas recientemente.

### Skill 12 — Queue Manager

Agregar, eliminar, reordenar, reproducir ahora, reproducir después, limpiar, guardar cola temporalmente y mostrar la canción actual con las siguientes.

**Reglas:** la cola se modela con la `DoublyLinkedList` del taller (§1.1): `next()`/`previous()` son O(1), y la UI recibe una copia en arreglo (`toArray()`) más el `currentId`; la cola vive en el `playerStore`; "Reproducir después" inserta justo tras la pista actual; "Agregar a la cola" inserta al final; con shuffle se conserva el orden original para poder desactivarlo.

### Skill 13 — Music Discovery

Nuevos lanzamientos, tendencias, géneros, artistas populares, álbumes destacados, recomendaciones y canciones recién agregadas. Cada sección carga de forma independiente con skeleton.

### Skill 14 — Audio State Manager

**Estado centralizado**

```ts
interface PlayerState {
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'error' | 'ended';
  currentTrack: Track | null;
  queue: QueueItem[];
  currentIndex: number;
  currentTime: number;
  duration: number;
  volume: number;        // 0..1
  muted: boolean;
  repeatMode: 'off' | 'all' | 'one';
  shuffle: boolean;
  error: PlayerError | null;
}
```

**Reglas**
- `isPlaying`, `isLoading` y `isBuffering` se derivan de `status`; no se guardan por separado.
- `currentTime` se actualiza con `requestAnimationFrame` o `timeupdate` limitado; los componentes que no lo necesitan no se suscriben.
- Usar selectores para evitar re-renders.

### Skill 15 — Responsive Music Experience

| Dispositivo | Navegación | Reproductor | Letras |
|---|---|---|---|
| Desktop / Laptop | Sidebar fija | Barra inferior completa | Panel lateral o pantalla completa |
| Tablet | Sidebar colapsable | Barra inferior | Pantalla completa |
| Mobile | Bottom navigation | Mini-player → full-screen | Pestaña dentro del full player |

Incluye dark mode, skeletons, estados vacíos y de error, toasts y modal "Agregar a playlist".

---

## 7. Modelo de datos

| Entidad | Atributos principales | Relaciones |
|---|---|---|
| **User** | id (uuid), email (único), passwordHash, displayName, avatarUrl?, createdAt | 1:N Playlist, Favorite, History, Follow; 1:1 Queue |
| **Artist** | id, name, bio?, imageUrl?, country?, careerStart?, mbid? (único) | 1:N Album; N:M Track |
| **Album** | id, title, artistId, releaseDate, coverUrl, type (`album/single/ep`) | N:1 Artist; 1:N Track |
| **Genre** | id, name (único) | N:M Artist, Album, Track |
| **Track** | id, title, albumId, durationMs, trackNumber, audioUrl/previewUrl, explicit | N:1 Album; N:M Artist, Genre; 0..1 Lyrics |
| **Playlist** | id, ownerId, name, description?, coverUrl?, isPublic, createdAt | N:1 User; 1:N PlaylistTrack |
| **PlaylistTrack** | playlistId, trackId, position, addedAt | N:M Playlist–Track |
| **Favorite** | userId, entityType, entityId, createdAt | N:1 User |
| **ListeningHistory** | id, userId, trackId, playedAt, listenedMs, percentage, clientEventId | N:1 User, Track |
| **Lyrics** | id, trackId (único), source, isSynced, language? | 1:1 Track; 1:N LyricsLine |
| **LyricsLine** | id, lyricsId, timeMs?, text, position | N:1 Lyrics |
| **Follow** | userId, artistId, createdAt | N:M User–Artist |
| **Queue** | id, userId (único), items (JSON), currentIndex, updatedAt | 1:1 User |

**Índices**
- `Track(title)` con `pg_trgm`; `Artist(name)` con `pg_trgm`; `Album(title)`.
- `PlaylistTrack(playlistId, position)` y único `(playlistId, trackId, position)`.
- `Favorite(userId, entityType, entityId)` único.
- `ListeningHistory(userId, playedAt DESC)` y único `(userId, clientEventId)`.
- `LyricsLine(lyricsId, position)`.

**Integridad**
- `onDelete: Cascade` en PlaylistTrack, LyricsLine y Favorite al eliminar su padre.
- `percentage` entre 0 y 100; `volume` entre 0 y 1; `position >= 0`.
- Opcionales: `bio`, `imageUrl`, `country`, `careerStart`, `timeMs`, `description`, `coverUrl`.

---

## 8. API REST

Prefijo `/api/v1`. Todas las respuestas de lista llevan `{ data, page, pageSize, total }`. Los errores usan `{ error: { code, message, details? } }`.

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/auth/register` | No | Crea usuario. Body: email, password, displayName |
| POST | `/auth/login` | No | Devuelve access token y cookie de refresh |
| POST | `/auth/refresh` | Cookie | Renueva el access token |
| GET | `/tracks` | No | Lista canciones (`genre`, `sort`, `page`) |
| GET | `/tracks/:id` | No | Detalle de canción |
| GET | `/artists/:id` | No | Perfil del artista |
| GET | `/artists/:id/albums` | No | Discografía paginada (`type=album,single`) |
| GET | `/artists/:id/timeline` | No | Eventos de la trayectoria |
| GET | `/albums/:id` | No | Detalle con pistas |
| GET | `/search?q=&type=&page=` | No | Búsqueda agrupada por tipo |
| GET | `/search/suggest?q=` | No | Autocomplete (máx. 8) |
| GET | `/lyrics/:trackId` | No | Letra (sincronizada o plana) o `404` |
| GET | `/playlists` | Sí | Playlists del usuario |
| POST | `/playlists` | Sí | Crea playlist |
| GET | `/playlists/:id` | Mixta | Pública o del dueño |
| PUT | `/playlists/:id` | Dueño | Edita datos |
| DELETE | `/playlists/:id` | Dueño | Elimina |
| POST | `/playlists/:id/duplicate` | Sí | Duplica |
| POST | `/playlists/:id/tracks` | Dueño | Body: `trackId`, `position?` |
| PATCH | `/playlists/:id/tracks/reorder` | Dueño | Body: `[{trackId, position}]` |
| DELETE | `/playlists/:id/tracks/:trackId` | Dueño | Quita pista |
| GET | `/favorites?type=` | Sí | Lista favoritos |
| PUT/DELETE | `/favorites/:type/:id` | Sí | Marca/desmarca |
| PUT/DELETE | `/follows/:artistId` | Sí | Seguir/dejar de seguir |
| GET | `/history?range=` | Sí | Historial y rankings |
| POST | `/history` | Sí | Registra una reproducción |
| GET | `/queue` / PUT `/queue` | Sí | Obtiene/guarda la cola |
| GET | `/discover` | No | Secciones de descubrimiento |
| GET | `/recommendations` | Sí | Recomendaciones personalizadas |

---

## 9. Seguridad

- **Autenticación:** contraseñas con Argon2id o bcrypt; access token JWT de 15 min; refresh token en cookie `httpOnly`, `Secure`, `SameSite=Lax` con rotación.
- **Autorización:** verificar propiedad del recurso en cada endpoint (evitar IDOR).
- **Validación:** esquemas Zod para body, query y params.
- **Rate limiting:** estricto en `/auth/*`, moderado en `/search`.
- **XSS:** React escapa por defecto; prohibido `dangerouslySetInnerHTML`; sanitizar biografías y letras externas; CSP configurada.
- **SQL injection:** solo consultas parametrizadas / Prisma; nada de SQL concatenado.
- **Archivos:** validar tipo MIME real, tamaño máximo, renombrar con uuid, almacenar fuera del directorio público.
- **Otros:** CORS con lista blanca, `helmet`, logs sin datos sensibles, dependencias auditadas (`pnpm audit`).

---

## 10. Rendimiento

- Lazy loading de rutas y de imágenes (`loading="lazy"`, `srcset`, formato WebP/AVIF).
- Caché: TanStack Query en cliente, Redis en servidor para respuestas de APIs externas.
- Debounce en búsqueda; cancelar requests obsoletos.
- Paginación (cursor o página) en todas las listas.
- Virtualización de listas largas (`@tanstack/react-virtual`).
- Precarga de la siguiente pista; no precargar toda la cola.
- Selectores de Zustand para limitar re-renders; `currentTime` aislado.
- Presupuesto: LCP < 2.5 s, bundle inicial < 200 KB gzip.

---

## 11. UX / UI

- Estilo minimalista, dark mode por defecto, tipografía clara, acento de color propio.
- Cards de álbumes y artistas, reproductor inferior persistente, animaciones sutiles.
- Skeleton loading, empty states, error states y toasts en toda acción asíncrona.
- Modal "Agregar a playlist" con búsqueda y opción "Nueva playlist".
- Debe sentirse como un producto musical real, no como un CRUD genérico.

---

## 12. Flujos principales

**Reproducción:** el usuario pulsa una pista → `PlayerService.play(track, context)` → estado `LOADING` → el `<audio>` emite `canplay` → `PLAYING` → al terminar, `ENDED` → avanza según repeat/shuffle/cola → se envía `POST /history`.

**Búsqueda:** el usuario escribe → debounce → `GET /search/suggest` → muestra sugerencias → Enter → `GET /search` → resultados agrupados con filtros → guarda en búsquedas recientes.

**Crear playlist:** botón "Nueva playlist" → formulario (nombre obligatorio) → `POST /playlists` → toast de éxito → abre la playlist vacía con estado vacío y sugerencias.

**Letras:** cambia `currentTrack` → `GET /lyrics/:trackId` → parser LRC → el componente suscrito a `currentTime` calcula la línea activa → auto-scroll; si no hay letra, estado alternativo.

**Perfil y trayectoria:** abrir artista → `GET /artists/:id` + `/albums` + `/timeline` en paralelo → cabecera, populares, discografía y línea de tiempo → clic en un hito navega al álbum.

**Recomendaciones:** al abrir Inicio → `GET /recommendations` → el backend lee historial y favoritos agregados → calcula candidatos → filtra lo ya escuchado → devuelve secciones con su motivo.

---

## 13. Roadmap

| Fase | Contenido |
|---|---|
| **MVP** | **Taller Listas Dobles (§1.1)**, Auth, Player (01), Audio State (14), Queue básica, Búsqueda (02), Playlists (04), layout responsive básico |
| **V1** | Letras (03), Artistas (05), Álbumes (07), Biblioteca (08), Favoritos (09), Historial (10), Queue completa (12) |
| **V2** | Trayectoria (06), Descubrimiento (13), Recomendaciones por reglas (11), PWA, sincronización entre dispositivos |
| **V3** | Recomendaciones con IA, funciones sociales, estadísticas avanzadas, descargas offline |

---

## 14. Skills adicionales propuestas

| # | Skill | Objetivo | Complejidad |
|---|---|---|---|
| 16 | Authentication & Profile | Registro, login, perfil y preferencias | Media |
| 17 | Offline & PWA | Instalar la app y escuchar sin conexión | Alta |
| 18 | Audio Equalizer & Visualizer | Ecualizador y ondas con Web Audio API | Media |
| 19 | Social & Sharing | Seguir usuarios, compartir canciones y playlists | Media |
| 20 | Collaborative Playlists | Playlists editadas por varios usuarios | Alta |
| 21 | Stats & Wrapped | Resumen anual y estadísticas de escucha | Media |
| 22 | Notifications | Avisos de nuevos lanzamientos de artistas seguidos | Media |
| 23 | Podcasts / Audiobooks | Contenido hablado con progreso por episodio | Alta |
| 24 | Smart Radio / Autoplay | Radio infinita basada en una canción o artista | Media |
| 25 | Accessibility & i18n | Múltiples idiomas, lector de pantalla, atajos de teclado | Baja |

Cada una debe documentarse con: objetivo, problema que resuelve, funcionalidades, componentes, datos, endpoints, dependencias, complejidad y mejoras futuras, antes de implementarse.

---

## 15. Checklist antes de un Pull Request

- [ ] `lint`, `typecheck` y `test` en verde.
- [ ] Si toca la lista de reproducción: pruebas de `DoublyLinkedList` con casos borde (vacía, un solo nodo, cabeza, cola, posición inválida).
- [ ] Los punteros `prev`/`next` quedan consistentes tras agregar y eliminar.
- [ ] Los criterios de aceptación de la Skill se cumplen.
- [ ] Sin secretos ni claves en el código.
- [ ] Estados de loading, vacío y error cubiertos.
- [ ] Probado en móvil y desktop.
- [ ] Documentación y este archivo actualizados si cambió la arquitectura.
