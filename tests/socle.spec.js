// S0-01 : navigation, modules activables, bascule de profil, coquille hors ligne.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const racine = path.join(__dirname, '..');

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.goto('./');
});

test('ouvre le premier onglet et navigue entre les 5 onglets', async ({ page }) => {
  await expect(page).toHaveURL(/#\/ce-soir$/);
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  for (const nom of ['Ce soir', 'Cave', 'Scanner', 'Dégustations', 'Rangements']) {
    await nav.getByRole('link', { name: nom }).click();
    await expect(page.locator('#titre')).toHaveText(nom);
    await expect(nav.getByRole('link', { name: nom })).toHaveAttribute('aria-current', 'page');
  }
});

test('désactiver puis réactiver Aide retire puis rend son accès', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'Aide' })).toBeVisible();
  await page.getByRole('link', { name: 'Réglages' }).click();
  const interrupteur = page.locator('[data-module="aide"]');
  await interrupteur.uncheck();
  await expect(page.getByRole('link', { name: 'Aide' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Aide' })).toHaveCount(0);
  await page.locator('[data-module="aide"]').check();
  await expect(page.getByRole('link', { name: 'Aide' })).toBeVisible();
});

test('un module désactivé sur son écran renvoie à l’accueil', async ({ page }) => {
  await page.goto('./#/cave');
  await page.evaluate(() => localStorage.setItem('cave.flags', JSON.stringify({ cave: false })));
  await page.reload();
  await expect(page).toHaveURL(/#\/ce-soir$/);
  await expect(page.getByRole('link', { name: 'Cave' })).toHaveCount(0);
});

test('la bascule de profil change les couleurs sans rechargement et est mémorisée', async ({ page }) => {
  const entete = page.locator('.entete');
  await expect(entete).toHaveCSS('background-color', 'rgb(74, 11, 34)');
  await page.locator('[data-test="bascule-profil"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-profil', 'spiritueux');
  await expect(entete).toHaveCSS('background-color', 'rgb(43, 26, 16)');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-profil', 'spiritueux');
  await page.locator('[data-test="bascule-profil"]').click();
  await expect(entete).toHaveCSS('background-color', 'rgb(74, 11, 34)');
});

test('l’aide affiche les légendes du profil courant', async ({ page }) => {
  await page.getByRole('link', { name: 'Aide' }).click();
  await expect(page.getByText('Rouge', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'France' })).toBeVisible();
  await expect(page.getByLabel('Note 4,5 sur 5')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Bouteille 7, trouvée' })).toBeVisible();
  await page.locator('[data-test="bascule-profil"]').click();
  await expect(page.getByText('Single malt tourbé')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Bretagne' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Reste 60 %' })).toBeVisible();
  await expect(page.locator('#vue')).not.toContainText('null');
});

test('la version est affichée et identique dans le service worker', async ({ page }) => {
  const version = fs.readFileSync(path.join(racine, 'core/version.js'), 'utf8').match(/'([\d.]+)'/)[1];
  const sw = fs.readFileSync(path.join(racine, 'sw.js'), 'utf8');
  expect(sw).toContain(`const VERSION = '${version}'`);
  await page.getByRole('link', { name: 'Réglages' }).click();
  await expect(page.getByText(`version ${version}`)).toBeVisible();
});

test('tous les fichiers de la coquille hors ligne existent', async () => {
  const sw = fs.readFileSync(path.join(racine, 'sw.js'), 'utf8');
  const liste = sw.match(/const COQUILLE = \[([\s\S]*?)\];/)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  for (const f of liste.filter((x) => x !== './')) expect(fs.existsSync(path.join(racine, f)), f).toBe(true);
  const modules = fs.readdirSync(path.join(racine, 'modules'));
  for (const m of modules) expect(liste, `module ${m} absent du cache`).toContain(`./modules/${m}/module.js`);
});

test('aucune couleur en dur dans les modules', async () => {
  for (const m of fs.readdirSync(path.join(racine, 'modules'))) {
    const code = fs.readFileSync(path.join(racine, 'modules', m, 'module.js'), 'utf8');
    expect(code, m).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  }
});
