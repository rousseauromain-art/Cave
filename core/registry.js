// Seul endroit qui connaît la liste des modules. L'ordre ici n'a pas d'effet sur la navigation
// (c'est le champ « ordre » de chaque écran qui la fixe).
import ceSoir from '../modules/ce-soir/module.js';
import cave from '../modules/cave/module.js';
import scanner from '../modules/scanner/module.js';
import degustations from '../modules/degustations/module.js';
import rangements from '../modules/rangements/module.js';
import aide from '../modules/aide/module.js';
import myoenoSpiritueux from '../modules/myoeno-spiritueux/module.js';
import diagnostic from '../modules/diagnostic/module.js';

export const MODULES = [ceSoir, cave, scanner, degustations, myoenoSpiritueux, rangements, aide, diagnostic];
