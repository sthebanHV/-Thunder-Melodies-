import { createServer, request } from 'node:http';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, unlink, stat } from 'node:fs/promises';
import { dirname, resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sessionFile = join(root, '.thunder-session.json');
const token = randomBytes(24).toString('hex');
const instance = randomBytes(8).toString('hex');
const ports = { web: 8787, api: 8788, python: 8789 };
const url = `http://localhost:${ports.web}`;
const children = [];
let server;
let stopping = false;

async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) { if (child.exitCode === null) child.kill(); }
  server?.close();
  try {
    const session = JSON.parse(await readFile(sessionFile, 'utf8'));
    if (session.instance === instance) await unlink(sessionFile);
  } catch { /* No hay una sesión propia guardada. */ }
  process.exit(code);
}

async function isFree(port) {
  return new Promise(resolveResult => {
    const probe = createNetServer();
    probe.once('error', () => resolveResult(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolveResult(true)));
  });
}

function start(command, args, env) {
  const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.once('error', error => { console.error(`No se pudo iniciar un servicio: ${error.message}`); void stop(1); });
  child.once('exit', code => { if (!stopping) { console.error(`Un servicio se cerró (código ${code}).`); void stop(1); } });
  return child;
}

async function ready(endpoint, accepts, timeout = 45000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(2000) });
      if (response.ok && accepts(await response.json())) return;
    } catch { /* El servicio está arrancando. */ }
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error(`El servicio no respondió: ${endpoint}`);
}

async function main() {
  if (process.argv.includes('--stop')) {
    try {
      const saved = JSON.parse(await readFile(sessionFile, 'utf8'));
      const response = await fetch(`${saved.url}/_thunder/stop`, {method:'POST', headers:{'x-thunder-token':saved.token}, signal:AbortSignal.timeout(5000)});
      if (!response.ok) throw new Error('La sesión no coincide.');
      console.log('Thunder Melodies detenido.');
    } catch (error) { console.error(`No hay una sesión activa de esta carpeta: ${error.message}`); process.exitCode = 1; }
    return;
  }
  console.log('THUNDER MELODIES · PORTABLE\n');
  for (const port of Object.values(ports)) {
    if (!await isFree(port)) throw new Error(`El puerto ${port} está ocupado. Si Thunder Melodies ya está abierto, entra en ${url}. Usa DETENER.cmd para cerrar la sesión de esta carpeta.`);
  }
  const pythonHome = join(root, 'runtime', 'python');
  start(join(pythonHome, 'python.exe'), ['-s', 'ytm-service/app.py'], {
    PYTHONHOME: pythonHome, PYTHONPATH: '', PYTHONNOUSERSITE: '1', PYTHONDONTWRITEBYTECODE: '1',
    PORT: String(ports.python), HOST: '127.0.0.1',
    YTM_AUTH_FILE: join(root, 'ytm-service', 'headers_auth.json'),
  });
  await ready(`http://127.0.0.1:${ports.python}/health`, body => body.ok === true);
  start(process.execPath, ['--experimental-strip-types', 'server/src/index.ts'], {
    PORT: String(ports.api), HOST: '127.0.0.1', YTM_SERVICE_URL: `http://127.0.0.1:${ports.python}`,
  });
  await ready(`http://127.0.0.1:${ports.api}/api/v1/health`, body => body.ok && body.ytm?.ok);

  const publicRoot = join(root, 'dist');
  const mime = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2' };
  server = createServer(async (req, res) => {
    try {
      // YouTube bloquea el embed (código 150) cuando la página se abre por IP:
      // el origen del reproductor tiene que ser localhost.
      const host = req.headers.host ?? '';
      if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host) || /^\[?::1\]?(:\d+)?$/.test(host)) {
        const port = (/\]:(\d+)$/.exec(host) ?? /:(\d+)$/.exec(host))?.[1] ?? '';
        res.writeHead(302, {location: `http://localhost${port ? `:${port}` : ''}${req.url}`});
        res.end();
        return;
      }
      const target = new URL(req.url, url);
      if (target.pathname === '/_thunder/health') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ok:true,instance})); return;
      }
      if (target.pathname === '/_thunder/stop') {
        if (req.method !== 'POST' || req.headers['x-thunder-token'] !== token) { res.writeHead(403); res.end(); return; }
        res.end('Cerrando Thunder Melodies'); setTimeout(() => void stop(), 100); return;
      }
      if (target.pathname.startsWith('/api/')) {
        const upstream = request({hostname:'127.0.0.1',port:ports.api,path:target.pathname+target.search,method:req.method,headers:{...req.headers,host:`127.0.0.1:${ports.api}`}}, response => {
          res.writeHead(response.statusCode ?? 502, response.headers); response.pipe(res);
        });
        upstream.setTimeout(25000, () => upstream.destroy(new Error('La API tardó demasiado.')));
        upstream.on('error', () => { if (!res.headersSent) { res.writeHead(502,{'content-type':'application/json'}); res.end(JSON.stringify({error:{message:'La API no está disponible. Reinicia Thunder Melodies.'}})); } else res.destroy(); });
        req.pipe(upstream); return;
      }
      if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);res.end();return;}
      let path = resolve(publicRoot, '.'+decodeURIComponent(target.pathname));
      if (path !== publicRoot && !path.startsWith(publicRoot+sep)) {res.writeHead(403);res.end();return;}
      if (target.pathname === '/' || !extname(target.pathname)) path = join(publicRoot,'index.html');
      const info = await stat(path);
      if (!info.isFile()) {res.writeHead(404);res.end();return;}
      res.writeHead(200,{'content-type':mime[extname(path)]??'application/octet-stream','cache-control':'no-cache','referrer-policy':'strict-origin-when-cross-origin'});
      res.end(req.method === 'HEAD' ? undefined : await readFile(path));
    } catch { if (!res.headersSent) {res.writeHead(404);res.end('Archivo no encontrado');} else res.destroy(); }
  });
  await new Promise((resolveReady, reject) => {server.once('error',reject);server.listen(ports.web,'127.0.0.1',resolveReady);});
  await writeFile(sessionFile,JSON.stringify({url,token,instance}), 'utf8');
  console.log(`\nLISTO: ${url}\nMantén esta ventana abierta. Para cerrar: Ctrl+C o DETENER.cmd.\n`);
  if (!process.argv.includes('--no-browser')) spawn('explorer.exe', [url], {windowsHide:true,stdio:'ignore'}).on('error', () => console.log(`Abre manualmente ${url}`));
}

process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
main().catch(error => {console.error(`\nNo se pudo iniciar: ${error.message}\n`); void stop(1);});
