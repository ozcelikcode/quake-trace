import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.use({ locale: 'tr-TR' });

const project = () => test.info().project.name;
const isPhone = () => project().startsWith('phone');

/** Shows the scenario panel in the current layout. */
async function openScenarioPanel(page: Page) {
  if (isPhone()) {
    await page
      .getByRole('region', { name: 'Kontrol paneli' })
      .getByRole('tab', { name: 'Senaryo' })
      .click();
  } else if (project() === 'tablet') {
    await page.getByRole('button', { name: 'Senaryo panelini aç' }).click();
  }
}

/** Shows the impact tab in the current layout. */
async function openImpactPanel(page: Page) {
  if (isPhone()) {
    await page
      .getByRole('region', { name: 'Kontrol paneli' })
      .getByRole('tab', { name: 'Etki' })
      .click();
    return;
  }
  if (project() === 'tablet') await page.getByRole('button', { name: 'Bilgi panelini aç' }).click();
  await page.getByRole('tab', { name: 'Etki' }).click();
}

/** Starts the North Marmara preset and waits until playback has begun. */
async function runNorthMarmara(page: Page) {
  await page.goto('/');
  await openScenarioPanel(page);
  await page.getByRole('button', { name: /Kuzey Marmara/ }).click();
  await expect(page.getByTestId('simulation-clock').first()).not.toHaveText('T+ --.-', {
    timeout: 30_000,
  });
}

/** Pauses playback and moves the clock with the keyboard shortcuts. */
async function pauseAndJump(page: Page, jumps: number) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.keyboard.press('Space');
  for (let i = 0; i < jumps; i++) await page.keyboard.press('Shift+ArrowRight');
}

test('runs a preset scenario and plays it back', async ({ page }) => {
  test.skip(project() === 'phone-ios', 'covered by the other phone profile');
  await runNorthMarmara(page);

  if (!isPhone()) {
    await expect(page.getByRole('status').filter({ hasText: 'Simülasyon · Mw 7,4' })).toBeVisible();
  }
  await expect(page.getByText('Simülasyon', { exact: true })).toBeVisible();
  await expect(page.getByText('Şiddet (MMI)')).toBeVisible();

  await pauseAndJump(page, 2);
  await expect(page.getByTestId('simulation-clock').first()).toHaveText(/T\+ 00:2\d\.\d/);

  await openImpactPanel(page);
  await expect(page.getByText(/\d+ \/ \d+ ilçeye ulaştı/)).toBeVisible();
  await expect(page.getByText('Fatih')).toBeVisible();
});

/** Shows the telemetry tab in the current layout. */
async function openTelemetryPanel(page: Page) {
  if (isPhone()) {
    await page
      .getByRole('region', { name: 'Kontrol paneli' })
      .getByRole('tab', { name: 'Telemetri' })
      .click();
    return;
  }
  if (project() === 'tablet') await page.getByRole('button', { name: 'Bilgi panelini aç' }).click();
  await page.getByRole('tab', { name: 'Telemetri' }).click();
}

test('streams station records and focuses a station', async ({ page }) => {
  test.skip(project() === 'phone-ios', 'covered by the other phone profile');
  await runNorthMarmara(page);
  await pauseAndJump(page, 2);
  await openTelemetryPanel(page);

  const focus = page.getByTestId('telemetry-focus');
  await expect(focus.getByText('Sentetik kayıt')).toBeVisible();
  await expect(focus.getByText(/T\+\d+,\d s/)).toBeVisible();
  await expect(page.getByTestId('telemetry-triggered')).toHaveText(/^\d+ \/ 50 tetiklendi$/);

  const rows = page.getByRole('list').last().getByRole('button');
  await expect(rows).toHaveCount(50);
  const second = rows.nth(1);
  const id = (await second.locator('.truncate').innerText()).trim();
  await second.click();
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await expect(focus.getByRole('heading', { name: id })).toBeVisible();
});

test('stays accessible with a scenario loaded', async ({ page }) => {
  test.skip(project() !== 'desktop', 'desktop layout');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await runNorthMarmara(page);
  await pauseAndJump(page, 1);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude('[data-testid="map"] canvas')
    .analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(
    serious.map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([]);
});
