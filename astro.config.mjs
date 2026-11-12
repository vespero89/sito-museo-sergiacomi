import { defineConfig } from 'astro/config';

// Static output. Security headers and redirects live in config/hosting.mjs (later task),
// not in Astro (`security.csp` stays off).
export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // Never inline stylesheets: the CSP forbids inline <style>.
    inlineStylesheets: 'never',
  },
  vite: {
    build: {
      // Never inline assets as data: URIs.
      assetsInlineLimit: 0,
      // Source maps ship with the public bundle: this is how the GPL-3.0 front-end code
      // is made available (see README.md).
      sourcemap: true,
    },
  },
});
