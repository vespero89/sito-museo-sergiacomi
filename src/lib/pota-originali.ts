// Astro copies into dist/_astro/ the original of every photo it imports, even one that no page
// shows (for example the Via crucis photos, which are not attached to any work yet). Those copies
// are dead weight and would make an unpublished photo public, so they are removed after the build.
// The optimised versions (`.avif`, `.webp`, `.jpeg` with a `_hash` suffix) are never touched.
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

const ESTENSIONI_TESTO = /\.(html|css|js|mjs|json|xml|txt|map|webmanifest)$/;

/** Every file under `cartella`, as paths relative to it, with `/` separators. */
function elenca(cartella: string, prefisso = ''): string[] {
  return readdirSync(join(cartella, prefisso), { withFileTypes: true }).flatMap((voce) =>
    voce.isDirectory() ? elenca(cartella, `${prefisso}${voce.name}/`) : [`${prefisso}${voce.name}`],
  );
}

/**
 * Deletes from `dist/_astro/` the copies of the master photos (`<name>.<hash>.jpg`) that no file
 * of `dist/` mentions. Returns what it removed, as paths relative to `dist/`.
 */
export function potaOriginali(dist: string, master: readonly string[]): string[] {
  const cartella = join(dist, '_astro');
  if (!existsSync(cartella)) return [];
  const nomi = new Set(master.map((m) => m.replace(/\.jpg$/, '')));
  const copie = readdirSync(cartella).filter((f) => {
    const nome = /^([^.]+)\.[\w-]{8}\.jpg$/.exec(f)?.[1];
    return nome !== undefined && nomi.has(nome);
  });
  if (copie.length === 0) return [];
  const testo = elenca(dist)
    .filter((f) => ESTENSIONI_TESTO.test(f))
    .map((f) => readFileSync(join(dist, f), 'utf8'))
    .join('\n');
  const tolte = copie.filter((f) => !testo.includes(f));
  for (const f of tolte) rmSync(join(cartella, f));
  return tolte.map((f) => `_astro/${f}`);
}

export function potaOriginaliFoto(): AstroIntegration {
  let radice = '';
  return {
    name: 'pota-originali-foto',
    hooks: {
      'astro:config:done': ({ config }) => {
        radice = fileURLToPath(config.root);
      },
      'astro:build:done': ({ dir, logger }) => {
        const cartellaFoto = join(radice, 'src', 'assets', 'foto');
        const master = existsSync(cartellaFoto) ? readdirSync(cartellaFoto) : [];
        const tolte = potaOriginali(fileURLToPath(dir), master);
        if (tolte.length > 0) {
          logger.info(`removed ${tolte.length} unused photo(s) from dist/_astro`);
        }
      },
    },
  };
}
