import { defenseSlots } from './variables.js';
import { readStoredJson, writeStoredJson } from './storage.js';

export function saveDefenseState() {
  writeStoredJson('defenseState', { defenseSlots });
}

export function loadDefenseState() {
  const parsedState = readStoredJson('defenseState');
  if (parsedState) {

    Object.keys(defenseSlots).forEach(key => delete defenseSlots[key]);
    Object.assign(defenseSlots, parsedState.defenseSlots || {
      front: { units: [], wallTools: [], gateTools: [], moatTools: [] },
      left: { units: [], wallTools: [], gateTools: [], moatTools: [] },
      right: { units: [], wallTools: [], gateTools: [], moatTools: [] },
      cy: { units: [], cyTools: [] }
    });
  }
}
