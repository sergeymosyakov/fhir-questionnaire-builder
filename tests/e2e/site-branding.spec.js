// ── E2E: every public page names its product and links home — on a phone too ──
// ── data-testid registry ─────────────────────────────────────────────────────
//   page-brand / -logo / -name   header mark: logo and the product name in two lines, links home
//   top-panel-brand / -logo / -name   the builder's own top panel: the same logo and two-line name
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test';

const PAGES = ['/help.html', '/docs.html', '/gallery.html', '/templates.html', '/widget-demo.html', '/questionnaire-check.html', '/guide/validation.html', '/templates/phq-9.html', '/settings.html'];

for (const [label, size] of [['phone', { width: 375, height: 700 }], ['desktop', { width: 1280, height: 800 }]]) {
  test.describe(`branding on a ${label}`, () => {
    test.use({ viewport: size });

    for (const url of PAGES) {
      test(`${url}: brand mark, no sideways scroll`, async ({ page }) => {
        await page.goto(url);
        const brand = page.getByTestId('page-brand');
        await expect(brand).toBeVisible();
        await expect(brand).toHaveAttribute('aria-label', 'FHIR Questionnaire Builder');
        await expect(page.getByTestId('page-brand-logo').first()).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, 'horizontal overflow').toBeLessThanOrEqual(0);
      });
    }

    test('the name sits next to the logo in two lines, on a phone too', async ({ page }) => {
      await page.goto('/gallery.html');
      const name = page.getByTestId('page-brand-name');
      await expect(name).toBeVisible();
      await expect(name).toHaveText('FHIR Questionnaire Builder');
      const [first, second] = await name.locator('span').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
      expect(second).toBeGreaterThan(first); // "Builder" is on the second line
    });

    test('the brand mark leads home', async ({ page }) => {
      await page.goto('/templates/phq-9.html');
      await page.getByTestId('page-brand').click();
      await expect(page).toHaveURL(/\/(index\.html)?$/);
    });
  });
}

test.describe('the builder itself', () => {
  for (const [label, size] of [['phone', { width: 375, height: 700 }], ['desktop', { width: 1280, height: 800 }]]) {
    test(`shows the same logo and two-line name in its top panel on a ${label}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto('/');
      const brand = page.getByTestId('top-panel-brand');
      await expect(brand).toBeVisible();
      await expect(page.getByTestId('top-panel-brand-logo')).toBeVisible();
      const name = page.getByTestId('top-panel-brand-name');
      await expect(name).toHaveText('FHIR Questionnaire Builder');
      const [first, second] = await name.locator('span').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
      expect(second).toBeGreaterThan(first);
      await expect(page.locator('body')).not.toContainText('Logic Builder');
    });
  }
});

test('the builder\'s own embedded pages do not show the brand or footer inside the modal', async ({ page }) => {
  await page.goto('/help.html#embedded');
  await expect(page.getByTestId('page-brand')).toBeHidden();
});
