# Project rules: sito-museo-sergiacomi

Static Astro site for the Museo Aldo Sergiacomi. See `README.md` for commands and setup.

- Everything committed is in English: code, comments, commit messages, docs. Site content (page text) is
  Italian data.
- Work on the `prototipo` branch, never on `main`. Never push without Fabio's explicit approval.
- Run `npm run check` before every commit. The pre-commit hook runs it too; never use `--no-verify`.
- Never commit `materiali/` or `appunti/` (git-excluded), secrets, or personal data.
- Dependencies: exact versions (no `^`), each at least 14 days old when adopted, and recorded in the
  lockfile. The version table lives in the working spec (`appunti/prototipo/spec.md`, section 2.2).
- No inline code in the built pages: no `<style>`, no `style=""`, no inline `<script>` (the CSP forbids
  them). Keep `build.inlineStylesheets: 'never'` and `assetsInlineLimit: 0`.
- File and folder names for content: ASCII, lowercase, with hyphens.
- Headers, CSP and redirects live only in `config/hosting.mjs`; `_headers` and `_redirects` are generated
  into `dist/`, never written by hand. Mode decisions come from `decidiModalita`, not from env variables.
- Photos: masters only in `src/assets/foto/` (made by `npm run images`, at most 1 MB each), each with an `alt`
  in `immagini.yaml`; pages use `Foto.astro`, never an `<img>` by hand and never `public/`. No served image
  over 400 KB, `dist/` under 25 MB (tests on `dist/`).
