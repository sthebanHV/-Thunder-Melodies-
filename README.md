# Thunder Melodies

Requiere Node.js 22.18 o posterior y Python 3.10 o posterior. En Windows:

```powershell
npm install
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r ytm-service/requirements.txt
npm run dev:all
```

Abre http://localhost:5173. El gateway usa el puerto 3001 y el servicio Python, el 8001.

Abre siempre `localhost` y no `127.0.0.1`: YouTube rechaza el reproductor integrado (código 150) cuando la página se sirve por IP. Si escribes la URL con IP, el servidor la redirige a `localhost` automáticamente.

## Música y video

El catálogo público (canciones, videos, artistas, álbumes y playlists) se consulta con [ytmusicapi](https://github.com/sigma67/ytmusicapi), versión 1.12.3. No requiere iniciar sesión para buscar contenido público. Los archivos de autenticación opcionales quedan únicamente en el servidor; ver ytm-service/README_AUTH.md.

Busca, selecciona Canciones o Videos, y pulsa Reproducir. En Sonando, Ver video amplía el único reproductor oficial de YouTube. Minimizar y cambiar de vista conservan la pista y el tiempo actual. Pausa, volumen, posición y fin de canción se sincronizan con ese reproductor. Los archivos locales siguen usando su motor de audio.

ytmusicapi proporciona metadata, no un flujo de audio. La reproducción depende del embed de YouTube y de las restricciones de cada video. Los errores 100, 101, 150 y 153 muestran un mensaje, Reintentar, Siguiente y Abrir en YouTube; no se descarga ni extrae audio. Si el navegador bloquea autoplay, pulsa Play.

## Comprobaciones

```powershell
npm run build
npm run lint
npm test
.\.venv\Scripts\python.exe -m pip install -r ytm-service/requirements-dev.txt
.\.venv\Scripts\python.exe -m unittest discover -s ytm-service -p test_service.py
```

El arranque programático de Vite evita la lectura nativa de su configuración por esbuild en entornos Windows restringidos. La configuración compartida está en scripts/vite-options.mjs.
