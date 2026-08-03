import { bindSlider, bindConfirmButton } from './modalUtils.js';
import { castellanStats, currentSide, currentSideDefense, defense_units } from '../../data/variables.js';
import { switchSide } from '../uiWaves.js';
import { switchDefenseSide } from '../uiDefense.js';
import { writeStoredJson } from '../../data/storage.js';
import { imageUrl } from '../../data/imagePaths.js';

export function openCastellanStatsModal() {
  const modalEl = document.getElementById('castellanStatsModal');
  const modal = new bootstrap.Modal(modalEl);
  const courtyardSupportUnit = defense_units.find(unit => String(unit.catalogWodID) === '228');
  const courtyardSupportImage = modalEl.querySelector('img[alt="courtyard-valkyrie-support"]');
  if (courtyardSupportUnit && courtyardSupportImage) courtyardSupportImage.src = imageUrl(courtyardSupportUnit.image);
  const sliders = [
    { sliderId: 'defense-melee-strength-slider', valueId: 'defense-melee-strength-value', value: castellanStats.melee, min: 0, max: 10000, allowDecimal: true },
    { sliderId: 'defense-ranged-strength-slider', valueId: 'defense-ranged-strength-value', value: castellanStats.ranged, min: 0, max: 10000, allowDecimal: true },
    { sliderId: 'defense-universal-strength-slider', valueId: 'defense-universal-strength-value', value: castellanStats.universal, min: 0, max: 500, allowDecimal: true },
    { sliderId: 'defense-courtyard-strength-slider', valueId: 'defense-courtyard-strength-value', value: castellanStats.courtyard, min: 0, max: 10000, allowDecimal: true },
    { sliderId: 'wall-unit-limit-slider', valueId: 'wall-unit-limit-value', value: castellanStats.wallUnitLimit, min: 100, max: 50000, step: 100 },
    { sliderId: 'cy-unit-limit-slider', valueId: 'cy-unit-limit-value', value: castellanStats.cyUnitLimit, min: 100, max: 5000000, step: 1000 },
    { sliderId: 'defense-wall-protection-slider', valueId: 'defense-wall-protection-value', value: castellanStats.wallProtection, min: 0, max: 20000, allowDecimal: true },
    { sliderId: 'defense-moat-protection-slider', valueId: 'defense-moat-protection-value', value: castellanStats.moatProtection, min: 0, max: 20000, allowDecimal: true },
    { sliderId: 'defense-gate-protection-slider', valueId: 'defense-gate-protection-value', value: castellanStats.gateProtection, min: 0, max: 20000, allowDecimal: true },
    { sliderId: 'defense-front-strength-slider', valueId: 'defense-front-strength-value', value: castellanStats.frontStrength, min: 0, max: 20000, allowDecimal: true },
    { sliderId: 'defense-flanks-strength-slider', valueId: 'defense-flanks-strength-value', value: castellanStats.flanksStrength, min: 0, max: 20000, allowDecimal: true },
    { sliderId: 'defense-hol-melee-strength-slider', valueId: 'defense-hol-melee-strength-value', value: castellanStats.holMelee, min: 0, max: 13 },
    { sliderId: 'defense-hol-ranged-strength-slider', valueId: 'defense-hol-ranged-strength-value', value: castellanStats.holRanged, min: 0, max: 13 },
    { sliderId: 'defense-hol-universal-strength-slider', valueId: 'defense-hol-universal-strength-value', value: castellanStats.holUniversal, min: 0, max: 12 },
    { sliderId: 'courtyard-valkyrie-support-slider', valueId: 'courtyard-valkyrie-support-value', value: castellanStats.courtyardValkyrieSupport, min: 0, max: 15000 }
  ];

  sliders.forEach(s => bindSlider(s.sliderId, s.valueId, {
    value: s.value,
    min: s.min,
    max: s.max,
    step: s.step,
    allowDecimal: s.allowDecimal
  }));

  const confirmValues = [
    { sliderId: 'defense-melee-strength-slider', property: 'melee', targetObject: castellanStats },
    { sliderId: 'defense-ranged-strength-slider', property: 'ranged', targetObject: castellanStats },
    { sliderId: 'defense-universal-strength-slider', property: 'universal', targetObject: castellanStats },
    { sliderId: 'defense-courtyard-strength-slider', property: 'courtyard', targetObject: castellanStats },
    { sliderId: 'wall-unit-limit-slider', property: 'wallUnitLimit', targetObject: castellanStats },
    { sliderId: 'cy-unit-limit-slider', property: 'cyUnitLimit', targetObject: castellanStats },
    { sliderId: 'defense-wall-protection-slider', property: 'wallProtection', targetObject: castellanStats },
    { sliderId: 'defense-moat-protection-slider', property: 'moatProtection', targetObject: castellanStats },
    { sliderId: 'defense-gate-protection-slider', property: 'gateProtection', targetObject: castellanStats },
    { sliderId: 'defense-front-strength-slider', property: 'frontStrength', targetObject: castellanStats },
    { sliderId: 'defense-flanks-strength-slider', property: 'flanksStrength', targetObject: castellanStats },
    { sliderId: 'defense-hol-melee-strength-slider', property: 'holMelee', targetObject: castellanStats },
    { sliderId: 'defense-hol-ranged-strength-slider', property: 'holRanged', targetObject: castellanStats },
    { sliderId: 'defense-hol-universal-strength-slider', property: 'holUniversal', targetObject: castellanStats },
    { sliderId: 'courtyard-valkyrie-support-slider', property: 'courtyardValkyrieSupport', targetObject: castellanStats }
  ];

  bindConfirmButton('confirmCastellanStats', confirmValues, modal, () => {
    writeStoredJson('castellanStats', castellanStats);
    switchSide(currentSide);
    switchDefenseSide(currentSideDefense);
  });

  modal.show();
}
