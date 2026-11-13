// Section « Stock & rangement » de la fiche : quantité (− / +), bouteille par bouteille (rangement, emplacement,
// état, niveau), rangement groupé, historique des sorties. Chaque action peut être annulée.
import { ajouterBouteilles, sortirBouteille, aGrille, emplacementsLibres, EN_CAVE } from '../../core/inventaire.js';
import { toast } from '../../core/ui/toast.js';
import { remplacer } from '../../core/ui/dom.js';
import { libelleEmplacement, visibleDans } from '../../core/rangements.js';

const ETATS = { stock: 'En stock', ouverte: 'Ouverte', bue: 'Bue', offerte: 'Offerte' };
// Niveau affiché au quart près.
const QUARTS = [[100, 'Plein'], [75, '¾'], [50, '½'], [25, '¼'], [5, 'Fond']];
const quartDe = (n) => (n <= 12 ? 5 : Math.round(n / 25) * 25);
export const libelleNiveau = (n) => Object.fromEntries(QUARTS)[quartDe(n)];
const versesRestants = (n, cl) => Math.max(0, Math.floor((n / 100) * cl / 4));
const aujourdhui = () => new Date().toISOString().slice(0, 10);

export async function contenuStock(core, p, rangements) {
  const { h } = core;
  const recharger = () => core.aller(`/fiche/${p.id}`);
  // Annulation générique : remet les lignes dans l'état d'avant.
  const avecAnnulation = async (texte, avant, action) => {
    await action();
    toast(texte, { annuler: async () => { for (const b of avant) await core.store.put('bouteilles', b); recharger(); } });
    recharger();
  };
  const toutes = (await core.store.list('bouteilles')).filter((b) => b.produit_id === p.id);
  const sorties = toutes.filter((b) => !EN_CAVE.includes(b.etat)).sort((a, b) => String(b.sortie_le || '').localeCompare(String(a.sortie_le || '')));
  const message = h('p', { class: 'message', role: 'alert' });
  const nomRangement = (b) => { const r = rangements.get(b.rangement_id); return [r?.nom, libelleEmplacement(r, b.emplacement)].filter(Boolean).join(' · ') || 'Sans rangement'; };
  // Seuls les rangements de la collection du produit (ou mixtes) sont proposés.
  rangements = new Map([...rangements].filter(([, r]) => visibleDans(r, p.profil) || p.bouteilles.some((b) => b.rangement_id === r.id)));
  const dernierRangement = [...p.bouteilles].reverse().find((b) => b.rangement_id)?.rangement_id || null;

  async function placer(rangementId, n) {
    const r = rangements.get(rangementId);
    if (!r || !aGrille(r)) return { emplacements: [] };
    const libres = await emplacementsLibres(core.store, r);
    return libres.length < n ? { erreur: `Plus que ${libres.length} emplacement(s) libre(s) dans ${r.nom}.` } : { emplacements: libres.slice(0, n) };
  }

  // Quantité − / +
  const enStock = p.bouteilles.filter((b) => b.etat === 'stock');
  const raisons = h('div', { class: 'raisons', hidden: true },
    h('span', { class: 'libelle' }, 'Retirer une bouteille :'),
    ['bue', 'offerte'].map((etat) => h('button', {
      type: 'button', class: 'bouton', onclick: () => {
        const b = enStock.at(-1) || p.bouteilles.at(-1);
        avecAnnulation(`Bouteille n° ${b.numero} ${ETATS[etat].toLowerCase()}.`, [b], () => sortirBouteille(core.store, b, etat));
      }
    }, etat === 'bue' ? 'Bue' : 'Offerte')),
    h('button', {
      type: 'button', class: 'bouton danger', onclick: () => {
        const b = enStock.at(-1) || p.bouteilles.at(-1);
        avecAnnulation(`Bouteille n° ${b.numero} supprimée (erreur de saisie).`, [b], () => core.store.remove('bouteilles', b.id));
      }
    }, 'Erreur de saisie'));
  const compteur = h('div', { class: 'compteur-stock' },
    h('button', {
      type: 'button', class: 'pas', 'aria-label': 'Retirer une bouteille', disabled: p.stock === 0,
      onclick: () => { raisons.hidden = !raisons.hidden; }
    }, '−'),
    h('span', { class: 'compte', 'aria-live': 'polite' }, h('strong', {}, String(p.stock)), ` bouteille${p.stock > 1 ? 's' : ''}`),
    h('button', {
      type: 'button', class: 'pas', 'aria-label': 'Ajouter une bouteille', onclick: async () => {
        const pl = await placer(dernierRangement, 1);
        if (pl.erreur) { message.textContent = pl.erreur; return; }
        const [b] = await ajouterBouteilles(core.store, p.id, 1, { rangement_id: dernierRangement, emplacements: pl.emplacements });
        toast(`Bouteille n° ${b.numero} ajoutée${dernierRangement ? ` dans ${rangements.get(dernierRangement).nom}` : ''}.`, { annuler: async () => { await core.store.remove('bouteilles', b.id); recharger(); } });
        recharger();
      }
    }, '+'));

  // Action principale (ouvrir / terminer) et niveau d'une bouteille ouverte
  const ouverte = p.bouteilles.find((b) => b.etat === 'ouverte');
  const spiritueux = p.profil === 'spiritueux';
  const actionPrincipale = spiritueux && ouverte
    ? h('button', { type: 'button', class: 'bouton principal', onclick: () => avecAnnulation('Bouteille terminée.', [ouverte], () => sortirBouteille(core.store, ouverte, 'bue')) }, 'Bouteille terminée')
    : enStock.length ? h('button', {
      type: 'button', class: 'bouton principal',
      onclick: () => avecAnnulation(spiritueux ? 'Bouteille ouverte.' : 'Bouteille ouverte : bonne dégustation !', [enStock[0]], () => sortirBouteille(core.store, enStock[0], spiritueux ? 'ouverte' : 'bue'))
    }, 'Ouvrir une bouteille') : null;
  // Niveau d'une bouteille ouverte : en quarts, ou « un verre » (4 cl selon la contenance).
  const contenance = Number(p.extra?.volume_cl) || 70;
  const niveau = ouverte && spiritueux ? (() => {
    const actuel = ouverte.niveau ?? 100;
    const regler = (v, texte) => avecAnnulation(texte, [ouverte], () => core.store.put('bouteilles', { ...ouverte, niveau: Math.max(0, Math.min(100, Math.round(v))) }));
    return h('div', { class: 'niveau' },
      h('span', { class: 'libelle' }, `Niveau · bouteille n° ${ouverte.numero} · ${libelleNiveau(actuel)} · ≈ ${versesRestants(actuel, contenance)} verre(s) de 4 cl`),
      h('div', { class: 'quarts', role: 'radiogroup', 'aria-label': 'Niveau restant' },
        QUARTS.map(([v, t]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(quartDe(actuel) === v), onclick: () => regler(v, `Niveau : ${t}`) }, t))),
      h('button', { type: 'button', class: 'bouton', onclick: () => regler(actuel - (4 / contenance) * 100, 'Un verre de 4 cl servi.') }, 'Je me suis servi un verre (4 cl)'));
  })() : null;

  // Bouteille par bouteille
  const options = (selection) => [h('option', { value: '' }, 'Sans rangement'), [...rangements.values()].map((r) => h('option', { value: r.id, selected: r.id === selection }, r.nom))];
  function editeur(b, li) {
    const choixR = h('select', { 'aria-label': `Rangement de la bouteille ${b.numero}` }, options(b.rangement_id));
    const zoneEmpl = h('span', { class: 'zone-emplacement' });
    const majEmplacements = async () => {
      const r = rangements.get(choixR.value);
      if (r && aGrille(r)) {
        const libres = await emplacementsLibres(core.store, r);
        const liste = b.rangement_id === r.id && b.emplacement ? [b.emplacement, ...libres] : libres;
        remplacer(zoneEmpl, h('select', { 'aria-label': 'Emplacement' }, h('option', { value: '' }, 'Sans emplacement'), liste.map((e) => h('option', { value: e, selected: e === b.emplacement }, libelleEmplacement(r, e)))));
      } else {
        remplacer(zoneEmpl, h('input', { type: 'text', value: rangements.get(b.rangement_id)?.id === choixR.value ? b.emplacement || '' : '', placeholder: 'Étagère, position… (facultatif)', 'aria-label': 'Emplacement' }));
      }
    };
    choixR.addEventListener('change', majEmplacements);
    majEmplacements();
    const etat = h('select', { 'aria-label': 'État' }, Object.entries(ETATS).map(([k, t]) => h('option', { value: k, selected: k === b.etat }, t)));
    const panneau = h('div', { class: 'editeur-bouteille' },
      h('label', { class: 'champ' }, h('span', { class: 'libelle' }, 'Rangement'), choixR),
      h('label', { class: 'champ' }, h('span', { class: 'libelle' }, 'Emplacement'), zoneEmpl),
      h('label', { class: 'champ' }, h('span', { class: 'libelle' }, 'État'), etat),
      h('div', { class: 'boutons' },
        h('button', {
          type: 'button', class: 'bouton principal', onclick: () => {
            const nouvelEtat = etat.value;
            const maj = { ...b, rangement_id: choixR.value || null, emplacement: zoneEmpl.firstChild?.value?.trim() || null, etat: nouvelEtat };
            if (!EN_CAVE.includes(nouvelEtat)) { maj.sortie_le = maj.sortie_le || aujourdhui(); maj.emplacement = null; }
            if (nouvelEtat === 'ouverte' && !b.ouverte_le) { maj.ouverte_le = aujourdhui(); maj.niveau = b.niveau ?? 100; }
            avecAnnulation(`Bouteille n° ${b.numero} modifiée.`, [b], () => core.store.put('bouteilles', maj));
          }
        }, 'Enregistrer'),
        h('button', { type: 'button', class: 'bouton', onclick: () => panneau.remove() }, 'Fermer'),
        h('button', { type: 'button', class: 'bouton danger', onclick: () => avecAnnulation(`Bouteille n° ${b.numero} supprimée.`, [b], () => core.store.remove('bouteilles', b.id)) }, 'Supprimer')));
    li.after(panneau);
  }
  const lignes = p.bouteilles.map((b) => {
    const r = rangements.get(b.rangement_id);
    const li = h('li', { class: 'bouteille' },
      h('span', { class: 'numero' }, `#${b.numero}`),
      h('span', { class: 'lieu' }, nomRangement(b), b.etat === 'ouverte' ? h('span', { class: 'discret' }, ` · ouverte, reste ${libelleNiveau(b.niveau ?? 100)}`) : null),
      r && aGrille(r) && b.emplacement ? h('a', { href: `#/rangement/${r.id}?b=${b.numero}`, class: 'lien-localiser', 'aria-label': `Localiser la bouteille ${b.numero}` }, core.icone('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>', 20)) : null,
      h('button', { type: 'button', class: 'lien-localiser', 'aria-label': `Modifier la bouteille ${b.numero}`, onclick: (e) => { const ouvert = e.currentTarget.closest('li').nextElementSibling?.classList.contains('editeur-bouteille'); if (ouvert) e.currentTarget.closest('li').nextElementSibling.remove(); else editeur(b, e.currentTarget.closest('li')); } },
        core.icone('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>', 18)));
    return li;
  });

  // Ranger d'un coup les bouteilles sans rangement
  const sansRangement = p.bouteilles.filter((b) => !b.rangement_id);
  const toutRanger = sansRangement.length && rangements.size ? (() => {
    const choix = h('select', { 'aria-label': 'Ranger les bouteilles sans rangement dans' }, [...rangements.values()].map((r) => h('option', { value: r.id }, r.nom)));
    return h('div', { class: 'ajout-stock' }, choix, h('button', {
      type: 'button', class: 'bouton', onclick: async () => {
        const pl = await placer(choix.value, sansRangement.length);
        if (pl.erreur) { message.textContent = pl.erreur; return; }
        avecAnnulation(`${sansRangement.length} bouteille(s) rangée(s) dans ${rangements.get(choix.value).nom}.`, sansRangement, async () => {
          for (const [i, b] of sansRangement.entries()) await core.store.put('bouteilles', { ...b, rangement_id: choix.value, emplacement: pl.emplacements[i] || null });
        });
      }
    }, `Ranger ${sansRangement.length > 1 ? `les ${sansRangement.length}` : 'la bouteille'}`));
  })() : null;

  // Ajout de plusieurs bouteilles
  const choixAjout = h('select', { 'aria-label': 'Rangement des nouvelles bouteilles' }, options(dernierRangement));
  const quantite = h('input', { type: 'number', min: '1', max: '48', value: '1', 'aria-label': 'Nombre de bouteilles', class: 'quantite', inputmode: 'numeric' });
  const ajoutMultiple = h('div', { class: 'ajout-stock' }, quantite, choixAjout, h('button', {
    type: 'button', class: 'bouton', onclick: async () => {
      const n = Math.max(1, Math.min(48, Number(quantite.value) || 1));
      const pl = await placer(choixAjout.value, n);
      if (pl.erreur) { message.textContent = pl.erreur; return; }
      const creees = await ajouterBouteilles(core.store, p.id, n, { rangement_id: choixAjout.value || null, emplacements: pl.emplacements });
      toast(`${n} bouteille(s) ajoutée(s).`, { annuler: async () => { for (const b of creees) await core.store.remove('bouteilles', b.id); recharger(); } });
      recharger();
    }
  }, '+ Ajouter'));

  const historique = sorties.length ? h('details', { class: 'sorties' },
    h('summary', {}, `${sorties.length} bouteille(s) sortie(s)`),
    h('ul', { class: 'liste-bouteilles' }, sorties.map((b) => h('li', { class: 'bouteille' },
      h('span', { class: 'numero' }, `#${b.numero}`),
      h('span', { class: 'lieu' }, `${ETATS[b.etat]}${b.sortie_le ? ` le ${new Date(b.sortie_le).toLocaleDateString('fr-FR')}` : ''}`),
      h('button', { type: 'button', class: 'bouton petit', onclick: () => avecAnnulation(`Bouteille n° ${b.numero} remise en stock.`, [b], () => core.store.put('bouteilles', { ...b, etat: 'stock', sortie_le: null })) }, 'Remettre en stock'))))) : null;

  return [
    compteur, raisons,
    p.bouteilles.length ? h('ul', { class: 'liste-bouteilles en-cave' }, lignes) : h('p', { class: 'discret' }, 'Aucune bouteille en stock : la fiche reste dans votre cave.'),
    niveau,
    actionPrincipale ? h('div', { class: 'boutons' }, actionPrincipale) : null,
    toutRanger,
    h('p', { class: 'libelle ajout-titre' }, 'Ajouter plusieurs bouteilles'),
    ajoutMultiple,
    historique,
    message
  ];
}
