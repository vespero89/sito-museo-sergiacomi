import { describe, expect, it } from 'vitest';
import { builtPages } from './helpers';

// The CSP (config/hosting.mjs, later task) allows no inline <style>, style="" or inline script.
describe('built pages carry no inline code', () => {
  const pages = builtPages();

  it('builds at least one page', () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it.each(pages.map((page) => [page.path, page.document] as const))(
    '%s has no <style>, style="", inline <script> or on* handler',
    (_path, document) => {
      expect(document.querySelectorAll('style')).toHaveLength(0);
      expect(document.querySelectorAll('[style]')).toHaveLength(0);
      expect(document.querySelectorAll('script:not([src])')).toHaveLength(0);
      const withHandler = [...document.querySelectorAll('*')].filter((element) =>
        [...element.attributes].some((attribute) => attribute.name.startsWith('on')),
      );
      expect(withHandler).toHaveLength(0);
    },
  );
});
