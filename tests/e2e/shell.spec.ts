import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.use({ locale: 'tr-TR' });

const isProject = (name: string) => test.info().project.name === name;
const isPhone = () => test.info().project.name.startsWith('phone');

async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude('[data-testid="map"]')
    .analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(serious.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

test('renders the shell and the 3D map without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'quakeTrace' })).toBeVisible();
  await expect(page.getByTestId('map').locator('canvas')).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});

test('switches language between Turkish and English', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('lang', 'tr');
  await expect(
    page.getByText('Zaman çizelgesi bir senaryo çalıştığında etkinleşir.'),
  ).toBeVisible();

  await page.getByRole('radio', { name: 'English' }).click();
  await expect(html).toHaveAttribute('lang', 'en');
  await expect(page.getByText('The timeline becomes active when a scenario runs.')).toBeVisible();

  await page.reload();
  await expect(html).toHaveAttribute('lang', 'en');
});

test('toggles the theme and keeps it after reload', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('button', { name: 'Açık temaya geç' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
});

test('desktop: side panels and tabs are reachable', async ({ page }) => {
  test.skip(!isProject('desktop'), 'desktop layout only');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Senaryo', level: 2 })).toBeVisible();
  await expect(page.getByText('İstasyon kaydı yok')).toBeVisible();

  await page.getByRole('tab', { name: 'Etki' }).click();
  await expect(page.getByText('Etki verisi yok')).toBeVisible();
});

test('tablet: panels open as drawers', async ({ page }) => {
  test.skip(!isProject('tablet'), 'tablet layout only');
  await page.goto('/');

  await page.getByRole('button', { name: 'Senaryo panelini aç' }).click();
  await expect(page.getByRole('dialog').getByText('Senaryo seçilmedi')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.getByRole('button', { name: 'Bilgi panelini aç' }).click();
  await expect(page.getByRole('dialog').getByText('İstasyon kaydı yok')).toBeVisible();
});

test('phone: bottom sheet tabs reach every panel', async ({ page }) => {
  test.skip(!isPhone(), 'phone layout only');
  await page.goto('/');
  const sheet = page.getByRole('region', { name: 'Kontrol paneli' });
  await expect(sheet.getByRole('tab', { name: 'Olaylar' })).toBeInViewport();

  const handle = sheet.getByRole('button', { name: 'Paneli genişlet veya daralt' });
  await expect(handle).toHaveAttribute('aria-expanded', 'false');
  await handle.click();
  await expect(handle).toHaveAttribute('aria-expanded', 'true');

  for (const [tab, emptyTitle] of [
    ['Olaylar', 'Olay kaydı boş'],
    ['Etki', 'Etki verisi yok'],
    ['Telemetri', 'İstasyon kaydı yok'],
    ['Senaryo', 'Senaryo seçilmedi'],
  ] as const) {
    await sheet.getByRole('tab', { name: tab }).click();
    await expect(sheet.getByText(emptyTitle)).toBeVisible();
  }
});

test('meets WCAG 2.2 AA in both themes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'quakeTrace' })).toBeVisible();
  await expectNoSeriousA11yViolations(page);

  await page.getByRole('button', { name: 'Açık temaya geç' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expectNoSeriousA11yViolations(page);
});
