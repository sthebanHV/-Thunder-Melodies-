import { build, createServer, preview } from 'vite';
import { viteOptions } from './vite-options.mjs';
if (process.argv.includes('build')) await build(viteOptions);
else if (process.argv.includes('preview')) { const server = await preview(viteOptions); server.printUrls(); }
else { const server = await createServer(viteOptions); await server.listen(); server.printUrls(); }
