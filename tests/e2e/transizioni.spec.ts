// Page transitions (spec 5.9): the photo of a work grows from the list to its page. With a
// reduced-motion preference there is no effect at all, and nothing breaks the CSP.
import { LARGO, expect, test } from './helpers.ts';

const SLUG = 'le-merlettaie';

/** Records, on the page that appears, whether the browser started a view transition. */
const registraTransizione = () => {
  addEventListener('pagereveal', (e) => {
    sessionStorage.setItem(
      'vt',
      (e as Event & { viewTransition?: unknown }).viewTransition ? 'si' : 'no',
    );
  });
};

test.describe('without a preference', () => {
  test.use({ viewport: LARGO, reducedMotion: 'no-preference' });

  test('the card and the photo of the work share one name, and the click starts a transition', async ({
    page,
  }) => {
    await page.addInitScript(registraTransizione);
    await page.goto('/opere/');
    const foto = page.locator(`[data-opera="${SLUG}"]`);
    await expect(foto).toHaveCSS('view-transition-name', `opera-${SLUG}`);
    // The browser skips the transition when the old page was never painted: wait for the first paint.
    await expect
      .poll(() =>
        page.evaluate(() => performance.getEntriesByName('first-contentful-paint').length),
      )
      .toBeGreaterThan(0);
    await page.locator(`a[href="/opere/${SLUG}/"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/opere/${SLUG}/$`));
    await expect(page.locator(`[data-opera="${SLUG}"]`)).toHaveCSS(
      'view-transition-name',
      `opera-${SLUG}`,
    );
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('vt'))).toBe('si');
  });
});

test.describe('with reduced motion', () => {
  test.use({ viewport: LARGO, reducedMotion: 'reduce' });

  test('no name and no transition', async ({ page }) => {
    await page.addInitScript(registraTransizione);
    await page.goto('/opere/');
    await expect(page.locator(`[data-opera="${SLUG}"]`)).toHaveCSS('view-transition-name', 'none');
    await page.locator(`a[href="/opere/${SLUG}/"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/opere/${SLUG}/$`));
    await expect(page.locator(`[data-opera="${SLUG}"]`)).toHaveCSS('view-transition-name', 'none');
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('vt'))).toBe('no');
  });
});

test.describe('without JavaScript', () => {
  test.use({ viewport: LARGO, javaScriptEnabled: false });

  test('the link from the list still opens the work page', async ({ page }) => {
    await page.goto('/opere/');
    await page.locator(`a[href="/opere/${SLUG}/"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/opere/${SLUG}/$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Merlettaie');
  });
});
