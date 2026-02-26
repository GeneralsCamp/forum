import { defense_tools, defenseSlots, toolSlotRestrictions } from '../../data/variables.js';
import { createDefenseToolIcon, getToolIcon, displayDefenseBonuses, calculateTroopDefenseStrength } from '../uiDefense.js';
import { saveDefenseState } from '../../data/defenseState.js';

export function initializeDefenseTools(defense_tools, slotType) {
  const toolModalBody = document.querySelector('#toolModalDefense .modal-body');
  toolModalBody.innerHTML = '';

  defense_tools.forEach((tool, index) => {
    if (toolSlotRestrictions[slotType].includes(tool.id)) {
      const toolCard = `
      <div class="col-12">
          <div class="card w-100">
              <div class="modal-card-body mt-1">
                  <h6 class="card-title text-center">${tool.name}</h6>
                  <div class="d-flex align-items-center">
                      <div class="me-2">
                          <img src="../../img_base/battle_simulator/${tool.image}" alt="${tool.name}" class="tool-image" />
                      </div>
                      <div class="flex-grow-1">
                          <div class="d-flex align-items-center">
                              <input type="range" id="defense_tool${index + 1}" min="0" max="1" value="0" class="form-range me-2" />
                              <span id="defense_tool${index + 1}-value" class="selector-value">0</span>
                          </div>
                          <div class="mt-2 d-flex align-items-center">
                              <div class="me-2">
                                  <img src="../../img_base/battle_simulator/${tool.effectImage1}" alt="" class="combat-icon" />
                                  <span>+${tool.effect1Value}${tool.effect1Value > 149 ? '' : '%'} </span>
                              </div>
                              ${tool.effect2Value > 0 ? `
                              <div class="me-2">
                                  <img src="../../img_base/battle_simulator/${tool.effectImage2}" alt="" class="combat-icon" />
                                  <span class="me-2">+${tool.effect2Value}${tool.effect2Value > 149 ? '' : '%'} </span>
                              </div>` : ''}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>
      `;
      toolModalBody.insertAdjacentHTML('beforeend', toolCard);

      const toolRange = document.getElementById(`defense_tool${index + 1}`);
      const toolValue = document.getElementById(`defense_tool${index + 1}-value`);

      toolRange.addEventListener('input', function () {
        toolValue.textContent = this.value;

        defense_tools.forEach((otherTool, otherIndex) => {
          if (otherIndex !== index) {
            const otherRange = document.getElementById(`defense_tool${otherIndex + 1}`);
            const otherValue = document.getElementById(`defense_tool${otherIndex + 1}-value`);
            if (otherRange && otherValue) {
              otherRange.value = 0;
              otherValue.textContent = '0';
            }
          }
        });
      });
    }
  });
}

export function openDefenseToolsModal(side, toolType, slotIndex) {
  const modal = new bootstrap.Modal(document.getElementById('toolModalDefense'));
  const slotElement = document.getElementById(`tool-slot-${side}-${toolType}-${slotIndex}`);
  initializeDefenseTools(defense_tools, toolType);

  const currentSlotData = toolType === 'cy'
    ? defenseSlots[side].cyTools[slotIndex - 1] || { type: '', count: 0 }
    : defenseSlots[side][`${toolType}Tools`][slotIndex - 1] || { type: '', count: 0 };

  const usedCourtyardTools = toolType === 'cy'
    ? defenseSlots[side].cyTools.map(slot => slot.type).filter(type => type !== '')
    : [];

  defense_tools.forEach((tool, index) => {
    const isSelected = currentSlotData.type === `DefenseTool${tool.id}`;
    const toolRange = document.getElementById(`defense_tool${index + 1}`);
    const toolValue = document.getElementById(`defense_tool${index + 1}-value`);

    if (toolRange && toolValue) {
      toolRange.value = isSelected ? 1 : 0;
      toolValue.textContent = isSelected ? '1' : '0';

      const isToolUsedInCourtyard = usedCourtyardTools.includes(`DefenseTool${tool.id}`);

      if (!toolSlotRestrictions[toolType].includes(tool.id) || (toolType === 'cy' && isToolUsedInCourtyard && !isSelected)) {
        toolRange.disabled = true;
        toolRange.value = 0;
        toolValue.textContent = '0';
      } else {
        toolRange.disabled = false;
      }

      toolRange.addEventListener('input', function () {
        toolValue.textContent = this.value;

        defense_tools.forEach((otherTool, otherIndex) => {
          if (otherIndex !== index) {
            const otherRange = document.getElementById(`defense_tool${otherIndex + 1}`);
            const otherValue = document.getElementById(`defense_tool${otherIndex + 1}-value`);
            if (otherRange && otherValue) {
              otherRange.value = 0;
              otherValue.textContent = 0;
            }
          }
        });
      });
    }
  });

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
          toolValue.textContent = '0';
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
