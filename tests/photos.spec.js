// Import de photos en lot (format cave-photos) sur les fiches reprises de la collection.
const { test, expect } = require('@playwright/test');
const path = require('path');

test('S7-08 import de photos : associées aux bons flacons, introuvables signalées, relançable', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', (r) => r.abort());
  await page.goto('./#/reglages');
  await page.locator('[data-carte="reprise-whisky"]').getByRole('button', { name: 'Reprendre les spiritueux' }).click();
  await expect(page.locator('[data-carte="reprise-whisky"] .message')).toContainText('56 flacon(s) repris');
  await page.locator('#import-json').setInputFiles(path.join(__dirname, 'outils/photos-exemple.json'));
  await expect(page.locator('.carte .message').filter({ hasText: 'photo(s) associée(s)' })).toContainText('2 photo(s) associée(s) ; sans fiche correspondante : Inconnu');
  await page.locator('#import-json').setInputFiles(path.join(__dirname, 'outils/photos-exemple.json'));
  await expect(page.locator('.carte .message').filter({ hasText: 'photo(s) associée(s)' })).toContainText('2 photo(s) associée(s)');
  await page.locator('[data-profil-choix]').count();
  await page.goto('./#/cave');
  await page.locator('[data-profil-choix="spiritueux"]').click();
  await expect(page.locator('.tuile img')).toHaveCount(2);
  const aEnvoyer = await page.evaluate(async () => { const { creerStore } = await import('/core/store.js'); return (await creerStore('cave').photosSales()).length; });
  expect(aEnvoyer).toBe(2); // partiront vers Supabase à la prochaine synchro
});
