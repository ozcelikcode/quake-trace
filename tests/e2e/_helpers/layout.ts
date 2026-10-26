import { test, type Page } from '@playwright/test';

export const project = () => test.info().project.name;
export const isPhone = () => project().startsWith('phone');

/**
 * CI runners have no GPU: the map and deck.gl layers render with software WebGL, and on the
 * tablet and phone profiles a playing scenario starves the page (clicks time out). Scenario flows
 * therefore run on the desktop profile in CI and on every profile locally.
 */
export function skipScenarioFlowOnCi() {
  test.skip(
    Boolean(process.env.CI) && project() !== 'desktop',
    'scenario playback needs a GPU; CI covers it on desktop',
  );
}

/** Shows the scenario panel in the current layout. */
export async function openScenarioPanel(page: Page) {
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
export async function openImpactPanel(page: Page) {
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

/** Pauses playback and moves the clock with the keyboard shortcuts. */
export async function pauseAndJump(page: Page, jumps: number) {
  // A focused control (a radio group) would take the arrow keys.
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.keyboard.press('Space');
  for (let i = 0; i < jumps; i++) await page.keyboard.press('Shift+ArrowRight');
}

/** Shows the events tab in the current layout. */
export async function openEventsPanel(page: Page) {
  if (isPhone()) {
    await page
      .getByRole('region', { name: 'Kontrol paneli' })
      .getByRole('tab', { name: 'Olaylar' })
      .click();
    return;
  }
  if (project() === 'tablet') await page.getByRole('button', { name: 'Bilgi panelini aç' }).click();
  await page.getByRole('tab', { name: 'Olaylar' }).click();
}
