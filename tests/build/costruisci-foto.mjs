// Builds the real project into `outDir` with one extra test-only page (tests/fixtures/pagina-foto.astro)
// that uses Foto.astro. Run as a separate process by tests/build/foto.test.ts.
//
// Usage: node tests/build/costruisci-foto.mjs <outDir>
import { build } from 'astro';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = fileURLToPath(new URL('../..', import.meta.url));
const outDir = resolve(process.argv[2] ?? join(radice, 'dist-test-foto'));

await build({
  root: radice,
  outDir,
  logLevel: 'error',
  integrations: [
    {
      name: 'pagina-foto-di-prova',
      hooks: {
        'astro:config:setup': ({ injectRoute }) =>
          injectRoute({
            pattern: '/prova-foto',
            entrypoint: join(radice, 'tests', 'fixtures', 'pagina-foto.astro'),
          }),
      },
    },
  ],
});
