import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DIST, walk } from './helpers';

// GPL-3.0: the front-end source (the search index of Pagefind, MIT, is not ours and has no maps) is made available through source maps (README.md).
describe('built JavaScript ships with source maps', () => {
  it('has a .map next to every .js file', () => {
    expect(existsSync(DIST), 'dist/ not found: run "npm run build"').toBe(true);
    const scripts = walk(DIST).filter((file) => file.endsWith('.js') && !file.includes('/pagefind/'));
    const missing = scripts.filter((file) => !existsSync(`${file}.map`));
    expect(missing).toEqual([]);
  });
});
