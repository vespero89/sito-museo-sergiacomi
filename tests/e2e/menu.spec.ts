// Menu, skip link and bottom action bar with the keyboard (spec 5.8, 8-B), with and without JS.
import { LARGO, TELEFONO, expect, tabFinoA, test } from './helpers.ts';

test.describe('phone', () => {
  test.use({ viewport: TELEFONO });

  test('skip link is the first stop and Esc closes the menu', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Vai al contenuto' })).toBeFocused();

    const apri = page.getByRole('button', { name: 'Menu', exact: true });
    const menu = page.getByRole('navigation', { name: 'Menu principale' });
    await expect(menu).toBeHidden();
    expect(await tabFinoA(page, () => apri.evaluate((el) => el === document.activeElement))).toBe(
      true,
    );
    await page.keyboard.press('Enter');
    await expect(menu).toBeVisible();

    // The keyboard reaches the items of the open menu.
    const primaVoce = menu.getByRole('link').first();
    expect(
      await tabFinoA(page, () => primaVoce.evaluate((el) => el === document.activeElement)),
    ).toBe(true);

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(apri).toBeFocused();
  });

  test('the bottom bar is present and never covers the focus', async ({ page }) => {
    await page.goto('/');
    const barra = page.getByRole('navigation', { name: 'Azioni di visita' });
    await expect(barra).toBeVisible();
    await expect(barra.getByRole('link')).toHaveCount(2);
    const { height } = (await barra.boundingBox()) ?? { height: 0 };
    expect(height).toBeGreaterThanOrEqual(56);

    // Walk the whole page with Tab: a focused element outside the bar stays above it (WCAG 2.4.11).
    const coperti: string[] = [];
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      const stato = await page.evaluate(() => {
        const attivo = document.activeElement;
        const bar = document.querySelector('nav.barra');
        if (!attivo || attivo === document.body || !bar) return null;
        if (bar.contains(attivo)) return { dentro: true, nome: '', copertura: 0 };
        const a = attivo.getBoundingClientRect();
        const b = bar.getBoundingClientRect();
        const sopra = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        return { dentro: false, nome: attivo.textContent?.trim() ?? '', copertura: sopra };
      });
      if (stato && !stato.dentro && stato.copertura > 0) coperti.push(stato.nome);
    }
    expect(coperti).toEqual([]);
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('menu opens and Esc closes it, actions are plain links', async ({ page }) => {
      await page.goto('/');
      const menu = page.getByRole('navigation', { name: 'Menu principale' });
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      await expect(menu).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      const azioni = page.getByRole('navigation', { name: 'Azioni di visita' }).getByRole('link');
      await expect(azioni.first()).toHaveAttribute('href', /\/visita\/#/);
    });
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('motion tokens are zero', async ({ page }) => {
      await page.goto('/');
      const durate = await page.evaluate(() => {
        const stile = getComputedStyle(document.documentElement);
        return [
          stile.getPropertyValue('--durata-s').trim(),
          stile.getPropertyValue('--durata-m').trim(),
        ];
      });
      // The browser may print 0ms as 0s, so compare the number.
      expect(durate.map(parseFloat)).toEqual([0, 0]);
    });
  });
});

test.describe('wide screen', () => {
  test.use({ viewport: LARGO });

  test('the bottom bar is hidden and the menu is a visible row reached by Tab', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Azioni di visita' })).toBeHidden();
    const menu = page.getByRole('navigation', { name: 'Menu principale' });
    await expect(menu).toBeVisible();
    const primaVoce = menu.getByRole('link').first();
    expect(
      await tabFinoA(page, () => primaVoce.evaluate((el) => el === document.activeElement)),
    ).toBe(true);
    // The booking button of the header is a link too.
    await expect(page.locator('a.in-testata')).toHaveCount(1);
  });
});
