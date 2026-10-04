import type { Song } from '../domain/playlist/DoublyLinkedList';
import { API_BASE_URL } from '../config/api';

export interface YTSearchItem {
  videoId: string;
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string;
  durationSec?: number;
}

const BASE_URL = API_BASE_URL;

async function getJSON<T>(url: string): Promise<T> {
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
  const r = await fetch(fullUrl);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

/** Busca en backend (Fastify -> ytm-service). Con fallback a demo local si API cae. */
export async function searchCatalog(q: string): Promise<Song[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  try {
    const data = await getJSON<{ data: YTSearchItem[] }>(
      `/api/v1/search?q=${encodeURIComponent(query)}`,
    );
    return data.data.map((t) => ({
      id: `yt:${t.videoId}`,
      title: t.title,
      artist: t.artist,
      album: t.album,
      durationSec: t.durationSec ?? 200,
      coverUrl: t.coverUrl,
      videoId: t.videoId,
    }));
  } catch {
    const demo: Song[] = [
      { id: 'demo:1', title: `Demo — ${query} (sin backend)`, artist: 'Wavely Demo', durationSec: 187 },
      { id: 'demo:2', title: 'Coldplay — Yellow (preview)', artist: 'Coldplay', durationSec: 266 },
    ];
    return demo.filter((d) => d.title.toLowerCase().includes(query.toLowerCase()) || d.artist.toLowerCase().includes(query.toLowerCase()));
  }
}
