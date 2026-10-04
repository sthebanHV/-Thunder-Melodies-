// Comprueba cuántos resultados de la pestaña Videos se pueden reproducir
// de verdad en el iframe de YouTube (y con qué código fallan los que no).
// Uso: node scripts/diag-videos.mjs [query]
import { chromium } from 'playwright';

const APP = process.env.APP ?? 'http://127.0.0.1:5173';
const QUERY = process.argv[2] ?? 'dua lipa';
const TRIES = 4;
const SAMPLES = 7;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const apiFails = [];
page.on('response', (r) => { if (/\/api\//.test(r.url()) && r.status() >= 400) apiFails.push(`${r.status()} ${r.url().slice(0, 110)}`); });

const state = () => page.evaluate(() => {
  const s = window.__tm?.store?.getState?.();
  return { status: s?.status, err: s?.error, code: s?.errorCode, diag: s?.diagYt, title: s?.songs?.find(x => x.id === s.currentId)?.title };
});

await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.locator('input[aria-label="Buscar canciones, artistas, álbumes"]').fill(QUERY, { delay: 40 });
await page.waitForTimeout(1200);
await page.getByRole('button', { name: 'Videos', exact: true }).click();
await page.waitForTimeout(4000);

const titles = await page.evaluate(() => [...document.querySelectorAll('button[aria-label^="Reproducir "]')].map(b => b.getAttribute('aria-label')));
console.log('resultados de Videos:', titles.length);

const out = [];
for (let i = 0; i < Math.min(TRIES, titles.length); i++) {
  await page.locator(`button[aria-label="${titles[i].replace(/"/g, '\\"')}"]`).first().click({ timeout: 8000 });
  let final = null;
  for (let s = 0; s < SAMPLES; s++) {
    await page.waitForTimeout(1000);
    const st = await state();
    if (st.status === 'playing') { final = { ...st, ok: true }; break; }
    if (st.status === 'error') { final = { ...st, ok: false }; break; }
    final = { ...st, ok: false };
  }
  out.push({ clicked: titles[i].replace(/^Reproducir /, '').slice(0, 60), ...final });
  if (final?.ok) await page.waitForTimeout(1500);
}

// Y una canción (pestaña Canciones) para comparar.
await page.getByRole('button', { name: 'Canciones', exact: true }).click();
await page.waitForTimeout(4000);
const songTitles = await page.evaluate(() => [...document.querySelectorAll('button[aria-label^="Reproducir "]')].map(b => b.getAttribute('aria-label')));
if (songTitles.length) {
  await page.locator(`button[aria-label="${songTitles[0].replace(/"/g, '\\"')}"]`).first().click({ timeout: 8000 });
  let final = null;
  for (let s = 0; s < SAMPLES; s++) {
    await page.waitForTimeout(1000);
    const st = await state();
    if (st.status === 'playing') { final = { ...st, ok: true }; break; }
    if (st.status === 'error') { final = { ...st, ok: false }; break; }
    final = { ...st, ok: false };
  }
  out.push({ clicked: 'CANCIONES: ' + songTitles[0].replace(/^Reproducir /, '').slice(0, 55), ...final });
}

console.log(JSON.stringify({ out, apiFails }, null, 2));
await browser.close();
