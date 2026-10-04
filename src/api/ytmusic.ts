import type { Song } from '../domain/playlist/DoublyLinkedList';

export interface YTSearchItem {
  videoId?: string | null;
  browseId?: string | null;
  playlistId?: string | null;
  title: string;
  artist: string;
  album?: string | null;
  coverUrl?: string | null;
  kind?: string;
  durationSec?: number | null;
}

export interface YTAlbum {
  browseId: string;
  title: string;
  artist: string;
  year?: string | null;
  coverUrl?: string | null;
  tracks: YTSearchItem[];
}

export interface YTArtist {
  browseId: string;
  name: string;
  description?: string | null;
  coverUrl?: string | null;
  topSongs: YTSearchItem[];
}

export interface YTPlaylist {
  playlistId: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  tracks: YTSearchItem[];
}

const BASE_URL = 'https://diplomatic-insight-production-9f6a.up.railway.app';

async function getJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
  const r = await fetch(fullUrl, { signal });
  if (!r.ok) {
    const body = await r.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `El servicio respondió con un error (${r.status}).`);
  }
  return (await r.json()) as T;
}

export function toSong(t: YTSearchItem): Song {
  const id = t.videoId ? `yt:${t.videoId}` : `yt:browse:${t.browseId ?? t.title}`;
  return {
    id,
    title: t.title,
    artist: t.artist,
    album: t.album ?? undefined,
    durationSec: t.durationSec ?? 0,
    coverUrl: t.coverUrl ?? undefined,
    videoId: t.videoId ?? null,
  };
}

/** Búsqueda agrupada (songs/albums/artists/playlists). */
export async function searchYTM(q: string, type: 'songs' | 'videos' | 'albums' | 'artists' | 'playlists' = 'songs', signal?: AbortSignal): Promise<YTSearchItem[]> {
  if (q.trim().length < 2) return [];
  const data = await getJSON<{ data: YTSearchItem[] }>(`/api/v1/search?q=${encodeURIComponent(q)}&type=${type}`, signal);
  return data.data;
}

export async function suggestYTM(q: string, signal?: AbortSignal): Promise<string[]> {
  if (q.trim().length < 2) return [];
  const data = await getJSON<{ data: string[] }>(`/api/v1/search/suggest?q=${encodeURIComponent(q)}`, signal);
  return data.data;
}

export async function getArtist(browseId: string): Promise<YTArtist> {
  return getJSON<YTArtist>(`/api/v1/artists/${encodeURIComponent(browseId)}`);
}

export async function getAlbum(browseId: string): Promise<YTAlbum> {
  return getJSON<YTAlbum>(`/api/v1/albums/${encodeURIComponent(browseId)}`);
}

export async function getPlaylist(playlistId: string): Promise<YTPlaylist> {
  return getJSON<YTPlaylist>(`/api/v1/playlists/${encodeURIComponent(playlistId)}`);
}

export async function getCharts(country = 'GLOBAL'): Promise<unknown> {
  return getJSON<unknown>(`/api/v1/charts?country=${encodeURIComponent(country)}`);
}

export async function getWatch(videoId = '', playlistId = ''): Promise<{ playlistId?: string; tracks: YTSearchItem[] }> {
  return getJSON(`/api/v1/watch?videoId=${encodeURIComponent(videoId)}&playlistId=${encodeURIComponent(playlistId)}`);
}
