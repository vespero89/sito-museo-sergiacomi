// The home page (task 16): the big photo, the entrances, no sideways scroll, axe, keyboard.
import { LARGO, TELEFONO, expect, scorrimentoOrizzontale, test, violazioniAxe } from './helpers.ts';

for (const [nome, vista] of [
  ['phone 390', TELEFONO],
  ['wide 1280', LARGO],
] as const) {
  test.describe(`home at ${nome}`, () => {
    test.use({ viewport: vista, reducedMotion: 'no-preference' });

    test('opens with the photo across the whole width, no sideways scroll, axe clean', async ({
      page,
    }) => {
      await page.goto('/');
      const foto = page.locator('main img').first();
      await expect(foto).toBeVisible();
      await expect.poll(() => foto.evaluate((i: HTMLImageElement) => i.complete)).toBe(true);
      const larghezza = await foto.evaluate((i) => i.getBoundingClientRect().width);
      expect(larghezza).toBeGreaterThanOrEqual(vista.width - 1);
      expect(await scorrimentoOrizzontale(page)).toBe(false);
      expect(await violazioniAxe(page)).toEqual([]);
    });

    test('an entrance can be reached and opened with the keyboard', async ({ page }) => {
      await page.goto('/');
      const link = page.locator('#su-misura').getByRole('link', { name: 'Didattica', exact: true });
      await link.focus();
      await expect(link).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/didattica\/$/);
    });
  });
}

test.describe('home with reduced motion and without JavaScript', () => {
  test.use({ viewport: TELEFONO, reducedMotion: 'reduce', javaScriptEnabled: false });
  test('still shows the photo and the entrances', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main img').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'In famiglia' })).toBeVisible();
  });
});
