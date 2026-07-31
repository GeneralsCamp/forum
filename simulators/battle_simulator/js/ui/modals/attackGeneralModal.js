import { attackGeneralAbilities } from '../../data/variables.js';
import { writeStoredJson } from '../../data/storage.js';

function bindToggle(id, key) {
  const el = document.getElementById(id);
  if (!el) return;
  el.checked = !!attackGeneralAbilities[key];
  el.onchange = () => {
    attackGeneralAbilities[key] = el.checked;
    writeStoredJson('attackGeneralAbilities', attackGeneralAbilities);
  };
}

export function openAttackGeneralModal() {
  const modalEl = document.getElementById('attackGeneralModal');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  bindToggle('attack-ability-wave-strength', 'waveStrengthBonus');
  bindToggle('attack-ability-periodic-debuff', 'periodicDebuff');
  bindToggle('attack-ability-conditional-melee', 'conditionalMeleeBoost');
  bindToggle('attack-ability-courtyard-steal', 'courtyardStealBonus');
  bindToggle('attack-ability-courtyard-loss-bonus', 'courtyardLossBonus');
  bindToggle('attack-ability-odd-even-swing', 'oddEvenStrengthSwing');
  bindToggle('attack-ability-every-second-wave', 'everySecondWaveStrength');

  modal.show();
}
