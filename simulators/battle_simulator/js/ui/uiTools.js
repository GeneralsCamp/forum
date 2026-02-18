import * as variables from '../data/variables.js';
import { generateWaves } from './uiWaves.js';

export function initializeTools(tools = variables.tools) {
  const toolModalBody = document.querySelector('#toolModal .modal-body');
  if (!toolModalBody) return;

  toolModalBody.innerHTML = '';

  tools.forEach((tool, index) => {
    const effects = [];

    if (tool.travelSpeed > 0) {
      effects.push(`
        <img src="../../../../img_base/battle_simulator/travelSpeed-icon.png" alt="" class="combat-icon" />
        <span class="me-2">+${tool.travelSpeed}</span>
      `);
    }

    if (tool.effect1Type && tool.effect1Value !== 0) {
      effects.push(`
        <img src="../../../../img_base/battle_simulator/${tool.effectImage1}" alt="${tool.effect1Type}" class="combat-icon" />
        <span class="me-2">${tool.effect1Value}%</span>
      `);
    }

    if (tool.effect2Type && tool.effect2Value !== 0) {
      effects.push(`
        <img src="../../../../img_base/battle_simulator/${tool.effectImage2}" alt="${tool.effect2Type}" class="combat-icon" />
        <span class="me-2">+${tool.effect2Value}%</span>
      `);
    }

    if (tool.toolLimit && tool.toolLimit !== 0) {
      effects.push(`
        <img src="../../../../img_base/battle_simulator/unitLimit-icon.png" alt="tool-limit" class="combat-icon" />
        <span class="me-2">${tool.toolLimit}</span>
      `);
    }

    const toolCard = `
      <div class="col-12">
        <div class="card w-100">
          <div class="modal-card-body mt-1">
            <h6 class="card-title text-center">${tool.name}</h6>
            <div class="d-flex align-items-center">
              <div class="me-2">
                <img src="../../../../img_base/battle_simulator/${tool.image}" alt="${tool.name}" class="tool-image" />
              </div>
              <div class="flex-grow-1">
                <div class="d-flex align-items-center">
                  <input type="range" id="tool${index + 1}" min="0" max="5" value="0" class="form-range me-2" />
                  <span id="tool${index + 1}-value" class="selector-value">0</span>
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

    toolModalBody.insertAdjacentHTML('beforeend', toolCard);

    const toolRange = document.getElementById(`tool${index + 1}`);
    if (toolRange) {
      toolRange.addEventListener('input', function () {
        document.getElementById(`tool${index + 1}-value`).textContent = this.value;
      });
    }
  });
}

export function createToolIcon(slot) {
  const toolIconContainer = document.createElement('div');
  toolIconContainer.classList.add('tool-icon-container');

  const toolIcon = document.createElement('img');
  const imgName = (variables.toolImages && variables.toolImages[slot.type]) ? variables.toolImages[slot.type] : null;
  toolIcon.src = imgName ? `../../../../img_base/battle_simulator/${imgName}` : '../../../../img_base/battle_simulator/icon_tool0.png';
  toolIcon.classList.add('tool-icon');
  toolIcon.alt = slot.type || '';

  const countDisplay = document.createElement('div');
  countDisplay.classList.add('tool-count');
  countDisplay.textContent = slot.count > 0 ? slot.count : '';

  toolIconContainer.appendChild(toolIcon);
  toolIconContainer.appendChild(countDisplay);

  return toolIconContainer.outerHTML;
}

export function openToolModal(slotId, side, waveIndex) {
  const modalEl = document.getElementById('toolModal');
  if (!modalEl) return;
  const modal = new bootstrap.Modal(modalEl);

  const slotElement = document.getElementById(slotId);
  const waves = variables.waves || {};
  const wave = waves[side] ? waves[side][waveIndex - 1] : null;

  if (!wave || !wave.tools) {
    console.error(`Wave or tools not found for side: ${side}, waveIndex: ${waveIndex}`);
    return;
  }

  const slot = wave.tools.find(s => s.id === slotId);
  if (!slot) {
    console.error(`Slot not found for slotId: ${slotId}`);
    return;
  }

  const attackBasics = variables.attackBasics || { maxTools: { front: 0, left: 0, right: 0 } };
  const maxToolsInWave = attackBasics.maxTools[side];
  const totalToolsInWave = wave.tools.reduce((acc, s) => s.id !== slotId ? acc + (s.count || 0) : acc, 0);
  let availableTools = maxToolsInWave - totalToolsInWave;
  if (availableTools < 0) availableTools = 0;

  const usedToolTypes = wave.tools
    .filter(s => s.id !== slotId && s.type)
    .map(s => s.type);

  (variables.tools || []).forEach((tool, index) => {
    const count = (slot.count > 0 && slot.type === `Tool${tool.id.charAt(tool.id.length - 1)}`) ? slot.count : 0;

    const toolRange = document.getElementById(`tool${index + 1}`);
    const toolValue = document.getElementById(`tool${index + 1}-value`);
    if (!toolRange || !toolValue) return;

    let maxAllowed = availableTools;
    if (tool.toolLimit && tool.toolLimit > 0) {
      let totalUsedThisWave = 0;
      ['front', 'left', 'right'].forEach(s => {
        if (variables.totalTools[s] && variables.totalTools[s][waveIndex - 1]) {
          const existing = variables.totalTools[s][waveIndex - 1].find(t => t.type === `Tool${tool.id.charAt(tool.id.length - 1)}`);
          totalUsedThisWave += existing ? existing.count : 0;
        }
      });
      totalUsedThisWave -= count;
      maxAllowed = Math.min(tool.toolLimit - totalUsedThisWave, availableTools);
      if (maxAllowed < 0) maxAllowed = 0;
    }

    toolRange.value = count;
    toolRange.max = maxAllowed;
    toolRange.disabled = usedToolTypes.includes(`Tool${tool.id.charAt(tool.id.length - 1)}`) && slot.type !== `Tool${tool.id.charAt(tool.id.length - 1)}`;
    toolValue.textContent = count;

    toolRange.addEventListener('input', function () {
      toolValue.textContent = this.value;
      (variables.tools || []).forEach((otherTool, otherIndex) => {
        if (otherIndex !== index) {
          const otherRange = document.getElementById(`tool${otherIndex + 1}`);
          const otherValue = document.getElementById(`tool${otherIndex + 1}-value`);
          if (otherRange && otherValue) {
            otherRange.value = 0;
            otherValue.textContent = 0;
          }
        }
      });
    });
  });

  const confirmBtn = document.getElementById('confirmTools');
  if (confirmBtn) {
    confirmBtn.onclick = function () {
      let totalToolsInSlot = 0;
      let selectedToolType = '';

      (variables.tools || []).forEach((tool, index) => {
        const toolRange = document.getElementById(`tool${index + 1}`);
        const toolCount = parseInt(toolRange ? toolRange.value : 0, 10) || 0;
        if (toolCount > 0) {
          totalToolsInSlot += toolCount;
          selectedToolType = `Tool${tool.id.charAt(tool.id.length - 1)}`;
        }
      });

      if (totalToolsInWave + totalToolsInSlot > maxToolsInWave) {
        alert(`Cannot exceed ${maxToolsInWave} tools in this wave!`);
        return;
      }

      slot.type = selectedToolType || '';
      slot.count = totalToolsInSlot;

      if (!variables.totalTools) variables.totalTools = {};
      if (!variables.totalTools[side]) variables.totalTools[side] = [];
      variables.totalTools[side][waveIndex - 1] = wave.tools;

      slotElement.innerHTML = slot.count > 0 ? createToolIcon(slot) : '+';

      const toolBonuses = summarizeToolBonuses(wave.tools);
      const bonusElement = document.querySelector(`#tools-${side}-${waveIndex} .bonus-summary`);
      if (bonusElement) bonusElement.innerHTML = toolBonuses;

      generateWaves(side, attackBasics.maxWaves);
      modal.hide();
    };
  }

  modal.show();
}

export function summarizeToolBonuses(tools) {
  const totalEffects = {};

  (tools || []).forEach(tool => {
    const effectData = variables.toolEffects ? variables.toolEffects[tool.type] : null;
    if (!effectData) return;

    // Effect1
    if (effectData.effect1 && effectData.effect1.name) {
      if (!totalEffects[effectData.effect1.name]) {
        totalEffects[effectData.effect1.name] = {
          total: 0,
          icon: effectData.effect1.icon
        };
      }
      totalEffects[effectData.effect1.name].total += tool.count * effectData.effect1.value;
    }

    // Effect2
    if (effectData.effect2 && effectData.effect2.name) {
      if (!totalEffects[effectData.effect2.name]) {
        totalEffects[effectData.effect2.name] = {
          total: 0,
          icon: effectData.effect2.icon
        };
      }
      totalEffects[effectData.effect2.name].total += tool.count * effectData.effect2.value;
    }
  });

  const effectsArray = Object.entries(totalEffects)
    .map(([name, { total, icon }]) => ({ name, total, icon }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  let result = effectsArray
    .map(({ name, total, icon }) => {
      const sign = total >= 0 ? '+' : '';
      return `<div class="col-6 effect-slot"><img src="../../../../img_base/battle_simulator/${icon}" alt="${name}" /> ${sign}${total}%</div>`;
    })
    .join('');

  return result ? `<div class="row">${result}</div>` : '';
}
