"""Microservicio YT Music: solo catálogo/metadata vía ytmusicapi. Sin audio.
Requiere: pip install -r requirements.txt
Auth: opcional. Sin archivo funciona para contenido público (search, artist, album,
playlist pública, charts, lyrics). Para biblioteca/escritura montar browser.json u
oauth.json y exportar YTM_AUTH_FILE=browser.json (ver README_AUTH.md).
Nunca exponer este servicio al público sin el gateway Node (rate-limit + Zod + caché).
"""
import os
from pathlib import Path
from importlib.metadata import version

import requests
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

AUTH_FILE = os.environ.get("YTM_AUTH_FILE", str(Path(__file__).with_name("headers_auth.json")))
LANGUAGE = os.environ.get("YTM_LANGUAGE", "es")
LOCATION = os.environ.get("YTM_LOCATION", "MX")

app = FastAPI(title="wavely-ytm-service")

_client = None

class TimedSession(requests.Session):
    def request(self, method, url, **kwargs):
        kwargs.setdefault("timeout", 15)
        return super().request(method, url, **kwargs)


def _new_client(language):
    try:
        from ytmusicapi import YTMusic
    except ImportError as exc:
        raise HTTPException(
            status_code=503, detail="ytmusicapi no instalado. pip install ytmusicapi"
        ) from exc
    if os.path.exists(AUTH_FILE):
        return YTMusic(AUTH_FILE, language=language, location=LOCATION, requests_session=TimedSession())
    return YTMusic(language=language, location=LOCATION, requests_session=TimedSession())


def get_client():
    global _client
    if _client is None:
        _client = _new_client(LANGUAGE)
    return _client


_search_client = None


def get_search_client():
    """Cliente de búsquedas: una sola petición con resultados completos.

    Con language=es el filtro estricto de ytmusicapi ('songs', 'videos'...)
    vuelve vacío y obliga a una segunda petición sin filtrar, cuyo resultado
    trae filas sin artista ni duración y duplica la latencia. Se busca con
    language=en (mismo catálogo y ubicación) para responder a la primera.
    """
    global _search_client
    if LANGUAGE == "en":
        return get_client()
    if _search_client is None:
        _search_client = _new_client("en")
    return _search_client


def cover(thumbs):
    if not thumbs:
        return None
    return thumbs[-1].get("url")


def artists_str(item):
    arts = item.get("artists") or []
    names = [a.get("name", "") for a in arts if isinstance(a, dict) and a.get("name")]
    if names:
        return ", ".join(names)
    # Fallbacks según forma del resultado (author / subtitle "Artista • Álbum")
    for key in ("author", "artist", "subtitle"):
        val = item.get(key)
        if isinstance(val, str) and val.strip():
            return val.split("•")[0].strip()
        if isinstance(val, dict) and val.get("name"):
            return val["name"]
    return "Desconocido"


def duration_to_sec(value):
    if isinstance(value, int) and not isinstance(value, bool):
        return max(0, value)
    if isinstance(value, str):
        parts = value.strip().split(":")
        if 1 <= len(parts) <= 3 and all(part.isdigit() for part in parts):
            seconds = 0
            for part in parts:
                seconds = seconds * 60 + int(part)
            return seconds
    return None


def song_row(r):
    album = r.get("album") if isinstance(r.get("album"), dict) else None
    return {
        "videoId": r.get("videoId"),
        "title": r.get("title") or r.get("artist") or r.get("name"),
        "artist": artists_str(r),
        "album": (album or {}).get("name") or (r.get("album") if isinstance(r.get("album"), str) else None),
        "coverUrl": cover(r.get("thumbnails")),
        "durationSec": duration_to_sec(r.get("duration") or r.get("duration_seconds")),
        "browseId": (album or {}).get("id"),
    }


VALID_FILTERS = {"songs", "albums", "artists", "playlists", "videos"}


@app.get("/health")
def health():
    authed = os.path.exists(AUTH_FILE)
    get_client()
    return {"ok": True, "auth": authed, "language": LANGUAGE, "location": LOCATION, "version": version("ytmusicapi")}


@app.get("/ytm/search")
def search(q: str, filter: str = "songs", limit: int = 20):
    if len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="q mínimo 2 caracteres")
    if filter not in VALID_FILTERS:
        raise HTTPException(status_code=400, detail=f"filter inválido: {filter}")
    yt = get_search_client()
    limit = min(limit, 50)
    try:
        results = yt.search(q, filter=filter, limit=limit)
        if not results:
            # Filtro estricto vacío: se reintenta sin filtro y se filtra por
            # resultType abajo (no debe ocurrir con language=en).
            results = yt.search(q, limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    # resultType real de la API: song|video|album|artist|playlist|...
    want = {"songs": {"song", "video"}, "albums": {"album"}, "artists": {"artist"}, "playlists": {"playlist"}, "videos": {"video"}}.get(filter, set())
    if want:
        typed = [r for r in results if (r.get("resultType") or "") in want]
        # Si el tipado deja vacío pero había resultados, son del tipo pedido
        # con otro nombre: se conserva todo para no dejar la UI vacía.
        results = typed
    data = []
    for r in results:
        kind = r.get("resultType") or filter
        # Artistas vienen con "artist" en vez de "title"; videos/otros igual.
        title = r.get("title") or r.get("artist") or r.get("name")
        if not title:
            continue
        if filter in {"songs", "videos"} and not r.get("videoId"):
            continue  # sin videoId no se puede encolar ni sacar letra
        data.append(
            {
                "videoId": r.get("videoId"),
                "browseId": r.get("browseId"),
                "playlistId": r.get("playlistId") or (r.get("browseId", "").removeprefix("VL") if kind == "playlist" else None),
                "title": title,
                "artist": artists_str(r) if kind != "artist" else "",
                "album": (r.get("album") or {}).get("name") if isinstance(r.get("album"), dict) else None,
                "coverUrl": cover(r.get("thumbnails")),
                "kind": kind,
                "durationSec": duration_to_sec(r.get("duration_seconds") or r.get("duration")),
            }
        )
    return JSONResponse({"data": data})


@app.get("/ytm/suggest")
def suggest(q: str):
    if len(q.strip()) < 2:
        return {"data": []}
    yt = get_client()
    try:
        out = yt.get_search_suggestions(q) or []
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"data": out}


@app.get("/ytm/artist/{browse_id}")
def artist(browse_id: str):
    yt = get_client()
    try:
        a = yt.get_artist(browse_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    top = [song_row(t) for t in (a.get("songs") or {}).get("results", [])]
    return {
        "browseId": browse_id,
        "name": a.get("name"),
        "description": a.get("description"),
        "coverUrl": cover(a.get("thumbnails")),
        "topSongs": top,
        "albumsBrowseId": ((a.get("albums") or {}).get("browseId")),
    }


@app.get("/ytm/artist/{browse_id}/albums")
def artist_albums(browse_id: str):
    yt = get_client()
    try:
        section = yt.get_artist(browse_id).get("albums") or {}
        out = (yt.get_artist_albums(section.get("browseId") or browse_id, section["params"])
               if section.get("params") else section.get("results", []))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    data = [
        {
            "browseId": r.get("browseId"),
            "title": r.get("title"),
            "year": r.get("year"),
            "coverUrl": cover(r.get("thumbnails")),
        }
        for r in out
    ]
    return {"data": data}


@app.get("/ytm/album/{browse_id}")
def album(browse_id: str):
    yt = get_client()
    try:
        a = yt.get_album(browse_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    tracks = [song_row(t) for t in (a.get("tracks") or [])]
    return {
        "browseId": browse_id,
        "title": a.get("title"),
        "artist": artists_str({"artists": a.get("artists", [])}),
        "year": a.get("year"),
        "coverUrl": cover(a.get("thumbnails")),
        "tracks": tracks,
    }


@app.get("/ytm/song/{video_id}")
def song(video_id: str):
    yt = get_client()
    try:
        s = yt.get_song(video_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    vd = s.get("videoDetails") or {}
    md = s.get("microformat") or {}
    return {
        "videoId": video_id,
        "title": vd.get("title"),
        "artist": vd.get("author"),
        "coverUrl": cover((md.get("microformatDataRenderer") or {}).get("thumbnail", {}).get("thumbnails")),
        "durationSec": duration_to_sec(vd.get("lengthSeconds")),
    }


@app.get("/ytm/watch")
def watch(videoId: str = "", playlistId: str = ""):
    if not videoId and not playlistId:
        raise HTTPException(status_code=400, detail="videoId o playlistId requerido")
    yt = get_client()
    try:
        w = yt.get_watch_playlist(videoId=videoId or None, playlistId=playlistId or None)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    tracks = [song_row(t) for t in (w.get("tracks") or [])]
    return {"playlistId": w.get("playlistId"), "tracks": tracks}


@app.get("/ytm/playlist/{playlist_id}")
def playlist(playlist_id: str, limit: int = 100):
    yt = get_client()
    playlist_id = playlist_id.removeprefix("VL")
    try:
        p = yt.get_playlist(playlist_id, limit=min(limit, 500))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    tracks = [song_row(t) for t in (p.get("tracks") or [])]
    return {
        "playlistId": playlist_id,
        "title": p.get("title"),
        "description": p.get("description"),
        "coverUrl": cover(p.get("thumbnails")),
        "tracks": tracks,
    }


@app.get("/ytm/charts")
def charts(country: str = "GLOBAL"):
    yt = get_client()
    try:
        c = yt.get_charts(country=country)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return c


@app.get("/ytm/moods")
def moods():
    yt = get_client()
    try:
        return {"data": yt.get_mood_categories()}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/ytm/moods/{params}")
def mood_playlists(params: str):
    yt = get_client()
    try:
        return {"data": yt.get_mood_playlists(params)}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/ytm/lyrics/{video_id}")
def lyrics(video_id: str):
    """Resuelve lyricsId vía watch y devuelve letra. 404 si no hay."""
    yt = get_client()
    try:
        watch = yt.get_watch_playlist(videoId=video_id)
        track = (watch.get("tracks") or [{}])[0]
        lyrics_id = track.get("lyrics")
        if not lyrics_id:
            return JSONResponse(
                {"synced": False, "lines": [], "source": "none"}, status_code=404
            )
        lyr = yt.get_lyrics(lyrics_id)
        return {
            "synced": False,
            "lines": [{"text": lyr.get("lyrics", "")}],
            "source": lyr.get("source", "ytmusic"),
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=os.environ.get("HOST", "127.0.0.1"), port=int(os.environ.get("PORT", "8001")))
