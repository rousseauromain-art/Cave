// Création d'éléments DOM sans innerHTML pour le contenu (pas d'injection possible).
export function h(tag, attrs = {}, ...enfants) {
  const el = document.createElement(tag);
  for (const [cle, val] of Object.entries(attrs || {})) {
    if (val === false || val === null || val === undefined) continue;
    if (cle.startsWith('on') && typeof val === 'function') el.addEventListener(cle.slice(2).toLowerCase(), val);
    else if (cle === 'class') el.className = val;
    else if (cle === 'style' && typeof val === 'object') Object.assign(el.style, val);
    else el.setAttribute(cle, val === true ? '' : val);
  }
  ajouter(el, enfants);
  return el;
}

// Ajoute des enfants en ignorant null/undefined/false (Element.append écrirait « null »).
export function ajouter(el, enfants) {
  for (const e of enfants.flat(Infinity)) {
    if (e === null || e === undefined || e === false) continue;
    el.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
}

// Icône SVG 24×24 à partir d'un tracé constant défini dans le code (jamais de donnée utilisateur).
export function icone(trace, taille = 24) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', taille);
  svg.setAttribute('height', taille);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.9');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = trace;
  return svg;
}

export function vider(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}
