// Ligne d'historique de dégustation (écran Dégustations et fiche) : résumé, lien, suppression en deux touches.
import { h } from './dom.js';
import { radar } from './radar.js';
import { supprimerDegustation } from '../degustations.js';

const CORBEILLE = '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>';
const date = (l) => String(l.mesure?.mesure_le || l.degustation?.le || '').slice(0, 10).split('-').reverse().join('/');

export function ligneDegustation(core, l, { avecNom = true, lien = true, surSuppression = () => {} } = {}) {
  const { mesure, degustation: d, produit } = l;
  const texte = h('span', { class: 'ligne-texte' },
    avecNom ? h('strong', {}, produit ? [produit.nom, produit.millesime].filter(Boolean).join(' ') : 'Verre non rattaché') : h('strong', {}, date(l)),
    h('span', { class: 'discret' }, [avecNom ? date(l) : null, mesure ? `P ${mesure.puissance} · T ${mesure.tanins} · V ${mesure.vivacite}` : null].filter(Boolean).join(' · ')),
    d?.mots_cles?.length ? h('span', { class: 'discret' }, d.mots_cles.join(', ')) : null,
    d?.commentaire ? h('span', { class: 'commentaire-degustation' }, d.commentaire) : null);
  const contenu = [mesure ? radar(mesure, { taille: 56, etiquettes: false }) : h('span', { class: 'vignette-vide petite' }), texte,
    d?.note ? h('span', { class: 'note-historique' }, `★ ${d.note}`) : null];
  const corps = lien && produit ? h('a', { href: `#/fiche/${produit.id}`, class: 'ligne-historique' }, contenu) : h('div', { class: 'ligne-historique' }, contenu);
  const supprimer = h('button', {
    type: 'button', class: 'bouton-supprimer', 'aria-label': `Supprimer la dégustation du ${date(l)}`,
    onclick: async (e) => {
      const b = e.currentTarget;
      if (!b.dataset.confirmer) {
        b.dataset.confirmer = '1';
        b.textContent = mesure ? 'Supprimer, mesure comprise ?' : 'Supprimer ?';
        setTimeout(() => { if (b.isConnected && b.dataset.confirmer) { delete b.dataset.confirmer; b.replaceChildren(core.icone(CORBEILLE, 20)); } }, 5000);
        return;
      }
      await supprimerDegustation(core.store, l);
      b.closest('li')?.remove();
      surSuppression(l);
    }
  }, core.icone(CORBEILLE, 20));
  return h('li', { class: 'carte item-degustation' }, corps, supprimer);
}
