import { describe, expect, it } from 'vitest';
import config from '../../astro.config.mjs';

// These options carry rules from the spec (CSP, URL shape).
describe('astro.config.mjs', () => {
  it('uses directory URLs with a trailing slash', () => {
    expect(config.trailingSlash).toBe('always');
    expect(config.build?.format).toBe('directory');
  });

  it('never inlines stylesheets or assets', () => {
    expect(config.build?.inlineStylesheets).toBe('never');
    expect(config.vite?.build?.assetsInlineLimit).toBe(0);
  });
});
