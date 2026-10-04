import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';

const app = Fastify({ logger: true });
const YTM = process.env.YTM_SERVICE_URL ?? 'http://localhost:8001';

await app.register(cors, {
  origin: [
    'https://*.vercel.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ],
  credentials: true,
});

// Caché en memoria 5 min (sustituir por Redis en V1 según AGENTS §10).
const cache = new Map<string, { at: number; body: unknown }>();
const TTL = 5 * 60 * 1000;
function cached(key: string): unknown | null {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.body;
  cache.delete(key);
  return null;
}
function put(key: string, body: unknown): void {
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), body });
}

async function proxyYTM(key: string, url: string, reply: { status: (c: number) => { send: (b: unknown) => unknown }; send: (b: unknown) => unknown }): Promise<unknown> {
  const hit = cached(key);
  if (hit) return hit;
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`ytm ${r.status} ${text.slice(0, 200)}`);
  }
  const body = await r.json();
  put(key, body);
  return body;
}

const searchQuery = z.object({
  q: z.string().min(2).max(120),
  type: z.enum(['songs', 'videos', 'albums', 'artists', 'playlists']).default('songs'),
});
const browseId = z.object({ id: z.string().min(2).max(64) });
const playlistId = z.object({ id: z.string().min(2).max(128) });

function err(reply: { status: (c: number) => { send: (b: unknown) => unknown } }, code: string, message: string, status = 400): unknown {
  return reply.status(status).send({ error: { code, message } });
}

app.get('/api/v1/health', async () => {
  try {
    const r = await fetch(`${YTM}/health`, { signal: AbortSignal.timeout(5000) });
    const ytm = r.ok ? await r.json() : { ok: false };
    return { ok: true, ytm };
  } catch {
    return { ok: true, ytm: { ok: false } };
  }
});

app.get('/api/v1/search', async (req, reply) => {
  const parsed = searchQuery.safeParse(req.query);
  if (!parsed.success) return err(reply, 'BAD_QUERY', 'q mínimo 2 caracteres');
  const { q, type } = parsed.data;
  const key = `search:${type}:${q}`;
  try {
    const body = (await proxyYTM(key, `${YTM}/ytm/search?q=${encodeURIComponent(q)}&filter=${type}`, reply)) as { data: unknown[] };
    return { data: body.data, page: 1, pageSize: body.data.length, total: body.data.length };
  } catch (e) {
    req.log.warn({ e }, 'ytm search caído');
    return err(reply, 'YTM_DOWN', 'No se pudo conectar con YouTube Music. Comprueba que el servicio Python esté encendido e inténtalo de nuevo.', 502);
  }
});

app.get('/api/v1/search/suggest', async (req, reply) => {
  const parsed = z.object({ q: z.string().min(2).max(120) }).safeParse(req.query);
  if (!parsed.success) return err(reply, 'BAD_QUERY', 'q mínimo 2 caracteres');
  try {
    return await proxyYTM(`suggest:${parsed.data.q}`, `${YTM}/ytm/suggest?q=${encodeURIComponent(parsed.data.q)}`, reply);
  } catch (e) {
    req.log.warn({ e }, 'ytm suggest caído');
    return { data: [] };
  }
});

app.get('/api/v1/artists/:id', async (req, reply) => {
  const p = browseId.safeParse(req.params);
  if (!p.success) return err(reply, 'BAD_ID', 'browseId inválido');
  try {
    return await proxyYTM(`artist:${p.data.id}`, `${YTM}/ytm/artist/${encodeURIComponent(p.data.id)}`, reply);
  } catch (e) {
    req.log.warn({ e }, 'ytm artist caído');
    return err(reply, 'YTM_DOWN', 'Artista no disponible', 502);
  }
});

app.get('/api/v1/artists/:id/albums', async (req, reply) => {
  const p = browseId.safeParse(req.params);
  if (!p.success) return err(reply, 'BAD_ID', 'browseId inválido');
  try {
    return await proxyYTM(`artist-albums:${p.data.id}`, `${YTM}/ytm/artist/${encodeURIComponent(p.data.id)}/albums`, reply);
  } catch (e) {
    req.log.warn({ e }, 'ytm artist-albums caído');
    return err(reply, 'YTM_DOWN', 'Discografía no disponible', 502);
  }
});

app.get('/api/v1/albums/:id', async (req, reply) => {
  const p = browseId.safeParse(req.params);
  if (!p.success) return err(reply, 'BAD_ID', 'browseId inválido');
  try {
    return await proxyYTM(`album:${p.data.id}`, `${YTM}/ytm/album/${encodeURIComponent(p.data.id)}`, reply);
  } catch (e) {
    req.log.warn({ e }, 'ytm album caído');
    return err(reply, 'YTM_DOWN', 'Álbum no disponible', 502);
  }
});

app.get('/api/v1/playlists/:id', async (req, reply) => {
  const p = playlistId.safeParse(req.params);
  if (!p.success) return err(reply, 'BAD_ID', 'playlistId inválido');
  try {
    return await proxyYTM(`playlist:${p.data.id}`, `${YTM}/ytm/playlist/${encodeURIComponent(p.data.id)}`, reply);
  } catch (e) {
    req.log.warn({ e }, 'ytm playlist caído');
    return err(reply, 'YTM_DOWN', 'Playlist no disponible', 502);
  }
});

app.get('/api/v1/charts', async (req, reply) => {
  const q = z.object({ country: z.string().max(8).default('GLOBAL') }).safeParse(req.query);
  const country = q.success ? q.data.country : 'GLOBAL';
  try {
    return await proxyYTM(`charts:${country}`, `${YTM}/ytm/charts?country=${encodeURIComponent(country)}`, reply);
  } catch (e) {    req.log.warn({ e }, 'ytm charts caído');
    return err(reply, 'YTM_DOWN', 'Charts no disponibles', 502);
  }
});

app.get('/api/v1/discover', async (req, reply) => {
  try {
    const key = 'discover:moods';
    const moods = (await proxyYTM(key, `${YTM}/ytm/moods`, reply)) as unknown;
    return { sections: [{ title: 'Géneros y estados', items: moods }] };
  } catch (e) {
    req.log.warn({ e }, 'ytm discover caído');
    return { sections: [] };
  }
});

app.get('/api/v1/watch', async (req, reply) => {
  const q = z.object({ videoId: z.string().max(32).default(''), playlistId: z.string().max(128).default('') }).safeParse(req.query);
  if (!q.success || (!q.data.videoId && !q.data.playlistId)) return err(reply, 'BAD_QUERY', 'videoId o playlistId requerido');
  try {
    return await proxyYTM(
      `watch:${q.data.videoId}:${q.data.playlistId}`,
      `${YTM}/ytm/watch?videoId=${encodeURIComponent(q.data.videoId)}&playlistId=${encodeURIComponent(q.data.playlistId)}`,
      reply,
    );
  } catch (e) {
    req.log.warn({ e }, 'ytm watch caído');
    return err(reply, 'YTM_DOWN', 'Watch no disponible', 502);
  }
});

app.get('/api/v1/lyrics/:trackId', async (req) => {
  const { trackId } = req.params as { trackId: string };
  try {
    const r = await fetch(`${YTM}/ytm/lyrics/${encodeURIComponent(trackId)}`);
    if (r.status === 404) return { synced: false, lines: [], source: 'none' };
    if (!r.ok) throw new Error(`ytm ${r.status}`);
    return await r.json();
  } catch {
    return { synced: false, lines: [], source: 'none' };
  }
});

const port = Number(process.env.PORT ?? 3001);
app.listen({ port, host: process.env.HOST ?? '127.0.0.1' }).catch((e) => {
  app.log.error(e);
  process.exit(1);
});
