import * as variables from '../data/variables.js';
import { imageUrl } from '../data/imagePaths.js';
import { generateWaves } from './uiWaves.js';
import { itemLevelBadge, runtimeItem } from './itemLevelBadge.js';
import { bindEditableCounts, renderEditableCount } from './editableCount.js';

let toolEditorState = null;

function toolType(tool) {
  return `Tool${tool.id.replace(/\D/g, '')}`;
}

function toolEffects(tool) {
  const effects = [];
  if (tool.effect1Type && tool.effect1Value !== 0) {
    effects.push([imageUrl(tool.effectImage1), `${tool.effect1Value}%`]);
  }
  if (tool.effect2Type && tool.effect2Value !== 0) {
    effects.push([imageUrl(tool.effectImage2), `${tool.effect2Value > 0 ? '+' : ''}${tool.effect2Value}%`]);
  }
  if (tool.toolLimit > 0) {
    effects.push(['../../img_base/battle_simulator/unitLimit-icon.png', tool.toolLimit]);
  }
  return effects.map(([icon, value]) => `
    <span class="wave-editor-effect"><img src="${icon}" alt="">${value}</span>
  `).join('');
}

export function initializeTools(tools = variables.tools) {
  const toolModalBody = document.querySelector('#toolModal .modal-body');
  if (!toolModalBody) return;

  toolModalBody.innerHTML = `
    <div class="wave-editor-sticky">
      <div class="wave-editor-limit">
        <span id="tool-editor-total-label">0 / 0</span>
      </div>
      <div id="tool-editor-slots" class="wave-editor-slots"></div>
    </div>
    <div id="tool-editor-list" class="wave-editor-list"></div>
  `;

  const list = toolModalBody.querySelector('#tool-editor-list');

  tools.forEach((tool, index) => {
    list.insertAdjacentHTML('beforeend', `
      <div class="wave-editor-row" data-tool-index="${index}">
        <div class="wave-editor-name">${tool.name}</div>
        <div class="wave-editor-image-wrap">
          <img src="${imageUrl(tool.image)}" alt="${tool.name}" class="wave-editor-image">
          ${itemLevelBadge(tool)}
        </div>
        <div class="wave-editor-main">
          <div class="wave-editor-controls">
            <button type="button" class="wave-editor-step tool-minus" aria-label="Decrease">&minus;</button>
            <div class="wave-editor-value-wrap">
              <strong class="wave-editor-value"><span class="wave-editor-current-value" contenteditable="true" inputmode="numeric" spellcheck="false">0</span> / <span class="wave-editor-maximum">0</span></strong>
              <input type="range" class="wave-editor-range" min="0" max="0" value="0">
            </div>
            <button type="button" class="wave-editor-step tool-plus" aria-label="Increase">+</button>
          </div>
          <div class="wave-editor-effects">${toolEffects(tool)}</div>
        </div>
      </div>
    `);
  });

  list.addEventListener('click', event => {
    const row = event.target.closest('[data-tool-index]');
    if (!row || !toolEditorState) return;
    const index = Number(row.dataset.toolIndex);
    const current = Number(row.querySelector('.wave-editor-range').value) || 0;
    if (event.target.closest('.tool-minus')) setToolEditorValue(index, current - 1);
    if (event.target.closest('.tool-plus')) setToolEditorValue(index, current + 1);
  });
  list.addEventListener('input', event => {
    if (!event.target.matches('.wave-editor-range')) return;
    const row = event.target.closest('[data-tool-index]');
    setToolEditorValue(Number(row.dataset.toolIndex), Number(event.target.value));
  });
  bindEditableCounts(list, row => Number(row.dataset.toolIndex), setToolEditorValue);
}

function maximumForTool(toolIndex) {
  const state = toolEditorState;
  const tool = variables.tools[toolIndex];
  const type = toolType(tool);
  const otherSlots = state.slots.filter((slot, index) => index !== state.activeSlot);

  const otherCount = otherSlots.reduce((sum, slot) => sum + (slot.count || 0), 0);
  let maximum = Math.max(0, state.max - otherCount);

  if (tool.toolLimit > 0) {
    let usedOutsideActive = 0;
    ['front', 'left', 'right'].forEach(side => {
      const slots = side === state.side
        ? state.slots
        : variables.totalTools?.[side]?.[state.waveIndex - 1] || [];
      slots.forEach((slot, index) => {
        if (side === state.side && index === state.activeSlot) return;
        if (slot.type === type) usedOutsideActive += slot.count || 0;
      });
    });
    maximum = Math.min(maximum, Math.max(0, tool.toolLimit - usedOutsideActive));
  }

  return maximum;
}

function setToolEditorValue(toolIndex, requestedValue) {
  const state = toolEditorState;
  if (!state) return;
  const value = Math.max(0, Math.min(maximumForTool(toolIndex), requestedValue || 0));
  const slot = state.slots[state.activeSlot];
  slot.type = value > 0 ? toolType(variables.tools[toolIndex]) : '';
  slot.count = value;
  renderToolEditor();
}

function scrollToSelectedTool() {
  const selectedRow = document.querySelector('#tool-editor-list .wave-editor-row.selected');
  if (selectedRow) selectedRow.scrollIntoView({ block: 'center', behavior: 'auto' });
}

function scrollToToolOnModalDisplay(modalElement) {
  if (toolEditorState.slots[toolEditorState.activeSlot].count <= 0) return;
  const observer = new MutationObserver(() => {
    if (modalElement.style.display !== 'block') return;
    observer.disconnect();
    scrollToSelectedTool();
  });
  observer.observe(modalElement, { attributes: true, attributeFilter: ['style'] });
}

function renderToolEditor() {
  const state = toolEditorState;
  if (!state) return;
  const total = state.slots.reduce((sum, slot) => sum + (slot.count || 0), 0);
  const totalLabel = document.getElementById('tool-editor-total-label');
  totalLabel.textContent = `${total} / ${state.max}`;

  const slotsElement = document.getElementById('tool-editor-slots');
  slotsElement.innerHTML = state.slots.map((slot, index) => {
    const image = slot.type ? imageUrl(variables.toolImages?.[slot.type]) : '';
    const tool = runtimeItem(slot.type, variables.tools);
    return `<button type="button" class="wave-editor-slot ${image ? '' : 'empty-wave-slot '}${index === state.activeSlot ? 'active' : ''}" data-slot-index="${index}">
      ${image ? `<img src="${image}" alt="">${itemLevelBadge(tool)}<span>${slot.count || 0}</span>` : ''}
    </button>`;
  }).join('');
  slotsElement.querySelectorAll('[data-slot-index]').forEach(button => {
    button.onclick = () => {
      state.activeSlot = Number(button.dataset.slotIndex);
      renderToolEditor();
      if (state.slots[state.activeSlot].count > 0) scrollToSelectedTool();
    };
  });

  const active = state.slots[state.activeSlot];
  document.querySelectorAll('#tool-editor-list [data-tool-index]').forEach(row => {
    const index = Number(row.dataset.toolIndex);
    const type = toolType(variables.tools[index]);
    const selected = active.type === type;
    const value = selected ? active.count || 0 : 0;
    const maximum = maximumForTool(index);
    const range = row.querySelector('.wave-editor-range');
    range.max = maximum;
    range.value = Math.min(value, maximum);
    range.disabled = maximum === 0 && !selected;
    renderEditableCount(row, value, maximum);
    row.querySelector('.tool-minus').disabled = value <= 0;
    row.querySelector('.tool-plus').disabled = value >= maximum;
    row.classList.toggle('selected', selected);
    row.classList.toggle('unavailable', maximum === 0 && !selected);
  });
}

export function createToolIcon(slot) {
  const toolIconContainer = document.createElement('div');
  toolIconContainer.classList.add('tool-icon-container');

  const toolIcon = document.createElement('img');
  const imgName = (variables.toolImages && variables.toolImages[slot.type]) ? variables.toolImages[slot.type] : null;
  toolIcon.src = imageUrl(imgName);
  toolIcon.classList.add('tool-icon');
  toolIcon.alt = slot.type || '';

  const countDisplay = document.createElement('div');
  countDisplay.classList.add('tool-count');
  countDisplay.textContent = slot.count > 0 ? slot.count : '';

  toolIconContainer.appendChild(toolIcon);
  toolIconContainer.insertAdjacentHTML('beforeend', itemLevelBadge(runtimeItem(slot.type, variables.tools)));
  toolIconContainer.appendChild(countDisplay);

  return toolIconContainer.outerHTML;
}

export function openToolModal(slotId, side, waveIndex) {
  const modalEl = document.getElementById('toolModal');
  if (!modalEl) return;
  const modal = new bootstrap.Modal(modalEl);

  const waves = variables.waves || {};
  const wave = waves[side] ? waves[side][waveIndex - 1] : null;

  if (!wave || !wave.tools) {
    console.error(`Wave or tools not found for side: ${side}, waveIndex: ${waveIndex}`);
    return;
  }

  const activeSlot = wave.tools.findIndex(s => s.id === slotId);
  if (activeSlot < 0) {
    console.error(`Slot not found for slotId: ${slotId}`);
    return;
  }

  const maxTools = variables.attackBasics?.maxTools?.[side] || 0;
  toolEditorState = {
    side,
    waveIndex,
    wave,
    activeSlot,
    max: maxTools,
    slots: wave.tools.map(slot => ({ ...slot }))
  };
  renderToolEditor();
  scrollToToolOnModalDisplay(modalEl);

  const confirmBtn = document.getElementById('confirmTools');
  if (confirmBtn) {
    confirmBtn.onclick = function () {
      wave.tools.splice(0, wave.tools.length, ...toolEditorState.slots.map(slot => ({ ...slot })));
      if (!variables.totalTools[side]) variables.totalTools[side] = [];
      variables.totalTools[side][waveIndex - 1] = wave.tools;

      generateWaves(side, variables.getEffectiveWaveCount());
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

    if (effectData.effect1 && effectData.effect1.name) {
      if (!totalEffects[effectData.effect1.name]) {
        totalEffects[effectData.effect1.name] = {
          total: 0,
          icon: effectData.effect1.icon
        };
      }
      totalEffects[effectData.effect1.name].total += tool.count * effectData.effect1.value;
    }

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
      return `<div class="col-6 effect-slot"><img src="${imageUrl(icon)}" alt="${name}" /> ${sign}${total}%</div>`;
    })
    .join('');

  return result ? `<div class="row">${result}</div>` : '';
}
