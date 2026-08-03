import { defense_units, defenseSlots, castellanStats } from '../../data/variables.js';
import { imageUrl } from '../../data/imagePaths.js';
import { calculateTroopDefenseStrength, createDefenseUnitIcon } from '../uiDefense.js';
import { saveDefenseState } from '../../data/defenseState.js';
import { itemLevelBadge } from '../itemLevelBadge.js';
import { bindEditableCounts, renderEditableCount } from '../editableCount.js';

export function initializeDefenseUnits(defense_units) {
  const unitModalBody = document.querySelector('#unitModalDefense .modal-body');
  if (!unitModalBody) return;
  unitModalBody.innerHTML = '<div id="defense-unit-editor-list" class="wave-editor-list"></div>';
  const list = unitModalBody.querySelector('#defense-unit-editor-list');

  defense_units.forEach((unit, index) => {
    const effects = [];
    if (unit.meleeDefenseStrength > 0) {
      effects.push(`<span class="wave-editor-effect"><img src="../../img_base/battle_simulator/castellan-modal1.png" alt="">+${unit.meleeDefenseStrength}</span>`);
    }
    if (unit.rangedDefenseStrength > 0) {
      effects.push(`<span class="wave-editor-effect"><img src="../../img_base/battle_simulator/castellan-modal2.png" alt="">+${unit.rangedDefenseStrength}</span>`);
    }

    list.insertAdjacentHTML('beforeend', `
      <div class="wave-editor-row" data-defense-unit-index="${index}">
        <div class="wave-editor-name">${unit.name}</div>
        <div class="wave-editor-image-wrap">
          <img src="${imageUrl(unit.image)}" alt="${unit.name}" class="wave-editor-image">
          ${itemLevelBadge(unit)}
        </div>
        <div class="wave-editor-main">
          <div class="wave-editor-controls">
            <button type="button" class="wave-editor-step defense-unit-minus" aria-label="Decrease">&minus;</button>
            <div class="wave-editor-value-wrap">
              <strong id="defense_unit${index + 1}-value" class="wave-editor-value"><span class="wave-editor-current-value" contenteditable="true" inputmode="numeric" spellcheck="false">0</span> / <span class="wave-editor-maximum">0</span></strong>
              <input type="range" id="defense_unit${index + 1}" min="0" max="0" value="0" class="wave-editor-range">
            </div>
            <button type="button" class="wave-editor-step defense-unit-plus" aria-label="Increase">+</button>
          </div>
          <div class="wave-editor-effects">${effects.join('')}</div>
        </div>
      </div>
    `);
  });
}

function renderDefenseUnitEditor(selectedIndex, selectedValue, maximum) {
  document.querySelectorAll('#unitModalDefense [data-defense-unit-index]').forEach(row => {
    const index = Number(row.dataset.defenseUnitIndex);
    const value = index === selectedIndex ? selectedValue : 0;
    const range = row.querySelector('.wave-editor-range');
    range.max = maximum;
    range.value = value;
    renderEditableCount(row, value, maximum);
    row.querySelector('.defense-unit-minus').disabled = value <= 0;
    row.querySelector('.defense-unit-plus').disabled = value >= maximum;
    row.classList.toggle('selected', value > 0);
  });
}

export function openDefenseUnitsModal(side, slotNumber) {
  const modalElement = document.getElementById('unitModalDefense');
  const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
  const slotElement = document.getElementById(`unit-slot-${side}-${slotNumber}`);

  const wallMaxUnits = castellanStats.wallUnitLimit;
  const cyMaxUnits = castellanStats.cyUnitLimit;
  const isCourtyard = side === 'cy';

  const totalUnitsInDefense = Object.keys(defenseSlots).reduce((total, key) => {
    if (key !== 'cy') {
      return total + defenseSlots[key].units.reduce((acc, slot) => acc + (slot?.count || 0), 0);
    }
    return total;
  }, 0);

  const totalUnitsInCourtyard = (defenseSlots.cy?.units || []).reduce(
    (acc, slot) => acc + (slot?.count || 0),
    0
  );

  const currentSlotData = defenseSlots[side].units[slotNumber - 1] || { type: '', count: 0 };
  const currentSlotUnitCount = currentSlotData.count;
  initializeDefenseUnits(defense_units, currentSlotData);
  const availableUnits = Math.max(0, isCourtyard
    ? cyMaxUnits - totalUnitsInCourtyard + currentSlotUnitCount
    : wallMaxUnits - totalUnitsInDefense + currentSlotUnitCount);

  const initialSelectedIndex = defense_units.findIndex(unit =>
    currentSlotData.type === `DefenseUnit${unit.id.replace(/\D/g, '')}`);
  const setSelection = (index, requestedValue) => {
    const value = Math.max(0, Math.min(availableUnits, requestedValue || 0));
    renderDefenseUnitEditor(value > 0 ? index : -1, value, availableUnits);
  };

  document.querySelectorAll('#unitModalDefense [data-defense-unit-index]').forEach(row => {
    const index = Number(row.dataset.defenseUnitIndex);
    const range = row.querySelector('.wave-editor-range');
    range.oninput = () => setSelection(index, Number(range.value));
    row.querySelector('.defense-unit-minus').onclick = () => setSelection(index, Number(range.value) - 1);
    row.querySelector('.defense-unit-plus').onclick = () => setSelection(index, Number(range.value) + 1);
  });
  bindEditableCounts(
    document.getElementById('defense-unit-editor-list'),
    row => Number(row.dataset.defenseUnitIndex),
    setSelection
  );
  renderDefenseUnitEditor(initialSelectedIndex, currentSlotUnitCount, availableUnits);
  document.getElementById('confirmDefenseUnits').onclick = function () {
    let totalUnitsInSlot = 0;
    let selectedUnitType = '';

    defense_units.forEach((unit, index) => {
      const unitRange = document.getElementById(`defense_unit${index + 1}`);
      const unitCount = parseInt(unitRange?.value || 0);
      if (unitCount > 0) {
        totalUnitsInSlot += unitCount;
        selectedUnitType = `DefenseUnit${unit.id.replace(/\D/g, '')}`;
      }
    });

    defenseSlots[side].units[slotNumber - 1] = {
      type: selectedUnitType,
      count: totalUnitsInSlot
    };

    slotElement.innerHTML = totalUnitsInSlot > 0
      ? createDefenseUnitIcon({ type: selectedUnitType, count: totalUnitsInSlot })
      : '+';
    slotElement.classList.toggle('empty-wave-slot', totalUnitsInSlot <= 0);

    calculateTroopDefenseStrength(side);
    saveDefenseState();
    modal.hide();
  };

  if (initialSelectedIndex >= 0 && currentSlotUnitCount > 0) {
    modalElement.addEventListener('shown.bs.modal', () => {
      modalElement.querySelector(`[data-defense-unit-index="${initialSelectedIndex}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'auto' });
    }, { once: true });
  }
  modal.show();
}
