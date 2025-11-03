import { bindSlider, bindConfirmButton } from './modalUtils.js';
import { attackBasics, currentSide, setUnitStats } from '../../data/variables.js';
import { switchSide } from '../uiWaves.js';
import * as variables from '../../data/variables.js';
import { loadData } from '../../data/dataLoader.js';

export function openBasicsModal() {
  const modalEl = document.getElementById('basicsModal');
  const modal = new bootstrap.Modal(modalEl);

  const sliders = [
    { sliderId: 'waves-slider', valueId: 'waves-value', value: attackBasics.maxWaves, min: 4, max: 20 },
    { sliderId: 'front-unit-slider', valueId: 'front-unit-value', value: attackBasics.maxUnits.front, min: 192, max: 1600 },
    { sliderId: 'flank-unit-slider', valueId: 'flank-unit-value', value: attackBasics.maxUnits.left, min: 64, max: 800 },
    { sliderId: 'courtyard-unit-slider', valueId: 'courtyard-unit-value', value: attackBasics.maxUnitsCY, min: 2089, max: 6000 },
    { sliderId: 'flank-tool-slider', valueId: 'flank-tool-value', value: attackBasics.maxTools.left, min: 40, max: 50 },
    { sliderId: 'mead-range-level-slider', valueId: 'mead-range-level-value', value: attackBasics.meadRangeLevel, min: 0, max: 10 },
    { sliderId: 'mead-melee-level-slider', valueId: 'mead-melee-level-value', value: attackBasics.meadMeleeLevel, min: 0, max: 10 },
    { sliderId: 'beef-range-level-slider', valueId: 'beef-range-level-value', value: attackBasics.beefRangeLevel, min: 0, max: 10 },
    { sliderId: 'beef-melee-level-slider', valueId: 'beef-melee-level-value', value: attackBasics.beefMeleeLevel, min: 0, max: 10 },
    { sliderId: 'beef-veteran-range-level-slider', valueId: 'beef-veteran-range-level-value', value: attackBasics.beefVeteranRangeLevel, min: 0, max: 10 },
    { sliderId: 'beef-veteran-melee-level-slider', valueId: 'beef-veteran-melee-level-value', value: attackBasics.beefVeteranMeleeLevel, min: 0, max: 10 }
  ];

  sliders.forEach(s => bindSlider(s.sliderId, s.valueId, { value: s.value, min: s.min, max: s.max }));

  const confirmValues = [
    { sliderId: 'waves-slider', property: 'maxWaves', targetObject: attackBasics },
    { sliderId: 'front-unit-slider', property: 'maxUnits.front', targetObject: attackBasics },
    { sliderId: 'flank-unit-slider', property: 'maxUnits.left', targetObject: attackBasics },
    { sliderId: 'courtyard-unit-slider', property: 'maxUnitsCY', targetObject: attackBasics },
    { sliderId: 'flank-tool-slider', property: 'maxTools.left', targetObject: attackBasics },
    { sliderId: 'mead-range-level-slider', property: 'meadRangeLevel', targetObject: attackBasics },
    { sliderId: 'mead-melee-level-slider', property: 'meadMeleeLevel', targetObject: attackBasics },
    { sliderId: 'beef-range-level-slider', property: 'beefRangeLevel', targetObject: attackBasics },
    { sliderId: 'beef-melee-level-slider', property: 'beefMeleeLevel', targetObject: attackBasics },
    { sliderId: 'beef-veteran-range-level-slider', property: 'beefVeteranRangeLevel', targetObject: attackBasics },
    { sliderId: 'beef-veteran-melee-level-slider', property: 'beefVeteranMeleeLevel', targetObject: attackBasics }
  ];

  bindConfirmButton('confirmBasics', confirmValues, modal, () => {
    updateUnitStrengths();
    loadData();
    switchSide(currentSide);
    localStorage.setItem('attackBasics', JSON.stringify(attackBasics));
  });

  modal.show();
}

function updateUnitStrengths() {
  variables.units.forEach(unit => {
    if (unit.id === "unit2") {
      unit.meleeCombatStrength = 225 + (variables.attackBasics.meadMeleeLevel * 10);
      unit.LootingCapacity = 43 + (variables.attackBasics.meadMeleeLevel * 2);
    }
    if (unit.id === "unit1") {
      unit.rangedCombatStrength = 210 + (variables.attackBasics.meadRangeLevel * 10);
      unit.LootingCapacity = 40 + (variables.attackBasics.meadRangeLevel * 2);
    }
    if (unit.id === "unit8") {
      unit.meleeCombatStrength = 370 + (variables.attackBasics.beefMeleeLevel * 5);
    }
    if (unit.id === "unit7") {
      unit.rangedCombatStrength = 390 + (variables.attackBasics.beefRangeLevel * 5);
    }
    if (unit.id === "unit10") {
      unit.meleeCombatStrength = 430 + (variables.attackBasics.beefVeteranMeleeLevel * 5);
    }
    if (unit.id === "unit9") {
      unit.rangedCombatStrength = 450 + (variables.attackBasics.beefVeteranRangeLevel * 5);
    }
  });

  const stats = variables.units.map(unit => ({
    type: `Unit${unit.id.charAt(unit.id.length - 1)}`,
    rangedCombatStrength: unit.rangedCombatStrength || 0,
    meleeCombatStrength: unit.meleeCombatStrength || 0,
    image: unit.image
  }));

  setUnitStats(stats);
}