import * as variables from '../data/variables.js';
import { imageUrl } from '../data/imagePaths.js';
import { switchSide, updateHeaderColor} from './uiWaves.js';
import { itemLevelBadge, runtimeItem } from './itemLevelBadge.js';
import { bindEditableCounts, formatGroupedNumber, renderEditableCount } from './editableCount.js';

let unitEditorState = null;

function unitType(unit) {
  return `Unit${unit.id.replace(/\D/g, '')}`;
}

function unitEffects(unit) {
  const effects = [];
  if (unit.rangedCombatStrength > 0) effects.push(['../../img_base/battle_simulator/ranged-icon.png', `+${unit.rangedCombatStrength}`]);
  if (unit.meleeCombatStrength > 0) effects.push(['../../img_base/battle_simulator/melee-icon.png', `+${unit.meleeCombatStrength}`]);
  if (unit.LootingCapacity > 0) effects.push(['../../img_base/battle_simulator/loot-icon.png', `+${unit.LootingCapacity}`]);
  return effects.map(([icon, value]) => `
    <span class="wave-editor-effect"><img src="${icon}" alt="">${value}</span>
  `).join('');
}

export function initializeUnits(units = variables.units) {
  const unitModalBody = document.querySelector('#unitModal .modal-body');
  if (!unitModalBody) return;

  unitModalBody.innerHTML = `
    <div class="wave-editor-sticky">
      <div class="wave-editor-limit">
        <span id="unit-editor-total-label">0 / 0</span>
      </div>
      <div id="unit-editor-slots" class="wave-editor-slots"></div>
    </div>
    <div id="unit-editor-list" class="wave-editor-list"></div>
  `;

  const list = unitModalBody.querySelector('#unit-editor-list');

  units.forEach((unit, index) => {
    list.insertAdjacentHTML('beforeend', `
      <div class="wave-editor-row" data-unit-index="${index}">
        <div class="wave-editor-name">${unit.name}</div>
        <div class="wave-editor-image-wrap">
          <img src="${imageUrl(unit.image)}" alt="${unit.name}" class="wave-editor-image">
          ${itemLevelBadge(unit)}
        </div>
        <div class="wave-editor-main">
          <div class="wave-editor-controls">
            <button type="button" class="wave-editor-step unit-minus" aria-label="Decrease">&minus;</button>
            <div class="wave-editor-value-wrap">
              <strong class="wave-editor-value"><span class="wave-editor-current-value" contenteditable="true" inputmode="numeric" spellcheck="false">0</span> / <span class="wave-editor-maximum">0</span></strong>
              <input type="range" class="wave-editor-range" min="0" max="0" value="0">
            </div>
            <button type="button" class="wave-editor-step unit-plus" aria-label="Increase">+</button>
          </div>
          <div class="wave-editor-effects">${unitEffects(unit)}</div>
        </div>
      </div>
    `);
  });

  list.addEventListener('click', event => {
    const row = event.target.closest('[data-unit-index]');
    if (!row || !unitEditorState) return;
    const index = Number(row.dataset.unitIndex);
    const current = Number(row.querySelector('.wave-editor-range').value) || 0;
    if (event.target.closest('.unit-minus')) setUnitEditorValue(index, current - 1);
    if (event.target.closest('.unit-plus')) setUnitEditorValue(index, current + 1);
  });
  list.addEventListener('input', event => {
    if (!event.target.matches('.wave-editor-range')) return;
    const row = event.target.closest('[data-unit-index]');
    setUnitEditorValue(Number(row.dataset.unitIndex), Number(event.target.value));
  });
  bindEditableCounts(list, row => Number(row.dataset.unitIndex), setUnitEditorValue);
}

function setUnitEditorValue(unitIndex, requestedValue) {
  const state = unitEditorState;
  if (!state) return;
  const otherTotal = state.slots.reduce((sum, slot, index) =>
    index === state.activeSlot ? sum : sum + (slot.count || 0), 0);
  const value = Math.max(0, Math.min(state.max - otherTotal, requestedValue || 0));
  const slot = state.slots[state.activeSlot];
  slot.type = value > 0 ? unitType(variables.units[unitIndex]) : '';
  slot.count = value;
  renderUnitEditor();
}

function scrollToSelectedUnit() {
  const selectedRow = document.querySelector('#unit-editor-list .wave-editor-row.selected');
  if (selectedRow) selectedRow.scrollIntoView({ block: 'center', behavior: 'auto' });
}

function scrollToUnitOnModalDisplay(modalElement) {
  if (unitEditorState.slots[unitEditorState.activeSlot].count <= 0) return;
  const observer = new MutationObserver(() => {
    if (modalElement.style.display !== 'block') return;
    observer.disconnect();
    scrollToSelectedUnit();
  });
  observer.observe(modalElement, { attributes: true, attributeFilter: ['style'] });
}

function renderUnitEditor() {
  const state = unitEditorState;
  if (!state) return;
  const total = state.slots.reduce((sum, slot) => sum + (slot.count || 0), 0);
  const totalLabel = document.getElementById('unit-editor-total-label');
  totalLabel.textContent = `${total} / ${state.max}`;

  const slotsElement = document.getElementById('unit-editor-slots');
  slotsElement.classList.toggle('courtyard-grid', state.side === 'CY');
  slotsElement.innerHTML = state.slots.map((slot, index) => {
    const image = slot.type ? imageUrl(variables.unitImages?.[slot.type]) : '';
    const unit = runtimeItem(slot.type, variables.units);
    return `<button type="button" class="wave-editor-slot ${image ? '' : 'empty-wave-slot '}${index === state.activeSlot ? 'active' : ''}" data-slot-index="${index}">
      ${image ? `<img src="${image}" alt="">${itemLevelBadge(unit)}<span>${slot.count || 0}</span>` : ''}
    </button>`;
  }).join('');
  slotsElement.querySelectorAll('[data-slot-index]').forEach(button => {
    button.onclick = () => {
      state.activeSlot = Number(button.dataset.slotIndex);
      renderUnitEditor();
      if (state.slots[state.activeSlot].count > 0) scrollToSelectedUnit();
    };
  });

  const active = state.slots[state.activeSlot];
  const otherTotal = total - (active.count || 0);
  const maxForSlot = Math.max(0, state.max - otherTotal);
  document.querySelectorAll('#unit-editor-list [data-unit-index]').forEach(row => {
    const unit = variables.units[Number(row.dataset.unitIndex)];
    const selected = active.type === unitType(unit);
    const value = selected ? active.count || 0 : 0;
    const range = row.querySelector('.wave-editor-range');
    range.max = maxForSlot;
    range.value = value;
    renderEditableCount(row, value, maxForSlot);
    row.querySelector('.unit-minus').disabled = value <= 0;
    row.querySelector('.unit-plus').disabled = value >= maxForSlot;
    row.classList.toggle('selected', selected);
  });
}

export function createUnitIcon(slot) {
  const unitIconContainer = document.createElement('div');
  unitIconContainer.classList.add('unit-icon-container');

  const unitIcon = document.createElement('img');
  const imgName = (variables.unitImages && variables.unitImages[slot.type]) ? variables.unitImages[slot.type] : null;
  unitIcon.src = imageUrl(imgName);
  unitIcon.classList.add('unit-icon');
  unitIcon.alt = slot.type || '';

  const countDisplay = document.createElement('div');
  countDisplay.classList.add('unit-count');
  countDisplay.textContent = slot.count > 0 ? slot.count : '';

  unitIconContainer.appendChild(unitIcon);
  unitIconContainer.insertAdjacentHTML('beforeend', itemLevelBadge(runtimeItem(slot.type, variables.units)));
  unitIconContainer.appendChild(countDisplay);

  return unitIconContainer.outerHTML;
}

export function openUnitModal(slotId, side, waveIndex) {
  const modalEl = document.getElementById('unitModal');
  if (!modalEl) return;
  const modal = new bootstrap.Modal(modalEl);

  const waves = variables.waves || {};
  const wave = waves[side] ? waves[side][waveIndex - 1] : null;

  if (!wave || !wave.slots) {
    console.error(`Wave or slots not found for side: ${side}, waveIndex: ${waveIndex}`);
    return;
  }

  const activeSlot = wave.slots.findIndex(s => s.id === slotId);
  if (activeSlot < 0) {
    console.error(`Slot not found for slotId: ${slotId}`);
    return;
  }

  unitEditorState = {
    side,
    waveIndex,
    wave,
    activeSlot,
    max: side === 'CY'
      ? variables.attackBasics.maxUnitsCY
      : variables.attackBasics.maxUnits[side],
    slots: wave.slots.map(slot => ({ ...slot }))
  };
  renderUnitEditor();
  scrollToUnitOnModalDisplay(modalEl);

  const confirmBtn = document.getElementById('confirmUnits');
  if (confirmBtn) {
    confirmBtn.onclick = function () {
      wave.slots.splice(0, wave.slots.length, ...unitEditorState.slots.map(slot => ({ ...slot })));
      if (!variables.totalUnits[side]) variables.totalUnits[side] = [];
      variables.totalUnits[side][waveIndex - 1] = wave.slots;
      if (side === 'CY') {
        switchSide(variables.currentSide);
      } else {
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

  const supportCombatStrength = waves['Support']?.[0]?.tools?.reduce((total, tool) => {
    const effectData = variables.supportToolEffects?.[tool.type];
    if (!effectData || !tool.count) return total;
    return total
      + (effectData.effect1?.name === 'CombatStrength' ? effectData.effect1.value * tool.count : 0)
      + (effectData.effect2?.name === 'CombatStrength' ? effectData.effect2.value * tool.count : 0);
  }, 0) || 0;

  (slots || []).forEach(slot => {
    if (!slot || !slot.type || !slot.count) return;
    const unitStat = unitStatsList.find(u => u.type === slot.type);
    if (!unitStat) return;

    let ranged = slot.count * (unitStat.rangedCombatStrength || 0);
    let melee = slot.count * (unitStat.meleeCombatStrength || 0);

    const groupStrength = unitStat.strengthGroup === 'beef'
      ? commanderStats.beefStrength
      : unitStat.strengthGroup === 'mead'
        ? commanderStats.meadStrength
        : unitStat.strengthGroup === 'horror'
          ? commanderStats.horrorStrength
          : 0;
    if (unitStat.rangedCombatStrength > unitStat.meleeCombatStrength) {
      ranged += slot.count * (groupStrength || 0);
    } else {
      melee += slot.count * (groupStrength || 0);
    }

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

  if (supportCombatStrength) {
    totalRangedBonusPercentage += supportCombatStrength;
    totalMeleeBonusPercentage += supportCombatStrength;
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
    const icon = stat.type === 'ranged' ? '../../img_base/battle_simulator/ranged-icon.png' : '../../img_base/battle_simulator/melee-icon.png';
    const formattedValue = formatGroupedNumber(stat.value, 0);
    return `<div class="col-6 effect-slot"><img src="${icon}" alt="${stat.type.charAt(0).toUpperCase() + stat.type.slice(1)}" /> +${formattedValue}</div>`;
  }).join('');

  return rows ? `<div class="row">${rows}</div>` : '';
}
