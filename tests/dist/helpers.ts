import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseHTML } from 'linkedom';

export const DIST = join(import.meta.dirname, '..', '..', 'dist');

/** Every file under `dir`, as absolute paths. */
export function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Every built HTML page, parsed. Fails loudly when `dist/` has not been built. */
export function builtPages(): { path: string; document: Document }[] {
  if (!existsSync(DIST)) {
    throw new Error('dist/ not found: run "npm run build" before the dist tests');
  }
  return walk(DIST)
    .filter((file) => file.endsWith('.html'))
    .map((file) => ({
      path: relative(DIST, file),
      document: parseHTML(readFileSync(file, 'utf8')).document,
    }));
}
