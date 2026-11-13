// Ajout et modification d'un produit (stock 0 autorisé, sans mesure).
import { remplacer } from '../../core/ui/dom.js';
import { STYLES } from '../../data/styles.js';
import { DRAPEAUX } from '../../data/drapeaux.js';
import { ajouterBouteilles, aGrille, emplacementsLibres } from '../../core/inventaire.js';
import { compresser, urlPhoto, oublierPhoto } from '../../core/photos.js';
import { prendreBrouillon } from '../../core/identification.js';

function champ(h, libelle, controle, aide) {
  return h('label', { class: 'champ' }, h('span', { class: 'libelle' }, libelle), controle, aide ? h('span', { class: 'discret' }, aide) : null);
}

export async function ecranFormulaire(core, el, { id }) {
  const { h } = core;
  const existant = id ? await core.store.get('produits', id) : null;
  const profil = existant?.profil || core.profilCourant();
  core.titre(existant ? 'Modifier' : profil === 'vin' ? 'Nouveau vin' : 'Nouveau spiritueux');
  // Après un scan : champs et photo préremplis.
  const brouillon = existant ? null : prendreBrouillon();
  const { photo: photoScan, source, texte, ...lus } = brouillon || {};
  const p = existant || { profil, ...Object.fromEntries(Object.entries(lus).filter(([, v]) => v !== null && v !== '')) };
  const rangements = await core.store.list('rangements');
  let nouvellePhoto = photoScan || null;

  const entree = (nom, attrs = {}) => h('input', { name: nom, value: p[nom] ?? '', ...attrs });
  const select = (nom, options, vide) => h('select', { name: nom },
    h('option', { value: '' }, vide),
    options.map(([v, t]) => h('option', { value: v, selected: p[nom] === v }, t)));

  const apercu = h('span', { class: 'apercu-photo' });
  if (existant) urlPhoto(core.store, existant.id).then((u) => { if (u) remplacer(apercu, h('img', { src: u, alt: 'Photo actuelle' })); });
  if (photoScan) remplacer(apercu, h('img', { src: URL.createObjectURL(photoScan), alt: 'Photo du scan' }));
  const photo = h('input', {
    type: 'file', accept: 'image/*', capture: 'environment', name: 'photo',
    onchange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      nouvellePhoto = await compresser(f);
      remplacer(apercu, h('img', { src: URL.createObjectURL(nouvellePhoto), alt: 'Nouvelle photo' }));
    }
  });

  const vin = profil === 'vin';
  const form = h('form', { class: 'formulaire carte', novalidate: true },
    source ? h('p', { class: 'discret' }, `Prérempli par ${source} : vérifiez avant d\u2019enregistrer.`) : null,
    h('div', { class: 'photo-ligne' }, apercu, champ(h, 'Photo de l’étiquette', photo)),
    champ(h, 'Nom *', entree('nom', { required: true, autocomplete: 'off' })),
    champ(h, vin ? 'Domaine / producteur' : 'Distillerie / marque', entree('producteur')),
    vin ? champ(h, 'Cuvée', entree('cuvee')) : null,
    h('div', { class: 'deux' },
      vin ? champ(h, 'Millésime', entree('millesime', { type: 'number', inputmode: 'numeric', min: '1900', max: '2100' }))
        : champ(h, 'Âge (ans)', entree('age_ans', { type: 'number', inputmode: 'numeric', min: '0', max: '80' })),
      champ(h, vin ? 'Couleur / style' : 'Catégorie', select('style', Object.entries(STYLES[profil]).map(([k, s]) => [k, s.titre]), '—'))),
    h('div', { class: 'deux' },
      champ(h, 'Origine', select('pays', Object.entries(DRAPEAUX).map(([k, d]) => [k, d.nom]), '—')),
      champ(h, 'Région', entree('region'))),
    vin ? champ(h, 'Cépages', entree('cepages')) : null,
    vin ? champ(h, 'Appellation', entree('appellation'))
      : h('div', { class: 'deux' },
        champ(h, 'Degré (% vol.)', entree('degre', { type: 'number', inputmode: 'decimal', step: '0.1', min: '0', max: '80' })),
        champ(h, 'Fût', entree('fut'))),
    vin ? h('div', { class: 'deux' },
      champ(h, 'Apogée de', entree('apogee_debut', { type: 'number', inputmode: 'numeric', min: '1900', max: '2200' })),
      champ(h, 'à', entree('apogee_fin', { type: 'number', inputmode: 'numeric', min: '1900', max: '2200' }))) : null,
    champ(h, 'Note (0 à 5)', entree('note', { type: 'number', inputmode: 'decimal', step: '0.5', min: '0', max: '5' })),
    champ(h, 'Notes', h('textarea', { name: 'commentaire', rows: '3' }, p.commentaire || '')),
    existant ? null : h('fieldset', { class: 'stock-initial' },
      h('legend', {}, 'Stock'),
      h('div', { class: 'deux' },
        champ(h, 'Bouteilles', h('input', { name: 'quantite', type: 'number', inputmode: 'numeric', min: '0', max: '48', value: '0' }), '0 = fiche sans stock'),
        champ(h, 'Rangement', h('select', { name: 'rangement' }, h('option', { value: '' }, 'Sans rangement'), rangements.map((r) => h('option', { value: r.id }, r.nom)))))),
    h('p', { class: 'message', role: 'alert' }),
    h('div', { class: 'boutons' },
      h('button', { type: 'submit', class: 'bouton principal' }, 'Enregistrer'),
      h('a', { href: existant ? `#/fiche/${existant.id}` : '#/cave', class: 'bouton' }, 'Annuler'),
      existant ? h('button', {
        type: 'button', class: 'bouton danger', onclick: async () => {
          if (!confirmerSuppression(form)) return;
          for (const b of (await core.store.list('bouteilles')).filter((x) => x.produit_id === existant.id)) await core.store.remove('bouteilles', b.id);
          await core.store.remove('produits', existant.id);
          core.aller('/cave');
        }
      }, 'Supprimer') : null));

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const msg = form.querySelector('.message');
    if (!d.nom?.trim()) { msg.textContent = 'Le nom est obligatoire.'; form.elements.nom.focus(); return; }
    // Doublon probable (même nom et même millésime/âge) : proposer la fiche existante.
    if (!existant && !form.dataset.doublonAccepte) {
      const n = (x) => (x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      const double = (await core.store.list('produits')).find((x) => x.profil === profil && n(x.nom) === n(d.nom)
        && String(x.millesime ?? '') === String(d.millesime ?? '') && String(x.age_ans ?? '') === String(d.age_ans ?? ''));
      if (double) {
        form.dataset.doublonAccepte = '1';
        core.ajouter(core.vider(msg), ['Ce produit existe déjà : ', h('a', { href: `#/fiche/${double.id}` }, 'ouvrir sa fiche pour ajouter des bouteilles'), '. Ou touchez Enregistrer à nouveau pour créer une autre fiche.']);
        return;
      }
    }
    const nombre = (v) => (v === '' || v === undefined ? null : Number(v));
    const produit = await core.store.put('produits', {
      ...p, profil,
      nom: d.nom.trim(), producteur: d.producteur?.trim() || null, cuvee: d.cuvee?.trim() || null,
      millesime: nombre(d.millesime), age_ans: nombre(d.age_ans), style: d.style || null, pays: d.pays || null,
      region: d.region?.trim() || null, appellation: d.appellation?.trim() || null, degre: nombre(d.degre),
      cepages: vin ? d.cepages?.trim() || null : p.cepages ?? null,
      fut: d.fut?.trim() || null, apogee_debut: nombre(d.apogee_debut), apogee_fin: nombre(d.apogee_fin),
      note: d.note === '' ? null : Math.max(0, Math.min(5, Number(d.note))), commentaire: d.commentaire?.trim() || null,
      photo_path: nouvellePhoto ? null : p.photo_path ?? null
    });
    if (nouvellePhoto) {
      await core.store.enregistrerPhoto(produit.id, nouvellePhoto);
      oublierPhoto(produit.id);
      await core.store.put('produits', { ...produit, photo_path: `${produit.id}.jpg` });
    }
    const n = Number(d.quantite || 0);
    if (!existant && n > 0) {
      const r = rangements.find((x) => x.id === d.rangement);
      const emplacements = r && aGrille(r) ? (await emplacementsLibres(core.store, r)).slice(0, n) : [];
      await ajouterBouteilles(core.store, produit.id, n, { rangement_id: r?.id || null, emplacements });
    }
    core.aller(`/fiche/${produit.id}`);
  });

  el.append(form);
}

// Suppression en deux temps, sans boîte de dialogue bloquante : le bouton demande confirmation.
function confirmerSuppression(form) {
  const b = form.querySelector('.danger');
  if (b.dataset.confirmer) return true;
  b.dataset.confirmer = '1';
  b.textContent = 'Confirmer la suppression';
  return false;
}
