import { fileURLToPath } from 'node:url';
import { satteri } from '@astrojs/markdown-satteri';
import { defineConfig } from 'astro/config';
import { bloccoProduzione } from './src/lib/blocco-produzione.ts';
import { ORIGINE_PREDEFINITA } from './src/lib/seo.ts';
import { mostraAperti } from './src/lib/aperti-visibili.ts';
import { mdastTogliMarcatori } from './src/lib/mdast-togli-marcatori.ts';
import { potaOriginaliFoto } from './src/lib/pota-originali.ts';

// Static output. Security headers and redirects live in config/hosting.mjs (later task),
// not in Astro (`security.csp` stays off).
export default defineConfig({
  // Origin for canonical and Open Graph addresses. The domain is not decided yet: set SITE_URL
  // when it is (the default is a reserved placeholder that never resolves).
  site: process.env.SITE_URL || ORIGINE_PREDEFINITA,
  output: 'static',
  integrations: [bloccoProduzione(), potaOriginaliFoto()],
  trailingSlash: 'always',
  // In production the `[[DA CONFERMARE: ...]]` markers do not reach the public (spec 3.5).
  // (the default Markdown processor is kept in the preview, which shows them)
  markdown: mostraAperti() ? {} : { processor: satteri({ mdastPlugins: [mdastTogliMarcatori] }) },
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
      // Encoder settings picked so that no served image goes over 400 KB (spec 7). The JPEG is the
      // fallback for old browsers: a lower quality with mozjpeg keeps it light.
      config: {
        jpeg: { quality: 74, mozjpeg: true },
        webp: { quality: 78 },
        avif: { quality: 50 },
      },
    },
  },
  build: {
    format: 'directory',
    // Never inline stylesheets: the CSP forbids inline <style>.
    inlineStylesheets: 'never',
  },
  vite: {
    resolve: {
      alias: [
        // The package points `browser` at its compiled file, which reads `document.currentScript`
        // and fails inside a module. The source entry (its `module` field) uses `import.meta.url`.
        {
          find: /^@raruto\/leaflet-gesture-handling$/,
          replacement: fileURLToPath(
            new URL(
              './node_modules/@raruto/leaflet-gesture-handling/src/index.js',
              import.meta.url,
            ),
          ),
        },
      ],
    },
    build: {
      // Never inline assets as data: URIs.
      assetsInlineLimit: 0,
      // Source maps ship with the public bundle: this is how the GPL-3.0 front-end code
      // is made available (see README.md).
      sourcemap: true,
    },
  },
});
