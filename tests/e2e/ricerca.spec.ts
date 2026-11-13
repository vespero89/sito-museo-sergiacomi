// Search (Pagefind) and archive filters (task 20). The search runs on the real index in dist/ with
// the real CSP, so WebAssembly must load with zero violations.
import { LARGO, TELEFONO, expect, test, violazioniAxe } from './helpers.ts';

test.describe('search page', () => {
  test.use({ viewport: LARGO });

  test('finds "Merlettaie" with no CSP violation and no failed request', async ({ page }) => {
    const violazioni: string[] = [];
    const fallite: string[] = [];
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) =>
        (window as unknown as { __csp: string[] }).__csp.push(
          `${e.violatedDirective} ${e.blockedURI}`,
        ),
      );
      (window as unknown as { __csp: string[] }).__csp = [];
    });
    page.on('response', (r) => r.status() >= 400 && fallite.push(r.url()));
    await page.goto('/ricerca/');
    await page.getByLabel('Cosa cerchi?').fill('Merlettaie');
    await page.getByRole('button', { name: 'Cerca' }).click();
    const risultati = page.locator('[data-risultati] li a');
    await expect(risultati.first()).toBeVisible();
    await expect(page.locator('[data-stato]')).toContainText('risultat');
    const indirizzi = await risultati.evaluateAll((a) => a.map((x) => x.getAttribute('href')));
    expect(indirizzi).toContain('/opere/le-merlettaie/');
    // The menu and the footer are not in the index: a word only they contain finds nothing.
    await page.getByLabel('Cosa cerchi?').fill('Xylofono');
    await page.getByRole('button', { name: 'Cerca' }).click();
    await expect(page.locator('[data-stato]')).toContainText('Nessun risultato');
    violazioni.push(
      ...(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)),
    );
    expect(violazioni).toEqual([]);
    expect(fallite).toEqual([]);
    expect(await violazioniAxe(page)).toEqual([]);
  });

  test('the address keeps the search: ?q= runs it on load', async ({ page }) => {
    await page.goto('/ricerca/?q=Merlettaie');
    await expect(page.locator('[data-risultati] li a').first()).toBeVisible();
    await expect(page.getByLabel('Cosa cerchi?')).toHaveValue('Merlettaie');
  });

  test('without JavaScript the page explains and lists the sections', async ({ browser }) => {
    const contesto = await browser.newContext({ javaScriptEnabled: false });
    const pagina = await contesto.newPage();
    await pagina.goto('http://127.0.0.1:4322/ricerca/');
    await expect(pagina.locator('[data-senza-js]')).toBeVisible();
    await expect(pagina.locator('[data-modulo]')).toBeHidden();
    await expect(pagina.locator('[data-sezioni] a').first()).toBeVisible();
    await contesto.close();
  });
});

test.describe('archive filters', () => {
  test.use({ viewport: TELEFONO });

  test('hide the cards that do not match, keep the state in the address, restore it on load', async ({
    page,
  }) => {
    await page.goto('/archivio/');
    const schede = page.locator('li[data-tipo]');
    const totale = await schede.count();
    expect(totale).toBeGreaterThan(1);
    await expect(page.locator('[data-conteggio]')).toHaveText(`${totale} documenti`);

    await page.getByLabel('Tipo').selectOption('documento');
    await expect(page).toHaveURL(/\?tipo=documento$/);
    await expect(page.locator('li[data-tipo]:not([hidden])')).toHaveCount(1);
    await expect(page.locator('[data-conteggio]')).toHaveText('1 documento');

    await page.getByLabel('Tipo').selectOption('');
    await page.getByLabel('Cerca nel titolo e nella descrizione').fill('CITTA di offida');
    await expect(page).toHaveURL(/\?q=CITTA/);
    await expect(page.locator('li[data-tipo]:not([hidden])')).toHaveCount(1);
    await page.getByLabel('Cerca nel titolo e nella descrizione').fill('zzzz');
    await expect(page.locator('[data-conteggio]')).toContainText('Nessun documento');
    await expect(page.locator('[data-gruppo]:not([hidden])')).toHaveCount(0);

    await page.goto('/archivio/?tipo=documento&decennio=1990');
    await expect(page.getByLabel('Tipo')).toHaveValue('documento');
    await expect(page.getByLabel('Decennio')).toHaveValue('1990');
    await expect(page.locator('li[data-tipo]:not([hidden])')).toHaveCount(1);

    await page.getByRole('button', { name: 'Azzera i filtri' }).click();
    await expect(page).toHaveURL(/\/archivio\/$/);
    await expect(page.locator('li[data-tipo]:not([hidden])')).toHaveCount(totale);
    expect(await violazioniAxe(page)).toEqual([]);
  });

  test('without JavaScript every card shows and the filters are hidden', async ({ browser }) => {
    const contesto = await browser.newContext({ javaScriptEnabled: false });
    const pagina = await contesto.newPage();
    await pagina.goto('http://127.0.0.1:4322/archivio/');
    await expect(pagina.locator('[data-archivio-filtri]')).toBeHidden();
    expect(await pagina.locator('li[data-tipo]:visible').count()).toBeGreaterThan(1);
    await contesto.close();
  });
});
