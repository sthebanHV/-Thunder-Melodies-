// Diagnóstico e2e de playlists manuales (vista Listas) contra el dev server.
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

async function tap(target) {
  const loc = typeof target === 'string' ? page.locator(target).first() : target;
  try {
    await loc.click({ timeout: 6000 });
  } catch {
    await loc.evaluate((el) => el.click());
  }
}

try {
  // Cola sembrada (3 canciones) para "Guardar cola".
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    const songs = [1, 2, 3].map((n) => ({
      id: `seed:${n}`, title: `Canción ${n}`, artist: 'Artista', durationSec: 120 + n,
    }));
    localStorage.setItem('wavely:queue:v1', JSON.stringify({ songs, currentId: null }));
    localStorage.setItem('wavely:playlists:v1', JSON.stringify([]));
    localStorage.setItem('wavely:favs:v1', JSON.stringify([]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  await tap('aside nav button:visible:text-is("Listas")');
  await page.waitForTimeout(600);

  // 1) Crear playlist manual.
  await page.fill('input[aria-label="Nombre de la playlist nueva"]', 'Nocturno');
  await tap('button:visible:text-is("Crear playlist")');
  await page.waitForTimeout(400);
  const card1 = page.locator('article', { hasText: 'Nocturno' });
  check('crear playlist', await card1.count() >= 1);
  const detailVisible = await page.locator('section[aria-label="Detalle de Nocturno"]').isVisible();
  check('detalle abre al crear', detailVisible);

  // 2) Duplicado rechazado con alerta.
  await page.fill('input[aria-label="Nombre de la playlist nueva"]', 'nocturno');
  await tap('button:visible:text-is("Crear playlist")');
  await page.waitForTimeout(300);
  const alertText = await page.locator('section:has(h3:text-is("Tus playlists")) p[role="alert"]').first().textContent().catch(() => '');
  check('duplicado rechazado', /Ya existe/i.test(alertText ?? ''), alertText ?? '');

  // 3) Renombrar.
  await tap('button:visible:text-is("Renombrar")');
  await page.fill('input[aria-label="Nuevo nombre de la playlist"]', 'Nocturno v2');
  await tap('form button:visible:text-is("Guardar")');
  await page.waitForTimeout(300);
  check('renombrar', (await page.locator('section[aria-label="Detalle de Nocturno v2"]').count()) === 1);

  // 4) Agregar canción manual al detalle.
  await page.fill('input[aria-label="Título de la canción"]', 'Bajo la luna');
  await page.fill('input[aria-label="Artista de la canción"]', 'Sensei');
  await tap(page.locator('section[aria-label="Detalle de Nocturno v2"] button:text-is("Agregar")'));
  await page.waitForTimeout(300);
  const rowOk = await page.locator('section[aria-label="Detalle de Nocturno v2"] li', { hasText: 'Bajo la luna' }).count();
  check('agregar canción manual', rowOk === 1);

  // 5) Guardar cola actual como playlist.
  await page.fill('input[aria-label="Nombre de la playlist nueva"]', '');
  await tap('button:visible:text-is("Guardar cola (3)")');
  await page.waitForTimeout(400);
  const card2 = page.locator('article', { hasText: /Cola \d/ });
  check('guardar cola como playlist', await card2.count() >= 1);

  // 6) Cargar playlist en la cola (reemplaza y arranca).
  await tap(card2.first().locator('button:text-is("Cargar en cola")'));
  await page.waitForTimeout(600);
  const queueRows = await page.locator('section:has(h3:text-is("Cola — 3 canciones")) ul > li').count();
  check('cargar en cola reemplaza (3 filas)', queueRows === 3, `rows=${queueRows}`);
  const queueText = await page.locator('section:has(h3:text-is("Cola — 3 canciones")) ul').textContent().catch(() => '');
  check('cola viene de la playlist (no de la anterior)', !(queueText ?? '').includes('Bajo la luna'));

  // 7) Eliminación con confirmación en dos pasos.
  await tap(card2.first().locator('button:has-text("Eliminar")'));
  await page.waitForTimeout(200);
  const armed = await card2.first().locator('button:has-text("¿Seguro?")').count();
  check('confirmación en 2 pasos armada', armed === 1);
  await tap(card2.first().locator('button:has-text("¿Seguro?")'));
  await page.waitForTimeout(300);
  check('playlist eliminada', (await page.locator('article', { hasText: /Cola \d/ }).count()) === 0);

  // 8) Persistencia tras recargar.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await tap('aside nav button:visible:text-is("Listas")');
  await page.waitForTimeout(500);
  check('persiste tras recarga', await page.locator('article', { hasText: 'Nocturno v2' }).count() >= 1);

  // 9) Responsive rápido: sin scroll horizontal en 360 y 768.
  for (const [w, h] of [[360, 740], [768, 1024]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(500);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(`sin scroll horizontal ${w}px`, sw <= w, `scrollW=${sw}`);
  }

  await page.screenshot({ path: '.audit-playlists.png', timeout: 60000 });
} catch (e) {
  check('ejecución sin excepción', false, e instanceof Error ? e.message : String(e));
} finally {
  await browser.close();
}

console.log(results.join('\n'));
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURES`);
process.exit(failed === 0 ? 0 : 1);
