import { startVitest } from 'vitest/node';
import { viteOptions } from './vite-options.mjs';
const context = await startVitest('test', [], {run: true, config: false}, viteOptions);
if (!context) process.exitCode = 1;
else await context.close();
