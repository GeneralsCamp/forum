import { defenseSlots, defenseSides, defense_units, toolEffectsDefense, castellanStats, unitImagesDefense, toolImagesDefense } from '../data/variables.js';
import { openDefenseToolsModal } from './modals/defenseToolsModal.js';
import { openDefenseUnitsModal } from './modals/defenseUnitsModal.js';

export function createDefenseUnitIcon(slot) {
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

export function createDefenseToolIcon(slot) {
  const toolIconContainer = document.createElement('div');
  toolIconContainer.classList.add('tool-icon-container');

  const toolIcon = document.createElement('img');
  const toolId = slot.type.replace('DefenseTool', '');
  const toolImage = toolImagesDefense[`DefenseTool${toolId}`];

  toolIcon.src = toolImage ? `./img/${toolImage}` : './img/default-tool.png';
  toolIcon.classList.add('tool-icon');
  toolIcon.alt = slot.type;

  toolIconContainer.appendChild(toolIcon);
  return toolIconContainer.outerHTML;
}

export function getToolIcon(tool) {
  switch (tool) {
    case "wall": return "./img/wall-icon.png";
    case "gate": return "./img/gate-icon.png";
    case "moat": return "./img/moat-icon.png";
    case "cy": return "./img/wall-icon.png";
    default: return "./img/empty-slot.png";
  }
}

export function generateUnitSlots(side) {
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

export function generateToolSlots(side, tools) {
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

export function loadDefenseSlots(side) {
  displayDefenseBonuses(side);

  const unitSlots = defenseSlots[side].units;
  unitSlots.forEach((slot, index) => {
    const slotElement = document.getElementById(`unit-slot-${side}-${index + 1}`);
    if (!slotElement) return;

    if (slot) {
      slotElement.dataset.type = slot.type;
      slotElement.dataset.count = slot.count;

      slotElement.innerHTML = slot.count > 0 ? createDefenseUnitIcon(slot) : '+';
    } else {
      slotElement.dataset.type = '';
      slotElement.dataset.count = 0;
      slotElement.innerHTML = '+';
    }
  });
}

export function loadDefenseTools(side) {
  if (side === 'cy') {
    const cySlots = defenseSlots[side].cyTools || [];
    cySlots.forEach((slot, index) => {
      const slotElement = document.getElementById(`tool-slot-${side}-cy-${index + 1}`);
      if (!slotElement) return;

      slotElement.dataset.count = slot?.count || 0;
      slotElement.innerHTML = slot?.count > 0
        ? createDefenseToolIcon(slot)
        : `<img src="${getToolIcon('cy')}" alt="courtyard tool" class="tool-icon" />`;
    });
  } else {
    const wallSlots = defenseSlots[side].wallTools || [];
    const gateSlots = defenseSlots[side].gateTools || [];
    const moatSlots = defenseSlots[side].moatTools || [];
    const cySlots = defenseSlots[side].cyTools || [];

    wallSlots.forEach((slot, index) => {
      const slotElement = document.getElementById(`tool-slot-${side}-wall-${index + 1}`);
      if (!slotElement) return;

      slotElement.dataset.count = slot?.count || 0;
      slotElement.innerHTML = slot?.count > 0
        ? createDefenseToolIcon(slot)
        : `<img src="${getToolIcon('wall')}" alt="wall tool" class="tool-icon" />`;
    });

    gateSlots.forEach((slot, index) => {
      const slotElement = document.getElementById(`tool-slot-${side}-gate-${index + 1}`);
      if (!slotElement) return;

      slotElement.dataset.count = slot?.count || 0;
      slotElement.innerHTML = slot?.count > 0
        ? createDefenseToolIcon(slot)
        : `<img src="${getToolIcon('gate')}" alt="gate tool" class="tool-icon" />`;
    });

    moatSlots.forEach((slot, index) => {
      const slotElement = document.getElementById(`tool-slot-${side}-moat-${index + 1}`);
      if (!slotElement) return;

      slotElement.dataset.count = slot?.count || 0;
      slotElement.innerHTML = slot?.count > 0
        ? createDefenseToolIcon(slot)
        : `<img src="${getToolIcon('moat')}" alt="moat tool" class="tool-icon" />`;
    });

    cySlots.forEach((slot, index) => {
      const slotElement = document.getElementById(`tool-slot-${side}-cy-${index + 1}`);
      if (!slotElement) return;

      slotElement.dataset.count = slot?.count || 0;
      slotElement.innerHTML = slot?.count > 0
        ? createDefenseToolIcon(slot)
        : `<img src="${getToolIcon('cy')}" alt="courtyard tool" class="tool-icon" />`;
    });
  }
}

export function displayDefenseBonuses(side) {
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
        if (effectData.effect1.name === 'Courtyard') bonuses.courtyard += tool.count * effectData.effect1.value;
        if (effectData.effect2.name === 'Courtyard') bonuses.courtyard += tool.count * effectData.effect2.value;
        if (effectData.effect2.name === 'CombatStrength') combatStrengthBonus += tool.count * effectData.effect2.value;
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
            if (effectData.effect1.name === 'MeleeStrength') bonuses.melee += tool.count * effectData.effect1.value;
            else if (effectData.effect1.name === 'Wall') bonuses.wall += tool.count * effectData.effect1.value;
            else if (effectData.effect1.name === 'Moat') bonuses.moat += tool.count * effectData.effect1.value;
            else if (effectData.effect1.name === 'Gate') bonuses.gate += tool.count * effectData.effect1.value;
            else if (effectData.effect1.name === 'RangedStrength') bonuses.ranged += tool.count * effectData.effect1.value;

            if (effectData.effect2.name === 'RangedStrength') bonuses.ranged += tool.count * effectData.effect2.value;
            else if (effectData.effect2.name === 'Wall') bonuses.wall += tool.count * effectData.effect2.value;
            else if (effectData.effect2.name === 'Moat') bonuses.moat += tool.count * effectData.effect2.value;
            else if (effectData.effect2.name === 'Gate') bonuses.gate += tool.count * effectData.effect2.value;
            else if (effectData.effect2.name === 'MeleeStrength') bonuses.melee += tool.count * effectData.effect2.value;
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

export function calculateTroopDefenseStrength(side) {
  calculateTroopDistribution();

  let totalMeleeCount = 0;
  let totalRangedCount = 0;
  let totalMeleeDefense = 0;
  let totalRangedDefense = 0;

  let totalMeleeBonus = castellanStats.melee - 100;
  let totalRangedBonus = castellanStats.ranged - 100;

  let combatStrengthBonus = 0;

  defenseSlots.cy.cyTools.forEach(tool => {
    if (tool?.count > 0) {
      const toolId = tool.type.replace('DefenseTool', '');
      const effectData = toolEffectsDefense[toolId];
      if (effectData?.effect2.name === 'CombatStrength') {
        combatStrengthBonus += tool.count * effectData.effect2.value;
      }
    }
  });

  ['wallTools', 'moatTools', 'gateTools'].forEach(slotType => {
    const tools = defenseSlots[side][slotType] || [];
    tools.forEach(tool => {
      if (tool?.count > 0) {
        const toolId = tool.type.replace('DefenseTool', '');
        const effectData = toolEffectsDefense[toolId];

        if (effectData) {
          if (effectData.effect1.name === 'MeleeStrength') totalMeleeBonus += tool.count * effectData.effect1.value;
          if (effectData.effect2.name === 'MeleeStrength') totalMeleeBonus += tool.count * effectData.effect2.value;
          if (effectData.effect1.name === 'RangedStrength') totalRangedBonus += tool.count * effectData.effect1.value;
          if (effectData.effect2.name === 'RangedStrength') totalRangedBonus += tool.count * effectData.effect2.value;
        }
      }
    });
  });

  totalMeleeBonus += combatStrengthBonus;
  totalRangedBonus += combatStrengthBonus;

  defenseSlots[side].units.forEach(slot => {
    if (slot?.count > 0) {
      const unitId = slot.type.replace('DefenseUnit', 'unit');
      const unitData = defense_units.find(unit => unit.id === unitId);

      if (unitData) {
        if (unitData.type2 === 'ranged') {
          totalRangedCount += slot.count;
          totalRangedDefense += Math.round((unitData.rangedDefenseStrength * (1 + totalRangedBonus / 100)) * slot.count);
          totalMeleeDefense += Math.round((unitData.meleeDefenseStrength * (1 + totalRangedBonus / 100)) * slot.count);
        } else {
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

export function calculateTroopDistribution() {
  let totalCountLeft = 0;
  let totalCountFront = 0;
  let totalCountRight = 0;

  ['left', 'front', 'right'].forEach(side => {
    defenseSlots[side].units.forEach(slot => {
      if (slot?.count > 0) {
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

export function switchDefenseSide(side) {
  const selectedSide = defenseSides[side];
  document.getElementById('current-defense-flank').innerText = selectedSide.name;

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

document.addEventListener('click', (e) => {
    const button = e.target.closest('.flanks-button-defense');
    if (button) {
        switchDefenseSide(button.dataset.section);
    }
});
