// Clés et choix du service d'identification : stockés sur cet appareil uniquement (jamais exportés ni synchronisés).
import { lire, ecrire } from './kv.js';

const DEFAUTS = { fournisseur: 'auto', ocrKey: '', geminiKey: '', geminiModel: 'gemini-3.8-flash', claudeKey: '', claudeModel: 'claude-sonnet-5-5' };

export function cles() {
  return { ...DEFAUTS, ...lire('cles', {}) };
}

export function enregistrerCles(maj) {
  ecrire('cles', { ...lire('cles', {}), ...maj });
}

// Reprise unique des clés saisies dans Cave Revival v9 (même site).
export function reprendreClesV9() {
  if (lire('cles_reprises', false)) return false;
  ecrire('cles_reprises', true);
  try {
    const K = JSON.parse(localStorage.getItem('caveasy_state')) || {};
    const maj = {};
    if (K.ocrKey) maj.ocrKey = K.ocrKey;
    if (K.geminiKey) maj.geminiKey = K.geminiKey;
    if (K.geminiModel) maj.geminiModel = K.geminiModel;
    if (K.apiKey) maj.claudeKey = K.apiKey;
    if (K.model) maj.claudeModel = K.model;
    if (K.provider) maj.fournisseur = { anthropic: 'claude', gemini: 'gemini', ocrspace: 'ocrspace', local: 'local' }[K.provider] || 'auto';
    if (!Object.keys(maj).length) return false;
    enregistrerCles(maj);
    return true;
  } catch {
    return false;
  }
}

export const masquer = (k) => (k ? `…${k.slice(-4)} (${k.length} car.)` : 'absente');
