// Aísla si el fallo 150 depende de la URL de origen (localhost vs 127.0.0.1).
// Uso: node scripts/diag-origin.mjs
import { chromium } from 'playwright';

const VIDEO = process.argv[2] ?? 'dQw4w9WgXcQ';
const ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = [];

for (const app of ORIGINS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const consoleErr = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErr.push(m.text().slice(0, 160)); });
  await page.goto(app, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => report.push({ app, ERR: String(e) }));
  await page.evaluate((v) => {
    localStorage.setItem('wavely:queue:v1', JSON.stringify({
      songs: [{ id: 'seed:1', title: 'Seed', artist: 'Seed', durationSec: 213, videoId: v }],
      currentId: 'seed:1',
    }));
  }, VIDEO);
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(3000);
  let state = null;
  try {
    await page.locator('button[aria-label="Reproducir"]:not([disabled])').first().click({ timeout: 6000 });
  } catch (e) { state = { click: String(e) }; }
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    state = await page.evaluate(() => {
      const s = window.__tm?.store?.getState?.();
      return { status: s?.status, err: s?.error, code: s?.errorCode, pos: Math.round(s?.posSec ?? 0), diag: `${s?.diagApi}|${s?.diagYt}` };
    });
    if (state.status === 'playing' || state.status === 'error') break;
  }
  report.push({ app, video: VIDEO, ...state, consoleErr: consoleErr.slice(0, 4) });
  await page.close();
}

console.log(JSON.stringify(report, null, 2));
await browser.close();
