import * as variables from '../data/variables.js';
import { saveAttackState } from '../data/attackState.js';
import { createUnitIcon, openUnitModal } from './uiUnits.js';

export function createCourtyardAssaultCard(onClear) {
  if (!variables.waves['CY']) {
    const savedCourtyardSlots = variables.totalUnits.CY?.[0];
    variables.waves['CY'] = [{
      slots: (Array.isArray(savedCourtyardSlots) ? savedCourtyardSlots : savedCourtyardSlots?.slots)
        || Array.from({ length: 8 }, (_, i) => ({ type: '', count: 0, id: `unit-slot-CY-${i + 1}` }))
    }];
  }

  const wave = variables.waves['CY'][0];
  let totalUnitsInCourtyard = wave.slots.reduce((acc, s) => acc + s.count, 0);
  const maxUnitsCY = variables.attackBasics.maxUnitsCY;

  if (totalUnitsInCourtyard > maxUnitsCY) {
    let excess = totalUnitsInCourtyard - maxUnitsCY;
    wave.slots.forEach(slot => {
      if (excess > 0 && slot.count > 0) {
        const toRemove = Math.min(slot.count, excess);
        slot.count -= toRemove;
        excess -= toRemove;
      }
    });
  }

  const courtyardCard = document.createElement('div');
  courtyardCard.classList.add('card');

  const courtyardHeader = document.createElement('div');
  courtyardHeader.classList.add('card-header');
  courtyardHeader.id = 'headingCY';

  const isOpen = variables.openWaves['CY'];
  courtyardHeader.innerHTML = `
    <h6 class="mb-0 d-flex justify-content-between align-items-center">
      <button class="btn btn-link ${isOpen ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse"
              data-bs-target="#collapseCY" aria-expanded="${isOpen ? 'true' : 'false'}" aria-controls="collapseCY"
              style="width:100%; display:flex; justify-content:space-between; align-items:center;">
        <div class="left-content">Courtyard Assault</div>
        <div class="right-content ms-auto">
          <span class="units">
            ${wave.slots.reduce((acc, s) => acc + s.count, 0)} / ${maxUnitsCY}
            <img src="../../img_base/battle_simulator/troops-icon.webp" alt="Units"/>
          </span>
        </div>
      </button>
      <button type="button" class="wave-clear-button" aria-label="Clear wave">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8"></circle>
          <path d="M6.5 17.5L17.5 6.5"></path>
        </svg>
      </button>
      <span class="arrow" aria-hidden="true" style="transform: ${isOpen ? 'rotate(90deg)' : 'rotate(0deg)'};"></span>
    </h6>
  `;

  courtyardHeader.style.backgroundColor = isOpen ? '' : getCourtyardHeaderColor();

  const courtyardBody = document.createElement('div');
  courtyardBody.id = 'collapseCY';
  courtyardBody.classList.add('collapse');
  courtyardBody.setAttribute('aria-labelledby', 'headingCY');
  courtyardBody.innerHTML = `
    <div class="card-body">
      <div class="row d-flex align-items-start">
        <div class="col-8 bugfix">
          <img src="../../img_base/battle_simulator/troops-icon.webp" alt="Units" style="width:15px;height:15px;vertical-align:middle;" />
          <span class="units">Units ${wave.slots.reduce((acc, s) => acc + s.count, 0)} / ${maxUnitsCY}</span>
          <div class="row ms-1 mt-1">
            ${Array.from({ length: 4 }, (_, i) => `<div class="unit-slot${wave.slots[i]?.count > 0 ? '' : ' empty-wave-slot'}" id="unit-slot-CY-${i + 1}">+</div>`).join('')}
          </div>
          <div class="row ms-1 mt-1">
            ${Array.from({ length: 4 }, (_, i) => `<div class="unit-slot${wave.slots[i + 4]?.count > 0 ? '' : ' empty-wave-slot'}" id="unit-slot-CY-${i + 5}">+</div>`).join('')}
          </div>
        </div>
        <div class="col-4">
          <div class="bonus-summary mt-4" id="courtyard-unit-bonuses">${summarizeCourtyardUnitBonuses()}</div>
        </div>
      </div>
    </div>
  `;

  courtyardCard.append(courtyardHeader, courtyardBody);
  document.getElementById('wave-container').appendChild(courtyardCard);

  const button = courtyardHeader.querySelector('button');
  const clearButton = courtyardHeader.querySelector('.wave-clear-button');
  const arrow = courtyardHeader.querySelector('.arrow');

  clearButton.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    wave.slots.forEach(slot => {
      slot.type = '';
      slot.count = 0;
    });
    if (!variables.totalUnits.CY) variables.totalUnits.CY = [];
    variables.totalUnits.CY[0] = wave.slots.map(slot => ({ ...slot }));
    saveAttackState();
    onClear?.();
  });

  button.addEventListener('click', () => {
    const collapsed = button.classList.contains('collapsed');
    arrow.style.transform = collapsed ? 'rotate(0deg)' : 'rotate(90deg)';
    courtyardHeader.style.backgroundColor = collapsed ? getCourtyardHeaderColor() : '';
  });

  courtyardBody.querySelectorAll('.unit-slot').forEach((slotEl, i) => {
    const slotData = wave.slots[i];
    if (slotData.count > 0) slotEl.innerHTML = createUnitIcon(slotData);
    slotEl.addEventListener('click', () => openCourtyardUnitModal(slotEl.id));
  });

  courtyardBody.addEventListener('show.bs.collapse', () => {
    courtyardHeader.classList.add('collapsed');
    variables.openWaves['CY'] = true;
    courtyardHeader.style.backgroundColor = '';
    saveAttackState();
  });

  courtyardBody.addEventListener('hide.bs.collapse', () => {
    courtyardHeader.classList.remove('collapsed');
    variables.openWaves['CY'] = false;
    courtyardHeader.style.backgroundColor = getCourtyardHeaderColor();
    saveAttackState();
  });

  if (variables.openWaves['CY']) {
    courtyardBody.classList.add('show');
    courtyardHeader.classList.add('collapsed');
  }

  updateCourtyardHeaderColor();
}

export function openCourtyardUnitModal(slotId) {
  openUnitModal(slotId, 'CY', 1);
}

export function summarizeCourtyardUnitBonuses() {
  if (!variables.waves['CY'] || !variables.waves['CY'][0].slots) return '';

  const totalStats = { ranged: 0, melee: 0 };
  const wave = variables.waves['CY'][0];
  const supportEffects = variables.getSupportEffectTotals();
  const supportCourtyardStrength = (supportEffects.CombatStrength || 0) + (supportEffects.YardStrength || 0);

  wave.slots.forEach(slot => {
    const unitStat = variables.unitStats.find(u => u.type === slot.type);
    if (!unitStat) return;

    let ranged = slot.count * unitStat.rangedCombatStrength;
    let melee = slot.count * unitStat.meleeCombatStrength;

    const groupStrength = unitStat.strengthGroup === 'mead'
      ? variables.commanderStats.meadStrength
      : unitStat.strengthGroup === 'horror'
        ? variables.commanderStats.horrorStrength
        : 0;
    if (unitStat.rangedCombatStrength > unitStat.meleeCombatStrength) {
      ranged += slot.count * (groupStrength || 0);
    } else {
      melee += slot.count * (groupStrength || 0);
    }

    totalStats.ranged += ranged;
    totalStats.melee += melee;
  });

  let totalRangedBonus = variables.commanderStats.ranged + variables.commanderStats.holRanged + variables.commanderStats.universal + variables.commanderStats.holUniversal + variables.commanderStats.courtyard;
  let totalMeleeBonus = variables.commanderStats.melee + variables.commanderStats.holMelee + variables.commanderStats.universal + variables.commanderStats.holUniversal + variables.commanderStats.courtyard;

  if (supportCourtyardStrength) {
    totalRangedBonus += supportCourtyardStrength;
    totalMeleeBonus += supportCourtyardStrength;
  }

  const result = [];
  if (totalStats.ranged > 0) result.push({ type: 'ranged', value: Math.round(totalStats.ranged * (1 + totalRangedBonus / 100)), icon: '../../img_base/battle_simulator/ranged-icon.png' });
  if (totalStats.melee > 0) result.push({ type: 'melee', value: Math.round(totalStats.melee * (1 + totalMeleeBonus / 100)), icon: '../../img_base/battle_simulator/melee-icon.png' });

  result.sort((a, b) => b.value - a.value);

  return result.length
    ? `<div class="row">${result.map(stat => `<div class="col-12 effect-slot"><img src="${stat.icon}" alt="${stat.type}" /> +${new Intl.NumberFormat().format(stat.value)}</div>`).join('')}</div>`
    : '';
}

export function getCourtyardHeaderColor() {
  const slots = variables.waves['CY']?.[0]?.slots || [];
  return slots.some(s => s.count > 0) ? 'rgb(255, 255, 150)' : '';
}

function updateCourtyardHeaderColor() {
  const header = document.getElementById('headingCY');
  if (header) header.style.backgroundColor = getCourtyardHeaderColor();
}
