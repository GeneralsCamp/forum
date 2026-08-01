import * as variables from "./variables.js";
import { getBattleCatalog } from "./battleCatalogState.js";
import { imageUrl } from "./imagePaths.js";
import { coreInit } from "../../../../overviews/shared/CoreInit.mjs";
import {
  getProp,
  normalizeName
} from "../../../../overviews/shared/RewardResolver.mjs";
import { resolveUnitImageUrl } from "../../../../overviews/shared/UnitImageService.mjs";
import {
  composeAssetToDataUrl,
  deriveCompanionUrls
} from "../../../../overviews/shared/AssetComposer.mjs";
import { initializeUnits } from "../ui/uiUnits.js";
import { initializeTools } from "../ui/uiTools.js";
import { initializeSupportTools } from "../ui/uiSupport.js";
import { generateAllModals } from "../ui/modals/modalGenerator.js";
import { loadPresets } from "../ui/wavePresets.js";
import { loadDefenseState } from "./defenseState.js";
import { loadAttackState } from "./attackState.js";
import { writeStoredJson } from "./storage.js";
import { initializeGeneralAbilityCatalog } from "./generalAbilityCatalog.js";

const EFFECT_TYPES = {
  29: "additionalWave",
  48: "combatStrength",
  504: "yardStrength",
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
const composedUnitImageCache = new Map();

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

async function composeUnitImage(image) {
  const source = String(image || "");
  const isComposable = source.startsWith("https://empire-html5.goodgamestudios.com/default/assets/itemassets/")
    && /\.(webp|png)$/i.test(source);
  if (!isComposable) return image;
  if (!composedUnitImageCache.has(source)) {
    const companions = deriveCompanionUrls(source);
    composedUnitImageCache.set(source, composeAssetToDataUrl({
      ...companions,
      maxWidth: 96,
      maxHeight: 96,
      padding: 4
    }).catch(() => source));
  }
  return composedUnitImageCache.get(source);
}

async function composeUnitRecord(unit) {
  unit.image = await composeUnitImage(unit.image);
  return unit;
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

function pickLevel(entity, unitsByType, requestedLevel = null) {
  const levelKey = normalizeName(sourceType(entity));
  const family = completeDerivedLevel((unitsByType.get(levelKey) || [])
    .filter((candidate) => getProp(candidate, ["level", "Level"]) !== null)
    .sort((a, b) =>
      numberValue(a, ["level", "Level"], -1) - numberValue(b, ["level", "Level"], -1)
    ));
  const baseLevel = numberValue(entity, ["level", "Level"], 0);
  const selectedLevel = requestedLevel ?? variables.unitLevels[levelKey] ?? baseLevel;
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

function pickToolLevel(entity, unitsByType, requestedLevel = null) {
  const levelKey = normalizeName(sourceType(entity));
  const family = (unitsByType.get(levelKey) || [])
    .filter((candidate) => getProp(candidate, ["level", "Level"]) !== null)
    .sort((a, b) =>
      numberValue(a, ["level", "Level"], -1) - numberValue(b, ["level", "Level"], -1)
    );
  const baseLevel = numberValue(entity, ["level", "Level"], 0);
  const selectedLevel = requestedLevel ?? baseLevel;
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

function toUnit(selection, index, kind, imageContext, lang, catalogEntry = {}) {
  const { entity, levelKey, availableLevels } = selection;
  const rangedAttack = numberValue(entity, ["rangeAttack", "rangedAttack"]);
  const meleeAttack = numberValue(entity, ["meleeAttack"]);
  const rangedDefense = numberValue(entity, ["rangeDefence", "rangeDefense"]);
  const meleeDefense = numberValue(entity, ["meleeDefence", "meleeDefense"]);
  const itemRole = normalizeName(getProp(entity, ["role"]) || "");
  const unitType = itemRole === "ranged" || itemRole === "melee"
    ? itemRole
    : rangedAttack > meleeAttack ? "ranged" : "melee";

  return {
    id: `unit${index + 1}`,
    wodID: sourceId(entity),
    catalogWodID: String(catalogEntry.wodID || sourceId(entity)),
    catalogIndex: index,
    sourceType: sourceType(entity),
    levelKey,
    level: numberValue(entity, ["level", "Level"], 0),
    availableLevels,
    strengthGroup: unitStrengthGroup(entity),
    name: localizedName(entity, lang),
    type1: kind,
    type2: unitType,
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

function toTool(selection, index, kind, imageContext, lang, catalogEntry = {}) {
  const entity = selection?.entity || selection;
  const levelKey = selection?.levelKey || normalizeName(sourceType(entity));
  const availableLevels = selection?.availableLevels || [];
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
    catalogWodID: String(catalogEntry.wodID || sourceId(entity)),
    levelKey,
    level: numberValue(entity, ["level", "Level"], 0),
    availableLevels,
    name: localizedName(entity, lang),
    type: isDefense ? "defender" : "attacker",
    effect1Type: effect1.type || "",
    effect1Value: effect1.value || 0,
    effect2Type: effect2.type || "",
    effect2Value: effect2.value || 0,
    toolLimit: numberValue(entity, ["amountPerWave"]),
    travelSpeed: numberValue(entity, ["speed"]),
    deleteToolAfterBattle: numberValue(entity, ["deleteToolAfterBattle"]),
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
      assets: { units: true, generals: true },
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
          data,
          unitsById,
          unitsByType,
          generalImageMaps: imageMaps?.generals || {},
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

function resolveUnitEntries(entries, unitsById, unitsByType, label) {
  return (entries || []).map((entry) => {
    const entity = unitsById[String(entry.wodID)];
    if (!entity) throw new Error(`${label} WOD ID ${entry.wodID} was not found in the current items file.`);
    return { selection: pickLevel(entity, unitsByType, entry.level), entry };
  });
}

function resolveToolEntries(entries, unitsById, unitsByType, label) {
  return (entries || []).map((entry) => {
    const entity = unitsById[String(entry.wodID)];
    if (!entity) throw new Error(`${label} WOD ID ${entry.wodID} was not found in the current items file.`);
    return { selection: pickToolLevel(entity, unitsByType, entry.level), entry };
  });
}

function isSupportTool(entity) {
  return String(getProp(entity, ["slotTypes", "slottypes"]) || "")
    .split(",")
    .map(value => value.trim())
    .includes("10");
}

function replaceArray(target, values) {
  target.length = 0;
  target.push(...values);
}

function catalogIdentity(item, unit = false) {
  return unit ? `${item.sourceType}|${item.level}` : String(item.wodID);
}

function remapCurrentSelections(previous) {
  const maps = {
    attackUnitsOld: new Map(previous.units.map((item, index) => [`Unit${index + 1}`, catalogIdentity(item, true)])),
    attackUnitsNew: new Map(variables.units.map((item, index) => [catalogIdentity(item, true), `Unit${index + 1}`])),
    defenseUnitsOld: new Map(previous.defenseUnits.map((item, index) => [`DefenseUnit${index + 1}`, catalogIdentity(item, true)])),
    defenseUnitsNew: new Map(variables.defense_units.map((item, index) => [catalogIdentity(item, true), `DefenseUnit${index + 1}`])),
    attackToolsOld: new Map(previous.tools.map((item, index) => [`Tool${index + 1}`, catalogIdentity(item)])),
    attackToolsNew: new Map(variables.tools.map((item, index) => [catalogIdentity(item), `Tool${index + 1}`])),
    supportToolsOld: new Map(previous.supportTools.map((item, index) => [`Tool${index + 1}`, catalogIdentity(item)])),
    supportToolsNew: new Map(variables.supportTools.map((item, index) => [catalogIdentity(item), `Tool${index + 1}`])),
    defenseToolsOld: new Map(previous.defenseTools.map(item => [`DefenseTool${item.id}`, catalogIdentity(item)])),
    defenseToolsNew: new Map(variables.defense_tools.map(item => [catalogIdentity(item), `DefenseTool${item.id}`]))
  };
  const seen = new WeakSet();
  const remap = (slots, oldMap, newMap) => (slots || []).forEach(slot => {
    if (!slot || typeof slot !== 'object' || seen.has(slot)) return;
    seen.add(slot);
    if (!slot.type) return;
    const identity = oldMap.get(slot.type);
    if (!identity) return;
    const nextType = newMap.get(identity);
    slot.type = nextType || '';
    if (!nextType) slot.count = 0;
  });
  ['left', 'front', 'right', 'CY'].forEach(side => {
    (variables.waves[side] || []).forEach(wave => remap(wave.slots, maps.attackUnitsOld, maps.attackUnitsNew));
    (variables.totalUnits[side] || []).forEach(slots => remap(slots, maps.attackUnitsOld, maps.attackUnitsNew));
  });
  ['left', 'front', 'right'].forEach(side => {
    (variables.waves[side] || []).forEach(wave => remap(wave.tools, maps.attackToolsOld, maps.attackToolsNew));
    (variables.totalTools[side] || []).forEach(slots => remap(slots, maps.attackToolsOld, maps.attackToolsNew));
  });
  (variables.waves.Support || []).forEach(wave => remap(wave.tools, maps.supportToolsOld, maps.supportToolsNew));
  (variables.totalTools.Support || []).forEach(slots => remap(slots, maps.supportToolsOld, maps.supportToolsNew));
  Object.values(variables.defenseSlots).forEach(side => {
    remap(side.units, maps.defenseUnitsOld, maps.defenseUnitsNew);
    ['wallTools', 'gateTools', 'moatTools', 'cyTools'].forEach(key =>
      remap(side[key], maps.defenseToolsOld, maps.defenseToolsNew)
    );
  });
  Object.values(variables.presets).forEach(preset => {
    if (!preset) return;
    ['left', 'front', 'right'].forEach(side => {
      remap(preset.units?.[side], maps.attackUnitsOld, maps.attackUnitsNew);
      remap(preset.tools?.[side], maps.attackToolsOld, maps.attackToolsNew);
    });
  });
  writeStoredJson('variables.presets', variables.presets);
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

export async function loadData({ preserveCurrentState = false } = {}) {
  try {
    const previousCatalog = {
      units: [...variables.units],
      defenseUnits: [...variables.defense_units],
      tools: [...variables.tools],
      supportTools: [...variables.supportTools],
      defenseTools: [...variables.defense_tools]
    };
    const { lang, data, unitsById, unitsByType, imageContext, generalImageMaps } = await loadCatalog();
    const selectedCatalog = getBattleCatalog();

    const attackUnits = await Promise.all(resolveUnitEntries(selectedCatalog.attackUnits, unitsById, unitsByType, "Attack unit")
      .map(({ selection, entry }, index) => composeUnitRecord(
        toUnit(selection, index, "attacker", imageContext, lang, entry)
      )));
    const defenseUnits = await Promise.all(resolveUnitEntries(selectedCatalog.defenseUnits, unitsById, unitsByType, "Defense unit")
      .map(({ selection, entry }, index) => composeUnitRecord(
        toUnit(selection, index, "defender", imageContext, lang, entry)
      )));
    const selectedAttackTools = resolveToolEntries(selectedCatalog.attackTools, unitsById, unitsByType, "Attack tool");
    const attackTools = selectedAttackTools
      .filter(({ selection }) => !isSupportTool(selection.entity))
      .map(({ selection, entry }, index) => toTool(selection, index, "attack", imageContext, lang, entry));
    const supportTools = selectedAttackTools
      .filter(({ selection }) => isSupportTool(selection.entity))
      .map(({ selection, entry }, index) => toTool(selection, index, "support", imageContext, lang, entry));
    const defenseTools = resolveToolEntries(selectedCatalog.defenseTools, unitsById, unitsByType, "Defense tool")
      .map(({ selection, entry }, index) => toTool(selection, index, "defense", imageContext, lang, entry));

    replaceArray(variables.units, attackUnits);
    replaceArray(variables.defense_units, defenseUnits);
    replaceArray(variables.tools, attackTools);
    replaceArray(variables.supportTools, supportTools);
    replaceArray(variables.defense_tools, defenseTools);
    if (preserveCurrentState) remapCurrentSelections(previousCatalog);
    rebuildRuntimeLookups();
    initializeGeneralAbilityCatalog({ data, lang, imageMaps: generalImageMaps });

    generateAllModals();
    initializeUnits();
    initializeTools();
    initializeSupportTools();
    loadPresets();
    if (!preserveCurrentState) {
      loadDefenseState();
      loadAttackState();
    }
  } catch (error) {
    console.error("Error loading in-game battle simulator data:", error);
    throw error;
  }
}

export async function resolveCatalogPreview(groupKind, wodID, requestedLevel = null) {
  const { lang, unitsById, unitsByType, imageContext } = await loadCatalog();
  const entity = unitsById[String(wodID)];
  if (!entity) throw new Error(`WOD ID ${wodID} was not found in the current items file.`);
  const unitKind = groupKind === 'attackUnit' || groupKind === 'defenseUnit';
  const hasSoldierRole = Boolean(String(getProp(entity, ['role']) || '').trim());
  if (unitKind && !hasSoldierRole) throw new Error(`WOD ID ${wodID} is a tool, not a soldier.`);
  if (!unitKind && hasSoldierRole) throw new Error(`WOD ID ${wodID} is a soldier, not a tool.`);
  if (unitKind) {
    const selection = pickLevel(entity, unitsByType, requestedLevel);
    return composeUnitRecord(
      toUnit(selection, 0, groupKind === 'attackUnit' ? 'attacker' : 'defender', imageContext, lang, { wodID })
    );
  }
  const toolKind = groupKind === 'attackTool'
    ? (isSupportTool(entity) ? 'support' : 'attack')
    : groupKind === 'supportTool' ? 'support' : 'defense';
  const selection = pickToolLevel(entity, unitsByType, requestedLevel);
  return toTool(selection, 0, toolKind, imageContext, lang, { wodID });
}

export async function resolveCatalogItem(wodID, requestedLevel = null) {
  const { unitsById } = await loadCatalog();
  const entity = unitsById[String(wodID)];
  if (!entity) throw new Error(`WOD ID ${wodID} was not found in the current items file.`);

  const hasSoldierRole = Boolean(String(getProp(entity, ["role"]) || "").trim());
  let groupKey;
  let groupKind;

  if (hasSoldierRole) {
    const attackStrength = Math.max(
      numberValue(entity, ["rangeAttack", "rangedAttack"]),
      numberValue(entity, ["meleeAttack"])
    );
    const defenseStrength = Math.max(
      numberValue(entity, ["rangeDefence", "rangeDefense"]),
      numberValue(entity, ["meleeDefence", "meleeDefense"])
    );
    const isDefense = defenseStrength > attackStrength;
    groupKey = isDefense ? "defenseUnits" : "attackUnits";
    groupKind = isDefense ? "defenseUnit" : "attackUnit";
  } else {
    const toolType = normalizeName(getProp(entity, ["typ"]) || "");
    const isDefense = toolType === "defence" || toolType === "defense";
    groupKey = isDefense ? "defenseTools" : "attackTools";
    groupKind = isDefense ? "defenseTool" : "attackTool";
  }

  return {
    groupKey,
    preview: await resolveCatalogPreview(groupKind, wodID, requestedLevel)
  };
}
