import { bindSlider, bindConfirmButton } from './modalUtils.js';
import { commanderStats, currentSide, units } from '../../data/variables.js';
import { switchSide } from '../uiWaves.js';
import { writeStoredJson } from '../../data/storage.js';
import { imageUrl } from '../../data/imagePaths.js';

export function openCommanderStatsModal() {
  const modalEl = document.getElementById('commanderStatsModal');
  const modal = new bootstrap.Modal(modalEl);
  const finalAssaultUnit = units.find(unit => String(unit.catalogWodID) === '216');
  const finalAssaultImage = modalEl.querySelector('img[alt="final-assault-ranged-units"]');
  if (finalAssaultUnit && finalAssaultImage) finalAssaultImage.src = imageUrl(finalAssaultUnit.image);
  const shieldMaiden = units.find(unit => String(unit.catalogWodID) === '215' && Number(unit.level) === 10);
  const shieldMaidenImage = modalEl.querySelector('img[alt="final-assault-shield-maidens"]');
  if (shieldMaiden && shieldMaidenImage) shieldMaidenImage.src = imageUrl(shieldMaiden.image);

  const sliders = [
    { sliderId: 'melee-strength-slider', valueId: 'melee-strength-value', value: commanderStats.melee, min: 0, max: 5000, allowDecimal: true },
    { sliderId: 'ranged-strength-slider', valueId: 'ranged-strength-value', value: commanderStats.ranged, min: 0, max: 5000, allowDecimal: true },
    { sliderId: 'universal-strength-slider', valueId: 'universal-strength-value', value: commanderStats.universal, min: 0, max: 1000, allowDecimal: true },
    { sliderId: 'front-strength-slider', valueId: 'front-strength-value', value: commanderStats.frontStrength, min: 0, max: 5000, allowDecimal: true },
    { sliderId: 'flanks-strength-slider', valueId: 'flanks-strength-value', value: commanderStats.flanksStrength, min: 0, max: 5000, allowDecimal: true },
    { sliderId: 'courtyard-strength-slider', valueId: 'courtyard-strength-value', value: commanderStats.courtyard, min: 0, max: 5000, allowDecimal: true },
    { sliderId: 'wall-reduction-slider', valueId: 'wall-reduction-value', value: commanderStats.wallReduction, min: 0, max: 2500, allowDecimal: true },
    { sliderId: 'moat-reduction-slider', valueId: 'moat-reduction-value', value: commanderStats.moatReduction, min: 0, max: 2500, allowDecimal: true },
    { sliderId: 'gate-reduction-slider', valueId: 'gate-reduction-value', value: commanderStats.gateReduction, min: 0, max: 2500, allowDecimal: true },
    { sliderId: 'beef-unit-strength-slider', valueId: 'beef-unit-strength-value', value: commanderStats.beefStrength, min: 0, max: 30 },
    { sliderId: 'mead-unit-strength-slider', valueId: 'mead-unit-strength-value', value: commanderStats.meadStrength, min: 0, max: 30 },
    { sliderId: 'horror-unit-strength-slider', valueId: 'horror-unit-strength-value', value: commanderStats.horrorStrength, min: 0, max: 40 },
    { sliderId: 'hol-melee-strength-slider', valueId: 'hol-melee-strength-value', value: commanderStats.holMelee, min: 0, max: 13 },
    { sliderId: 'hol-ranged-strength-slider', valueId: 'hol-ranged-strength-value', value: commanderStats.holRanged, min: 0, max: 13 },
    { sliderId: 'hol-universal-strength-slider', valueId: 'hol-universal-strength-value', value: commanderStats.holUniversal, min: 0, max: 12 },
    { sliderId: 'final-assault-ranged-units-slider', valueId: 'final-assault-ranged-units-value', value: commanderStats.finalAssaultRangedUnits, min: 0, max: 1500 },
    { sliderId: 'final-assault-shield-maidens-slider', valueId: 'final-assault-shield-maidens-value', value: commanderStats.finalAssaultShieldMaidens, min: 0, max: 1050 }
  ];

  sliders.forEach(s => bindSlider(s.sliderId, s.valueId, {
    value: s.value,
    min: s.min,
    max: s.max,
    allowDecimal: s.allowDecimal
  }));

  const confirmValues = [
    { sliderId: 'melee-strength-slider', property: 'melee', targetObject: commanderStats },
    { sliderId: 'ranged-strength-slider', property: 'ranged', targetObject: commanderStats },
    { sliderId: 'universal-strength-slider', property: 'universal', targetObject: commanderStats },
    { sliderId: 'courtyard-strength-slider', property: 'courtyard', targetObject: commanderStats },
    { sliderId: 'wall-reduction-slider', property: 'wallReduction', targetObject: commanderStats },
    { sliderId: 'moat-reduction-slider', property: 'moatReduction', targetObject: commanderStats },
    { sliderId: 'gate-reduction-slider', property: 'gateReduction', targetObject: commanderStats },
    { sliderId: 'beef-unit-strength-slider', property: 'beefStrength', targetObject: commanderStats },
    { sliderId: 'mead-unit-strength-slider', property: 'meadStrength', targetObject: commanderStats },
    { sliderId: 'horror-unit-strength-slider', property: 'horrorStrength', targetObject: commanderStats },
    { sliderId: 'hol-melee-strength-slider', property: 'holMelee', targetObject: commanderStats },
    { sliderId: 'hol-ranged-strength-slider', property: 'holRanged', targetObject: commanderStats },
    { sliderId: 'hol-universal-strength-slider', property: 'holUniversal', targetObject: commanderStats },
    { sliderId: 'front-strength-slider', property: 'frontStrength', targetObject: commanderStats },
    { sliderId: 'flanks-strength-slider', property: 'flanksStrength', targetObject: commanderStats },
    { sliderId: 'final-assault-ranged-units-slider', property: 'finalAssaultRangedUnits', targetObject: commanderStats },
    { sliderId: 'final-assault-shield-maidens-slider', property: 'finalAssaultShieldMaidens', targetObject: commanderStats }
  ];

  bindConfirmButton('confirmCommanderStats', confirmValues, modal, () => {
    switchSide(currentSide);
    writeStoredJson('commanderStats', commanderStats);
  });

  modal.show();
}
