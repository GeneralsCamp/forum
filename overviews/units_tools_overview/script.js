import { initAutoHeight } from "../shared/ResizeService.mjs";
import { createLoader } from "../shared/LoadingService.mjs";
import { coreInit } from "../shared/CoreInit.mjs";
import { initLanguageSelector, getInitialLanguage } from "../shared/LanguageService.mjs";
import { deriveCompanionUrls } from "../shared/AssetComposer.mjs";
import { hydrateComposedImages } from "../shared/ComposeHydrator.mjs";

const loader = createLoader();
let currentLanguage = getInitialLanguage();

let lang = {};
let ownLang = {};
let UI_LABELS = {};
let allUnits = [];
let unitImageUrlMap = {};
let unitImageEntries = [];
let collectableCurrencyImageUrlMap = {};
const composedUnitImageCache = new Map();
let effectCtx = { effectDefinitions: {}, percentEffectIDs: new Set() };
const FORCE_PLUS_PERCENT_EFFECT_NAMES = new Set([
  "bonuswallcapacity",
  "bonusdefencepower",
  "bonusyarddefensepower",
  "difficultyscalingdefenseboostyard"
]);

const STAT_ICONS = {
  supplyFood: "../../img_base/foodwastage.png",
  supplyMead: "../../img_base/meadwastage.png",
  supplyBeef: "../../img_base/beefwastage.png",
  rangedAttack: "../../simulators/battle_simulator/img/ranged-icon.png",
  meleeAttack: "../../simulators/battle_simulator/img/melee-icon.png",
  meleeDefence: "../../simulators/battle_simulator/img/castellan-modal1.png",
  rangeDefence: "../../simulators/battle_simulator/img/castellan-modal2.png",
  might: "../../img_base/might.png",
  lootValue: "../../simulators/battle_simulator/img/loot-icon.png",
  speed: "../../simulators/battle_simulator/img/travelSpeed-icon.png",
  recruitmentTime: "../../img_base/time.png",
  costC1: "../../img_base/coin.png",
  offRangeBonus: "../../simulators/battle_simulator/img/ranged-icon.png",
  offMeleeBonus: "../../simulators/battle_simulator/img/melee-icon.png",
  wallBonus: "../../simulators/battle_simulator/img/wall-icon.png",
  gateBonus: "../../simulators/battle_simulator/img/gate-icon.png",
  moatBonus: "../../simulators/battle_simulator/img/moat-icon.png",
  defRangeBonus: "../../simulators/battle_simulator/img/castellan-modal2.png",
  defMeleeBonus: "../../simulators/battle_simulator/img/castellan-modal1.png",
  amountPerWave: "../../simulators/battle_simulator/img/additionalWave-icon.png",
  unitLimit: "../../simulators/battle_simulator/img/unitLimit-icon.png",
  fameBonus: "../../simulators/battle_simulator/img/glory-icon.png",
  killMeleeTroopsYard: "../../simulators/battle_simulator/img/killMeleeTroopsYard-icon.png",
  killRangedTroopsYard: "../../simulators/battle_simulator/img/killRangedTroopsYard-icon.png",
  killAnyTroopsYard: "../../simulators/battle_simulator/img/killAnyTroopsYard-icon.png",
  killMeleeTroopsYardDefense: "../../simulators/battle_simulator/img/killMeleeTroopsYardDefense-icon.png",
  killRangedTroopsYardDefense: "../../simulators/battle_simulator/img/killRangedTroopsYardDefense-icon.png",
  killAnyTroopsYardDefense: "../../simulators/battle_simulator/img/killAnyTroopsYardDefense-icon.png",
  woodCost: "../../img_base/wood.png",
  stoneCost: "../../img_base/stone.png",
  gallantryBonus: "../../img_base/gallantryBoost.png",
  rageBonus: "../../img_base/rageBoost.png",
  xpBonus: "../../img_base/xpBoost.png",
  unknown: "../../img_base/placeholder.webp"
};
const EFFECT_ICON_RULES = [
  { pattern: /additionalwaves|amountperwave|attackunitamount|attack\s*waves|tool\s*limit|wave/i, icon: STAT_ICONS.amountPerWave },
  { pattern: /increase the wall capacity for defenders|wall capacity/i, icon: "../../simulators/battle_simulator/img/castellan-modal3.png" },
  { pattern: /bonuswallcapacity|wall/i, icon: STAT_ICONS.wallBonus },
  { pattern: /gate/i, icon: STAT_ICONS.gateBonus },
  { pattern: /moat/i, icon: STAT_ICONS.moatBonus },
  { pattern: /killdefendingmeleetroopsyard/i, icon: STAT_ICONS.killMeleeTroopsYard },
  { pattern: /killdefendingrangedtroopsyard/i, icon: STAT_ICONS.killRangedTroopsYard },
  { pattern: /killdefendinganytroopsyard/i, icon: STAT_ICONS.killAnyTroopsYard },
  { pattern: /killattackingmeleetroopsyard/i, icon: STAT_ICONS.killMeleeTroopsYardDefense },
  { pattern: /killattackingrangedtroopsyard/i, icon: STAT_ICONS.killRangedTroopsYardDefense },
  { pattern: /killattackinganytroopsyard/i, icon: STAT_ICONS.killAnyTroopsYardDefense },
  { pattern: /difficultyscalingdefenseboostyard|bonusyarddefensepower|attackboostyard|courtyard|yard/i, icon: "../../simulators/battle_simulator/img/cy-icon.png" },
  { pattern: /fame|glory/i, icon: STAT_ICONS.fameBonus },
  { pattern: /loot/i, icon: STAT_ICONS.lootValue },
  { pattern: /speed|time|recruit|production/i, icon: STAT_ICONS.recruitmentTime },
  { pattern: /ranged|range/i, icon: STAT_ICONS.rangedAttack },
  { pattern: /melee/i, icon: STAT_ICONS.meleeAttack },
  { pattern: /defense|defence/i, icon: STAT_ICONS.rangeDefence },
  { pattern: /attack/i, icon: STAT_ICONS.rangedAttack }
];

function statCell(iconUrl, title, value) {
  return `<div class="unit-row card-cell"><span class="unit-label" title="${title}"><img src="${iconUrl}" alt="${title}" class="stat-icon"></span><span class="unit-value">${value}</span></div>`;
}

async function loadOwnLang() {
  try {
    const res = await fetch("./ownLang.json");
    ownLang = await res.json();
  } catch {
    ownLang = {};
  }
}

function getOwnLangValue(key, fallback) {
  const langCode = String(currentLanguage || "en").toLowerCase();
  const shortCode = langCode.split(/[-_]/)[0];
  return ownLang?.[langCode]?.[key] || ownLang?.[shortCode]?.[key] || ownLang?.en?.[key] || fallback;
}

function applyUiLabels() {
  UI_LABELS = {
    rangedAttack: lang["attackpower_range"] || "Ranged attack power",
    meleeAttack: lang["attackpower_melee"] || "Melee attack power",
    rangedDefence: lang["defensepower_range"] || "Ranged defense power",
    meleeDefence: lang["defensepower_melee"] || "Melee defense power",
    speed: getOwnLangValue("travel_speed", "Travel speed"),
    loot: lang["lootplace"] || lang["dialog_battlelog_loot"] || "Loot",
    might: lang["playermight"] || "Might points",
    recruitmentTime: lang["recruitspeed"] || "Recruitment speed",
    productionSpeed: lang["productionspeed"] || "Production speed",
    productionCost: getOwnLangValue("production_cost", lang["productioncost"] || "Production cost"),
    recruitmentCost: getOwnLangValue("recruitment_cost", "Recruitment cost"),
    rangedAttackBonus: lang["offrangebonus"] || getOwnLangValue("ranged_attack_bonus", "Ranged attack bonus"),
    meleeAttackBonus: lang["attackpower_melee"] || lang["offmeleebonus"] || getOwnLangValue("melee_attack_bonus", "Melee attack bonus"),
    rangedDefenseBonus: lang["defrangebonus"] || getOwnLangValue("ranged_defense_bonus", "Ranged defense bonus"),
    meleeDefenseBonus: lang["defmeleebonus"] || getOwnLangValue("melee_defense_bonus", "Melee defense bonus"),
    wallBonus: lang["wallprotection"] || getOwnLangValue("wall_bonus", "Wall bonus"),
    gateBonus: lang["gateprotection"] || getOwnLangValue("gate_bonus", "Gate bonus"),
    moatBonus: lang["moatprotection"] || getOwnLangValue("moat_bonus", "Moat bonus"),
    fameBonus: lang["dialog_fame_fame"] || getOwnLangValue("fame_bonus", "Fame bonus"),
    khanTabletBooster: lang["nomadebooster_name"] || getOwnLangValue("khan_tablet_booster", "Khan tablet booster"),
    khanMedalBooster: lang["khanmedalbooster_name"] || getOwnLangValue("khan_medal_booster", "Khan medal booster"),
    samuraiTokenBooster: lang["samuraibooster_name"] || getOwnLangValue("samurai_token_booster", "Samurai token booster"),
    pearlBooster: lang["pearlbooster_name"] || getOwnLangValue("pearl_booster", "Pearl bonus"),
    pointBonus: lang["gallantrybooster_name"] || getOwnLangValue("point_bonus", "Point bonus"),
    xpBonus: lang["xpbooster_name"] || getOwnLangValue("xp_bonus", "XP bonus"),
    c1Bonus: lang["currency_name_currency1"] || getOwnLangValue("c1_bonus", "C1 bonus"),
    ragePointBonus: lang["ragebooster_name"] || getOwnLangValue("rage_point_bonus", "Rage point bonus"),
    reputationBonus: lang["reputationbooster_name"] || getOwnLangValue("reputation_bonus", "Reputation bonus"),
    attackWaves: getOwnLangValue("attack_waves_bonus", "Increase the number of available attack waves"),
    toolLimit: lang["amountperwave"] || getOwnLangValue("tool_limit", "Tool limit"),
    sortBy: getOwnLangValue("sort_by", "Sort by"),
    filterTypeUnit: lang["units"] || getOwnLangValue("filter_type_unit", "Unit"),
    filterTypeTool: lang["tools"] || getOwnLangValue("filter_type_tool", "Tool"),
    searchPlaceholder: getOwnLangValue("search_placeholder", "Search by name..."),
    sortDefault: getOwnLangValue("sort_default", "Default"),
    allTools: getOwnLangValue("all_tools", "All tools"),
    defenseTools: lang["defencetools"] || getOwnLangValue("defense_tools", "Defense tools"),
    attackTools: lang["attacktools"] || getOwnLangValue("attack_tools", "Siege tools")
  };
}

function formatStatValue(value) {
  if (value === undefined || value === null) return "-";
  const raw = String(value).trim();
  if (!raw) return "-";

  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    const num = Number(raw);
    if (!Number.isNaN(num)) return num.toLocaleString(currentLanguage);
  }

  return raw;
}

function formatDurationMinSec(secondsValue) {
  const raw = String(secondsValue ?? "").trim();
  if (!raw || raw === "-") return "-";
  const total = Number(raw.replace(/,/g, ""));
  if (Number.isNaN(total)) return raw;
  const secsTotal = Math.max(0, Math.floor(total));
  const hours = Math.floor(secsTotal / 3600);
  const mins = Math.floor((secsTotal % 3600) / 60);
  const secs = secsTotal % 60;
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${pad2(hours)}:${pad2(mins)}:${pad2(secs)}`;
}

function formatPlusPercent(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-") return raw || "-";
  if (raw === "0" || raw === "0.0") return "0";
  if (raw.endsWith("%")) return raw.startsWith("+") || raw.startsWith("-") ? raw : `+${raw}`;
  if (raw.startsWith("+") || raw.startsWith("-")) return `${raw}%`;
  return `+${raw}%`;
}

function getSupplyInfo(unit, getStatFn) {
  const food = getStatFn("foodSupply", null);
  if (food !== null) {
    return {
      label: lang["foodwastage"] || "Food consumption",
      value: food,
      iconUrl: STAT_ICONS.supplyFood
    };
  }

  const mead = getStatFn("meadSupply", null);
  if (mead !== null) {
    return {
      label: lang["meadwastage"] || "Mead consumption",
      value: mead,
      iconUrl: STAT_ICONS.supplyMead
    };
  }

  const beef = getStatFn("beefSupply", null);
  if (beef !== null) {
    return {
      label: lang["beefwastage"] || "Beef consumption",
      value: beef,
      iconUrl: STAT_ICONS.supplyBeef
    };
  }

  return {
    label: lang["foodwastage"] || "Food consumption",
    value: "0",
    iconUrl: STAT_ICONS.supplyFood
  };
}

function getToolBaseBonuses(unit, getStatFn) {
  const toolTypeRaw = String(unit?.typ || unit?.Typ || "").toLowerCase();
  const isAttackTool = toolTypeRaw.includes("attack");
  const isDefenceTool = toolTypeRaw.includes("defence");
  const withSignPercent = (value, signResolver = () => "+") => {
    const v = String(value ?? "").trim();
    if (!v || v === "-" || v === "0") return v || "0";
    if (v.endsWith("%")) return v;
    if (v.startsWith("+") || v.startsWith("-")) return `${v}%`;
    const sign = signResolver();
    return `${sign}${v}%`;
  };

  const hostileOrFriendlySign = () => {
    if (isAttackTool) return "-";
    if (isDefenceTool) return "+";
    return "+";
  };

  return [
    { iconUrl: STAT_ICONS.offRangeBonus, title: UI_LABELS.rangedAttackBonus, value: withSignPercent(getStatFn("offRangeBonus", "0"), () => "+"), hideIfZero: true },
    { iconUrl: STAT_ICONS.offMeleeBonus, title: UI_LABELS.meleeAttackBonus, value: withSignPercent(getStatFn("offMeleeBonus", "0"), () => "+"), hideIfZero: true },
    { iconUrl: STAT_ICONS.defRangeBonus, title: UI_LABELS.rangedDefenseBonus, value: withSignPercent(getStatFn("defRangeBonus", "0"), hostileOrFriendlySign), hideIfZero: true },
    { iconUrl: STAT_ICONS.defMeleeBonus, title: UI_LABELS.meleeDefenseBonus, value: withSignPercent(getStatFn("defMeleeBonus", "0"), hostileOrFriendlySign), hideIfZero: true },
    { iconUrl: STAT_ICONS.wallBonus, title: UI_LABELS.wallBonus, value: withSignPercent(getStatFn("wallBonus", "0"), hostileOrFriendlySign), hideIfZero: true },
    { iconUrl: STAT_ICONS.gateBonus, title: UI_LABELS.gateBonus, value: withSignPercent(getStatFn("gateBonus", "0"), hostileOrFriendlySign), hideIfZero: true },
    { iconUrl: STAT_ICONS.moatBonus, title: UI_LABELS.moatBonus, value: withSignPercent(getStatFn("moatBonus", "0"), hostileOrFriendlySign), hideIfZero: true },
    { iconUrl: STAT_ICONS.fameBonus, title: UI_LABELS.fameBonus, value: withSignPercent(getStatFn("fameBonus", "0"), () => "+"), hideIfZero: true }
  ];
}

function getCostComponentLabel(index) {
  return lang?.[`currency_name_component${index}`] || `Cost component ${index}`;
}

function getCostComponentIcon(index) {
  return collectableCurrencyImageUrlMap?.[`component${index}`] || STAT_ICONS.unknown;
}

function getCurrencyIcon(currencyKey, fallback = STAT_ICONS.unknown) {
  return collectableCurrencyImageUrlMap?.[currencyKey] || fallback;
}

function getRecruitmentCostInfo(unit) {
  const defs = [
    { key: "costC1", labelKey: "currency_name_currency1", iconUrl: STAT_ICONS.costC1 },
    { key: "costDragonGlass", labelKey: "currency_name_dragonglass", currencyKey: "dragonglass" },
    { key: "costdragonGlass", labelKey: "currency_name_dragonglass", currencyKey: "dragonglass" },
    { key: "dragonGlassCost", labelKey: "currency_name_dragonglass", currencyKey: "dragonglass" },
    { key: "costDragonGlassArrows", labelKey: "currency_name_dragonglassarrows", currencyKey: "dragonglassarrows" },
    { key: "costDragonScaleArmor", labelKey: "currency_name_dragonscalearmor", currencyKey: "dragonscalearmor" },
    { key: "costDragonScaleArrows", labelKey: "currency_name_dragonscalearrows", currencyKey: "dragonscalearrows" },
    { key: "costTwinFlameAxes", labelKey: "currency_name_twinflameaxes", currencyKey: "twinflameaxes" }
  ];

  for (const def of defs) {
    const raw = unit?.[def.key];
    if (raw === undefined || raw === null || String(raw).trim() === "" || String(raw).trim() === "0") {
      continue;
    }
    const currencyLabel = lang?.[def.labelKey] || def.key.replace(/^cost/, "");
    return {
      value: formatStatValue(raw),
      title: UI_LABELS.recruitmentCost,
      iconUrl: def.iconUrl || getCurrencyIcon(def.currencyKey, STAT_ICONS.unknown),
      hasCost: true
    };
  }

  return {
    value: "0",
    title: UI_LABELS.recruitmentCost,
    iconUrl: STAT_ICONS.costC1,
    hasCost: false
  };
}

function createStatHelpers(unit) {
  const getStat = (key, fallback = "-") => {
    const v = unit?.[key];
    return (v === undefined || v === null || String(v).trim() === "") ? fallback : formatStatValue(v);
  };

  const getFirstStat = (keys, fallback = "-") => {
    for (const key of keys) {
      const v = unit?.[key];
      if (v !== undefined && v !== null && String(v).trim() !== "") return formatStatValue(v);
    }
    return fallback;
  };

  const getRecruitmentTimeStat = () => formatDurationMinSec(unit?.recruitmentTime);

  return { getStat, getFirstStat, getRecruitmentTimeStat };
}

function buildUnitStatsAll({ getStat, getFirstStat, getRecruitmentTimeStat, supplyInfo, recruitmentCostInfo }) {
  const stats = [
    { iconUrl: STAT_ICONS.rangedAttack, title: UI_LABELS.rangedAttack, value: getFirstStat(["rangeAttack", "rangedAttack", "attackRange", "rangedStrength"], "0") },
    { iconUrl: STAT_ICONS.meleeAttack, title: UI_LABELS.meleeAttack, value: getStat("meleeAttack", "0") },
    { iconUrl: STAT_ICONS.rangeDefence, title: UI_LABELS.rangedDefence, value: getStat("rangeDefence", "0") },
    { iconUrl: STAT_ICONS.meleeDefence, title: UI_LABELS.meleeDefence, value: getStat("meleeDefence", "0") },
    { iconUrl: STAT_ICONS.speed, title: UI_LABELS.speed, value: getStat("speed") },
    { iconUrl: STAT_ICONS.lootValue, title: UI_LABELS.loot, value: getStat("lootValue") },
    { iconUrl: STAT_ICONS.might, title: UI_LABELS.might, value: getStat("mightValue", getStat("might")) },
    { iconUrl: supplyInfo.iconUrl, title: supplyInfo.label, value: supplyInfo.value ?? "-" }
  ];

  const recruitmentTimeValue = getRecruitmentTimeStat();
  const hasRecruitmentTime =
    recruitmentTimeValue !== "-" &&
    recruitmentTimeValue !== "00:00:00";

  if (recruitmentCostInfo.hasCost && hasRecruitmentTime) {
    stats.push(
      { iconUrl: recruitmentCostInfo.iconUrl, title: recruitmentCostInfo.title, value: recruitmentCostInfo.value },
      { iconUrl: STAT_ICONS.recruitmentTime, title: UI_LABELS.recruitmentTime, value: recruitmentTimeValue }
    );
  }

  return stats;
}

function buildUnitStatsCard({ getStat, getFirstStat, supplyInfo }) {
  return [
    { iconUrl: STAT_ICONS.rangedAttack, title: "Ranged attack", value: getFirstStat(["rangeAttack", "rangedAttack", "attackRange", "rangedStrength"], "0") },
    { iconUrl: STAT_ICONS.meleeAttack, title: "Melee attack", value: getStat("meleeAttack", "0") },
    { iconUrl: STAT_ICONS.rangeDefence, title: "Ranged defence", value: getStat("rangeDefence", "0") },
    { iconUrl: STAT_ICONS.meleeDefence, title: "Melee defence", value: getStat("meleeDefence", "0") },
    { iconUrl: STAT_ICONS.speed, title: "Speed", value: getStat("speed", "0") },
    { iconUrl: STAT_ICONS.lootValue, title: "Loot", value: getStat("lootValue", "0") },
    { iconUrl: STAT_ICONS.might, title: "Might", value: getStat("mightValue", getStat("might", "0")) },
    { iconUrl: supplyInfo.iconUrl, title: supplyInfo.label, value: supplyInfo.value }
  ];
}

function buildToolStatsAll({ unit, getStat, getRecruitmentTimeStat, recruitmentCostInfo }) {
  const toolBaseBonuses = getToolBaseBonuses(unit, getStat);
  const toolEffectStats = buildToolDynamicEffects(unit);

  return [
    { iconUrl: STAT_ICONS.speed, title: UI_LABELS.speed, value: getStat("speed", "0") },
    { iconUrl: STAT_ICONS.lootValue, title: UI_LABELS.loot, value: getStat("lootValue", "0") },
    ...toolBaseBonuses,
    ...toolEffectStats,
    { iconUrl: STAT_ICONS.unitLimit, title: UI_LABELS.toolLimit, value: getStat("amountPerWave", "0") },
    { iconUrl: getCurrencyIcon("khantablet"), title: UI_LABELS.khanTabletBooster, value: formatPlusPercent(getStat("khanTabletBooster", "0")) },
    { iconUrl: getCurrencyIcon("khanmedal"), title: UI_LABELS.khanMedalBooster, value: formatPlusPercent(getStat("khanMedalBooster", "0")) },
    { iconUrl: getCurrencyIcon("samuraitoken"), title: UI_LABELS.samuraiTokenBooster, value: formatPlusPercent(getStat("samuraiTokenBooster", "0")) },
    { iconUrl: getCurrencyIcon("pearlrelic"), title: UI_LABELS.pearlBooster, value: formatPlusPercent(getStat("pearlBooster", "0")) },
    { iconUrl: STAT_ICONS.gallantryBonus, title: UI_LABELS.pointBonus, value: formatPlusPercent(getStat("pointBonus", "0")) },
    { iconUrl: STAT_ICONS.xpBonus, title: UI_LABELS.xpBonus, value: formatPlusPercent(getStat("xpBonus", "0")) },
    { iconUrl: STAT_ICONS.costC1, title: UI_LABELS.c1Bonus, value: formatPlusPercent(getStat("c1Bonus", "0")) },
    { iconUrl: STAT_ICONS.rageBonus, title: UI_LABELS.ragePointBonus, value: formatPlusPercent(getStat("ragePointBonus", "0")) },
    { iconUrl: STAT_ICONS.unknown, title: UI_LABELS.reputationBonus, value: formatPlusPercent(getStat("reputationBonus", "0")) },
    { iconUrl: STAT_ICONS.recruitmentTime, title: UI_LABELS.productionSpeed, value: getRecruitmentTimeStat(), modalOnly: true },
    { iconUrl: STAT_ICONS.woodCost, title: UI_LABELS.productionCost, value: getStat("costWood", "0"), modalOnly: true },
    { iconUrl: STAT_ICONS.stoneCost, title: UI_LABELS.productionCost, value: getStat("costStone", "0"), modalOnly: true },
    { iconUrl: STAT_ICONS.unknown, title: UI_LABELS.productionCost, value: getStat("costSceatToken", "0"), hideIfOne: true, modalOnly: true },
    { iconUrl: STAT_ICONS.unknown, title: UI_LABELS.productionCost, value: getStat("costLegendaryToken", "0"), hideIfOne: true, modalOnly: true },
    { iconUrl: getCostComponentIcon(1), title: UI_LABELS.productionCost, value: getStat("costComponent1", "0"), modalOnly: true },
    { iconUrl: getCostComponentIcon(2), title: UI_LABELS.productionCost, value: getStat("costComponent2", "0"), modalOnly: true },
    { iconUrl: getCostComponentIcon(3), title: UI_LABELS.productionCost, value: getStat("costComponent3", "0"), modalOnly: true },
    { iconUrl: getCostComponentIcon(4), title: UI_LABELS.productionCost, value: getStat("costComponent4", "0"), modalOnly: true },
    { iconUrl: getCostComponentIcon(5), title: UI_LABELS.productionCost, value: getStat("costComponent5", "0"), modalOnly: true },
    { iconUrl: getCostComponentIcon(6), title: UI_LABELS.productionCost, value: getStat("costComponent6", "0"), modalOnly: true },
    { iconUrl: getCostComponentIcon(7), title: UI_LABELS.productionCost, value: getStat("costComponent7", "0"), modalOnly: true },
    { iconUrl: getCostComponentIcon(8), title: UI_LABELS.productionCost, value: getStat("costComponent8", "0"), modalOnly: true },
    { iconUrl: recruitmentCostInfo.iconUrl, title: UI_LABELS.productionCost, value: recruitmentCostInfo.value, modalOnly: true }
  ];
}

function getEffectDisplayName(effectName, effectId) {
  const key = String(effectName || "").toLowerCase();
  if (!key) return `Effect ${effectId}`;
  if (key === "attackboostyard") {
    return lang?.["attackboostyard"] || "Increase unit attack strength in the courtyard";
  }
  if (key === "difficultyscalingdefenseboostyard" || key === "bonusyarddefensepower") {
    return lang?.["effect_name_difficultyscalingdefenseboostyard"] || "Strength in courtyard when defending";
  }

  const candidates = [
    `effect_name_${key}`,
    key,
    `ci_effect_${key}`,
    `effect_description_${key}`
  ];

  for (const langKey of candidates) {
    const label = lang?.[langKey];
    if (label) return String(label).replace(/\{0\}/g, "").trim();
  }

  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
}

function getEffectIcon(effectName, effectTitle = "") {
  const key = String(effectName || "").toLowerCase();
  const title = String(effectTitle || "").toLowerCase();
  const haystack = `${key} ${title}`;
  for (const rule of EFFECT_ICON_RULES) {
    if (rule.pattern.test(haystack)) return rule.icon;
  }
  return STAT_ICONS.unknown;
}

function resolveEffectMeta(effectName, effectId) {
  let title = getEffectDisplayName(effectName, effectId);
  const effectNameLc = String(effectName).toLowerCase();
  if (effectNameLc.includes("attackunitamount")) {
    title = UI_LABELS.toolLimit;
  }
  return {
    title,
    iconUrl: getEffectIcon(effectName, title)
  };
}

function buildToolDynamicEffects(unit) {
  const rawEffects = String(unit?.effects || "").trim();
  if (!rawEffects) return [];

  const list = [];
  const chunks = rawEffects.split(",").map((x) => x.trim()).filter(Boolean);

  chunks.forEach((chunk) => {
    const [effectIdRaw, valueRaw = "0"] = chunk.split("&");
    const effectId = String(effectIdRaw || "").trim();
    if (!effectId) return;

    const def = effectCtx?.effectDefinitions?.[effectId];
    const effectName = def?.name || `effect_${effectId}`;
    const isPercent = effectCtx?.percentEffectIDs?.has?.(effectId);
    const effectNameLc = String(effectName).toLowerCase();
    const forcePlusPercent = FORCE_PLUS_PERCENT_EFFECT_NAMES.has(effectNameLc);
    const autoPercentByName =
      /(bonus|boost|booster|protection)/.test(effectNameLc) &&
      !/(wave|amount|limit|kill|cost|time|speed)/.test(effectNameLc);
    const rawValue = String(valueRaw || "").trim();
    let value = formatStatValue(rawValue);

    if ((isPercent || forcePlusPercent || autoPercentByName) && rawValue && rawValue !== "-") {
      value = formatPlusPercent(rawValue);
    }

    const meta = resolveEffectMeta(effectName, effectId);
    const title = meta.title;
    const iconUrl = meta.iconUrl;
    const titleLc = String(title).toLowerCase();

    const attackWavesLabelLc = String(UI_LABELS.attackWaves || "").toLowerCase();
    if (
      titleLc.includes("attack waves") ||
      titleLc.includes("available attack waves") ||
      (attackWavesLabelLc && titleLc.includes(attackWavesLabelLc))
    ) {
      list.push({ iconUrl: STAT_ICONS.amountPerWave, title, value });
      return;
    }

    list.push({ iconUrl, title, value });
  });

  return list;
}

function buildStatGrid(stats, { hideEmpty = false, hideZero = false, fixedSlots = 0, gridClass = "" } = {}) {
  const visible = stats.filter((s) => {
    if (s.modalOnly) return false;
    if (s.hideIfZero && isZeroStat(s.value)) return false;
    if (s.hideIfOne && isOneStat(s.value)) return false;
    if (hideEmpty && (s.value === "-" || s.value === "" || s.value == null)) return false;
    if (hideZero && isZeroStat(s.value)) return false;
    return true;
  });

  const cells = visible.map((s) => statCell(s.iconUrl, s.title, s.value));
  if (fixedSlots > 0 && cells.length < fixedSlots) {
    const missing = fixedSlots - cells.length;
    for (let i = 0; i < missing; i += 1) {
      cells.push(`<div class="unit-row card-cell unit-row-empty"></div>`);
    }
  }

  const className = gridClass ? `unit-stats-grid ${gridClass}` : "unit-stats-grid";
  return `<div class="${className}">${cells.join("")}</div>`;
}

function isZeroStat(value) {
  const n = Number(value);
  return !Number.isNaN(n) && n === 0;
}

function isOneStat(value) {
  const n = Number(value);
  return !Number.isNaN(n) && n === 1;
}

function openUnitStatsModal({ name, stats }) {
  const modalEl = document.getElementById("unitStatsModal");
  if (!modalEl) return;

  const titleEl = modalEl.querySelector(".modal-title");
  const bodyEl = modalEl.querySelector("#unitStatsModalBody");
  titleEl.textContent = name || "Details";

  const rows = stats.map((s) => `
    <div class="unit-modal-row">
      <span class="unit-modal-icon"><img src="${s.iconUrl}" alt="${s.title}" class="stat-icon"></span>
      <span class="unit-modal-label">${s.title}</span>
      <span class="unit-modal-value">${s.value}</span>
    </div>
  `).join("");

  bodyEl.innerHTML = `
    <div class="unit-modal-layout">
      <div class="unit-modal-list">${rows}</div>
    </div>
  `;

  void hydrateComposedImages({ root: bodyEl, cache: composedUnitImageCache });
  new bootstrap.Modal(modalEl).show();
}

function normalizeName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getUnitImageUrl(unit) {
  const rawName = unit?.name || unit?.Name || "";
  const rawType = unit?.type || unit?.Type || "";
  if (!rawName || !rawType) return null;
  const nameNorm = normalizeName(rawName);
  const typeNorm = normalizeName(rawType);

  const exactKeys = [
    normalizeName(`${rawName}_unit_${rawType}`),
    normalizeName(`${rawType}_unit_${rawName}`),
    normalizeName(rawType),
    normalizeName(rawName)
  ];

  for (const key of exactKeys) {
    if (unitImageUrlMap[key]) return unitImageUrlMap[key];
  }

  if (!unitImageEntries.length) return null;

  const strictMatch = unitImageEntries.find(([key]) =>
    key.includes(typeNorm) &&
    key.includes(nameNorm) &&
    key.includes("unit")
  );
  if (strictMatch) return strictMatch[1];

  const typeMatch = unitImageEntries.find(([key]) =>
    key.includes(typeNorm) && key.includes("unit")
  );
  if (typeMatch) return typeMatch[1];

  const nameMatch = unitImageEntries.find(([key]) =>
    key.includes(nameNorm) && key.includes("unit")
  );
  if (nameMatch) return nameMatch[1];

  return null;
}

function getUnitName(unit) {
  const rawName = unit?.name || unit?.Name || "";
  const rawType = unit?.type || unit?.Type || "";
  const nameKey = rawName ? `${String(rawName).toLowerCase()}_name` : "";
  const typeKey = rawType ? `${String(rawType).toLowerCase()}_name` : "";
  return lang[typeKey] || rawType || lang[nameKey] || rawName || "Unit";
}

function getUnitLevel(unit) {
  const val = unit?.level ?? unit?.Level ?? unit?.lvl ?? unit?.Lvl;
  return (val === undefined || val === null || String(val).trim() === "") ? "-" : String(val);
}

function getUnitLevelNumber(unit) {
  const raw = unit?.level ?? unit?.Level ?? unit?.lvl ?? unit?.Lvl;
  const num = Number(raw);
  if (!Number.isNaN(num)) return num;
  return -1;
}

function getUnitId(unit) {
  return String(unit?.wodID || unit?.WodID || unit?.id || unit?.ID || "-");
}

function getUnitCategory(unit) {
  const name = String(unit?.name || unit?.Name || "").toLowerCase();
  const type = String(unit?.type || unit?.Type || "").toLowerCase();
  const group = String(unit?.group || unit?.Group || "").toLowerCase();
  if (
    name.includes("tool") ||
    type.includes("tool") ||
    group.includes("tool") ||
    name.includes("workshop") ||
    type.includes("workshop")
  ) return "tool";
  return "unit";
}

function hasAnyStatValue(unit, keys) {
  return keys.some((key) => {
    const v = unit?.[key];
    return v !== undefined && v !== null && String(v).trim() !== "";
  });
}

function hasRenderableStats(unit, category) {
  const unitKeys = [
    "rangeAttack", "rangedAttack", "attackRange", "rangedStrength",
    "meleeAttack",
    "rangeDefence", "meleeDefence",
    "speed",
    "lootValue",
    "mightValue", "might",
    "foodSupply", "meadSupply", "beefSupply",
    "recruitmentTime",
    "costC1", "costDragonGlass", "costdragonGlass", "dragonGlassCost", "costC2", "costC3", "costC4"
  ];

  const toolKeys = [
    "wallBonus", "gateBonus", "moatBonus",
    "defRangeBonus", "defMeleeBonus",
    "offRangeBonus", "offMeleeBonus",
    "amountPerWave", "fameBonus",
    "pointBonus", "xpBonus", "c1Bonus", "ragePointBonus", "reputationBonus",
    "khanTabletBooster", "khanMedalBooster", "samuraiTokenBooster", "pearlBooster",
    "lootValue",
    "effects",
    "cleavageOfCellsCost",
    "costWood", "costStone", "costSceatToken", "costLegendaryToken",
    "costComponent1", "costComponent2", "costComponent3", "costComponent4",
    "costComponent5", "costComponent6", "costComponent7", "costComponent8",
    "allowedToAttack", "allowedToTravel", "isYardTool",
    "mightValue", "might", "speed",
    "recruitmentTime",
    "costC1", "costDragonGlass", "costdragonGlass", "dragonGlassCost", "costC2", "costC3", "costC4"
  ];

  return hasAnyStatValue(unit, category === "unit" ? unitKeys : toolKeys);
}

function getGroupKey(unit) {
  const baseKey = `${normalizeName(unit?.name || unit?.Name || "")}__${normalizeName(unit?.type || unit?.Type || "")}`;
  const rawLevel = unit?.level ?? unit?.Level ?? unit?.lvl ?? unit?.Lvl;
  const hasLevel = !(rawLevel === undefined || rawLevel === null || String(rawLevel).trim() === "");
  if (!hasLevel) {
    return `${baseKey}__id_${getUnitId(unit)}`;
  }
  return baseKey;
}

function isExcludedTestUnit(unit) {
  const name = String(unit?.name || unit?.Name || "").toLowerCase();
  const type = String(unit?.type || unit?.Type || "").toLowerCase();
  return name.includes("quickattack") || type.includes("quickattack");
}

function getOrderMetric(unit, orderKey) {
  const getNumber = (keys) => {
    for (const key of keys) {
      const raw = unit?.[key];
      if (raw === undefined || raw === null || String(raw).trim() === "") continue;
      const n = Number(raw);
      if (!Number.isNaN(n)) return n;
    }
    return 0;
  };

  if (orderKey === "rangedAttack") return getNumber(["rangeAttack", "rangedAttack", "attackRange", "rangedStrength"]);
  if (orderKey === "meleeAttack") return getNumber(["meleeAttack"]);
  if (orderKey === "rangedDefence") return getNumber(["rangeDefence"]);
  if (orderKey === "meleeDefence") return getNumber(["meleeDefence"]);
  if (orderKey === "speed") return getNumber(["speed"]);
  if (orderKey === "lootValue") return getNumber(["lootValue"]);
  if (orderKey === "might") return getNumber(["mightValue", "might"]);
  if (orderKey === "supply") return getNumber(["foodSupply", "meadSupply", "beefSupply"]);
  return 0;
}

function groupUnits(units) {
  const groups = new Map();
  units.forEach((unit) => {
    const key = getGroupKey(unit);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(unit);
  });

  const entries = Array.from(groups.entries()).map(([key, items]) => {
    items.sort((a, b) => {
      const lvl = getUnitLevelNumber(a) - getUnitLevelNumber(b);
      if (lvl !== 0) return lvl;
      return Number(getUnitId(a)) - Number(getUnitId(b));
    });
    return { key, items };
  });

  entries.sort((a, b) => {
    const ua = a.items[a.items.length - 1];
    const ub = b.items[b.items.length - 1];
    return Number(getUnitId(ub)) - Number(getUnitId(ua));
  });

  return entries;
}

function sortGroupsBySelectedStat(groups, orderKey) {
  if (!orderKey || orderKey === "none") return groups;

  return groups.slice().sort((a, b) => {
    const aUnit = a.items[0];
    const bUnit = b.items[0];
    const av = getOrderMetric(aUnit, orderKey);
    const bv = getOrderMetric(bUnit, orderKey);
    if (bv !== av) return bv - av;
    return Number(getUnitId(bUnit)) - Number(getUnitId(aUnit));
  });
}

function createUnitCard(group, groupIndex) {
  let levelIndex = 0;
  const containerId = `unit-group-${groupIndex}`;

  function renderCurrent() {
    const unit = group.items[levelIndex];
    const name = getUnitName(unit);
    const imageUrl = getUnitImageUrl(unit);
    const level = getUnitLevel(unit);
    const category = getUnitCategory(unit);
    const hasLevels = group.items.length > 1;

    const fallbackImageUrl = "../../img_base/placeholder.webp";
    const shouldCompose = imageUrl &&
      imageUrl.startsWith("https://empire-html5.goodgamestudios.com/default/assets/itemassets/") &&
      /\.(webp|png)$/i.test(imageUrl);
    const compose = shouldCompose ? deriveCompanionUrls(imageUrl) : null;
    const imageBlock = imageUrl
      ? (() => {
        if (!shouldCompose) return `<img src="${imageUrl}" class="card-image w-100" loading="lazy" alt="${name}">`;
        return `<img src="${imageUrl}" class="card-image w-100" loading="lazy" alt="${name}" data-compose-asset="1" data-image-url="${compose.imageUrl}" data-json-url="${compose.jsonUrl}" data-js-url="${compose.jsUrl}">`;
      })()
      : `<img src="${fallbackImageUrl}" class="card-image w-100" loading="lazy" alt="${name}">`;

    const { getStat, getFirstStat, getRecruitmentTimeStat } = createStatHelpers(unit);

    const supplyInfo = getSupplyInfo(unit, getStat);

    const recruitmentCostInfo = getRecruitmentCostInfo(unit);
    const unitStatsCard = buildUnitStatsCard({ getStat, getFirstStat, supplyInfo });
    const toolStatsAll = buildToolStatsAll({ unit, getStat, getRecruitmentTimeStat, recruitmentCostInfo });

    const toolStatsCard = toolStatsAll.filter((s) =>
      s.title !== UI_LABELS.recruitmentCost &&
      s.title !== UI_LABELS.recruitmentTime
    );

    const rowsForCard = category === "unit"
      ? buildStatGrid(unitStatsCard, { hideEmpty: false })
      : buildStatGrid(toolStatsCard, { hideEmpty: true, hideZero: true, fixedSlots: 4, gridClass: "unit-stats-grid--tool" });
    return `
      <div class="level-selector d-flex justify-content-between align-items-center">
        ${hasLevels ? `
        <button id="${containerId}-prev" ${levelIndex === 0 ? "disabled" : ""}>
          <i class="bi bi-arrow-left"></i>
        </button>
        ` : `<span class="level-arrow-spacer"></span>`}
        <div class="level-text"><strong>${name}${level !== "-" ? ` (Lvl.${level})` : ""}</strong></div>
        ${hasLevels ? `
        <button id="${containerId}-next" ${levelIndex === group.items.length - 1 ? "disabled" : ""}>
          <i class="bi bi-arrow-right"></i>
        </button>
        ` : `<span class="level-arrow-spacer"></span>`}
      </div>
      <div class="card-table">
      <div class="row g-0 unit-grid unit-detail-trigger" data-level-index="${levelIndex}">
        <div class="col-4 d-flex justify-content-center align-items-center unit-image-col">
          <div class="image-wrapper">${imageBlock}</div>
        </div>
        <div class="col-8 d-flex flex-column">
          ${rowsForCard}
        </div>
      </div>
      </div>
    `;
  }

  const html = `
    <div class="col-lg-4 col-md-6 col-sm-12 d-flex flex-column">
      <div class="box flex-fill">
        <div class="box-content" id="${containerId}">
          ${renderCurrent()}
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    const root = document.getElementById(containerId);
    if (!root) return;
    const rerender = () => {
      root.innerHTML = renderCurrent();
      void hydrateComposedImages({ root, cache: composedUnitImageCache });
    };

    root.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const prev = target.closest(`#${containerId}-prev`);
      if (prev) {
        if (levelIndex > 0) {
          levelIndex -= 1;
          rerender();
        }
        return;
      }

      const next = target.closest(`#${containerId}-next`);
      if (next) {
        if (levelIndex < group.items.length - 1) {
          levelIndex += 1;
          rerender();
        }
        return;
      }

      const trigger = target.closest(".unit-detail-trigger");
      if (!trigger) return;

      const selectedLevelIndex = Number(trigger.dataset.levelIndex ?? levelIndex);
      const unit = group.items[selectedLevelIndex] || group.items[levelIndex];
      const { getStat, getFirstStat, getRecruitmentTimeStat } = createStatHelpers(unit);
      const modalSupplyInfo = getSupplyInfo(unit, getStat);
      const supplyValue = modalSupplyInfo.value;
      const supplyLabel = modalSupplyInfo.label;
      const supplyIcon = modalSupplyInfo.iconUrl;
      const recruitmentCostInfo = getRecruitmentCostInfo(unit);
      const category = getUnitCategory(unit);

      const stats = category === "unit"
        ? buildUnitStatsAll({
          getStat,
          getFirstStat,
          getRecruitmentTimeStat,
          supplyInfo: { label: supplyLabel, value: supplyValue, iconUrl: supplyIcon },
          recruitmentCostInfo
        }).filter((s) => {
          const isCombatStat =
            s.title === UI_LABELS.rangedAttack ||
            s.title === UI_LABELS.meleeAttack ||
            s.title === UI_LABELS.rangedDefence ||
            s.title === UI_LABELS.meleeDefence;
          if (isCombatStat && (s.value === "-" || s.value === "" || s.value == null || isZeroStat(s.value))) return false;
          return true;
        })
        : (() => {
          const filtered = buildToolStatsAll({ unit, getStat, getRecruitmentTimeStat, recruitmentCostInfo }).filter((s) => {
            if (s.value === "-" || s.value === "" || s.value == null) return false;
            if (isZeroStat(s.value)) return false;
            if (s.hideIfOne && isOneStat(s.value)) return false;
            return true;
          });
          const speedIndex = filtered.findIndex((s) => s.title === UI_LABELS.speed);
          if (speedIndex === 0) {
            filtered.push(filtered.shift());
          }
          return filtered;
        })();

      openUnitStatsModal({
        name: `${getUnitName(unit)}${getUnitLevel(unit) !== "-" ? ` (Lvl.${getUnitLevel(unit)})` : ""}`,
        stats
      });
    });
  }, 0);

  return html;
}

function renderUnits(groups) {
  const container = document.getElementById("cards");
  container.innerHTML = "";

  if (!groups.length) {
    container.innerHTML = "";
    return;
  }

  groups.forEach((group, index) => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = createUnitCard(group, index);
    container.appendChild(wrapper.firstElementChild);
  });

  void hydrateComposedImages({ root: container, cache: composedUnitImageCache });
}

function applyFilters() {
  const search = normalizeName(document.getElementById("searchInput")?.value || "");
  const typeFilter = document.getElementById("typeSelect")?.value || "unit";
  const toolTypeFilter = (document.getElementById("toolTypeSelect")?.value || "all").toLowerCase();
  const orderSelect = document.getElementById("orderSelect");
  const isToolFilter = typeFilter === "tool";
  const orderKey = isToolFilter ? "none" : (orderSelect?.value || "none");

  const filtered = allUnits.filter((unit) => {
    if (isExcludedTestUnit(unit)) return false;
    const category = getUnitCategory(unit);
    if (category !== typeFilter) return false;
    if (isToolFilter && toolTypeFilter !== "all") {
      const typ = String(unit?.typ || unit?.Typ || "").toLowerCase();
      if (typ !== toolTypeFilter) return false;
    }

    if (!hasRenderableStats(unit, category)) return false;

    if (!search) return true;
    const name = normalizeName(getUnitName(unit));
    return name.includes(search);
  });

  const grouped = groupUnits(filtered);
  const sorted = sortGroupsBySelectedStat(grouped, orderKey);
  renderUnits(sorted);
}

function updateOrderAvailability() {
  const typeSelect = document.getElementById("typeSelect");
  const orderSelect = document.getElementById("orderSelect");
  const orderWrap = document.getElementById("orderFilterWrap");
  const toolTypeWrap = document.getElementById("toolTypeFilterWrap");
  if (!typeSelect || !orderSelect || !orderWrap || !toolTypeWrap) return;

  const isTool = typeSelect.value === "tool";
  orderSelect.disabled = isTool;
  orderWrap.classList.toggle("d-none", isTool);
  toolTypeWrap.classList.toggle("d-none", !isTool);
  if (isTool) {
    orderSelect.value = "none";
  }
}

function setupTypeOptions() {
  const select = document.getElementById("typeSelect");
  if (!select) return;

  select.innerHTML = `
    <option value="unit" selected>${UI_LABELS.filterTypeUnit}</option>
    <option value="tool">${UI_LABELS.filterTypeTool}</option>
  `;
}

function setupOrderOptions() {
  const select = document.getElementById("orderSelect");
  if (!select) return;

  select.innerHTML = `
    <option value="none" selected>${UI_LABELS.sortBy} ${UI_LABELS.sortDefault}</option>
    <option value="rangedAttack">${UI_LABELS.sortBy} ${UI_LABELS.rangedAttack}</option>
    <option value="meleeAttack">${UI_LABELS.sortBy} ${UI_LABELS.meleeAttack}</option>
    <option value="rangedDefence">${UI_LABELS.sortBy} ${UI_LABELS.rangedDefence}</option>
    <option value="meleeDefence">${UI_LABELS.sortBy} ${UI_LABELS.meleeDefence}</option>
    <option value="speed">${UI_LABELS.sortBy} ${UI_LABELS.speed}</option>
    <option value="lootValue">${UI_LABELS.sortBy} ${UI_LABELS.loot}</option>
    <option value="might">${UI_LABELS.sortBy} ${UI_LABELS.might}</option>
  `;
}

function setupToolTypeOptions() {
  const select = document.getElementById("toolTypeSelect");
  if (!select) return;

  select.innerHTML = `
    <option value="all" selected>${UI_LABELS.allTools}</option>
    <option value="defence">${UI_LABELS.defenseTools}</option>
    <option value="attack">${UI_LABELS.attackTools}</option>
  `;
}

function setupEventListeners() {
  const searchInput = document.getElementById("searchInput");
  const typeSelect = document.getElementById("typeSelect");
  const orderSelect = document.getElementById("orderSelect");
  const toolTypeSelect = document.getElementById("toolTypeSelect");
  if (searchInput) searchInput.addEventListener("input", applyFilters);
  if (typeSelect) {
    typeSelect.addEventListener("change", () => {
      updateOrderAvailability();
      applyFilters();
    });
  }
  if (orderSelect) orderSelect.addEventListener("change", applyFilters);
  if (toolTypeSelect) toolTypeSelect.addEventListener("change", applyFilters);
}

initAutoHeight({
  contentSelector: "#content",
  subtractSelectors: [".note", ".page-title"],
  extraOffset: 18
});

async function init() {
  try {
    await coreInit({
      loader,
      itemLabel: "units",
      langCode: currentLanguage,
      normalizeNameFn: normalizeName,
      assets: {
        units: true,
        currencies: true
      },
      onReady: async ({ lang: L, data, imageMaps, effectCtx: E }) => {
        lang = L || {};
        effectCtx = E || { effectDefinitions: {}, percentEffectIDs: new Set() };
        await loadOwnLang();
        applyUiLabels();
        allUnits = Array.isArray(data?.units) ? data.units : [];
        unitImageUrlMap = imageMaps?.units || {};
        unitImageEntries = Object.entries(unitImageUrlMap);
        collectableCurrencyImageUrlMap = imageMaps?.currencies || {};

        initLanguageSelector({
          currentLanguage,
          lang,
          onSelect: () => location.reload()
        });

        const searchInput = document.getElementById("searchInput");
        if (searchInput) {
          searchInput.placeholder = UI_LABELS.searchPlaceholder;
        }

        setupTypeOptions();
        setupOrderOptions();
        setupToolTypeOptions();
        updateOrderAvailability();
        setupEventListeners();
        applyFilters();
      }
    });
  } catch (err) {
    console.error(err);
    loader.error("Something went wrong...", 30);
  }
}

init();
