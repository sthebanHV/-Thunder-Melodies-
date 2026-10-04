// Diagnóstico de reproducción: abre la app real en Chrome, siembra una cola,
// pulsa Play y muestrea el estado interno (store/motor) + red de YouTube.
// Uso: node scripts/diag-playback.mjs
import { chromium } from 'playwright';

const APP = 'http://localhost:5173';
const SEED = {
  songs: [
    {
      id: 'seed:1',
      title: 'Never Gonna Give You Up',
      artist: 'Rick Astley',
      album: 'Whenever You Need Somebody',
      durationSec: 213,
      coverUrl: null,
      videoId: 'dQw4w9WgXcQ',
    },
    {
      id: 'seed:2',
      title: 'Yellow',
      artist: 'Coldplay',
      album: 'Parachutes',
      durationSec: 269,
      coverUrl: null,
      videoId: 'fJ9rUzIMcZQ',
    },
  ],
  currentId: 'seed:1',
};

const consoleMsgs = [];
const netEvents = [];
const pageErrors = [];

const isYT = (url) => /youtube|googlevideo|ytimg|ggpht/.test(url);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });

page.on('console', (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('requestfailed', (r) => {
  if (isYT(r.url())) netEvents.push({ kind: 'FAILED', url: r.url().slice(0, 140), err: r.failure()?.errorText });
});
page.on('response', (r) => {
  if (isYT(r.url())) netEvents.push({ kind: r.status(), url: r.url().slice(0, 140) });
});

function snap(label) {
  return page
    .evaluate((lb) => {
      const t = window.__tm;
      const el = document.getElementById('yt-full-audio');
      const frame = document.querySelector('iframe[src*="youtube"]');
      const s = t?.store?.getState?.();
      const ytReady = !!window.YT?.Player;
      return {
        label: lb,
        hasTm: !!t,
        ytApi: ytReady,
        status: s?.status,
        currentId: s?.currentId,
        loadKick: s?.loadKick,
        posSec: s?.posSec,
        durationSec: s?.durationSec,
        error: s?.error,
        errorCode: s?.errorCode,
        source: s?.source,
        diagApi: s?.diagApi,
        diagYt: s?.diagYt,
        diagErr: s?.diagErr,
        playerTag: el?.tagName ?? (frame ? 'IFRAME(hip)' : null),
        playerVisible: frame ? getComputedStyle(frame).opacity : el ? getComputedStyle(el).opacity : null,
        iframeSrc: frame?.src?.slice(0, 140) ?? null,
      };
    }, label)
    .catch((e) => ({ label, ERR: String(e) }));
}

const samples = [];

try {
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 30000 });
} catch (e) {
  console.log('NO SE ABRIÓ LA APP:', e);
}

// Semilla de cola + recarga para que el restore la cargue.
await page.evaluate((q) => localStorage.setItem('wavely:queue:v1', JSON.stringify(q)), SEED).catch(() => {});
await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(3500);

samples.push(await snap('tras-carga'));

// Pulsar ▍en la barra inferior (clic real, con gesto de usuario).
let clicked = false;
try {
  await page.locator('button[aria-label="Reproducir"]:not([disabled])').first().click({ timeout: 5000 });
  clicked = true;
} catch (e) {
  clicked = String(e);
}

for (let i = 1; i <= 12; i++) {
  await page.waitForTimeout(1000);
  samples.push(await snap(`t+${i}s`));
}

// FASE 2 — flujo real del usuario: buscar en YT Music y pulsar ▶ del resultado.
await page
  .locator('input[aria-label="Buscar canciones, artistas, álbumes"]')
  .fill('coldplay', { delay: 30 })
  .catch((e) => console.log('fill falló:', e));
await page.waitForTimeout(3000); // debounce + fetch
let clickedSearch = false;
try {
  await page.locator('button[aria-label^="Reproducir "]').first().click({ timeout: 8000 });
  clickedSearch = true;
} catch (e) {
  clickedSearch = String(e);
}
const searchItems = await page
  .evaluate(() => [...document.querySelectorAll('ul li p')].slice(0, 6).map((p) => p.textContent))
  .catch(() => []);

for (let i = 1; i <= 12; i++) {
  await page.waitForTimeout(1000);
  samples.push(await snap(`busqueda+t+${i}s`));
}

const report = {
  clicked,
  clickedSearch,
  searchItems,
  pageErrors,
  samples: samples.map((s) => ({
    t: s.label,
    status: s.status,
    kick: s.loadKick,
    pos: s.posSec,
    dur: s.durationSec,
    diag: `${s.diagApi}|${s.diagYt}|${s.diagErr}`,
    err: s.error,
    code: s.errorCode,
    ytApi: s.ytApi,
    player: s.playerTag,
    iframe: s.iframeSrc,
  })),
  net: netEvents.slice(0, 60),
  console: consoleMsgs.filter((m) => !/Download the React DevTools/i.test(m)).slice(0, 40),
};

console.log(JSON.stringify(report, null, 2));
await browser.close();
