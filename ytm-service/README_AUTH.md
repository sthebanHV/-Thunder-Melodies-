# Auth YT Music (solo si necesitas biblioteca/escritura)

Por defecto el microservicio funciona **sin auth** para contenido público:
search, suggest, artist, album, song, playlist pública, charts, moods, lyrics.

## Opción A — Browser (recomendada para lectura ampliada)

1. Abre `music.youtube.com` logueado, DevTools → Network, copia los headers de una
   petición `browse` como `headers_auth.json` (ver docs `setup/browser` de ytmusicapi).
2. Guarda el archivo junto a `app.py` (está en `.gitignore`, nunca commitear).
3. `set YTM_AUTH_FILE=headers_auth.json` (Windows) y reinicia `python app.py`.

## Opción B — OAuth (escritura: crear playlists, likes, historial)

Sigue `setup/oauth` de ytmusicapi para generar `oauth.json` y exporta
`YTM_AUTH_FILE=oauth.json`. Requiere `client_id/client_secret` propios.

## Variables

- `YTM_AUTH_FILE` (default `headers_auth.json`)
- `YTM_LANGUAGE` (default `es`), `YTM_LOCATION` (default `MX`)
- `PORT` (default `8001`)
