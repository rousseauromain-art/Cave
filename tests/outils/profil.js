// Passe au profil voulu par le sélecteur « Vins | Spiritueux » (écran Ce soir), puis revient à l'adresse d'origine.
async function choisirProfil(page, profil) {
  const retour = page.url();
  await page.goto('./#/ce-soir');
  await page.locator(`[data-profil-choix="${profil}"]`).click();
  await page.goto(retour);
}
module.exports = { choisirProfil };
