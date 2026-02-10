import * as variables from '../data/variables.js';
import { initializeUnits } from '../ui/uiUnits.js';
import { initializeTools } from '../ui/uiTools.js';
import { initializeSupportTools } from '../ui/uiSupport.js';
import { generateAllModals } from '../ui/modals/modalGenerator.js';
import { loadPresets } from '../ui/wavePresets.js';
import { loadDefenseState } from './defenseState.js';

export async function loadData() {
  try {
    const response = await fetch('data.json');
    const data = await response.json();

    variables.units.length = 0;
    variables.units.push(...data.attack_units);

    variables.defense_units.length = 0;
    variables.defense_units.push(...data.defense_units);

    variables.tools.length = 0;
    variables.tools.push(...data.tools);

    variables.defense_tools.length = 0;
    variables.defense_tools.push(...data.defense_tools);

    variables.supportTools.length = 0;
    variables.supportTools.push(...data.Supporttools);

    variables.units.forEach(unit => {
      if (unit.id === "unit2") {
        unit.meleeCombatStrength = 225 + (variables.attackBasics.meadMeleeLevel * 10);
        unit.LootingCapacity = 43 + (variables.attackBasics.meadMeleeLevel * 2);
      }
      if (unit.id === "unit1") {
        unit.rangedCombatStrength = 210 + (variables.attackBasics.meadRangeLevel * 10);
        unit.LootingCapacity = 40 + (variables.attackBasics.meadRangeLevel * 2);
      }
      if (unit.id === "unit8") {
        unit.meleeCombatStrength = 370 + (variables.attackBasics.beefMeleeLevel * 5);
      }
      if (unit.id === "unit7") {
        unit.rangedCombatStrength = 390 + (variables.attackBasics.beefRangeLevel * 5);
      }
      if (unit.id === "unit10") {
        unit.meleeCombatStrength = 430 + (variables.attackBasics.beefVeteranMeleeLevel * 5);
      }
      if (unit.id === "unit9") {
        unit.rangedCombatStrength = 450 + (variables.attackBasics.beefVeteranRangeLevel * 5);
      }

      const unitKey = `Unit${unit.id.charAt(unit.id.length - 1)}`;
      variables.unitImages[unitKey] = unit.image;
    });

    variables.tools.forEach(tool => {
      const toolKey = `Tool${tool.id.charAt(tool.id.length - 1)}`;
      variables.toolEffects[toolKey] = {
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
      variables.toolImages[toolKey] = tool.image;
    });

    variables.defense_tools.forEach(tool => {
      variables.toolEffectsDefense[tool.id] = {
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
      variables.toolImagesDefense[`DefenseTool${tool.id}`] = tool.image;
    });

    variables.supportTools.forEach(tool => {
      const supportKey = `Tool${tool.id.charAt(tool.id.length - 1)}`;
      variables.supportToolImages[supportKey] = tool.image;
      variables.supportToolEffects[supportKey] = {
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

    generateAllModals();
    initializeUnits();
    initializeTools();
    initializeSupportTools();
    loadPresets();
    loadDefenseState();

    const defenseMeleeLevel = variables.castellanStats.defenseMeleeLevel || 0;
    const defenseRangedLevel = variables.castellanStats.defenseRangedLevel || 0;

    variables.defense_units.forEach(unit => {
      if (unit.id === "unit2") {
        const rangedLevelForRanged = Math.min(defenseMeleeLevel, 10);
        unit.rangedDefenseStrength = 88 + (rangedLevelForRanged * 4);
        unit.meleeDefenseStrength = 220 + (defenseMeleeLevel * 10);
      }
      if (unit.id === "unit1") {
        unit.rangedDefenseStrength = 210 + (defenseRangedLevel * 10);
        unit.meleeDefenseStrength = 80 + (defenseRangedLevel * 4);
      }
    });

    variables.unitStats.length = 0;
    Object.keys(variables.unitImages).forEach(key => delete variables.unitImages[key]);
    Object.keys(variables.unitImagesDefense).forEach(key => delete variables.unitImagesDefense[key]);

    variables.units.forEach(unit => {
      const unitKey = `Unit${unit.id.charAt(unit.id.length - 1)}`;
      variables.unitStats.push({
        type: unitKey,
        rangedCombatStrength: unit.rangedCombatStrength,
        meleeCombatStrength: unit.meleeCombatStrength,
        image: unit.image
      });
      variables.unitImages[unitKey] = unit.image;
    });

    variables.defense_units.forEach(unit => {
      const defUnitKey = `DefenseUnit${unit.id.charAt(unit.id.length - 1)}`;
      variables.unitStats.push({
        type: defUnitKey,
        meleeDefenseStrength: unit.meleeDefenseStrength,
        rangedDefenseStrength: unit.rangedDefenseStrength,
        image: unit.image
      });
      variables.unitImagesDefense[defUnitKey] = unit.image;
    });
  } catch (error) {
    console.error('Error loading JSON:', error);
  }
}
