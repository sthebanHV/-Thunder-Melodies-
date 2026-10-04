// Diagnóstico de "Subir música": genera un WAV, lo sube en la app real,
// lo pone a sonar y verifica que el motor local reproduzca (source='local').
// Uso: node scripts/diag-upload.mjs   (vite :5173 corriendo)
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const APP = 'http://localhost:5173';
const TMP = process.env.TEMP || '/tmp';

// WAV PCM 16-bit mono 8 kHz, 6 s (tono 440 Hz) — formato soportado por Chrome.
function makeWav(path) {
  const rate = 8000;
  const secs = 6;
  const n = rate * secs;
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const v = Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 0.3 * 32767);
    data.writeInt16LE(v, i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([h, data]));
}
mkdirSync(TMP, { recursive: true });
const wavPath = `${TMP}\\tm-upload-test.wav`;
makeWav(wavPath);

const consoleMsgs = [];
const pageErrors = [];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
page.on('console', (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => pageErrors.push(String(e)));

function snap(label) {
  return page
    .evaluate((lb) => {
      const t = window.__tm;
      const s = t?.store?.getState?.();
      const a = t?.audioEngine?.audio;
      return {
        label: lb,
        status: s?.status,
        currentId: s?.currentId,
        kick: s?.loadKick,
        pos: s?.posSec,
        dur: s?.durationSec,
        source: s?.source,
        err: s?.error,
        nSongs: s?.songs?.length,
        localSongs: (s?.songs ?? []).filter((x) => x.local).map((x) => x.title),
        audioPaused: a ? a.paused : null,
        audioTime: a ? a.currentTime : null,
        audioSrc: a?.src ? a.src.slice(0, 40) : null,
      };
    }, label)
    .catch((e) => ({ label, ERR: String(e) }));
}

const samples = [];
let bodyText = '';

try {
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Cola vacía para medir el flujo completo de subida.
  await page.evaluate(() => localStorage.setItem('wavely:queue:v1', JSON.stringify({ songs: [], currentId: null })));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  bodyText = await page.evaluate(() => document.body.innerText);

  // 1) Sección de demo eliminada.
  const demoGone = !bodyText.includes('Tendencias ahora') && !bodyText.includes('Álbumes destacados');

  // 2) Abrir "Subir música".
  await page.locator('button:has-text("Subir música")').first().click({ timeout: 5000 });
  await page.waitForTimeout(500);

  // 3) Subir el WAV.
  await page.locator('input[type="file"]').setInputFiles(wavPath);
  await page.waitForFunction(
    () => (window.__tm?.store?.getState?.().songs ?? []).some((s) => s.local),
    null,
    { timeout: 15000 },
  );
  samples.push(await snap('tras-subir'));

  const statusMsg = await page.locator('[role="status"]').first().textContent().catch(() => null);

  // 4) Sonar el archivo subido y dejarlo avanzar.
  await page.locator('button:has-text("Sonar")').first().click({ timeout: 5000 });
  for (let i = 1; i <= 2; i++) {
    await page.waitForTimeout(1000);
    samples.push(await snap(`sonando+t+${i}s`));
  }

  // 5) Pausa con el botón de la barra inferior (y verificación de congelación).
  await page.locator('button[aria-label="Pausar"]').first().click({ timeout: 5000 });
  await page.waitForTimeout(600);
  samples.push(await snap('tras-pausa'));
  await page.waitForTimeout(1200);
  samples.push(await snap('pausa+1.2s'));

  // 6) Reanudar.
  await page.locator('button[aria-label="Reproducir"]').first().click({ timeout: 5000 });
  await page.waitForTimeout(1200);
  samples.push(await snap('reanudada'));

  // 7) Badge "Archivo local" en Sonando.
  await page.locator('button:has-text("Sonando")').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
  const nowText = await page.evaluate(() => document.body.innerText);

  const report = {
    demoGone,
    statusMsg,
    badgeLocal: nowText.includes('Archivo local'),
    pageErrors,
    samples,
    console: consoleMsgs.filter((m) => !/Download the React DevTools/i.test(m)).slice(0, 30),
  };
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  console.log('FALLO:', e);
  console.log(JSON.stringify({ samples, pageErrors }, null, 2));
} finally {
  await browser.close();
}
