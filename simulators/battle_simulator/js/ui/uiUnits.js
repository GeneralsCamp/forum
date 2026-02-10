import * as variables from '../data/variables.js';
import { switchSide, updateHeaderColor} from './uiWaves.js';

export function initializeUnits(units = variables.units) {
  const unitModalBody = document.querySelector('#unitModal .modal-body');
  if (!unitModalBody) return;

  unitModalBody.innerHTML = '';

  units.forEach((unit, index) => {
    const effects = [];

    if (unit.travelSpeed > 0) {
      effects.push(`
        <img src="./img/travelSpeed-icon.png" alt="" class="combat-icon" />
        <span class="me-2">+${unit.travelSpeed}</span>
      `);
    }

    if (unit.rangedCombatStrength > 0) {
      effects.push(`
        <img src="./img/ranged-icon.png" alt="" class="combat-icon" />
        <span class="me-2">+${unit.rangedCombatStrength}</span>
      `);
    }

    if (unit.meleeCombatStrength > 0) {
      effects.push(`
        <img src="./img/melee-icon.png" alt="" class="combat-icon" />
        <span class="me-2">+${unit.meleeCombatStrength}</span>
      `);
    }

    if (unit.LootingCapacity > 0) {
      effects.push(`
        <img src="./img/loot-icon.png" alt="" class="combat-icon" />
        <span class="me-2">+${unit.LootingCapacity}</span>
      `);
    }

    let levelInfo = '';
    const ab = variables.attackBasics || {};
    if (unit.id === 'unit1') levelInfo = `(Lv.${ab.meadRangeLevel || 0})`;
    else if (unit.id === 'unit2') levelInfo = `(Lv.${ab.meadMeleeLevel || 0})`;
    else if (unit.id === 'unit7') levelInfo = `(Lv.${ab.beefRangeLevel || 0})`;
    else if (unit.id === 'unit8') levelInfo = `(Lv.${ab.beefMeleeLevel || 0})`;
    else if (unit.id === 'unit9') levelInfo = `(Lv.${ab.beefVeteranRangeLevel || 0})`;
    else if (unit.id === 'unit10') levelInfo = `(Lv.${ab.beefVeteranMeleeLevel || 0})`;

    const unitCard = `
      <div class="col-12">
        <div class="card w-100">
          <div class="modal-card-body mt-1">
            <h6 class="card-title text-center">${unit.name} ${levelInfo}</h6>
            <div class="d-flex align-items-center">
              <div class="me-2">
                <img src="./img/icon_unit${index + 1}.webp" alt="${unit.id}" class="unit-image" />
              </div>
              <div class="flex-grow-1">
                <div class="d-flex align-items-center">
                  <input type="range" id="unit${index + 1}" min="0" value="0" class="form-range me-2" />
                  <span id="unit${index + 1}-value" class="selector-value">0</span>
                </div>
                <div class="mt-2">
                  ${effects.join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    unitModalBody.insertAdjacentHTML('beforeend', unitCard);

    const unitRange = document.getElementById(`unit${index + 1}`);
    if (unitRange) {
      unitRange.addEventListener('input', function () {
        const valueEl = document.getElementById(`unit${index + 1}-value`);
        if (valueEl) valueEl.textContent = this.value;
      });
    }
  });
}

export function createUnitIcon(slot) {
  const unitIconContainer = document.createElement('div');
  unitIconContainer.classList.add('unit-icon-container');

  const unitIcon = document.createElement('img');
  const imgName = (variables.unitImages && variables.unitImages[slot.type]) ? variables.unitImages[slot.type] : null;
  unitIcon.src = imgName ? `./img/${imgName}` : './img/icon_unit0.png';
  unitIcon.classList.add('unit-icon');
  unitIcon.alt = slot.type || '';

  const countDisplay = document.createElement('div');
  countDisplay.classList.add('unit-count');
  countDisplay.textContent = slot.count > 0 ? slot.count : '';

  unitIconContainer.appendChild(unitIcon);
  unitIconContainer.appendChild(countDisplay);

  return unitIconContainer.outerHTML;
}

export function openUnitModal(slotId, side, waveIndex) {
  const modalEl = document.getElementById('unitModal');
  if (!modalEl) return;
  const modal = new bootstrap.Modal(modalEl);

  const slotElement = document.getElementById(slotId);
  const waves = variables.waves || {};
  const wave = waves[side] ? waves[side][waveIndex - 1] : null;

  if (!wave || !wave.slots) {
    console.error(`Wave or slots not found for side: ${side}, waveIndex: ${waveIndex}`);
    return;
  }

  const slot = wave.slots.find(s => s.id === slotId);
  if (!slot) {
    console.error(`Slot not found for slotId: ${slotId}`);
    return;
  }

  const attackBasics = variables.attackBasics || { maxUnits: { front: 0, right: 0 } };
  const maxUnitsInWave = (side === 'front') ? attackBasics.maxUnits.front : attackBasics.maxUnits.right;

  const totalUnitsInWave = wave.slots.reduce((acc, s) => s.id !== slotId ? acc + (s.count || 0) : acc, 0);
  let availableUnits = maxUnitsInWave - totalUnitsInWave;
  if (availableUnits < 0) availableUnits = 0;

  (variables.units || []).forEach((unit, index) => {
    const count = (slot.count > 0 && slot.type === `Unit${unit.id.charAt(unit.id.length - 1)}`) ? slot.count : 0;

    const unitRange = document.getElementById(`unit${index + 1}`);
    const unitValue = document.getElementById(`unit${index + 1}-value`);

    if (unitRange && unitValue) {
      unitRange.value = count;
      unitRange.max = availableUnits;
      unitValue.textContent = count;

      unitRange.oninput = function () {
        unitValue.textContent = this.value;

        (variables.units || []).forEach((otherUnit, otherIndex) => {
          if (otherIndex !== index) {
            const otherRange = document.getElementById(`unit${otherIndex + 1}`);
            const otherValue = document.getElementById(`unit${otherIndex + 1}-value`);
            if (otherRange && otherValue) {
              otherRange.value = 0;
              otherValue.textContent = '0';
            }
          }
        });
      };
    }
  });

  const confirmBtn = document.getElementById('confirmUnits');
  if (confirmBtn) {
    confirmBtn.onclick = function () {
      let totalUnitsInSlot = 0;
      let selectedUnitType = '';

      (variables.units || []).forEach((unit, index) => {
        const unitRange = document.getElementById(`unit${index + 1}`);
        const unitCount = parseInt(unitRange ? unitRange.value : 0, 10) || 0;
        if (unitCount > 0) {
          totalUnitsInSlot += unitCount;
          selectedUnitType = `Unit${unit.id.charAt(unit.id.length - 1)}`;
        }
      });

      if (totalUnitsInWave + totalUnitsInSlot > maxUnitsInWave) {
        alert(`Cannot exceed ${maxUnitsInWave} units in this wave!`);
        return;
      }

      if (slot) {
        slot.type = selectedUnitType || '';
        slot.count = totalUnitsInSlot;

        if (!variables.totalUnits) variables.totalUnits = {};
        if (!variables.totalUnits[side]) variables.totalUnits[side] = [];
        variables.totalUnits[side][waveIndex - 1] = wave.slots;

        if (slotElement) {
          slotElement.innerHTML = (slot.count > 0) ? createUnitIcon(slot) : '+';
        }

        const unitBonuses = summarizeUnitBonuses(wave.slots);
        const bonusElement = document.querySelector(`#units-${side}-${waveIndex} .bonus-summary`);
        if (bonusElement) bonusElement.innerHTML = unitBonuses;

        updateHeaderColor(wave, side, waveIndex);
        switchSide(side);
      }

      modal.hide();
    };
  }

  modal.show();
}

export function summarizeUnitBonuses(slots) {
  const unitStatsList = variables.unitStats || [];
  const commanderStats = variables.commanderStats || {};
  const waves = variables.waves || {};
  const currentSide = variables.currentSide || 'front';

  const totalStats = { ranged: 0, melee: 0 };

  const supportWaveContainsTool3 = (waves['Support'] && waves['Support'][0] && Array.isArray(waves['Support'][0].tools))
    ? waves['Support'][0].tools.some(tool => tool.type === 'Tool3')
    : false;

  (slots || []).forEach(slot => {
    if (!slot || !slot.type || !slot.count) return;
    const unitStat = unitStatsList.find(u => u.type === slot.type);
    if (!unitStat) return;

    let ranged = slot.count * (unitStat.rangedCombatStrength || 0);
    let melee = slot.count * (unitStat.meleeCombatStrength || 0);

    if (slot.type === 'Unit1') ranged += slot.count * (commanderStats.meadStrength || 0);
    if (slot.type === 'Unit2') melee += slot.count * (commanderStats.meadStrength || 0);
    if (slot.type === 'Unit3' || slot.type === 'Unit5') ranged += slot.count * (commanderStats.horrorStrength || 0);
    if (slot.type === 'Unit4' || slot.type === 'Unit6') melee += slot.count * (commanderStats.horrorStrength || 0);

    totalStats.ranged += ranged;
    totalStats.melee += melee;
  });

  let totalRangedBonusPercentage = (commanderStats.ranged || 0) + (commanderStats.holRanged || 0) + (commanderStats.universal || 0) + (commanderStats.holUniversal || 0);
  let totalMeleeBonusPercentage = (commanderStats.melee || 0) + (commanderStats.holMelee || 0) + (commanderStats.universal || 0) + (commanderStats.holUniversal || 0);

  if (currentSide === 'front') {
    totalMeleeBonusPercentage += (commanderStats.frontStrength || 0);
    totalRangedBonusPercentage += (commanderStats.frontStrength || 0);
  } else if (currentSide === 'left' || currentSide === 'right') {
    totalMeleeBonusPercentage += (commanderStats.flanksStrength || 0);
    totalRangedBonusPercentage += (commanderStats.flanksStrength || 0);
  }

  if (supportWaveContainsTool3) {
    totalRangedBonusPercentage += 5;
    totalMeleeBonusPercentage += 5;
  }

  const result = [];

  if (totalStats.ranged > 0) {
    const rangedBonus = totalStats.ranged * (totalRangedBonusPercentage / 100);
    const totalRanged = Math.round(totalStats.ranged + rangedBonus);
    result.push({ type: 'ranged', value: totalRanged });
  }

  if (totalStats.melee > 0) {
    const meleeBonus = totalStats.melee * (totalMeleeBonusPercentage / 100);
    const totalMelee = Math.round(totalStats.melee + meleeBonus);
    result.push({ type: 'melee', value: totalMelee });
  }

  result.sort((a, b) => b.value - a.value);

  const rows = result.map(stat => {
    const icon = stat.type === 'ranged' ? './img/ranged-icon.png' : './img/melee-icon.png';
    const formattedValue = new Intl.NumberFormat().format(stat.value);
    return `<div class="col-6 effect-slot"><img src="${icon}" alt="${stat.type.charAt(0).toUpperCase() + stat.type.slice(1)}" /> +${formattedValue}</div>`;
  }).join('');

  return rows ? `<div class="row">${rows}</div>` : '';
}
