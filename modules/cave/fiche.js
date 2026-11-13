// Fiche d'un produit : photo avec drapeau/note/compteur, sections dépliables au style de la carte MyOeno.
import { produitEnrichi, nomComplet } from '../../core/inventaire.js';
import { drapeau, pastille, note } from '../../core/ui/badges.js';
import { urlPhoto } from '../../core/photos.js';
import { radar, moyenne } from '../../core/ui/radar.js';
import { contenuStock } from './stock.js';
import { dessinerCourbe } from '../../core/ui/courbe.js';
import { PHASES, SERVICE, MODELES, aerationPour, reglagesService } from '../../core/apogee.js';

const ouverts = new Set(['stock', 'profil', 'apogee']);

// Anneau d'aération (échelle de l'appareil choisi).
function anneau(heures, hmax = 24) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 74 74'); svg.setAttribute('width', '84'); svg.setAttribute('height', '84'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'anneau');
  const f = Math.min(1, heures / hmax), a1 = -Math.PI / 2 + f * 2 * Math.PI;
  const fond = document.createElementNS(NS, 'circle');
  fond.setAttribute('cx', 37); fond.setAttribute('cy', 37); fond.setAttribute('r', 30); fond.setAttribute('class', 'anneau-fond');
  svg.append(fond);
  if (f > 0) {
    const arc = document.createElementNS(NS, 'path');
    arc.setAttribute('d', f >= 1 ? 'M37 7a30 30 0 1 1 -0.01 0' : `M37 7 A30 30 0 ${f > 0.5 ? 1 : 0} 1 ${(37 + 30 * Math.cos(a1)).toFixed(1)} ${(37 + 30 * Math.sin(a1)).toFixed(1)}`);
    arc.setAttribute('class', 'anneau-arc');
    svg.append(arc);
  }
  const t = document.createElementNS(NS, 'text');
  t.setAttribute('x', 37); t.setAttribute('y', 42); t.setAttribute('text-anchor', 'middle'); t.setAttribute('class', 'anneau-texte');
  t.textContent = `${heures} h`;
  svg.append(t);
  return svg;
} // sections ouvertes par défaut, mémorisées le temps de la session

function section(core, id, titre, resume, ...contenu) {
  const { h } = core;
  const d = h('details', { class: 'section', 'data-section': id, open: ouverts.has(id) },
    h('summary', {}, h('span', { class: 'section-titre' }, titre), resume ? h('span', { class: 'section-resume' }, resume) : null),
    h('div', { class: 'section-corps' }, ...contenu));
  d.addEventListener('toggle', () => (d.open ? ouverts.add(id) : ouverts.delete(id)));
  return d;
}

export async function ecranFiche(core, el, { id }) {
  const { h } = core;
  const p = await produitEnrichi(core.store, id);
  if (!p) {
    el.append(h('section', { class: 'carte' }, h('h2', {}, 'Introuvable'), h('p', {}, 'Ce produit n’existe plus.'), h('a', { href: '#/cave' }, 'Retour à la cave')));
    return;
  }
  core.titre(p.profil === 'vin' ? 'Fiche vin' : 'Fiche spiritueux');
  const rangements = new Map((await core.store.list('rangements')).map((r) => [r.id, r]));
  const message = h('p', { class: 'message', role: 'status' });
  const style = p.styleInfo;
  // Profil : moyenne des vins du même style (pointillés) et mots-clés des dégustations de ce vin.
  const [mesures, degustations, tousProduits] = await Promise.all([core.store.list('mesures'), core.store.list('degustations'), core.store.list('produits')]);
  const nbMesures = mesures.filter((m) => m.produit_id === p.id).length;
  const memeStyle = new Set(tousProduits.filter((x) => p.style && x.style === p.style && x.id !== p.id).map((x) => x.id));
  const moyStyle = moyenne(mesures.filter((m) => memeStyle.has(m.produit_id)));
  const motsFiche = [...new Set(degustations.filter((d) => d.produit_id === p.id).flatMap((d) => d.mots_cles || []))];

  // En-tête photo
  const photo = h('div', { class: 'fiche-photo', style: style ? { background: style.fond, color: style.texte } : null },
    h('span', { class: 'etiquette-generee grande' }, h('span', { class: 'nom-court' }, p.nom), p.millesime ? h('span', { class: 'annee' }, p.millesime) : null),
    h('span', { class: 'fiche-haut' },
      style ? pastille(style) : null,
      h('a', { href: `#/produit/${p.id}/modifier`, class: 'bouton-rond clair', 'aria-label': 'Modifier la fiche' }, core.icone('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>', 19))),
    h('span', { class: 'fiche-bas' }, drapeau(p.pays, 30), note(p.note), h('span', { class: 'fois' }, `×${p.stock}`)));
  urlPhoto(core.store, p.id).then((url) => { if (url) photo.prepend(h('img', { src: url, alt: `Étiquette ${p.nom}` })); });

  const stock = await contenuStock(core, p, rangements);

  const sections = [
    section(core, 'stock', 'Stock & rangement', `${p.stock} bouteille${p.stock > 1 ? 's' : ''}`, ...stock),
    section(core, 'profil', p.profil === 'vin' ? 'Profil MyOeno' : 'Dégustations', p.mesure ? `${nbMesures} mesure${nbMesures > 1 ? 's' : ''}` : p.profil === 'vin' ? 'à mesurer' : `${motsFiche.length ? 'dégusté' : 'à déguster'}`,
      p.mesure
        ? h('div', { class: 'profil-fiche' },
          radar(p.mesure, { taille: 220, fantome: moyStyle, legende: moyStyle ? 'la moyenne de vos vins du même style' : '' }),
          h('div', { class: 'indices' }, h('span', {}, 'Évolution ', h('strong', {}, String(p.mesure.evolution ?? '–'))), h('span', {}, 'Garde ', h('strong', {}, String(p.mesure.garde ?? '–'))), moyStyle ? h('span', { class: 'discret' }, '- - - même style') : null),
          motsFiche.length ? h('div', { class: 'puces-mots lecture' }, motsFiche.map((m) => h('span', { class: 'puce-mot', 'aria-pressed': 'true' }, m))) : null,
          h('p', { class: 'discret' }, p.stock > 1 ? `Ce profil vaut pour ses ${p.stock} bouteilles.` : 'Ce profil vaut pour toutes ses bouteilles.'))
        : h('p', { class: 'discret' }, 'Pas encore de mesure. Le profil vaudra pour toutes les bouteilles de ce vin.'),
      h('a', { href: `#/mesure?produit=${p.id}`, class: 'bouton' }, p.profil === 'vin' ? 'Scanner avec MyOeno' : 'Déguster')),
    p.profil === 'vin' ? section(core, 'apogee', 'Apogée', p.phase ? h('span', { class: `statut ${p.phase}` }, PHASES[p.phase]) : 'non renseignée',
      p.apogee && p.millesime ? dessinerCourbe(p.millesime, p.apogee.debut, p.apogee.fin) : null,
      p.apogee
        ? h('p', { class: 'phrase' }, { jeunesse: `Encore jeune : idéal à partir de ${p.apogee.debut}.`, apogee: `À son apogée jusqu'en ${p.apogee.fin}.`, declin: `Plateau passé depuis ${p.apogee.fin} : à boire sans attendre.` }[p.phase])
        : h('p', { class: 'discret' }, p.millesime ? 'Renseignez l\u2019appellation ou les années dans la fiche pour estimer l\u2019apogée.' : 'Renseignez le millésime pour estimer l\u2019apogée.'),
      p.apogee?.source ? h('p', { class: 'discret' }, `${p.apogee.estimee ? 'Estimation — ' : 'Source : '}${p.apogee.source}`) : null,
      p.apogee?.estimee ? h('button', {
        type: 'button', class: 'bouton', onclick: async () => {
          const brut = await core.store.get('produits', p.id);
          await core.store.put('produits', { ...brut, apogee_debut: p.apogee.debut, apogee_fin: p.apogee.fin, extra: { ...(brut.extra || {}), apogee_source: p.apogee.source } });
          core.aller(`/fiche/${p.id}`);
        }
      }, `Retenir ${p.apogee.debut}–${p.apogee.fin}`) : null) : null,
    p.profil === 'vin' && p.style ? (() => {
      const heures = aerationPour(p);
      const temp = SERVICE[p.style];
      return section(core, 'aeration', 'Aération', heures ? `${heures} h` : 'aucune',
        h('div', { class: 'aeration-ligne' },
          anneau(heures, MODELES[reglagesService().modele]?.hmax ?? 24),
          h('div', {}, h('p', { class: 'phrase gauche' }, heures ? `${heures} h d\u2019aération conseillée${p.mesure ? '' : ' (sans mesure : tanins moyens supposés)'}.` : 'Pas d\u2019aération : se sert directement.'),
            temp ? h('p', { class: 'discret' }, `Service à ${temp[0]}–${temp[1]} °C`) : null)),
        h('a', { href: `#/servir/${p.id}`, class: 'bouton principal' }, 'Préparer le service'));
    })() : null,
    section(core, 'notes', 'Notes', p.commentaire || p.extra?.lien ? '' : 'vide',
      h('p', { class: 'notes-texte' }, p.commentaire || 'Aucune note.'),
      p.extra?.lien && /^https:\/\//.test(p.extra.lien) ? h('a', { href: p.extra.lien, target: '_blank', rel: 'noopener noreferrer' }, 'Fiche du producteur ↗') : null),
    p.extra?.texte_lu?.recto || p.extra?.texte_lu?.verso ? section(core, 'texte-lu', 'Texte de l’étiquette', p.extra.texte_lu.verso ? 'recto et verso' : 'recto',
      h('pre', { class: 'texte-etiquette' }, [p.extra.texte_lu.recto, p.extra.texte_lu.verso && `— Verso —\n${p.extra.texte_lu.verso}`].filter(Boolean).join('\n\n'))) : null
  ];

  el.append(
    photo,
    h('div', { class: 'fiche-corps' },
      h('div', { class: 'fiche-titre' },
        h('span', { class: 'surtitre' }, [style?.titre, p.region, p.appellation].filter(Boolean).join(' · ')),
        h('h2', {}, nomComplet(p)),
        p.producteur || p.cuvee ? h('span', { class: 'sous-titre' }, [p.producteur, p.cuvee].filter(Boolean).join(' · ')) : null,
        p.cepages ? h('div', { class: 'puces-mots lecture cepages-fiche', 'aria-label': 'Cépages' }, p.cepages.split(/\s*[,·\/]\s*/).filter(Boolean).map((c) => h('span', { class: 'puce-mot' }, c))) : null),
      sections)
  );
}
