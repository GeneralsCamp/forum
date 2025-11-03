import { createUnitIcon, openUnitModal, summarizeUnitBonuses } from './uiUnits.js';
import { createToolIcon, openToolModal, summarizeToolBonuses } from './uiTools.js';
import { createCourtyardAssaultCard } from './uiCourtyard.js';
import { createSupportWaveCard } from './uiSupport.js';
import * as variables from '../data/variables.js';

export function generateWaves(side, numberOfWaves) {
  variables.waves[side] = [];
  const waveContainer = document.getElementById('wave-container');
  waveContainer.innerHTML = '';

  createSupportWaveCard();

  const maxUnits = variables.attackBasics.maxUnits[side];
  const maxTools = variables.attackBasics.maxTools[side];

  for (let i = numberOfWaves; i < variables.totalUnits[side].length; i++) {

    if (variables.totalUnits[side][i]) {
      variables.totalUnits[side][i].forEach(unit => {
        unit.type = '';
        unit.count = 0;
      });
    }

    if (variables.totalTools[side][i]) {
      variables.totalTools[side][i].forEach(tool => {
        tool.type = '';
        tool.count = 0;
      });
    }
  }

  for (let i = 1; i <= numberOfWaves; i++) {
    const wave = { slots: [], tools: [] };

    const numberOfUnitSlots = side === 'front' ? 3 : 2;
    const numberOfToolSlots = side === 'front' ? 3 : 2;

    let totalUnitCount = 0;
    for (let j = 1; j <= numberOfUnitSlots; j++) {
      let unitData = (variables.totalUnits[side] && variables.totalUnits[side][i - 1] && variables.totalUnits[side][i - 1][j - 1])
        ? variables.totalUnits[side][i - 1][j - 1]
        : { type: '', count: 0 };

      totalUnitCount += unitData.count || 0;

      if (totalUnitCount > maxUnits) {
        const excessUnits = totalUnitCount - maxUnits;
        unitData.count = Math.max(0, unitData.count - excessUnits);
        totalUnitCount = maxUnits;
      }

      wave.slots.push({ ...unitData, id: `unit-slot-${side}-${i}-${j}` });
    }

    let totalToolCount = 0;
    for (let j = 1; j <= numberOfToolSlots; j++) {
      let toolData = (variables.totalTools[side] && variables.totalTools[side][i - 1] && variables.totalTools[side][i - 1][j - 1])
        ? variables.totalTools[side][i - 1][j - 1]
        : { type: '', count: 0 };

      totalToolCount += toolData.count || 0;

      if (totalToolCount > maxTools) {
        const excessTools = totalToolCount - maxTools;
        toolData.count = Math.max(0, toolData.count - excessTools);
        totalToolCount = maxTools;
      }

      wave.tools.push({ ...toolData, id: `tool-slot-${side}-${i}-${j}` });
    }

    variables.waves[side].push(wave);

    const card = document.createElement('div');
    card.classList.add('card');

    const cardHeader = document.createElement('div');
    cardHeader.classList.add('card-header');
    cardHeader.id = `heading-${side}-${i}`;

    const topEffects = summarizeToolBonuses(wave.tools)
      .split('</div>')
      .slice(0, 2)
      .map(effect => {
        const iconMatch = effect.match(/<img.*?src="([^"]+)"/);
        return iconMatch ? `<img src="${iconMatch[1]}" alt="" class="effect-icon ms-1" />` : '';
      })
      .join('');

    const headerContent = `
      <h6 class="mb-0 d-flex justify-content-between align-items-center">
          <button class="btn btn-link ${variables.openWaves[i] ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse"
                  data-bs-target="#collapse-${side}-${i}" aria-expanded="${variables.openWaves[i] ? 'true' : 'false'}" aria-controls="collapse-${side}-${i}"
                  style="width: 100%; text-align: left; display: flex; justify-content: space-between; align-items: center;">
              <div class="left-content d-flex">
                  <span>${i} Attack Wave</span>
                  <div class="d-inline-block ms-2">${topEffects}</div>
              </div>
              <div class="right-content ms-auto">
                  <span class="units" id="units-${side}-${i}">
                      ${wave.slots.reduce((acc, slot) => acc + slot.count, 0)} / ${maxUnits} 
                      <img src="./img/troops-icon.webp" alt="Units" />
                  </span>
              </div>
          </button>
          <span class="arrow" aria-hidden="true" style="transform: ${variables.openWaves[i] ? 'rotate(90deg)' : 'rotate(0deg)'};"></span>
      </h6>
      `;

    cardHeader.innerHTML = headerContent;
    cardHeader.style.backgroundColor = variables.openWaves[i] ? '' : getWaveHeaderColor(wave);

    const cardBody = document.createElement('div');
    cardBody.id = `collapse-${side}-${i}`;
    cardBody.classList.add('collapse');
    cardBody.setAttribute('aria-labelledby', `heading-${side}-${i}`);

    const bodyContent = `
    <div class="card-body">
        <div class="row d-flex align-items-stretch">
            <div class="col" style="border-right: 1px solid rgb(180, 140, 100);">
                <img src="./img/troops-icon.webp" alt="Units" style="width: 20px; height: 20px; vertical-align: middle;" />
                <span class="units" id="units-${side}-${i}">Units ${wave.slots.reduce((acc, slot) => acc + slot.count, 0)} / ${maxUnits}</span>
                <div class="d-flex mt-1">
                    ${wave.slots.map(slot => `<div class="unit-slot" id="${slot.id}">${slot.count > 0 ? createUnitIcon(slot) : '+'}</div>`).join('')}
                </div>
                <div class="bonus-summary mt-2">
                    ${summarizeUnitBonuses(wave.slots)}
                </div>
            </div>
            <div class="col">
                <img src="./img/tools-icon.webp" alt="Tools" style="width: 20px; height: 20px; vertical-align: middle;" />
                <span class="tools" id="tools-${side}-${i}">Tools ${wave.tools.reduce((acc, tool) => acc + tool.count, 0)} / ${maxTools}</span>
                <div class="d-flex mt-1">
                    ${wave.tools.map(tool => `<div class="tool-slot" id="${tool.id}">${tool.count > 0 ? createToolIcon(tool) : '+'}</div>`).join('')}
                </div>
                <div class="bonus-summary mt-2">
                    ${summarizeToolBonuses(wave.tools)}
                </div>
            </div>
        </div>
    </div>
`;

    cardBody.innerHTML = bodyContent;
    card.appendChild(cardHeader);
    card.appendChild(cardBody);
    waveContainer.appendChild(card);

    const button = cardHeader.querySelector('button');
    const arrow = cardHeader.querySelector('.arrow');

    button.addEventListener('click', function () {
      if (this.classList.contains('collapsed')) {
        arrow.style.transform = 'rotate(0deg)';
        cardHeader.style.backgroundColor = getWaveHeaderColor(wave);
      } else {
        arrow.style.transform = 'rotate(90deg)';
        cardHeader.style.backgroundColor = '';
      }
    });

    const toolSlots = cardBody.querySelectorAll('.tool-slot');
    toolSlots.forEach(slot => {
      slot.addEventListener('click', () => {
        openToolModal(slot.id, side, i);
      });
    });

    if (variables.openWaves[i]) {
      cardBody.classList.add('show');
      cardHeader.classList.add('collapsed');
    }

    const slots = cardBody.querySelectorAll('.unit-slot');
    slots.forEach(slot => {
      slot.addEventListener('click', () => {
        openUnitModal(slot.id, side, i);
      });
    });

    cardBody.addEventListener('show.bs.collapse', function () {
      cardHeader.classList.add('collapsed');
      variables.openWaves[i] = true;
      cardHeader.style.backgroundColor = '';
    });

    cardBody.addEventListener('hide.bs.collapse', function () {
      cardHeader.classList.remove('collapsed');
      variables.openWaves[i] = false;
      if (!variables.openWaves[i]) {
        cardHeader.style.backgroundColor = getWaveHeaderColor(wave);
      }
    });
  }
  createCourtyardAssaultCard();
}

export function switchSide(side) {
  const buttons = document.querySelectorAll('.flanks-button');
  buttons.forEach(button => {
    button.classList.remove('active');
  });

  const activeButton = document.querySelector(`.flanks-button[data-section="${side}"]`);
  if (activeButton) {
    activeButton.classList.add('active');
  }
  variables.setCurrentSide(side);
  generateWaves(side, variables.attackBasics.maxWaves);

  const flankLabels = {
    left: 'Left flank',
    front: 'Front',
    right: 'Right flank',
    cy: 'Courtyard'
  };

  document.getElementById('current-flank').innerText = flankLabels[side] || '';

  for (let i = 1; i <= variables.attackBasics.maxWaves; i++) {
    const arrow = document.querySelector(`#heading-${side}-${i} .arrow`);
    const collapseElement = document.getElementById(`collapse-${side}-${i}`);

    if (variables.openWaves[i]) {
      collapseElement.classList.add('show');
      arrow.style.transform = 'rotate(90deg)';
    } else {
      collapseElement.classList.remove('show');
      arrow.style.transform = 'rotate(0deg)';
    }
  }
}

function getWaveHeaderColor(wave) {
  return wave.slots.some(slot => slot.count > 0) ? 'rgb(255, 255, 150)' : '';
}

export function updateHeaderColor(wave, side, waveIndex) {
  const cardHeader = document.getElementById(`heading-${side}-${waveIndex}`);
  cardHeader.style.backgroundColor = getWaveHeaderColor(wave);
}

export function openAllWaves() {
  const { attackBasics, waves, openWaves, currentSide } = variables;
  const openAllWavesButton = document.querySelector('.openAllWaves-button');

  let anyOpen = false;

  for (let i = 1; i <= attackBasics.maxWaves; i++) {
    const collapse = document.getElementById(`collapse-${currentSide}-${i}`);
    if (collapse && collapse.classList.contains('show')) anyOpen = true;
  }

  const supportCollapse = document.getElementById('collapseSupp');
  const courtyardCollapse = document.getElementById('collapseCY');
  if ((supportCollapse && supportCollapse.classList.contains('show')) ||
      (courtyardCollapse && courtyardCollapse.classList.contains('show'))) anyOpen = true;

  const action = anyOpen ? 'close' : 'open';

  for (let i = 1; i <= attackBasics.maxWaves; i++) {
    const collapse = document.getElementById(`collapse-${currentSide}-${i}`);
    const header = document.getElementById(`heading-${currentSide}-${i}`);
    const arrow = header?.querySelector('.arrow');
    const wave = waves[currentSide]?.[i - 1];
    const hasUnits = wave?.slots?.some(s => s.count > 0);

    if (header) header.style.backgroundColor = hasUnits ? 'rgb(255, 255, 150)' : '';

    if (collapse && header && arrow) {
      if (action === 'open') {
        collapse.classList.add('show');
        header.classList.add('collapsed');
        arrow.style.transform = 'rotate(90deg)';
        openWaves[i] = true;
      } else {
        collapse.classList.remove('show');
        header.classList.remove('collapsed');
        arrow.style.transform = 'rotate(0deg)';
        openWaves[i] = false;
      }
    }
  }

  if (supportCollapse) {
    const supportHeader = document.getElementById('headingSupp');
    const supportArrow = supportHeader?.querySelector('.arrow');
    if (action === 'open') {
      supportCollapse.classList.add('show');
      supportHeader.classList.add('collapsed');
      if (supportArrow) supportArrow.style.transform = 'rotate(90deg)';
      openWaves['Support'] = true;
    } else {
      supportCollapse.classList.remove('show');
      supportHeader.classList.remove('collapsed');
      if (supportArrow) supportArrow.style.transform = 'rotate(0deg)';
      openWaves['Support'] = false;
    }
  }

  if (courtyardCollapse) {
    const courtyardHeader = document.getElementById('headingCY');
    const courtyardArrow = courtyardHeader?.querySelector('.arrow');
    if (action === 'open') {
      courtyardCollapse.classList.add('show');
      courtyardHeader.classList.add('collapsed');
      if (courtyardArrow) courtyardArrow.style.transform = 'rotate(90deg)';
      openWaves['CY'] = true;
    } else {
      courtyardCollapse.classList.remove('show');
      courtyardHeader.classList.remove('collapsed');
      if (courtyardArrow) courtyardArrow.style.transform = 'rotate(0deg)';
      openWaves['CY'] = false;
    }
  }

  if (action === 'open') {
    openAllWavesButton.classList.add('active');
  } else {
    openAllWavesButton.classList.remove('active');
  }
}