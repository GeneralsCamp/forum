import { handleAutoHeight, initAutoHeight } from "../../overviews/shared/ResizeService.mjs";
import { createLoader } from "../../overviews/shared/LoadingService.mjs";
import { coreInit } from "../../overviews/shared/CoreInit.mjs";
import { initLanguageSelector, getInitialLanguage } from "../../overviews/shared/LanguageService.mjs";
import { deriveCompanionUrls } from "../../overviews/shared/AssetComposer.mjs";
import { hydrateComposedImages } from "../../overviews/shared/ComposeHydrator.mjs";
import { normalizeName } from "../../overviews/shared/RewardResolver.mjs";
import { saveSimulatorData, loadSimulatorData } from "../../overviews/shared/GameSettings.mjs";
import { getSharedLanguagePack } from "../../overviews/shared/SharedTextService.mjs";
import { initRewardDetailModal } from "../../overviews/shared/RewardDetailModal.mjs";

let lang = {};
let ownLang = {};
let effectCtx = null;
let sharedLangPack = { filters: {}, ui: {} };
let setIndexById = {};
let equipmentSets = [];
let slotById = {};
let wearerById = {};
let unitsById = {};
let equipmentEffectToEffectId = {};
let equipmentEffectMetaById = {};
let equipmentUniqueImageUrlMap = {};
let uniqueGemImageUrlMap = {};
let currencyImageUrlMap = {};
let equipmentById = {};
let gemsById = {};
let wearerOptions = [];
let selectedSetIds = [];
let selectedTileKey = "";
let equipmentPool = [];
let equipped = {};
let currentWearerFilter = "all";
let currentTypeFilter = "all";
let currentSetSearchText = "";
let upgradeToggleEnabled = false;
let currentMobileBuilderView = "sets";
const statsEffectGroupOpenState = new Map();

const loader = createLoader();
const composedImageCache = new Map();
const currentLanguage = getInitialLanguage();
const MAX_SELECTED_SETS = 5;
const SIMULATOR_NAME = "equipment_builder";
const AUTO_HEIGHT_OPTIONS = {
  contentSelector: "#content",
  subtractSelectors: [".page-title", ".mobile-builder-view-switch"],
  extraOffset: 18
};

const SLOT_DEFS = [
  { id: "helmet", type: "helmet", labelKey: "helmet", acceptedSlotIds: ["3"], source: "equipment" },
  { id: "armor", type: "armor", labelKey: "armor", acceptedSlotIds: ["1"], source: "equipment" },
  { id: "weapon", type: "weapon", labelKey: "weapon", acceptedSlotIds: ["2"], source: "equipment" },
  { id: "artifact", type: "artifact", labelKey: "artifact", acceptedSlotIds: ["4"], source: "equipment" },
  { id: "look", type: "look", labelKey: "look", acceptedSlotIds: ["5"], source: "equipment" },
  { id: "hero", type: "hero", labelKey: "hero", acceptedSlotIds: ["6"], source: "equipment" },
  { id: "gem-1", type: "gem", labelKey: "gem", source: "gem", parentSlotId: "helmet" },
  { id: "gem-2", type: "gem", labelKey: "gem", source: "gem", parentSlotId: "armor" },
  { id: "gem-3", type: "gem", labelKey: "gem", source: "gem", parentSlotId: "weapon" },
  { id: "gem-4", type: "gem", labelKey: "gem", source: "gem", parentSlotId: "artifact" },
  { id: "gem-5", type: "gem", labelKey: "gem", source: "gem", parentSlotId: "look" }
];

const SLOT_PLACEHOLDER_IMAGES = {
  helmet: "../../img_base/eq-helmet.png",
  armor: "../../img_base/eq-armor.png",
  weapon: "../../img_base/eq-weapon.png",
  artifact: "../../img_base/eq-artifact.png",
  look: "../../img_base/eq-look.png",
  hero: "../../img_base/eq-hero.png",
  gem: "../../img_base/eq-gem.png"
};

const SLOT_PLACEHOLDER_FALLBACK = "../../img_base/placeholder.webp";

async function loadOwnLang() {
  try {
    const res = await fetch("./ownLang.json");
    const raw = await res.json();
    ownLang = lowercaseKeysRecursive(raw);
  } catch {
    ownLang = {};
  }
}

function lowercaseKeysRecursive(input) {
  if (!input || typeof input !== "object") return input;
  if (Array.isArray(input)) return input.map(lowercaseKeysRecursive);
  const out = {};
  Object.entries(input).forEach(([key, value]) => {
    out[String(key).toLowerCase()] = lowercaseKeysRecursive(value);
  });
  return out;
}

function ui(key, fallback) {
  return ownLang[currentLanguage?.toLowerCase()]?.ui?.[key] || fallback;
}

function sharedFilterText(key, fallback) {
  return sharedLangPack?.filters?.[key] || fallback;
}

function getSetSearchPlaceholder() {
  return `${sharedFilterText("search_placeholder_prefix", "Search by: ")}${[
    sharedFilterText("search_id", "ID"),
    sharedFilterText("search_name", "Name")
  ].join(", ")}`;
}

function gameText(keys, fallback = "") {
  const candidates = Array.isArray(keys) ? keys : [keys];
  for (const key of candidates) {
    const value = lang[String(key || "").toLowerCase()];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return fallback;
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
    const id = item?.[idKey];
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

function buildSetIndex({ equipments, gems, setBonuses }) {
  const byId = {};
  const ensure = (id) => {
    byId[id] ||= { id, equipments: [], gems: [], bonuses: [] };
    return byId[id];
  };

  equipments.forEach((item) => {
    const setId = normalizeSetId(item.setID);
    if (setId) ensure(setId).equipments.push(item);
  });

  gems.forEach((item) => {
    const setId = normalizeSetId(item.setID);
    if (setId) ensure(setId).gems.push(item);
  });

  setBonuses.forEach((item) => {
    const setId = normalizeSetId(item.setID);
    if (setId) ensure(setId).bonuses.push(item);
  });

  Object.values(byId).forEach((entry) => {
    entry.equipments.sort((a, b) => Number(a.slotID || 0) - Number(b.slotID || 0));
    entry.bonuses.sort((a, b) => Number(a.neededItems || 0) - Number(b.neededItems || 0));
  });

  return byId;
}

function getLocalizedWearerName(wearerId) {
  const wearer = wearerById[String(wearerId)];
  const raw = String(wearer?.name || "").toLowerCase();
  if (raw.includes("baron")) {
    return gameText([
      "equipment_itemtype_baron",
      "equipment_itemType_baron",
      "dialog_allianceCrestGenerator_castellan_tab"
    ], "Castellan");
  }
  if (raw.includes("general")) {
    return gameText([
      "equipment_itemtype_general",
      "equipment_itemType_general",
      "dialog_allianceCrestGenerator_commander_tab"
    ], "Commander");
  }
  return wearer?.name || `Wearer ${wearerId}`;
}

function getEquipmentSlotTypeLabel(type) {
  const normalized = String(type || "").toLowerCase();
  const subfilters = {
    helmet: "filters_subfilter_1",
    armor: "filters_subfilter_2",
    sword: "filters_subfilter_3",
    weapon: "filters_subfilter_3",
    artifact: "filters_subfilter_4",
    look: "filters_subfilter_5",
    skin: "filters_subfilter_5",
    hero: "filters_subfilter_6",
    heroes: "filters_subfilter_6",
    gem: "gem_name"
  };
  const slotTypes = {
    helmet: "equipment_slotType_helmet",
    armor: "equipment_slotType_armor",
    sword: "equipment_slotType_weapon",
    weapon: "equipment_slotType_weapon",
    artifact: "equipment_slotType_artifact",
    look: "equipment_slotType_skin",
    skin: "equipment_slotType_skin",
    hero: "equipment_slotType_hero",
    heroes: "equipment_slotType_hero",
    gem: "gem_name"
  };
  const fallback = {
    helmet: "Helmet",
    armor: "Armor",
    sword: "Weapon",
    weapon: "Weapon",
    artifact: "Artifact",
    look: "Look",
    skin: "Look",
    hero: "Hero",
    heroes: "Hero",
    gem: "Gem"
  }[normalized] || normalized || "Equipment";

  return gameText([
    slotTypes[normalized],
    subfilters[normalized],
    `equipment_slotType_${normalized}`
  ].filter(Boolean), fallback);
}

function getSlotNameFromId(slotId) {
  const raw = String(slotById[String(slotId)]?.name || "").toLowerCase();
  const mapped = {
    helmet: getEquipmentSlotTypeLabel("helmet"),
    armor: getEquipmentSlotTypeLabel("armor"),
    weapon: getEquipmentSlotTypeLabel("weapon"),
    sword: getEquipmentSlotTypeLabel("weapon"),
    artifact: getEquipmentSlotTypeLabel("artifact"),
    hero: getEquipmentSlotTypeLabel("hero"),
    heroes: getEquipmentSlotTypeLabel("hero"),
    skin: getEquipmentSlotTypeLabel("skin"),
    look: getEquipmentSlotTypeLabel("skin")
  };
  return mapped[raw] || gameText([
    `equipmentslot_name_${raw}`,
    `dialog_equipment_slot_${raw}`
  ], raw || `Slot ${slotId}`);
}

function getSetTitle(setEntry) {
  const setId = String(setEntry?.id || "").trim();
  if (setId) {
    const langKey = `equipment_set_${setId}`.toLowerCase();
    if (lang[langKey]) return lang[langKey];
  }

  const fromBonus = setEntry?.bonuses?.find((x) => String(x.comment2 || "").trim())?.comment2;
  if (fromBonus) return fromBonus;

  const fromEquip = setEntry?.equipments?.find((x) => String(x.comment1 || "").trim())?.comment1;
  if (fromEquip) {
    return fromEquip.replace(/\b(armor|weapon|helmet|artifact|hero)\b/ig, "").replace(/\s+/g, " ").trim();
  }

  return `Set #${setId}`;
}

function getEquipmentName(item) {
  const id = String(item?.equipmentID || "");
  const langKey = `equipment_unique_${id}`.toLowerCase();
  if (lang[langKey]) return lang[langKey];
  const candidates = [item?.comment2, item?.comment1, item?.name, item?.Name];
  const specific = candidates.find((value) => {
    const normalized = normalizeName(value);
    return normalized && !["equipment", "commander", "general", "baron", "castellan"].includes(normalized) && !normalized.includes("placeholder");
  });
  return specific || `Equipment ${id}`;
}

function getGemName(item) {
  const id = String(item?.gemID || "");
  return gameText(`gem_unique_${id}`, item?.comment2 || item?.comment1 || `Gem ${id}`);
}

function getEquipmentImageUrl(item) {
  const ownId = String(item?.equipmentID || "");
  const reuseId = String(item?.reuseAssetOfEquipmentID || "");
  return equipmentUniqueImageUrlMap[ownId] || (reuseId ? equipmentUniqueImageUrlMap[reuseId] : null) || "../../img_base/equipment.png";
}

function getGemImageUrl(item) {
  const ownId = String(item?.gemID || "");
  const reuseId = String(item?.reuseAssetOfGemID || "");
  return uniqueGemImageUrlMap[ownId] || (reuseId ? uniqueGemImageUrlMap[reuseId] : null) || "../../img_base/placeholder.webp";
}

function resolveEffectId(effectId, sourceType = "auto") {
  const raw = String(effectId || "").trim();
  const mapped = equipmentEffectToEffectId[raw];
  const hasDirect = Boolean(effectCtx?.effectDefinitions?.[raw]);

  if (sourceType === "equipment" || sourceType === "set_bonus") return mapped || raw;
  if (sourceType === "gem") return hasDirect ? raw : (mapped || raw);
  return hasDirect ? raw : (mapped || raw);
}

function splitEffectToken(token) {
  const [idRaw, valueRaw = "0"] = String(token || "").split("&");
  const id = String(idRaw || "").trim();
  if (!id) return [];

  const valuePart = String(valueRaw || "").trim();
  if (valuePart.includes("#")) {
    return valuePart.split("#").map((part) => {
      const [argPart, nestedValue] = String(part || "").split("+");
      const value = Number(nestedValue);
      if (!argPart || !Number.isFinite(value)) return null;
      return { id, value, argId: String(argPart).trim() };
    }).filter(Boolean);
  }

  let numericPart = valuePart;
  let argId = null;
  if (numericPart.includes("+")) {
    const [argPart, actual] = numericPart.split("+");
    argId = String(argPart || "").trim() || null;
    numericPart = actual ?? numericPart;
  }

  const parsed = Number(numericPart);
  return [{ id, value: Number.isFinite(parsed) ? parsed : 0, argId }];
}

function getEffectLabel(effectId, sourceType = "auto") {
  const resolved = resolveEffectId(effectId, sourceType);
  const def = effectCtx?.effectDefinitions?.[String(resolved)];
  const rawName = String(def?.name || "").trim();
  if (!rawName) return `Effect ${resolved || effectId}`;

  const key = rawName.toLowerCase();
  const candidates = [
    `equip_effect_description_${key}`,
    `ci_effect_${key}`,
    `effect_name_${key}`,
    `effect_desc_${key}`,
    `equip_effect_description_short_${key}`,
    key
  ];

  for (const candidate of candidates) {
    const value = lang[candidate];
    if (value && !/lost its powers|seems to have run out/i.test(String(value))) return String(value);
  }

  return rawName.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").trim();
}

function getUnitNameById(unitId) {
  const unit = unitsById[String(unitId)];
  if (!unit) return String(unitId || "");
  const typeKey = String(unit.type || "").trim();
  if (typeKey && lang[`${typeKey}_name`.toLowerCase()]) return lang[`${typeKey}_name`.toLowerCase()];
  return unit.comment2 || unit.name || unit.type || String(unitId || "");
}

function normalizeEffectSemanticValue(effectId, value, sourceType = "auto") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const template = String(getEffectLabel(effectId, sourceType) || "");
  if (/-\s*\{0\}/.test(template) || /\{0\}\s*-/.test(template)) return -Math.abs(numeric);
  if (/\+\s*\{0\}/.test(template) || /\{0\}\s*\+/.test(template)) return Math.abs(numeric);
  return numeric;
}

function getEquipmentUpgradeBonus(effectId, sourceType = "auto", effectIndex = 0) {
  if (!upgradeToggleEnabled || sourceType !== "equipment") return 0;
  const effectMeta = equipmentEffectMetaById[String(effectId || "").trim()];
  if (!effectMeta) return 0;
  const rateKey = effectIndex === 0 ? "enchantmentPrimaryBonus" : "enchantmentSecondaryBonus";
  const rate = Number(effectMeta[rateKey] || 0);
  if (!Number.isFinite(rate)) return 0;
  return Math.round(20 * rate);
}

function parseEffectTokens(raw, sourceType = "auto", item = null) {
  if (!raw) return [];
  return String(raw).split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .flatMap(splitEffectToken)
    .map((entry, index) => ({
      ...entry,
      id: String(resolveEffectId(entry.id, sourceType) || entry.id || ""),
      value: normalizeEffectSemanticValue(
        entry.id,
        Number(entry.value || 0) + getEquipmentUpgradeBonus(entry.id, sourceType, index),
        sourceType
      ),
      sourceType
    }));
}

function formatLocalizedNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return Math.abs(number).toLocaleString(String(currentLanguage || "en").toLowerCase());
}

function formatEffectValue(effectId, value) {
  const resolved = resolveEffectId(effectId);
  const isPercent = Boolean(effectCtx?.percentEffectIDs?.has?.(String(resolved)));
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatLocalizedNumber(value)}${isPercent ? "%" : ""}`;
}

function getEffectText(effectId, value, argId = null) {
  const template = getEffectLabel(effectId);
  const valueText = formatEffectValue(effectId, value);

  let text = "";

  if (template.includes("{0}")) {
    text = template
      .replace(/\{0\}/g, valueText)
      .replace(/\{1\}/g, argId ? getUnitNameById(argId) : "")
      .replace(/\{2\}/g, "")
      .replace(/\{\d+\}/g, "")
      .replace(/\s+/g, " ")
      .replace(/\+\+/g, "+")
      .replace(/--/g, "-")
      .replace(/%%/g, "%")
      .trim();
  } else {
    text = `${template.replace(/\{\d+\}/g, "").trim()}: ${valueText}`;
  }

  const def = effectCtx?.effectDefinitions?.[String(effectId)];
  const capId = String(def?.capID || "");

  const cap = effectCtx?.effectCapsMap?.[capId];

  if (cap?.maxTotalBonus !== undefined) {
    text += ` (Max: ${formatLocalizedNumber(cap.maxTotalBonus)}%)`;
  }

  return text;
}

function compareSortOrder(a, b) {
  const pa = String(a || "").split(".").map(Number);
  const pb = String(b || "").split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const av = Number.isFinite(pa[i]) ? pa[i] : 0;
    const bv = Number.isFinite(pb[i]) ? pb[i] : 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function getSetOptions(wearerFilter = "all") {
  return Object.values(setIndexById)
    .filter((entry) => entry.equipments.length > 0)
    .filter((entry) => wearerFilter === "all" || entry.equipments.some((item) => String(item.wearerID) === String(wearerFilter)))
    .map((entry) => ({ id: entry.id, title: getSetTitle(entry) }))
    .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
}

function getFilteredSetOptions(wearerFilter = "all") {
  const search = String(currentSetSearchText || "").trim().toLowerCase();
  const normalizedSearch = normalizeName(search);
  return getSetOptions(wearerFilter).filter((entry) => {
    if (!search) return true;
    const id = String(entry.id || "").toLowerCase();
    const title = String(entry.title || "");
    return id.includes(search)
      || title.toLowerCase().includes(search)
      || normalizeName(title).includes(normalizedSearch);
  });
}

function getSelectedSetEntries() {
  return selectedSetIds.map((id) => setIndexById[String(id)]).filter(Boolean);
}

function getItemKey(item) {
  return `${item.kind}:${item.id}`;
}

function getEquipmentTypeFromSlotId(slotId) {
  return {
    "1": "helmet",
    "2": "armor",
    "3": "sword",
    "4": "artifact",
    "5": "artifact",
    "6": "hero"
  }[String(slotId || "")] || "equipment";
}

function getEquipmentTypeLabelFromSlotId(slotId) {
  const type = getEquipmentTypeFromSlotId(slotId);
  const labels = {
    helmet: getEquipmentSlotTypeLabel("helmet"),
    armor: getEquipmentSlotTypeLabel("armor"),
    sword: getEquipmentSlotTypeLabel("weapon"),
    artifact: getEquipmentSlotTypeLabel("artifact"),
    hero: getEquipmentSlotTypeLabel("hero")
  };
  return labels[type] || getSlotNameFromId(slotId);
}

function normalizeEquipmentItem(item, setEntry) {
  const slotId = String(item.slotID || "");
  return {
    kind: "equipment",
    id: String(item.equipmentID || ""),
    setId: String(setEntry.id),
    name: getEquipmentName(item),
    slotId,
    type: getEquipmentTypeFromSlotId(slotId),
    typeLabel: getEquipmentTypeLabelFromSlotId(slotId),
    raw: item,
    sourceType: "equipment",
    imageUrl: getEquipmentImageUrl(item)
  };
}

function normalizeGemItem(item, setEntry) {
  return {
    kind: "gem",
    id: String(item.gemID || ""),
    setId: String(setEntry.id),
    name: getGemName(item),
    slotId: "gem",
    type: "gem",
    typeLabel: getEquipmentSlotTypeLabel("gem"),
    raw: item,
    sourceType: "gem",
    imageUrl: getGemImageUrl(item)
  };
}

function rebuildEquipmentPool() {
  equipmentPool = [];
  getSelectedSetEntries().forEach((entry) => {
    entry.equipments.forEach((item) => equipmentPool.push(normalizeEquipmentItem(item, entry)));
    entry.gems.forEach((item) => equipmentPool.push(normalizeGemItem(item, entry)));
  });
}

function saveBuilderState() {
  const equippedBySlot = {};
  Object.entries(equipped).forEach(([slotId, item]) => {
    if (item) equippedBySlot[slotId] = getItemKey(item);
  });

  saveSimulatorData(SIMULATOR_NAME, {
    wearer: currentWearerFilter,
    type: currentTypeFilter,
    setSearch: currentSetSearchText,
    selectedSetIds,
    selectedTileKey,
    equippedBySlot
  });
}

function restoreBuilderState() {
  const saved = loadSimulatorData(SIMULATOR_NAME) || {};

  const savedWearer = String(saved.wearer || currentWearerFilter || "all");
  if (savedWearer && (savedWearer === "all" || wearerOptions.some((wearer) => wearer.value === savedWearer))) {
    currentWearerFilter = savedWearer;
  }

  const allowedSetIds = new Set(getSetOptions(currentWearerFilter).map((entry) => String(entry.id)));
  selectedSetIds = Array.isArray(saved.selectedSetIds)
    ? saved.selectedSetIds.map(String).filter((id) => allowedSetIds.has(id)).slice(0, MAX_SELECTED_SETS)
    : [];

  rebuildEquipmentPool();

  currentTypeFilter = String(saved.type || "all");
  currentSetSearchText = String(saved.setSearch || "");
  selectedTileKey = "";
  equipped = {};

  const equippedBySlot = saved.equippedBySlot && typeof saved.equippedBySlot === "object"
    ? saved.equippedBySlot
    : {};

  ["equipment", "gem"].forEach((source) => {
    Object.entries(equippedBySlot).forEach(([slotId, itemKey]) => {
      const slot = SLOT_DEFS.find((entry) => entry.id === slotId && entry.source === source);
      const item = equipmentPool.find((entry) => getItemKey(entry) === String(itemKey));
      if (slot && item && isItemAllowedInSlot(item, slot)) {
        equipped[slotId] = item;
      }
    });
  });

  Object.entries(equipped).forEach(([slotId, item]) => {
    if (SLOT_DEFS.find((slot) => slot.id === slotId)?.source === "equipment" && !canEquipmentSlotGem(item)) {
      clearLinkedGemSlot(slotId);
    }
  });

  const savedSelectedTileKey = String(saved.selectedTileKey || "");
  if (equipmentPool.some((entry) => getItemKey(entry) === savedSelectedTileKey)) {
    selectedTileKey = savedSelectedTileKey;
  }

  if (!getSetOptions(currentWearerFilter).length) {
    selectedSetIds = [];
    equipped = {};
  }
}

function isItemAllowedInSlot(item, slot) {
  if (!item || !slot) return false;
  if (slot.source === "gem") return item.kind === "gem" && isGemSlotUnlocked(slot);
  if (item.kind !== "equipment") return false;
  return slot.acceptedSlotIds.includes(String(item.slotId));
}

function canEquipmentSlotGem(item) {
  return String(item?.raw?.canSlotGem ?? "1") !== "0";
}

function getGemSlotForParent(parentSlotId) {
  return SLOT_DEFS.find((slot) => slot.source === "gem" && slot.parentSlotId === parentSlotId) || null;
}

function isGemSlotUnlocked(slot) {
  if (!slot || slot.source !== "gem") return false;
  const parentItem = equipped[slot.parentSlotId];
  return Boolean(parentItem && canEquipmentSlotGem(parentItem));
}

function clearLinkedGemSlot(parentSlotId) {
  const gemSlot = getGemSlotForParent(parentSlotId);
  if (gemSlot) delete equipped[gemSlot.id];
}

function equipItemInSlot(item, slot) {
  if (!item || !slot || !isItemAllowedInSlot(item, slot)) return false;

  if (item.kind !== "gem") {
    Object.keys(equipped).forEach((slotId) => {
      if (equipped[slotId] && getItemKey(equipped[slotId]) === getItemKey(item)) {
        delete equipped[slotId];
      }
    });
  }

  equipped[slot.id] = item;

  if (slot.source === "equipment" && !canEquipmentSlotGem(item)) {
    clearLinkedGemSlot(slot.id);
  }

  selectedTileKey = "";
  saveBuilderState();
  refreshBuilderPanels();
  return true;
}

function isEquipped(key) {
  return Object.values(equipped).some((item) => item?.kind !== "gem" && getItemKey(item) === key);
}

function getFilteredEquipmentPool() {
  return equipmentPool.filter((item) => currentTypeFilter === "all" || item.type === currentTypeFilter);
}

function getComposeAttrs(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith("https://empire-html5.goodgamestudios.com/default/assets/itemassets/")) return "";
  const composed = deriveCompanionUrls(imageUrl);
  return ` data-compose-asset="1" data-image-url="${escapeHtml(composed.imageUrl)}" data-json-url="${escapeHtml(composed.jsonUrl)}" data-js-url="${escapeHtml(composed.jsUrl)}"`;
}

function getCachedComposedImage(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith("https://empire-html5.goodgamestudios.com/default/assets/itemassets/")) return null;
  const composed = deriveCompanionUrls(imageUrl);
  const cacheKey = `${composed.imageUrl}|${composed.jsonUrl}|${composed.jsUrl}`;
  return composedImageCache.get(cacheKey) || null;
}

function renderItemImage(item) {
  const cached = getCachedComposedImage(item.imageUrl);
  const src = cached || item.imageUrl;
  const composeAttrs = cached ? ' data-compose-ready="1"' : getComposeAttrs(item.imageUrl);
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(item.name)}" loading="lazy"${composeAttrs}>`;
}

function getSlotPlaceholderImage(slot) {
  return SLOT_PLACEHOLDER_IMAGES[slot.type] || SLOT_PLACEHOLDER_FALLBACK;
}

function renderSlotPlaceholder(slot) {
  const label = getEquipmentSlotTypeLabel(slot.labelKey);
  return `
    <img class="slot-placeholder-image"
      src="${escapeHtml(getSlotPlaceholderImage(slot))}"
      alt="${escapeHtml(label)}"
      title="${escapeHtml(label)}"
      loading="lazy"
      onerror="this.onerror=null;this.src='${escapeHtml(SLOT_PLACEHOLDER_FALLBACK)}';">
  `;
}

function renderSlots() {
  return SLOT_DEFS.map((slot) => {
    const item = equipped[slot.id] || null;
    const selected = selectedTileKey ? equipmentPool.find((x) => getItemKey(x) === selectedTileKey) : null;
    const stateClass = selected && isItemAllowedInSlot(selected, slot) ? "can-place" : "";
    const lockedClass = slot.source === "gem" && !isGemSlotUnlocked(slot) ? "is-locked" : "";
    const itemHtml = item ? renderItemImage(item) : renderSlotPlaceholder(slot);
    return `
      <button type="button" class="equip-slot slot-${escapeHtml(slot.id)} ${item ? "has-item" : ""} ${stateClass} ${lockedClass}" data-slot-id="${slot.id}" aria-label="${escapeHtml(getEquipmentSlotTypeLabel(slot.labelKey))}">
        ${itemHtml}
      </button>
    `;
  }).join("");
}

function renderEquipmentTiles() {
  const rows = getFilteredEquipmentPool().map((item) => {
    const key = getItemKey(item);
    const selectedClass = key === selectedTileKey ? "is-selected" : "";
    const equippedClass = isEquipped(key) ? "is-equipped" : "";
    return `
      <button type="button" class="equipment-tile ${selectedClass} ${equippedClass}" data-item-key="${escapeHtml(key)}" title="${escapeHtml(item.name)}">
        ${renderItemImage(item)}
      </button>
    `;
  }).join("");

  return rows || `<div class="builder-empty">${escapeHtml(selectedSetIds.length
    ? ui("no_equipment", "No equipment matches the current filters.")
    : ui("select_sets_for_equipment", "Select sets to see equipment.")
  )}</div>`;
}

function openItemDetailModal(item) {
  if (!item) return;
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.dataset.rewardDetail = "1";
  trigger.dataset.rewardType = item.kind === "gem" ? "gem" : "equipment";
  trigger.dataset.rewardId = item.id || "";
  trigger.dataset.rewardName = item.name || "";
  trigger.dataset.rewardAmount = "1";
  trigger.dataset.rewardImage = item.imageUrl || "";
  trigger.style.display = "none";
  document.body.appendChild(trigger);
  trigger.click();
  trigger.remove();
}

function buildStats() {
  const totals = new Map();
  const selectedItems = Object.values(equipped).filter(Boolean);

  const addToken = (token) => {
    const effectDef = effectCtx?.effectDefinitions?.[String(token.id)] || {};
    const argId = String(token.argId || "").trim();
    const key = `${token.id}::${argId}`;
    const previous = totals.get(key);
    if (!previous) {
      totals.set(key, {
        id: String(token.id),
        argId: argId || null,
        value: Number(token.value || 0),
        effectTypeID: String(effectDef.effectTypeID || "other"),
        sortOrder: String(effectDef.sortOrder || "999")
      });
      return;
    }
    previous.value += Number(token.value || 0);
  };

  selectedItems.forEach((item) => {
    parseEffectTokens(item.raw.effects, item.sourceType, item).forEach(addToken);
  });

  const uniqueItemsBySet = {};
  selectedItems.forEach((item) => {
    uniqueItemsBySet[item.setId] ||= new Set();
    uniqueItemsBySet[item.setId].add(getItemKey(item));
  });

  Object.entries(uniqueItemsBySet).forEach(([setId, items]) => {
    const count = items.size;
    const setEntry = setIndexById[String(setId)];
    (setEntry?.bonuses || []).forEach((bonus) => {
      if (Number(bonus.neededItems || 0) <= count) {
        parseEffectTokens(bonus.effects, "set_bonus").forEach(addToken);
      }
    });
  });

  const dedupedByRenderedText = new Map();
  Array.from(totals.values())
    .filter((entry) => Number(entry.value || 0) !== 0)
    .forEach((entry) => {
      const renderedText = getEffectText(entry.id, entry.value, entry.argId)
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (!dedupedByRenderedText.has(renderedText)) {
        dedupedByRenderedText.set(renderedText, entry);
      }
    });

  return Array.from(dedupedByRenderedText.values());
}

function getEffectTypeLabel(effectTypeID) {
  const normalized = String(effectTypeID || "").trim();
  const typeDef = getEffectTypeDef(normalized);
  if (!typeDef) return `Effect type ${normalized}`;

  return getEffectGroupLabel(typeDef, 0, false);
}

function getEffectGroupLabel(typeDef, value = 0, active = true) {
  if (!typeDef) return "";

  const prefix = `effect_group_${typeDef.sortCategory}_${typeDef.sortGroup}`.toLowerCase();
  const template = gameText([
    active && value < 0 ? `${prefix}_active_malus` : "",
    active ? `${prefix}_active` : "",
    `${prefix}_passive`
  ].filter(Boolean), `Effect group ${typeDef.sortCategory}.${typeDef.sortGroup}`);

  const valueText = formatLocalizedNumber(value);
  return template
    .replace(/\{0\}/g, valueText)
    .replace(/\{1\}/g, "")
    .replace(/\{2\}/g, "")
    .replace(/\{\d+\}/g, "")
    .replace(/\s+/g, " ")
    .replace(/\+\+/g, "+")
    .replace(/--/g, "-")
    .replace(/%%/g, "%")
    .trim();
}

function getEffectGroupKey(entry) {
  const typeDef = getEffectTypeDef(entry.effectTypeID);
  if (!typeDef) return `other:${entry.effectTypeID}`;
  return `${typeDef.sortCategory || "other"}:${typeDef.sortGroup || entry.effectTypeID}`;
}

function getCappedStatValue(entry) {
  const value = Number(entry?.value || 0);
  const def = effectCtx?.effectDefinitions?.[String(entry?.id)];
  const capId = String(def?.capID || "");
  const cap = Number(effectCtx?.effectCapsMap?.[capId]?.maxTotalBonus);
  if (!Number.isFinite(cap) || cap <= 0) return value;
  if (value > cap) return cap;
  if (value < -cap) return -cap;
  return value;
}

function getEffectTypeDef(effectTypeID) {
  const normalized = String(effectTypeID || "").trim();
  return effectCtx?.effectTypes?.find((x) => String(x.effectTypeID) === normalized) || null;
}

function getEffectCategory(entry) {
  const typeDef = getEffectTypeDef(entry.effectTypeID);
  const rawCategory = String(typeDef?.sortCategory || entry.effectTypeID || "other").trim();
  return rawCategory || "other";
}

function getEffectCategoryLabel(categoryId) {
  const normalized = String(categoryId || "").trim();
  if (!normalized || normalized === "other") return ui("other_effects", "Other effects");
  return gameText(`effect_category_${normalized}`, `Effect category ${normalized}`);
}

function renderStats() {
  const stats = buildStats();
  if (!stats.length) return `<div class="builder-empty">${escapeHtml(ui("no_stats", "Equip items to see stats."))}</div>`;

  const groups = new Map();
  stats.forEach((entry) => {
    const key = getEffectCategory(entry);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });

  return Array.from(groups.entries())
    .sort((a, b) => Number(a[0] || 999) - Number(b[0] || 999))
    .map(([categoryId, rows]) => {
      rows.sort((a, b) => {
        const typeA = getEffectTypeDef(a.effectTypeID);
        const typeB = getEffectTypeDef(b.effectTypeID);
        const groupDiff = Number(typeA?.sortGroup || 0) - Number(typeB?.sortGroup || 0);
        if (groupDiff !== 0) return groupDiff;
        return compareSortOrder(a.sortOrder, b.sortOrder) || Number(a.id || 0) - Number(b.id || 0);
      });

      const effectGroups = new Map();
      rows.forEach((row) => {
        const key = getEffectGroupKey(row);
        if (!effectGroups.has(key)) effectGroups.set(key, []);
        effectGroups.get(key).push(row);
      });

      const statRows = Array.from(effectGroups.entries()).map(([effectGroupKey, groupRows]) => {
        if (groupRows.length === 1) {
          const row = groupRows[0];
          return `
            <div class="stat-row stat-row-single" title="${escapeHtml(getEffectTypeLabel(row.effectTypeID))}">
              <span>${escapeHtml(getEffectText(row.id, row.value, row.argId))}</span>
            </div>
          `;
        }

        const typeDef = getEffectTypeDef(groupRows[0].effectTypeID);
        const groupValue = groupRows.reduce((sum, row) => sum + getCappedStatValue(row), 0);
        const stateKey = `${categoryId}:${effectGroupKey}`;
        const openAttr = statsEffectGroupOpenState.get(stateKey) === true ? " open" : "";
        return `
          <details class="stat-effect-group" data-effect-group-key="${escapeHtml(stateKey)}"${openAttr}>
            <summary class="stat-effect-group-title">
              <span>${escapeHtml(getEffectGroupLabel(typeDef, groupValue, true))}</span>
            </summary>
            <div class="stat-effect-group-body">
              ${groupRows.map((row) => `
                <div class="stat-row stat-row-child">
                  <span>${escapeHtml(getEffectText(row.id, row.value, row.argId))}</span>
                </div>
              `).join("")}
            </div>
          </details>
        `;
      }).join("");

      return `
        <section class="stat-category stat-category-${escapeHtml(categoryId)}">
          <div class="stat-category-title">
            <span>${escapeHtml(getEffectCategoryLabel(categoryId))}</span>
          </div>
          <div class="stat-category-body">
            ${statRows}
          </div>
        </section>
      `;
    }).join("");
}

function renderSetFilterList() {
  const options = getFilteredSetOptions(currentWearerFilter);
  const selectedCount = selectedSetIds.length;

  return `
    <div class="set-filter-list">
      ${options.map((entry) => `
        <label class="set-filter-row">
          <span>${escapeHtml(`#${entry.id} - ${entry.title}`)}</span>
          <input type="checkbox"
            ${selectedSetIds.includes(String(entry.id)) ? "checked" : ""}
            ${!selectedSetIds.includes(String(entry.id)) && selectedCount >= MAX_SELECTED_SETS ? "disabled" : ""}
            data-toggle-set="${escapeHtml(entry.id)}">
        </label>
      `).join("") || `
        <div class="builder-empty">
          ${escapeHtml(ui("no_sets", "No sets found for this filter."))}
        </div>
      `}
    </div>
  `;
}

function renderSetFilters() {
  const filteredWearers = wearerOptions.filter((wearer) => {
    const rawName = String(wearer.rawName || "").toLowerCase();
    return rawName.includes("baron") || rawName.includes("general");
  });

  return `
    <div class="panel-filter-row set-filter-controls">
      <select id="wearerSelect" class="form-select custom-select text-center" aria-label="Wearer selector">
        ${filteredWearers.map((wearer) => `
          <option value="${escapeHtml(wearer.value)}" ${wearer.value === currentWearerFilter ? "selected" : ""}>
            ${escapeHtml(wearer.label)}
          </option>
        `).join("")}
      </select>
      <div class="input-group">
        <input id="setSearchInput" class="form-control custom-input text-center" type="search"
          value="${escapeHtml(currentSetSearchText)}"
          placeholder="${escapeHtml(getSetSearchPlaceholder())}" aria-label="Search sets">
      </div>
    </div>
    ${renderSetFilterList()}
  `;
}

function renderTypeFilter() {
  const seen = new Map([["all", ui("all_types", "All equipment types")]]);
  equipmentPool.forEach((item) => {
    if (!seen.has(item.type)) seen.set(item.type, item.typeLabel);
  });

  if (!seen.has(currentTypeFilter)) currentTypeFilter = "all";

  return `
    <div class="panel-filter-row">
      <select id="typeFilter" class="form-select custom-select text-center" aria-label="Equipment type filter">
        ${Array.from(seen.entries()).map(([value, label]) => `
          <option value="${escapeHtml(value)}" ${value === currentTypeFilter ? "selected" : ""}>${escapeHtml(label)}</option>
        `).join("")}
      </select>
    </div>
  `;
}

function renderBuilder() {
  const root = document.getElementById("builderRoot");
  if (!root) return;
  captureStatsEffectGroupState(root);
  applyMobileBuilderViewClass(root);

  const scrollState = {
    filters: root.querySelector(".filters-panel .panel-body")?.scrollTop || 0,
    equipment: root.querySelector(".equipment-grid")?.scrollTop || 0,
    stats: root.querySelector(".stats-panel .panel-body")?.scrollTop || 0
  };

  root.innerHTML = `
    <section class="builder-panel equipment-panel">
      <div class="panel-head panel-head-with-action">
        <span>${escapeHtml(gameText("dialog_equipment_title", "Equipment"))}</span>
        <button type="button"
          class="panel-icon-button panel-text-button ${upgradeToggleEnabled ? "is-active" : ""}"
          data-upgrade-toggle
          aria-pressed="${upgradeToggleEnabled ? "true" : "false"}"
          aria-label="Toggle upgrade mode">
          ${escapeHtml(gameText("event_title_46", "Technicus"))}
        </button>
      </div>
      <div class="panel-body equipment-board">
        ${renderTypeFilter()}
        <div class="equipment-grid">${renderEquipmentTiles()}</div>
      </div>
    </section>
    <section class="builder-panel loadout-panel">
      <div class="panel-head panel-head-with-action">
        <span>${escapeHtml(ui("your_set", "Your set"))}</span>
        <button type="button" class="panel-icon-button" data-clear-loadout>
          <i class="bi bi-trash"></i>
        </button>
      </div>
      <div class="panel-body">
        <div class="slot-board">${renderSlots()}</div>
      </div>
    </section>
    <section class="builder-panel filters-panel">
      <div class="panel-head">${escapeHtml(ui("select_owned_sets", "Select owned sets"))}</div>
      <div class="panel-body">${renderSetFilters()}</div>
    </section>
    <section class="builder-panel stats-panel">
      <div class="panel-head">${escapeHtml(ui("grouped_stats", "Grouped stats"))}</div>
      <div class="panel-body stats-groups">${renderStats()}</div>
    </section>
  `;

  void hydrateComposedImages({
    root,
    selector: 'img[data-compose-asset="1"]:not([data-compose-ready])',
    cache: composedImageCache
  });

  const filtersBody = root.querySelector(".filters-panel .panel-body");
  const equipmentGrid = root.querySelector(".equipment-grid");
  const statsBody = root.querySelector(".stats-panel .panel-body");
  if (filtersBody) filtersBody.scrollTop = scrollState.filters;
  if (equipmentGrid) equipmentGrid.scrollTop = scrollState.equipment;
  if (statsBody) statsBody.scrollTop = scrollState.stats;
  setupStatsAccordion(root);
  updateMobileBuilderViewButtons();
}

function hydrateBuilderImages(root) {
  void hydrateComposedImages({
    root,
    selector: 'img[data-compose-asset="1"]:not([data-compose-ready])',
    cache: composedImageCache,
    onApplied: (img, cached, imageUrl) => {
      const jsonUrl = img.dataset.jsonUrl;
      const jsUrl = img.dataset.jsUrl;
      if (imageUrl && jsonUrl && jsUrl) {
        composedImageCache.set(`${imageUrl}|${jsonUrl}|${jsUrl}`, cached);
      }
    }
  });
}

function updateSetFilterCheckboxStates() {
  const selectedCount = selectedSetIds.length;
  document.querySelectorAll("[data-toggle-set]").forEach((input) => {
    const setId = String(input.dataset.toggleSet || "");
    const checked = selectedSetIds.includes(setId);
    input.checked = checked;
    input.disabled = !checked && selectedCount >= MAX_SELECTED_SETS;
  });
}

function refreshSetFilterList() {
  const list = document.querySelector(".filters-panel .set-filter-list");
  if (!list) return;
  const replacement = document.createElement("div");
  replacement.innerHTML = renderSetFilterList().trim();
  list.replaceWith(replacement.firstElementChild);
}

function captureStatsEffectGroupState(root) {
  root.querySelectorAll(".stat-effect-group[data-effect-group-key]").forEach((details) => {
    statsEffectGroupOpenState.set(String(details.dataset.effectGroupKey || ""), details.hasAttribute("open"));
  });
}

function setupStatsAccordion(root) {
  root.querySelectorAll(".stat-effect-group").forEach((details) => {
    const summary = details.querySelector(".stat-effect-group-title");
    const body = details.querySelector(".stat-effect-group-body");
    if (!summary || !body || summary.dataset.accordionBound) return;
    summary.dataset.accordionBound = "1";

    summary.addEventListener("click", (event) => {
      event.preventDefault();

      const isOpen = details.hasAttribute("open");
      if (isOpen) {
        statsEffectGroupOpenState.set(String(details.dataset.effectGroupKey || ""), false);
        const startHeight = body.scrollHeight;
        body.style.height = `${startHeight}px`;
        body.offsetHeight;
        body.style.height = "0px";
        details.classList.add("is-closing");
        window.setTimeout(() => {
          details.removeAttribute("open");
          details.classList.remove("is-closing");
          body.style.height = "";
        }, 170);
        return;
      }

      details.setAttribute("open", "");
      statsEffectGroupOpenState.set(String(details.dataset.effectGroupKey || ""), true);
      body.style.height = "0px";
      body.offsetHeight;
      body.style.height = `${body.scrollHeight}px`;
      window.setTimeout(() => {
        body.style.height = "";
      }, 170);
    });
  });
}

function refreshBuilderPanels({ updateFilters = false } = {}) {
  const root = document.getElementById("builderRoot");
  if (!root) return;

  const equipmentBody = root.querySelector(".equipment-panel .panel-body");
  if (equipmentBody) {
    const equipmentScroll = root.querySelector(".equipment-grid")?.scrollTop || 0;
    equipmentBody.innerHTML = `${renderTypeFilter()}<div class="equipment-grid">${renderEquipmentTiles()}</div>`;
    const equipmentGrid = root.querySelector(".equipment-grid");
    if (equipmentGrid) equipmentGrid.scrollTop = equipmentScroll;
  }

  const loadoutBody = root.querySelector(".loadout-panel .panel-body");
  if (loadoutBody) {
    loadoutBody.innerHTML = `<div class="slot-board">${renderSlots()}</div>`;
  }

  const statsBody = root.querySelector(".stats-panel .panel-body");
  if (statsBody) {
    const statsScroll = statsBody.scrollTop || 0;
    captureStatsEffectGroupState(statsBody);
    statsBody.innerHTML = renderStats();
    statsBody.scrollTop = statsScroll;
  }

  if (updateFilters) {
    updateSetFilterCheckboxStates();
  }

  hydrateBuilderImages(root);
  setupStatsAccordion(root);
}

function applyMobileBuilderViewClass(root = document.getElementById("builderRoot")) {
  if (!root) return;
  root.classList.remove("mobile-view-build", "mobile-view-sets", "mobile-view-stats");
  root.classList.add(`mobile-view-${currentMobileBuilderView}`);
}

function getMobileBuilderViewOptions() {
  return [
    ["sets", ui("select_owned_sets", "Select owned sets")],
    ["build", ui("your_set", "Your set")],
    ["stats", ui("grouped_stats", "Grouped stats")]
  ];
}

function updateMobileBuilderViewButtons() {
  const select = document.getElementById("mobileBuilderViewSelect");
  if (!select) return;
  select.innerHTML = getMobileBuilderViewOptions().map(([value, label]) => `
    <option value="${escapeHtml(value)}" ${value === currentMobileBuilderView ? "selected" : ""}>${escapeHtml(label)}</option>
  `).join("");
}

function populateWearerOptions(wearers) {
  wearerOptions = wearers.map((wearer) => ({
    value: String(wearer.wearerID),
    label: getLocalizedWearerName(wearer.wearerID),
    rawName: String(wearer.name || "")
  }));
}

function applyWearerFilter() {
  const visibleOptions = getSetOptions(currentWearerFilter);
  const allowedIds = new Set(visibleOptions.map((entry) => String(entry.id)));
  selectedSetIds = selectedSetIds.filter((id) => allowedIds.has(String(id)));
  equipped = Object.fromEntries(Object.entries(equipped).filter(([, item]) => selectedSetIds.includes(String(item?.setId))));
  rebuildEquipmentPool();
  saveBuilderState();
  renderBuilder();
}

function bindControls() {
  document.addEventListener("dblclick", (event) => {
    const slotBtn = event.target.closest(".equip-slot");
    if (slotBtn) {
      const slotId = String(slotBtn.dataset.slotId || "");
      if (!equipped[slotId]) return;
      event.preventDefault();
      delete equipped[slotId];
      clearLinkedGemSlot(slotId);
      selectedTileKey = "";
      saveBuilderState();
      refreshBuilderPanels();
      return;
    }
  });

  document.addEventListener("click", (event) => {
    const setToggle = event.target.closest("[data-toggle-set]");
    if (setToggle) {
      const setId = String(setToggle.dataset.toggleSet || "");
      if (setToggle.checked && selectedSetIds.length >= MAX_SELECTED_SETS && !selectedSetIds.includes(setId)) {
        setToggle.checked = false;
        window.alert(ui("max_sets", "Maximum 5 selected sets."));
        return;
      }
      selectedSetIds = setToggle.checked
        ? [...new Set([...selectedSetIds, setId])].slice(0, MAX_SELECTED_SETS)
        : selectedSetIds.filter((id) => id !== setId);
      equipped = Object.fromEntries(Object.entries(equipped).filter(([, item]) => selectedSetIds.includes(String(item?.setId))));
      rebuildEquipmentPool();
      saveBuilderState();
      refreshBuilderPanels({ updateFilters: true });
      return;
    }

    const clearLoadout = event.target.closest("[data-clear-loadout]");
    if (clearLoadout) {
      equipped = {};
      selectedTileKey = "";
      saveBuilderState();
      refreshBuilderPanels();
      return;
    }

    const upgradeToggle = event.target.closest("[data-upgrade-toggle]");
    if (upgradeToggle) {
      upgradeToggleEnabled = !upgradeToggleEnabled;
      upgradeToggle.classList.toggle("is-active", upgradeToggleEnabled);
      upgradeToggle.setAttribute("aria-pressed", upgradeToggleEnabled ? "true" : "false");
      refreshBuilderPanels();
      return;
    }

    const tile = event.target.closest(".equipment-tile");
    if (tile) {
      const itemKey = String(tile.dataset.itemKey || "");
      const item = equipmentPool.find((entry) => getItemKey(entry) === itemKey);
      if (selectedTileKey === itemKey) {
        openItemDetailModal(item);
        return;
      }
      selectedTileKey = selectedTileKey === itemKey ? "" : itemKey;
      saveBuilderState();
      refreshBuilderPanels();
      return;
    }

    const slotBtn = event.target.closest(".equip-slot");
    if (slotBtn) {
      const slot = SLOT_DEFS.find((entry) => entry.id === slotBtn.dataset.slotId);
      const item = equipmentPool.find((entry) => getItemKey(entry) === selectedTileKey);
      equipItemInSlot(item, slot);
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target?.id === "mobileBuilderViewSelect") {
      currentMobileBuilderView = String(event.target.value || "build");
      applyMobileBuilderViewClass();
      handleAutoHeight(AUTO_HEIGHT_OPTIONS);
      return;
    }

    if (event.target?.id === "wearerSelect") {
      currentWearerFilter = String(event.target.value || "all");
      selectedTileKey = "";
      applyWearerFilter();
      return;
    }

    if (event.target?.id === "typeFilter") {
      currentTypeFilter = String(event.target.value || "all");
      selectedTileKey = "";
      saveBuilderState();
      refreshBuilderPanels();
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target?.id !== "setSearchInput") return;
    currentSetSearchText = String(event.target.value || "");
    saveBuilderState();
    refreshSetFilterList();
  });
}

initAutoHeight(AUTO_HEIGHT_OPTIONS);

async function init() {
  try {
    await coreInit({
      loader,
      itemLabel: "equipment builder",
      langCode: currentLanguage,
      normalizeNameFn: normalizeName,
      assets: {
        equipmentUniques: true,
        uniqueGems: true,
        currencies: true
      },
      onReady: async ({ lang: L, data, imageMaps, effectCtx: E }) => {
        lang = L;
        effectCtx = E;
        await loadOwnLang();
        sharedLangPack = await getSharedLanguagePack(currentLanguage);

        const equipments = getArray(data, ["equipments"]);
        const gems = getArray(data, ["gems"]);
        const setBonuses = getArray(data, ["equipment_sets", "equipmentSets"]);
        const equipmentEffects = getArray(data, ["equipment_effects", "equipmentEffects"]);
        const slots = getArray(data, ["equipment_slots", "equipmentSlots"]);
        const wearers = getArray(data, ["equipment_wearers", "equipmentWearers"]);
        const units = getArray(data, ["units"]);
        const effectTypes = getArray(data, ["effecttypes", "effectTypes"]);
        effectCtx.effectTypes = effectTypes;

        equipmentEffects.forEach((row) => {
          const equipmentEffectId = String(row?.equipmentEffectID || "").trim();
          const effectId = String(row?.effectID || "").trim();
          if (equipmentEffectId && effectId) equipmentEffectToEffectId[equipmentEffectId] = effectId;
          if (equipmentEffectId) equipmentEffectMetaById[equipmentEffectId] = row;
        });

        slotById = buildLookup(slots, "slotID");
        equipmentById = buildLookup(equipments, "equipmentID");
        gemsById = buildLookup(gems, "gemID");
        wearerById = buildLookup(wearers, "wearerID");
        unitsById = buildLookup(units, "wodID");
        equipmentUniqueImageUrlMap = imageMaps?.equipmentUniques || {};
        uniqueGemImageUrlMap = imageMaps?.uniqueGems || {};
        currencyImageUrlMap = imageMaps?.currencies || {};
        setIndexById = buildSetIndex({ equipments, gems, setBonuses });
        equipmentSets = Object.values(setIndexById);

        initRewardDetailModal({
          getContext: () => ({
            lang,
            equipmentById,
            gemsById,
            effectsById: effectCtx?.effectDefinitions || {},
            effectCapsMap: effectCtx?.effectCapsMap || {},
            percentEffectIDs: effectCtx?.percentEffectIDs || new Set(),
            equipmentEffectToEffectId,
            equipmentEffects,
            equipmentSlotsById: slotById,
            currentLanguage,
            equipmentUniqueImageUrlMap,
            uniqueGemImageUrlMap,
            currencyImageUrlMap
          })
        });

        initLanguageSelector({
          currentLanguage,
          lang,
          onSelect: () => location.reload()
        });

        bindControls();
        populateWearerOptions(wearers);
        restoreBuilderState();
        renderBuilder();

        if (!equipmentSets.length) {
          renderBuilder();
        }
      }
    });
  } catch (err) {
    console.error(err);
    loader.error("Something went wrong...", 30);
  }
}

init();
