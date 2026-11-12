import AxeBuilder from '@axe-core/playwright';
import { expect, test as base, type Page } from '@playwright/test';

/** Phone and wide screen sizes used by the layout tests (spec 8-B). */
export const TELEFONO = { width: 390, height: 844 };
export const LARGO = { width: 1280, height: 800 };

/** The only outside host the pages may reach, and only through the fake tile below. */
const HOST_TILE_OSM = 'tile.openstreetmap.org';

// A 1x1 transparent PNG, the fake answer to every OpenStreetMap tile.
const TILE_FINTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

export interface Monitor {
  /** Console errors that Chromium prints for a blocked resource (Content Security Policy). */
  csp: string[];
  /** Requests to an origin other than the site, except the fake tiles. */
  esterne: string[];
  /** Opt out of the final check, for the test that proves the monitor sees violations. */
  ignora(): void;
}

/**
 * `test` with a monitor on every page: at the end of each test it fails if a CSP violation or a
 * request outside the site origin happened. OpenStreetMap tiles get a fake answer, other
 * outside hosts are aborted and recorded.
 */
export const test = base.extend<{ monitor: Monitor }>({
  monitor: [
    async ({ page, baseURL }, use) => {
      const origine = new URL(baseURL ?? 'http://127.0.0.1').origin;
      let ignorato = false;
      const monitor: Monitor = {
        csp: [],
        esterne: [],
        ignora: () => {
          ignorato = true;
        },
      };
      page.on('console', (msg) => {
        if (msg.type() === 'error' && /Content Security Policy/i.test(msg.text())) {
          monitor.csp.push(msg.text());
        }
      });
      await page.route(
        (url) => /^https?:$/.test(url.protocol) && url.origin !== origine,
        (route) => {
          const url = new URL(route.request().url());
          if (url.hostname === HOST_TILE_OSM) {
            return route.fulfill({ contentType: 'image/png', body: TILE_FINTO });
          }
          monitor.esterne.push(url.href);
          return route.abort();
        },
      );
      await use(monitor);
      if (!ignorato) {
        expect(monitor.csp, 'CSP violations').toEqual([]);
        expect(monitor.esterne, 'requests outside the site origin').toEqual([]);
      }
    },
    { auto: true },
  ],
});

export { expect };

/** axe-core with the WCAG 2.2 AA rule sets; returns the violations (empty when clean). */
export async function violazioniAxe(page: Page) {
  const risultato = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return risultato.violations.map((v) => ({
    regola: v.id,
    impatto: v.impact,
    elementi: v.nodes.map((n) => n.target.join(' ')),
  }));
}

/** True when the page scrolls sideways. */
export function scorrimentoOrizzontale(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}

/** Presses Tab until `ok` says the focused element is the one wanted; false after `max` presses. */
export async function tabFinoA(page: Page, ok: () => Promise<boolean>, max = 40): Promise<boolean> {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await ok()) return true;
  }
  return false;
}
