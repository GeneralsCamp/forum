import { initAutoHeight } from "../shared/ResizeService.mjs";
import { createLoader } from "../shared/LoadingService.mjs";
import { coreInit } from "../shared/CoreInit.mjs";
import { initLanguageSelector, getInitialLanguage } from "../shared/LanguageService.mjs";
import { getSharedText } from "../shared/SharedTextService.mjs";
import { deriveCompanionUrls } from "../shared/AssetComposer.mjs";
import { hydrateComposedImages } from "../shared/ComposeHydrator.mjs";
import { normalizeName } from "../shared/RewardResolver.mjs";

let lang = {};
let effectCtx = null;
let equipmentSets = [];
let setIndexById = {};
let slotById = {};
let wearerById = {};
let unitsById = {};
let equipmentUniqueImageUrlMap = {};
let uniqueGemImageUrlMap = {};
let equipmentEffectToEffectId = {};
let ownLang = {};
let lastMobileMode = null;
let showAllSetOptions = false;
let compareSetSelectionA = "";
let compareSetSelectionB = "";
let compareSetSelectionC = "";
let noMatchFiltersMessage = "No match to the current filters.";

const loader = createLoader();
const composedImageCache = new Map();
let currentLanguage = getInitialLanguage();
const DEFAULT_MIN_SET_ID = 1084;

const SLOT_ORDER = {
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "6": 5,
  "gem": 6
};

async function loadOwnLang() {
  try {
    const res = await fetch("./ownLang.json");
    const raw = await res.json();

    function normalize(obj) {
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        return Object.fromEntries(
          Object.entries(obj).map(([k, v]) => [k.toLowerCase(), normalize(v)])
        );
      }
      if (Array.isArray(obj)) return obj.map(normalize);
      return obj;
    }

    ownLang = normalize(raw);
  } catch (err) {
    console.error("ownLang error:", err);
    ownLang = {};
  }
}

function ui(key, fallback) {
  return ownLang[currentLanguage?.toLowerCase()]?.ui?.[key] || fallback;
}

function getArray(data, names) {
  for (const name of names) {
    if (Array.isArray(data?.[name])) return data[name];
  }
  return [];
}

function buildLookup(array, idKey) {
  const map = {};
  (array || []).forEach((item) => {
    if (!item) return;
    const id = item[idKey];
    if (id !== undefined && id !== null) map[String(id)] = item;
  });
  return map;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeSetId(value) {
  const s = String(value || "").trim();
  if (!s || s === "0") return null;
  return s;
}

function isDefaultSetId(setId) {
  const parsed = Number(String(setId || "").trim());
  return Number.isFinite(parsed) && parsed >= DEFAULT_MIN_SET_ID;
}

function cleanTemplateText(text) {
  return String(text || "")
    .replace(/\{\d+\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitEffectToken(token) {
  const [idRaw, valueRaw = "0"] = String(token || "").split("&");
  const id = String(idRaw || "").trim();
  if (!id) return [];

  const valuePart = String(valueRaw || "").trim();
  
  if (valuePart.includes("#")) {
    const nestedEntries = valuePart
      .split("#")
      .map((part) => String(part || "").trim())
      .filter((part) => part.includes("+"))
      .map((part) => {
        const [argPartRaw, nestedValueRaw] = part.split("+");
        const argId = String(argPartRaw || "").trim();
        const parsed = Number(nestedValueRaw);
        if (!argId || !Number.isFinite(parsed)) return null;
        return {
          id,
          value: parsed,
          argId
        };
      })
      .filter(Boolean);

    if (nestedEntries.length === 0) return [];

    const template = String(getEffectLabel(id) || "");
    if (!template.includes("{1}") && !template.includes("{2}")) {
      return [nestedEntries[0]];
    }

    return nestedEntries;
  }

  let numericPart = valuePart;
  let argId = null;
  if (numericPart.includes("+")) {
    const [argPart, actual] = numericPart.split("+");
    argId = String(argPart || "").trim() || null;
    numericPart = actual ?? numericPart;
  }

  const parsed = Number(numericPart);
  return [{
    id,
    value: Number.isFinite(parsed) ? parsed : 0,
    argId
  }];
}

function resolveEffectId(effectId, sourceType = "auto") {
  const raw = String(effectId || "").trim();
  if (!raw) return raw;
  const mapped = equipmentEffectToEffectId[raw];
  const hasDirect = Boolean(effectCtx?.effectDefinitions?.[raw]);

  if (sourceType === "equipment" || sourceType === "set_bonus") {
    if (mapped) return String(mapped);
    if (hasDirect) return raw;
    return raw;
  }

  if (sourceType === "gem") {
    if (hasDirect) return raw;
    if (mapped) return String(mapped);
    return raw;
  }

  if (hasDirect) return raw;
  if (mapped) return String(mapped);
  return raw;
}

function formatLocalizedNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  const locale = String(currentLanguage || "en").toLowerCase();
  return Math.abs(number).toLocaleString(locale);
}

function formatEffectValue(effectId, value, sourceType = "auto") {
  const resolvedEffectId = resolveEffectId(effectId, sourceType);
  const isPercent = Boolean(effectCtx?.percentEffectIDs?.has?.(String(resolvedEffectId)));
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const numberText = formatLocalizedNumber(value);
  return `${sign}${numberText}${isPercent ? "%" : ""}`;
}

function formatTemplateValue(template, effectId, value, sourceType = "auto") {
  const resolvedEffectId = resolveEffectId(effectId, sourceType);
  const isPercent = Boolean(effectCtx?.percentEffectIDs?.has?.(String(resolvedEffectId)));
  const absText = formatLocalizedNumber(value);
  const signedText = value > 0 ? `+${absText}` : value < 0 ? `-${absText}` : "0";

  const hasSignAroundPlaceholder =
    /[+\-]\s*\{0\}/.test(template) ||
    /\{0\}\s*[+\-]/.test(template);

  const hasPercentAroundPlaceholder =
    /\{0\}\s*%/.test(template) ||
    /%\s*\{0\}/.test(template);

  let token = hasSignAroundPlaceholder ? absText : signedText;

  if (isPercent && !hasPercentAroundPlaceholder) {
    token += "%";
  }

  return token;
}

function getEffectLabel(effectId, sourceType = "auto") {
  const resolvedEffectId = resolveEffectId(effectId, sourceType);
  const effectDef = effectCtx?.effectDefinitions?.[String(resolvedEffectId)] || null;
  const rawName = String(effectDef?.name || "").trim();

  if (!rawName) return `Effect ${resolvedEffectId || effectId}`;

  const directOverride = {
    charmboost: "additionalwaves"
  };

  const key = rawName.toLowerCase();
  const normalizedKey = directOverride[key] || key;
  const strippedShapeKey = normalizedKey.endsWith("shapeshifter")
    ? normalizedKey.replace(/shapeshifter$/i, "")
    : null;

  const candidates = [
    strippedShapeKey ? `equip_effect_description_${strippedShapeKey}` : null,
    strippedShapeKey ? `ci_effect_${strippedShapeKey}` : null,
    strippedShapeKey ? `effect_name_${strippedShapeKey}` : null,
    strippedShapeKey ? `equip_effect_description_short_${strippedShapeKey}` : null,
    strippedShapeKey,
    `equip_effect_description_${normalizedKey}`,
    `ci_effect_${normalizedKey}`,
    `effect_name_${normalizedKey}`,
    `effect_desc_${normalizedKey}`,
    `equip_effect_description_short_${normalizedKey}`,
    normalizedKey,
    `equip_effect_description_${key}`,
    `ci_effect_${key}`,
    `effect_name_${key}`,
    `effect_desc_${key}`,
    `equip_effect_description_short_${key}`,
    key
  ].filter(Boolean);

  for (const c of candidates) {
    const value = lang[c];
    if (!value) continue;
    const text = String(value);
    if (/lost its powers|seems to have run out|örökség|elvesztette erejét/i.test(text)) {
      continue;
    }
    return text;
  }

  return rawName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}

function renderEffectLine(effectId, value) {
  const sourceType = arguments.length > 3 ? String(arguments[3] || "auto").trim() : "auto";
  const template = getEffectLabel(effectId, sourceType);
  const entryArgId = arguments.length > 2 ? String(arguments[2] || "").trim() : "";

  const resolveUnitName = (unitId) => {
    if (!unitId) return "";
    const unit = unitsById[String(unitId)];
    if (!unit) return unitId;

    const typeKey = String(unit.type || "").trim();
    if (typeKey) {
      const langKey = `${typeKey}_name`.toLowerCase();
      if (lang[langKey]) return lang[langKey];
    }

    return unit.comment2 || unit.name || unit.type || unitId;
  };

  if (template.includes("{0}")) {
    const token = formatTemplateValue(template, effectId, value, sourceType);
    let text = template
      .replace(/\{0\}/g, token)
      .replace(/\{1\}/g, entryArgId ? resolveUnitName(entryArgId) : "")
      .replace(/\{2\}/g, "")
      .replace(/\{\d+\}/g, "")
      .replace(/\s*\.$/, "")
      .replace(/\s+/g, " ")
      .trim();
    return text;
  }

  const valueText = formatEffectValue(effectId, value, sourceType);
  const cleaned = cleanTemplateText(template);
  return `${cleaned}${cleaned.endsWith(":") ? "" : ":"} ${valueText}`;
}

function parseEffects(raw, sourceType = "auto") {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map(splitEffectToken)
    .flat()
    .map((entry) => renderEffectLine(entry.id, entry.value, entry.argId, sourceType));
}

function parseEffectTokens(raw) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map(splitEffectToken)
    .flat();
}

function sortEffectTokensByValueDesc(tokens) {
  return (tokens || [])
    .slice()
    .sort((a, b) => {
      const valueDiff = Number(b.value || 0) - Number(a.value || 0);
      if (valueDiff !== 0) return valueDiff;
      return Number(a.id || 0) - Number(b.id || 0);
    });
}

function getLocalizedWearerName(wearerId) {
  const wearer = wearerById[String(wearerId)];
  if (!wearer) return `Wearer ${wearerId}`;

  const raw = String(wearer.name || "").toLowerCase();
  if (raw.includes("baron")) {
    return (
      lang["equipment_itemtype_baron"] ||
      lang["equipment_itemType_baron"] ||
      lang["dialog_allianceCrestGenerator_castellan_tab"] ||
      "Castellan"
    );
  }
  if (raw.includes("general")) {
    return (
      lang["equipment_itemtype_general"] ||
      lang["equipment_itemType_general"] ||
      lang["dialog_allianceCrestGenerator_commander_tab"] ||
      "Commander"
    );
  }

  return wearer.name || `Wearer ${wearerId}`;
}

function getLocalizedSlotName(slotId) {
  const slot = slotById[String(slotId)];
  const raw = String(slot?.name || "").toLowerCase();
  const byRawToFilterKey = {
    helmet: "filters_subfilter_1",
    armor: "filters_subfilter_2",
    weapon: "filters_subfilter_3",
    artifact: "filters_subfilter_4",
    look: "filters_subfilter_5",
    skin: "filters_subfilter_5",
    hero: "filters_subfilter_6",
    heroes: "filters_subfilter_6"
  };
  const mappedKey = byRawToFilterKey[raw];
  if (mappedKey && lang[mappedKey]) return lang[mappedKey];
  if (!raw) return `Slot ${slotId}`;

  const candidates = [
    `equipmentslot_name_${raw}`,
    `dialog_equipment_slot_${raw}`,
    raw
  ];

  for (const key of candidates) {
    if (lang[key]) return lang[key];
  }

  return raw;
}

function getUnitNameById(unitId) {
  if (!unitId) return "";
  const unit = unitsById[String(unitId)];
  if (!unit) return unitId;

  const typeKey = String(unit.type || "").trim();
  if (typeKey) {
    const langKey = `${typeKey}_name`.toLowerCase();
    if (lang[langKey]) return lang[langKey];
  }

  return unit.comment2 || unit.name || unit.type || unitId;
}

function getEquipmentName(item) {
  if (!item) return "Equipment";
  const id = String(item.equipmentID || "");
  const langKey = `equipment_unique_${id}`.toLowerCase();
  return lang[langKey] || item.comment2 || item.comment1 || `Equipment ${id}`;
}

function getEquipmentImageUrl(item) {
  if (!item) return null;
  const ownId = String(item.equipmentID || "");
  const reuseId = String(item.reuseAssetOfEquipmentID || "");

  if (ownId && equipmentUniqueImageUrlMap[ownId]) {
    return equipmentUniqueImageUrlMap[ownId];
  }

  if (reuseId && equipmentUniqueImageUrlMap[reuseId]) {
    return equipmentUniqueImageUrlMap[reuseId];
  }

  return null;
}

function getGemName(item) {
  if (!item) return "Gem";
  const key = `gem_unique_${String(item.gemID || "")}`.toLowerCase();
  return lang[key] || item.comment2 || item.comment1 || `Gem ${item.gemID}`;
}

function getSetTitle(setEntry) {
  const setId = String(setEntry?.id || "").trim();
  if (setId) {
    const langKey = `equipment_set_${setId}`.toLowerCase();
    if (lang[langKey]) return lang[langKey];
    const directKey = `equipment_set_${setId}`;
    if (lang[directKey]) return lang[directKey];
  }

  const fromBonus = setEntry.bonuses.find((x) => String(x.comment2 || "").trim())?.comment2;
  if (fromBonus) return fromBonus;

  const fromEquip = setEntry.equipments.find((x) => String(x.comment1 || "").trim())?.comment1;
  if (fromEquip) {
    return fromEquip
      .replace(/\b(armor|weapon|helmet|artifact|hero)\b/ig, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  return `${ui("set_label", "Set")} #${setEntry.id}`;
}

function toPieceRows(setEntry) {
  const rows = [];
  const gemSlotLabel =
    lang["gem_name"] ||
    lang["gem_slottype_all"] ||
    ui("linked_gems", "Linked gems");

  setEntry.equipments.forEach((item) => {
    rows.push({
      type: "equipment",
      id: String(item.equipmentID),
      slotId: String(item.slotID || ""),
      slotLabel: getLocalizedSlotName(item.slotID),
      wearerLabel: getLocalizedWearerName(item.wearerID),
      name: getEquipmentName(item),
      effects: parseEffects(item.effects, "equipment"),
      imageUrl: getEquipmentImageUrl(item)
    });
  });

  setEntry.gems.forEach((item) => {
    const gemId = String(item.gemID || "");
    const reuseGemId = String(item.reuseAssetOfGemID || "");
    const gemImage =
      uniqueGemImageUrlMap[gemId] ||
      (reuseGemId ? uniqueGemImageUrlMap[reuseGemId] : null) ||
      "../../img_base/placeholder.webp";
    rows.push({
      type: "gem",
      id: gemId,
      slotId: "gem",
      slotLabel: gemSlotLabel,
      wearerLabel: getLocalizedWearerName(item.wearerID),
      name: getGemName(item),
      effects: parseEffects(item.effects, "gem"),
      imageUrl: gemImage
    });
  });

  rows.sort((a, b) => {
    const orderA = SLOT_ORDER[a.slotId] || 99;
    const orderB = SLOT_ORDER[b.slotId] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return Number(a.id) - Number(b.id);
  });

  return rows;
}

function buildSetIndex({ equipments, gems, setBonuses }) {
  const byId = {};

  function ensure(id) {
    byId[id] ||= {
      id,
      equipments: [],
      gems: [],
      bonuses: []
    };
    return byId[id];
  }

  equipments.forEach((item) => {
    const setId = normalizeSetId(item.setID);
    if (!setId) return;
    ensure(setId).equipments.push(item);
  });

  gems.forEach((item) => {
    const setId = normalizeSetId(item.setID);
    if (!setId) return;
    ensure(setId).gems.push(item);
  });

  setBonuses.forEach((item) => {
    const setId = normalizeSetId(item.setID);
    if (!setId) return;
    ensure(setId).bonuses.push(item);
  });

  Object.values(byId).forEach((entry) => {
    entry.bonuses.sort((a, b) => Number(a.neededItems || 0) - Number(b.neededItems || 0));
    entry.equipments.sort((a, b) => Number(a.slotID || 0) - Number(b.slotID || 0));
  });

  return byId;
}

function getCompareStatLabel(entry) {
  const rawBase = cleanTemplateText(getEffectLabel(entry.id));
  let base = rawBase
    .replace(/^[+\-\s%]+/, "")
    .replace(/\s*[.,:;]+\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (/^[+\-\s%]*of\s+/i.test(rawBase)) {
    base = base.replace(/^of\s+/i, "");
  }
  const normalizedBase = base ? `${base.charAt(0).toUpperCase()}${base.slice(1)}` : base;
  const unitLabel = entry.argId ? getUnitNameById(entry.argId) : "";
  return unitLabel ? `${normalizedBase} (${unitLabel})` : normalizedBase;
}

function buildCompareStatMap(rawEffects, sourceType = "auto") {
  const map = new Map();

  parseEffectTokens(rawEffects).forEach((token) => {
    const resolvedId = String(resolveEffectId(token.id, sourceType) || token.id || "");
    const argId = String(token.argId || "").trim();
    const key = `${resolvedId}::${argId}`;
    const previous = map.get(key);
    if (!previous) {
      map.set(key, {
        key,
        id: resolvedId,
        argId: argId || null,
        value: Number(token.value || 0),
        label: getCompareStatLabel({ id: resolvedId, argId: argId || null })
      });
      return;
    }
    previous.value += Number(token.value || 0);
  });

  return map;
}

function getSetOptions(wearerFilter = "all") {
  const options = [];

  Object.values(setIndexById).forEach((setEntry) => {
    if (!Array.isArray(setEntry.equipments) || setEntry.equipments.length === 0) {
      return;
    }

    const title = getSetTitle(setEntry);

    const matchesWearer = wearerFilter === "all"
      ? true
      : setEntry.equipments.some((x) => String(x.wearerID) === String(wearerFilter));

    if (!matchesWearer) return;

    options.push({
      id: setEntry.id,
      title
    });
  });

  options.sort((a, b) => {
    const idA = Number(a.id) || 0;
    const idB = Number(b.id) || 0;
    return idB - idA;
  });

  return options;
}

function renderEmpty(message) {
  const root = document.getElementById("setOverview");
  if (!root) return;
  root.innerHTML = `<div class="empty-state">${message}</div>`;
}

function getSelectedBonusView() {
  const select = document.getElementById("bonusViewSelect");
  const value = String(select?.value || "set_bonus");
  if (value === "compare_sets") return "compare_sets";
  if (value === "effect_summary") return "effect_summary";
  return "set_bonus";
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function getSelectedMobilePanel() {
  const select = document.getElementById("mobilePanelSelect");
  const value = String(select?.value || "set_pieces");
  if (value === "compare_sets") return "set_pieces";
  if (value === "set_bonuses") return "set_bonuses";
  if (value === "effect_summary") return "effect_summary";
  return "set_pieces";
}

function enforceMobileViewOptions() {
  const mobilePanelSelect = document.getElementById("mobilePanelSelect");
  if (!mobilePanelSelect) return;

  const compareOpt = mobilePanelSelect.querySelector('option[value="compare_sets"]');
  if (compareOpt) compareOpt.remove();
  if (String(mobilePanelSelect.value || "") === "compare_sets") {
    mobilePanelSelect.value = "set_pieces";
  }
}

function buildEffectSummaryHtml(setEntry) {
  const totals = new Map();

  const getSummaryMergeKey = (effectId, argId, sourceType) => {
    const template = String(getEffectLabel(effectId, sourceType) || "").trim();
    const argName = argId ? getUnitNameById(argId) : "";
    return template
      .replace(/\{1\}/g, argName)
      .replace(/\{2\}/g, "")
      .replace(/\{0\}/g, "{0}")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  };

  const addTokens = (raw, sourceType) => {
    parseEffectTokens(raw).forEach((entry) => {
      const resolvedId = String(resolveEffectId(entry.id, sourceType) || entry.id || "");
      const argId = String(entry.argId || "").trim();
      const mergeKey = getSummaryMergeKey(resolvedId, argId, "auto");
      const key = `${mergeKey}::${argId}`;
      const prev = totals.get(key);
      if (!prev) {
        totals.set(key, { id: resolvedId, argId: argId || null, value: Number(entry.value || 0), sourceType: "auto" });
        return;
      }
      prev.value += Number(entry.value || 0);
    });
  };

  setEntry.equipments.forEach((item) => addTokens(item.effects, "equipment"));
  setEntry.gems.forEach((item) => addTokens(item.effects, "gem"));
  setEntry.bonuses.forEach((item) => addTokens(item.effects, "set_bonus"));

  const rows = Array.from(totals.values())
    .sort((a, b) => {
      const valueDiff = Number(b.value || 0) - Number(a.value || 0);
      if (valueDiff !== 0) return valueDiff;
      return Number(a.id || 0) - Number(b.id || 0);
    })
    .map((entry, idx) => {
      const polarityClass = entry.value < 0 ? "is-negative" : "is-positive";
      return `
        <article class="summary-row ${polarityClass}">
          <div class="summary-rank">${idx + 1}</div>
          <div class="summary-main">
            <p class="summary-text">${renderEffectLine(entry.id, entry.value, entry.argId, entry.sourceType || "auto")}</p>
          </div>
        </article>
      `;
    })
    .join("");

  if (!rows) return `<div class="empty-state">No effect data</div>`;

  return `
    <section class="summary-view">
      <div class="summary-grid">
        ${rows}
      </div>
    </section>
  `;
}

function getCurrentWearerFilter() {
  return String(document.getElementById("wearerSelect")?.value || "all");
}

function getVisibleSetOptionsForCompare(wearerFilter = "all") {
  const allOptions = getSetOptions(wearerFilter);
  const filtered = showAllSetOptions
    ? allOptions
    : allOptions.filter((entry) => isDefaultSetId(entry.id));
  return { allOptions, filtered };
}

function buildSetAggregateStatMap(setEntry) {
  const map = new Map();

  const addRaw = (rawEffects, sourceType) => {
    parseEffectTokens(rawEffects).forEach((token) => {
      const resolvedId = String(resolveEffectId(token.id, sourceType) || token.id || "");
      const argId = String(token.argId || "").trim();
      const key = `${resolvedId}::${argId}`;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, {
          key,
          id: resolvedId,
          argId: argId || null,
          value: Number(token.value || 0),
          label: getCompareStatLabel({ id: resolvedId, argId: argId || null })
        });
        return;
      }
      prev.value += Number(token.value || 0);
    });
  };

  (setEntry?.equipments || []).forEach((item) => addRaw(item.effects, "equipment"));
  (setEntry?.gems || []).forEach((item) => addRaw(item.effects, "gem"));
  (setEntry?.bonuses || []).forEach((item) => addRaw(item.effects, "set_bonus"));

  return map;
}

function renderSetCompareView() {
  const root = document.getElementById("setOverview");
  if (!root) return;

  const wearerFilter = getCurrentWearerFilter();
  const { filtered } = getVisibleSetOptionsForCompare(wearerFilter);

  if (filtered.length === 0) {
    root.innerHTML = `<div class="empty-state">${ui("no_sets_for_compare", "No sets available for comparison in this filter.")}</div>`;
    return;
  }

  if (!filtered.some((x) => x.id === compareSetSelectionA)) compareSetSelectionA = filtered[0].id;
  if (!filtered.some((x) => x.id === compareSetSelectionB)) compareSetSelectionB = filtered[1]?.id || filtered[0].id;
  if (compareSetSelectionA === compareSetSelectionB && filtered.length > 1) {
    compareSetSelectionB = filtered.find((x) => x.id !== compareSetSelectionA)?.id || compareSetSelectionB;
  }
  if (!filtered.some((x) => x.id === compareSetSelectionC)) compareSetSelectionC = "";
  if (compareSetSelectionC === compareSetSelectionA || compareSetSelectionC === compareSetSelectionB) {
    compareSetSelectionC = "";
  }

  const isMobile = isMobileLayout();
  const optionsHtml = filtered.map((entry) => {
    const label = isMobile
      ? `${escapeHtml(entry.title)}`
      : `#${entry.id} - ${escapeHtml(entry.title)}`;
    return `<option value="${entry.id}">${label}</option>`;
  }).join("");
  const optionsHtmlC = `
    <option value="">${escapeHtml(ui("compare_optional_none", "None (2-set compare)"))}</option>
    ${optionsHtml}
  `;

  const setA = setIndexById[String(compareSetSelectionA)] || null;
  const setB = setIndexById[String(compareSetSelectionB)] || null;
  const setC = compareSetSelectionC ? (setIndexById[String(compareSetSelectionC)] || null) : null;

  let tableHtml = `<p class="compare-empty">${ui("select_2_sets_to_compare", "Select 2 sets to compare.")}</p>`;
  if (setA && setB) {
    const comparedSets = [setA, setB, setC].filter(Boolean);
    const statMaps = comparedSets.map((setEntry) => buildSetAggregateStatMap(setEntry));
    const rowMap = new Map();
    statMaps.forEach((map) => {
      map.forEach((entry, key) => {
        if (!rowMap.has(key)) rowMap.set(key, entry);
      });
    });

    const rows = Array.from(rowMap.values()).sort((a, b) => {
      const diff = String(a.label || "").localeCompare(String(b.label || ""));
      if (diff !== 0) return diff;
      return Number(a.id || 0) - Number(b.id || 0);
    });

    const rowHtml = rows.map((row) => {
      const values = statMaps.map((map) => map.get(row.key)?.value);
      const finite = values
        .map((value, index) => ({ value, index }))
        .filter((x) => Number.isFinite(x.value));
      const finiteNums = finite.map((x) => Number(x.value));
      const maxVal = finiteNums.length ? Math.max(...finiteNums) : null;
      const minVal = finiteNums.length ? Math.min(...finiteNums) : null;
      const isEqual = finiteNums.length > 1 && maxVal === minVal;

      const valueCells = values.map((value) => {
        const num = Number(value);
        const isFiniteValue = Number.isFinite(value);
        let cssClass = "";
        if (isFiniteValue) {
          if (isEqual) {
            cssClass = "compare-value-equal";
          } else if (num === maxVal) {
            cssClass = "compare-value-win";
          } else if (num === minVal) {
            cssClass = "compare-value-lose";
          }
        }
        const text = isFiniteValue ? formatEffectValue(row.id, value) : "-";
        const emptyClass = isFiniteValue ? "" : " compare-value-empty";
        return `<td class="compare-value-col${emptyClass} ${cssClass}">${escapeHtml(text)}</td>`;
      }).join("");

      return `
        <tr>
          <td class="compare-stat-col">${escapeHtml(row.label)}</td>
          ${valueCells}
        </tr>
      `;
    }).join("");

    const effectColumnLabel =
      lang["relicequip_dialog_effect_name"] ||
      ui("effect_label", "Effect");

    tableHtml = `
      <table class="compare-table compare-cols-${comparedSets.length}">
        <thead>
          <tr>
            <th class="compare-stat-col">${escapeHtml(effectColumnLabel)}</th>
            ${comparedSets.map((setEntry) => `<th class="compare-value-col">${escapeHtml(getSetTitle(setEntry))}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rowHtml || `<tr><td colspan="${1 + comparedSets.length}" class="compare-empty">${ui("no_comparable_effects", "No comparable effects.")}</td></tr>`}
        </tbody>
      </table>
    `;
  }

  root.innerHTML = `
    <section class="set-shell compare-view-shell">
      <header class="set-head">
        <h2 class="set-title">${ui("set_comparison_view", "Set comparison view")}</h2>
      </header>
      <div class="compare-view-toolbar">
        <select id="compareSetSelectA" class="form-select custom-select text-center" aria-label="Compare set A">
          ${optionsHtml}
        </select>
        <select id="compareSetSelectB" class="form-select custom-select text-center" aria-label="Compare set B">
          ${optionsHtml}
        </select>
        <select id="compareSetSelectC" class="form-select custom-select text-center" aria-label="Compare set C">
          ${optionsHtmlC}
        </select>
      </div>
      <div class="compare-table-wrap">${tableHtml}</div>
    </section>
  `;

  const selectA = document.getElementById("compareSetSelectA");
  const selectB = document.getElementById("compareSetSelectB");
  const selectC = document.getElementById("compareSetSelectC");
  if (selectA) {
    selectA.value = compareSetSelectionA;
    selectA.addEventListener("change", () => {
      compareSetSelectionA = String(selectA.value || "");
      if (compareSetSelectionA === compareSetSelectionB && filtered.length > 1) {
        compareSetSelectionB = filtered.find((x) => x.id !== compareSetSelectionA)?.id || compareSetSelectionB;
      }
      if (compareSetSelectionC === compareSetSelectionA) compareSetSelectionC = "";
      renderSetCompareView();
    });
  }
  if (selectB) {
    selectB.value = compareSetSelectionB;
    selectB.addEventListener("change", () => {
      compareSetSelectionB = String(selectB.value || "");
      if (compareSetSelectionB === compareSetSelectionA && filtered.length > 1) {
        compareSetSelectionA = filtered.find((x) => x.id !== compareSetSelectionB)?.id || compareSetSelectionA;
      }
      if (compareSetSelectionC === compareSetSelectionB) compareSetSelectionC = "";
      renderSetCompareView();
    });
  }
  if (selectC) {
    selectC.value = compareSetSelectionC;
    selectC.addEventListener("change", () => {
      compareSetSelectionC = String(selectC.value || "");
      if (compareSetSelectionC && (compareSetSelectionC === compareSetSelectionA || compareSetSelectionC === compareSetSelectionB)) {
        compareSetSelectionC = filtered.find((x) => x.id !== compareSetSelectionA && x.id !== compareSetSelectionB)?.id || "";
      }
      renderSetCompareView();
    });
  }
}

function renderSet(setId) {
  const root = document.getElementById("setOverview");
  if (!root) return;

  const setEntry = setIndexById[String(setId)];
  if (!setEntry) {
    renderEmpty(ui("no_sets", "No sets found for this filter."));
    return;
  }

  const pieceRows = toPieceRows(setEntry);
  const title = getSetTitle(setEntry);

  const pieceRowsHtml = pieceRows.map((piece, idx) => {
    const displayName = `${piece.name} (${piece.slotLabel})`;
    const itemEffects = piece.effects.length > 0
      ? piece.effects.map((line) => `<li>${line}</li>`).join("")
      : `<li>No effect data</li>`;

    const composed =
      piece.imageUrl &&
      piece.imageUrl.startsWith("https://empire-html5.goodgamestudios.com/default/assets/itemassets/") &&
      /\.(webp|png)$/i.test(piece.imageUrl)
        ? deriveCompanionUrls(piece.imageUrl)
        : null;

    const composeAttrs = composed
      ? ` data-compose-asset="1" data-image-url="${composed.imageUrl}" data-json-url="${composed.jsonUrl}" data-js-url="${composed.jsUrl}"`
      : "";

    return `
      <article class="piece-row">
        <h3 class="piece-name piece-name-mobile">${displayName}</h3>
        <div class="piece-visual">
          <div class="piece-image">
            ${piece.imageUrl ? `<img src="${piece.imageUrl}" alt="" loading="lazy"${composeAttrs}>` : "<span>?</span>"}
          </div>
        </div>
        <div class="piece-content">
          <h3 class="piece-name piece-name-desktop">${displayName}</h3>
          <ul class="effect-list">${itemEffects}</ul>
        </div>
      </article>
    `;
  }).join("");

  const bonusHtml = setEntry.bonuses.length > 0
    ? setEntry.bonuses.map((bonus) => {
      const effects = sortEffectTokensByValueDesc(parseEffectTokens(bonus.effects))
        .map((entry) => renderEffectLine(entry.id, entry.value, entry.argId, "set_bonus"));
      const effectText = effects.length > 0
        ? effects.map((x) => `<div>${x}</div>`).join("")
        : "<div>No effect data</div>";

      return `
        <div class="bonus-line">
          <span class="bonus-node"></span>
          <article class="bonus-card">
            <h3 class="bonus-threshold">${bonus.neededItems} ${ui("pieces_suffix", "pieces")}</h3>
            <div class="bonus-effects">${effectText}</div>
          </article>
        </div>
      `;
    }).join("")
    : `<div class="empty-state">${ui("no_set_milestones", "No set milestone data.")}</div>`;

  const desktopSelectedView = getSelectedBonusView();
  const mobilePanel = getSelectedMobilePanel();
  const mobile = isMobileLayout();
  const selectedView = mobile
    ? (mobilePanel === "effect_summary" ? "effect_summary" : mobilePanel === "compare_sets" ? "compare_sets" : "set_bonus")
    : desktopSelectedView;

  if (selectedView === "compare_sets") {
    renderSetCompareView();
    return;
  }

  const rightPanelTitle = selectedView === "effect_summary"
    ? ui("effect_summary", "Effect summary")
    : ui("set_bonuses", "Set bonuses");
  const rightPanelContent = selectedView === "effect_summary"
    ? buildEffectSummaryHtml(setEntry)
    : bonusHtml;
  const mobileClass = mobile
    ? `mobile-show-${
      mobilePanel === "set_pieces"
        ? "pieces"
        : mobilePanel === "effect_summary"
          ? "effect-summary"
          : "set-bonuses"
    }`
    : "";

  root.innerHTML = `
    <section class="set-shell">
      <header class="set-head">
        <h2 class="set-title">${title}</h2>
      </header>

      <div class="set-layout ${mobileClass}">
        <section class="panel">
          <div class="panel-head">${ui("set_pieces", "Set pieces")}</div>
          <div class="pieces-wrap">${pieceRowsHtml || `<div class="empty-state">${ui("no_pieces_found", "No pieces found.")}</div>`}</div>
        </section>

        <section class="panel">
          <div class="panel-head">${rightPanelTitle}</div>
          <div class="bonus-wrap ${selectedView === "effect_summary" ? "summary-mode" : ""}">${rightPanelContent}</div>
        </section>
      </div>
    </section>
  `;

  void hydrateComposedImages({
    root,
    selector: 'img[data-compose-asset="1"]:not([data-compose-ready])',
    cache: composedImageCache
  });
}

function setupWearerOptions(wearers) {
  const select = document.getElementById("wearerSelect");
  if (!select) return;

  const previous = select.value || "all";
  select.innerHTML = "";

  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = ui("all_wearers", "All wearers");
  select.appendChild(allOpt);

  wearers.forEach((wearer) => {
    const opt = document.createElement("option");
    opt.value = String(wearer.wearerID);
    opt.textContent = getLocalizedWearerName(wearer.wearerID);
    select.appendChild(opt);
  });

  select.value = Array.from(select.options).some((x) => x.value === previous) ? previous : "all";
}

function setupSetOptions(wearerFilter = "all") {
  const select = document.getElementById("setSelect");
  if (!select) return;

  const previous = String(select.dataset.lastSetValue || select.value || "").trim();
  const options = getSetOptions(wearerFilter);
  const defaultOptions = options.filter((entry) => isDefaultSetId(entry.id));
  const visibleOptions = showAllSetOptions ? options : defaultOptions;
  const hasHidden = !showAllSetOptions && options.length > defaultOptions.length;
  const canShowLess = showAllSetOptions && options.length > defaultOptions.length;

  select.innerHTML = "";

  if (options.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = ui("no_sets", "No sets found for this filter.");
    select.appendChild(opt);
    renderEmpty(ui("no_sets", "No sets found for this filter."));
    return;
  }

  visibleOptions.forEach((entry) => {
    const opt = document.createElement("option");
    opt.value = entry.id;
    opt.textContent = isMobileLayout() ? entry.title : `#${entry.id} - ${entry.title}`;
    select.appendChild(opt);
  });

  if (hasHidden) {
    const loadMoreOpt = document.createElement("option");
    loadMoreOpt.value = "__load_more__";
    loadMoreOpt.textContent = ui("load_more_sets", "Load more... (show all sets)");
    select.appendChild(loadMoreOpt);
  }

  if (canShowLess) {
    const showLessOpt = document.createElement("option");
    showLessOpt.value = "__show_less__";
    showLessOpt.textContent = ui("show_less_sets", "Show less...");
    select.appendChild(showLessOpt);
  }

  if (visibleOptions.length === 0) {
    if (!showAllSetOptions && options.length > 0) {
      showAllSetOptions = true;
      setupSetOptions(wearerFilter);
      return;
    }

    const noHighOption = document.createElement("option");
    noHighOption.value = "";
    noHighOption.textContent = noMatchFiltersMessage;
    noHighOption.disabled = true;
    noHighOption.selected = true;
    select.insertBefore(noHighOption, select.firstChild);
    renderEmpty(noMatchFiltersMessage);
    return;
  }

  select.value = visibleOptions.some((x) => x.id === previous) ? previous : visibleOptions[0].id;
  select.dataset.lastSetValue = select.value;
  renderSet(select.value);
}

function bindControls() {
  const wearerSelect = document.getElementById("wearerSelect");
  const setSelect = document.getElementById("setSelect");
  const bonusViewSelect = document.getElementById("bonusViewSelect");
  const mobilePanelSelect = document.getElementById("mobilePanelSelect");

  if (wearerSelect && !wearerSelect.dataset.bound) {
    wearerSelect.addEventListener("change", () => {
      setupSetOptions(wearerSelect.value || "all");
    });
    wearerSelect.dataset.bound = "true";
  }

  if (setSelect && !setSelect.dataset.bound) {
    setSelect.addEventListener("change", () => {
      const selected = String(setSelect.value || "").trim();
      if (selected === "__load_more__") {
        showAllSetOptions = true;
        const wearerValue = String(document.getElementById("wearerSelect")?.value || "all");
        setupSetOptions(wearerValue);
        return;
      }
      if (selected === "__show_less__") {
        showAllSetOptions = false;
        const wearerValue = String(document.getElementById("wearerSelect")?.value || "all");
        setupSetOptions(wearerValue);
        return;
      }
      setSelect.dataset.lastSetValue = selected;
      renderSet(selected);
    });
    setSelect.dataset.bound = "true";
  }

  if (bonusViewSelect && !bonusViewSelect.dataset.bound) {
    bonusViewSelect.addEventListener("change", () => {
      const currentSetId = String(document.getElementById("setSelect")?.value || "").trim();
      if (!currentSetId) return;
      renderSet(currentSetId);
    });
    bonusViewSelect.dataset.bound = "true";
  }

  if (mobilePanelSelect && !mobilePanelSelect.dataset.bound) {
    mobilePanelSelect.addEventListener("change", () => {
      const currentSetId = String(document.getElementById("setSelect")?.value || "").trim();
      if (!currentSetId) return;
      renderSet(currentSetId);
    });
    mobilePanelSelect.dataset.bound = "true";
  }

  if (!window.__equipmentSetsResizeBound) {
    window.addEventListener("resize", () => {
      const mobileNow = isMobileLayout();
      if (lastMobileMode !== null && mobileNow !== lastMobileMode) {
        const wearerValue = String(document.getElementById("wearerSelect")?.value || "all");
        setupSetOptions(wearerValue);
      }
      lastMobileMode = mobileNow;
      const currentSetId = String(document.getElementById("setSelect")?.value || "").trim();
      if (!currentSetId) return;
      renderSet(currentSetId);
    });
    window.__equipmentSetsResizeBound = true;
  }
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
      itemLabel: "equipment sets",
      langCode: currentLanguage,
      normalizeNameFn: normalizeName,
      assets: {
        equipmentUniques: true,
        uniqueGems: true
      },
      onReady: async ({ lang: L, data, imageMaps, effectCtx: E }) => {
        lang = L;
        effectCtx = E;
        equipmentEffectToEffectId = {};

        const equipments = getArray(data, ["equipments"]);
        const gems = getArray(data, ["gems"]);
        const setBonuses = getArray(data, ["equipment_sets", "equipmentSets"]);
        const equipmentEffects = getArray(data, ["equipment_effects", "equipmentEffects"]);
        const slots = getArray(data, ["equipment_slots", "equipmentSlots"]);
        const wearers = getArray(data, ["equipment_wearers", "equipmentWearers"]);
        const units = getArray(data, ["units"]);

        equipmentEffects.forEach((row) => {
          const equipmentEffectId = String(row?.equipmentEffectID || "").trim();
          const effectId = String(row?.effectID || "").trim();
          if (!equipmentEffectId || !effectId) return;
          equipmentEffectToEffectId[equipmentEffectId] = effectId;
        });

        slotById = buildLookup(slots, "slotID");
        wearerById = buildLookup(wearers, "wearerID");
        unitsById = buildLookup(units, "wodID");
        equipmentUniqueImageUrlMap = imageMaps?.equipmentUniques ?? {};
        uniqueGemImageUrlMap = imageMaps?.uniqueGems ?? {};

        setIndexById = buildSetIndex({
          equipments,
          gems,
          setBonuses
        });

        equipmentSets = Object.values(setIndexById);

        initLanguageSelector({
          currentLanguage,
          lang,
          onSelect: () => location.reload()
        });

        await loadOwnLang();
        noMatchFiltersMessage = await getSharedText("no_match_filters", currentLanguage, noMatchFiltersMessage);
        const bonusViewSelect = document.getElementById("bonusViewSelect");
        if (bonusViewSelect) {
          const optionSetBonus = bonusViewSelect.querySelector('option[value="set_bonus"]');
          const optionSummary = bonusViewSelect.querySelector('option[value="effect_summary"]');
          const optionCompare = bonusViewSelect.querySelector('option[value="compare_sets"]');
          if (optionSetBonus) optionSetBonus.textContent = ui("set_bonus_view", "Set bonus view");
          if (optionSummary) optionSummary.textContent = ui("effect_summary_view", "Effect summary view");
          if (optionCompare) optionCompare.textContent = ui("compare_sets_view", "Compare sets view");
        }

        const mobilePanelSelect = document.getElementById("mobilePanelSelect");
        if (mobilePanelSelect) {
          const optionPieces = mobilePanelSelect.querySelector('option[value="set_pieces"]');
          const optionSetBonus = mobilePanelSelect.querySelector('option[value="set_bonuses"]');
          const optionSummary = mobilePanelSelect.querySelector('option[value="effect_summary"]');
          if (optionPieces) optionPieces.textContent = ui("set_pieces", "Set pieces");
          if (optionSetBonus) optionSetBonus.textContent = ui("set_bonuses", "Set bonuses");
          if (optionSummary) optionSummary.textContent = ui("total_bonus_overview", "Total bonus overview");
        }

        enforceMobileViewOptions();

        const wearerSelect = document.getElementById("wearerSelect");
        if (wearerSelect) {
          const first = wearerSelect.querySelector('option[value="all"]');
          if (first) first.textContent = ui("all_wearers", "All wearers");
        }

        const setSelect = document.getElementById("setSelect");
        if (setSelect) {
          const first = setSelect.querySelector("option");
          if (first) first.textContent = ui("loading_sets", "Loading sets...");
        }

        bindControls();
        lastMobileMode = isMobileLayout();
        setupWearerOptions(wearers);
        setupSetOptions("all");

        if (equipmentSets.length === 0) {
          renderEmpty(ui("no_sets", "No sets found for this filter."));
        }
      }
    });
  } catch (err) {
    console.error(err);
    loader.error("Something went wrong...", 30);
  }
}

init();
