import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const firstGroupShortcuts = (page: Page) =>
  page.locator('.group-card').first().locator('.shortcut-card:not(.add-card)');

test('add, reorder, export, reset and re-import a shortcut', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.group-card')).toHaveCount(4);

  // Add a shortcut to the first group.
  await page.keyboard.press('e');
  await page.locator('.group-card').first().locator('.add-card').click();
  const panel = page.getByRole('dialog', { name: 'Verknüpfung hinzufügen' });
  await panel.getByPlaceholder('z. B. YouTube').fill('E2E Test');
  await panel.getByPlaceholder('https://www.youtube.com').fill('example.com');
  await panel.getByRole('button', { name: 'Speichern' }).click();
  await expect(panel).toBeHidden();
  await expect(firstGroupShortcuts(page).last()).toHaveText('E2E Test');

  // Reorder it one slot to the left via its keyboard drag support.
  await page.getByRole('button', { name: 'E2E Test bearbeiten' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(firstGroupShortcuts(page)).toHaveText([
    'Filme',
    'Serien',
    'YouTube',
    'E2E Test',
    'Streams',
  ]);
  await page.keyboard.press('e');

  // Export.
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  const settings = page.getByRole('dialog', { name: 'Media Hub anpassen' });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    settings.getByRole('button', { name: 'Exportieren' }).click(),
  ]);
  const exportPath = await download.path();
  const exported = JSON.parse(await readFile(exportPath, 'utf8'));
  expect(exported.format).toBe('media-hub-config');
  expect(exported.config.profiles[0].groups[0].shortcuts[3]).toMatchObject({
    name: 'E2E Test',
    url: 'https://example.com/',
  });

  // Reset wipes it ...
  await settings.getByRole('button', { name: /Auf Startkonfiguration zurücksetzen/ }).click();
  await page.locator('.confirm-dialog').getByRole('button', { name: 'Zurücksetzen' }).click();
  await expect(firstGroupShortcuts(page)).toHaveCount(4);

  // ... and importing the export brings it back in the same position.
  await settings
    .locator('input[type="file"][accept="application/json,.json"]')
    .setInputFiles(exportPath);
  await page.locator('.confirm-dialog').getByRole('button', { name: 'Ersetzen' }).click();
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
  await expect(firstGroupShortcuts(page).nth(3)).toHaveText('E2E Test');

  // Survives a reload (localStorage persistence).
  await page.reload();
  await expect(firstGroupShortcuts(page).nth(3)).toHaveText('E2E Test');
});
