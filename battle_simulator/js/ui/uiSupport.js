import * as variables from '../data/variables.js';
import { switchSide } from './uiWaves.js';

export function openSupportToolModal(slotId) {
  const modal = new bootstrap.Modal(document.getElementById('supportToolModal'));
  const slotElement = document.getElementById(slotId);
  const supportWave = variables.waves['Support'][0];
  const slot = supportWave.tools.find(s => s.id === slotId);

  const maxSupportTools = 3;
  const totalSupportToolsInWave = supportWave.tools.reduce((acc, s) => s.id !== slotId ? acc + s.count : acc, 0);
  let availableTools = maxSupportTools - totalSupportToolsInWave;

  const usedToolTypes = supportWave.tools
    .filter(s => s.id !== slotId)
    .map(tool => tool.type)
    .filter(type => type !== '');

  variables.supportTools.forEach((tool, index) => {
    const count = slot.count > 0 && slot.type === `Tool${tool.id.charAt(tool.id.length - 1)}` ? slot.count : 0;

    const toolRange = document.getElementById(`supportTool${index + 1}`);
    const toolValue = document.getElementById(`supportTool${index + 1}-value`);

    if (toolRange && toolValue) {
      toolRange.value = count;
      const toolLimit = tool.toolLimit > 0 ? tool.toolLimit : availableTools;
      toolRange.max = Math.min(toolLimit, availableTools);
      toolRange.disabled = usedToolTypes.includes(`Tool${tool.id.charAt(tool.id.length - 1)}`) && slot.type !== `Tool${tool.id.charAt(tool.id.length - 1)}`;
      toolValue.textContent = count;

      toolRange.addEventListener('input', function () {
        toolValue.textContent = this.value;
        variables.supportTools.forEach((otherTool, otherIndex) => {
          if (otherIndex !== index) {
            const otherRange = document.getElementById(`supportTool${otherIndex + 1}`);
            const otherValue = document.getElementById(`supportTool${otherIndex + 1}-value`);
            if (otherRange && otherValue) {
              otherRange.value = 0;
              otherValue.textContent = 0;
            }
          }
        });
      });
    }
  });

  document.getElementById('confirmSupportTools').onclick = function () {
    let totalToolsInSlot = 0;
    let selectedToolType = '';

    variables.supportTools.forEach((tool, index) => {
      const toolRange = document.getElementById(`supportTool${index + 1}`);
      const toolCount = parseInt(toolRange?.value || 0, 10);
      if (toolCount > 0) {
        totalToolsInSlot += toolCount;
        selectedToolType = `Tool${tool.id.charAt(tool.id.length - 1)}`;
      }
    });

    if (totalSupportToolsInWave + totalToolsInSlot > maxSupportTools) {
      alert(`Cannot exceed ${maxSupportTools} tools in the support wave!`);
      return;
    }

    if (slot) {
      slot.type = selectedToolType || '';
      slot.count = totalToolsInSlot;
      slotElement.innerHTML = slot.count > 0 ? createSupportToolIcon(slot) : '+';

      const bonusElement = document.querySelector(`#tools-Support .bonus-summary`);
      if (bonusElement) bonusElement.innerHTML = summarizeSupportToolBonuses(supportWave.tools);

      if (!variables.totalTools['Support']) variables.totalTools['Support'] = [];
      variables.totalTools['Support'][0] = supportWave.tools;

      switchSide(variables.currentSide);
    }

    modal.hide();
  };

  modal.show();
}

export function initializeSupportTools(supportTools = variables.supportTools) {
  const supportToolModalBody = document.querySelector('#supportToolModal .modal-body');
  supportToolModalBody.innerHTML = '';

  supportTools.forEach((tool, index) => {
    const effects = [];

    if (tool.travelSpeed > 0) {
      effects.push(`
        <img src="./img/travelSpeed-icon.png" alt="" class="combat-icon" />
        <span class="me-2">+${tool.travelSpeed}</span>
      `);
    }
    if (tool.effect1Type && tool.effect1Value !== 0) {
      effects.push(`
        <img src="./img/${tool.effectImage1}" alt="${tool.effect1Type}" class="combat-icon" />
        <span class="me-2">${tool.effect1Value}</span>
      `);
    }
    if (tool.effect2Type && tool.effect2Value !== 0) {
      effects.push(`
        <img src="./img/${tool.effectImage2}" alt="${tool.effect2Type}" class="combat-icon" />
        <span class="me-2">+${tool.effect2Value}%</span>
      `);
    }

    const supportToolCard = `
      <div class="col-12">
        <div class="card w-100">
          <div class="modal-card-body mt-1">
            <h6 class="card-title text-center">${tool.name}</h6>
            <div class="d-flex align-items-center">
              <div class="me-2">
                <img src="./img/${tool.image}" alt="${tool.name}" class="tool-image" />
              </div>
              <div class="flex-grow-1">
                <div class="d-flex align-items-center">
                  <input type="range" id="supportTool${index + 1}" min="0" max="${tool.toolLimit}" value="0" class="form-range me-2" />
                  <span id="supportTool${index + 1}-value" class="selector-value">0</span>
                </div>
                <div class="mt-2">${effects.join('')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    supportToolModalBody.insertAdjacentHTML('beforeend', supportToolCard);

    const toolRange = document.getElementById(`supportTool${index + 1}`);
    toolRange.addEventListener('input', function () {
      document.getElementById(`supportTool${index + 1}-value`).textContent = this.value;
    });
  });
}

export function createSupportToolIcon(slot) {
  const container = document.createElement('div');
  container.classList.add('tool-icon-container');

  const icon = document.createElement('img');
  icon.src = `./img/${variables.supportToolImages[slot.type]}` || './img/icon_tool0.png';
  icon.classList.add('tool-icon');
  icon.alt = slot.type;

  const count = document.createElement('div');
  count.classList.add('tool-count');
  count.textContent = slot.count > 0 ? slot.count : '';

  container.append(icon, count);
  return container.outerHTML;
}

export function summarizeSupportToolBonuses(supportTools) {
  const totalEffects = {};

  supportTools.forEach(tool => {
    const effectData = variables.supportToolEffects[tool.type];
    if (!effectData) return;

    if (effectData.effect1.name && effectData.effect1.value !== 0) {
      if (!totalEffects[effectData.effect1.name]) totalEffects[effectData.effect1.name] = { totalEffect1: 0, icon: effectData.effect1.icon, totalEffect2: 0 };
      totalEffects[effectData.effect1.name].totalEffect1 += tool.count * effectData.effect1.value;
    }

    if (effectData.effect2.name && effectData.effect2.value !== 0) {
      if (!totalEffects[effectData.effect2.name]) totalEffects[effectData.effect2.name] = { totalEffect1: 0, icon: effectData.effect2.icon, totalEffect2: 0 };
      totalEffects[effectData.effect2.name].totalEffect2 += tool.count * effectData.effect2.value;
    }
  });

  const effectsArray = Object.entries(totalEffects).map(([name, { totalEffect1, totalEffect2, icon }]) => ({ name, totalEffect1, totalEffect2, icon }));
  effectsArray.sort((a, b) => (Math.abs(b.totalEffect1) + Math.abs(b.totalEffect2)) - (Math.abs(a.totalEffect1) + Math.abs(a.totalEffect2)));

  let result = '';
  effectsArray.forEach(({ name, totalEffect1, totalEffect2, icon }) => {
    if (totalEffect1 !== 0) result += `<div class="col-6 effect-slot"><img src="./img/${icon}" alt="${name}" /> ${totalEffect1}</div>`;
    if (totalEffect2 !== 0) result += `<div class="col-6 effect-slot"><img src="./img/${icon}" alt="${name}" /> +${totalEffect2}%</div>`;
  });

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
            <img src="./img/tools-icon.webp" alt="Tools" style="width:20px;height:20px;vertical-align:middle;" />
            Tools ${supportWave.tools.reduce((acc, t) => acc + t.count, 0)} / 3
          </span>
          <div class="row ms-1 mt-1">
            ${Array.from({ length: 3 }, (_, i) => `<div class="tool-slot" id="tool-slot-Support-${i + 1}">+</div>`).join('')}
          </div>
        </div>
        <div class="col">
          <div class="bonus-summary mt-4">${summarizeSupportToolBonuses(supportWave.tools)}</div>
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
  });

  supportBody.addEventListener('hide.bs.collapse', () => {
    supportHeader.classList.remove('collapsed');
    variables.openWaves['Support'] = false;
  });

  if (variables.openWaves['Support']) {
    supportBody.classList.add('show');
    supportHeader.classList.add('collapsed');
  }
}
