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
  await page.keyboard.press('Space');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowRight');

  await openImpactPanel(page);
  const summary = page.getByTestId('tsunami-summary');
  await expect(summary.getByText(/\d+ \/ \d+ kıyı ilçesine ulaştı/)).toBeVisible();
  await expect(summary.getByText(/^\d+,\d dk · \d+,\d m$/).first()).toBeVisible();
  if (project() === 'tablet') await page.keyboard.press('Escape');
  await expect(page.getByText('Deniz yüzeyi (m)')).toBeVisible();
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
