// Reproduce el flujo exacto del usuario: escribir en el buscador, esperar
// resultados y pulsar ▶ (Canciones) y luego en la pestaña Videos.
// Uso: node scripts/diag-userflow.mjs
import { chromium } from 'playwright';

const APP = process.env.APP ?? 'http://127.0.0.1:5173';
const consoleMsgs = [];
const pageErrors = [];
const failedReq = [];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleMsgs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('requestfailed', (r) => { if (/\/api\//.test(r.url())) failedReq.push({ url: r.url().slice(0, 120), err: r.failure()?.errorText }); });
page.on('response', (r) => { if (/\/api\//.test(r.url()) && r.status() >= 400) failedReq.push({ url: r.url().slice(0, 120), status: r.status() }); });

function snap(label) {
  return page.evaluate((lb) => {
    const t = window.__tm;
    const s = t?.store?.getState?.();
    const alert = document.querySelector('[role="alert"]')?.textContent ?? null;
    const notice = [...document.querySelectorAll('p')].map(p => p.textContent).find(x => /Buscando|No se encontraron|No se pudo|error|Error/i.test(x ?? '')) ?? null;
    return {
      label: lb, status: s?.status, err: s?.error, code: s?.errorCode,
      diag: `${s?.diagApi}|${s?.diagYt}|${s?.diagErr}`, source: s?.source,
      queue: s?.songs?.length ?? 0, pos: s?.posSec, dur: s?.durationSec,
      alert, notice,
      rows: document.querySelectorAll('button[aria-label^="Reproducir "]').length,
    };
  }, label).catch((e) => ({ label, ERR: String(e) }));
}

const out = { samples: [], clicked: null, clickedVideos: null };
await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 30000 });

// --- FASE 1: pestaña Canciones ---
await page.locator('input[aria-label="Buscar canciones, artistas, álbumes"]').fill('dua lipa', { delay: 40 });
await page.waitForTimeout(4000);
out.rowsSongs = await page.locator('button[aria-label^="Reproducir "]').count();
out.afterSearch = await snap('tras-busqueda');
try {
  await page.locator('button[aria-label^="Reproducir "]').first().click({ timeout: 8000 });
  out.clicked = true;
} catch (e) { out.clicked = String(e); }
for (let i = 1; i <= 10; i++) { await page.waitForTimeout(1000); out.samples.push(await snap(`songs+t${i}s`)); }

// --- FASE 2: pestaña Videos ---
try {
  await page.getByRole('button', { name: 'Videos', exact: true }).click({ timeout: 5000 });
  out.videosTab = true;
} catch (e) { out.videosTab = String(e); }
await page.waitForTimeout(4500);
out.videosItems = await snap('tras-videos');
try {
  await page.locator('button[aria-label^="Reproducir "]').first().click({ timeout: 8000 });
  out.clickedVideos = true;
} catch (e) { out.clickedVideos = String(e); }
for (let i = 1; i <= 8; i++) { await page.waitForTimeout(1000); out.samples.push(await snap(`videos+t${i}s`)); }

// --- FASE 3: botón principal de la barra inferior (toggle) ---
try {
  await page.locator('button.main-play:not([disabled])').click({ timeout: 5000 });
  out.toggled = true;
} catch (e) { out.toggled = String(e); }
for (let i = 1; i <= 5; i++) { await page.waitForTimeout(1000); out.samples.push(await snap(`toggle+t${i}s`)); }

out.pageErrors = pageErrors;
out.apiFails = failedReq.slice(0, 20);
out.console = consoleMsgs.filter((m) => !/Download the React DevTools|powerPreference|postMessage/i.test(m)).slice(0, 30);
console.log(JSON.stringify(out, null, 2));
await browser.close();
