import { defense_tools, defenseSlots, toolSlotRestrictions } from '../../data/variables.js';
import { imageUrl } from '../../data/imagePaths.js';
import { createDefenseToolIcon, getToolIcon, displayDefenseBonuses, calculateTroopDefenseStrength } from '../uiDefense.js';
import { saveDefenseState } from '../../data/defenseState.js';

export function initializeDefenseTools(defense_tools, slotType) {
  const toolModalBody = document.querySelector('#toolModalDefense .modal-body');
  if (!toolModalBody) return;
  toolModalBody.innerHTML = '<div id="defense-tool-editor-list" class="wave-editor-list"></div>';
  const list = toolModalBody.querySelector('#defense-tool-editor-list');

  defense_tools.forEach((tool, index) => {
    if (toolSlotRestrictions[slotType].includes(tool.id)) {
      const levelInfo = tool.availableLevels?.length > 1 ? ` (Lv.${tool.level})` : '';
      const effects = [
        `<span class="wave-editor-effect"><img src="${imageUrl(tool.effectImage1)}" alt="">+${tool.effect1Value}${tool.effect1Value > 149 ? '' : '%'}</span>`
      ];
      if (tool.effect2Value > 0) {
        effects.push(`<span class="wave-editor-effect"><img src="${imageUrl(tool.effectImage2)}" alt="">+${tool.effect2Value}${tool.effect2Value > 149 ? '' : '%'}</span>`);
      }

      list.insertAdjacentHTML('beforeend', `
        <div class="wave-editor-row" data-defense-tool-index="${index}">
          <div class="wave-editor-name">${tool.name}${levelInfo}</div>
          <img src="${imageUrl(tool.image)}" alt="${tool.name}" class="wave-editor-image">
          <div class="wave-editor-main">
            <div class="wave-editor-controls">
              <button type="button" class="wave-editor-step defense-tool-minus" aria-label="Decrease">&minus;</button>
              <div class="wave-editor-value-wrap">
                <strong id="defense_tool${index + 1}-value" class="wave-editor-value">0 / 1</strong>
                <input type="range" id="defense_tool${index + 1}" min="0" max="1" value="0" class="wave-editor-range">
              </div>
              <button type="button" class="wave-editor-step defense-tool-plus" aria-label="Increase">+</button>
            </div>
            <div class="wave-editor-effects">${effects.join('')}</div>
          </div>
        </div>
      `);
    }
  });
}

function renderDefenseToolEditor(selectedIndex, unavailableIndexes = new Set()) {
  document.querySelectorAll('#toolModalDefense [data-defense-tool-index]').forEach(row => {
    const index = Number(row.dataset.defenseToolIndex);
    const selected = index === selectedIndex;
    const unavailable = unavailableIndexes.has(index) && !selected;
    const range = row.querySelector('.wave-editor-range');
    range.value = selected ? 1 : 0;
    range.disabled = unavailable;
    row.querySelector('.wave-editor-value').textContent = `${selected ? 1 : 0} / 1`;
    row.querySelector('.defense-tool-minus').disabled = !selected;
    row.querySelector('.defense-tool-plus').disabled = selected || unavailable;
    row.classList.toggle('selected', selected);
    row.classList.toggle('unavailable', unavailable);
  });
}

export function getUsedCourtyardToolTypes(slots = []) {
  return slots.map(slot => slot?.type).filter(Boolean);
}

export function openDefenseToolsModal(side, toolType, slotIndex) {
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('toolModalDefense'));
  const slotElement = document.getElementById(`tool-slot-${side}-${toolType}-${slotIndex}`);
  initializeDefenseTools(defense_tools, toolType);

  const currentSlotData = toolType === 'cy'
    ? defenseSlots[side].cyTools[slotIndex - 1] || { type: '', count: 0 }
    : defenseSlots[side][`${toolType}Tools`][slotIndex - 1] || { type: '', count: 0 };

  const usedCourtyardTools = toolType === 'cy'
    ? getUsedCourtyardToolTypes(defenseSlots[side].cyTools)
    : [];

  const initialSelectedIndex = defense_tools.findIndex(tool =>
    currentSlotData.type === `DefenseTool${tool.id}`);
  const unavailableIndexes = new Set();
  defense_tools.forEach((tool, index) => {
    if (toolType === 'cy' && usedCourtyardTools.includes(`DefenseTool${tool.id}`) && index !== initialSelectedIndex) {
      unavailableIndexes.add(index);
    }
  });

  document.querySelectorAll('#toolModalDefense [data-defense-tool-index]').forEach(row => {
    const index = Number(row.dataset.defenseToolIndex);
    const range = row.querySelector('.wave-editor-range');
    const setSelection = value => renderDefenseToolEditor(value > 0 ? index : -1, unavailableIndexes);
    range.oninput = () => setSelection(Number(range.value));
    row.querySelector('.defense-tool-minus').onclick = () => setSelection(0);
    row.querySelector('.defense-tool-plus').onclick = () => setSelection(1);
  });
  renderDefenseToolEditor(initialSelectedIndex, unavailableIndexes);

  document.getElementById('confirmDefenseTools').onclick = function () {
    let selectedToolType = '';
    defense_tools.forEach((tool, index) => {
      const toolRange = document.getElementById(`defense_tool${index + 1}`);
      const toolCount = parseInt(toolRange?.value || 0);

      if (toolCount > 0) {
        if (toolSlotRestrictions[toolType].includes(tool.id)) {
          selectedToolType = `DefenseTool${tool.id}`;
        } else {
          alert(`This tool cannot be placed in a ${toolType} slot.`);
          toolRange.value = 0;
          toolRange.disabled = true;
          selectedToolType = '';
        }
      }
    });

    if (selectedToolType === '') {
      if (toolType === 'cy') {
        defenseSlots[side].cyTools[slotIndex - 1] = { type: '', count: 0 };
      } else {
        defenseSlots[side][`${toolType}Tools`][slotIndex - 1] = { type: '', count: 0 };
      }
      slotElement.innerHTML = `<img src="${getToolIcon(toolType)}" alt="${toolType}-tool" class="tool-icon" />`;
    } else {
      if (toolType === 'cy') {
        defenseSlots[side].cyTools[slotIndex - 1] = { type: selectedToolType, count: 1 };
      } else {
        defenseSlots[side][`${toolType}Tools`][slotIndex - 1] = { type: selectedToolType, count: 1 };
      }
      slotElement.innerHTML = createDefenseToolIcon({ type: selectedToolType, count: 1 });
    }

    displayDefenseBonuses(side);
    calculateTroopDefenseStrength(side);
    saveDefenseState();
    modal.hide();
  };

  modal.show();
}
