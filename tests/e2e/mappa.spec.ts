// The map of the works (task 17): keyboard, filters, address state, markers, "near me", gestures.
// Tiles are fake (helpers.ts answers every OpenStreetMap tile); the touch test uses Chromium's
// Input.dispatchTouchEvent through CDP, because Playwright has no one-finger drag.
import type { CDPSession, Page } from '@playwright/test';
import { LARGO, TELEFONO, expect, scorrimentoOrizzontale, test, violazioniAxe } from './helpers.ts';

const MARCATORI = '.leaflet-marker-icon';
const VOCI_VISIBILI = 'li[data-voce]:not([hidden])';

async function apri(page: Page, ricerca = '') {
  await page.goto(`/opere/${ricerca}`);
  await expect(page.locator('[data-mappa-opere][data-pronta="1"]')).toBeAttached();
  await expect(page.locator(MARCATORI).first()).toBeVisible();
}

test.describe('the map at 1280 px', () => {
  test.use({ viewport: LARGO, reducedMotion: 'no-preference' });

  test('opens with markers, no sideways scroll, axe clean, no request to locales and no 404', async ({
    page,
  }) => {
    const richieste: string[] = [];
    const fallite: string[] = [];
    page.on('request', (r) => richieste.push(r.url()));
    page.on('response', (r) => r.status() >= 400 && fallite.push(r.url()));
    await apri(page);
    expect(await page.locator(MARCATORI).count()).toBeGreaterThan(10);
    expect(await scorrimentoOrizzontale(page)).toBe(false);
    // Markers of towns with many places overlap at the first zoom (axe "target-size"): zooming,
    // the filters and the list are the other ways in. Everything else must be clean.
    const violazioni = (await violazioniAxe(page)).filter(
      (v) => !(v.regola === 'target-size' && v.elementi.every((e) => /marcatore|title=/.test(e))),
    );
    expect(violazioni).toEqual([]);
    expect(richieste.filter((u) => /locales/.test(u))).toEqual([]);
    expect(fallite).toEqual([]);
    // Markers are our own icons: no image file is asked for them.
    expect(richieste.filter((u) => /marker-icon|marker-shadow/.test(u))).toEqual([]);
  });

  test('the slider, the count and the address work from the keyboard', async ({ page }) => {
    await apri(page);
    const cursore = page.getByRole('slider');
    await cursore.focus();
    await page.keyboard.press('Home');
    await expect(page.locator('[data-conteggio]')).toContainText('Opere fatte fino al 1934');
    await expect(page).toHaveURL(/\?fino=1934$/);
    const prima = await page.locator(VOCI_VISIBILI).count();
    await page.keyboard.press('End');
    await expect(page).not.toHaveURL(/fino=/);
    expect(await page.locator(VOCI_VISIBILI).count()).toBeGreaterThan(prima);
    // The screen reader hears the count on change.
    await expect(page.locator('[data-annuncio]')).toContainText('Opere fatte fino al');
  });

  test('?fino=1975 shows only the works up to that year; ?fino=1912 goes to the minimum', async ({
    page,
  }) => {
    await apri(page, '?fino=1975');
    const anni = await page.locator(VOCI_VISIBILI).evaluateAll((l) =>
      l
        .map((e) => (e as HTMLElement).dataset['anno'])
        .filter(Boolean)
        .map(Number),
    );
    expect(anni.length).toBeGreaterThan(3);
    expect(Math.max(...anni)).toBeLessThanOrEqual(1975);
    await page.goto('/opere/?fino=1912');
    await expect(page.getByRole('slider')).toHaveValue('1934');
    await page.goto('/opere/?fino=abc&comune=roma');
    await expect(page.getByRole('slider')).toHaveValue('1994');
    await expect(page.locator('#mappa-comune')).toHaveValue('');
  });

  test('a filtered marker is no longer reachable with Tab, and the filters come from the address', async ({
    page,
  }) => {
    await apri(page, '?comune=offida&materiale=bronzo');
    await expect(page.locator('#mappa-comune')).toHaveValue('offida');
    const nomi = await page
      .locator(MARCATORI)
      .evaluateAll((l) => l.map((e) => e.getAttribute('aria-label')));
    expect(nomi.length).toBeGreaterThan(0);
    expect(nomi.length).toBeLessThan(5);
    // Tab through the page: every focused marker must be one of the visible ones.
    const visti = new Set<string>();
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press('Tab');
      const nome = await page.evaluate(() =>
        document.activeElement?.classList.contains('leaflet-marker-icon')
          ? document.activeElement.getAttribute('aria-label')
          : null,
      );
      if (nome) visti.add(nome);
    }
    expect([...visti].length).toBeGreaterThan(0);
    for (const nome of visti) expect(nomi).toContain(nome);
  });

  test('"Materiale non indicato" keeps only the works with no material', async ({ page }) => {
    await apri(page);
    await page.locator('#mappa-materiale').selectOption('non-indicato');
    const materiali = await page
      .locator(VOCI_VISIBILI)
      .evaluateAll((l) => l.map((e) => (e as HTMLElement).dataset['materiali']));
    expect(materiali.length).toBeGreaterThan(0);
    expect(materiali.every((m) => m === '')).toBe(true);
  });

  test('a marker opens its popup with Enter and Esc closes it; zoom buttons are real buttons', async ({
    page,
  }) => {
    await apri(page);
    const marcatore = page.locator(MARCATORI).first();
    await marcatore.focus();
    await page.keyboard.press('Enter');
    const popup = page.locator('.leaflet-popup');
    await expect(popup).toBeVisible();
    await expect(popup.locator('a').first()).toHaveAttribute('href', /^\/opere\/[a-z0-9-]+\/$/);
    await page.keyboard.press('Escape');
    await expect(popup).toHaveCount(0);
    const piu = page.getByRole('button', { name: 'Avvicina la mappa' });
    const meno = page.getByRole('button', { name: 'Allontana la mappa' });
    await piu.focus();
    await page.keyboard.press('Enter');
    await meno.focus();
    await page.keyboard.press('Enter');
    await expect(meno).toBeFocused();
  });

  test('"Riproduci" fills the map year by year, "Pausa" stops it', async ({ page }) => {
    await apri(page, '?fino=1934');
    const riproduci = page.getByRole('button', { name: 'Riproduci' });
    const pausa = page.getByRole('button', { name: 'Pausa' });
    await expect(pausa).toBeDisabled();
    const inizio = Number(await page.getByRole('slider').inputValue());
    await riproduci.click();
    await expect(pausa).toBeEnabled();
    await expect
      .poll(async () => Number(await page.getByRole('slider').inputValue()))
      .toBeGreaterThan(inizio);
    await pausa.click();
    await expect(riproduci).toBeEnabled();
    const fermo = await page.getByRole('slider').inputValue();
    await page.waitForTimeout(1000);
    expect(await page.getByRole('slider').inputValue()).toBe(fermo);
  });

  test('without JavaScript the list is there and the page explains the map needs it', async ({
    browser,
  }) => {
    const contesto = await browser.newContext({
      javaScriptEnabled: false,
      baseURL: 'http://localhost:4322',
    });
    const page = await contesto.newPage();
    await page.goto('/opere/');
    await expect(page.locator('[data-senza-js]')).toBeVisible();
    await expect(page.locator('[data-riquadro]')).toBeHidden();
    expect(await page.locator(VOCI_VISIBILI).count()).toBe(27);
    await contesto.close();
  });
});

test.describe('"near me"', () => {
  test.use({
    viewport: LARGO,
    geolocation: { latitude: 42.93, longitude: 13.68 },
    permissions: ['geolocation'],
  });

  test('on click it lists the five nearest works with the distance', async ({ page }) => {
    await apri(page);
    await expect(page.locator('[data-vicino-risultato]')).toBeHidden();
    await page.getByRole('button', { name: 'Opere vicino a me' }).click();
    const voci = page.locator('[data-vicino-elenco] li');
    await expect(voci).toHaveCount(5);
    await expect(voci.first()).toContainText(/\d+(,\d)? km/);
  });
});

test.describe('"near me" without permission', () => {
  test.use({ viewport: LARGO, permissions: [] });
  test('does not ask on load and explains a refusal on click', async ({ page, context }) => {
    await context.grantPermissions([]);
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (_ok, fallimento) =>
        fallimento?.({ code: 1, PERMISSION_DENIED: 1, TIMEOUT: 3 } as GeolocationPositionError);
    });
    await apri(page);
    await expect(page.locator('[data-vicino-messaggio]')).toHaveText('');
    await page.getByRole('button', { name: 'Opere vicino a me' }).click();
    await expect(page.locator('[data-vicino-messaggio]')).toContainText('permesso');
  });
});

test.describe('the map with reduced motion', () => {
  test.use({ viewport: LARGO, reducedMotion: 'reduce' });
  test('has no "Riproduci" and no animation', async ({ page }) => {
    await apri(page);
    await expect(page.getByRole('button', { name: 'Riproduci' })).toBeHidden();
    await expect(page.getByRole('slider')).toBeVisible();
    const durata = await page
      .locator('.leaflet-gesture-handling')
      .evaluate((e) => getComputedStyle(e, '::after').transitionDuration);
    expect(durata).toBe('0s');
  });
});

test.describe('gestures on a touch device', () => {
  test.use({ viewport: TELEFONO, hasTouch: true, reducedMotion: 'no-preference' });

  type Dito = { x: number; y: number };
  const toccare =
    (cdp: CDPSession) => (tipo: 'touchStart' | 'touchMove' | 'touchEnd', punti: Dito[]) =>
      cdp.send('Input.dispatchTouchEvent', {
        type: tipo,
        touchPoints: punti.map((p, id) => ({ ...p, id })),
      });
  const posizione = (page: Page) =>
    page
      .locator(MARCATORI)
      .first()
      .evaluate((e) => {
        const r = e.getBoundingClientRect();
        return [Math.round(r.x), Math.round(r.y)];
      });

  test('one finger shows the two-finger message and does not move the map; two fingers move it', async ({
    page,
  }) => {
    await apri(page);
    const tocca = toccare(await page.context().newCDPSession(page));
    const mappa = page.locator('[data-mappa]');
    await mappa.scrollIntoViewIfNeeded();
    const riquadro = (await mappa.boundingBox())!;
    const cx = riquadro.x + riquadro.width / 2;
    const cy = riquadro.y + riquadro.height / 2;
    const prima = await posizione(page);

    await tocca('touchStart', [{ x: cx, y: cy }]);
    await tocca('touchMove', [{ x: cx + 40, y: cy + 5 }]);
    await tocca('touchMove', [{ x: cx + 80, y: cy + 10 }]);
    await expect(page.locator('.leaflet-gesture-handling-touch')).toHaveCount(1);
    const messaggio = await page
      .locator('[data-mappa]')
      .evaluate((e) => getComputedStyle(e, '::after').content);
    expect(messaggio).toContain('Usa due dita per spostare la mappa');
    await tocca('touchEnd', []);
    expect(await posizione(page)).toEqual(prima);

    await tocca('touchStart', [
      { x: cx - 30, y: cy },
      { x: cx + 30, y: cy },
    ]);
    for (const passo of [20, 40, 60]) {
      await tocca('touchMove', [
        { x: cx - 30 + passo, y: cy },
        { x: cx + 30 + passo, y: cy },
      ]);
    }
    await tocca('touchEnd', []);
    expect(await posizione(page)).not.toEqual(prima);
  });
});

test.describe('the small maps (task 18)', () => {
  test.use({ viewport: LARGO, reducedMotion: 'no-preference' });

  test('a work page has the map of its place, loaded when it comes near, with the address without JS', async ({
    page,
    browser,
  }) => {
    const richieste: string[] = [];
    page.on('request', (r) => richieste.push(r.url()));
    await page.goto('/opere/le-merlettaie/');
    const radice = page.locator('[data-mappa-piccola]');
    await radice.scrollIntoViewIfNeeded();
    await expect(radice.locator('.leaflet-marker-icon')).toHaveCount(1);
    await expect(radice.locator('[data-senza-js]')).toBeHidden();
    expect(richieste.filter((u) => /marker-icon|marker-shadow|locales/.test(u))).toEqual([]);
    expect(await scorrimentoOrizzontale(page)).toBe(false);
    // Only the map: the work page has its own contrast question on a photo caption, not part of this task.
    const sulleMappe = (await violazioniAxe(page)).filter((v) =>
      v.elementi.some((e) => /leaflet|mappa|marcatore/.test(e)),
    );
    expect(sulleMappe).toEqual([]);

    const senza = await browser.newContext({ javaScriptEnabled: false });
    const p2 = await senza.newPage();
    await p2.goto(new URL('/opere/le-merlettaie/', page.url()).href);
    await expect(p2.locator('[data-mappa-piccola] [data-senza-js]')).toBeVisible();
    await senza.close();
  });

  test('the marker of a work page opens from the keyboard', async ({ page }) => {
    await page.goto('/opere/le-merlettaie/');
    await page.locator('[data-mappa-piccola]').scrollIntoViewIfNeeded();
    const marcatore = page.locator('[data-mappa-piccola] .leaflet-marker-icon');
    await marcatore.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-mappa-piccola] .leaflet-popup h3')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-mappa-piccola] .leaflet-popup')).toHaveCount(0);
    await expect(marcatore).toBeFocused();
  });

  test('an itinerary has numbered stops in order and a line between them', async ({ page }) => {
    await page.goto('/itinerari/i-portali-del-sergiacomi/');
    const radice = page.locator('[data-mappa-piccola]');
    await radice.scrollIntoViewIfNeeded();
    const marcatori = radice.locator('.leaflet-marker-icon');
    await expect(marcatori.first()).toBeVisible();
    const voci = await page.locator('ol.tappe li').count();
    const numeri = (await marcatori.evaluateAll((els) => els.map((e) => e.textContent ?? '')))
      .join(',')
      .split(/,\s*/)
      .map(Number)
      .sort((a, b) => a - b);
    expect(numeri).toEqual(Array.from({ length: voci }, (_, i) => i + 1));
    await expect(radice.locator('path.percorso').first()).toBeAttached();
    // The first marker is reached with Tab and opens with Enter.
    await marcatori.first().focus();
    await page.keyboard.press('Enter');
    await expect(radice.locator('.leaflet-popup li').first()).toBeVisible();
    expect(await violazioniAxe(page)).toEqual([]);
  });
});
