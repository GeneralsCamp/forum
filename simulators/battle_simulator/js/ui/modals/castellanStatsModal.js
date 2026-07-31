import { bindSlider, bindConfirmButton } from './modalUtils.js';
import { castellanStats, currentSide, currentSideDefense, defense_units } from '../../data/variables.js';
import { switchSide } from '../uiWaves.js';
import { loadData } from '../../data/dataLoader.js';
import { switchDefenseSide } from '../uiDefense.js';
import { renderUnitLevelControls, saveUnitLevelControls } from './unitLevelControls.js';
import { writeStoredJson } from '../../data/storage.js';

export function openCastellanStatsModal() {
  const modalEl = document.getElementById('castellanStatsModal');
  const modal = new bootstrap.Modal(modalEl);
  renderUnitLevelControls('defense-unit-level-controls', defense_units);

  const sliders = [
    { sliderId: 'defense-melee-strength-slider', valueId: 'defense-melee-strength-value', value: castellanStats.melee, min: 0, max: 500 },
    { sliderId: 'defense-ranged-strength-slider', valueId: 'defense-ranged-strength-value', value: castellanStats.ranged, min: 0, max: 500 },
    { sliderId: 'defense-courtyard-strength-slider', valueId: 'defense-courtyard-strength-value', value: castellanStats.courtyard, min: 0, max: 600 },
    { sliderId: 'wall-unit-limit-slider', valueId: 'wall-unit-limit-value', value: castellanStats.wallUnitLimit, min: 100, max: 50000 },
    { sliderId: 'cy-unit-limit-slider', valueId: 'cy-unit-limit-value', value: castellanStats.cyUnitLimit, min: 100, max: 5000000 },
    { sliderId: 'defense-wall-protection-slider', valueId: 'defense-wall-protection-value', value: castellanStats.wallProtection, min: 0, max: 500 },
    { sliderId: 'defense-moat-protection-slider', valueId: 'defense-moat-protection-value', value: castellanStats.moatProtection, min: 0, max: 400 },
    { sliderId: 'defense-gate-protection-slider', valueId: 'defense-gate-protection-value', value: castellanStats.gateProtection, min: 0, max: 500 }
  ];

  sliders.forEach(s => bindSlider(s.sliderId, s.valueId, { value: s.value, min: s.min, max: s.max }));

  const confirmValues = [
    { sliderId: 'defense-melee-strength-slider', property: 'melee', targetObject: castellanStats },
    { sliderId: 'defense-ranged-strength-slider', property: 'ranged', targetObject: castellanStats },
    { sliderId: 'defense-courtyard-strength-slider', property: 'courtyard', targetObject: castellanStats },
    { sliderId: 'wall-unit-limit-slider', property: 'wallUnitLimit', targetObject: castellanStats },
    { sliderId: 'cy-unit-limit-slider', property: 'cyUnitLimit', targetObject: castellanStats },
    { sliderId: 'defense-wall-protection-slider', property: 'wallProtection', targetObject: castellanStats },
    { sliderId: 'defense-moat-protection-slider', property: 'moatProtection', targetObject: castellanStats },
    { sliderId: 'defense-gate-protection-slider', property: 'gateProtection', targetObject: castellanStats }
  ];

  bindConfirmButton('confirmCastellanStats', confirmValues, modal, () => {
    saveUnitLevelControls('defense-unit-level-controls');
    writeStoredJson('castellanStats', castellanStats);
    loadData().then(() => {
      switchSide(currentSide);
      switchDefenseSide(currentSideDefense);
    });
  });

  modal.show();
}
