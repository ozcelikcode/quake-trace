import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from './_helpers/a11y';

test.use({ locale: 'tr-TR' });

const isProject = (name: string) => test.info().project.name === name;
const isPhone = () => test.info().project.name.startsWith('phone');

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

test('opens without downloading the scenario datasets', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(new URL(request.url()).pathname));

  await page.goto('/');
  await expect(page.getByTestId('map').locator('canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState('networkidle');
  // Heavy inputs load with the first run (roads 5.9 MB, bathymetry 1.6 MB, facilities 780 KB).
  for (const file of ['roads.bin', 'bathymetry.f32', 'infra.geojson', 'population.f32']) {
    expect(requested.filter((path) => path.endsWith(`/data/${file}`))).toEqual([]);
  }
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
  await expect(page.getByRole('dialog').getByText('Hazır senaryolar')).toBeVisible();
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
    ['Senaryo', 'Hazır senaryolar'],
  ] as const) {
    await sheet.getByRole('tab', { name: tab }).click();
    await expect(sheet.getByText(emptyTitle)).toBeVisible();
  }
});

test('meets WCAG 2.2 AA in both themes', async ({ page }) => {
  // Without transitions, axe never measures colors halfway through a theme change.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'quakeTrace' })).toBeVisible();
  await expectNoSeriousA11yViolations(page, '[data-testid="map"]');

  await page.getByRole('button', { name: 'Açık temaya geç' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expectNoSeriousA11yViolations(page, '[data-testid="map"]');
});

test('opens About with methods, data sources and shortcuts', async ({ page }) => {
  test.skip(isProject('phone-ios') || isProject('tablet'), 'covered by the other profiles');
  await page.goto('/');
  await page.getByRole('button', { name: 'Hakkında ve yöntem' }).click();
  const dialog = page.getByRole('dialog', { name: 'quakeTrace hakkında' });
  await expect(dialog.getByText('Simülasyondur, resmi uyarı sistemi değildir')).toBeVisible();
  await dialog.getByRole('tab', { name: 'Yöntem' }).click();
  await expect(dialog.getByText(/Akkar, Sandıkkaya ve Bommer \(2014\)/)).toBeVisible();
  await dialog.getByRole('tab', { name: 'Veri' }).click();
  await expect(dialog.getByRole('link', { name: /EFSM20/ })).toBeVisible();
  await expectNoSeriousA11yViolations(page, '[data-testid="map"]');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.keyboard.press('?');
  await expect(dialog.getByRole('tab', { name: 'Kısayollar' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(dialog.getByText('Oynat / duraklat')).toBeVisible();
});
