// "From the idea to the work" and the comparison (task 19): the sticky stage that changes while
// scrolling, the slider and the two buttons, reduced motion, no JavaScript, axe.
import { LARGO, TELEFONO, expect, test, violazioniAxe } from './helpers.ts';

const MERLETTAIE = '/opere/le-merlettaie/';
const SOGNO = '/opere/il-sogno-del-pescatore/';

test.describe('wide screen, motion allowed', () => {
  test.use({ viewport: LARGO, reducedMotion: 'no-preference' });

  test('the stage appears, is aria-hidden and changes with the phase in view', async ({ page }) => {
    await page.goto(MERLETTAIE);
    const riquadro = page.locator('[data-riquadro]');
    await expect(riquadro).toBeVisible();
    await expect(riquadro).toHaveAttribute('aria-hidden', 'true');
    const sezioni = page.locator('[data-fasi] section[aria-labelledby]');
    await sezioni.nth(0).scrollIntoViewIfNeeded();
    await expect(riquadro.locator('.strato.attivo')).toHaveCount(1);
    const prima = await riquadro.locator('.strato.attivo').getAttribute('data-fase');
    await sezioni.nth(2).scrollIntoViewIfNeeded();
    await sezioni.nth(2).evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await expect
      .poll(() => riquadro.locator('.strato.attivo').getAttribute('data-fase'))
      .not.toBe(prima);
    // The figures stay in the DOM with their alt.
    await expect(page.locator('[data-fasi] section img[alt]')).toHaveCount(9);
    await expect(page.locator('[data-fasi] [aria-live]')).toHaveCount(0);
  });

  test('the layers fade in 200 ms', async ({ page }) => {
    await page.goto(MERLETTAIE);
    await expect(page.locator('[data-riquadro] .strato').first()).toHaveCSS(
      'transition-duration',
      '0.2s',
    );
  });

  test('the slider moves with the arrows and updates aria-valuetext on change', async ({
    page,
  }) => {
    await page.goto(SOGNO);
    const cursore = page.getByRole('slider', { name: 'Confronta bozzetto e monumento' });
    await expect(cursore).toBeVisible();
    await cursore.focus();
    await expect(cursore).toHaveAttribute('aria-valuetext', 'Bozzetto 50%, monumento 50%');
    await page.keyboard.press('ArrowRight');
    await expect(cursore).toHaveAttribute('aria-valuetext', 'Bozzetto 55%, monumento 45%');
    await expect(page.locator('[data-confronto]')).toHaveCSS('--posizione', '55%');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(cursore).toHaveAttribute('aria-valuetext', 'Bozzetto 45%, monumento 55%');
  });

  test('the two buttons switch the photo and keep aria-pressed', async ({ page }) => {
    await page.goto(MERLETTAIE);
    const bozzetto = page.getByRole('button', { name: 'Mostra bozzetto' });
    const monumento = page.getByRole('button', { name: 'Mostra monumento' });
    await expect(bozzetto).toHaveAttribute('aria-pressed', 'true');
    await monumento.focus();
    await page.keyboard.press('Enter');
    await expect(monumento).toHaveAttribute('aria-pressed', 'true');
    await expect(bozzetto).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-confronto]')).toHaveAttribute('data-mostra', 'dopo');
  });

  for (const pagina of [MERLETTAIE, SOGNO]) {
    test(`axe is clean on ${pagina}`, async ({ page }) => {
      await page.goto(pagina);
      await expect(page.locator('[data-riquadro]')).toBeVisible();
      // Let the first fades end: axe reads the colours of a half-faded element.
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
      expect(await violazioniAxe(page)).toEqual([]);
    });
  }
});

test.describe('reduced motion', () => {
  test.use({ viewport: LARGO, reducedMotion: 'reduce' });

  test('there is no stage: the sequence stays in a column, and the comparison still works', async ({
    page,
  }) => {
    await page.goto(MERLETTAIE);
    await expect(page.locator('[data-riquadro]')).toBeHidden();
    await expect(page.locator('[data-fasi] section figure img').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mostra bozzetto' })).toBeVisible();
  });
});

test.describe('phone', () => {
  test.use({ viewport: TELEFONO, reducedMotion: 'no-preference' });

  test('the sequence is a column with no stage', async ({ page }) => {
    await page.goto(SOGNO);
    await expect(page.locator('[data-riquadro]')).toBeHidden();
    await expect(page.locator('[data-fasi] section figure img').first()).toBeVisible();
    expect(await violazioniAxe(page)).toEqual([]);
  });
});

test.describe('without JavaScript', () => {
  test.use({ viewport: LARGO, javaScriptEnabled: false });

  test('the whole sequence and the two photos are readable, with alt', async ({ page }) => {
    await page.goto(SOGNO);
    await expect(page.locator('[data-riquadro]')).toBeHidden();
    await expect(page.locator('[data-fasi] section')).toHaveCount(3);
    await expect(page.locator('[data-fasi] section figure img').first()).toBeVisible();
    await expect(page.locator('[data-confronto] figure img')).toHaveCount(2);
    await expect(page.locator('[data-confronto] figure img').nth(1)).toBeVisible();
    await expect(page.locator('[data-confronto] .descrizione')).toBeVisible();
    await expect(page.locator('[data-controlli]')).toBeHidden();
  });
});
