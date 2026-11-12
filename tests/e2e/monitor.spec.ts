// Proof that the monitor in helpers.ts works: it must report a CSP violation and a request to a
// domain that is not allowed. Without this, a clean run could mean the detectors are broken.
import { expect, test } from './helpers.ts';

test('reports a CSP violation (inline script)', async ({ page, monitor }) => {
  monitor.ignora();
  await page.goto('/');
  await page.evaluate(() => {
    const s = document.createElement('script');
    s.textContent = 'window.__eseguito = true';
    document.head.append(s);
  });
  await expect.poll(() => monitor.csp.length).toBeGreaterThan(0);
  expect(await page.evaluate(() => 'eseguito' in window)).toBe(false);
});

test('reports a request to a domain that is not allowed', async ({ page, monitor }) => {
  monitor.ignora();
  // about:blank has no CSP of its own, so the request really leaves the page and the route sees it.
  await page.setContent('<img src="https://dominio-non-ammesso.example/x.png" alt="">');
  await expect.poll(() => monitor.esterne).toEqual(['https://dominio-non-ammesso.example/x.png']);
});

test('OpenStreetMap tiles are faked and not counted as outside requests', async ({
  page,
  monitor,
}) => {
  await page.setContent('<img src="https://tile.openstreetmap.org/1/1/1.png" alt="">');
  await expect.poll(() => page.evaluate(() => document.images[0]?.naturalWidth)).toBe(1);
  expect(monitor.esterne).toEqual([]);
});
