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

const STAT_ICONS = {
  supplyFood: "../../img_base/food.png",
  supplyMead: "../../img_base/mead-icon.webp",
  supplyBeef: "../../img_base/biscuit.png",
  rangedAttack: "../../simulators/battle_simulator/img/ranged-icon.png",
  meleeAttack: "../../simulators/battle_simulator/img/melee-icon.png",
  meleeDefence: "../../simulators/battle_simulator/img/castellan-modal1.png",
  rangeDefence: "../../simulators/battle_simulator/img/castellan-modal2.png",
  might: "../../img_base/might.png",
  lootValue: "../../simulators/battle_simulator/img/loot-icon.png",
  speed: "../../simulators/battle_simulator/img/travelSpeed-icon.png",
  recruitmentTime: "../../simulators/battle_simulator/img/travelSpeed-icon.png",
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
  unknown: "../../img_base/placeholder.webp"
};

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
    loot: lang["dialog_battlelog_loot"] || "Loot",
    might: lang["playermight"] || "Might points",
    recruitmentTime: lang["recruitspeed"] || "Recruitment speed",
    recruitmentCost: getOwnLangValue("recruitment_cost", "Recruitment cost"),
    attackWaves: getOwnLangValue("attack_waves_bonus", "Increase the number of available attack waves"),
    sortBy: getOwnLangValue("sort_by", "Sort by"),
    filterTypeUnit: lang["units"] || getOwnLangValue("filter_type_unit", "Unit"),
    filterTypeTool: lang["tools"] || getOwnLangValue("filter_type_tool", "Tool"),
    searchPlaceholder: getOwnLangValue("search_placeholder", "Search by name..."),
    sortDefault: getOwnLangValue("sort_default", "Default")
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
  const total = Number(raw);
  if (Number.isNaN(total)) return raw;

  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);

  if (mins <= 0) return `${secs.toLocaleString(currentLanguage)} sec`;
  if (secs === 0) return `${mins.toLocaleString(currentLanguage)} min`;
  return `${mins.toLocaleString(currentLanguage)} min ${secs.toLocaleString(currentLanguage)} sec`;
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
    { iconUrl: STAT_ICONS.offRangeBonus, title: "Ranged attack bonus", value: withSignPercent(getStatFn("offRangeBonus", "0"), () => "+"), hideIfZero: true },
    { iconUrl: STAT_ICONS.offMeleeBonus, title: "Melee attack bonus", value: withSignPercent(getStatFn("offMeleeBonus", "0"), () => "+"), hideIfZero: true },
    { iconUrl: STAT_ICONS.defRangeBonus, title: "Ranged defense bonus", value: withSignPercent(getStatFn("defRangeBonus", "0"), hostileOrFriendlySign), hideIfZero: true },
    { iconUrl: STAT_ICONS.defMeleeBonus, title: "Melee defense bonus", value: withSignPercent(getStatFn("defMeleeBonus", "0"), hostileOrFriendlySign), hideIfZero: true },
    { iconUrl: STAT_ICONS.wallBonus, title: "Wall bonus", value: withSignPercent(getStatFn("wallBonus", "0"), hostileOrFriendlySign), hideIfZero: true },
    { iconUrl: STAT_ICONS.gateBonus, title: "Gate bonus", value: withSignPercent(getStatFn("gateBonus", "0"), hostileOrFriendlySign), hideIfZero: true },
    { iconUrl: STAT_ICONS.moatBonus, title: "Moat bonus", value: withSignPercent(getStatFn("moatBonus", "0"), hostileOrFriendlySign), hideIfZero: true },
    { iconUrl: STAT_ICONS.fameBonus, title: "Fame bonus", value: withSignPercent(getStatFn("fameBonus", "0"), () => "+"), hideIfZero: true }
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
    { key: "costTwinFlameAxes", labelKey: "currency_name_twinflameaxes", currencyKey: "twinflameaxes" },
    { key: "costC2", labelKey: "currency_name_currency2" },
    { key: "costC3", labelKey: "currency_name_currency3" },
    { key: "costC4", labelKey: "currency_name_currency4" }
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

function getEffectDisplayName(effectName, effectId) {
  const key = String(effectName || "").toLowerCase();
  if (!key) return `Effect ${effectId}`;

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

function getEffectIcon(effectName) {
  const key = String(effectName || "").toLowerCase();
  if (key === "attackboostyard") return "../../simulators/battle_simulator/img/cy-icon.png";
  if (key.includes("amountperwave")) return STAT_ICONS.amountPerWave;
  if (key.includes("attackunitamount")) return STAT_ICONS.amountPerWave;
  if (key.includes("killdefendingmeleetroopsyard")) return STAT_ICONS.killMeleeTroopsYard;
  if (key.includes("killdefendingrangedtroopsyard")) return STAT_ICONS.killRangedTroopsYard;
  if (key.includes("killdefendinganytroopsyard")) return STAT_ICONS.killAnyTroopsYard;
  if (key.includes("killattackingmeleetroopsyard")) return STAT_ICONS.killMeleeTroopsYardDefense;
  if (key.includes("killattackingrangedtroopsyard")) return STAT_ICONS.killRangedTroopsYardDefense;
  if (key.includes("killattackinganytroopsyard")) return STAT_ICONS.killAnyTroopsYardDefense;
  if (key.includes("ranged")) return STAT_ICONS.rangedAttack;
  if (key.includes("melee")) return STAT_ICONS.meleeAttack;
  if (key.includes("attack")) return STAT_ICONS.rangedAttack;
  if (key.includes("defense") || key.includes("defence")) return STAT_ICONS.rangeDefence;
  return STAT_ICONS.unknown;
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
    const rawValue = String(valueRaw || "").trim();
    let value = formatStatValue(rawValue);

    if (isPercent && rawValue && rawValue !== "-" && rawValue !== "0") {
      if (!String(value).includes("%")) value = `${value}%`;
    }

    const title = getEffectDisplayName(effectName, effectId);
    let iconUrl = getEffectIcon(effectName);
    const titleLc = String(title).toLowerCase();
    if (
      titleLc.includes("attack waves") ||
      titleLc.includes("available attack waves") ||
      titleLc.includes("támadási hullám")
    ) {
      iconUrl = STAT_ICONS.amountPerWave;
    }

    list.push({ iconUrl, title, value });
  });

  return list;
}

function buildStatGrid(stats, { hideEmpty = false, hideZero = false, fixedSlots = 0 } = {}) {
  const visible = stats.filter((s) => {
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

  return `<div class="unit-stats-grid">${cells.join("")}</div>`;
}

function isZeroStat(value) {
  const n = Number(value);
  return !Number.isNaN(n) && n === 0;
}

function isOneStat(value) {
  const n = Number(value);
  return !Number.isNaN(n) && n === 1;
}

function openUnitStatsModal({ name, imageUrl, imageCompose, stats }) {
  const modalEl = document.getElementById("unitStatsModal");
  if (!modalEl) return;

  const titleEl = modalEl.querySelector(".modal-title");
  const bodyEl = modalEl.querySelector("#unitStatsModalBody");
  titleEl.textContent = name || "Details";

  const modalImage = imageUrl
    ? (() => {
      if (!imageCompose) return `<img src="${imageUrl}" class="modal-unit-image" alt="${name || "Unit"}">`;
      return `<img src="${imageUrl}" class="modal-unit-image" alt="${name || "Unit"}" data-compose-asset="1" data-image-url="${imageCompose.imageUrl}" data-json-url="${imageCompose.jsonUrl}" data-js-url="${imageCompose.jsUrl}">`;
    })()
    : `<img src="../../img_base/placeholder.webp" class="modal-unit-image" alt="${name || "Unit"}">`;

  const rows = stats.map((s) => `
    <div class="unit-modal-row">
      <span class="unit-modal-icon"><img src="${s.iconUrl}" alt="${s.title}" class="stat-icon"></span>
      <span class="unit-modal-label">${s.title}</span>
      <span class="unit-modal-value">${s.value}</span>
    </div>
  `).join("");

  bodyEl.innerHTML = `
    <div class="unit-modal-layout">
      <div class="unit-modal-image-wrap">${modalImage}</div>
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

    const getStat = (key, fallback = "-") => {
      const v = unit?.[key];
      return (v === undefined || v === null || String(v).trim() === "") ? fallback : formatStatValue(v);
    };
    const getRecruitmentTimeStat = () => {
      const raw = unit?.recruitmentTime;
      return formatDurationMinSec(raw);
    };

    const getFirstStat = (keys, fallback = "-") => {
      for (const key of keys) {
        const v = unit?.[key];
        if (v !== undefined && v !== null && String(v).trim() !== "") return formatStatValue(v);
      }
      return fallback;
    };

    const supplyInfo = getSupplyInfo(unit, getStat);
    const supplyLabel = supplyInfo.label;
    const supplyValue = supplyInfo.value;
    const supplyIcon = supplyInfo.iconUrl;

    const rangedAttackValue = getFirstStat(["rangeAttack", "rangedAttack", "attackRange", "rangedStrength"], "0");
    const meleeAttackValue = getStat("meleeAttack", "0");
    const rangedDefenceValue = getStat("rangeDefence", "0");
    const meleeDefenceValue = getStat("meleeDefence", "0");
    const recruitmentCostInfo = getRecruitmentCostInfo(unit);

    const unitStatsAll = [
      { iconUrl: STAT_ICONS.rangedAttack, title: UI_LABELS.rangedAttack, value: rangedAttackValue },
      { iconUrl: STAT_ICONS.meleeAttack, title: UI_LABELS.meleeAttack, value: meleeAttackValue },
      { iconUrl: STAT_ICONS.rangeDefence, title: UI_LABELS.rangedDefence, value: rangedDefenceValue },
      { iconUrl: STAT_ICONS.meleeDefence, title: UI_LABELS.meleeDefence, value: meleeDefenceValue },
      { iconUrl: STAT_ICONS.speed, title: UI_LABELS.speed, value: getStat("speed") },
      { iconUrl: STAT_ICONS.lootValue, title: UI_LABELS.loot, value: getStat("lootValue") },
      { iconUrl: STAT_ICONS.might, title: UI_LABELS.might, value: getStat("mightValue", getStat("might")) },
      { iconUrl: supplyIcon, title: supplyLabel, value: supplyValue },
      ...(recruitmentCostInfo.hasCost
        ? [
          { iconUrl: STAT_ICONS.recruitmentTime, title: UI_LABELS.recruitmentTime, value: getRecruitmentTimeStat() },
          { iconUrl: recruitmentCostInfo.iconUrl, title: recruitmentCostInfo.title, value: recruitmentCostInfo.value }
        ]
        : [])
    ];

    const unitStatsCard = [
      { iconUrl: STAT_ICONS.speed, title: "Speed", value: getStat("speed", "0") },
      { iconUrl: STAT_ICONS.rangedAttack, title: "Ranged attack", value: getFirstStat(["rangeAttack", "rangedAttack", "attackRange", "rangedStrength"], "0") },
      { iconUrl: STAT_ICONS.meleeAttack, title: "Melee attack", value: getStat("meleeAttack", "0") },
      { iconUrl: STAT_ICONS.rangeDefence, title: "Ranged defence", value: getStat("rangeDefence", "0") },
      { iconUrl: STAT_ICONS.meleeDefence, title: "Melee defence", value: getStat("meleeDefence", "0") },
      { iconUrl: STAT_ICONS.lootValue, title: "Loot", value: getStat("lootValue", "0") },
      { iconUrl: STAT_ICONS.might, title: "Might", value: getStat("mightValue", getStat("might", "0")) },
      { iconUrl: supplyIcon, title: supplyLabel, value: supplyValue }
    ];

    const toolBaseBonuses = getToolBaseBonuses(unit, getStat);
    const toolEffectStats = buildToolDynamicEffects(unit);

    const toolStatsAll = [
      { iconUrl: STAT_ICONS.speed, title: UI_LABELS.speed, value: getStat("speed", "0") },
      { iconUrl: STAT_ICONS.lootValue, title: UI_LABELS.loot, value: getStat("lootValue", "0") },
      ...toolBaseBonuses,
      ...toolEffectStats,
      { iconUrl: STAT_ICONS.unitLimit, title: UI_LABELS.attackWaves, value: getStat("amountPerWave", "0") },
      { iconUrl: getCurrencyIcon("khantablet"), title: "Khan tablet booster", value: formatPlusPercent(getStat("khanTabletBooster", "0")) },
      { iconUrl: getCurrencyIcon("khanmedal"), title: "Khan medal booster", value: formatPlusPercent(getStat("khanMedalBooster", "0")) },
      { iconUrl: getCurrencyIcon("samuraitoken"), title: "Samurai token booster", value: formatPlusPercent(getStat("samuraiTokenBooster", "0")) },
      { iconUrl: getCurrencyIcon("pearlrelic"), title: "Pearl booster", value: formatPlusPercent(getStat("pearlBooster", "0")) },
      { iconUrl: STAT_ICONS.unknown, title: "Point bonus", value: formatPlusPercent(getStat("pointBonus", "0")) },
      { iconUrl: STAT_ICONS.unknown, title: "XP bonus", value: formatPlusPercent(getStat("xpBonus", "0")) },
      { iconUrl: STAT_ICONS.unknown, title: "C1 bonus", value: formatPlusPercent(getStat("c1Bonus", "0")) },
      { iconUrl: STAT_ICONS.unknown, title: "Rage point bonus", value: formatPlusPercent(getStat("ragePointBonus", "0")) },
      { iconUrl: STAT_ICONS.unknown, title: "Reputation bonus", value: formatPlusPercent(getStat("reputationBonus", "0")) },
      { iconUrl: STAT_ICONS.recruitmentTime, title: UI_LABELS.recruitmentTime, value: getRecruitmentTimeStat() },
      { iconUrl: STAT_ICONS.woodCost, title: "Wood cost", value: getStat("costWood", "0") },
      { iconUrl: STAT_ICONS.stoneCost, title: "Stone cost", value: getStat("costStone", "0") },
      { iconUrl: STAT_ICONS.unknown, title: "Sceat token cost", value: getStat("costSceatToken", "0"), hideIfOne: true },
      { iconUrl: STAT_ICONS.unknown, title: "Legendary token cost", value: getStat("costLegendaryToken", "0"), hideIfOne: true },
      { iconUrl: getCostComponentIcon(1), title: getCostComponentLabel(1), value: getStat("costComponent1", "0") },
      { iconUrl: getCostComponentIcon(2), title: getCostComponentLabel(2), value: getStat("costComponent2", "0") },
      { iconUrl: getCostComponentIcon(3), title: getCostComponentLabel(3), value: getStat("costComponent3", "0") },
      { iconUrl: getCostComponentIcon(4), title: getCostComponentLabel(4), value: getStat("costComponent4", "0") },
      { iconUrl: getCostComponentIcon(5), title: getCostComponentLabel(5), value: getStat("costComponent5", "0") },
      { iconUrl: getCostComponentIcon(6), title: getCostComponentLabel(6), value: getStat("costComponent6", "0") },
      { iconUrl: getCostComponentIcon(7), title: getCostComponentLabel(7), value: getStat("costComponent7", "0") },
      { iconUrl: getCostComponentIcon(8), title: getCostComponentLabel(8), value: getStat("costComponent8", "0") },
      { iconUrl: recruitmentCostInfo.iconUrl, title: recruitmentCostInfo.title, value: recruitmentCostInfo.value }
    ];

    const toolStatsCard = toolStatsAll.filter((s) =>
      s.title !== UI_LABELS.recruitmentCost &&
      s.title !== UI_LABELS.recruitmentTime
    );

    const rowsForCard = category === "unit"
      ? buildStatGrid(unitStatsCard, { hideEmpty: false })
      : buildStatGrid(toolStatsCard, { hideEmpty: true, hideZero: true, fixedSlots: 8 });
    const rowsForModal = category === "unit" ? unitStatsAll : toolStatsAll;

    return `
      <div class="level-selector d-flex justify-content-between align-items-center">
        <button id="${containerId}-prev" ${!hasLevels || levelIndex === 0 ? "disabled" : ""}>
          <i class="bi bi-arrow-left"></i>
        </button>
        <div class="level-text"><strong>${name}${level !== "-" ? ` (Lvl.${level})` : ""}</strong></div>
        <button id="${containerId}-next" ${!hasLevels || levelIndex === group.items.length - 1 ? "disabled" : ""}>
          <i class="bi bi-arrow-right"></i>
        </button>
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

    const bind = () => {
      const prev = document.getElementById(`${containerId}-prev`);
      const next = document.getElementById(`${containerId}-next`);
      const trigger = root.querySelector(".unit-detail-trigger");
      if (prev) {
        prev.onclick = () => {
          if (levelIndex > 0) {
            levelIndex -= 1;
            root.innerHTML = renderCurrent();
            void hydrateComposedImages({ root, cache: composedUnitImageCache });
            bind();
          }
        };
      }
      if (next) {
        next.onclick = () => {
          if (levelIndex < group.items.length - 1) {
            levelIndex += 1;
            root.innerHTML = renderCurrent();
            void hydrateComposedImages({ root, cache: composedUnitImageCache });
            bind();
          }
        };
      }
      if (trigger) {
        trigger.onclick = () => {
          const selectedLevelIndex = Number(trigger.dataset.levelIndex ?? levelIndex);
          const unit = group.items[selectedLevelIndex] || group.items[levelIndex];
          const modalImageUrl = getUnitImageUrl(unit) || "../../img_base/placeholder.webp";
          const modalCompose = (
            modalImageUrl.startsWith("https://empire-html5.goodgamestudios.com/default/assets/itemassets/") &&
            /\.(webp|png)$/i.test(modalImageUrl)
          ) ? deriveCompanionUrls(modalImageUrl) : null;

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
          const modalSupplyInfo = getSupplyInfo(unit, getStat);
          const supplyValue = modalSupplyInfo.value;
          const supplyLabel = modalSupplyInfo.label;
          const supplyIcon = modalSupplyInfo.iconUrl;
          const recruitmentCostInfo = getRecruitmentCostInfo(unit);
          const recruitmentTimeValue = formatDurationMinSec(unit?.recruitmentTime);
          const category = getUnitCategory(unit);

          const stats = category === "unit"
            ? [
              { iconUrl: STAT_ICONS.rangedAttack, title: UI_LABELS.rangedAttack, value: getFirstStat(["rangeAttack", "rangedAttack", "attackRange", "rangedStrength"]) },
              { iconUrl: STAT_ICONS.meleeAttack, title: UI_LABELS.meleeAttack, value: getStat("meleeAttack") },
              { iconUrl: STAT_ICONS.rangeDefence, title: UI_LABELS.rangedDefence, value: getStat("rangeDefence") },
              { iconUrl: STAT_ICONS.meleeDefence, title: UI_LABELS.meleeDefence, value: getStat("meleeDefence") },
              { iconUrl: STAT_ICONS.speed, title: UI_LABELS.speed, value: getStat("speed") },
              { iconUrl: STAT_ICONS.lootValue, title: UI_LABELS.loot, value: getStat("lootValue") },
              { iconUrl: STAT_ICONS.might, title: UI_LABELS.might, value: getStat("mightValue", getStat("might")) },
              { iconUrl: supplyIcon, title: supplyLabel, value: supplyValue ?? "-" },
              ...(recruitmentCostInfo.hasCost
                ? [
                  { iconUrl: recruitmentCostInfo.iconUrl, title: recruitmentCostInfo.title, value: recruitmentCostInfo.value },
                  { iconUrl: STAT_ICONS.recruitmentTime, title: UI_LABELS.recruitmentTime, value: recruitmentTimeValue }
                ]
                : [])
            ]
            : (() => {
              const toolModalEffectStats = buildToolDynamicEffects(unit);
              const toolModalStatsRaw = [
              ...toolModalEffectStats,
              { iconUrl: STAT_ICONS.lootValue, title: UI_LABELS.loot, value: getStat("lootValue", "0") },
              ...getToolBaseBonuses(unit, getStat),
              { iconUrl: STAT_ICONS.unitLimit, title: UI_LABELS.attackWaves, value: getStat("amountPerWave", "0") },
              { iconUrl: getCurrencyIcon("khantablet"), title: "Khan tablet booster", value: formatPlusPercent(getStat("khanTabletBooster", "0")) },
              { iconUrl: getCurrencyIcon("khanmedal"), title: "Khan medal booster", value: formatPlusPercent(getStat("khanMedalBooster", "0")) },
              { iconUrl: getCurrencyIcon("samuraitoken"), title: "Samurai token booster", value: formatPlusPercent(getStat("samuraiTokenBooster", "0")) },
              { iconUrl: getCurrencyIcon("pearlrelic"), title: "Pearl booster", value: formatPlusPercent(getStat("pearlBooster", "0")) },
              { iconUrl: STAT_ICONS.unknown, title: "Point bonus", value: formatPlusPercent(getStat("pointBonus", "0")) },
              { iconUrl: STAT_ICONS.unknown, title: "XP bonus", value: formatPlusPercent(getStat("xpBonus", "0")) },
              { iconUrl: STAT_ICONS.unknown, title: "C1 bonus", value: formatPlusPercent(getStat("c1Bonus", "0")) },
              { iconUrl: STAT_ICONS.unknown, title: "Rage point bonus", value: formatPlusPercent(getStat("ragePointBonus", "0")) },
              { iconUrl: STAT_ICONS.unknown, title: "Reputation bonus", value: formatPlusPercent(getStat("reputationBonus", "0")) },
              { iconUrl: STAT_ICONS.speed, title: UI_LABELS.speed, value: getStat("speed", "0") },
              { iconUrl: STAT_ICONS.recruitmentTime, title: UI_LABELS.recruitmentTime, value: recruitmentTimeValue },
              { iconUrl: STAT_ICONS.woodCost, title: "Wood cost", value: getStat("costWood", "0") },
              { iconUrl: STAT_ICONS.stoneCost, title: "Stone cost", value: getStat("costStone", "0") },
              { iconUrl: STAT_ICONS.unknown, title: "Sceat token cost", value: getStat("costSceatToken", "0"), hideIfOne: true },
              { iconUrl: STAT_ICONS.unknown, title: "Legendary token cost", value: getStat("costLegendaryToken", "0"), hideIfOne: true },
              { iconUrl: getCostComponentIcon(1), title: getCostComponentLabel(1), value: getStat("costComponent1", "0") },
              { iconUrl: getCostComponentIcon(2), title: getCostComponentLabel(2), value: getStat("costComponent2", "0") },
              { iconUrl: getCostComponentIcon(3), title: getCostComponentLabel(3), value: getStat("costComponent3", "0") },
              { iconUrl: getCostComponentIcon(4), title: getCostComponentLabel(4), value: getStat("costComponent4", "0") },
              { iconUrl: getCostComponentIcon(5), title: getCostComponentLabel(5), value: getStat("costComponent5", "0") },
              { iconUrl: getCostComponentIcon(6), title: getCostComponentLabel(6), value: getStat("costComponent6", "0") },
              { iconUrl: getCostComponentIcon(7), title: getCostComponentLabel(7), value: getStat("costComponent7", "0") },
              { iconUrl: getCostComponentIcon(8), title: getCostComponentLabel(8), value: getStat("costComponent8", "0") },
              { iconUrl: recruitmentCostInfo.iconUrl, title: recruitmentCostInfo.title, value: recruitmentCostInfo.value }
            ];

              return toolModalStatsRaw.filter((s) => {
                if (s.value === "-" || s.value === "" || s.value == null) return false;
                if (isZeroStat(s.value)) return false;
                if (s.hideIfOne && isOneStat(s.value)) return false;
                return true;
              });
            })();

          openUnitStatsModal({
            name: `${getUnitName(unit)}${getUnitLevel(unit) !== "-" ? ` (Lvl.${getUnitLevel(unit)})` : ""}`,
            imageUrl: modalImageUrl,
            imageCompose: modalCompose,
            stats
          });
        };
      }
    };

    bind();
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
  const orderSelect = document.getElementById("orderSelect");
  const isToolFilter = typeFilter === "tool";
  const orderKey = isToolFilter ? "none" : (orderSelect?.value || "none");

  const filtered = allUnits.filter((unit) => {
    if (isExcludedTestUnit(unit)) return false;
    const category = getUnitCategory(unit);
    if (category !== typeFilter) return false;

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
  if (!typeSelect || !orderSelect) return;

  const isTool = typeSelect.value === "tool";
  orderSelect.disabled = isTool;
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

function setupEventListeners() {
  const searchInput = document.getElementById("searchInput");
  const typeSelect = document.getElementById("typeSelect");
  const orderSelect = document.getElementById("orderSelect");
  if (searchInput) searchInput.addEventListener("input", applyFilters);
  if (typeSelect) {
    typeSelect.addEventListener("change", () => {
      updateOrderAvailability();
      applyFilters();
    });
  }
  if (orderSelect) orderSelect.addEventListener("change", applyFilters);
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