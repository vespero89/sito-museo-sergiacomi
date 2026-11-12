// The gallery of the cloister page (spec 5.5): opens and closes from the keyboard, gives the focus
// back to the thumbnail that opened it (the script does it), axe clean with the dialog open, and
// without JavaScript the thumbnails lead to the image file.
import { LARGO, TELEFONO, expect, test, violazioniAxe } from './helpers.ts';

const PAGINA = '/il-museo/il-chiostro/';

test.describe('with JavaScript', () => {
  test.use({ viewport: LARGO });

  test('opens from the keyboard, moves with the arrows and closes with Esc, focus back', async ({
    page,
  }) => {
    await page.goto(PAGINA);
    const miniature = page.locator('a.apri');
    const n = await miniature.count();
    expect(n).toBeGreaterThanOrEqual(2);
    const dialogo = page.locator('dialog.dialogo');
    await expect(dialogo).toBeHidden();

    const seconda = miniature.nth(1);
    await seconda.focus();
    await page.keyboard.press('Enter');
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toHaveAttribute('aria-labelledby', /.+/);
    await expect(dialogo.locator('[data-didascalia]')).toContainText(`2 di ${n}`);
    // The photo in the dialog has the alt of the thumbnail.
    const altMiniatura = await seconda.locator('img').getAttribute('alt');
    await expect(dialogo.locator('img')).toHaveAttribute('alt', altMiniatura!);

    await page.keyboard.press('ArrowRight');
    await expect(dialogo.locator('[data-didascalia]')).toContainText(`3 di ${n}`);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(dialogo.locator('[data-didascalia]')).toContainText(`1 di ${n}`);

    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    // The focus is back on the thumbnail that opened the dialog (the second one).
    await expect(seconda).toBeFocused();
  });

  test('closes with its button and gives the focus back', async ({ page }) => {
    await page.goto(PAGINA);
    const prima = page.locator('a.apri').first();
    await prima.focus();
    await page.keyboard.press('Enter');
    const dialogo = page.locator('dialog.dialogo');
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: 'Chiudi' }).focus();
    await page.keyboard.press('Enter');
    await expect(dialogo).toBeHidden();
    await expect(prima).toBeFocused();
  });

  test('never lets the focus reach the page behind while it is open', async ({ page }) => {
    await page.goto(PAGINA);
    await page.locator('a.apri').first().click();
    const dialogo = page.locator('dialog.dialogo');
    await expect(dialogo).toBeVisible();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      // Past the last button the browser may hand the focus to its own interface (body here).
      const dentro = await dialogo.evaluate(
        (d) => d.contains(document.activeElement) || document.activeElement === document.body,
      );
      expect(dentro).toBe(true);
    }
  });

  test('has no axe violations with the dialog open', async ({ page }) => {
    await page.goto(PAGINA);
    await page.locator('a.apri').first().click();
    await expect(page.locator('dialog.dialogo')).toBeVisible();
    expect(await violazioniAxe(page)).toEqual([]);
  });

  test('stays inside the viewport at phone size', async ({ page }) => {
    await page.setViewportSize(TELEFONO);
    await page.goto(PAGINA);
    await page.locator('a.apri').first().click();
    const dialogo = page.locator('dialog.dialogo');
    const riquadro = (await dialogo.boundingBox())!;
    expect(riquadro.x).toBeGreaterThanOrEqual(0);
    expect(riquadro.x + riquadro.width).toBeLessThanOrEqual(TELEFONO.width);
    expect(riquadro.y + riquadro.height).toBeLessThanOrEqual(TELEFONO.height);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: LARGO });

  test('each thumbnail is a link to an image file that loads', async ({ page, request }) => {
    await page.goto(PAGINA);
    const hrefs = await page
      .locator('a.apri')
      .evaluateAll((a) => a.map((e) => e.getAttribute('href')));
    expect(hrefs.length).toBeGreaterThanOrEqual(2);
    for (const href of hrefs) {
      expect(href).toMatch(/\.jpe?g$/);
      const risposta = await request.get(href!);
      expect(risposta.status()).toBe(200);
      expect(risposta.headers()['content-type']).toContain('image/jpeg');
    }
    await expect(page.locator('dialog.dialogo')).toBeHidden();
  });
});
