// Diagnostic : environnement (HTTPS, Bluetooth, stockage) et journal des événements, exportable.
function reglages(core, el) {
  const { h } = core;
  const tableau = h('dl', { class: 'champs-lus' });
  const journal = h('ol', { class: 'journal' });
  const lignes = async () => {
    let bt = 'absent';
    if (navigator.bluetooth) { bt = 'présent'; try { bt += (await navigator.bluetooth.getAvailability()) ? ', adaptateur disponible' : ', adaptateur indisponible'; } catch { /* navigateur sans getAvailability */ } }
    let stockage = '?';
    try { const e = await navigator.storage.estimate(); stockage = `${Math.round(e.usage / 1024)} Ko utilisés`; } catch { /* inconnu */ }
    const infos = [['Version', core.VERSION], ['HTTPS', isSecureContext ? 'oui' : 'NON — Bluetooth et caméra bloqués'], ['Bluetooth', bt], ['Stockage', stockage],
      ['Dernière synchro', (await core.store.meta('derniere_synchro')) || 'jamais'], ['Navigateur', navigator.userAgent.replace(/^Mozilla\/5.0 /, '')]];
    core.ajouter(tableau, infos.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, String(v))]));
    const j = (await core.store.meta('journal')) || [];
    core.ajouter(journal, j.length ? j.map((x) => h('li', { class: x.niveau }, `${new Date(x.quand).toLocaleString('fr-FR')} · ${x.message}`)) : [h('li', {}, 'Journal vide.')]);
  };
  const exporter = async () => {
    const j = (await core.store.meta('journal')) || [];
    const url = URL.createObjectURL(new Blob([j.map((x) => `${x.quand} [${x.niveau}] ${x.message}`).join('\n')], { type: 'text/plain' }));
    const a = h('a', { href: url, download: `cave-journal-${new Date().toISOString().slice(0, 10)}.txt` });
    document.body.append(a); a.click(); a.remove();
  };
  el.append(h('details', { class: 'section', 'data-carte': 'diagnostic' },
    h('summary', {}, h('span', { class: 'section-titre' }, 'Diagnostic'), h('span', { class: 'section-resume' }, 'journal')),
    h('div', { class: 'section-corps' }, tableau, journal, h('button', { type: 'button', class: 'bouton', onclick: exporter }, 'Exporter le journal'))));
  lignes();
}

export default {
  id: 'diagnostic',
  titre: 'Diagnostic',
  flag: { defaut: true, experimental: false },
  ecrans: [],
  reglages,
  tables: []
};
