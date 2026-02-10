import { defenseGeneralAbilities } from '../../data/variables.js';

function bindToggle(id, key) {
  const el = document.getElementById(id);
  if (!el) return;
  el.checked = !!defenseGeneralAbilities[key];
  el.onchange = () => {
    defenseGeneralAbilities[key] = el.checked;
    localStorage.setItem('defenseGeneralAbilities', JSON.stringify(defenseGeneralAbilities));
  };
}

export function openDefenseGeneralModal() {
  const modalEl = document.getElementById('defenseGeneralModal');
  const modal = new bootstrap.Modal(modalEl);

  bindToggle('defense-ability-wave-strength', 'waveStrengthBonus');
  bindToggle('defense-ability-periodic-debuff', 'periodicDebuff');
  bindToggle('defense-ability-conditional-melee', 'conditionalMeleeBoost');
  bindToggle('defense-ability-courtyard-steal', 'courtyardStealBonus');
  bindToggle('defense-ability-courtyard-loss-bonus', 'courtyardLossBonus');
  bindToggle('defense-ability-every-second-wave', 'everySecondWaveStrength');

  modal.show();
}
