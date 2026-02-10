import * as variables from '../data/variables.js';
import { createUnitIcon } from './uiUnits.js';
import { switchSide } from './uiWaves.js';

export function createCourtyardAssaultCard() {
  if (!variables.waves['CY']) {
    variables.waves['CY'] = [{
      slots: variables.totalUnits['CY']?.[0]?.slots || Array.from({ length: 8 }, (_, i) => ({ type: '', count: 0, id: `unit-slot-CY-${i + 1}` }))
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
            <img src="./img/troops-icon.webp" alt="Units"/>
          </span>
        </div>
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
          <img src="./img/troops-icon.webp" alt="Units" style="width:20px;height:20px;vertical-align:middle;" />
          <span class="units">Units ${wave.slots.reduce((acc, s) => acc + s.count, 0)} / ${maxUnitsCY}</span>
          <div class="row ms-1 mt-1">
            ${Array.from({ length: 4 }, (_, i) => `<div class="unit-slot" id="unit-slot-CY-${i + 1}">+</div>`).join('')}
          </div>
          <div class="row ms-1 mt-1">
            ${Array.from({ length: 4 }, (_, i) => `<div class="unit-slot" id="unit-slot-CY-${i + 5}">+</div>`).join('')}
          </div>
        </div>
        <div class="col-4">
          <div class="bonus-summary mt-4">${summarizeCourtyardUnitBonuses()}</div>
        </div>
      </div>
    </div>
  `;

  courtyardCard.append(courtyardHeader, courtyardBody);
  document.getElementById('wave-container').appendChild(courtyardCard);

  const button = courtyardHeader.querySelector('button');
  const arrow = courtyardHeader.querySelector('.arrow');

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
  });

  courtyardBody.addEventListener('hide.bs.collapse', () => {
    courtyardHeader.classList.remove('collapsed');
    variables.openWaves['CY'] = false;
    courtyardHeader.style.backgroundColor = getCourtyardHeaderColor();
  });

  if (variables.openWaves['CY']) {
    courtyardBody.classList.add('show');
    courtyardHeader.classList.add('collapsed');
  }

  updateCourtyardHeaderColor();
}

export function openCourtyardUnitModal(slotId) {
  const modal = new bootstrap.Modal(document.getElementById('unitModal'));
  const slotElement = document.getElementById(slotId);
  const wave = variables.waves['CY'][0];

  if (!wave || !wave.slots) {
    console.error('Courtyard wave or slots not found.');
    return;
  }

  const slot = wave.slots.find(s => s.id === slotId);
  if (!slot) {
    console.error(`Slot not found for slotId: ${slotId}`);
    return;
  }

  const maxUnitsInCourtyard = variables.attackBasics.maxUnitsCY;
  const totalUnitsInCourtyard = wave.slots.reduce((acc, s) => s.id !== slotId ? acc + s.count : acc, 0);
  let availableUnits = maxUnitsInCourtyard - totalUnitsInCourtyard;

  variables.units.forEach((unit, index) => {
    const count = slot.count > 0 && slot.type === `Unit${unit.id.charAt(unit.id.length - 1)}` ? slot.count : 0;
    const unitRange = document.getElementById(`unit${index + 1}`);
    const unitValue = document.getElementById(`unit${index + 1}-value`);

    if (unitRange && unitValue) {
      unitRange.value = count;
      unitRange.max = availableUnits;
      unitValue.textContent = count;

      unitRange.addEventListener('input', function () {
        unitValue.textContent = this.value;
        variables.units.forEach((otherUnit, otherIndex) => {
          if (otherIndex !== index) {
            const otherRange = document.getElementById(`unit${otherIndex + 1}`);
            const otherValue = document.getElementById(`unit${otherIndex + 1}-value`);
            if (otherRange && otherValue) {
              otherRange.value = 0;
              otherValue.textContent = 0;
            }
          }
        });
      });
    }
  });

  document.getElementById('confirmUnits').onclick = function () {
    let totalUnitsInSlot = 0;
    let selectedUnitType = '';

    variables.units.forEach((unit, index) => {
      const unitRange = document.getElementById(`unit${index + 1}`);
      const unitCount = parseInt(unitRange?.value || 0, 10);
      if (unitCount > 0) {
        totalUnitsInSlot += unitCount;
        selectedUnitType = `Unit${unit.id.charAt(unit.id.length - 1)}`;
      }
    });

    if (totalUnitsInCourtyard + totalUnitsInSlot > maxUnitsInCourtyard) {
      alert(`Cannot exceed ${maxUnitsInCourtyard} units in the Courtyard!`);
      return;
    }

    slot.type = selectedUnitType || '';
    slot.count = totalUnitsInSlot;

    if (!variables.totalUnits['CY']) variables.totalUnits['CY'] = [];
    variables.totalUnits['CY'][0] = wave.slots;

    slotElement.innerHTML = slot.count > 0 ? createUnitIcon(slot) : '+';
    const bonusElement = document.querySelector(`#units-CY .bonus-summary`);
    if (bonusElement) bonusElement.innerHTML = summarizeCourtyardUnitBonuses();

    updateCourtyardHeaderColor();
    switchSide(variables.currentSide);

    modal.hide();
  };

  modal.show();
}

export function summarizeCourtyardUnitBonuses() {
  if (!variables.waves['CY'] || !variables.waves['CY'][0].slots) return '';

  const totalStats = { ranged: 0, melee: 0 };
  const wave = variables.waves['CY'][0];
  const supportTool3 = variables.waves['Support']?.[0]?.tools?.some(tool => tool.type === 'Tool3');

  wave.slots.forEach(slot => {
    const unitStat = variables.unitStats.find(u => u.type === slot.type);
    if (!unitStat) return;

    let ranged = slot.count * unitStat.rangedCombatStrength;
    let melee = slot.count * unitStat.meleeCombatStrength;

    if (slot.type === 'Unit1') ranged += slot.count * variables.commanderStats.meadStrength;
    if (slot.type === 'Unit2') melee += slot.count * variables.commanderStats.meadStrength;
    if (slot.type === 'Unit3' || slot.type === 'Unit5') ranged += slot.count * variables.commanderStats.horrorStrength;
    if (slot.type === 'Unit4' || slot.type === 'Unit6') melee += slot.count * variables.commanderStats.horrorStrength;

    totalStats.ranged += ranged;
    totalStats.melee += melee;
  });

  let totalRangedBonus = variables.commanderStats.ranged + variables.commanderStats.holRanged + variables.commanderStats.universal + variables.commanderStats.holUniversal;
  let totalMeleeBonus = variables.commanderStats.melee + variables.commanderStats.holMelee + variables.commanderStats.universal + variables.commanderStats.holUniversal;

  if (supportTool3) {
    totalRangedBonus += 5;
    totalMeleeBonus += 5;
  }

  const result = [];
  if (totalStats.ranged > 0) result.push({ type: 'ranged', value: Math.round(totalStats.ranged * (1 + totalRangedBonus / 100)), icon: './img/ranged-icon.png' });
  if (totalStats.melee > 0) result.push({ type: 'melee', value: Math.round(totalStats.melee * (1 + totalMeleeBonus / 100)), icon: './img/melee-icon.png' });

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
