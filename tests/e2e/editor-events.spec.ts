import { readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

import { expectNoSeriousA11yViolations } from './_helpers/a11y';
import {
  isPhone,
  openEventsPanel,
  openScenarioPanel,
  pauseAndJump,
  project,
} from './_helpers/layout';

test.use({ locale: 'tr-TR' });

const clock = (page: Page) => page.getByTestId('simulation-clock').first();

async function waitForPlayback(page: Page) {
  await expect(clock(page)).not.toHaveText('T+ --.-', { timeout: 30_000 });
}

test('builds a scenario in the editor and shares it in the address bar', async ({ page }) => {
  test.skip(project() === 'phone-ios', 'covered by the other phone profile');
  await page.goto('/');
  await openScenarioPanel(page);
  await page.getByRole('tab', { name: 'Editör' }).click();

  const editor = page.getByRole('form', { name: 'Senaryo editörü' });
  await expect(editor.getByLabel('Fay')).toHaveValue('TRCF045');
  // One step down from Mw 7.0 with the keyboard on the magnitude thumb.
  await editor.getByRole('slider', { name: 'Büyüklük' }).press('ArrowLeft');
  await expect(editor.getByText('Mw 6,9')).toBeVisible();
  await editor.getByLabel('Seed', { exact: true }).fill('7');
  await editor.getByRole('button', { name: 'Simüle et' }).click();
  await waitForPlayback(page);

  await expect(page).toHaveURL(/\?fault=TRCF045&mw=6\.9&hypo=\d+(\.\d)?&depth=9&seed=7$/);
  if (project() === 'tablet') await openScenarioPanel(page);
  const origin = page.getByTestId('scenario-origin');
  await expect(origin.getByText('TRCF045')).toBeVisible();
  await expect(origin.getByText('7', { exact: true })).toBeVisible();
});

test('runs the scenario of a shared link and rejects a broken one', async ({ page }) => {
  test.skip(project() === 'phone-ios', 'covered by the other phone profile');
  await page.goto('/?fault=TRCF045&mw=6.5&hypo=200&depth=10&seed=3');
  await waitForPlayback(page);
  if (!isPhone()) {
    await expect(page.getByRole('status').filter({ hasText: 'Simülasyon · Mw 6,5' })).toBeVisible();
  }
  await openScenarioPanel(page);
  const editor = page.getByRole('form', { name: 'Senaryo editörü' });
  await expect(editor.getByText('Mw 6,5')).toBeVisible();
  await expect(editor.getByText('200 / 520 km')).toBeVisible();

  await page.goto('/?preset=nowhere');
  await openScenarioPanel(page);
  await expect(page.getByRole('alert')).toHaveText(/Bağlantıdaki senaryo okunamadı/);
});

test('logs the milestones, seeks to them and exports the results', async ({ page }) => {
  test.skip(project() !== 'desktop' && project() !== 'phone-android', 'one layout per class');
  await page.goto('/?preset=north-marmara');
  await waitForPlayback(page);
  await pauseAndJump(page, 2);
  await openEventsPanel(page);

  const log = page.getByTestId('event-log');
  await expect(log.getByText(/^Kırılma başladı · Mw 7,4/)).toBeVisible();
  await expect(log.getByText(/^Erken uyarı alarmı · tahmini M \d,\d/)).toBeVisible();
  await expect(log.getByText(/^S dalgası İstanbul iline ulaştı/)).toBeVisible();
  await expect(page.getByText(/kayıt daha ileride$/)).toBeVisible();
  await log.getByRole('button', { name: /Kırılma başladı/ }).click();
  await expect(clock(page)).toHaveText('T+ 00:00.0');

  const geojsonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'GeoJSON' }).click();
  const geojson = await geojsonDownload;
  expect(geojson.suggestedFilename()).toBe('quaketrace-simulation-north-marmara.geojson');
  const collection = JSON.parse(await readFile(await geojson.path(), 'utf8')) as {
    simulation: boolean;
    features: { properties: { layer: string; name?: string } }[];
  };
  expect(collection.simulation).toBe(true);
  expect(collection.features.some((f) => f.properties.name === 'Fatih')).toBe(true);

  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV' }).click();
  const csv = await readFile(await (await csvDownload).path(), 'utf8');
  expect(csv.split('\r\n')[0]).toBe(
    '﻿district_id,name,province,p_arrival_s,s_arrival_s,mmi,warning_s,loss_ratio,buildings_lost,fatalities,stock_estimated,fire_before_min,fire_after_min,hospital_after_min,tsunami_arrival_s,tsunami_max_m',
  );
});

test('prints the scenario report instead of the app', async ({ page }) => {
  test.skip(project() !== 'desktop', 'desktop layout');
  await page.addInitScript(() => {
    window.print = () => {
      document.body.dataset.printed = 'true';
    };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?preset=north-marmara');
  await waitForPlayback(page);
  await pauseAndJump(page, 1);
  await openEventsPanel(page);
  await expectNoSeriousA11yViolations(page);

  await page.getByRole('button', { name: 'Rapor (PDF)' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-printed', 'true');
  await page.emulateMedia({ media: 'print' });
  const report = page.locator('[data-print-report]');
  await expect(report.getByRole('heading', { name: 'quakeTrace senaryo raporu' })).toBeVisible();
  await expect(report.getByText('SİMÜLASYON · resmi uyarı sistemi değildir')).toBeVisible();
  await expect(report.getByRole('cell', { name: /Fatih/ })).toBeVisible();
  await expect(page.locator('#root')).toBeHidden();
});
