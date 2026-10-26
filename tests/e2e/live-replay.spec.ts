import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { isPhone, openScenarioPanel, project, skipScenarioFlowOnCi } from './_helpers/layout';

test.use({ locale: 'tr-TR' });

const fixture = (name: string) =>
  readFile(fileURLToPath(new URL(`../fixtures/feeds/${name}`, import.meta.url)));

/** Tests never call live services: every catalog and FDSN request is answered from fixtures. */
async function serveFeeds(page: Page) {
  // The recorded catalogs end on 2026-10-26; the clock is fixed so they stay "recent".
  await page.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));
  const respond =
    (name: string, contentType: string) => async (route: import('@playwright/test').Route) => {
      await route.fulfill({ body: await fixture(name), contentType });
    };
  await page.route('**/api/afad/**', respond('afad-events.json', 'application/json'));
  await page.route('**/api/kandilli/**', respond('kandilli-lst0.html', 'text/html'));
  await page.route(/earthquake\.usgs\.gov/, respond('usgs-events.json', 'application/json'));
  await page.route(/seismicportal\.eu/, respond('emsc-events.json', 'application/json'));
  await page.route(
    '**/api/koeri/dataselect/**',
    respond('ko-slvt-2025-04-23.mseed', 'application/vnd.fdsn.mseed'),
  );
  await page.route('**/api/koeri/station/**', respond('ko-slvt-station.xml', 'application/xml'));
}

async function openTab(page: Page, name: string) {
  await page.goto('/');
  await openScenarioPanel(page);
  await page.getByRole('tab', { name, exact: true }).click();
}

test('replays the 2025 Marmara earthquake with the observed record of KO.SLVT', async ({
  page,
}) => {
  skipScenarioFlowOnCi();
  test.skip(project() === 'phone-ios', 'covered by the other phone profile');
  await serveFeeds(page);
  await openTab(page, 'Tarihsel');
  await page.getByRole('button', { name: /2025 Marmara Ereğlisi/ }).click();
  await expect(page.getByTestId('simulation-clock').first()).not.toHaveText('T+ --.-', {
    timeout: 30_000,
  });
  // The tablet drawer closes when a scenario starts.
  if (project() === 'tablet') await openScenarioPanel(page);
  const origin = page.getByTestId('scenario-origin');
  await expect(origin.getByText(/M 6,2 · .* UTC · USGS us7000pufs/)).toBeVisible();
  await expect(origin.getByText(/^TRCF045, \d+,\d km uzakta$/)).toBeVisible();
  await expect(origin.getByText('1 istasyon (KOERI)')).toBeVisible();

  if (isPhone()) {
    await page
      .getByRole('region', { name: 'Kontrol paneli' })
      .getByRole('tab', { name: 'Telemetri' })
      .click();
  } else if (project() === 'tablet') {
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Bilgi panelini aç' }).click();
  }
  await page.getByRole('button', { name: /KO\.SLVT/ }).click();
  await expect(page.getByTestId('telemetry-focus').getByText('Gerçek kayıt · KOERI')).toBeVisible();
});

test('lists live earthquakes from the merged catalogs', async ({ page }) => {
  test.skip(project() === 'phone-ios', 'covered by the other phone profile');
  await serveFeeds(page);
  await openTab(page, 'Canlı');
  const list = page.getByTestId('live-events');
  // The fixture holds two Karacabey shocks; the one AFAD and EMSC both reported is merged.
  const karacabey = list
    .getByRole('button', { name: /Karacabey \(Bursa\)/ })
    .filter({ hasText: 'AFAD, EMSC' })
    .first();
  await expect(karacabey).toBeVisible();
  await karacabey.click();
  await expect(page.getByText('Simülasyon için M 4,0 ve üstü gerekir.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Simüle et' })).toBeDisabled();
});
