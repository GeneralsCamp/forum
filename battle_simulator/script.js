///VARIABLES
let unitStats = [];
let tools = [];
let units = [];
let defense_units = [];
let defense_tools = [];
let supportTools = [];
const toolEffects = {};
const supportToolEffects = {};
const toolEffectsDefense = {};
const unitImages = {};
const unitImagesDefense = {};
const toolImages = {};
const toolImagesDefense = {};
const supportToolImages = {};

let totalUnits = { left: [], front: [], right: [] };
let totalTools = { left: [], front: [], right: [] };
let waves = { left: [], front: [], right: [] };
let openWaves = {};

let currentTotalUnits = { left: 0, front: 0, right: 0, cy: 0 };
let defenseSlots = {
  front: { units: [], wallTools: [], gateTools: [], moatTools: [] },
  left: { units: [], wallTools: [], gateTools: [], moatTools: [] },
  right: { units: [], wallTools: [], gateTools: [], moatTools: [] },
  cy: { units: [], cyTools: [] }
};

let currentSide = 'front';

const defenseSides = {
  front: {
    name: "Front",
    tools: { wall: 4, gate: 2, moat: 1 }
  },
  left: {
    name: "Left flank",
    tools: { wall: 5, moat: 1 }
  },
  right: {
    name: "Right flank",
    tools: { wall: 5, moat: 1 }
  },
  cy: {
    name: "Courtyard",
    tools: { courtyard: 3 }
  }
};

let copiedUnits = null;
let copiedTools = null;
let presets = {
  1: null, 2: null, 3: null, 4: null,
  5: null, 6: null, 7: null, 8: null
};
let selectedPreset = null;
let currentWaveIndex = 1;

let notificationTimeout = null;

function loadData() {
  fetch('data.json')
    .then(response => response.json())
    .then(data => {
      units = data.attack_units;
      defense_units = data.defense_units;
      tools = data.tools;
      defense_tools = data.defense_tools;
      supportTools = data.Supporttools;

      units.forEach(unit => {
        if (unit.id === "unit2") {
          unit.meleeCombatStrength = 225 + (attackBasics.meadMeleeLevel * 10);
          unit.LootingCapacity = 43 + (attackBasics.meadMeleeLevel * 2);
        }
        if (unit.id === "unit1") {
          unit.rangedCombatStrength = 210 + (attackBasics.meadRangeLevel * 10);
          unit.LootingCapacity = 40 + (attackBasics.meadRangeLevel * 2);
        }
        if (unit.id === "unit8") {
          unit.meleeCombatStrength = 370 + (attackBasics.beafMeleeLevel * 5);
        }
        if (unit.id === "unit7") {
          unit.rangedCombatStrength = 390 + (attackBasics.beafRangeLevel * 5);
        }
        if (unit.id === "unit10") {
          unit.meleeCombatStrength = 430 + (attackBasics.beafVeteranMeleeLevel * 5);
        }
        if (unit.id === "unit9") {
          unit.rangedCombatStrength = 450 + (attackBasics.beafVeteranRangeLevel * 5);
        }
        unitStats.push({
          type: `Unit${unit.id.charAt(unit.id.length - 1)}`,
          rangedCombatStrength: unit.rangedCombatStrength,
          meleeCombatStrength: unit.meleeCombatStrength,
          image: unit.image
        });
        unitImages[`Unit${unit.id.charAt(unit.id.length - 1)}`] = unit.image;
      });

      defense_units.forEach(unit => {
        unitStats.push({
          type: `DefenseUnit${unit.id.charAt(unit.id.length - 1)}`,
          meleeDefenseStrength: unit.meleeDefenseStrength,
          rangedDefenseStrength: unit.rangedDefenseStrength,
          image: unit.image
        });
        unitImagesDefense[`DefenseUnit${unit.id.charAt(unit.id.length - 1)}`] = unit.image;
      });

      tools.forEach(tool => {
        toolEffects[`Tool${tool.id.charAt(tool.id.length - 1)}`] = {
          effect1: {
            value: tool.effect1Value,
            icon: tool.effectImage1,
            name: tool.effect1Type.charAt(0).toUpperCase() + tool.effect1Type.slice(1)
          },
          effect2: {
            value: tool.effect2Value,
            icon: tool.effectImage2,
            name: tool.effect2Type.charAt(0).toUpperCase() + tool.effect2Type.slice(1)
          },
          image: tool.image
        };
        toolImages[`Tool${tool.id.charAt(tool.id.length - 1)}`] = tool.image;
      });
      defense_tools.forEach(tool => {
        toolEffectsDefense[tool.id] = {
          effect1: {
            value: tool.effect1Value,
            icon: tool.effectImage1,
            name: tool.effect1Type.charAt(0).toUpperCase() + tool.effect1Type.slice(1)
          },
          effect2: {
            value: tool.effect2Value,
            icon: tool.effectImage2,
            name: tool.effect2Type.charAt(0).toUpperCase() + tool.effect2Type.slice(1)
          },
          image: tool.image
        };
        toolImagesDefense[`DefenseTool${tool.id}`] = tool.image;
      });
      supportTools.forEach(tool => {
        supportToolImages[`Tool${tool.id.charAt(tool.id.length - 1)}`] = tool.image;
        supportToolEffects[`Tool${tool.id.charAt(tool.id.length - 1)}`] = {
          effect1: {
            value: tool.effect1Value,
            icon: tool.effectImage1,
            name: tool.effect1Type.charAt(0).toUpperCase() + tool.effect1Type.slice(1)
          },
          effect2: {
            value: tool.effect2Value,
            icon: tool.effectImage2,
            name: tool.effect2Type.charAt(0).toUpperCase() + tool.effect2Type.slice(1)
          }
        };
      });

      initializeUnits(units);
      initializeDefenseUnits(defense_units);
      initializeTools(tools);
      initializeSupportTools(supportTools);
    })
    .catch(error => console.error('Error loading JSON:', error));
}
loadData();

let commanderStats = {
  melee: 0,
  ranged: 0,
  universal: 0,
  courtyard: 0,
  wallReduction: 0,
  moatReduction: 0,
  gateReduction: 0,
  meadStrength: 0,
  horrorStrength: 0,
  holMelee: 0,
  holRanged: 0,
  holUniversal: 0,
  frontStrength: 0,
  flanksStrength: 0
};

let castellanStats = {
  melee: 100,
  ranged: 100,
  courtyard: 0,
  wallUnitLimit: 100,
  cyUnitLimit: 10000,
  wallProtection: 0,
  moatProtection: 0,
  gateProtection: 0,
};

let attackBasics = {
  maxWaves: 4,
  maxUnitsCY: 2089,
  maxUnits: { front: 192, left: 64, right: 64 },
  maxTools: { front: 50, left: 40, right: 40 },
  meadRangeLevel: 10,
  meadMeleeLevel: 10,
  beafRangeLevel: 10,
  beafMeleeLevel: 10,
  beafVeteranRangeLevel: 10,
  beafVeteranMeleeLevel: 10
};

window.addEventListener('load', () => {
  const savedCommanderStats = localStorage.getItem('commanderStats');
  const savedCastellanStats = localStorage.getItem('castellanStats');
  const savedAttackBasics = localStorage.getItem('attackBasics');

  if (savedCommanderStats) {
    commanderStats = JSON.parse(savedCommanderStats);
  }

  if (savedCastellanStats) {
    castellanStats = JSON.parse(savedCastellanStats);
  }

  if (savedAttackBasics) {
    attackBasics = JSON.parse(savedAttackBasics);
  }

  attackBasics.meadRangeLevel = attackBasics.meadRangeLevel || 10;
  attackBasics.meadMeleeLevel = attackBasics.meadMeleeLevel || 10;

  attackBasics.beafRangeLevel = attackBasics.beafRangeLevel || 10;
  attackBasics.beafMeleeLevel = attackBasics.beafMeleeLevel || 10;

  attackBasics.beafVeteranRangeLevel = attackBasics.meadRangeLevel || 10;
  attackBasics.beafVeteranMeleeLevel = attackBasics.meadMeleeLevel || 10;
});

const toolSlotRestrictions = {
  wall: ['tool1', 'tool2', 'tool3', 'tool8', 'tool10'],
  gate: ['tool4', 'tool6'],
  moat: ['tool5', 'tool7', 'tool9'],
  cy: ['tool11', 'tool12', 'tool13', 'tool14', 'tool15']
};

const collapseButtons = document.querySelectorAll('.card-header button');
collapseButtons.forEach(button => {
  button.addEventListener('click', function () {
    const cardHeader = this.closest('.card-header');
    cardHeader.classList.toggle('collapsed', !this.classList.contains('collapsed'));
  });
});

/// FUNCTIONS
function updateUnitStrengths() {
  units.forEach(unit => {
    if (unit.id === "unit2") {
      unit.meleeCombatStrength = 225 + (attackBasics.meadMeleeLevel * 10);
      unit.LootingCapacity = 43 + (attackBasics.meadMeleeLevel * 2);
    }
    if (unit.id === "unit1") {
      unit.rangedCombatStrength = 210 + (attackBasics.meadRangeLevel * 10);
      unit.LootingCapacity = 40 + (attackBasics.meadRangeLevel * 2);
    }
    if (unit.id === "unit8") {
      unit.meleeCombatStrength = 370 + (attackBasics.beafMeleeLevel * 5);
    }
    if (unit.id === "unit7") {
      unit.rangedCombatStrength = 390 + (attackBasics.beafRangeLevel * 5);
    }
    if (unit.id === "unit10") {
      unit.meleeCombatStrength = 430 + (attackBasics.beafVeteranMeleeLevel * 5);
    }
    if (unit.id === "unit9") {
      unit.rangedCombatStrength = 450 + (attackBasics.beafVeteranRangeLevel * 5);
    }
  });

  unitStats = units.map(unit => {
    return {
      type: `Unit${unit.id.charAt(unit.id.length - 1)}`,
      rangedCombatStrength: unit.rangedCombatStrength || 0,
      meleeCombatStrength: unit.meleeCombatStrength || 0,
      image: unit.image
    };
  });
}

function initializeUnits(units) {
  const unitModalBody = document.querySelector('#unitModal .modal-body');

  unitModalBody.innerHTML = '';

  units.forEach((unit, index) => {
    const effects = [];

    if (unit.travelSpeed > 0) {
      effects.push(`
                <img src="./img/travelSpeed-icon.png" alt="" class="combat-icon" />
                <span class="me-2">+${unit.travelSpeed}</span>
        `);
    }

    if (unit.rangedCombatStrength > 0) {
      effects.push(`
                <img src="./img/ranged-icon.png" alt="" class="combat-icon" />
                <span class="me-2">+${unit.rangedCombatStrength}</span>
        `);
    }

    if (unit.meleeCombatStrength > 0) {
      effects.push(`
                <img src="./img/melee-icon.png" alt="" class="combat-icon" />
                <span class="me-2">+${unit.meleeCombatStrength}</span>
        `);
    }

    if (unit.LootingCapacity > 0) {
      effects.push(`
                <img src="./img/loot-icon.png" alt="" class="combat-icon" />
                <span class="me-2">+${unit.LootingCapacity}</span>
        `);
    }

    let levelInfo = '';
    if (unit.id === "unit1") {
      levelInfo = `(Lv.${attackBasics.meadRangeLevel})`;
    } else if (unit.id === "unit2") {
      levelInfo = `(Lv.${attackBasics.meadMeleeLevel})`;
    } else if (unit.id === "unit7") {
      levelInfo = `(Lv.${attackBasics.beafRangeLevel})`;
    } else if (unit.id === "unit8") {
      levelInfo = `(Lv.${attackBasics.beafMeleeLevel})`;
    } else if (unit.id === "unit9") {
      levelInfo = `(Lv.${attackBasics.beafVeteranRangeLevel})`;
    } else if (unit.id === "unit10") {
      levelInfo = `(Lv.${attackBasics.beafVeteranMeleeLevel})`;
    }

    const unitCard = `
    <div class="col-12">
        <div class="card w-100">
            <div class="modal-card-body mt-1">
                <h6 class="card-title text-center">${unit.name} ${levelInfo}</h6>
                <div class="d-flex align-items-center">
                    <div class="me-2">
                        <img src="./img/icon_unit${index + 1}.webp" alt="${unit.id}" class="unit-image" />
                    </div>
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center">
                            <input type="range" id="unit${index + 1}" min="0" value="0" class="form-range me-2" />
                            <span id="unit${index + 1}-value" class="selector-value">0</span>
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

    unitModalBody.insertAdjacentHTML('beforeend', unitCard);

    const unitRange = document.getElementById(`unit${index + 1}`);
    unitRange.addEventListener('input', function () {
      document.getElementById(`unit${index + 1}-value`).textContent = this.value;
    });
  });
}

function initializeTools(tools) {
  const toolModalBody = document.querySelector('#toolModal .modal-body');

  toolModalBody.innerHTML = '';

  tools.forEach((tool, index) => {
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
        <span class="me-2">${tool.effect1Value}%</span>
      `);
    }

    if (tool.effect2Type && tool.effect2Value !== 0) {
      effects.push(`
        <img src="./img/${tool.effectImage2}" alt="${tool.effect2Type}" class="combat-icon" />
        <span class="me-2">+${tool.effect2Value}%</span>
      `);
    }

    if (tool.toolLimit && tool.toolLimit !== 0) {
      effects.push(`
        <img src="./img/unitLimit-icon.png" alt="tool-limit" class="combat-icon" />
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
                        <img src="./img/${tool.image}" alt="${tool.name}" class="tool-image" />
                    </div>
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center">
                            <input type="range" id="tool${index + 1}" min="0" max="5" value="0" class="form-range me-2" />
                            <span id="tool${index + 1}-value" class="selector-value">0</span>
                        </div>
                        <div class="mt-2">
                            <div class="d-flex align-items-center">
                            </div>
                            ${effects.join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;

    function getEffectIcon(effectType) {
      const effect = Object.values(toolEffects).find(tool => tool.name.toLowerCase() === effectType.toLowerCase());
      return effect ? effect.icon : 'default-icon.png';
    }

    toolModalBody.insertAdjacentHTML('beforeend', toolCard);

    const toolRange = document.getElementById(`tool${index + 1}`);
    toolRange.addEventListener('input', function () {
      document.getElementById(`tool${index + 1}-value`).textContent = this.value;
    });
  });
}

function generateWaves(side, numberOfWaves) {
  waves[side] = [];
  const waveContainer = document.getElementById('wave-container');
  waveContainer.innerHTML = '';

  createSupportWaveCard();

  const maxUnits = attackBasics.maxUnits[side];
  const maxTools = attackBasics.maxTools[side];

  for (let i = numberOfWaves; i < totalUnits[side].length; i++) {

    if (totalUnits[side][i]) {
      totalUnits[side][i].forEach(unit => {
        unit.type = '';
        unit.count = 0;
      });
    }

    if (totalTools[side][i]) {
      totalTools[side][i].forEach(tool => {
        tool.type = '';
        tool.count = 0;
      });
    }
  }

  for (let i = 1; i <= numberOfWaves; i++) {
    const wave = {
      slots: [],
      tools: []
    };

    const numberOfUnitSlots = side === 'front' ? 3 : 2;
    const numberOfToolSlots = side === 'front' ? 3 : 2;

    let totalUnitCount = 0;
    for (let j = 1; j <= numberOfUnitSlots; j++) {
      let unitData = (totalUnits[side] && totalUnits[side][i - 1] && totalUnits[side][i - 1][j - 1])
        ? totalUnits[side][i - 1][j - 1]
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
      let toolData = (totalTools[side] && totalTools[side][i - 1] && totalTools[side][i - 1][j - 1])
        ? totalTools[side][i - 1][j - 1]
        : { type: '', count: 0 };

      totalToolCount += toolData.count || 0;

      if (totalToolCount > maxTools) {
        const excessTools = totalToolCount - maxTools;
        toolData.count = Math.max(0, toolData.count - excessTools);
        totalToolCount = maxTools;
      }

      wave.tools.push({ ...toolData, id: `tool-slot-${side}-${i}-${j}` });
    }


    waves[side].push(wave);

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
          <button class="btn btn-link ${openWaves[i] ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse"
                  data-bs-target="#collapse-${side}-${i}" aria-expanded="${openWaves[i] ? 'true' : 'false'}" aria-controls="collapse-${side}-${i}"
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
          <span class="arrow" aria-hidden="true" style="transform: ${openWaves[i] ? 'rotate(90deg)' : 'rotate(0deg)'};"></span>
      </h6>
      `;

    cardHeader.innerHTML = headerContent;

    cardHeader.style.backgroundColor = openWaves[i] ? '' : getWaveHeaderColor(wave);

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
                <div class="d-flex">
                    ${wave.slots.map(slot => `<div class="unit-slot" id="${slot.id}">${slot.count > 0 ? createUnitIcon(slot) : '+'}</div>`).join('')}
                </div>
                <div class="bonus-summary mt-2">
                    ${summarizeUnitBonuses(wave.slots)}
                </div>
            </div>
            <div class="col">
                <img src="./img/tools-icon.webp" alt="Tools" style="width: 20px; height: 20px; vertical-align: middle;" />
                <span class="tools" id="tools-${side}-${i}">Tools ${wave.tools.reduce((acc, tool) => acc + tool.count, 0)} / ${maxTools}</span>
                <div class="d-flex">
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

    if (openWaves[i]) {
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
      openWaves[i] = true;
      cardHeader.style.backgroundColor = '';
    });

    cardBody.addEventListener('hide.bs.collapse', function () {
      cardHeader.classList.remove('collapsed');
      openWaves[i] = false;
      if (!openWaves[i]) {
        cardHeader.style.backgroundColor = getWaveHeaderColor(wave);
      }
    });
  }

  createCourtyardAssaultCard();
}

function createSupportWaveCard() {
  if (!waves['Support']) {
    waves['Support'] = [{
      tools: Array.from({ length: 3 }, (_, index) => ({ type: '', count: 0, id: `tool-slot-Support-${index + 1}` }))
    }];
  }

  const supportCard = document.createElement('div');
  supportCard.classList.add('card');

  const supportHeader = document.createElement('div');
  supportHeader.classList.add('card-header');
  supportHeader.id = 'headingSupp';

  const headerContent = `
    <h6 class="mb-0 d-flex justify-content-between align-items-center">
      <button class="btn btn-link ${openWaves['Support'] ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse"
              data-bs-target="#collapseSupp" aria-expanded="${openWaves['Support'] ? 'true' : 'false'}" aria-controls="collapseSupp"
              style="width: 100%; text-align: left;">
        Support wave
      </button>
      <span class="arrow" aria-hidden="true" style="transform: ${openWaves['Support'] ? 'rotate(90deg)' : 'rotate(0deg)'};"></span>
    </h6>
  `;
  supportHeader.innerHTML = headerContent;

  const supportBody = document.createElement('div');
  supportBody.id = 'collapseSupp';
  supportBody.classList.add('collapse');
  supportBody.setAttribute('aria-labelledby', 'headingSupp');
  const supportBodyContent = `
  <div class="card-body">
  <div class="row d-flex align-items-start">
      <div class="col-6 bugfix">
        <span class="tools">
          <img src="./img/tools-icon.webp" alt="Tools" style="width: 20px; height: 20px; vertical-align: middle;" />
          Tools ${waves['Support'][0].tools.reduce((acc, tool) => acc + tool.count, 0)} / 3
        </span>
      <div class="row ms-1">
         ${Array.from({ length: 3 }, (_, index) => `<div class="tool-slot" id="tool-slot-Support-${index + 1}">+</div>`).join('')}
      </div>
      </div>
      <div class="col">
          <div class="bonus-summary mt-4">
          ${summarizeSupportToolBonuses(waves['Support'][0].tools)}
          </div>
      </div>
  </div>
</div>  `;

  supportBody.innerHTML = supportBodyContent;

  supportCard.appendChild(supportHeader);
  supportCard.appendChild(supportBody);
  document.getElementById('wave-container').appendChild(supportCard);

  const button = supportHeader.querySelector('button');
  const arrow = supportHeader.querySelector('.arrow');

  button.addEventListener('click', function () {
    if (this.classList.contains('collapsed')) {
      arrow.style.transform = 'rotate(0deg)';
    } else {
      arrow.style.transform = 'rotate(90deg)';
    }
  });

  const toolSlots = supportBody.querySelectorAll('.tool-slot');
  toolSlots.forEach((slot, index) => {
    const slotData = waves['Support'][0].tools[index];
    if (slotData.count > 0) {
      slot.innerHTML = createSupportToolIcon(slotData);
      supportHeader.style.backgroundColor = 'rgb(255, 255, 150)';
    }

    slot.addEventListener('click', () => {
      openSupportToolModal(slot.id);
    });
  });

  supportBody.addEventListener('show.bs.collapse', function () {
    supportHeader.classList.add('collapsed');
    openWaves['Support'] = true;
  });

  supportBody.addEventListener('hide.bs.collapse', function () {
    supportHeader.classList.remove('collapsed');
    openWaves['Support'] = false;
  });

  if (openWaves['Support']) {
    supportBody.classList.add('show');
    supportHeader.classList.add('collapsed');
  }
}

function openSupportToolModal(slotId) {
  const modal = new bootstrap.Modal(document.getElementById('supportToolModal'));
  const slotElement = document.getElementById(slotId);
  const supportWave = waves['Support'][0];
  const slot = supportWave.tools.find(s => s.id === slotId);

  const maxSupportTools = 3;
  const totalSupportToolsInWave = supportWave.tools.reduce((acc, s) => s.id !== slotId ? acc + s.count : acc, 0);
  let availableTools = maxSupportTools - totalSupportToolsInWave;

  const usedToolTypes = supportWave.tools
    .filter(s => s.id !== slotId)
    .map(tool => tool.type)
    .filter(type => type !== '');

  supportTools.forEach((tool, index) => {
    const count = slot.count > 0 && slot.type === `Tool${tool.id.charAt(tool.id.length - 1)}` ? slot.count : 0;

    const toolRange = document.getElementById(`supportTool${index + 1}`);
    const toolValue = document.getElementById(`supportTool${index + 1}-value`);

    if (toolRange && toolValue) {
      toolRange.value = count;

      const toolLimit = tool.toolLimit > 0 ? tool.toolLimit : availableTools;
      toolRange.max = Math.min(toolLimit, availableTools);

      if (usedToolTypes.includes(`Tool${tool.id.charAt(tool.id.length - 1)}`) && slot.type !== `Tool${tool.id.charAt(tool.id.length - 1)}`) {
        toolRange.disabled = true;
      } else {
        toolRange.disabled = false;
      }

      toolValue.textContent = count;

      toolRange.addEventListener('input', function () {
        toolValue.textContent = this.value;

        supportTools.forEach((otherTool, otherIndex) => {
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

    supportTools.forEach((tool, index) => {
      const toolRange = document.getElementById(`supportTool${index + 1}`);
      const toolCount = parseInt(toolRange ? toolRange.value : 0);
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

      slotElement.innerHTML = (slot.count > 0) ? createSupportToolIcon(slot) : '+';

      const toolBonuses = summarizeSupportToolBonuses(supportWave.tools);

      const bonusElement = document.querySelector(`#tools-Support .bonus-summary`);
      if (bonusElement) {
        bonusElement.innerHTML = toolBonuses;
      }

      if (!totalTools['Support']) {
        totalTools['Support'] = [];
      }
      totalTools['Support'][0] = supportWave.tools;

      createSupportWaveCard();
      switchSide(currentSide);
    }

    modal.hide();
  };

  modal.show();
}

function createCourtyardAssaultCard() {
  if (!waves['CY']) {
    waves['CY'] = [{
      slots: totalUnits['CY'] ? totalUnits['CY'][0].slots : Array.from({ length: 8 }, (_, index) => ({ type: '', count: 0, id: `unit-slot-CY-${index + 1}` }))
    }];
  }

  let totalUnitsInCourtyard = waves['CY'][0].slots.reduce((acc, slot) => acc + slot.count, 0);
  const maxUnitsCY = attackBasics.maxUnitsCY;

  if (totalUnitsInCourtyard > maxUnitsCY) {

    let excessUnits = totalUnitsInCourtyard - maxUnitsCY;

    for (let slot of waves['CY'][0].slots) {
      if (excessUnits > 0 && slot.count > 0) {
        let toRemove = Math.min(slot.count, excessUnits);
        slot.count -= toRemove;
        excessUnits -= toRemove;
      }
    }
  }

  const courtyardCard = document.createElement('div');
  courtyardCard.classList.add('card');

  const courtyardHeader = document.createElement('div');
  courtyardHeader.classList.add('card-header');
  courtyardHeader.id = 'headingCY';

  const headerContent = `
  <h6 class="mb-0 d-flex justify-content-between align-items-center">
    <button class="btn btn-link ${openWaves['CY'] ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse"
            data-bs-target="#collapseCY" aria-expanded="${openWaves['CY'] ? 'true' : 'false'}" aria-controls="collapseCY"
            style="width: 100%; text-align: left; display: flex; justify-content: space-between; align-items: center;">
      <div class="left-content">
        Courtyard Assault
      </div>
      <div class="right-content ms-auto">
        <span class="units">
          ${waves['CY'][0].slots.reduce((acc, slot) => acc + slot.count, 0)} / ${attackBasics.maxUnitsCY}  
          <img src="./img/troops-icon.webp" alt="Units"/>
        </span>
      </div>
    </button>
    <span class="arrow" aria-hidden="true" style="transform: ${openWaves['CY'] ? 'rotate(90deg)' : 'rotate(0deg)'};"></span>
  </h6>
`;

  courtyardHeader.innerHTML = headerContent;

  courtyardHeader.style.backgroundColor = openWaves['CY'] ? '' : getCourtyardHeaderColor();

  const courtyardBody = document.createElement('div');
  courtyardBody.id = 'collapseCY';
  courtyardBody.classList.add('collapse');
  courtyardBody.setAttribute('aria-labelledby', 'headingCY');

  const courtyardBodyContent = `
  <div class="card-body">
  <div class="row d-flex align-items-start">
      <div class="col-8 bugfix">
          <img src="./img/troops-icon.webp" alt="Units" style="width: 20px; height: 20px; vertical-align: middle;" />
          <span class="units">Units ${waves['CY'][0].slots.reduce((acc, slot) => acc + slot.count, 0)} / ${attackBasics.maxUnitsCY}</span>
      <div class="row ms-1">
        ${Array.from({ length: 4 }, (_, index) => `<div class="unit-slot" id="unit-slot-CY-${index + 1}">+</div>`).join('')}
      </div>
      <div class="row ms-1 mt-1">
        ${Array.from({ length: 4 }, (_, index) => `<div class="unit-slot" id="unit-slot-CY-${index + 5}">+</div>`).join('')}
      </div>
      </div>
      <div class="col-4">
          <div class="bonus-summary mt-4">
              ${summarizeCourtyardUnitBonuses()}
          </div>
      </div>
  </div>
</div>  `;

  courtyardBody.innerHTML = courtyardBodyContent;

  courtyardCard.appendChild(courtyardHeader);
  courtyardCard.appendChild(courtyardBody);
  document.getElementById('wave-container').appendChild(courtyardCard);

  const button = courtyardHeader.querySelector('button');
  const arrow = courtyardHeader.querySelector('.arrow');

  button.addEventListener('click', function () {
    if (this.classList.contains('collapsed')) {
      arrow.style.transform = 'rotate(0deg)';
      courtyardHeader.style.backgroundColor = getCourtyardHeaderColor();
    } else {
      arrow.style.transform = 'rotate(90deg)';
      courtyardHeader.style.backgroundColor = '';
    }
  });

  const unitSlots = courtyardBody.querySelectorAll('.unit-slot');
  unitSlots.forEach((slot, index) => {
    const slotData = waves['CY'][0].slots[index];
    if (slotData.count > 0) {
      slot.innerHTML = createUnitIcon(slotData);
    }

    slot.addEventListener('click', () => {
      openCourtyardUnitModal(slot.id);
    });
  });

  courtyardBody.addEventListener('show.bs.collapse', function () {
    courtyardHeader.classList.add('collapsed');
    openWaves['CY'] = true;
    courtyardHeader.style.backgroundColor = '';
  });

  courtyardBody.addEventListener('hide.bs.collapse', function () {
    courtyardHeader.classList.remove('collapsed');
    openWaves['CY'] = false;
    courtyardHeader.style.backgroundColor = getCourtyardHeaderColor();
  });

  if (openWaves['CY']) {
    courtyardBody.classList.add('show');
    courtyardHeader.classList.add('collapsed');
  }

  updateCourtyardHeaderColor();
}

function getCourtyardHeaderColor() {
  const courtyardSlots = waves['CY'] && waves['CY'][0] ? waves['CY'][0].slots : [];
  return courtyardSlots.some(slot => slot.count > 0) ? 'rgb(255, 255, 150)' : '';
}

function updateCourtyardHeaderColor() {
  const cardHeader = document.getElementById('headingCY');
  cardHeader.style.backgroundColor = getCourtyardHeaderColor();
}

function openCourtyardUnitModal(slotId) {
  const modal = new bootstrap.Modal(document.getElementById('unitModal'));
  const slotElement = document.getElementById(slotId);
  const wave = waves['CY'][0];

  if (!wave || !wave.slots) {
    console.error('Courtyard wave or slots not found.');
    return;
  }

  const slot = wave.slots.find(s => s.id === slotId);

  if (!slot) {
    console.error(`Slot not found for slotId: ${slotId}`);
    return;
  }

  const maxUnitsInCourtyard = attackBasics.maxUnitsCY;
  const totalUnitsInCourtyard = wave.slots.reduce((acc, s) => s.id !== slotId ? acc + s.count : acc, 0);
  let availableUnits = maxUnitsInCourtyard - totalUnitsInCourtyard;

  units.forEach((unit, index) => {
    const count = slot.count > 0 && slot.type === `Unit${unit.id.charAt(unit.id.length - 1)}` ? slot.count : 0;

    const unitRange = document.getElementById(`unit${index + 1}`);
    const unitValue = document.getElementById(`unit${index + 1}-value`);

    if (unitRange && unitValue) {
      unitRange.value = count;
      unitRange.max = availableUnits;
      unitValue.textContent = count;

      unitRange.addEventListener('input', function () {
        unitValue.textContent = this.value;

        units.forEach((otherUnit, otherIndex) => {
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

    units.forEach((unit, index) => {
      const unitRange = document.getElementById(`unit${index + 1}`);
      const unitCount = parseInt(unitRange ? unitRange.value : 0);
      if (unitCount > 0) {
        totalUnitsInSlot += unitCount;
        selectedUnitType = `Unit${unit.id.charAt(unit.id.length - 1)}`;
      }
    });

    if (totalUnitsInCourtyard + totalUnitsInSlot > maxUnitsInCourtyard) {
      alert(`Cannot exceed ${maxUnitsInCourtyard} units in the Courtyard!`);
      return;
    }

    if (slot) {
      slot.type = selectedUnitType || '';
      slot.count = totalUnitsInSlot;

      if (!totalUnits['CY']) {
        totalUnits['CY'] = [];
      }
      totalUnits['CY'][0] = wave.slots;

      slotElement.innerHTML = (slot.count > 0) ? createUnitIcon(slot) : '+';

      const unitBonuses = summarizeCourtyardUnitBonuses();
      const bonusElement = document.querySelector(`#units-CY .bonus-summary`);
      if (bonusElement) {
        bonusElement.innerHTML = unitBonuses;
      }

      updateCourtyardHeaderColor();
      switchSide(currentSide);
    }

    modal.hide();
  };

  modal.show();
}

function initializeSupportTools(supportTools) {
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
                <div class="mt-2">
                  <div class="d-flex align-items-center">
                  </div>
                  ${effects.join('')}
                </div>
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

function summarizeCourtyardUnitBonuses() {
  if (!waves['CY'] || !waves['CY'][0].slots) return '';

  const totalStats = {
    ranged: 0,
    melee: 0
  };

  const supportWaveContainsTool3 = waves['Support'] && waves['Support'][0].tools.some(tool => tool.type === 'Tool3');

  waves['CY'][0].slots.forEach(slot => {
    const unitStat = unitStats.find(unit => unit.type === slot.type);
    if (unitStat) {
      let ranged = slot.count * unitStat.rangedCombatStrength;
      let melee = slot.count * unitStat.meleeCombatStrength;

      if (slot.type === 'Unit1') {
        ranged += slot.count * commanderStats.meadStrength;
      }

      if (slot.type === 'Unit2') {
        melee += slot.count * commanderStats.meadStrength;
      }

      if (slot.type === 'Unit3' || slot.type === 'Unit5') {
        ranged += slot.count * commanderStats.horrorStrength;
      }

      if (slot.type === 'Unit4' || slot.type === 'Unit6') {
        melee += slot.count * commanderStats.horrorStrength;
      }

      totalStats.ranged += ranged;
      totalStats.melee += melee;
    }
  });

  let totalRangedBonusPercentage = commanderStats.ranged + commanderStats.holRanged + commanderStats.universal + commanderStats.holUniversal;
  let totalMeleeBonusPercentage = commanderStats.melee + commanderStats.holMelee + commanderStats.universal + commanderStats.holUniversal;

  if (supportWaveContainsTool3) {
    totalRangedBonusPercentage += 5;
    totalMeleeBonusPercentage += 5;
  }

  let result = [];

  if (totalStats.ranged > 0) {
    const rangedBonus = totalStats.ranged * (totalRangedBonusPercentage / 100);
    const totalRanged = totalStats.ranged + rangedBonus;
    result.push({ type: 'ranged', value: Math.round(totalRanged), icon: './img/ranged-icon.png' });
  }

  if (totalStats.melee > 0) {
    const meleeBonus = totalStats.melee * (totalMeleeBonusPercentage / 100);
    const totalMelee = totalStats.melee + meleeBonus;
    result.push({ type: 'melee', value: Math.round(totalMelee), icon: './img/melee-icon.png' });
  }

  result.sort((a, b) => b.value - a.value);

  const rows = result.map(stat => {
    return `<div class="col-12 effect-slot"><img src="${stat.icon}" alt="${stat.type.charAt(0).toUpperCase() + stat.type.slice(1)}" /> +${new Intl.NumberFormat().format(stat.value)}</div>`;
  }).join('');

  return rows ? `<div class="row">${rows}</div>` : '';
}

function summarizeUnitBonuses(slots) {
  const totalStats = {
    ranged: 0,
    melee: 0
  };

  const supportWaveContainsTool3 = waves['Support'] && waves['Support'][0].tools.some(tool => tool.type === 'Tool3');

  slots.forEach(slot => {
    const unitStat = unitStats.find(unit => unit.type === slot.type);
    if (unitStat) {
      let ranged = slot.count * unitStat.rangedCombatStrength;
      let melee = slot.count * unitStat.meleeCombatStrength;

      if (slot.type === 'Unit1') {
        ranged += slot.count * commanderStats.meadStrength;
      }

      if (slot.type === 'Unit2') {
        melee += slot.count * commanderStats.meadStrength;
      }

      if (slot.type === 'Unit3' || slot.type === 'Unit5') {
        ranged += slot.count * commanderStats.horrorStrength;
      }

      if (slot.type === 'Unit4' || slot.type === 'Unit6') {
        melee += slot.count * commanderStats.horrorStrength;
      }

      totalStats.ranged += ranged;
      totalStats.melee += melee;
    }
  });

  let totalRangedBonusPercentage = commanderStats.ranged + commanderStats.holRanged + commanderStats.universal + commanderStats.holUniversal;
  let totalMeleeBonusPercentage = commanderStats.melee + commanderStats.holMelee + commanderStats.universal + commanderStats.holUniversal;

  if (currentSide === 'front') {
    totalMeleeBonusPercentage += commanderStats.frontStrength;
    totalRangedBonusPercentage += commanderStats.frontStrength;
  } else if (currentSide === 'left' || currentSide === 'right') {
    totalMeleeBonusPercentage += commanderStats.flanksStrength;
    totalRangedBonusPercentage += commanderStats.flanksStrength;
  }

  if (supportWaveContainsTool3) {
    totalRangedBonusPercentage += 5;
    totalMeleeBonusPercentage += 5;
  }

  let result = [];

  if (totalStats.ranged > 0) {
    const rangedBonus = totalStats.ranged * (totalRangedBonusPercentage / 100);
    const totalRanged = totalStats.ranged + rangedBonus;
    result.push({ type: 'ranged', value: Math.round(totalRanged) });
  }

  if (totalStats.melee > 0) {
    const meleeBonus = totalStats.melee * (totalMeleeBonusPercentage / 100);
    const totalMelee = totalStats.melee + meleeBonus;
    result.push({ type: 'melee', value: Math.round(totalMelee) });
  }

  result.sort((a, b) => b.value - a.value);

  const rows = result.map(stat => {
    const icon = stat.type === 'ranged' ? './img/ranged-icon.png' : './img/melee-icon.png';
    const formattedValue = new Intl.NumberFormat().format(stat.value);
    return `<div class="col-6 effect-slot"><img src="${icon}" alt="${stat.type.charAt(0).toUpperCase() + stat.type.slice(1)}" /> +${formattedValue}</div>`;
  }).join('');

  return rows ? `<div class="row">${rows}</div>` : '';
}

function summarizeToolBonuses(tools) {
  const totalEffects = {};

  tools.forEach(tool => {
    const effectData = toolEffects[tool.type];
    if (effectData) {
      // Effect1
      if (!totalEffects[effectData.effect1.name]) {
        totalEffects[effectData.effect1.name] = {
          totalEffect1: 0,
          icon: effectData.effect1.icon,
          totalEffect2: 0
        };
      }
      totalEffects[effectData.effect1.name].totalEffect1 += tool.count * effectData.effect1.value;

      // Effect2
      if (effectData.effect2.name) {
        if (!totalEffects[effectData.effect2.name]) {
          totalEffects[effectData.effect2.name] = {
            totalEffect1: 0,
            icon: effectData.effect2.icon,
            totalEffect2: 0
          };
        }
        totalEffects[effectData.effect2.name].totalEffect2 += tool.count * effectData.effect2.value;
      }
    }
  });

  let result = '';

  const effectsArray = Object.entries(totalEffects).map(([name, { totalEffect1, totalEffect2, icon }]) => {
    return { name, totalEffect1, totalEffect2, icon };
  });

  effectsArray.sort((a, b) => {
    const totalA = Math.abs(a.totalEffect1) + Math.abs(a.totalEffect2);
    const totalB = Math.abs(b.totalEffect1) + Math.abs(b.totalEffect2);
    return totalB - totalA;
  });

  effectsArray.forEach(({ name, totalEffect1, totalEffect2, icon }) => {
    if (totalEffect1 < 0) {
      result += `<div class="col-6 effect-slot"><img src="./img/${icon}" alt="${name}" /> ${totalEffect1}%</div>`;
    }
    if (totalEffect2 > 0) {
      result += `<div class="col-6 effect-slot"><img src="./img/${icon}" alt="${name}" /> +${totalEffect2}%</div>`;
    }
  });

  return result ? `<div class="row">${result}</div>` : '';
}

function summarizeSupportToolBonuses(supportTools) {
  const totalEffects = {};

  supportTools.forEach(tool => {
    const effectData = supportToolEffects[tool.type];
    if (effectData) {
      if (effectData.effect1.name && effectData.effect1.value !== 0) {
        if (!totalEffects[effectData.effect1.name]) {
          totalEffects[effectData.effect1.name] = {
            totalEffect1: 0,
            icon: effectData.effect1.icon,
            totalEffect2: 0
          };
        }
        totalEffects[effectData.effect1.name].totalEffect1 += tool.count * effectData.effect1.value;
      }

      if (effectData.effect2.name && effectData.effect2.value !== 0) {
        if (!totalEffects[effectData.effect2.name]) {
          totalEffects[effectData.effect2.name] = {
            totalEffect1: 0,
            icon: effectData.effect2.icon,
            totalEffect2: 0
          };
        }
        totalEffects[effectData.effect2.name].totalEffect2 += tool.count * effectData.effect2.value;
      }
    }
  });

  let result = '';

  const effectsArray = Object.entries(totalEffects).map(([name, { totalEffect1, totalEffect2, icon }]) => {
    return { name, totalEffect1, totalEffect2, icon };
  });

  effectsArray.sort((a, b) => {
    const totalA = Math.abs(a.totalEffect1) + Math.abs(a.totalEffect2);
    const totalB = Math.abs(b.totalEffect1) + Math.abs(b.totalEffect2);
    return totalB - totalA;
  });

  effectsArray.forEach(({ name, totalEffect1, totalEffect2, icon }) => {
    if (totalEffect1 !== 0) {
      result += `<div class="col-6 effect-slot"><img src="./img/${icon}" alt="${name}" /> ${totalEffect1}</div>`;
    }
    if (totalEffect2 !== 0) {
      result += `<div class="col-6 effect-slot"><img src="./img/${icon}" alt="${name}" /> +${totalEffect2}%</div>`;
    }
  });

  return result ? `<div class="row">${result}</div>` : '';
}

function getWaveHeaderColor(wave) {
  return wave.slots.some(slot => slot.count > 0) ? 'rgb(255, 255, 150)' : '';
}

function updateHeaderColor(wave, side, waveIndex) {
  const cardHeader = document.getElementById(`heading-${side}-${waveIndex}`);
  cardHeader.style.backgroundColor = getWaveHeaderColor(wave);
}

function openUnitModal(slotId, side, waveIndex) {
  const modal = new bootstrap.Modal(document.getElementById('unitModal'));
  const slotElement = document.getElementById(slotId);
  const wave = waves[side][waveIndex - 1];

  if (!wave || !wave.slots) {
    console.error(`Wave or slots not found for side: ${side}, waveIndex: ${waveIndex}`);
    return;
  }

  const slot = wave.slots.find(s => s.id === slotId);

  if (!slot) {
    console.error(`Slot not found for slotId: ${slotId}`);
    return;
  }

  const maxUnitsInWave = (side === 'front') ? attackBasics.maxUnits.front : attackBasics.maxUnits.right;

  const totalUnitsInWave = wave.slots.reduce((acc, s) => s.id !== slotId ? acc + s.count : acc, 0);
  let availableUnits = maxUnitsInWave - totalUnitsInWave;

  units.forEach((unit, index) => {
    const count = slot.count > 0 && slot.type === `Unit${unit.id.charAt(unit.id.length - 1)}` ? slot.count : 0;

    const unitRange = document.getElementById(`unit${index + 1}`);
    const unitValue = document.getElementById(`unit${index + 1}-value`);

    if (unitRange && unitValue) {
      unitRange.value = count;
      unitRange.max = availableUnits;
      unitValue.textContent = count;

      unitRange.addEventListener('input', function () {
        unitValue.textContent = this.value;

        units.forEach((otherUnit, otherIndex) => {
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

    units.forEach((unit, index) => {
      const unitRange = document.getElementById(`unit${index + 1}`);
      const unitCount = parseInt(unitRange ? unitRange.value : 0);
      if (unitCount > 0) {
        totalUnitsInSlot += unitCount;
        selectedUnitType = `Unit${unit.id.charAt(unit.id.length - 1)}`;
      }
    });

    if (totalUnitsInWave + totalUnitsInSlot > maxUnitsInWave) {
      alert(`Cannot exceed ${maxUnitsInWave} units in this wave!`);
      return;
    }

    if (slot) {
      slot.type = selectedUnitType || '';
      slot.count = totalUnitsInSlot;
      totalUnits[side][waveIndex - 1] = wave.slots;

      slotElement.innerHTML = (slot.count > 0) ? createUnitIcon(slot) : '+';

      const unitBonuses = summarizeUnitBonuses(wave.slots);
      const bonusElement = document.querySelector(`#units-${side}-${waveIndex} .bonus-summary`);
      if (bonusElement) {
        bonusElement.innerHTML = unitBonuses;
      }

      updateHeaderColor(wave, side, waveIndex);
      generateWaves(side, attackBasics.maxWaves);
    }

    modal.hide();
  }

  modal.show();
}

function openToolModal(slotId, side, waveIndex) {
  const modal = new bootstrap.Modal(document.getElementById('toolModal'));
  const slotElement = document.getElementById(slotId);
  const wave = waves[side][waveIndex - 1];
  const slot = wave.tools.find(s => s.id === slotId);

  const maxToolsInWave = (side === 'front') ? attackBasics.maxTools.front : attackBasics.maxTools.left;
  const totalToolsInWave = wave.tools.reduce((acc, s) => s.id !== slotId ? acc + s.count : acc, 0);
  let availableTools = maxToolsInWave - totalToolsInWave;

  const usedToolTypes = wave.tools
    .filter(s => s.id !== slotId)
    .map(tool => tool.type)
    .filter(type => type !== '');

  tools.forEach((tool, index) => {
    const count = slot.count > 0 && slot.type === `Tool${tool.id.charAt(tool.id.length - 1)}` ? slot.count : 0;

    const toolRange = document.getElementById(`tool${index + 1}`);
    const toolValue = document.getElementById(`tool${index + 1}-value`);

    if (toolRange && toolValue) {
      toolRange.value = count;

      const toolLimit = tool.toolLimit > 0 ? tool.toolLimit : availableTools;
      toolRange.max = Math.min(toolLimit, availableTools);

      if (usedToolTypes.includes(`Tool${tool.id.charAt(tool.id.length - 1)}`) && slot.type !== `Tool${tool.id.charAt(tool.id.length - 1)}`) {
        toolRange.disabled = true;
      } else {
        toolRange.disabled = false;
      }

      toolValue.textContent = count;

      toolRange.addEventListener('input', function () {
        toolValue.textContent = this.value;

        tools.forEach((otherTool, otherIndex) => {
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
    }
  });

  document.getElementById('confirmTools').onclick = function () {
    let totalToolsInSlot = 0;
    let selectedToolType = '';

    tools.forEach((tool, index) => {
      const toolRange = document.getElementById(`tool${index + 1}`);
      const toolCount = parseInt(toolRange ? toolRange.value : 0);
      if (toolCount > 0) {
        totalToolsInSlot += toolCount;
        selectedToolType = `Tool${tool.id.charAt(tool.id.length - 1)}`;
      }
    });

    if (totalToolsInWave + totalToolsInSlot > maxToolsInWave) {
      alert(`Cannot exceed ${maxToolsInWave} tools in this wave!`);
      return;
    }

    if (slot) {
      slot.type = selectedToolType || '';
      slot.count = totalToolsInSlot;

      slotElement.innerHTML = (slot.count > 0) ? createToolIcon(slot) : '+';

      const toolBonuses = summarizeToolBonuses(wave.tools);
      const bonusElement = document.querySelector(`#tools-${side}-${waveIndex} .bonus-summary`);
      if (bonusElement) {
        bonusElement.innerHTML = toolBonuses;
      }

      totalTools[side][waveIndex - 1] = wave.tools;

      generateWaves(side, attackBasics.maxWaves);
    }

    modal.hide();
  };

  modal.show();
}

function switchSide(side) {
  const buttons = document.querySelectorAll('.flanks-button');
  buttons.forEach(button => {
    button.classList.remove('active');
  });

  const activeButton = document.querySelector(`.flanks-button[data-section="${side}"]`);
  if (activeButton) {
    activeButton.classList.add('active');
  }
  currentSide = side;
  generateWaves(side, attackBasics.maxWaves);

  const flankLabels = {
    left: 'Left flank',
    front: 'Front',
    right: 'Right flank',
    cy: 'Courtyard'
  };

  document.getElementById('current-flank').innerText = flankLabels[side] || '';

  for (let i = 1; i <= attackBasics.maxWaves; i++) {
    const arrow = document.querySelector(`#heading-${side}-${i} .arrow`);
    const collapseElement = document.getElementById(`collapse-${side}-${i}`);

    if (openWaves[i]) {
      collapseElement.classList.add('show');
      arrow.style.transform = 'rotate(90deg)';
    } else {
      collapseElement.classList.remove('show');
      arrow.style.transform = 'rotate(0deg)';
    }
  }
}

const waveContainer = document.getElementById('wave-container');
let touchStartX = 0;
let touchEndX = 0;

waveContainer.addEventListener('touchstart', (event) => {
  touchStartX = event.touches[0].clientX;
});

waveContainer.addEventListener('touchend', (event) => {
  touchEndX = event.changedTouches[0].clientX;
  handleSwipe();
});

function handleSwipe() {
  const swipeDistance = touchEndX - touchStartX;
  const threshold = 50;

  if (swipeDistance > threshold) {

    switchToPreviousSide();
  } else if (swipeDistance < -threshold) {

    switchToNextSide();
  }
}

function switchToPreviousSide() {
  const sides = ['left', 'front', 'right'];
  const currentIndex = sides.indexOf(currentSide);
  const newIndex = (currentIndex - 1 + sides.length) % sides.length;
  switchSide(sides[newIndex]);
}

function switchToNextSide() {
  const sides = ['left', 'front', 'right'];
  const currentIndex = sides.indexOf(currentSide);
  const newIndex = (currentIndex + 1) % sides.length;
  switchSide(sides[newIndex]);
}

function createUnitIcon(slot) {
  const unitIconContainer = document.createElement('div');
  unitIconContainer.classList.add('unit-icon-container');

  const unitIcon = document.createElement('img');
  unitIcon.src = `./img/${unitImages[slot.type]}` || './img/icon_unit0.png';

  unitIcon.classList.add('unit-icon');
  unitIcon.alt = slot.type;

  const countDisplay = document.createElement('div');
  countDisplay.classList.add('unit-count');
  countDisplay.textContent = slot.count > 0 ? slot.count : '';

  unitIconContainer.appendChild(unitIcon);
  unitIconContainer.appendChild(countDisplay);

  return unitIconContainer.outerHTML;
}

function createToolIcon(slot) {
  const toolIconContainer = document.createElement('div');
  toolIconContainer.classList.add('tool-icon-container');

  const toolIcon = document.createElement('img');
  toolIcon.src = `./img/${toolImages[slot.type]}` || './img/icon_tool0.png';

  toolIcon.classList.add('tool-icon');
  toolIcon.alt = slot.type;

  const countDisplay = document.createElement('div');
  countDisplay.classList.add('tool-count');
  countDisplay.textContent = slot.count > 0 ? slot.count : '';

  toolIconContainer.appendChild(toolIcon);
  toolIconContainer.appendChild(countDisplay);

  return toolIconContainer.outerHTML;
}

function createSupportToolIcon(slot) {
  const toolIconContainer = document.createElement('div');
  toolIconContainer.classList.add('tool-icon-container');

  const toolIcon = document.createElement('img');
  toolIcon.src = `./img/${supportToolImages[slot.type]}` || './img/icon_tool0.png';

  toolIcon.classList.add('tool-icon');
  toolIcon.alt = slot.type;

  const countDisplay = document.createElement('div');
  countDisplay.classList.add('tool-count');
  countDisplay.textContent = slot.count > 0 ? slot.count : '';

  toolIconContainer.appendChild(toolIcon);
  toolIconContainer.appendChild(countDisplay);

  return toolIconContainer.outerHTML;
}

function openBasicsModal() {
  const modal = new bootstrap.Modal(document.getElementById('basicsModal'));

  const slidersAndValues = [
    { sliderId: 'waves-slider', valueId: 'waves-value', value: attackBasics.maxWaves, min: 4, max: 18 },
    { sliderId: 'front-unit-slider', valueId: 'front-unit-value', value: attackBasics.maxUnits.front, min: 192, max: 1600 },
    { sliderId: 'flank-unit-slider', valueId: 'flank-unit-value', value: attackBasics.maxUnits.left, min: 64, max: 800 },
    { sliderId: 'courtyard-unit-slider', valueId: 'courtyard-unit-value', value: attackBasics.maxUnitsCY, min: 2089, max: 6000 },
    { sliderId: 'flank-tool-slider', valueId: 'flank-tool-value', value: attackBasics.maxTools.left, min: 40, max: 50 },
    { sliderId: 'mead-range-level-slider', valueId: 'mead-range-level-value', value: attackBasics.meadRangeLevel, min: 0, max: 10 },
    { sliderId: 'mead-melee-level-slider', valueId: 'mead-melee-level-value', value: attackBasics.meadMeleeLevel, min: 0, max: 10 },
    { sliderId: 'beaf-range-level-slider', valueId: 'beaf-range-level-value', value: attackBasics.beafRangeLevel, min: 0, max: 10 },
    { sliderId: 'beaf-melee-level-slider', valueId: 'beaf-melee-level-value', value: attackBasics.beafMeleeLevel, min: 0, max: 10 },
    { sliderId: 'beaf-veteran-range-level-slider', valueId: 'beaf-veteran-range-level-value', value: attackBasics.beafVeteranRangeLevel, min: 0, max: 10 },
    { sliderId: 'beaf-veteran-melee-level-slider', valueId: 'beaf-veteran-melee-level-value', value: attackBasics.beafVeteranMeleeLevel, min: 0, max: 10 }
  ];

  slidersAndValues.forEach(({ sliderId, valueId, value, min, max }) => {
    const slider = document.getElementById(sliderId);
    const valueElement = document.getElementById(valueId);

    if (slider && valueElement) {
      slider.value = value;
      valueElement.value = value;
      valueElement.textContent = value;

      slider.addEventListener('input', function () {
        valueElement.value = this.value;
        valueElement.textContent = this.value;
      });

      valueElement.addEventListener('input', function () {
        const newValue = parseInt(this.value);
        if (newValue > max) {
          this.value = max;
        } else if (newValue < min) {
          this.value = min;
        }
        slider.value = this.value;
        this.textContent = newValue < 0 ? `-${Math.abs(newValue)}` : `+${newValue}`;
      });
    } else {
      console.warn(`Elemek nem találhatóak: ${sliderId}, ${valueId}`);
    }
  });


  document.getElementById('confirmBasics').onclick = function () {
    attackBasics.maxWaves = parseInt(document.getElementById('waves-slider').value);
    attackBasics.maxUnits.front = parseInt(document.getElementById('front-unit-slider').value);
    attackBasics.maxUnits.left = parseInt(document.getElementById('flank-unit-slider').value);
    attackBasics.maxUnits.right = parseInt(document.getElementById('flank-unit-slider').value);
    attackBasics.maxTools.left = parseInt(document.getElementById('flank-tool-slider').value);
    attackBasics.maxTools.right = parseInt(document.getElementById('flank-tool-slider').value);
    attackBasics.maxUnitsCY = parseInt(document.getElementById('courtyard-unit-slider').value);
    attackBasics.meadRangeLevel = parseInt(document.getElementById('mead-range-level-slider').value);
    attackBasics.meadMeleeLevel = parseInt(document.getElementById('mead-melee-level-slider').value);
    attackBasics.beafRangeLevel = parseInt(document.getElementById('beaf-range-level-slider').value);
    attackBasics.beafMeleeLevel = parseInt(document.getElementById('beaf-melee-level-slider').value);
    attackBasics.beafVeteranRangeLevel = parseInt(document.getElementById('beaf-veteran-range-level-slider').value);
    attackBasics.beafVeteranMeleeLevel = parseInt(document.getElementById('beaf-veteran-melee-level-slider').value);

    loadData();
    updateUnitStrengths();
    switchSide(currentSide);
    localStorage.setItem('attackBasics', JSON.stringify(attackBasics));
    modal.hide();
  };

  modal.show();
}

function openCommanderStatsModal() {
  const modal = new bootstrap.Modal(document.getElementById('commanderStatsModal'));

  const slidersAndValues = [
    { sliderId: 'melee-strength-slider', valueId: 'melee-strength-value', value: commanderStats.melee, max: 800 },
    { sliderId: 'ranged-strength-slider', valueId: 'ranged-strength-value', value: commanderStats.ranged, max: 800 },
    { sliderId: 'universal-strength-slider', valueId: 'universal-strength-value', value: commanderStats.universal, max: 20 },
    { sliderId: 'courtyard-strength-slider', valueId: 'courtyard-strength-value', value: commanderStats.courtyard, max: 800 },
    { sliderId: 'wall-reduction-slider', valueId: 'wall-reduction-value', value: commanderStats.wallReduction, max: 280 },
    { sliderId: 'moat-reduction-slider', valueId: 'moat-reduction-value', value: commanderStats.moatReduction, max: 180 },
    { sliderId: 'gate-reduction-slider', valueId: 'gate-reduction-value', value: commanderStats.gateReduction, max: 280 },
    { sliderId: 'mead-unit-strength-slider', valueId: 'mead-unit-strength-value', value: commanderStats.meadStrength, max: 20 },
    { sliderId: 'horror-unit-strength-slider', valueId: 'horror-unit-strength-value', value: commanderStats.horrorStrength, max: 40 },
    { sliderId: 'hol-melee-strength-slider', valueId: 'hol-melee-strength-value', value: commanderStats.holMelee, max: 13 },
    { sliderId: 'hol-ranged-strength-slider', valueId: 'hol-ranged-strength-value', value: commanderStats.holRanged, max: 13 },
    { sliderId: 'hol-universal-strength-slider', valueId: 'hol-universal-strength-value', value: commanderStats.holUniversal, max: 12 },
    { sliderId: 'front-strength-slider', valueId: 'front-strength-value', value: commanderStats.frontStrength, max: 20 },
    { sliderId: 'flanks-strength-slider', valueId: 'flanks-strength-value', value: commanderStats.flanksStrength, max: 20 }
  ];

  slidersAndValues.forEach(({ sliderId, valueId, value, max }) => {
    const slider = document.getElementById(sliderId);
    const valueElement = document.getElementById(valueId);

    slider.value = value;
    valueElement.value = value;
    valueElement.textContent = value < 0 ? `-${Math.abs(value)}` : `+${value}`;

    slider.addEventListener('input', function () {
      valueElement.value = this.value;
      valueElement.textContent = this.value < 0 ? `-${Math.abs(this.value)}` : `+${this.value}`;
    });

    valueElement.addEventListener('input', function () {
      const newValue = parseInt(this.value);
      if (newValue > max) {
        this.value = max;
      }
      slider.value = this.value;
      this.textContent = newValue < 0 ? `-${Math.abs(newValue)}` : `+${newValue}`;
    });
  });

  document.getElementById('confirmCommanderStats').onclick = function () {
    commanderStats.melee = parseInt(document.getElementById('melee-strength-slider').value);
    commanderStats.ranged = parseInt(document.getElementById('ranged-strength-slider').value);
    commanderStats.universal = parseInt(document.getElementById('universal-strength-slider').value);
    commanderStats.courtyard = parseInt(document.getElementById('courtyard-strength-slider').value);
    commanderStats.wallReduction = parseInt(document.getElementById('wall-reduction-slider').value);
    commanderStats.moatReduction = parseInt(document.getElementById('moat-reduction-slider').value);
    commanderStats.gateReduction = parseInt(document.getElementById('gate-reduction-slider').value);
    commanderStats.meadStrength = parseInt(document.getElementById('mead-unit-strength-slider').value);
    commanderStats.horrorStrength = parseInt(document.getElementById('horror-unit-strength-slider').value);
    commanderStats.holMelee = parseInt(document.getElementById('hol-melee-strength-slider').value);
    commanderStats.holRanged = parseInt(document.getElementById('hol-ranged-strength-slider').value);
    commanderStats.holUniversal = parseInt(document.getElementById('hol-universal-strength-slider').value);
    commanderStats.frontStrength = parseInt(document.getElementById('front-strength-slider').value);
    commanderStats.flanksStrength = parseInt(document.getElementById('flanks-strength-slider').value);

    switchSide(currentSide);
    localStorage.setItem('commanderStats', JSON.stringify(commanderStats));
    modal.hide();
  };

  modal.show();
}

function openCastellanStatsModal() {
  const modal = new bootstrap.Modal(document.getElementById('castellanStatsModal'));

  const slidersAndValues = [
    { sliderId: 'defense-melee-strength-slider', valueId: 'defense-melee-strength-value', value: castellanStats.melee, max: 500 },
    { sliderId: 'defense-ranged-strength-slider', valueId: 'defense-ranged-strength-value', value: castellanStats.ranged, max: 500 },
    { sliderId: 'defense-courtyard-strength-slider', valueId: 'defense-courtyard-strength-value', value: castellanStats.courtyard, max: 500 },
    { sliderId: 'wall-unit-limit-slider', valueId: 'wall-unit-limit-value', value: castellanStats.wallUnitLimit, max: 15000 },
    { sliderId: 'cy-unit-limit-slider', valueId: 'cy-unit-limit-value', value: castellanStats.cyUnitLimit, max: 1000000 },
    { sliderId: 'defense-wall-protection-slider', valueId: 'defense-wall-protection-value', value: castellanStats.wallProtection, max: 480 },
    { sliderId: 'defense-moat-protection-slider', valueId: 'defense-moat-protection-value', value: castellanStats.moatProtection, max: 260 },
    { sliderId: 'defense-gate-protection-slider', valueId: 'defense-gate-protection-value', value: castellanStats.gateProtection, max: 480 }
  ];

  slidersAndValues.forEach(({ sliderId, valueId, value, max }) => {
    const slider = document.getElementById(sliderId);
    const valueElement = document.getElementById(valueId);

    slider.value = value;
    valueElement.value = value;
    valueElement.textContent = value < 0 ? `-${Math.abs(value)}` : `+${value}`;

    slider.addEventListener('input', function () {
      valueElement.value = this.value;
      valueElement.textContent = this.value < 0 ? `-${Math.abs(this.value)}` : `+${this.value}`;
    });

    valueElement.addEventListener('input', function () {
      const newValue = parseInt(this.value);
      if (newValue > max) {
        this.value = max;
      }
      slider.value = this.value;
      this.textContent = newValue < 0 ? `-${Math.abs(newValue)}` : `+${newValue}`;
    });
  });

  document.getElementById('confirmCastellanStats').onclick = function () {
    castellanStats.melee = parseInt(document.getElementById('defense-melee-strength-slider').value);
    castellanStats.ranged = parseInt(document.getElementById('defense-ranged-strength-slider').value);
    castellanStats.courtyard = parseInt(document.getElementById('defense-courtyard-strength-slider').value);
    castellanStats.wallUnitLimit = parseInt(document.getElementById('wall-unit-limit-slider').value);
    castellanStats.cyUnitLimit = parseInt(document.getElementById('cy-unit-limit-slider').value);
    castellanStats.wallProtection = parseInt(document.getElementById('defense-wall-protection-slider').value);
    castellanStats.moatProtection = parseInt(document.getElementById('defense-moat-protection-slider').value);
    castellanStats.gateProtection = parseInt(document.getElementById('defense-gate-protection-slider').value);
    switchSide(currentSide);
    localStorage.setItem('castellanStats', JSON.stringify(castellanStats));
    modal.hide();
  };

  modal.show();
}

function loadDefenseSlots(side) {
  displayDefenseBonuses(side);

  const unitSlots = defenseSlots[side].units;
  unitSlots.forEach((slot, index) => {
    const slotElement = document.getElementById(`unit-slot-${side}-${index + 1}`);
    if (slot) {
      slotElement.dataset.type = slot.type;
      slotElement.dataset.count = slot.count;

      if (slot.count > 0) {
        slotElement.innerHTML = createDefenseUnitIcon(slot);
      } else {
        slotElement.innerHTML = '+';
      }
    } else {
      slotElement.dataset.type = '';
      slotElement.dataset.count = 0;
      slotElement.innerHTML = '+';
    }
  });
}

function loadDefenseTools(side) {
  if (side === 'cy') {
    const cySlots = defenseSlots[side].cyTools || [];
    cySlots.forEach((slot, index) => {
      const slotElement = document.getElementById(`tool-slot-${side}-cy-${index + 1}`);
      if (slotElement) {
        slotElement.dataset.count = slot.count || 0;
        slotElement.innerHTML = slot.count > 0 ? createDefenseToolIcon(slot) : `<img src="${getToolIcon('cy')}" alt="courtyard tool" class="tool-icon" />`;
      }
    });
  } else {

    const wallSlots = defenseSlots[side].wallTools;
    const gateSlots = defenseSlots[side].gateTools;
    const moatSlots = defenseSlots[side].moatTools;
    const cySlots = defenseSlots[side].cyTools || [];

    wallSlots.forEach((slot, index) => {
      const slotElement = document.getElementById(`tool-slot-${side}-wall-${index + 1}`);
      if (slotElement) {
        if (slot && slot.count >= 0) {
          slotElement.dataset.count = slot.count;
          if (slot.count > 0) {
            slotElement.innerHTML = createDefenseToolIcon(slot);
          } else {
            slotElement.innerHTML = `<img src="${getToolIcon('wall')}" alt="wall tool" class="tool-icon" />`;
          }
        } else {
          slotElement.dataset.count = 0;
          slotElement.innerHTML = `<img src="${getToolIcon('wall')}" alt="wall tool" class="tool-icon" />`;
        }
      }
    });

    gateSlots.forEach((slot, index) => {
      const slotElement = document.getElementById(`tool-slot-${side}-gate-${index + 1}`);
      if (slotElement) {
        slotElement.dataset.count = slot.count || 0;
        if (slot.count > 0) {
          slotElement.innerHTML = createDefenseToolIcon(slot);
        } else {
          slotElement.innerHTML = `<img src="${getToolIcon('gate')}" alt="gate tool" class="tool-icon" />`;
        }
      }
    });

    moatSlots.forEach((slot, index) => {
      const slotElement = document.getElementById(`tool-slot-${side}-moat-${index + 1}`);
      if (slotElement) {
        slotElement.dataset.count = slot.count || 0;
        if (slot.count > 0) {
          slotElement.innerHTML = createDefenseToolIcon(slot);
        } else {
          slotElement.innerHTML = `<img src="${getToolIcon('moat')}" alt="moat tool" class="tool-icon" />`;
        }
      }
    });

  }
}

function generateUnitSlots(side) {
  const container = document.querySelector('.unit-slot-container');
  container.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const slot = document.createElement('div');
    slot.classList.add('unit-slot');
    slot.id = `unit-slot-${side}-${i + 1}`;
    slot.addEventListener('click', () => openDefenseUnitsModal(side, i + 1));
    slot.textContent = "+";
    container.appendChild(slot);
  }
}

function generateToolSlots(side, tools) {
  const container = document.getElementById('toolsSlots');
  container.innerHTML = '';

  for (let i = 0; i < tools.wall; i++) {
    const uniqueId = `tool-slot-${side}-wall-${i + 1}`;
    const toolSlot = document.createElement('div');
    toolSlot.classList.add('tool-slot');
    toolSlot.id = uniqueId;

    const toolIcon = document.createElement('img');
    toolIcon.src = getToolIcon('wall');
    toolIcon.alt = 'wall-tool';
    toolIcon.classList.add('tool-icon');

    toolSlot.appendChild(toolIcon);
    toolSlot.addEventListener('click', () => openDefenseToolsModal(side, 'wall', i + 1));
    container.appendChild(toolSlot);
  }

  for (let i = 0; i < tools.gate; i++) {
    const uniqueId = `tool-slot-${side}-gate-${i + 1}`;
    const toolSlot = document.createElement('div');
    toolSlot.classList.add('tool-slot');
    toolSlot.id = uniqueId;

    const toolIcon = document.createElement('img');
    toolIcon.src = getToolIcon('gate');
    toolIcon.alt = 'gate-tool';
    toolIcon.classList.add('tool-icon');

    toolSlot.appendChild(toolIcon);
    toolSlot.addEventListener('click', () => openDefenseToolsModal(side, 'gate', i + 1));
    container.appendChild(toolSlot);
  }

  for (let i = 0; i < tools.moat; i++) {
    const uniqueId = `tool-slot-${side}-moat-${i + 1}`;
    const toolSlot = document.createElement('div');
    toolSlot.classList.add('tool-slot');
    toolSlot.id = uniqueId;

    const toolIcon = document.createElement('img');
    toolIcon.src = getToolIcon('moat');
    toolIcon.alt = 'moat-tool';
    toolIcon.classList.add('tool-icon');

    toolSlot.appendChild(toolIcon);
    toolSlot.addEventListener('click', () => openDefenseToolsModal(side, 'moat', i + 1));
    container.appendChild(toolSlot);
  }

  for (let i = 0; i < tools.courtyard; i++) {
    const uniqueId = `tool-slot-${side}-cy-${i + 1}`;
    const toolSlot = document.createElement('div');
    toolSlot.classList.add('tool-slot');
    toolSlot.id = uniqueId;

    const toolIcon = document.createElement('img');
    toolIcon.src = getToolIcon('cy');
    toolIcon.alt = 'cy-tool';
    toolIcon.classList.add('tool-icon');

    toolSlot.appendChild(toolIcon);
    toolSlot.addEventListener('click', () => openDefenseToolsModal(side, 'cy', i + 1));
    container.appendChild(toolSlot);
  }

  loadDefenseTools(side);
}

function getToolIcon(tool) {
  switch (tool) {
    case "wall":
      return "./img/wall-icon.png";
    case "gate":
      return "./img/gate-icon.png";
    case "moat":
      return "./img/moat-icon.png";
    case "cy":
      return "./img/wall-icon.png";
    default:
      return "./img/empty-slot.png";
  }
}

//DEFENSE MODALS
function openDefenseBasicsModal() {
  var myModal = new bootstrap.Modal(document.getElementById('defenseBasicsModal'), {});
  myModal.show();
  switchDefenseSide(currentSide);
}

function switchDefenseSide(side) {
  const selectedSide = defenseSides[side];
  document.getElementById('current-defense-flank').innerText = `${selectedSide.name}`;

  document.querySelectorAll('.flanks-button-defense').forEach(button => {
    button.classList.remove('active');
  });

  const activeButton = document.querySelector(`.flanks-button-defense[data-section="${side}"]`);
  activeButton.classList.add('active');

  generateUnitSlots(side, 7);
  generateToolSlots(side, selectedSide.tools);

  loadDefenseSlots(side);
  calculateTroopDefenseStrength(side);
}

function initializeDefenseUnits(defense_units) {
  const unitModalBody = document.querySelector('#unitModalDefense .modal-body');
  unitModalBody.innerHTML = '';

  defense_units.forEach((unit, index) => {
    const effects = [];
    if (unit.meleeDefenseStrength > 0) {
      effects.push(`<img src="./img/castellan-modal1.png" alt="" class="combat-icon" /><span class="me-2">+${unit.meleeDefenseStrength}</span>`);
    }
    if (unit.rangedDefenseStrength > 0) {
      effects.push(`<img src="./img/castellan-modal2.png" alt="" class="combat-icon" /><span class="me-2">+${unit.rangedDefenseStrength}</span>`);
    }

    const unitCard = `
          <div class="col-12">
              <div class="card w-100">
                  <div class="modal-card-body mt-1">
                      <h6 class="card-title text-center">${unit.name}</h6>
                      <div class="d-flex align-items-center">
                          <div class="me-2">
                              <img src="./img/icon_defense_unit${index + 1}.webp" alt="${unit.id}" class="unit-image" />
                          </div>
                          <div class="flex-grow-1">
                              <div class="d-flex align-items-center">
                                  <input type="range" id="defense_unit${index + 1}" min="0" max="7" value="0" class="form-range me-2" />
                                  <span id="defense_unit${index + 1}-value" class="selector-value">0</span>
                              </div>
                              <div class="mt-2">${effects.join('')}</div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      `;

    unitModalBody.insertAdjacentHTML('beforeend', unitCard);

    const unitRange = document.getElementById(`defense_unit${index + 1}`);
    const unitValue = document.getElementById(`defense_unit${index + 1}-value`);
    unitRange.addEventListener('input', function () {
      unitValue.textContent = this.value;
    });
  });
}

function openDefenseUnitsModal(side, slotNumber) {
  const modal = new bootstrap.Modal(document.getElementById('unitModalDefense'));
  const slotElement = document.getElementById(`unit-slot-${side}-${slotNumber}`);

  const wallMaxUnits = castellanStats.wallUnitLimit;
  const cyMaxUnits = castellanStats.cyUnitLimit;
  const isCourtyard = side === 'cy';

  const totalUnitsInDefense = Object.keys(defenseSlots).reduce((total, key) => {
    if (key !== 'cy') {
      return total + defenseSlots[key].units.reduce((acc, slot) => {
        if (slot && slot.count) {
          return acc + slot.count;
        }
        return acc;
      }, 0);
    }
    return total;
  }, 0);

  let totalUnitsInCourtyard = defenseSlots.cy.units.reduce((acc, slot) => acc + (slot.count || 0), 0);

  let availableUnits;
  const currentSlotData = defenseSlots[side].units[slotNumber - 1] || { type: '', count: 0 };
  const currentSlotUnitCount = currentSlotData.count;

  if (isCourtyard) {
    availableUnits = cyMaxUnits - totalUnitsInCourtyard + currentSlotUnitCount;
  } else {
    availableUnits = wallMaxUnits - totalUnitsInDefense + currentSlotUnitCount;
  }

  defense_units.forEach((unit, index) => {
    const count = currentSlotData.type === `DefenseUnit${unit.id.charAt(unit.id.length - 1)}` ? currentSlotData.count : 0;

    const unitRange = document.getElementById(`defense_unit${index + 1}`);
    const unitValue = document.getElementById(`defense_unit${index + 1}-value`);

    if (unitRange && unitValue) {
      unitRange.value = count;
      unitRange.max = availableUnits;
      unitValue.textContent = count;

      unitRange.addEventListener('input', function () {
        unitValue.textContent = this.value;

        defense_units.forEach((otherUnit, otherIndex) => {
          if (otherIndex !== index) {
            const otherRange = document.getElementById(`defense_unit${otherIndex + 1}`);
            const otherValue = document.getElementById(`defense_unit${otherIndex + 1}-value`);
            if (otherRange && otherValue) {
              otherRange.value = 0;
              otherValue.textContent = 0;
            }
          }
        });
      });
    }
  });

  document.getElementById('confirmDefenseUnits').onclick = function () {
    let totalUnitsInSlot = 0;
    let selectedUnitType = '';

    defense_units.forEach((unit, index) => {
      const unitRange = document.getElementById(`defense_unit${index + 1}`);
      const unitCount = parseInt(unitRange ? unitRange.value : 0);
      if (unitCount > 0) {
        totalUnitsInSlot += unitCount;
        selectedUnitType = `DefenseUnit${unit.id.charAt(unit.id.length - 1)}`;
      }
    });

    defenseSlots[side].units[slotNumber - 1] = {
      type: selectedUnitType,
      count: totalUnitsInSlot
    };

    slotElement.innerHTML = totalUnitsInSlot > 0 ? createDefenseUnitIcon({
      type: selectedUnitType,
      count: totalUnitsInSlot
    }) : '+';
    calculateTroopDefenseStrength(side);
    saveDefenseState();
    modal.hide();
  };

  modal.show();
}

function createDefenseUnitIcon(slot) {
  const unitIconContainer = document.createElement('div');
  unitIconContainer.classList.add('unit-icon-container');

  const unitIcon = document.createElement('img');

  unitIcon.src = `./img/${unitImagesDefense[slot.type]}`;

  unitIcon.classList.add('unit-icon');
  unitIcon.alt = slot.type || 'empty';

  const countDisplay = document.createElement('div');
  countDisplay.classList.add('unit-count');
  countDisplay.textContent = slot.count > 0 ? slot.count : '';

  unitIconContainer.appendChild(unitIcon);
  unitIconContainer.appendChild(countDisplay);

  return unitIconContainer.outerHTML;
}

function initializeDefenseTools(defense_tools, slotType) {
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
                          <img src="./img/${tool.image}" alt="${tool.name}" class="tool-image" />
                      </div>
                      <div class="flex-grow-1">
                          <div class="d-flex align-items-center">
                              <input type="range" id="defense_tool${index + 1}" min="0" max="1" value="0" class="form-range me-2" />
                              <span id="defense_tool${index + 1}-value" class="selector-value">0</span>
                          </div>
                          <div class="mt-2 d-flex align-items-center">
                              <div class="me-2">
                                  <img src="./img/${tool.effectImage1}" alt="" class="combat-icon" />
                                  <span>+${tool.effect1Value}${tool.effect1Value > 149 ? '' : '%'} </span>
                              </div>
                              ${tool.effect2Value > 0 ? `
                              <div class="me-2">
                                  <img src="./img/${tool.effectImage2}" alt="" class="combat-icon" />
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

function openDefenseToolsModal(side, toolType, slotIndex) {
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
      const toolCount = parseInt(toolRange ? toolRange.value : 0);

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
        defenseSlots[side].cyTools[slotIndex - 1] = {
          type: '',
          count: 0
        };
      } else {
        defenseSlots[side][`${toolType}Tools`][slotIndex - 1] = {
          type: '',
          count: 0
        };
      }
      slotElement.innerHTML = `<img src="${getToolIcon(toolType)}" alt="${toolType}-tool" class="tool-icon" />`;
    } else {
      if (toolType === 'cy') {
        defenseSlots[side].cyTools[slotIndex - 1] = {
          type: selectedToolType,
          count: 1
        };
      } else {
        defenseSlots[side][`${toolType}Tools`][slotIndex - 1] = {
          type: selectedToolType,
          count: 1
        };
      }

      slotElement.innerHTML = createDefenseToolIcon({
        type: selectedToolType,
        count: 1
      });
    }
    displayDefenseBonuses(side);
    calculateTroopDefenseStrength(side);
    saveDefenseState();
    modal.hide();
  };

  modal.show();
}

function createDefenseToolIcon(slot) {
  const toolIconContainer = document.createElement('div');
  toolIconContainer.classList.add('tool-icon-container');

  const toolIcon = document.createElement('img');

  const toolId = slot.type.replace('DefenseTool', '');

  const toolImage = toolImagesDefense[`DefenseTool${toolId}`];

  if (toolImage) {
    toolIcon.src = `./img/${toolImage}`;
  } else {
    toolIcon.src = './img/default-tool.png';
  }
  toolIcon.classList.add('tool-icon');
  toolIcon.alt = slot.type;

  toolIconContainer.appendChild(toolIcon);

  return toolIconContainer.outerHTML;
}

function displayDefenseBonuses(side) {
  const bonuses = {
    melee: castellanStats.melee,
    ranged: castellanStats.ranged,
    wall: castellanStats.wallProtection,
    moat: castellanStats.moatProtection,
    gate: castellanStats.gateProtection,
    courtyard: castellanStats.courtyard
  };

  let combatStrengthBonus = 0;

  defenseSlots.cy.cyTools.forEach(tool => {
    if (tool && tool.count > 0) {
      const toolId = tool.type.replace('DefenseTool', '');
      const effectData = toolEffectsDefense[toolId];

      if (effectData) {
        if (effectData.effect1.name === 'Courtyard') {
          bonuses.courtyard += tool.count * effectData.effect1.value;
        }
        if (effectData.effect2.name === 'Courtyard') {
          bonuses.courtyard += tool.count * effectData.effect2.value;
        }
        if (effectData.effect2.name === 'CombatStrength') {
          combatStrengthBonus += tool.count * effectData.effect2.value;
        }
      }
    }
  });

  if (combatStrengthBonus > 0) {
    bonuses.melee += combatStrengthBonus;
    bonuses.ranged += combatStrengthBonus;
  }

  if (side !== 'cy') {
    ['wallTools', 'moatTools', 'gateTools'].forEach(slotType => {
      const tools = defenseSlots[side][slotType] || [];

      tools.forEach(tool => {
        if (tool && tool.count > 0) {
          const toolId = tool.type.replace('DefenseTool', '');
          const effectData = toolEffectsDefense[toolId];

          if (effectData) {
            if (effectData.effect1.name === 'MeleeStrength') {
              bonuses.melee += tool.count * effectData.effect1.value;
            } else if (effectData.effect1.name === 'Wall') {
              bonuses.wall += tool.count * effectData.effect1.value;
            } else if (effectData.effect1.name === 'Moat') {
              bonuses.moat += tool.count * effectData.effect1.value;
            } else if (effectData.effect1.name === 'Gate') {
              bonuses.gate += tool.count * effectData.effect1.value;
            } else if (effectData.effect1.name === 'RangedStrength') {
              bonuses.ranged += tool.count * effectData.effect1.value;
            }

            if (effectData.effect2.name === 'RangedStrength') {
              bonuses.ranged += tool.count * effectData.effect2.value;
            } else if (effectData.effect2.name === 'Wall') {
              bonuses.wall += tool.count * effectData.effect2.value;
            } else if (effectData.effect2.name === 'Moat') {
              bonuses.moat += tool.count * effectData.effect2.value;
            } else if (effectData.effect2.name === 'Gate') {
              bonuses.gate += tool.count * effectData.effect2.value;
            } else if (effectData.effect2.name === 'MeleeStrength') {
              bonuses.melee += tool.count * effectData.effect2.value;
            }
          }
        }
      });
    });
  }

  let bonusesDisplay = '<div class="d-flex justify-content-around align-items-center">';
  const currentBonuses = [];

  if (side === 'cy') {
    currentBonuses.push(
      `<div class="d-flex align-items-center">
        <img src="./img/castellan-modal1.png" alt="Melee Defense" class="combat-icon" />
        <span class="">+${bonuses.melee}%</span>
      </div>`,
      `<div class="d-flex align-items-center">
        <img src="./img/castellan-modal2.png" alt="Ranged Defense" class="combat-icon" />
        <span class="">+${bonuses.ranged}%</span>
      </div>`,
      `<div class="d-flex align-items-center">
        <img src="./img/cy-icon.png" alt="Courtyard Strength" class="combat-icon" />
        <span class="">+${bonuses.courtyard}%</span>
      </div>`
    );
  } else {
    currentBonuses.push(
      `<div class="d-flex align-items-center">
        <img src="./img/castellan-modal1.png" alt="Melee Defense" class="combat-icon" />
        <span class="">+${bonuses.melee}%</span>
      </div>`,
      `<div class="d-flex align-items-center">
        <img src="./img/castellan-modal2.png" alt="Ranged Defense" class="combat-icon" />
        <span class="">+${bonuses.ranged}%</span>
      </div>`,
      `<div class="d-flex align-items-center">
        <img src="./img/wall-icon.png" alt="Wall Defense" class="combat-icon" />
        <span class="">+${bonuses.wall}%</span>
      </div>`,
      `<div class="d-flex align-items-center">
        <img src="./img/moat-icon.png" alt="Moat Defense" class="combat-icon" />
        <span class="">+${bonuses.moat}%</span>
      </div>`
    );

    if (side === 'front') {
      currentBonuses.push(
        `<div class="d-flex align-items-center">
          <img src="./img/gate-icon.png" alt="Gate Defense" class="combat-icon" />
          <span class="">+${bonuses.gate}%</span>
        </div>`
      );
    }
  }

  bonusesDisplay += currentBonuses.join('') + '</div>';
  document.getElementById('toolBonuses').innerHTML = bonusesDisplay;
}

function calculateTroopDefenseStrength(side) {
  calculateTroopDistribution();

  let totalMeleeCount = 0;
  let totalRangedCount = 0;
  let totalMeleeDefense = 0;
  let totalRangedDefense = 0;

  let totalMeleeBonus = castellanStats.melee - 100;
  let totalRangedBonus = castellanStats.ranged - 100;

  let combatStrengthBonus = 0;

  defenseSlots.cy.cyTools.forEach(tool => {
    if (tool && tool.count > 0) {
      const toolId = tool.type.replace('DefenseTool', '');
      const effectData = toolEffectsDefense[toolId];

      if (effectData && effectData.effect2.name === 'CombatStrength') {
        combatStrengthBonus += tool.count * effectData.effect2.value;
      }
    }
  });

  ['wallTools', 'moatTools', 'gateTools'].forEach(slotType => {
    const tools = defenseSlots[side][slotType] || [];

    tools.forEach(tool => {
      if (tool && tool.count > 0) {
        const toolId = tool.type.replace('DefenseTool', '');
        const effectData = toolEffectsDefense[toolId];

        if (effectData) {
          if (effectData.effect1.name === 'MeleeStrength') {
            totalMeleeBonus += tool.count * effectData.effect1.value;
          }
          if (effectData.effect2.name === 'MeleeStrength') {
            totalMeleeBonus += tool.count * effectData.effect2.value;
          }
          if (effectData.effect1.name === 'RangedStrength') {
            totalRangedBonus += tool.count * effectData.effect1.value;
          }
          if (effectData.effect2.name === 'RangedStrength') {
            totalRangedBonus += tool.count * effectData.effect2.value;
          }
        }
      }
    });
  });

  totalMeleeBonus += combatStrengthBonus;
  totalRangedBonus += combatStrengthBonus;

  defenseSlots[side].units.forEach(slot => {
    if (slot && slot.count > 0) {
      const unitId = slot.type.replace('DefenseUnit', 'unit');
      const unitData = defense_units.find(unit => unit.id === unitId);

      if (unitData) {
        if (unitData.type2 === 'ranged') {
          totalRangedCount += slot.count;
          totalRangedDefense += Math.round((unitData.rangedDefenseStrength * (1 + totalRangedBonus / 100)) * slot.count);
          totalMeleeDefense += Math.round((unitData.meleeDefenseStrength * (1 + totalRangedBonus / 100)) * slot.count);
        }
        else {
          totalMeleeCount += slot.count;
          totalMeleeDefense += Math.round((unitData.meleeDefenseStrength * (1 + totalMeleeBonus / 100)) * slot.count);
          totalRangedDefense += Math.round((unitData.rangedDefenseStrength * (1 + totalMeleeBonus / 100)) * slot.count);
        }
      }
    }
  });

  const totalCount = totalMeleeCount + totalRangedCount;
  const sliderValue = totalCount > 0 ? (totalMeleeCount / totalCount) * 100 : 0;

  const slider = document.getElementById('defenseStrengthSlider');
  slider.value = sliderValue;

  const leftPercentage = totalCount > 0 ? (totalMeleeCount / totalCount) * 100 : 0;
  const rightPercentage = totalCount > 0 ? (totalRangedCount / totalCount) * 100 : 0;

  document.getElementById('leftPercentage').textContent = `${Math.round(leftPercentage)}%`;
  document.getElementById('rightPercentage').textContent = `${Math.round(rightPercentage)}%`;

  const formatter = new Intl.NumberFormat('en-US');

  const defenseStrengthDisplay = `
    <div class="d-flex justify-content-around align-items-center">
      <div class="d-flex align-items-center">
        <img src="./img/castellan-modal1.png" alt="Melee Defense" class="combat-icon" />
        <span class="me-1">+${formatter.format(totalMeleeDefense)}</span>
      </div>
      <div class="d-flex align-items-center">
        <img src="./img/castellan-modal2.png" alt="Ranged Defense" class="combat-icon" />
        <span class="me-1">+${formatter.format(totalRangedDefense)}</span>
      </div>
    </div>
  `;

  document.getElementById('troopCombatBonuses').innerHTML = defenseStrengthDisplay;
}

function calculateTroopDistribution() {
  let totalCountLeft = 0;
  let totalCountFront = 0;
  let totalCountRight = 0;

  ['left', 'front', 'right'].forEach(side => {
    defenseSlots[side].units.forEach(slot => {
      if (slot && slot.count > 0) {
        if (side === 'left') totalCountLeft += slot.count;
        else if (side === 'front') totalCountFront += slot.count;
        else if (side === 'right') totalCountRight += slot.count;
      }
    });
  });

  const totalCount = totalCountLeft + totalCountFront + totalCountRight;

  const leftPercentage = totalCount > 0 ? (totalCountLeft / totalCount) * 100 : 0;
  const frontPercentage = totalCount > 0 ? (totalCountFront / totalCount) * 100 : 0;
  const rightPercentage = totalCount > 0 ? (totalCountRight / totalCount) * 100 : 0;

  document.getElementById('leftFlank').textContent = `${Math.round(leftPercentage)}%`;
  document.getElementById('front').textContent = `${Math.round(frontPercentage)}%`;
  document.getElementById('rightFlank').textContent = `${Math.round(rightPercentage)}%`;
}

function saveDefenseState() {
  const defenseState = {
    defense_units,
    defense_tools,
    defenseSlots
  };
  localStorage.setItem('defenseState', JSON.stringify(defenseState));
}

function loadDefenseState() {
  const savedState = localStorage.getItem('defenseState');
  if (savedState) {
    const parsedState = JSON.parse(savedState);
    defense_units = parsedState.defense_units || [];
    defense_tools = parsedState.defense_tools || [];
    defenseSlots = parsedState.defenseSlots || {
      front: { units: [], wallTools: [], gateTools: [], moatTools: [] },
      left: { units: [], wallTools: [], gateTools: [], moatTools: [] },
      right: { units: [], wallTools: [], gateTools: [], moatTools: [] },
      cy: { units: [], cyTools: [] }
    };
  }
}

//PRESETS
function openWaveCopyModal() {
  const modal = new bootstrap.Modal(document.getElementById('waveCopyModal'));
  modal.show();
  document.getElementById('currentWaveText').textContent = `Wave ${currentWaveIndex} / ${attackBasics.maxWaves}`;
}

function changeWave(direction) {
  currentWaveIndex += direction;

  if (currentWaveIndex > attackBasics.maxWaves) {
    currentWaveIndex = 1;
  }

  if (currentWaveIndex < 1) {
    currentWaveIndex = attackBasics.maxWaves;
  }

  document.getElementById('currentWaveText').textContent = `Wave ${currentWaveIndex} / ${attackBasics.maxWaves}`;
}

function selectPreset(presetNumber) {
  selectedPreset = presetNumber;

  const presetItems = document.querySelectorAll('.preset-item');
  presetItems.forEach(item => item.classList.remove('selected-preset'));

  const selectedRadioButton = document.getElementById('preset' + presetNumber);
  selectedRadioButton.checked = true;

  selectedRadioButton.parentNode.classList.add('selected-preset');
}

function saveToPreset() {
  if (selectedPreset === null) {
    displayNotification("Please select a preset to save to.");
    return;
  }

  presets[selectedPreset] = {
    units: {
      left: JSON.parse(JSON.stringify(totalUnits.left[currentWaveIndex - 1] || [])),
      front: JSON.parse(JSON.stringify(totalUnits.front[currentWaveIndex - 1] || [])),
      right: JSON.parse(JSON.stringify(totalUnits.right[currentWaveIndex - 1] || [])),
    },
    tools: {
      left: JSON.parse(JSON.stringify(totalTools.left[currentWaveIndex - 1] || [])),
      front: JSON.parse(JSON.stringify(totalTools.front[currentWaveIndex - 1] || [])),
      right: JSON.parse(JSON.stringify(totalTools.right[currentWaveIndex - 1] || [])),
    }
  };

  localStorage.setItem('presets', JSON.stringify(presets));

  displayNotification(`Saved current wave to preset ${selectedPreset}`);
}

function loadPresets() {
  const storedPresets = localStorage.getItem('presets');
  if (storedPresets) {
    presets = JSON.parse(storedPresets);
  }
}

function applyPreset() {
  if (selectedPreset === null || !presets[selectedPreset]) {
    displayNotification("Please select a valid preset to apply.");
    return;
  }

  const previousSide = currentSide;

  totalUnits.left[currentWaveIndex - 1] = JSON.parse(JSON.stringify(presets[selectedPreset].units.left));
  totalUnits.front[currentWaveIndex - 1] = JSON.parse(JSON.stringify(presets[selectedPreset].units.front));
  totalUnits.right[currentWaveIndex - 1] = JSON.parse(JSON.stringify(presets[selectedPreset].units.right));

  totalTools.left[currentWaveIndex - 1] = JSON.parse(JSON.stringify(presets[selectedPreset].tools.left));
  totalTools.front[currentWaveIndex - 1] = JSON.parse(JSON.stringify(presets[selectedPreset].tools.front));
  totalTools.right[currentWaveIndex - 1] = JSON.parse(JSON.stringify(presets[selectedPreset].tools.right));

  ['front', 'left', 'right'].forEach(side => {
    switchSide(side);
  });

  switchSide(previousSide);

  generateWaves(currentSide, attackBasics.maxWaves);

  displayNotification(`Applied Preset ${selectedPreset} to Wave ${currentWaveIndex}`);
}

function applyPresetToAll() {
  if (selectedPreset === null || !presets[selectedPreset]) {
    displayNotification("Please select a valid preset to apply.");
    return;
  }

  const previousSide = currentSide;

  for (let i = 0; i < attackBasics.maxWaves; i++) {
    totalUnits.left[i] = JSON.parse(JSON.stringify(presets[selectedPreset].units.left));
    totalUnits.front[i] = JSON.parse(JSON.stringify(presets[selectedPreset].units.front));
    totalUnits.right[i] = JSON.parse(JSON.stringify(presets[selectedPreset].units.right));

    totalTools.left[i] = JSON.parse(JSON.stringify(presets[selectedPreset].tools.left));
    totalTools.front[i] = JSON.parse(JSON.stringify(presets[selectedPreset].tools.front));
    totalTools.right[i] = JSON.parse(JSON.stringify(presets[selectedPreset].tools.right));
  }

  ['front', 'left', 'right'].forEach(side => {
    switchSide(side);
  });

  switchSide(previousSide);

  generateWaves(currentSide, attackBasics.maxWaves);
  displayNotification(`Applied Preset ${selectedPreset} to all waves`);
}

function displayNotification(message) {
  const notificationMessage = document.getElementById('notificationMessage');
  notificationMessage.textContent = message;

  const notificationBar = document.getElementById('notificationBar');

  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
  }

  notificationBar.classList.add('show');

  notificationTimeout = setTimeout(() => {
    notificationBar.classList.remove('show');
  }, 2000);
}

const waveContainerPreset = document.querySelector('#waveCopyModal .modal-body');
let touchStartXPreset = 0;
let touchEndXPreset = 0;

waveContainer.addEventListener('touchstart', (event) => {
  touchStartX = event.touches[0].clientX;
});

waveContainer.addEventListener('touchend', (event) => {
  touchEndX = event.changedTouches[0].clientX;
  handleSwipePreset();
});

function handleSwipePreset() {
  const swipeDistance = touchEndX - touchStartX;
  const threshold = 50;

  if (swipeDistance > threshold) {
    changeWave(-1);
  } else if (swipeDistance < -threshold) {
    changeWave(1);
  }
}

//BATTLE REPORT MODAL (...)
function switchReportSide(side) {
  document.querySelectorAll('.flanks-button-report').forEach(button => {
    button.classList.remove('active');
  });
  populateBattleReportModal(side);
  const activeButton = document.querySelector(`.flanks-button-report[data-section="${side}"]`);
  activeButton.classList.add('active');
}

function populateBattleReportModal(side) {
  const attackerContainer = document.querySelector('.report-attackers .row');
  attackerContainer.innerHTML = '';

  const defenderContainer = document.querySelector('.report-defenders .row');
  defenderContainer.innerHTML = '';

  const waveSummaryContainer = document.getElementById('wave-summary-container');
  waveSummaryContainer.innerHTML = '';

  let totalAttackers = 0;
  let totalDefenders = 0;

  ['front', 'left', 'right'].forEach(sideKey => {
    if (waves[sideKey]) {
      waves[sideKey].forEach(wave => {
        wave.slots.forEach(slot => {
          if (slot && slot.count > 0) {
            totalAttackers += slot.count;
          }
        });
      });
    }
  });

  if (waves['CY']) {
    waves['CY'][0].slots.forEach(slot => {
      if (slot && slot.count > 0) {
        totalAttackers += slot.count;
      }
    });
  }

  ['front', 'left', 'right', 'cy'].forEach(sideKey => {
    if (defenseSlots[sideKey]?.units) {
      defenseSlots[sideKey].units.forEach(unit => {
        if (unit && unit.count > 0) {
          totalDefenders += unit.count;
        }
      });
    }
  });

  const attackerCountElement = document.querySelector('.report-troops-sum .col-6:nth-child(1)');
  const defenderCountElement = document.querySelector('.report-troops-sum .col-6:nth-child(2)');

  if (attackerCountElement) {
    attackerCountElement.textContent = `${totalAttackers}`;
  }

  if (defenderCountElement) {
    defenderCountElement.textContent = `${totalDefenders}`;
  }

  const attackers = (side === 'cy' && waves['CY'])
    ? waves['CY'][0].slots
    : (waves[side] || []).flatMap(wave => wave.slots);

  const attackerSummary = attackers.reduce((acc, unit) => {
    if (unit && unit.count > 0 && unit.type) {
      acc[unit.type] = (acc[unit.type] || 0) + unit.count;
    }
    return acc;
  }, {});

  const defenderSummary = defenseSlots[side]?.units?.reduce((acc, unit) => {
    if (unit && unit.count > 0) {
      const key = unit.type || unit.id;
      acc[key] = (acc[key] || 0) + unit.count;
    }
    return acc;
  }, {}) || {};

  Object.entries(attackerSummary).forEach(([key, count]) => {
    const unitImage = unitImages[key] || 'default-attack-icon.png';
    const attackerHTML = `
      <div class="unit-slot">
        <div class="unit-icon-container">
          <img src="./img/${unitImage}" class="unit-icon" alt="${key}">
          <div class="unit-count">${count}</div>
        </div>
      </div>
    `;
    attackerContainer.insertAdjacentHTML('beforeend', attackerHTML);
  });

  Object.entries(defenderSummary).forEach(([key, count]) => {
    const unitImage = unitImagesDefense[key] || 'default-defense-icon.png';
    const defenderHTML = `
      <div class="unit-slot">
        <div class="unit-icon-container">
          <img src="./img/${unitImage}" class="unit-icon" alt="${key}">
          <div class="unit-count">${count}</div>
        </div>
      </div>
    `;
    defenderContainer.insertAdjacentHTML('beforeend', defenderHTML);
  });

  if (!waves[side] || waves[side].length === 0) {
    return;
  }

  waves[side].forEach((wave, index) => {
    const hasUnits = wave.slots.some(slot => slot.count > 0);
    if (hasUnits) {
      const waveHTML = `
        <div class="player-flank text-center">
          <span>WAVE ${index + 1}</span>
        </div>
        <div class="card-body margin-bug-fix report-wave">
          <div class="row">
            <div class="col bugfix report-attackers" style="border-right: 1px solid rgb(180, 140, 100);">
              <div class="row">
                ${wave.slots
          .map(slot => {
            if (slot && slot.count > 0) {
              const unitImage = unitImages[slot.type] || 'default-attack-icon.png';
              return `
                        <div class="unit-slot">
                          <div class="unit-icon-container">
                            <img src="./img/${unitImage}" class="unit-icon" alt="${slot.type}">
                            <div class="unit-count">${slot.count}</div>
                          </div>
                        </div>
                      `;
            }
            return '';
          })
          .join('')}
              </div>
            </div>
            <div class="col bugfix report-defenders">
              <div class="row">
                <!-- Defenders are not displayed per wave -->
              </div>
            </div>
          </div>
        </div>
      `;
      waveSummaryContainer.insertAdjacentHTML('beforeend', waveHTML);
    }
  });
}

//GENERATE HTML MODALS
function createModal(id, title, bodyContent, footerButtons) {
  const modal = document.createElement('div');
  modal.className = 'modal fade';
  modal.id = id;
  modal.tabIndex = -1;
  modal.setAttribute('aria-labelledby', `${id}Label`);
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
              <div class="modal-header d-flex justify-content-center">
                  <h5 class="modal-title" id="${id}Label">${title}</h5>
              </div>
              <div class="modal-body p-0">
                  ${bodyContent}
              </div>
              <div class="modal-footer d-flex justify-content-center">
                  ${footerButtons}
              </div>
          </div>
      </div>
  `;
  document.body.appendChild(modal);
}

function generateInputCard(title, imageSrc, altText, sliderId, min, max, value, valueId, inputMin, inputMax, inputValue) {
  value = value || 0;

  return `
      <div class="col-12">
          <div class="modal-card-body mt-1">
              <h6 class="card-title text-center">${title}</h6>
              <div class="d-flex align-items-center">
                  <div class="me-2">
                      <img src="${imageSrc}" alt="${altText}" class="modal-image" />
                  </div>
                  <div class="flex-grow-1">
                      <div class="d-flex align-items-center">
                          <input type="range" id="${sliderId}" min="${min}" max="${max}" value="${value}" class="form-range">
                          <input type="number" id="${valueId}" value="${inputValue || 0}" min="${inputMin}" max="${inputMax}" class="form-control w-25" style="margin-left: 10px;" />
                      </div>
                  </div>
              </div>
          </div>
      </div>
  `;
}

const modalsData = [
  //Presets modal
  {
    id: 'waveCopyModal',
    title: 'Presets',
    body: `
          <div class="wave-navigation mb-2">
              <button class="nav-btn" onclick="changeWave(-1)">&#9664;</button>
              <span id="currentWaveText">Wave 1 / X</span>
              <button class="nav-btn" onclick="changeWave(1)">&#9654;</button>
          </div>
          <div class="preset-list">
              ${[...Array(8)].map(
      (_, i) => `
                  <div class="preset-item" onclick="selectPreset(${i + 1})">
                      <input type="radio" name="preset" id="preset${i + 1}">
                      <label for="preset${i + 1}">&nbspPreset ${i + 1}</label>
                  </div>
              `
    ).join('')}
          </div>
      `,
    footer: `
          <button class="btn btn-save presets-button" onclick="saveToPreset()">
              <img src="./img/icon_save.webp" alt="Save" class="icon" />
          </button>
          <button class="btn btn-apply presets-button" onclick="applyPreset()">
              <img src="./img/icon_applyOne.webp" alt="Apply" class="icon" />
          </button>
          <button class="btn btn-apply-all presets-button" onclick="applyPresetToAll()">
              <img src="./img/icon_applyAll.webp" alt="Apply to All" class="icon" />
          </button>
      `
  },
  //Defense basics modal
  {
    id: 'defenseBasicsModal',
    title: 'Defense Basics',
    body: `
        <div class="player-flanks d-flex justify-content-between align-items-center">
            <div class="row flanks ms-1">
                <button class="btn flanks-button-defense sides" data-section="left" onclick="switchDefenseSide('left')">
                    <img src="./img/left-icon.webp" alt="L">
                </button>
                <button class="btn flanks-button-defense sides active" data-section="front" onclick="switchDefenseSide('front')">
                    <img src="./img/front-icon.webp" alt="F">
                </button>
                <button class="btn flanks-button-defense sides" data-section="right" onclick="switchDefenseSide('right')">
                    <img src="./img/right-icon.webp" alt="R">
                </button>
                <button class="btn flanks-button-defense sides" data-section="cy" onclick="switchDefenseSide('cy')">
                    <img src="./img/cy-icon.webp" alt="CY">
                </button>
            </div>
        </div>
        <div class="player-flank d-flex">
            <span id="current-defense-flank">Castle wall: Front</span>
        </div>
        <div class="col-12">
            <div class="card w-100">
                <div class="modal-card-body mt-1">
                    <h6 class="card-title text-center">Defense troops</h6>
                    <div class="d-flex align-items-center">
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between defense-modal-fix mt-2 mb-2 ms-2 me-2 unit-slot-container"></div>
                        </div>
                    </div>
                    <div class="text-center">
                        <span id="troopCombatBonuses"></span>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-12">
            <div class="card w-100">
                <div class="modal-card-body mt-1">
                    <h6 class="card-title text-center">Defense tools</h6>
                    <div class="d-flex align-items-center">
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between defense-modal-fix mt-2 mb-2 ms-2 me-2" id="toolsSlots"></div>
                        </div>
                    </div>
                    <div class="text-center">
                        <span id="toolBonuses"></span>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-12">
            <div class="card w-100">
                <div class="modal-card-body mt-1 unit-distributon-modal">
                    <h6 class="card-title text-center">Unit distribution</h6>
                    <div class="row d-flex align-items-center justify-content-center">
                        <div class="d-flex justify-content-center mb-1 mt-2">
                            <img src="./img/castellan-modal1.png" alt="Tools" style="width: 20px; height: 20px; vertical-align: middle;">
                            <span id="leftPercentage" class="selector-value">0%</span>
                            <input type="range" id="defenseStrengthSlider" min="0" max="100" value="0" class="form-range" disabled />
                            <img src="./img/castellan-modal2.png" alt="Tools" style="width: 20px; height: 20px; vertical-align: middle;">
                            <span id="rightPercentage" class="selector-value">0%</span>
                        </div>
                        <div class="col-4 d-flex flex-column align-items-center justify-content-center text-center">
                            <div class="d-flex align-items-center justify-content-center">
                                <img src="./img/wall-icon.png" alt="Tools" style="width: 22px; height: auto;">
                                <span class="unit-distributon-modal-value" id="leftFlank">X%</span>
                            </div>
                            <hr class="yellow-line">
                            <span class="unit-distributon-modal-side">Left flank</span>
                        </div>
                        <div class="col-4 d-flex flex-column align-items-center justify-content-center text-center">
                            <div class="d-flex align-items-center justify-content-center">
                                <img src="./img/gate-icon.png" alt="Tools" style="width: 22px; height: auto; vertical-align: middle;">
                                <span class="unit-distributon-modal-value" id="front">X%</span>
                            </div>
                            <hr class="red-line">
                            <span class="unit-distributon-modal-side">Front</span>
                        </div>
                        <div class="col-4 d-flex flex-column align-items-center justify-content-center text-center">
                            <div class="d-flex align-items-center justify-content-center">
                                <img src="./img/wall-icon.png" alt="Tools" style="width: 22px; height: auto;">
                                <span class="unit-distributon-modal-value" id="rightFlank">X%</span>
                            </div>
                            <hr class="yellow-line">
                            <span class="unit-distributon-modal-side">Right flank</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    footer: ''
  },
  //Defense tools modal
  {
    id: 'toolModalDefense',
    title: 'Defense Tools',
    body: `<div class="modal-body p-0"></div>`,
    footer: `
        <button type="button" id="confirmDefenseTools" class="btn btn-success btn-confirm">
          Confirm
        </button>
    `
  },
  //Defense troops modal
  {
    id: 'unitModalDefense',
    title: 'Defense Soldiers',
    body: `<div class="modal-body p-0"></div>`,
    footer: `
        <button type="button" id="confirmDefenseUnits" class="btn btn-success btn-confirm">
          Confirm
        </button>
    `
  },
  //Attacker troops modal
  {
    id: 'unitModal',
    title: 'Soldiers',
    body: `<div class="modal-body p-0"></div>`,
    footer: `
        <button type="button" id="confirmUnits" class="btn btn-success btn-confirm">
          Confirm
        </button>
    `
  },
  //Attacker tools modal
  {
    id: 'toolModal',
    title: 'Tools',
    body: `<div class="modal-body p-0 tool-modal-body"></div>`,
    footer: `
        <button type="button" id="confirmTools" class="btn btn-success btn-confirm">
          Confirm
        </button>
    `
  },
  //Attacker support tool modal
  {

    id: 'supportToolModal',
    title: 'Tools',
    body: `<div class="modal-body p-0 support-tool-modal-body"></div>`,
    footer: `
        <button type="button" id="confirmSupportTools" class="btn btn-success btn-confirm">
          Confirm
        </button>
    `
  },
  //Attacker basics modal
  {
    id: 'basicsModal',
    title: 'Attack Basics',
    body: `
        ${generateInputCard(
      'Waves', './img/attack-modal1.png', 'wave',
      'waves-slider', 4, 18, attackBasics.maxWaves,
      'waves-value', 4, 18, attackBasics.maxWaves
    )}
        ${generateInputCard(
      'Front unit limit', './img/attack-modal2.png', 'front-unit-limit',
      'front-unit-slider', 192, 1600, attackBasics.maxUnits.front,
      'front-unit-value', 192, 1600, attackBasics.maxUnits.front
    )}
        ${generateInputCard(
      'Flank unit limit', './img/attack-modal3.png', 'flank-unit-limit',
      'flank-unit-slider', 64, 800, attackBasics.maxUnits.left,
      'flank-unit-value', 64, 800, attackBasics.maxUnits.left
    )}
        ${generateInputCard(
      'Courtyard unit limit', './img/attack-modal4.png', 'courtyard-unit-limit',
      'courtyard-unit-slider', 2089, 6000, attackBasics.maxUnitsCY,
      'courtyard-unit-value', 2089, 6000, attackBasics.maxUnitsCY
    )}
        ${generateInputCard(
      'Flank tool limit', './img/attack-modal5.png', 'flank-tool-limit',
      'flank-tool-slider', 40, 50, attackBasics.maxTools.left,
      'flank-tool-value', 40, 50, attackBasics.maxTools.left
    )}
        ${generateInputCard(
      'Level of "Valkyre ranger"', './img/attack-modal6.png', 'valkyre-ranger-lv',
      'mead-range-level-slider', 0, 10, attackBasics.meadRangeLevel,
      'mead-range-level-value', 0, 10, attackBasics.meadRangeLevel
    )}
        ${generateInputCard(
      'Level of "Shield-maiden"', './img/attack-modal7.png', 'shield-maiden-lv',
      'mead-melee-level-slider', 0, 10, attackBasics.meadMeleeLevel,
      'mead-melee-level-value', 0, 10, attackBasics.meadMeleeLevel
    )}
        ${generateInputCard(
      'Level of "Glasswing Archer"', './img/attack-modal8.png', 'glasswing-archer-lv',
      'beaf-range-level-slider', 0, 10, attackBasics.beafRangeLevel,
      'beaf-range-level-value', 0, 10, attackBasics.beafRangeLevel
    )}
        ${generateInputCard(
      'Level of "Flamebreath Berserker"', './img/attack-modal9.png', 'flamebreath-berserker-lv',
      'beaf-melee-level-slider', 0, 10, attackBasics.beafMeleeLevel,
      'beaf-melee-level-value', 0, 10, attackBasics.beafMeleeLevel
    )}
        ${generateInputCard(
      'Level of "Scaleshard Marksman"', './img/attack-modal10.png', 'scaleshard-marksman-lv',
      'beaf-veteran-range-level-slider', 0, 10, attackBasics.beafVeteranRangeLevel,
      'beaf-veteran-range-level-value', 0, 10, attackBasics.beafVeteranRangeLevel
    )}
        ${generateInputCard(
      'Level of "Scalesbound Guardian"', './img/attack-modal11.png', 'scalesbound-guardian-lv',
      'beaf-veteran-melee-level-slider', 0, 10, attackBasics.beafVeteranMeleeLevel,
      'beaf-veteran-melee-level-value', 0, 10, attackBasics.beafVeteranMeleeLevel
    )}
    `,
    footer: `
        <button type="button" id="confirmBasics" class="btn btn-success btn-confirm">
          Confirm
        </button>
    `
  },
  //Commander stats modal
  {
    id: 'commanderStatsModal',
    title: 'Attack Stats',
    body: `
        ${generateInputCard(
      'Melee strength (%)', './img/melee-icon.png', 'melee-strength',
      'melee-strength-slider', 0, 800, commanderStats.meleeStrength,
      'melee-strength-value', 0, 800, commanderStats.meleeStrength
    )}
        ${generateInputCard(
      'Ranged strength (%)', './img/ranged-icon.png', 'ranged-strength',
      'ranged-strength-slider', 0, 800, commanderStats.rangedStrength,
      'ranged-strength-value', 0, 800, commanderStats.rangedStrength
    )}
        ${generateInputCard(
      'Combat strength (%)', './img/universal-icon.png', 'universal-strength',
      'universal-strength-slider', 0, 20, commanderStats.combatStrength,
      'universal-strength-value', 0, 20, commanderStats.combatStrength
    )}
        ${generateInputCard(
      'Courtyard strength (%)', './img/cy-icon.png', 'courtyard-strength',
      'courtyard-strength-slider', 0, 800, commanderStats.courtyardStrength,
      'courtyard-strength-value', 0, 800, commanderStats.courtyardStrength
    )}
        ${generateInputCard(
      'Wall reduction (%)', './img/commander-modal1.png', 'wall-reduction',
      'wall-reduction-slider', 0, 280, commanderStats.wallReduction,
      'wall-reduction-value', 0, 280, commanderStats.wallReduction
    )}
        ${generateInputCard(
      'Moat reduction (%)', './img/commander-modal2.png', 'moat-reduction',
      'moat-reduction-slider', 0, 180, commanderStats.moatReduction,
      'moat-reduction-value', 0, 180, commanderStats.moatReduction
    )}
        ${generateInputCard(
      'Gate reduction (%)', './img/commander-modal3.png', 'gate-reduction',
      'gate-reduction-slider', 0, 280, commanderStats.gateReduction,
      'gate-reduction-value', 0, 280, commanderStats.gateReduction
    )}
        ${generateInputCard(
      'Mead unit strength', './img/commander-modal4.png', 'mead-unit-strength',
      'mead-unit-strength-slider', 0, 20, commanderStats.meadUnitStrength,
      'mead-unit-strength-value', 0, 30, commanderStats.meadUnitStrength
    )}
        ${generateInputCard(
      'Horror unit strength', './img/commander-modal5.png', 'horror-unit-strength',
      'horror-unit-strength-slider', 0, 40, commanderStats.horrorUnitStrength,
      'horror-unit-strength-value', 0, 40, commanderStats.horrorUnitStrength
    )}
        ${generateInputCard(
      'HoL melee strength (%)', './img/melee-icon.png', 'hol-melee-strength',
      'hol-melee-strength-slider', 0, 13, commanderStats.holMeleeStrength,
      'hol-melee-strength-value', 0, 13, commanderStats.holMeleeStrength
    )}
        ${generateInputCard(
      'HoL ranged strength (%)', './img/ranged-icon.png', 'hol-ranged-strength',
      'hol-ranged-strength-slider', 0, 13, commanderStats.holRangedStrength,
      'hol-ranged-strength-value', 0, 13, commanderStats.holRangedStrength
    )}
        ${generateInputCard(
      'HoL combat strength (%)', './img/universal-icon.png', 'hol-universal-strength',
      'hol-universal-strength-slider', 0, 12, commanderStats.holCombatStrength,
      'hol-universal-strength-value', 0, 12, commanderStats.holCombatStrength
    )}
        ${generateInputCard(
      'Strength in front (%)', './img/front-strength.png', 'front-strength',
      'front-strength-slider', 0, 20, commanderStats.strengthInFront,
      'front-strength-value', 0, 20, commanderStats.strengthInFront
    )}
        ${generateInputCard(
      'Strength in flanks (%)', './img/flanks-strength.png', 'flanks-strength',
      'flanks-strength-slider', 0, 20, commanderStats.strengthInFlanks,
      'flanks-strength-value', 0, 20, commanderStats.strengthInFlanks
    )}
    `,
    footer: `
        <button type="button" id="confirmCommanderStats" class="btn btn-success btn-confirm">
          Confirm
        </button>
    `
  },
  //Castellan stats modal
  {
    id: 'castellanStatsModal',
    title: 'Defense Stats',
    body: `
      ${generateInputCard(
      'Melee strength (%)', './img/castellan-modal1.png', 'melee-strength',
      'defense-melee-strength-slider', 100, 500, castellanStats.meleeStrength,
      'defense-melee-strength-value', 0, 500, castellanStats.meleeStrength
    )}
      ${generateInputCard(
      'Ranged strength (%)', './img/castellan-modal2.png', 'ranged-strength',
      'defense-ranged-strength-slider', 100, 500, castellanStats.rangedStrength,
      'defense-ranged-strength-value', 0, 500, castellanStats.rangedStrength
    )}
      ${generateInputCard(
      'Courtyard strength (%)', './img/cy-icon.png', 'courtyard-strength',
      'defense-courtyard-strength-slider', 0, 500, castellanStats.courtyardStrength,
      'defense-courtyard-strength-value', 0, 500, castellanStats.courtyardStrength
    )}
      ${generateInputCard(
      'Wall unit limit', './img/castellan-modal3.png', 'wall-unit-limit',
      'wall-unit-limit-slider', 100, 15000, castellanStats.wallUnitLimit,
      'wall-unit-limit-value', 100, 15000, castellanStats.wallUnitLimit
    )}
      ${generateInputCard(
      'Courtyard unit limit', './img/attack-modal4.png', 'cy-unit-limit',
      'cy-unit-limit-slider', 10000, 999999, castellanStats.cyUnitLimit,
      'cy-unit-limit-value', 10000, 999999, castellanStats.cyUnitLimit
    )}
      ${generateInputCard(
      'Wall protection (%)', './img/castellan-modal4.png', 'wall-protection',
      'defense-wall-protection-slider', 0, 480, castellanStats.wallProtection,
      'defense-wall-protection-value', 0, 480, castellanStats.wallProtection
    )}
      ${generateInputCard(
      'Moat protection (%)', './img/castellan-modal5.png', 'moat-protection',
      'defense-moat-protection-slider', 0, 260, castellanStats.moatProtection,
      'defense-moat-protection-value', 0, 260, castellanStats.moatProtection
    )}
      ${generateInputCard(
      'Gate protection (%)', './img/castellan-modal6.png', 'gate-protection',
      'defense-gate-protection-slider', 0, 480, castellanStats.gateProtection,
      'defense-gate-protection-value', 0, 480, castellanStats.gateProtection
    )}
  `,
    footer: `
      <button type="button" id="confirmCastellanStats" class="btn btn-success btn-confirm">
        Confirm
      </button>
  `
  }
];

modalsData.forEach(modal => {
  createModal(modal.id, modal.title, modal.body, modal.footer);
});

//CALCULATIONS (...)
function battleSimulation() {
  console.clear();
  const defenseStrengths = calculateDefenseStrength();
  const totalAttackUnits = calculateAttackStrength();
  logResults(defenseStrengths, totalAttackUnits);

  const battleReportModal = new bootstrap.Modal(document.getElementById('battleReportModal'));
  battleReportModal.show();
  switchReportSide('front')
}

function summarizeToolBonusesForWave(tools) {
  const totalEffects = {};

  tools.forEach(tool => {
    const effectData = toolEffects[tool.type];
    if (effectData) {
      if (!totalEffects[effectData.effect1.name]) {
        totalEffects[effectData.effect1.name] = { totalEffect1: 0, totalEffect2: 0 };
      }
      totalEffects[effectData.effect1.name].totalEffect1 += tool.count * effectData.effect1.value;

      if (effectData.effect2.name) {
        if (!totalEffects[effectData.effect2.name]) {
          totalEffects[effectData.effect2.name] = { totalEffect1: 0, totalEffect2: 0 };
        }
        totalEffects[effectData.effect2.name].totalEffect2 += tool.count * effectData.effect2.value;
      }
    }
  });

  const effectsArray = Object.entries(totalEffects).map(([name, { totalEffect1, totalEffect2 }]) => {
    return { name, totalEffect1, totalEffect2 };
  });

  effectsArray.sort((a, b) => {
    const totalA = Math.abs(a.totalEffect1) + Math.abs(a.totalEffect2);
    const totalB = Math.abs(b.totalEffect1) + Math.abs(b.totalEffect2);
    return totalB - totalA;
  });

  effectsArray.forEach(({ name, totalEffect1, totalEffect2 }) => {
    if (totalEffect1 !== 0) {
      console.log(`${name}: ${totalEffect1 < 0 ? '' : '+'}${totalEffect1}%`);
    }
    if (totalEffect2 !== 0) {
      console.log(`${name}: ${totalEffect2 < 0 ? '' : '+'}${totalEffect2}%`);
    }
  });
}

function summarizeDefenseToolBonuses(side) {
  const bonuses = {
    melee: castellanStats.melee,
    ranged: castellanStats.ranged,
    wall: castellanStats.wallProtection,
    moat: castellanStats.moatProtection,
    gate: castellanStats.gateProtection,
    courtyard: castellanStats.courtyard
  };

  if (side !== 'cy') {
    ['wallTools', 'moatTools', 'gateTools'].forEach(slotType => {
      const tools = defenseSlots[side][slotType] || [];

      tools.forEach(tool => {
        if (tool && tool.count > 0) {
          const toolId = tool.type.replace('DefenseTool', '');
          const effectData = toolEffectsDefense[toolId];

          if (effectData) {
            if (effectData.effect1.name === 'MeleeStrength') {
              bonuses.melee += tool.count * effectData.effect1.value;
            } else if (effectData.effect1.name === 'Wall') {
              bonuses.wall += tool.count * effectData.effect1.value;
            } else if (effectData.effect1.name === 'Moat') {
              bonuses.moat += tool.count * effectData.effect1.value;
            } else if (effectData.effect1.name === 'Gate') {
              bonuses.gate += tool.count * effectData.effect1.value;
            } else if (effectData.effect1.name === 'RangedStrength') {
              bonuses.ranged += tool.count * effectData.effect1.value;
            }

            if (effectData.effect2.name === 'RangedStrength') {
              bonuses.ranged += tool.count * effectData.effect2.value;
            } else if (effectData.effect2.name === 'Wall') {
              bonuses.wall += tool.count * effectData.effect2.value;
            } else if (effectData.effect2.name === 'Moat') {
              bonuses.moat += tool.count * effectData.effect2.value;
            } else if (effectData.effect2.name === 'Gate') {
              bonuses.gate += tool.count * effectData.effect2.value;
            } else if (effectData.effect2.name === 'MeleeStrength') {
              bonuses.melee += tool.count * effectData.effect2.value;
            }
          }
        }
      });
    });
  }

  console.log(`${side.charAt(0).toUpperCase() + side.slice(1)} oldal védelem:`);
  console.log(`Közeles erő: +${bonuses.melee}%`);
  console.log(`Távos erő: +${bonuses.ranged}%`);
  console.log(`Fal védelem: +${bonuses.wall}%`);
  console.log(`Kapuvédelem: +${bonuses.gate}%`);
  console.log(`Árokvédelem: +${bonuses.moat}%`);
}

function calculateDefenseStrength() {
  let defenseStrengths = {
    left: { melee: 0, ranged: 0, count: 0 },
    right: { melee: 0, ranged: 0, count: 0 },
    front: { melee: 0, ranged: 0, count: 0 },
    cy: { melee: 0, ranged: 0, count: 0 }
  };

  let totalDefenseUnits = 0;

  ['left', 'right', 'front'].forEach(side => {
    defenseSlots[side].units.forEach(slot => {
      if (slot && slot.count > 0) {
        totalDefenseUnits += slot.count;
        defenseStrengths[side].count += slot.count;

        const unitStat = unitStats.find(unit => unit.type === slot.type);
        if (unitStat) {
          defenseStrengths[side].melee += slot.count * unitStat.meleeDefenseStrength;
          defenseStrengths[side].ranged += slot.count * unitStat.rangedDefenseStrength;
        }
      }

      summarizeDefenseToolBonuses(side);
    });
  });

  defenseSlots.cy.units.forEach(slot => {
    if (slot && slot.count > 0) {
      totalDefenseUnits += slot.count;
      defenseStrengths.cy.count += slot.count;

      const unitStat = unitStats.find(unit => unit.type === slot.type);
      if (unitStat) {
        defenseStrengths.cy.melee += slot.count * unitStat.meleeDefenseStrength;
        defenseStrengths.cy.ranged += slot.count * unitStat.rangedDefenseStrength;
      }
    }
  });

  return defenseStrengths;
}

function calculateAttackStrength() {
  let meleeAttackBonus = commanderStats.melee + commanderStats.holMelee + commanderStats.universal + commanderStats.holUniversal;
  let rangedAttackBonus = commanderStats.ranged + commanderStats.holRanged + commanderStats.universal + commanderStats.holUniversal;
  let totalAttackUnits = 0;

  ['left', 'right', 'front'].forEach(side => {
    totalUnits[side].forEach((wave, waveIndex) => {
      let waveTotal = 0;
      let totalMeleeStats = 0;
      let totalRangedStats = 0;

      let toolMeleeBonus = 0;
      let toolRangedBonus = 0;

      if (side === 'front') {
        meleeAttackBonus += commanderStats.frontStrength;
        rangedAttackBonus += commanderStats.frontStrength;
      } else if (side === 'left' || side === 'right') {
        meleeAttackBonus += commanderStats.flanksStrength;
        rangedAttackBonus += commanderStats.flanksStrength;
      }

      if (waves[side] && waves[side][waveIndex] && waves[side][waveIndex].tools) {
        const tools = waves[side][waveIndex].tools;

        tools.forEach(tool => {
          const effectData = toolEffects[tool.type];
          if (effectData) {
            if (effectData.effect1.name === 'MeleeStrength') {
              toolMeleeBonus += tool.count * effectData.effect1.value;
            } else if (effectData.effect1.name === 'RangedStrength') {
              toolRangedBonus += tool.count * effectData.effect1.value;
            }

            if (effectData.effect2.name === 'MeleeStrength') {
              toolMeleeBonus += tool.count * effectData.effect2.value;
            } else if (effectData.effect2.name === 'RangedStrength') {
              toolRangedBonus += tool.count * effectData.effect2.value;
            }
          }
        });

        console.log(`${side} oldal, ${waveIndex + 1}. hullám eszköz bónuszai:`);
        summarizeToolBonusesForWave(tools);
      }

      const totalMeleeAttackBonus = meleeAttackBonus + toolMeleeBonus;
      const totalRangedAttackBonus = rangedAttackBonus + toolRangedBonus;

      wave.forEach(unit => {
        if (unit && unit.count > 0) {
          totalAttackUnits += unit.count;
          waveTotal += unit.count;

          const unitStat = unitStats.find(u => u.type === unit.type);
          if (unitStat) {
            let melee = unit.count * unitStat.meleeCombatStrength;
            let ranged = unit.count * unitStat.rangedCombatStrength;

            if (unit.type === 'Unit1') {
              ranged += unit.count * commanderStats.meadStrength;
            }

            if (unit.type === 'Unit2') {
              melee += unit.count * commanderStats.meadStrength;
            }

            if (unit.type === 'Unit3' || unit.type === 'Unit5') {
              ranged += unit.count * commanderStats.horrorStrength;
            }

            if (unit.type === 'Unit4' || unit.type === 'Unit6') {
              melee += unit.count * commanderStats.horrorStrength;
            }

            melee = Math.round(melee * (1 + totalMeleeAttackBonus / 100));
            ranged = Math.round(ranged * (1 + totalRangedAttackBonus / 100));

            totalMeleeStats += melee;
            totalRangedStats += ranged;
          }
        }
      });

      if (waveTotal > 0) {
        console.log(`${side} oldal, ${waveIndex + 1}. hullám: ${waveTotal} katona - ${totalMeleeStats} közeles harcereje / ${totalRangedStats} távos harcereje`);
      }
    });
  });

  return totalAttackUnits;
}

function logResults(defenseStrengths, totalAttackUnits) {
  console.log(`Bal oldalon: ${defenseStrengths.left.count} katona - ${defenseStrengths.left.melee} közeles harcereje / ${defenseStrengths.left.ranged} távos harcereje`);
  console.log(`Jobb oldalon: ${defenseStrengths.right.count} katona - ${defenseStrengths.right.melee} közeles harcereje / ${defenseStrengths.right.ranged} távos harcereje`);
  console.log(`Előrészen: ${defenseStrengths.front.count} katona - ${defenseStrengths.front.melee} közeles harcereje / ${defenseStrengths.front.ranged} távos harcereje`);
  //console.log(`CY udvaron: ${defenseStrengths.cy.count} katona - ${defenseStrengths.cy.melee} közeles harcereje / ${defenseStrengths.cy.ranged} távos harcereje`);

  let totalDefenseCount = defenseStrengths.left.count + defenseStrengths.right.count + defenseStrengths.front.count + defenseStrengths.cy.count;
  console.log(`Összes védő katona: ${totalDefenseCount}`);
  console.log(`Összes támadó katona: ${totalAttackUnits}`);
}

//LOAD WAVES & DEFENSE
window.onload = function () {
  generateWaves('front', attackBasics.maxWaves);
  loadPresets();
  loadDefenseState();
};
