// Diagnóstico e2e del modo oscuro/claro: toggle, persistencia y estilos computados.
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const results = [];
let failed = 0;

function check(name, ok, extra = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failed += 1;
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('[pageerror]', e.message));

async function tap(selector) {
  const loc = page.locator(selector).first();
  try {
    await loc.click({ timeout: 6000 });
  } catch {
    await loc.evaluate((el) => el.click());
  }
}

const probe = () =>
  page.evaluate(() => {
    const cs = (el) => (el ? getComputedStyle(el) : null);
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      h1: cs(document.querySelector('main h1'))?.color,
      panel: cs(document.querySelector('main .bg-panel'))?.backgroundColor,
      player: cs(document.querySelector('.fixed.inset-x-0.bottom-0'))?.backgroundColor,
      stored: (() => { try { return localStorage.getItem('wavely:theme'); } catch { return null; } })(),
    };
  });

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => localStorage.setItem('wavely:theme', 'dark'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  let s = await probe();
  check('default oscuro: data-theme=dark', s.theme === 'dark');
  check('oscuro: fondo body rgb(8,7,13)', s.bodyBg === 'rgb(8, 7, 13)', s.bodyBg);
  check('oscuro: h1 blanco', s.h1 === 'rgb(255, 255, 255)', s.h1);
  check('oscuro: panel #120e22', s.panel === 'rgb(18, 14, 34)', s.panel);
  check('oscuro: bottom player negro/90', s.player === 'rgba(0, 0, 0, 0.9)', s.player);
  await page.screenshot({ path: '.tmp-theme-dark.png', timeout: 60000 });

  // 2) Cambiar a claro.
  await tap('button[aria-label="Cambiar a modo claro"]');
  await page.waitForTimeout(500);
  s = await probe();
  check('toggle → data-theme=light', s.theme === 'light');
  check('claro: guardado en localStorage', s.stored === 'light', String(s.stored));
  check('claro: fondo body rgb(244,241,251)', s.bodyBg === 'rgb(244, 241, 251)', s.bodyBg);
  check('claro: h1 tinta oscura', s.h1 === 'rgb(22, 16, 42)', s.h1);
  check('claro: panel blanco', s.panel === 'rgb(255, 255, 255)', s.panel);
  check('claro: bottom player papel/90', s.player === 'rgba(252, 251, 255, 0.9)', s.player);
  const toggleBack = await page.locator('button[aria-label="Cambiar a modo oscuro"]').count();
  check('claro: botón ahora ofrece volver a oscuro', toggleBack >= 1);
  await page.screenshot({ path: '.tmp-theme-light.png', timeout: 60000 });

  // 3) Persistencia sin parpadeo: aplica antes de React (script inline).
  await page.reload({ waitUntil: 'domcontentloaded' });
  const early = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  check('persiste tras recarga (pre-React)', early === 'light', String(early));
  await page.waitForTimeout(2000);
  s = await probe();
  check('persiste claro tras montar React', s.theme === 'light' && s.bodyBg === 'rgb(244, 241, 251)');

  // 4) Volver a oscuro.
  await tap('button[aria-label="Cambiar a modo oscuro"]');
  await page.waitForTimeout(500);
  s = await probe();
  check('vuelta a oscuro completa', s.theme === 'dark' && s.bodyBg === 'rgb(8, 7, 13)' && s.stored === 'dark');

  // 5) Vista Sonando en claro (portada + controles).
  await tap('button[aria-label="Cambiar a modo claro"]');
  await page.waitForTimeout(300);
  await tap('aside nav button:visible:text-is("Sonando")');
  await page.waitForTimeout(700);
  s = await probe();
  check('Sonando en claro mantiene tema', s.theme === 'light' && s.panel === 'rgb(255, 255, 255)');
  await page.screenshot({ path: '.tmp-theme-light-now.png', timeout: 60000 });
  await tap('button[aria-label="Cambiar a modo oscuro"]');
} catch (e) {
  check('ejecución sin excepción', false, e instanceof Error ? e.message : String(e));
} finally {
  await browser.close();
}

console.log(results.join('\n'));
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURES`);
process.exit(failed === 0 ? 0 : 1);
