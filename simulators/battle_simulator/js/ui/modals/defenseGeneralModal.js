import { defenseGeneralAbilities } from '../../data/variables.js';
import { writeStoredJson } from '../../data/storage.js';

function bindToggle(id, key) {
  const el = document.getElementById(id);
  if (!el) return;
  el.checked = !!defenseGeneralAbilities[key];
  el.onchange = () => {
    defenseGeneralAbilities[key] = el.checked;
    writeStoredJson('defenseGeneralAbilities', defenseGeneralAbilities);
  };
}

export function openDefenseGeneralModal() {
  const modalEl = document.getElementById('defenseGeneralModal');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  bindToggle('defense-ability-wave-strength', 'waveStrengthBonus');
  bindToggle('defense-ability-periodic-debuff', 'periodicDebuff');
  bindToggle('defense-ability-conditional-melee', 'conditionalMeleeBoost');
  bindToggle('defense-ability-courtyard-steal', 'courtyardStealBonus');
  bindToggle('defense-ability-courtyard-loss-bonus', 'courtyardLossBonus');
  bindToggle('defense-ability-every-second-wave', 'everySecondWaveStrength');
  bindToggle('defense-ability-wings-whirlwind', 'wingsWhirlwind');

  modal.show();
}
