import { expect, test, type Page } from '@playwright/test';

import { expectNoSeriousA11yViolations } from './_helpers/a11y';
import {
  isPhone,
  openImpactPanel,
  openScenarioPanel,
  pauseAndJump,
  project,
  skipScenarioFlowOnCi,
} from './_helpers/layout';

test.use({ locale: 'tr-TR' });
test.beforeEach(skipScenarioFlowOnCi);

/** Starts the North Marmara preset and waits until playback has begun. */
async function runNorthMarmara(page: Page) {
  await page.goto('/');
  await openScenarioPanel(page);
  await page.getByRole('button', { name: /Kuzey Marmara/ }).click();
  await expect(page.getByTestId('simulation-clock').first()).not.toHaveText('T+ --.-', {
    timeout: 30_000,
  });
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
  await expect(page.getByText('Fatih', { exact: true })).toBeVisible();
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

test('issues the early warning and counts down to S-wave arrival', async ({ page }) => {
  test.skip(project() === 'phone-ios', 'covered by the other phone profile');
  await runNorthMarmara(page);
  await pauseAndJump(page, 1);
  // T+10 s: past the alert at about T+8 s for this preset.
  await expect(page.getByTestId('eew-status')).toContainText(
    isPhone() ? /M \d,\d/ : /Erken uyarı · M \d,\d/,
  );

  await openImpactPanel(page);
  const summary = page.getByTestId('eew-summary');
  await expect(summary.getByText(/T\+\d+,\d s/)).toBeVisible();
  await expect(summary.getByText(/gerçek Mw 7,4/)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Kör bölge' }).first()).toBeVisible();
  await expect(page.getByText(/^S − \d+ s$/).first()).toBeVisible();
});

test('estimates damage and facility states as the S wave spreads', async ({ page }) => {
  test.skip(project() === 'phone-ios', 'covered by the other phone profile');
  await runNorthMarmara(page);
  await pauseAndJump(page, 3);
  await openImpactPanel(page);

  const damage = page.getByTestId('damage-summary');
  await expect(damage.getByText('Can kaybı')).toBeVisible();
  await expect(damage.getByText(/^≈ [\d.]+$/).first()).toBeVisible();
  await expect(
    page.getByTestId('infra-summary').getByText(/\d+ \/ \d+ tesise ulaştı/),
  ).toBeVisible();
  await expect(page.getByText(/hasar %\d+,\d · \d+ can kaybı/).first()).toBeVisible();
});

test('shows network load and emergency response, and switches the map shading', async ({
  page,
}) => {
  test.skip(project() === 'phone-ios', 'covered by the other phone profile');
  await runNorthMarmara(page);
  await pauseAndJump(page, 3);
  await openImpactPanel(page);

  const network = page.getByTestId('network-summary');
  await expect(network.getByText(/[\d.]+ \/ [\d.]+ istasyona ulaştı/)).toBeVisible();
  await expect(network.getByText(/^%\d+$/)).toBeVisible();
  const response = page.getByTestId('response-summary');
  await expect(response.getByText(/^\d+,\d dk$/).first()).toBeVisible();
  await expect(page.getByText(/itfaiye \d+,\d dk/).first()).toBeVisible();

  // On tablets the panel is a modal drawer over the map; close it to reach the legend.
  if (project() === 'tablet') await page.keyboard.press('Escape');
  const shading = page.getByRole('radiogroup', { name: 'Harita renklendirmesi' });
  await shading.getByRole('radio', { name: 'Şebeke' }).click();
  await expect(page.getByText('Taşınamayan arama (kişi/km²)')).toBeVisible();
  await shading.getByRole('radio', { name: 'Şiddet' }).click();
  await expect(page.getByText('Şiddet (MMI)')).toBeVisible();
});

test('computes the tsunami in the background and opens its timeline scale', async ({ page }) => {
  test.skip(project() === 'phone-ios', 'covered by the other phone profile');
  // Waiting for the tsunami worker next to software WebGL can exceed the shared 60 s budget.
  test.setTimeout(120_000);
  await runNorthMarmara(page);
  const scale = page.getByRole('radiogroup', { name: 'Zaman ölçeği' });
  const tsunami = scale.getByRole('radio', { name: 'Tsunami' });
  // The hour of wave propagation takes a few seconds in its own worker.
  await expect(tsunami).toBeEnabled({ timeout: 45_000 });
  await tsunami.click();
  await expect(tsunami).toHaveAttribute('aria-checked', 'true');
  // The compact phone timeline has no speed control.
  if (!isPhone()) {
    await expect(page.getByRole('radio', { name: '30×' })).toHaveAttribute('aria-checked', 'true');
  }
  // Pause (with focus off the scale control) and jump five minutes at a minute per step.
  await pauseAndJump(page, 5);

  await openImpactPanel(page);
  const summary = page.getByTestId('tsunami-summary');
  await expect(summary.getByText(/\d+ \/ \d+ kıyı ilçesine ulaştı/)).toBeVisible();
  await expect(summary.getByText(/^\d+,\d dk · \d+,\d m$/).first()).toBeVisible();
  if (project() === 'tablet') await page.keyboard.press('Escape');
  await expect(page.getByText('Deniz yüzeyi (m)')).toBeVisible();
});

test('plays the aftershock sequence on the 72-hour response scale', async ({ page }) => {
  test.skip(project() === 'phone-ios', 'covered by the other phone profile');
  await runNorthMarmara(page);
  const response = page
    .getByRole('radiogroup', { name: 'Zaman ölçeği' })
    .getByRole('radio', { name: 'Müdahale' });
  await response.click();
  await expect(response).toHaveAttribute('aria-checked', 'true');
  // Pause and jump six hours: Shift+→ moves an hour on this scale.
  await pauseAndJump(page, 6);
  await expect(page.getByTestId('simulation-clock').first()).toContainText(/T\+ \d:\d{2}:\d{2}/);

  await openImpactPanel(page);
  const summary = page.getByTestId('aftershock-summary');
  await expect(summary.getByText('Şimdiye kadar M ≥ 3')).toBeVisible();
  await expect(summary.getByText(/^M \d,\d, T\+ /)).toBeVisible();
  await expect(summary.getByText(/^%\d+$/).first()).toBeVisible();
});

test('stays accessible with a scenario loaded', async ({ page }) => {
  test.skip(project() !== 'desktop', 'desktop layout');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await runNorthMarmara(page);
  await pauseAndJump(page, 1);
  await expectNoSeriousA11yViolations(page);
});

test('fits a 360 px phone without horizontal scrolling once the alert is shown', async ({
  page,
}) => {
  test.skip(project() !== 'phone-android', 'one phone profile');
  await page.setViewportSize({ width: 360, height: 740 });
  await runNorthMarmara(page);
  await pauseAndJump(page, 2);
  await expect(page.getByTestId('eew-status')).toHaveText(/M \d,\d/);
  const widths = await page.evaluate(() => [
    window.innerWidth,
    document.documentElement.scrollWidth,
  ]);
  expect(widths[1]).toBeLessThanOrEqual(widths[0] ?? 0);
});
