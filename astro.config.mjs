import { defineConfig } from 'astro/config';
import { bloccoProduzione } from './src/lib/blocco-produzione.ts';
import { ORIGINE_PREDEFINITA } from './src/lib/seo.ts';
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
    build: {
      // Never inline assets as data: URIs.
      assetsInlineLimit: 0,
    },
  },
});
