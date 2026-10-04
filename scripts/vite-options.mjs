import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
const require = createRequire(import.meta.url);
// Resolve and read through Node: works when a Windows sandbox blocks the native
// esbuild process from traversing the checkout's parent directories.
const windowsResolver = {
  name: 'windows-dependency-reader',
  setup(build) {
    build.onResolve({filter: /.*/}, args => {
      if (args.path.startsWith('node:')) return {path: args.path, external: true};
      try {
        return {path: require.resolve(args.path, {paths: [args.importer ? dirname(args.importer) : process.cwd()]}), namespace: 'node-dependency'};
      } catch { return undefined; }
    });
    build.onLoad({filter: /.*/, namespace: 'node-dependency'}, async args => ({
      contents: await readFile(args.path, 'utf8'),
      loader: args.path.endsWith('.json') ? 'json' : 'js',
      resolveDir: dirname(args.path),
    }));
  },
};
// YouTube rechaza el iframe de reproducción (código 150) cuando la página se
// abre por IP: el origen del embed tiene que ser localhost. Toda petición con
// Host de IP se redirige a localhost conservando puerto y ruta, así da igual
// qué URL se abra (README, favoritos o un atajo antiguo).
function portOf(host) {
  const m = /\]:(\d+)$/.exec(host) ?? /:(\d+)$/.exec(host);
  return m ? m[1] : '';
}
export function isIpHost(host) {
  return /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host) || /^\[?::1\]?(:\d+)?$/.test(host);
}
export function redirectToLocalhost(host, originalUrl) {
  const port = portOf(host);
  return `http://localhost${port ? `:${port}` : ''}${originalUrl ?? '/'}`;
}
export const localhostRedirect = {
  name: 'localhost-redirect',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const host = req.headers.host ?? '';
      if (!isIpHost(host)) return next();
      res.writeHead(302, {location: redirectToLocalhost(host, req.url)});
      res.end();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      const host = req.headers.host ?? '';
      if (!isIpHost(host)) return next();
      res.writeHead(302, {location: redirectToLocalhost(host, req.url)});
      res.end();
    });
  },
};
export const viteOptions = {
  base: './',
  plugins: [react(), localhostRedirect],
  optimizeDeps: {noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'zustand'], esbuildOptions: {plugins: process.platform === 'win32' ? [windowsResolver] : []}},
  server: {host: '127.0.0.1'},
};
