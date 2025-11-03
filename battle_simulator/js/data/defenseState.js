import { defense_units, defense_tools, defenseSlots } from './variables.js';

export function saveDefenseState() {
  const defenseState = {
    defense_units,
    defense_tools,
    defenseSlots
  };
  localStorage.setItem('defenseState', JSON.stringify(defenseState));
}

export function loadDefenseState() {
  const savedState = localStorage.getItem('defenseState');
  if (savedState) {
    const parsedState = JSON.parse(savedState);
    defense_units.splice(0, defense_units.length, ...(parsedState.defense_units || []));
    defense_tools.splice(0, defense_tools.length, ...(parsedState.defense_tools || []));
    
    Object.keys(defenseSlots).forEach(key => delete defenseSlots[key]);
    Object.assign(defenseSlots, parsedState.defenseSlots || {
      front: { units: [], wallTools: [], gateTools: [], moatTools: [] },
      left: { units: [], wallTools: [], gateTools: [], moatTools: [] },
      right: { units: [], wallTools: [], gateTools: [], moatTools: [] },
      cy: { units: [], cyTools: [] }
    });
  }
}
