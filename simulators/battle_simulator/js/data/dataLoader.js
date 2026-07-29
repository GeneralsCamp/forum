import * as variables from "./variables.js";
import {
  ATTACK_TOOL_IDS,
  ATTACK_UNIT_IDS,
  DEFENSE_TOOL_IDS,
  DEFENSE_UNIT_IDS,
  SUPPORT_TOOL_IDS
} from "./catalog.js";
import { imageUrl } from "./imagePaths.js";
import { coreInit } from "../../../../overviews/shared/CoreInit.mjs";
import {
  getProp,
  normalizeName
} from "../../../../overviews/shared/RewardResolver.mjs";
import { resolveUnitImageUrl } from "../../../../overviews/shared/UnitImageService.mjs";
import { initializeUnits } from "../ui/uiUnits.js";
import { initializeTools } from "../ui/uiTools.js";
import { initializeSupportTools } from "../ui/uiSupport.js";
import { generateAllModals } from "../ui/modals/modalGenerator.js";
import { loadPresets } from "../ui/wavePresets.js";
import { loadDefenseState } from "./defenseState.js";
import { loadAttackState } from "./attackState.js";

const EFFECT_TYPES = {
  29: "additionalWave",
  48: "combatStrength",
  504: "yardStrength",
  618: "wallLimit",
  619: "combatStrength",
  620: "courtyard",
  621: "killMeleeTroopsYard",
  622: "killRangedTroopsYard",
  632: "killMeleeTroopsYard",
  633: "killRangedTroopsYard",
  634: "killAnyDefenseTroopsYard",
  635: "killAnyTroopsYard"
};

let catalogPromise = null;

function numberValue(entity, keys, fallback = 0) {
  const value = getProp(entity, keys);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sourceId(entity) {
  return String(getProp(entity, ["wodID", "wodId", "wodid", "id", "ID"]) || "");
}

function sourceType(entity) {
  return String(getProp(entity, ["type", "Type"]) || "");
}

function localizedName(entity, lang) {
  const type = sourceType(entity);
  return lang?.[`${type}_name`.toLowerCase()]
    || String(getProp(entity, ["comment2", "comment1", "type", "name"]) || `#${sourceId(entity)}`);
}

function unitStrengthGroup(entity) {
  if (numberValue(entity, ["meadSupply"]) > 0) return "mead";

  const ingameFamily = normalizeName(getProp(entity, ["comment1"]));
  if (ingameFamily === "demons" || ingameFamily === "elitedemons") return "horror";

  return "";
}

function parseEffects(entity) {
  return String(getProp(entity, ["effects"]) || "")
    .split(",")
    .map((entry) => {
      const [effectId, rawValue] = entry.split("&");
      const type = EFFECT_TYPES[Number(effectId)];
      const value = Number(rawValue);
      return type && Number.isFinite(value) ? { type, value } : null;
    })
    .filter(Boolean);
}

function resolveImage(entity, imageContext) {
  return resolveUnitImageUrl({
    unit: entity,
    unitImageUrlMap: imageContext.unitImageUrlMap,
    unitImageEntries: imageContext.unitImageEntries,
    gameSource: imageContext.gameSource,
    normalizeNameFn: normalizeName
  }) || imageUrl();
}

function completeDerivedLevel(family) {
  const levels = family.map((candidate) => numberValue(candidate, ["level", "Level"], -1));
  const level10 = family.find((candidate) =>
    numberValue(candidate, ["level", "Level"], -1) === 10
  );
  const level9 = family.find((candidate) =>
    numberValue(candidate, ["level", "Level"], -1) === 9
  );
  const isMeadAttacker = level10
    && level9
    && numberValue(level10, ["meadSupply"]) > 0
    && (
      numberValue(level10, ["rangeAttack", "rangedAttack"]) > 0
      || numberValue(level10, ["meleeAttack"]) > 0
    );

  if (!isMeadAttacker || levels.includes(11)) return family;

  const derived = {
    ...level10,
    wodID: `derived-${sourceType(level10)}-11`,
    level: "11"
  };

  ["rangeAttack", "rangedAttack", "meleeAttack", "lootValue"].forEach((property) => {
    const current = numberValue(level10, [property], NaN);
    const previous = numberValue(level9, [property], NaN);
    if (Number.isFinite(current) && Number.isFinite(previous) && (current || previous)) {
      derived[property] = String(current + (current - previous));
    }
  });

  return [...family, derived];
}

function pickLevel(entity, unitsByType) {
  const levelKey = normalizeName(sourceType(entity));
  const family = completeDerivedLevel((unitsByType.get(levelKey) || [])
    .filter((candidate) => getProp(candidate, ["level", "Level"]) !== null)
    .sort((a, b) =>
      numberValue(a, ["level", "Level"], -1) - numberValue(b, ["level", "Level"], -1)
    ));
  const baseLevel = numberValue(entity, ["level", "Level"], 0);
  const selectedLevel = variables.unitLevels[levelKey] ?? baseLevel;
  const selected = family.find((candidate) =>
    numberValue(candidate, ["level", "Level"], -1) === Number(selectedLevel)
  ) || entity;

  return {
    entity: selected,
    levelKey,
    availableLevels: [...new Set(
      family.map((candidate) => numberValue(candidate, ["level", "Level"], -1))
    )].filter((level) => level >= 0)
  };
}

function toUnit(selection, index, kind, imageContext, lang) {
  const { entity, levelKey, availableLevels } = selection;
  const rangedAttack = numberValue(entity, ["rangeAttack", "rangedAttack"]);
  const meleeAttack = numberValue(entity, ["meleeAttack"]);
  const rangedDefense = numberValue(entity, ["rangeDefence", "rangeDefense"]);
  const meleeDefense = numberValue(entity, ["meleeDefence", "meleeDefense"]);

  return {
    id: `unit${index + 1}`,
    wodID: sourceId(entity),
    sourceType: sourceType(entity),
    levelKey,
    level: numberValue(entity, ["level", "Level"], 0),
    availableLevels,
    strengthGroup: unitStrengthGroup(entity),
    name: localizedName(entity, lang),
    type1: kind,
    type2: rangedAttack > meleeAttack ? "ranged" : "melee",
    meleeCombatStrength: meleeAttack,
    rangedCombatStrength: rangedAttack,
    meleeDefenseStrength: meleeDefense,
    rangedDefenseStrength: rangedDefense,
    LootingCapacity: numberValue(entity, ["lootValue"]),
    travelSpeed: numberValue(entity, ["speed"]),
    image: resolveImage(entity, imageContext)
  };
}

function directToolEffects(entity, kind) {
  const candidates = kind === "attack"
    ? [
        ["wall", ["wallBonus"], -1],
        ["gate", ["gateBonus"], -1],
        ["moat", ["moatBonus"], -1],
        ["shield", ["defRangeBonus"], -1],
        ["rangedStrength", ["offRangeBonus"], 1],
        ["meleeStrength", ["offMeleeBonus"], 1],
        ["glory", ["fameBonus"], 1]
      ]
    : [
        ["wall", ["wallBonus"], 1],
        ["gate", ["gateBonus"], 1],
        ["moat", ["moatBonus"], 1],
        ["rangedStrength", ["defRangeBonus"], 1],
        ["meleeStrength", ["defMeleeBonus"], 1]
      ];

  return candidates
    .map(([type, keys, sign]) => {
      const value = numberValue(entity, keys);
      return value ? { type, value: value * sign } : null;
    })
    .filter(Boolean);
}

function effectIcon(type, defense = false) {
  const icons = {
    wall: "wall-icon.png",
    gate: "gate-icon.png",
    moat: "moat-icon.png",
    shield: "shield-icon.png",
    rangedStrength: defense ? "castellan-modal2.png" : "ranged-icon.png",
    meleeStrength: defense ? "castellan-modal1.png" : "melee-icon.png",
    glory: "glory-icon.png",
    additionalWave: "additionalWave-icon.png",
    combatStrength: defense ? "combatStrengthDefense-icon.png" : "combatStrength-icon.png",
    yardStrength: "cy-icon.png",
    courtyard: "attack-modal4.png",
    wallLimit: "castellan-modal3.png",
    killMeleeTroopsYard: defense
      ? "killMeleeTroopsYardDefense-icon.png"
      : "killMeleeTroopsYard-icon.png",
    killRangedTroopsYard: defense
      ? "killRangedTroopsYardDefense-icon.png"
      : "killRangedTroopsYard-icon.png",
    killAnyTroopsYard: "killAnyTroopsYard-icon.png",
    killAnyDefenseTroopsYard: "killAnyTroopsYardDefense-icon.png"
  };
  return icons[type] || "unknown.png";
}

function toTool(entity, index, kind, imageContext, lang) {
  const isDefense = kind === "defense";
  const effects = kind === "support"
    ? parseEffects(entity)
    : [
        ...directToolEffects(entity, kind),
        ...parseEffects(entity)
      ];
  const [effect1 = {}, effect2 = {}] = effects;

  return {
    id: `tool${index + 1}`,
    wodID: sourceId(entity),
    name: localizedName(entity, lang),
    type: isDefense ? "defender" : "attacker",
    effect1Type: effect1.type || "",
    effect1Value: effect1.value || 0,
    effect2Type: effect2.type || "",
    effect2Value: effect2.value || 0,
    toolLimit: numberValue(entity, ["amountPerWave"]),
    travelSpeed: numberValue(entity, ["speed"]),
    slotTypes: String(getProp(entity, ["slotTypes", "slottypes"]) || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    image: resolveImage(entity, imageContext),
    effectImage1: effect1.type ? effectIcon(effect1.type, isDefense) : "",
    effectImage2: effect2.type ? effectIcon(effect2.type, isDefense) : ""
  };
}

function loadCatalog() {
  if (catalogPromise) return catalogPromise;

  catalogPromise = new Promise((resolve, reject) => {
    coreInit({
      langCode: "en",
      itemLabel: "battle simulator",
      normalizeNameFn: normalizeName,
      assets: { units: true },
      onReady: ({ lang, data, imageMaps, versions }) => {
        const allUnits = Array.isArray(data?.units) ? data.units : [];
        const unitsById = {};
        const unitsByType = new Map();

        allUnits.forEach((unit) => {
          unitsById[sourceId(unit)] = unit;
          const crossplayId = String(
            getProp(unit, ["crossplayID", "crossplayId", "crossplayid"]) || ""
          );
          if (crossplayId) unitsById[crossplayId] = unit;

          const key = normalizeName(sourceType(unit));
          if (!unitsByType.has(key)) unitsByType.set(key, []);
          unitsByType.get(key).push(unit);
        });

        const unitImageUrlMap = imageMaps?.units || {};
        resolve({
          lang,
          unitsById,
          unitsByType,
          imageContext: {
            unitImageUrlMap,
            unitImageEntries: Object.entries(unitImageUrlMap),
            gameSource: versions?.gameSource || "empire"
          }
        });
      }
    }).catch(reject);
  });

  return catalogPromise;
}

function requireEntities(ids, unitsById, label) {
  return ids.map((id) => {
    const entity = unitsById[String(id)];
    if (!entity) throw new Error(`${label} WOD ID ${id} was not found in the current items file.`);
    return entity;
  });
}

function replaceArray(target, values) {
  target.length = 0;
  target.push(...values);
}

function rebuildRuntimeLookups() {
  Object.keys(variables.unitImages).forEach((key) => delete variables.unitImages[key]);
  Object.keys(variables.unitImagesDefense).forEach((key) => delete variables.unitImagesDefense[key]);
  Object.keys(variables.toolImages).forEach((key) => delete variables.toolImages[key]);
  Object.keys(variables.toolImagesDefense).forEach((key) => delete variables.toolImagesDefense[key]);
  Object.keys(variables.supportToolImages).forEach((key) => delete variables.supportToolImages[key]);
  Object.keys(variables.toolEffects).forEach((key) => delete variables.toolEffects[key]);
  Object.keys(variables.toolEffectsDefense).forEach((key) => delete variables.toolEffectsDefense[key]);
  Object.keys(variables.supportToolEffects).forEach((key) => delete variables.supportToolEffects[key]);
  Object.values(variables.toolSlotRestrictions).forEach((ids) => ids.splice(0));

  variables.unitStats.length = 0;

  variables.units.forEach((unit, index) => {
    const key = `Unit${index + 1}`;
    variables.unitImages[key] = unit.image;
    variables.unitStats.push({
      type: key,
      rangedCombatStrength: unit.rangedCombatStrength,
      meleeCombatStrength: unit.meleeCombatStrength,
      strengthGroup: unit.strengthGroup,
      image: unit.image
    });
  });

  variables.defense_units.forEach((unit, index) => {
    const key = `DefenseUnit${index + 1}`;
    variables.unitImagesDefense[key] = unit.image;
    variables.unitStats.push({
      type: key,
      meleeDefenseStrength: unit.meleeDefenseStrength,
      rangedDefenseStrength: unit.rangedDefenseStrength,
      image: unit.image
    });
  });

  variables.tools.forEach((tool, index) => {
    const key = `Tool${index + 1}`;
    variables.toolImages[key] = tool.image;
    variables.toolEffects[key] = toolEffectRecord(tool);
  });

  variables.defense_tools.forEach((tool, index) => {
    const id = `tool${index + 1}`;
    variables.toolImagesDefense[`DefenseTooltool${index + 1}`] = tool.image;
    variables.toolEffectsDefense[id] = toolEffectRecord(tool);
    if (tool.slotTypes.includes("1")) variables.toolSlotRestrictions.wall.push(id);
    if (tool.slotTypes.includes("2")) variables.toolSlotRestrictions.gate.push(id);
    if (tool.slotTypes.includes("4")) variables.toolSlotRestrictions.moat.push(id);
    if (tool.slotTypes.includes("6")) variables.toolSlotRestrictions.cy.push(id);
  });

  variables.supportTools.forEach((tool, index) => {
    const key = `Tool${index + 1}`;
    variables.supportToolImages[key] = tool.image;
    variables.supportToolEffects[key] = toolEffectRecord(tool);
  });
}

function toolEffectRecord(tool) {
  const legacyEffectName = (name) =>
    name ? `${name.charAt(0).toUpperCase()}${name.slice(1)}` : "";

  return {
    effect1: {
      value: tool.effect1Value,
      icon: tool.effectImage1,
      name: legacyEffectName(tool.effect1Type)
    },
    effect2: {
      value: tool.effect2Value,
      icon: tool.effectImage2,
      name: legacyEffectName(tool.effect2Type)
    },
    image: tool.image
  };
}

export async function loadData() {
  try {
    const { lang, unitsById, unitsByType, imageContext } = await loadCatalog();

    const attackUnits = requireEntities(ATTACK_UNIT_IDS, unitsById, "Attack unit")
      .map((unit) => pickLevel(unit, unitsByType))
      .map((unit, index) => toUnit(unit, index, "attacker", imageContext, lang));
    const defenseUnits = requireEntities(DEFENSE_UNIT_IDS, unitsById, "Defense unit")
      .map((unit) => pickLevel(unit, unitsByType))
      .map((unit, index) => toUnit(unit, index, "defender", imageContext, lang));
    const attackTools = requireEntities(ATTACK_TOOL_IDS, unitsById, "Attack tool")
      .map((tool, index) => toTool(tool, index, "attack", imageContext, lang));
    const supportTools = requireEntities(SUPPORT_TOOL_IDS, unitsById, "Support tool")
      .map((tool, index) => toTool(tool, index, "support", imageContext, lang));
    const defenseTools = requireEntities(DEFENSE_TOOL_IDS, unitsById, "Defense tool")
      .map((tool, index) => toTool(tool, index, "defense", imageContext, lang));

    replaceArray(variables.units, attackUnits);
    replaceArray(variables.defense_units, defenseUnits);
    replaceArray(variables.tools, attackTools);
    replaceArray(variables.supportTools, supportTools);
    replaceArray(variables.defense_tools, defenseTools);
    rebuildRuntimeLookups();

    generateAllModals();
    initializeUnits();
    initializeTools();
    initializeSupportTools();
    loadPresets();
    loadDefenseState();
    loadAttackState();
  } catch (error) {
    console.error("Error loading in-game battle simulator data:", error);
    throw error;
  }
}
