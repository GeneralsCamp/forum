import * as variables from '../data/variables.js';
import { saveAttackState } from '../data/attackState.js';
import { imageUrl } from '../data/imagePaths.js';
import { switchSide } from './uiWaves.js';
import { itemLevelBadge, runtimeItem } from './itemLevelBadge.js';

let supportToolEditorState = null;

function supportToolType(tool) {
  return `Tool${tool.id.replace(/\D/g, '')}`;
}

function isPercentageEffect(type) {
  return ['combatStrength', 'yardStrength', 'courtyard'].includes(type);
}

function formatSupportEffect(type, value) {
  if (!isPercentageEffect(type)) return String(value);
  return `${value > 0 ? '+' : ''}${value}%`;
}

function supportToolEffects(tool) {
  const effects = [];
  if (tool.effect1Type && tool.effect1Value !== 0) {
    effects.push([
      imageUrl(tool.effectImage1),
      formatSupportEffect(tool.effect1Type, tool.effect1Value)
    ]);
  }
  if (tool.effect2Type && tool.effect2Value !== 0) {
    effects.push([
      imageUrl(tool.effectImage2),
      formatSupportEffect(tool.effect2Type, tool.effect2Value)
    ]);
  }
  if (tool.toolLimit > 0) {
    effects.push(['../../img_base/battle_simulator/unitLimit-icon.png', tool.toolLimit]);
  }
  return effects.map(([icon, value]) => `
    <span class="wave-editor-effect"><img src="${icon}" alt="">${value}</span>
  `).join('');
}

function maximumForSupportTool(toolIndex) {
  const state = supportToolEditorState;
  const tool = variables.supportTools[toolIndex];
  const type = supportToolType(tool);
  const otherSlots = state.slots.filter((slot, index) => index !== state.activeSlot);
  const otherCount = otherSlots.reduce((sum, slot) => sum + (slot.count || 0), 0);
  let maximum = Math.max(0, state.max - otherCount);

  if (tool.toolLimit > 0) {
    const sameToolElsewhere = otherSlots.reduce((sum, slot) =>
      slot.type === type ? sum + (slot.count || 0) : sum, 0);
    maximum = Math.min(maximum, Math.max(0, tool.toolLimit - sameToolElsewhere));
  }

  return maximum;
}

function setSupportToolEditorValue(toolIndex, requestedValue) {
  const state = supportToolEditorState;
  if (!state) return;
  const value = Math.max(0, Math.min(maximumForSupportTool(toolIndex), requestedValue || 0));
  const slot = state.slots[state.activeSlot];
  slot.type = value > 0 ? supportToolType(variables.supportTools[toolIndex]) : '';
  slot.count = value;
  renderSupportToolEditor();
}

function scrollToSelectedSupportTool() {
  const selectedRow = document.querySelector('#support-tool-editor-list .wave-editor-row.selected');
  if (selectedRow) selectedRow.scrollIntoView({ block: 'center', behavior: 'auto' });
}

function scrollToSupportToolOnModalDisplay(modalElement) {
  if (supportToolEditorState.slots[supportToolEditorState.activeSlot].count <= 0) return;
  const observer = new MutationObserver(() => {
    if (modalElement.style.display !== 'block') return;
    observer.disconnect();
    scrollToSelectedSupportTool();
  });
  observer.observe(modalElement, { attributes: true, attributeFilter: ['style'] });
}

function renderSupportToolEditor() {
  const state = supportToolEditorState;
  if (!state) return;
  const total = state.slots.reduce((sum, slot) => sum + (slot.count || 0), 0);
  document.getElementById('support-tool-editor-total-label').textContent = `${total} / ${state.max}`;

  const slotsElement = document.getElementById('support-tool-editor-slots');
  slotsElement.innerHTML = state.slots.map((slot, index) => {
    const image = slot.type ? imageUrl(variables.supportToolImages?.[slot.type]) : '';
    const tool = runtimeItem(slot.type, variables.supportTools);
    return `<button type="button" class="wave-editor-slot ${index === state.activeSlot ? 'active' : ''}" data-slot-index="${index}">
      ${image ? `<img src="${image}" alt="">${itemLevelBadge(tool)}<span>${slot.count || 0}</span>` : '<b>+</b>'}
    </button>`;
  }).join('');
  slotsElement.querySelectorAll('[data-slot-index]').forEach(button => {
    button.onclick = () => {
      state.activeSlot = Number(button.dataset.slotIndex);
      renderSupportToolEditor();
      if (state.slots[state.activeSlot].count > 0) scrollToSelectedSupportTool();
    };
  });

  const active = state.slots[state.activeSlot];
  document.querySelectorAll('#support-tool-editor-list [data-support-tool-index]').forEach(row => {
    const index = Number(row.dataset.supportToolIndex);
    const type = supportToolType(variables.supportTools[index]);
    const selected = active.type === type;
    const value = selected ? active.count || 0 : 0;
    const maximum = maximumForSupportTool(index);
    const range = row.querySelector('.wave-editor-range');
    range.max = maximum;
    range.value = Math.min(value, maximum);
    range.disabled = maximum === 0 && !selected;
    row.querySelector('.wave-editor-value').textContent = `${value} / ${maximum}`;
    row.querySelector('.support-tool-minus').disabled = value <= 0;
    row.querySelector('.support-tool-plus').disabled = value >= maximum;
    row.classList.toggle('selected', selected);
    row.classList.toggle('unavailable', maximum === 0 && !selected);
  });
}

export function openSupportToolModal(slotId) {
  const modalEl = document.getElementById('supportToolModal');
  if (!modalEl) return;
  const modal = new bootstrap.Modal(modalEl);
  const supportWave = variables.waves['Support'][0];
  if (!supportWave?.tools) return;
  const activeSlot = supportWave.tools.findIndex(slot => slot.id === slotId);
  if (activeSlot < 0) return;

  supportToolEditorState = {
    wave: supportWave,
    activeSlot,
    max: 3,
    slots: supportWave.tools.map(slot => ({ ...slot }))
  };
  renderSupportToolEditor();
  scrollToSupportToolOnModalDisplay(modalEl);

  document.getElementById('confirmSupportTools').onclick = function () {
    supportWave.tools.splice(0, supportWave.tools.length,
      ...supportToolEditorState.slots.map(slot => ({ ...slot })));
    if (!variables.totalTools.Support) variables.totalTools.Support = [];
    variables.totalTools.Support[0] = supportWave.tools;
    switchSide(variables.currentSide);

    modal.hide();
  };

  modal.show();
}

export function initializeSupportTools(supportTools = variables.supportTools) {
  const supportToolModalBody = document.querySelector('#supportToolModal .modal-body');
  if (!supportToolModalBody) return;
  supportToolModalBody.innerHTML = `
    <div class="wave-editor-sticky">
      <div class="wave-editor-limit">
        <span id="support-tool-editor-total-label">0 / 3</span>
      </div>
      <div id="support-tool-editor-slots" class="wave-editor-slots"></div>
    </div>
    <div id="support-tool-editor-list" class="wave-editor-list"></div>
  `;

  const list = supportToolModalBody.querySelector('#support-tool-editor-list');

  supportTools.forEach((tool, index) => {
    list.insertAdjacentHTML('beforeend', `
      <div class="wave-editor-row" data-support-tool-index="${index}">
        <div class="wave-editor-name">${tool.name}</div>
        <div class="wave-editor-image-wrap">
          <img src="${imageUrl(tool.image)}" alt="${tool.name}" class="wave-editor-image">
          ${itemLevelBadge(tool)}
        </div>
        <div class="wave-editor-main">
          <div class="wave-editor-controls">
            <button type="button" class="wave-editor-step support-tool-minus" aria-label="Decrease">&minus;</button>
            <div class="wave-editor-value-wrap">
              <strong class="wave-editor-value">0 / 0</strong>
              <input type="range" class="wave-editor-range" min="0" max="0" value="0">
            </div>
            <button type="button" class="wave-editor-step support-tool-plus" aria-label="Increase">+</button>
          </div>
          <div class="wave-editor-effects">${supportToolEffects(tool)}</div>
        </div>
      </div>
    `);
  });

  list.addEventListener('click', event => {
    const row = event.target.closest('[data-support-tool-index]');
    if (!row || !supportToolEditorState) return;
    const index = Number(row.dataset.supportToolIndex);
    const current = Number(row.querySelector('.wave-editor-range').value) || 0;
    if (event.target.closest('.support-tool-minus')) setSupportToolEditorValue(index, current - 1);
    if (event.target.closest('.support-tool-plus')) setSupportToolEditorValue(index, current + 1);
  });
  list.addEventListener('input', event => {
    if (!event.target.matches('.wave-editor-range')) return;
    const row = event.target.closest('[data-support-tool-index]');
    setSupportToolEditorValue(Number(row.dataset.supportToolIndex), Number(event.target.value));
  });
}

export function createSupportToolIcon(slot) {
  const container = document.createElement('div');
  container.classList.add('tool-icon-container');

  const icon = document.createElement('img');
  const imageName = variables.supportToolImages?.[slot.type];
  icon.src = imageUrl(imageName);
  icon.classList.add('tool-icon');
  icon.alt = slot.type;

  const count = document.createElement('div');
  count.classList.add('tool-count');
  count.textContent = slot.count > 0 ? slot.count : '';

  container.append(icon);
  container.insertAdjacentHTML('beforeend', itemLevelBadge(runtimeItem(slot.type, variables.supportTools)));
  container.append(count);
  return container.outerHTML;
}

export function summarizeSupportToolBonuses(supportTools) {
  const totalEffects = {};

  supportTools.forEach(tool => {
    const effectData = variables.supportToolEffects[tool.type];
    if (!effectData) return;

    [effectData.effect1, effectData.effect2].forEach(effect => {
      if (!effect?.name || effect.value === 0) return;
      if (!totalEffects[effect.name]) {
        totalEffects[effect.name] = {
          total: 0,
          icon: effect.icon,
          type: `${effect.name.charAt(0).toLowerCase()}${effect.name.slice(1)}`
        };
      }
      totalEffects[effect.name].total += tool.count * effect.value;
    });
  });

  const effectsArray = Object.entries(totalEffects)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  const result = effectsArray.map(({ name, total, icon, type }) => `
    <div class="col-6 effect-slot">
      <img src="${imageUrl(icon)}" alt="${name}" /> ${formatSupportEffect(type, total)}
    </div>
  `).join('');

  return result ? `<div class="row">${result}</div>` : '';
}

export function createSupportWaveCard() {
  if (!variables.waves['Support']) {
    variables.waves['Support'] = [{ tools: Array.from({ length: 3 }, (_, i) => ({ type: '', count: 0, id: `tool-slot-Support-${i + 1}` })) }];
  }

  const supportCard = document.createElement('div');
  supportCard.classList.add('card');

  const supportHeader = document.createElement('div');
  supportHeader.classList.add('card-header');
  supportHeader.id = 'headingSupp';

  const isOpen = variables.openWaves['Support'];
  supportHeader.innerHTML = `
    <h6 class="mb-0 d-flex justify-content-between align-items-center">
      <button class="btn btn-link ${isOpen ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse"
              data-bs-target="#collapseSupp" aria-expanded="${isOpen ? 'true' : 'false'}" aria-controls="collapseSupp"
              style="width:100%; text-align:left;">Support wave</button>
      <span class="arrow" aria-hidden="true" style="transform: ${isOpen ? 'rotate(90deg)' : 'rotate(0deg)'};"></span>
    </h6>
  `;

  const supportBody = document.createElement('div');
  supportBody.id = 'collapseSupp';
  supportBody.classList.add('collapse');
  supportBody.setAttribute('aria-labelledby', 'headingSupp');
  const supportWave = variables.waves['Support'][0];
  supportBody.innerHTML = `
    <div class="card-body">
      <div class="row d-flex align-items-start">
        <div class="col-6 bugfix">
          <span class="tools">
            <img src="../../img_base/battle_simulator/tools-icon.webp" alt="Tools" style="width:20px;height:20px;vertical-align:middle;" />
            Tools ${supportWave.tools.reduce((acc, t) => acc + t.count, 0)} / 3
          </span>
          <div class="row ms-1 mt-1">
            ${Array.from({ length: 3 }, (_, i) => `<div class="tool-slot" id="tool-slot-Support-${i + 1}">+</div>`).join('')}
          </div>
        </div>
        <div class="col">
          <div class="bonus-summary mt-4" id="support-tool-bonuses">${summarizeSupportToolBonuses(supportWave.tools)}</div>
        </div>
      </div>
    </div>
  `;

  supportCard.append(supportHeader, supportBody);
  document.getElementById('wave-container').appendChild(supportCard);

  const button = supportHeader.querySelector('button');
  const arrow = supportHeader.querySelector('.arrow');

  button.addEventListener('click', () => {
    const collapsed = button.classList.contains('collapsed');
    arrow.style.transform = collapsed ? 'rotate(0deg)' : 'rotate(90deg)';
  });

  supportBody.querySelectorAll('.tool-slot').forEach((slotEl, i) => {
    const slotData = supportWave.tools[i];
    if (slotData.count > 0) {
      slotEl.innerHTML = createSupportToolIcon(slotData);
      supportHeader.style.backgroundColor = 'rgb(255, 255, 150)';
    }
    slotEl.addEventListener('click', () => openSupportToolModal(slotEl.id));
  });

  supportBody.addEventListener('show.bs.collapse', () => {
    supportHeader.classList.add('collapsed');
    variables.openWaves['Support'] = true;
    saveAttackState();
  });

  supportBody.addEventListener('hide.bs.collapse', () => {
    supportHeader.classList.remove('collapsed');
    variables.openWaves['Support'] = false;
    saveAttackState();
  });

  if (variables.openWaves['Support']) {
    supportBody.classList.add('show');
    supportHeader.classList.add('collapsed');
  }
}
