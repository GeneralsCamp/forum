import { coreInit } from "../shared/CoreInit.mjs";
import { createLoader } from "../shared/LoadingService.mjs";
import { initLanguageSelector, getInitialLanguage } from "../shared/LanguageService.mjs";
import { handleAutoHeight } from "../shared/ResizeService.mjs";
import { deriveCompanionUrls } from "../shared/AssetComposer.mjs";
import { hydrateComposedImages } from "../shared/ComposeHydrator.mjs";
import { revealCard } from "../shared/CardReveal.mjs";
import { initRewardDetailModal } from "../shared/RewardDetailModal.mjs";
import { saveOverviewData, loadOverviewData } from "../shared/GameSettings.mjs";
import {
  createRewardResolver,
  normalizeName as sharedNormalizeName,
  getArray as sharedGetArray,
  buildLookup as sharedBuildLookup
} from "../shared/RewardResolver.mjs";

// --- GLOBAL VARIABLES ---
const OVERVIEW_NAME = "rift_event";
const loader = createLoader();
let currentLanguage = getInitialLanguage();
const composedRewardImageCache = new Map();
let ownLang = {};

function getRiftData() {
  return loadOverviewData(OVERVIEW_NAME) || {};
}

function updateRiftSetting(key, value) {
  const data = getRiftData();
  data[key] = value;
  saveOverviewData(OVERVIEW_NAME, data);
}

function updateRiftAutoHeight() {
  const content = document.getElementById("content");
  const battleLootRows = document.getElementById("battleLootRows");
  const battleLootSection = document.getElementById("battleLootSection");
  const battleMode = battleLootSection?.style.display !== "none";

  if (battleMode) {
    if (content) content.style.height = "";
    handleAutoHeight({
      contentSelector: "#battleLootRows",
      subtractSelectors: [".note", ".page-title"],
      extraOffset: 4
    });
    return;
  }

  if (battleLootRows) battleLootRows.style.height = "";
  handleAutoHeight({
    contentSelector: "#content",
    subtractSelectors: [".note", ".page-title"],
    extraOffset: 18
  });
}

window.addEventListener("resize", updateRiftAutoHeight);
window.addEventListener("DOMContentLoaded", updateRiftAutoHeight);

const state = {
  lang: {},
  items: null,
  raidEvents: [],
  raidBosses: [],
  raidBossLevels: [],
  raidBossStages: [],
  leaguetypeEvents: [],
  rewardsById: {},
  effectsById: {},
  effectTypesById: {},
  percentEffectIDs: new Set(),
  unitsById: {},
  lootBoxesById: {},
  constructionById: {},
  decorationsById: {},
  equipmentById: {},
  gemsById: {},
  lookSkinsById: {},
  currenciesById: {},
  offeringByCurrencyId: {},
  offeringByCurrencyName: {},
  rewardResolver: null,
  imageMaps: {}
};

// --- DATA HELPERS ---
function getArray(data, names) {
  return sharedGetArray(data, names);
}

function buildLookup(array, idKey) {
  return sharedBuildLookup(array, idKey);
}

function csv(value) {
  if (!value) return [];
  return String(value).split(",").map(x => x.trim()).filter(Boolean);
}

function parseIdAmountList(value) {
  if (!value) return [];
  return String(value)
    .split(/[#,]/)
    .map(token => token.trim())
    .filter(Boolean)
    .map(token => {
      const [idRaw, amountRaw] = token.split("+");
      const id = String(idRaw || "").trim();
      const amount = Number(amountRaw);
      return {
        id,
        amount: Number.isFinite(amount) ? amount : 1
      };
    })
    .filter(x => x.id);
}

function langValue(key) {
  if (!key) return null;
  return state.lang[key] || state.lang[String(key).toLowerCase()] || null;
}

function uiText(key, fallback) {
  const value = langValue(key);
  return value ? String(value) : fallback;
}

async function loadOwnLang() {
  try {
    const res = await fetch("./ownLang.json");
    ownLang = await res.json();
  } catch {
    ownLang = {};
  }
}

function ownText(key, fallback) {
  const lc = String(currentLanguage || "en").toLowerCase();
  const short = lc.split(/[-_]/)[0];
  return ownLang?.[lc]?.ui?.[key]
    || ownLang?.[short]?.ui?.[key]
    || ownLang?.en?.ui?.[key]
    || fallback;
}

function formatNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : String(value ?? "-");
}

function formatMinSec(value) {
  const totalSeconds = Number(value);
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return String(value ?? "-");
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatLangTemplate(template, value) {
  return String(template || "").replace("{0}", String(value ?? ""));
}

function getOfferingDisplayName(currency) {
  if (!currency) return "Offering";
  const key = `currency_name_${currency.Name}`.toLowerCase();
  return langValue(key) || currency.Name || currency.JSONKey || "Offering";
}

function buildOfferingLookups(data) {
  state.offeringByCurrencyId = {};
  state.offeringByCurrencyName = {};
  getArray(data, ["characters"]).forEach(character => {
    parseOfferingTombolas(character?.tombolas).forEach(row => {
      const currency = state.currenciesById[String(row.currencyId)];
      const offering = {
        currencyId: String(row.currencyId),
        tombolaId: String(row.tombolaId),
        name: getOfferingDisplayName(currency)
      };
      state.offeringByCurrencyId[offering.currencyId] = offering;
      [currency?.Name, currency?.assetName, currency?.JSONKey, offering.name]
        .filter(Boolean)
        .forEach(value => {
          state.offeringByCurrencyName[sharedNormalizeName(value)] = offering;
        });
    });
  });
}

function getOfferingForRewardEntry(entry) {
  if (entry?.type !== "currency") return null;
  const id = entry.id !== undefined && entry.id !== null ? String(entry.id) : "";
  if (id && state.offeringByCurrencyId[id]) return state.offeringByCurrencyId[id];
  const keys = [entry.addKeyName, entry.name].map(sharedNormalizeName).filter(Boolean);
  for (const key of keys) {
    if (state.offeringByCurrencyName[key]) return state.offeringByCurrencyName[key];
  }
  return null;
}

function mapOfferingEntry(entry, offering) {
  return {
    ...entry,
    name: entry.name || offering.name,
    type: "offering",
    id: offering.tombolaId,
    currencyId: offering.currencyId,
    addKeyName: entry.addKeyName || offering.name
  };
}

// --- NAME HELPERS ---
function resolveUnitName(id) {
  const unit = state.unitsById[String(id)];
  if (!unit) return `Unit ${id}`;
  const key = `${unit.type || unit.name || ""}_name`.toLowerCase();
  return langValue(key) || unit.type || unit.name || `Unit ${id}`;
}

function parseWallUnitsList(value) {
  return parseIdAmountList(value).map(entry => ({
    ...entry,
    name: resolveUnitName(entry.id)
  }));
}

function buildOverviewUnitItem(unit) {
  return {
    type: "unit",
    id: unit.id,
    name: unit.name,
    amount: unit.amount
  };
}

function unitCardsHtml(units) {
  if (!units || units.length === 0) {
    return `<div class="filter-empty-message">${ownText("no_units", "No units")}</div>`;
  }

  return units.map(unit => {
    const item = buildOverviewUnitItem(unit);
    const imageUrl = imageUrlFor(item);
    const tooltipName = resolveUnitTooltipName(item);
    const imageHtml = imageUrl
      ? `<img class="item-image" loading="lazy" alt="${item.name || ownText("unit", "Unit")}" src="${imageUrl}">`
      : `<div class="item-fallback">${ownText("unit", "Unit").toLowerCase()}</div>`;
    const displayAmount = unit.displayAmount ?? formatNumber(unit.amount);
    return `
      <div class="item-card"
        data-reward-detail="1"
        data-reward-type="unit"
        data-reward-id="${item.id || ""}"
        data-reward-name="${tooltipName}"
        data-reward-amount="${item.amount ?? ""}"
        data-reward-image="${imageUrl || ""}"
        data-name="${tooltipName}"
        title="${tooltipName}">
        <div class="item-image-wrap">
          ${imageHtml}
        </div>
        <div class="item-amount">${displayAmount}</div>
      </div>
    `;
  }).join("");
}

function resolveUnitTooltipName(entry) {
  const baseName = String(entry?.name || ownText("unit", "Unit")).trim();
  if (/\((lvl|level)\.?/i.test(baseName)) return baseName;

  const unit = state.unitsById[String(entry?.id ?? "")];
  const levelRaw = unit?.level ?? unit?.Level ?? unit?.lvl ?? unit?.Lvl;
  if (levelRaw === undefined || levelRaw === null || String(levelRaw).trim() === "") {
    return baseName;
  }

  return `${baseName} (lvl.${levelRaw})`;
}

function isMeadLikeName(value) {
  return String(value || "").trim().toLowerCase() === "mead";
}

function prettifyEffectName(rawName) {
  const map = {
    raidBossWallBonus: "Wall Bonus",
    raidBossGateBonus: "Gate Bonus",
    DefenseBoostFront: "Front Defense Boost",
    DefenseBoostFlank: "Flank Defense Boost",
    defenseBoostYard: "Courtyard Defense Boost"
  };
  if (map[rawName]) return map[rawName];
  return String(rawName || "Effect")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}

function resolveEffectName(effectId) {
  const effect = state.effectsById[String(effectId)];
  const rawName = String(effect?.name || "").trim();
  if (!rawName) return `Effect ${effectId}`;

  const key = rawName.toLowerCase();
  const candidates = [
    `effect_name_${key}`,
    `effect_name_${rawName}`,
    `ci_effect_${key}`,
    `ci_effect_${rawName}`,
    `equip_effect_description_${rawName}`,
    `equip_effect_description_${key}`,
    `effect_description_${key}`,
    rawName,
    key
  ];

  for (const langKey of candidates) {
    const label = langValue(langKey);
    if (!label) continue;
    const cleaned = String(label)
      .replace(/\{[^}]+\}/g, "")
      .replace(/[+%]/g, "")
      .replace(/^\s*-\s*/, "")
      .replace(/^of\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  }

  return prettifyEffectName(rawName);
}

function parseBattleEffects(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map(token => token.trim())
    .filter(Boolean)
    .map(token => {
      const [idRaw, amountRaw] = token.split("&");
      const id = String(idRaw || "").trim();
      const amount = Number(amountRaw);
      return {
        id,
        amount: Number.isFinite(amount) ? amount : 0
      };
    })
    .filter(x => x.id)
    .map(effect => {
      const label = resolveEffectName(effect.id);
      return {
        ...effect,
        label
      };
    });
}

function parseSimpleIdList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map(token => String(token || "").trim())
    .filter(Boolean);
}

function getBossEffectSummary(stage) {
  const summary = {
    wallProtection: 0,
    gateProtection: 0,
    frontDefense: 0,
    flankDefense: 0,
    courtyardDefense: 0,
    rangedAttackStrength: 0,
    meleeAttackStrength: 0,
    isWallRegen: false,
    infectionBase: 0,
    infectionMelee: 0,
    infectionRange: 0,
    infectionWall: 0,
    infectionCourtyard: 0,
    infectionBaseId: null,
    infectionMeleeId: null,
    infectionRangeId: null,
    infectionWallId: null,
    infectionCourtyardId: null
  };

  const effects = parseBattleEffects(stage?.defenderBattleEffects);
  effects.forEach(effect => {
    const effectName = String(state.effectsById[String(effect.id)]?.name || "").trim();
    const value = Number(effect.amount) || 0;
    if (effectName === "raidBossWallBonus") summary.wallProtection = value;
    if (effectName === "raidBossGateBonus") summary.gateProtection = value;
    if (effectName === "DefenseBoostFront") summary.frontDefense = value;
    if (effectName === "DefenseBoostFlank") summary.flankDefense = value;
    if (effectName === "defenseBoostYard") summary.courtyardDefense = value;
  });

  const attackerEffects = parseBattleEffects(stage?.attackerBattleEffects);
  attackerEffects.forEach(effect => {
    const effectId = String(effect.id);
    const effectName = String(state.effectsById[String(effect.id)]?.name || "").trim();
    const value = Number(effect.amount) || 0;
    if (effectId === "432" || effectName === "offensiveRangeMalus") summary.rangedAttackStrength = value;
    if (effectId === "433" || effectName === "offensiveMeleeMalus") summary.meleeAttackStrength = value;
  });

  const postEffects = parseBattleEffects(stage?.attackerPostBattleEffects);
  postEffects.forEach(effect => {
    const effectName = String(state.effectsById[String(effect.id)]?.name || "").trim();
    const value = Number(effect.amount) || 0;
    if (effectName === "infectionRateBaseBonus") {
      summary.infectionBase = value;
      summary.infectionBaseId = effect.id;
    }
    if (effectName === "infectionRateMeleeBonus") {
      summary.infectionMelee = value;
      summary.infectionMeleeId = effect.id;
    }
    if (effectName === "infectionRateRangeBonus") {
      summary.infectionRange = value;
      summary.infectionRangeId = effect.id;
    }
    if (effectName === "infectionRateWallBonus") {
      summary.infectionWall = value;
      summary.infectionWallId = effect.id;
    }
    if (effectName === "infectionRateCourtyardBonus") {
      summary.infectionCourtyard = value;
      summary.infectionCourtyardId = effect.id;
    }
  });

  const highlightIds = parseSimpleIdList(stage?.HighlightEffectIcon);
  summary.isWallRegen = highlightIds.some(id => {
    const effectName = String(state.effectsById[String(id)]?.name || "").trim();
    return String(id) === "444" || effectName === "raidBossWallRegeneration";
  });

  return summary;
}

function effectGroupLabel(effectId, fallback) {
  if (!effectId) return fallback;
  const effect = state.effectsById[String(effectId)];
  let sortCategory = effect?.sortCategory ?? effect?.sortcategory;
  let sortGroup = effect?.sortGroup ?? effect?.sortgroup;
  if (sortCategory === undefined || sortGroup === undefined) {
    const typeId = effect?.effectTypeID ?? effect?.effecttypeid;
    const effectType = typeId !== undefined && typeId !== null
      ? state.effectTypesById[String(typeId)]
      : null;
    sortCategory = effectType?.sortCategory ?? effectType?.sortcategory;
    sortGroup = effectType?.sortGroup ?? effectType?.sortgroup;
  }
  if (sortCategory === undefined || sortGroup === undefined) return fallback;
  const key = `effect_group_${sortCategory}_${sortGroup}_passive`;
  return langValue(key) || fallback;
}

function parseSpawnReserveUnits(stage) {
  const totalsByUnitId = {};

  const collect = (value) => {
    if (!value) return;

    csv(value).forEach(token => {
      const [effectIdRaw, payloadRaw] = String(token).split("&");
      const effectId = String(effectIdRaw || "").trim();
      const effectName = String(state.effectsById[effectId]?.name || "").trim();
      const isSpawnReserve =
        effectId === "465" ||
        effectName === "spawnReserveUnit" ||
        effectName.startsWith("spawnReserveUnit");

      if (!isSpawnReserve || !payloadRaw) return;

      String(payloadRaw)
        .split("#")
        .map(part => String(part || "").trim())
        .filter(Boolean)
        .forEach(part => {
          const [unitIdRaw, amountRaw] = part.split("+");
          const unitId = String(unitIdRaw || "").trim();
          const amount = Number(amountRaw);
          if (!unitId || !Number.isFinite(amount) || amount <= 0) return;
          totalsByUnitId[unitId] = (totalsByUnitId[unitId] || 0) + amount;
        });
    });
  };

  collect(stage?.defenderWallRegenerationEffects);
  collect(stage?.defenderStageEffects);

  return Object.entries(totalsByUnitId)
    .map(([id, amount]) => ({
      id,
      amount,
      name: resolveUnitName(id)
    }))
    .sort((a, b) => Number(b.amount) - Number(a.amount));
}

function parseDefenderMutationEffects(stage) {
  const mutationsByUnitId = {};

  csv(stage?.defenderPostBattleEffects).forEach(token => {
    const [effectIdRaw, payloadRaw] = String(token).split("&");
    const effectId = String(effectIdRaw || "").trim();
    const effectName = String(state.effectsById[effectId]?.name || "").trim().toLowerCase();
    const isMutationEffect =
      effectId === "488" ||
      effectName.includes("mutation");

    if (!isMutationEffect || !payloadRaw) return;

    String(payloadRaw)
      .split("#")
      .map(part => String(part || "").trim())
      .filter(Boolean)
      .forEach(part => {
        const [unitIdRaw, percentRaw] = part.split("+");
        const unitId = String(unitIdRaw || "").trim();
        const percent = Number(percentRaw);
        if (!unitId || !Number.isFinite(percent) || percent <= 0) return;
        mutationsByUnitId[unitId] = {
          percent
        };
      });
  });

  return mutationsByUnitId;
}

function buildMutationUnits(stage) {
  const mutationEffects = parseDefenderMutationEffects(stage);
  return Object.entries(mutationEffects)
    .map(([id, mutation]) => ({
      id,
      amount: 1,
      displayAmount: `${formatNumber(mutation.percent)}%`,
      percent: mutation.percent,
      name: resolveUnitName(id)
    }))
    .sort((a, b) => Number(a.id) - Number(b.id));
}

function getMutationSectionTitle(stage) {
  let title = "";

  csv(stage?.defenderPostBattleEffects).some(token => {
    const [effectIdRaw, payloadRaw] = String(token).split("&");
    const effectId = String(effectIdRaw || "").trim();
    const effectName = String(state.effectsById[effectId]?.name || "").trim();
    const isMutationEffect =
      effectId === "488" ||
      effectName.toLowerCase().includes("mutation") ||
      effectName.toLowerCase().includes("mutate");

    if (!isMutationEffect || !payloadRaw || !effectName) return false;

    title =
      langValue(`dialog_are_highlightedeffect_name_${effectName}`) ||
      resolveEffectName(effectId);
    return !!title;
  });

  return title || ownText("mutation", "Mutation");
}

function reserveAndMutationHtml(spawnReserveUnits, mutationUnits, reserveUnitsLabel, stage) {
  if (spawnReserveUnits.length === 0) return "";

  const reserveCard = `
    <article class="boss-overview-card boss-overview-reserve-card">
      <h3 class="boss-overview-heading">${reserveUnitsLabel}</h3>
      <div class="item-grid boss-overview-item-grid">${unitCardsHtml(spawnReserveUnits)}</div>
    </article>
  `;

  if (!mutationUnits.length) {
    return reserveCard;
  }

  return `
    <div class="boss-overview-reserve-slot">
      ${reserveCard}
      <article class="boss-overview-card boss-overview-mutation-card">
        <h3 class="boss-overview-heading">${getMutationSectionTitle(stage)}</h3>
        <div class="item-grid boss-overview-item-grid">${unitCardsHtml(mutationUnits)}</div>
      </article>
    </div>
  `;
}

function getSpawnReserveEffectId(stage) {
  let foundId = null;

  const collect = (value) => {
    if (!value || foundId) return;

    csv(value).some(token => {
      const [effectIdRaw, payloadRaw] = String(token).split("&");
      const effectId = String(effectIdRaw || "").trim();
      const effectName = String(state.effectsById[effectId]?.name || "").trim();
      const isSpawnReserve =
        effectId === "465" ||
        effectName === "spawnReserveUnit" ||
        effectName.startsWith("spawnReserveUnit");

      if (isSpawnReserve && payloadRaw) {
        foundId = effectId;
        return true;
      }

      return false;
    });
  };

  collect(stage?.defenderWallRegenerationEffects);
  collect(stage?.defenderStageEffects);

  return foundId;
}

function getSpawnReserveLabel(stage) {
  const effectId = getSpawnReserveEffectId(stage);
  const effectName = effectId
    ? String(state.effectsById[String(effectId)]?.name || "").trim()
    : "";

  if (effectName) {
    const label = langValue(`dialog_are_highlightedeffect_name_${effectName}`);
    if (label) return label;
  }

  return (
    langValue("dialog_are_highlightedeffect_name_spawnReserveUnit") ||
    "Reserve Units Added"
  );
}

// --- REWARD MAPPING ---
function mapRewardToEntries(reward) {
  if (!reward) {
    return [{ name: ownText("unknown_reward", "Unknown reward"), amount: 1, type: null, id: null, addKeyName: null }];
  }

  const entries = [];

  if (state.rewardResolver) {
    const resolved = state.rewardResolver.resolveRewardEntries(reward) || [];
    resolved.forEach(item => {
      const name = String(item?.name || "").trim();
      const addKeyName = item?.addKeyName || null;
      if (isMeadLikeName(name) || isMeadLikeName(addKeyName)) return;
      const offering = getOfferingForRewardEntry(item);
      const detailItem = offering ? mapOfferingEntry(item, offering) : item;

      entries.push({
        name: name || `${ownText("reward", "Reward")} ${reward.rewardID || "?"}`,
        amount: Number(detailItem?.amount) || 1,
        type: detailItem?.type || null,
        id: detailItem?.id ?? null,
        addKeyName: detailItem?.addKeyName || addKeyName,
        currencyId: detailItem?.currencyId || null
      });
    });
  }

  if (reward.units) {
    const manualUnitEntries = parseIdAmountList(reward.units).map(item => ({
      name: resolveUnitName(item.id),
      amount: Number(item.amount) || 1,
      type: "unit",
      id: item.id,
      addKeyName: null
    }));

    if (manualUnitEntries.length > 0) {
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].type === "unit") entries.splice(i, 1);
      }
      manualUnitEntries.forEach(item => entries.push(item));
    }
  }

  if (entries.length > 0) {
    return entries;
  }

  if (state.rewardResolver) {
    const fallbackName = state.rewardResolver.resolveRewardName(reward) || `${ownText("reward", "Reward")} ${reward.rewardID || "?"}`;
    const fallbackAddKey = state.rewardResolver.getAddKeyName(reward) || null;
    if (!isMeadLikeName(fallbackName) && !isMeadLikeName(fallbackAddKey)) {
      const fallbackEntry = {
        name: fallbackName,
        amount: state.rewardResolver.getRewardAmount(reward) || 1,
        type: state.rewardResolver.resolveRewardType(reward),
        id: state.rewardResolver.resolveRewardIdStrict(reward),
        addKeyName: fallbackAddKey
      };
      const offering = getOfferingForRewardEntry(fallbackEntry);
      return [offering ? mapOfferingEntry(fallbackEntry, offering) : fallbackEntry];
    }
  }

  return [];
}

// --- IMAGE HELPERS ---
function imageUrlFor(entry) {
  if (!state.rewardResolver || !entry) return null;
  if (entry.type === "decoration") return state.rewardResolver.getDecorationImageUrl(entry);
  if (entry.type === "construction") return state.rewardResolver.getConstructionImageUrl(entry);
  if (entry.type === "equipment") return state.rewardResolver.getEquipmentImageUrl(entry) || "../../img_base/equipment.png";
  if (entry.type === "gem") return state.imageMaps.uniqueGems?.[String(entry.id)] || "../../img_base/placeholder.webp";
  if (entry.type === "unit") return state.rewardResolver.getUnitImageUrl(entry);
  if (entry.type === "lootbox") return state.rewardResolver.getLootBoxImageUrl(entry);
  if (entry.type === "offering") return state.rewardResolver.getCurrencyImageUrl(entry);
  if (entry.type === "currency") return state.rewardResolver.getCurrencyImageUrl(entry);
  return null;
}

function parseOfferingTombolas(value) {
  return String(value || "")
    .split("#")
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const [currencyId, tombolaId] = item.split("+").map(part => part.trim());
      return currencyId && tombolaId ? { currencyId, tombolaId } : null;
    })
    .filter(Boolean);
}

function supportsRewardDetail(entry) {
  const type = String(entry?.type || "").toLowerCase();
  return ["lootbox", "loot_box", "offering", "unit", "troop", "tool", "decoration", "construction", "equipment", "gem"].includes(type);
}

function selectedRiftId() {
  return document.getElementById("riftSelect").value;
}

function selectedRift() {
  return state.raidBosses.find(x => String(x.raidBossID) === String(selectedRiftId())) || null;
}

// --- RIFT / ROW BUILDERS ---
function normalizeBossName(rawName, bossId) {
  const base = String(rawName || "").trim();
  const langName = langValue(`are_boss_name_${base}`);
  if (langName) return String(langName).trim();
  return base || `Rift ${bossId}`;
}

function buildBossRows(boss) {
  const levels = state.raidBossLevels
    .filter(row => String(row.raidBossID) === String(boss?.raidBossID || ""))
    .sort((a, b) => Number(a.level) - Number(b.level));

  const rows = [];

  for (const level of levels) {
    const rewardIds = csv(level.rewardIDs);
    const items = [];

    rewardIds.forEach(rewardId => {
      const reward = state.rewardsById[String(rewardId)];
      mapRewardToEntries(reward).forEach(entry => items.push(entry));
    });

    const levelLabel = langValue("level") || "Level";
    rows.push({
      title: `${levelLabel} ${level.level} (${formatNumber(level.minPointsForBossRewards)})`,
      meta: "",
      items: items.length > 0 ? items : [{ name: ownText("no_rewards", "No rewards"), amount: 1, type: null, id: null, addKeyName: null }]
    });
  }

  return rows;
}

function getBattleLootTombolaIds(boss) {
  const tombolaIds = [...new Set(
    state.raidBossLevels
      .filter(row => String(row.raidBossID) === String(boss?.raidBossID || ""))
      .map(row => String(row.lootBoxTombolaID || "").trim())
      .filter(Boolean)
  )];
  return tombolaIds;
}

function resolveBattleRewardItems(reward) {
  if (!reward) return [];

  const resourceDefinitions = [
    ["wood", "wood", "Wood", "../../img_base/wood.png"],
    ["stone", "stone", "Stone", "../../img_base/stone.png"],
    ["food", "food", "Food", "../../img_base/food.png"],
    ["mead", "mead", "Mead", "../../img_base/meadwastage.png"],
    ["beef", "beef", "Beef", "../../img_base/beefwastage.png"],
    ["currency1", "currency_name_currency1", "Coins", "../../img_base/coin.png"]
  ];

  const resources = resourceDefinitions
    .filter(([field]) => Number(reward[field] || 0) > 0)
    .map(([field, gameLangKey, fallback, imageUrl]) => ({
      name: langValue(gameLangKey) || fallback,
      amount: Number(reward[field]),
      imageUrl,
      type: field,
      id: null
    }));
  if (resources.length > 0) return resources;

  const gemIds = reward.gemIDs ?? reward.gemIds ?? reward.gemids;
  if (gemIds) {
    const rewardGemAmount = Number(reward.gemAmount ?? reward.gemamount);
    return parseIdAmountList(gemIds).map(parsed => {
      const id = String(parsed.id);
      const gem = state.gemsById[id];
      const imageId = String(gem?.reuseAssetOfGemID || id);

      return {
        name:
          langValue(`gem_unique_${id}`)
          || gem?.comment2
          || gem?.comment1
          || `Gem ${id}`,
        amount: Number.isFinite(rewardGemAmount) && rewardGemAmount > 0
          ? rewardGemAmount
          : parsed.amount,
        imageUrl:
          state.imageMaps.uniqueGems?.[imageId]
          || state.imageMaps.uniqueGems?.[id]
          || "../../img_base/placeholder.webp",
        type: "gem",
        id
      };
    });
  }

  return mapRewardToEntries(reward).map(item => ({
    ...item,
    imageUrl: imageUrlFor(item)
  }));
}

function buildBattleLootTableRows(boss) {
  const tombolaIds = new Set(getBattleLootTombolaIds(boss));
  const entries = getArray(state.items, ["lootBoxTombolas", "lootboxtombolas"])
    .filter(entry => tombolaIds.has(String(entry.tombolaID || "")));
  const totalShares = entries.reduce((sum, entry) => sum + Number(entry.shares || 0), 0);

  return entries
    .map(entry => {
      const rewardIds = csv(entry.rewardIDs);
      const items = rewardIds.flatMap(rewardId =>
        resolveBattleRewardItems(state.rewardsById[String(rewardId)])
      );
      const shares = Number(entry.shares || 0);
      return {
        entryId: String(entry.entryID || ""),
        items,
        shares,
        chance: totalShares > 0 ? (shares / totalShares) * 100 : 0
      };
    })
    .filter(row => row.items.length > 0)
    .sort((a, b) => b.shares - a.shares || Number(a.entryId) - Number(b.entryId));
}

function hasBattleLootData() {
  const tombolaIds = new Set(
    state.raidBossLevels
      .map(row => String(row.lootBoxTombolaID || "").trim())
      .filter(Boolean)
  );
  if (tombolaIds.size === 0) return false;

  return getArray(state.items, ["lootBoxTombolas", "lootboxtombolas"])
    .some(entry => tombolaIds.has(String(entry.tombolaID || "")));
}

function getLevelEntriesForBoss(boss) {
  return state.raidBossLevels
    .filter(row => String(row.raidBossID) === String(boss?.raidBossID || ""))
    .sort((a, b) => Number(a.level) - Number(b.level));
}

function getStagesForLevel(levelId) {
  return state.raidBossStages
    .filter(row => String(row.raidBossLevelID) === String(levelId || ""))
    .sort((a, b) => Number(a.raidBossStageID) - Number(b.raidBossStageID));
}

function populateStageSelect(stageSelect, stages) {
  const bossStageLabel = ownText("boss_stage", "Boss stage");
  stageSelect.innerHTML = "";
  stages.forEach((_, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${bossStageLabel} ${index}`;
    stageSelect.appendChild(option);
  });
  stageSelect.disabled = stages.length === 0;
}

function updateBossOverviewFilters() {
  const boss = selectedRift();
  const levelSelect = document.getElementById("bossLevelSelect");
  const stageSelect = document.getElementById("bossStageSelect");
  if (!levelSelect || !stageSelect) return;

  const levels = getLevelEntriesForBoss(boss);
  const savedData = getRiftData();
  const savedLevelId = savedData.level_id;
  const savedStageIndex = savedData.stage_id;
  const levelLabel = uiText("level", "Level");

  levelSelect.innerHTML = "";
  levels.forEach(level => {
    const option = document.createElement("option");
    option.value = String(level.raidBossLevelID);
    option.textContent = `${levelLabel} ${level.level}`;
    levelSelect.appendChild(option);
  });

  if (levels.length === 0) {
    levelSelect.disabled = true;
    stageSelect.innerHTML = `<option value="">${ownText("boss_stage", "Boss stage")}</option>`;
    stageSelect.disabled = true;
    return;
  }

  levelSelect.disabled = false;
  if (savedLevelId && levels.some(x => String(x.raidBossLevelID) === String(savedLevelId))) {
    levelSelect.value = String(savedLevelId);
  } else {
    levelSelect.value = String(levels[0].raidBossLevelID);
  }

  const selectedLevelId = levelSelect.value;
  const stages = getStagesForLevel(selectedLevelId);
  populateStageSelect(stageSelect, stages);

  if (stages.length === 0) {
    updateRiftSetting("stage_id", null);
  } else {
    const parsed = Number(savedStageIndex);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed < stages.length) {
      stageSelect.value = String(parsed);
    } else {
      stageSelect.value = "0";
    }
  }
}

function renderBossOverview() {
  const root = document.getElementById("bossOverviewRows");
  if (!root) return;

  const boss = selectedRift();
  const levelId = document.getElementById("bossLevelSelect")?.value || "";
  const stageIndex = Number(document.getElementById("bossStageSelect")?.value || "0");

  if (!boss || !levelId) {
    root.innerHTML = `<div class="filter-empty-message rift-empty-message">${ownText("no_boss_overview_data", "No boss overview data found")}</div>`;
    return;
  }

  const level = state.raidBossLevels.find(x => String(x.raidBossLevelID) === String(levelId));
  const stageRows = getStagesForLevel(levelId);
  const stage = stageRows[stageIndex];

  if (!level || !stage) {
    root.innerHTML = `<div class="filter-empty-message rift-empty-message">${ownText("no_boss_overview_data", "No boss overview data found")}</div>`;
    return;
  }

  const valueTrue = ownText("true", "True");
  const valueFalse = ownText("false", "False");
  const effectSummary = getBossEffectSummary(stage);

  const leftUnits = parseWallUnitsList(stage.leftWallUnits);
  const frontUnits = parseWallUnitsList(stage.frontWallUnits);
  const rightUnits = parseWallUnitsList(stage.rightWallUnits);
  const courtyardUnits = parseWallUnitsList(level.courtyardReserveUnits);
  const spawnReserveUnits = parseSpawnReserveUnits(stage);
  const mutationUnits = buildMutationUnits(stage);
  const unitsLabel = uiText("units", "Units");
  const reserveUnitsLabel = getSpawnReserveLabel(stage);
  const leftFlankLabel = uiText("dialog_defence_leftFlank", "Left flank");
  const frontLabel = uiText("dialog_defence_middleFlank", "Front");
  const rightFlankLabel = uiText("dialog_defence_rightFlank", "Right flank");
  const courtyardLabel = uiText("dialog_defence_courtyard", "Courtyard");
  const bossEffectsTitle = ownText("boss_effects", uiText("dialog_are_boss_effect_title", "Boss effects"));
  const wallRegenTimeLabel = ownText("wall_regeneration_time", "Wall regeneration time");
  const wallRegenStageStartLabel = ownText("wall_regeneration_stage_start", "Wall reload at stage start");
  const courtyardSizeLabel = uiText(
    "unitsInCourtyard_limit_player",
    ownText("courtyard_unit_size", "Courtyard unit size")
  );
  const bossStatsLabel = ownText("boss_stats", "Boss Stats");
  const healthLabel = ownText("health", "Health");
  const courtyardMeleeRatioLabel = ownText("courtyard_melee_ratio", "Courtyard Melee Ratio");
  const infectionBaseLabel = effectGroupLabel(effectSummary.infectionBaseId, "Infection rate (base)");
  const infectionMeleeLabel = effectGroupLabel(effectSummary.infectionMeleeId, "Infection rate (melee)");
  const infectionRangeLabel = effectGroupLabel(effectSummary.infectionRangeId, "Infection rate (range)");
  const infectionWallLabel = effectGroupLabel(effectSummary.infectionWallId, "Infection rate (wall)");
  const infectionCourtyardLabel = effectGroupLabel(effectSummary.infectionCourtyardId, "Infection rate (courtyard)");

  root.innerHTML = `
    <div class="boss-overview-grid">
      <article class="boss-overview-card boss-overview-meta">
        <h3 class="boss-overview-heading">${bossStatsLabel}</h3>
        <div class="boss-overview-stats">
          <div class="boss-overview-stat">
            <span class="boss-overview-stat-key">${healthLabel}</span>
            <span class="boss-overview-stat-value">${formatNumber(stage.health)}%</span>
          </div>
          <div class="boss-overview-stat">
            <span class="boss-overview-stat-key">${wallRegenTimeLabel}</span>
            <span class="boss-overview-stat-value">${formatMinSec(level.wallRegenerationTime)}</span>
          </div>
          <div class="boss-overview-stat">
            <span class="boss-overview-stat-key">${courtyardSizeLabel}</span>
            <span class="boss-overview-stat-value">${formatNumber(level.courtyardSize)}</span>
          </div>
          <div class="boss-overview-stat">
            <span class="boss-overview-stat-key">${courtyardMeleeRatioLabel}</span>
            <span class="boss-overview-stat-value">${formatNumber(level.courtyardMeleePercent)}%</span>
          </div>
        </div>
      </article>

      <article class="boss-overview-card boss-overview-effects-card">
        <h3 class="boss-overview-heading">${bossEffectsTitle}</h3>
        <div class="boss-overview-effects">
          ${[
      {
        title: ownText("wall_protection", "Wall protection"),
        icon: "../../img_base/battle_simulator/wall-icon.png",
        value: `${formatNumber(effectSummary.wallProtection)}%`,
        valueNum: Number(effectSummary.wallProtection) || 0
      },
      {
        title: ownText("gate_protection", "Gate protection"),
        icon: "../../img_base/battle_simulator/gate-icon.png",
        value: `${formatNumber(effectSummary.gateProtection)}%`,
        valueNum: Number(effectSummary.gateProtection) || 0
      },
      {
        title: ownText("courtyard_defense", "Courtyard defense"),
        icon: "../../img_base/battle_simulator/cy-icon.png",
        value: `${formatNumber(effectSummary.courtyardDefense)}%`,
        valueNum: Number(effectSummary.courtyardDefense) || 0
      },
      {
        title: ownText("flank_defense", "Flank defense"),
        icon: "../../img_base/battle_simulator/flanks-strength.png",
        value: `${formatNumber(effectSummary.flankDefense)}%`,
        valueNum: Number(effectSummary.flankDefense) || 0
      },
      {
        title: ownText("front_defense", "Front defense"),
        icon: "../../img_base/battle_simulator/front-strength.png",
        value: `${formatNumber(effectSummary.frontDefense)}%`,
        valueNum: Number(effectSummary.frontDefense) || 0
      },
      {
        title: resolveEffectName(432),
        icon: "../../img_base/battle_simulator/ranged-icon.png",
        value: `${formatNumber(effectSummary.rangedAttackStrength)}%`,
        valueNum: Number(effectSummary.rangedAttackStrength) || 0
      },
      {
        title: resolveEffectName(433),
        icon: "../../img_base/battle_simulator/melee-icon.png",
        value: `${formatNumber(effectSummary.meleeAttackStrength)}%`,
        valueNum: Number(effectSummary.meleeAttackStrength) || 0
      },
      {
        title: wallRegenStageStartLabel,
        icon: "../../img_base/time.png",
        value: effectSummary.isWallRegen ? valueTrue : valueFalse,
        hideIfZero: false
      },
      {
        title: infectionBaseLabel,
        icon: "../../img_base/placeholder.webp",
        value: `${formatNumber(effectSummary.infectionBase)}%`,
        valueNum: Number(effectSummary.infectionBase) || 0
      },
      {
        title: infectionMeleeLabel,
        icon: "../../img_base/placeholder.webp",
        value: `${formatNumber(effectSummary.infectionMelee)}%`,
        valueNum: Number(effectSummary.infectionMelee) || 0
      },
      {
        title: infectionRangeLabel,
        icon: "../../img_base/placeholder.webp",
        value: `${formatNumber(effectSummary.infectionRange)}%`,
        valueNum: Number(effectSummary.infectionRange) || 0
      },
      {
        title: infectionWallLabel,
        icon: "../../img_base/placeholder.webp",
        value: `${formatNumber(effectSummary.infectionWall)}%`,
        valueNum: Number(effectSummary.infectionWall) || 0
      },
      {
        title: infectionCourtyardLabel,
        icon: "../../img_base/placeholder.webp",
        value: `${formatNumber(effectSummary.infectionCourtyard)}%`,
        valueNum: Number(effectSummary.infectionCourtyard) || 0
      }
    ]
      .filter(effect => effect.hideIfZero === false || (effect.valueNum ?? 0) !== 0)
      .map(effect => `
            <div class="boss-overview-stat boss-overview-effect-stat">
              <span class="boss-effect-icon-wrap">
                <img src="${effect.icon}" alt="${effect.title}" class="boss-effect-icon" loading="lazy">
              </span>
              <span class="boss-effect-name">${effect.title}</span>
              <span class="boss-overview-stat-value">${effect.value}</span>
            </div>
          `).join("")}
        </div>
      </article>

      <article class="boss-overview-card">
        <h3 class="boss-overview-heading">${leftFlankLabel} ${unitsLabel}</h3>
        <div class="item-grid boss-overview-item-grid">${unitCardsHtml(leftUnits)}</div>
      </article>

      <article class="boss-overview-card">
        <h3 class="boss-overview-heading">${frontLabel} ${unitsLabel}</h3>
        <div class="item-grid boss-overview-item-grid">${unitCardsHtml(frontUnits)}</div>
      </article>

      <article class="boss-overview-card">
        <h3 class="boss-overview-heading">${rightFlankLabel} ${unitsLabel}</h3>
        <div class="item-grid boss-overview-item-grid">${unitCardsHtml(rightUnits)}</div>
      </article>

      <article class="boss-overview-card">
        <h3 class="boss-overview-heading">${courtyardLabel} ${unitsLabel}</h3>
        <div class="item-grid boss-overview-item-grid">${unitCardsHtml(courtyardUnits)}</div>
      </article>

      ${reserveAndMutationHtml(spawnReserveUnits, mutationUnits, reserveUnitsLabel, stage)}
    </div>
  `;
}

// --- UI RENDERING ---
function renderCardRows(containerId, rows, emptyText) {
  const root = document.getElementById(containerId);
  root.innerHTML = "";

  if (!rows || rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "filter-empty-message rift-empty-message";
    empty.textContent = emptyText;
    root.appendChild(empty);
    return;
  }

  rows.forEach(row => {
    const col = document.createElement("div");
    col.className = "reward-col";

    const card = document.createElement("div");
    card.className = "reward-card";

    const title = document.createElement("div");
    title.className = "reward-title";
    title.textContent = row.title;

    const meta = document.createElement("div");
    meta.className = "badge-line";
    meta.textContent = row.meta || "";

    const grid = document.createElement("div");
    grid.className = "item-grid";

    row.items.forEach(item => {
      const itemCard = document.createElement("div");
      itemCard.className = "item-card";
      const tooltipName = item?.type === "unit"
        ? resolveUnitTooltipName(item)
        : (item.name || "Reward");
      itemCard.dataset.name = tooltipName;
      itemCard.title = tooltipName;

      const imageWrap = document.createElement("div");
      imageWrap.className = "item-image-wrap";

      const imageUrl = imageUrlFor(item);
      if (supportsRewardDetail(item)) {
        itemCard.dataset.rewardDetail = "1";
        itemCard.dataset.rewardType = item?.type || "";
        itemCard.dataset.rewardId = item?.id || "";
        itemCard.dataset.rewardName = item?.name || "";
        itemCard.dataset.rewardAmount = item?.amount ?? "";
        if (imageUrl) itemCard.dataset.rewardImage = imageUrl;
      }
      if (imageUrl) {
        const img = document.createElement("img");
        img.className = "item-image";
        img.loading = "lazy";
        img.alt = item.name || "Reward";
        img.src = imageUrl;

        const shouldCompose =
          (item.type === "decoration" || item.type === "construction" || item.type === "equipment") &&
          typeof imageUrl === "string" &&
          imageUrl.startsWith("https://empire-html5.goodgamestudios.com/default/assets/itemassets/") &&
          /\.(webp|png)$/i.test(imageUrl);

        if (shouldCompose) {
          const composed = deriveCompanionUrls(imageUrl);
          if (composed?.imageUrl && composed?.jsonUrl && composed?.jsUrl) {
            img.dataset.composeAsset = "1";
            img.dataset.imageUrl = composed.imageUrl;
            img.dataset.jsonUrl = composed.jsonUrl;
            img.dataset.jsUrl = composed.jsUrl;
          }
        }

        imageWrap.appendChild(img);
      } else {
        const fallback = document.createElement("div");
        fallback.className = "item-fallback";
        fallback.textContent = "item";
        imageWrap.appendChild(fallback);
      }

      const amount = document.createElement("div");
      amount.className = "item-amount";
      amount.textContent = formatNumber(item.amount ?? 1);

      itemCard.appendChild(imageWrap);
      itemCard.appendChild(amount);
      grid.appendChild(itemCard);
    });

    card.appendChild(title);
    if (row.meta) {
      card.appendChild(meta);
    }
    card.appendChild(grid);
    col.appendChild(card);
    root.appendChild(revealCard(col));
  });

  void hydrateComposedImages({
    root,
    cache: composedRewardImageCache
  });
}

function renderAll() {
  const boss = selectedRift();
  const noBossRewards = ownText("no_boss_rewards", "No boss rewards found");
  if (!boss) {
    renderCardRows("bossRows", [], noBossRewards);
    renderBattleLoot(null);
    renderBossOverview();
    return;
  }

  const bossRows = buildBossRows(boss);
  renderCardRows("bossRows", bossRows, noBossRewards);
  renderBattleLoot(boss);
  renderBossOverview();
}

function renderBattleLoot(boss) {
  const root = document.getElementById("battleLootRows");
  if (!root) return;
  root.innerHTML = "";

  const rows = boss ? buildBattleLootTableRows(boss) : [];
  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "filter-empty-message rift-empty-message";
    empty.textContent = ownText("no_battle_rewards", "No battle rewards found");
    root.appendChild(empty);
    return;
  }

  const labels = [
    langValue("reward") || "Reward",
    langValue("amount") || "Amount",
    ownText("battle_chance", "Chance")
  ];

  const wrap = document.createElement("div");
  wrap.className = "battle-loot-table-wrap";

  const headerWrap = document.createElement("div");
  headerWrap.className = "battle-loot-table-header";
  const headerTable = document.createElement("table");
  headerTable.className = "battle-loot-table";
  const tableHead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  labels.forEach(label => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    headerRow.appendChild(cell);
  });
  tableHead.appendChild(headerRow);
  headerTable.appendChild(tableHead);
  headerWrap.appendChild(headerTable);

  const scroll = document.createElement("div");
  scroll.className = "battle-loot-table-scroll";
  const bodyTable = document.createElement("table");
  bodyTable.className = "battle-loot-table";
  const tableBody = document.createElement("tbody");

  rows.forEach(row => {
    const rowEl = document.createElement("tr");

    const rewardCell = document.createElement("td");
    row.items.forEach(item => {
      const itemEl = document.createElement("div");
      itemEl.className = "battle-loot-name";

      if (item.imageUrl) {
        const image = document.createElement("img");
        image.className = "battle-loot-icon";
        image.src = item.imageUrl;
        image.alt = item.name || langValue("reward") || "Reward";
        image.loading = "lazy";

        const shouldCompose =
          typeof item.imageUrl === "string"
          && item.imageUrl.startsWith("https://empire-html5.goodgamestudios.com/default/assets/itemassets/")
          && /\.(webp|png)$/i.test(item.imageUrl);
        if (shouldCompose) {
          const composed = deriveCompanionUrls(item.imageUrl);
          if (composed?.imageUrl && composed?.jsonUrl && composed?.jsUrl) {
            image.dataset.composeAsset = "1";
            image.dataset.imageUrl = composed.imageUrl;
            image.dataset.jsonUrl = composed.jsonUrl;
            image.dataset.jsUrl = composed.jsUrl;
          }
        }

        itemEl.appendChild(image);
      }

      const name = document.createElement("span");
      name.textContent = item.name || ownText("unknown_reward", "Unknown reward");
      itemEl.appendChild(name);
      rewardCell.appendChild(itemEl);
    });

    const amountCell = document.createElement("td");
    amountCell.className = "battle-loot-value";
    amountCell.textContent = row.items
      .map(item => formatNumber(item.amount ?? 1))
      .join(" + ");

    const chanceCell = document.createElement("td");
    chanceCell.className = "battle-loot-value";
    chanceCell.textContent = `${row.chance.toLocaleString(currentLanguage, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}%`;

    rowEl.appendChild(rewardCell);
    rowEl.appendChild(amountCell);
    rowEl.appendChild(chanceCell);
    tableBody.appendChild(rowEl);
  });

  bodyTable.appendChild(tableBody);
  scroll.appendChild(bodyTable);
  wrap.appendChild(headerWrap);
  wrap.appendChild(scroll);
  root.appendChild(wrap);

  void hydrateComposedImages({
    root,
    cache: composedRewardImageCache
  });
}

// --- SELECTORS ---
function applyTypeSelection(type) {
  const bossSection = document.getElementById("bossSection");
  const battleLootSection = document.getElementById("battleLootSection");
  const bossOverviewSection = document.getElementById("bossOverviewSection");
  const bossLevelWrap = document.getElementById("bossLevelFilterWrap");
  const bossStageWrap = document.getElementById("bossStageFilterWrap");
  const mode =
    type === "boss_overview"
      ? "boss_overview"
      : type === "battle_loot"
        ? "battle_loot"
        : "boss";
  bossSection.style.display = mode === "boss" ? "" : "none";
  battleLootSection.style.display = mode === "battle_loot" ? "" : "none";
  bossOverviewSection.style.display = mode === "boss_overview" ? "" : "none";
  bossLevelWrap.style.display = mode === "boss_overview" ? "" : "none";
  bossStageWrap.style.display = mode === "boss_overview" ? "" : "none";
  document.documentElement.classList.toggle("battle-loot-mode", mode === "battle_loot");
  document.body.classList.toggle("battle-loot-mode", mode === "battle_loot");

  updateRiftSetting("type", mode);
  if (mode === "boss_overview") {
    renderBossOverview();
  }
  updateRiftAutoHeight();
}

function setupTypeSelector() {
  const typeSelect = document.getElementById("typeSelect");
  if (!typeSelect) return;
  ensureTypeOptions(typeSelect);
  const saved = getRiftData().type;
  if (saved === "boss" || saved === "boss_overview" || saved === "battle_loot") {
    typeSelect.value = saved;
  }
  if (!["boss", "boss_overview", "battle_loot"].includes(typeSelect.value)) {
    typeSelect.value = "boss_overview";
  }
  applyTypeSelection(typeSelect.value);
  typeSelect.disabled = false;
  typeSelect.addEventListener("change", () => {
    applyTypeSelection(typeSelect.value);
    renderAll();
  });
}

function getBossDefeatRewardFilterLabel() {
  const requestedLabel = String(
    langValue("dialog_are_bossdefeatreward_title") || ""
  ).trim();

  if (requestedLabel && !/\{\d+\}/.test(requestedLabel)) {
    return requestedLabel;
  }

  return langValue("dialog_reward_hub_are_reward_type")
    || ownText("boss_defeat_reward", "Boss defeat reward");
}

function ensureTypeOptions(typeSelect) {
  const battleLootAvailable = hasBattleLootData();
  const hasBoss = Array.from(typeSelect.options).some(opt => opt.value === "boss");
  const hasBossOverview = Array.from(typeSelect.options).some(opt => opt.value === "boss_overview");
  const hasBattleLoot = Array.from(typeSelect.options).some(opt => opt.value === "battle_loot");
  const expectedOptionCount = battleLootAvailable ? 3 : 2;
  if (
    hasBoss &&
    hasBossOverview &&
    hasBattleLoot === battleLootAvailable &&
    typeSelect.options.length === expectedOptionCount
  ) return;

  typeSelect.innerHTML = "";
  const bossOverview = document.createElement("option");
  bossOverview.value = "boss_overview";
  bossOverview.textContent = ownText("boss_overview", "Boss overview");
  const boss = document.createElement("option");
  boss.value = "boss";
  boss.textContent = getBossDefeatRewardFilterLabel();
  const battleLoot = document.createElement("option");
  battleLoot.value = "battle_loot";
  battleLoot.textContent = ownText("battle_rewards", "Battle rewards");
  typeSelect.appendChild(bossOverview);
  typeSelect.appendChild(boss);
  if (battleLootAvailable) {
    typeSelect.appendChild(battleLoot);
  }
}

function applyTypeLabelsFromLang() {
  const typeSelect = document.getElementById("typeSelect");
  if (!typeSelect) return;
  ensureTypeOptions(typeSelect);

  const bossLabel = getBossDefeatRewardFilterLabel();

  const bossOption = Array.from(typeSelect.options).find(
    opt => opt.value === "boss"
  );
  const bossOverviewOption = Array.from(typeSelect.options).find(
    opt => opt.value === "boss_overview"
  );
  const battleLootOption = Array.from(typeSelect.options).find(
    opt => opt.value === "battle_loot"
  );

  if (bossOption) bossOption.textContent = bossLabel;
  if (bossOverviewOption) {
    bossOverviewOption.textContent = ownText("boss_overview", "Boss overview");
  }
  if (battleLootOption) {
    battleLootOption.textContent = ownText("battle_rewards", "Battle rewards");
  }
}

function setupBossOverviewSelectors() {
  const levelSelect = document.getElementById("bossLevelSelect");
  const stageSelect = document.getElementById("bossStageSelect");
  if (!levelSelect || !stageSelect) return;

  updateBossOverviewFilters();

  levelSelect.addEventListener("change", () => {
    updateRiftSetting("level_id", levelSelect.value);
    const stages = getStagesForLevel(levelSelect.value);
    populateStageSelect(stageSelect, stages);
    if (stages.length > 0) {
      stageSelect.value = "0";
      updateRiftSetting("stage_id", stageSelect.value);
    } else {
      updateRiftSetting("stage_id", null);
    }
    renderBossOverview();
  });

  stageSelect.addEventListener("change", () => {
    updateRiftSetting("stage_id", stageSelect.value);
    renderBossOverview();
  });
}

function setupRiftSelector() {
  const select = document.getElementById("riftSelect");
  if (!select) return;
  select.innerHTML = "";

  const bosses = [...state.raidBosses].sort((a, b) => Number(a.raidBossID) - Number(b.raidBossID));

  bosses.forEach(boss => {
    const option = document.createElement("option");
    option.value = String(boss.raidBossID);
    option.textContent = normalizeBossName(boss.name, boss.raidBossID);
    select.appendChild(option);
  });

  const saved = getRiftData().boss_id;
  if (saved && bosses.some(x => String(x.raidBossID) === String(saved))) {
    select.value = saved;
  }

  select.addEventListener("change", () => {
    updateRiftSetting("boss_id", select.value);
    updateBossOverviewFilters();
    renderAll();
  });
  select.disabled = false;
}

// --- INITIALIZATION ---
async function init() {
  try {
    await coreInit({
      loader,
      itemLabel: "rift event",
      langCode: currentLanguage,
      normalizeNameFn: sharedNormalizeName,
      assets: {
        decorations: true,
        constructions: true,
        looks: true,
        units: true,
        currencies: true,
        equipmentUniques: true,
        uniqueGems: true,
        lootboxes: true
      },
      onReady: async ({ lang, data, imageMaps, effectCtx }) => {
        await loadOwnLang();
        state.lang = lang || {};
        state.items = data;
        state.imageMaps = imageMaps || {};

        state.raidEvents = (data.events || []).filter(e => String(e.eventType || "") === "AllianceRaidbossEvent");
        state.raidBosses = getArray(data, ["raidBosses", "raidbosses"]);
        state.raidBossLevels = getArray(data, ["raidBossLevels", "raidbosslevels"]);
        state.raidBossStages = getArray(data, ["raidBossStages", "raidbossstages"]);
        state.leaguetypeEvents = getArray(data, ["leaguetypeevents", "leagueTypeEvents", "leagueTypeevents"]);

        state.rewardsById = buildLookup(getArray(data, ["rewards"]), "rewardID");
        state.effectsById = buildLookup(getArray(data, ["effects"]), "effectID");
        state.effectTypesById = buildLookup(getArray(data, ["effecttypes", "effectTypes"]), "effectTypeID");
        state.percentEffectIDs = effectCtx?.percentEffectIDs || new Set();
        state.unitsById = buildLookup(getArray(data, ["units"]), "wodID");
        state.lootBoxesById = buildLookup(getArray(data, ["lootBoxes", "lootboxes"]), "lootBoxID");
        state.constructionById = buildLookup(getArray(data, ["constructionItems"]), "constructionItemID");
        state.decorationsById = buildLookup(getArray(data, ["buildings"]), "wodID");
        state.equipmentById = buildLookup(getArray(data, ["equipments"]), "equipmentID");
        state.gemsById = buildLookup(getArray(data, ["gems"]), "gemID");
        state.currenciesById = buildLookup(getArray(data, ["currencies"]), "currencyID");
        buildOfferingLookups(data);
        const skins = getArray(data, ["worldmapskins"]);
        state.lookSkinsById = {};
        skins.forEach(s => {
          if (s?.skinID !== undefined && s?.skinID !== null) {
            state.lookSkinsById[String(s.skinID)] = s.name;
          }
        });

        state.rewardResolver = createRewardResolver(
          () => ({
            lang: state.lang,
            currenciesById: state.currenciesById,
            equipmentById: state.equipmentById,
            gemsById: state.gemsById,
            constructionById: state.constructionById,
            decorationsById: state.decorationsById,
            buildings: getArray(state.items, ["buildings"]),
            unitsById: state.unitsById,
            lootBoxesById: state.lootBoxesById,
            lookSkinsById: state.lookSkinsById,
            decorationImageUrlMap: state.imageMaps.decorations || {},
            constructionImageUrlMap: state.imageMaps.constructions || {},
            equipmentImageUrlMap: state.imageMaps.looks || {},
            equipmentUniqueImageUrlMap: state.imageMaps.equipmentUniques || {},
            uniqueGemImageUrlMap: state.imageMaps.uniqueGems || {},
            unitImageUrlMap: state.imageMaps.units || {},
            currencyImageUrlMap: state.imageMaps.currencies || {},
            lootBoxImageUrlMap: state.imageMaps.lootboxes || {}
          }),
          {
            includeCurrency2: true,
            includeLootBox: true,
            includeUnitLevel: true,
            rubyImageUrl: "../../img_base/ruby.png"
          }
        );
        initRewardDetailModal({
          getContext: () => ({
            lang: state.lang,
            rewardResolver: state.rewardResolver,
            currenciesById: state.currenciesById,
            equipmentById: state.equipmentById,
            gemsById: state.gemsById,
            constructionById: state.constructionById,
            decorationsById: state.decorationsById,
            unitsById: state.unitsById,
            effectsById: state.effectsById,
            effectCapsMap: effectCtx?.effectCapsMap || {},
            effectTypesById: state.effectTypesById,
            percentEffectIDs: state.percentEffectIDs,
            equipmentEffects: getArray(state.items, ["equipment_effects", "equipmentEffects"]),
            equipmentSlotsById: buildLookup(getArray(state.items, ["equipment_slots", "equipmentSlots"]), "slotID"),
            currentLanguage,
            lootBoxesById: state.lootBoxesById,
            rewardsById: state.rewardsById,
            lootBoxTombolas: getArray(state.items, ["lootBoxTombolas", "lootboxtombolas"]),
            unitImageUrlMap: state.imageMaps.units || {},
            currencyImageUrlMap: state.imageMaps.currencies || {},
            lootBoxImageUrlMap: state.imageMaps.lootboxes || {},
            constructionImageUrlMap: state.imageMaps.constructions || {},
            equipmentImageUrlMap: state.imageMaps.looks || {},
            equipmentUniqueImageUrlMap: state.imageMaps.equipmentUniques || {},
            uniqueGemImageUrlMap: state.imageMaps.uniqueGems || {}
          })
        });

        setupRiftSelector();
        setupBossOverviewSelectors();
        applyTypeLabelsFromLang();
        setupTypeSelector();
        initLanguageSelector({
          currentLanguage,
          lang: state.lang,
          onSelect: () => location.reload()
        });
        renderAll();

        document.getElementById("rewardsViewport").hidden = false;
        updateRiftAutoHeight();
      }
    });
  } catch (err) {
    console.error(err);
    loader.error("Rift rewards load failed", 30);
  }
}

init();
