import { coreInit } from "../shared/CoreInit.mjs";
import { createLoader } from "../shared/LoadingService.mjs";
import { initLanguageSelector, getInitialLanguage } from "../shared/LanguageService.mjs";
import { initAutoHeight, handleAutoHeight } from "../shared/ResizeService.mjs";
import { deriveCompanionUrls } from "../shared/AssetComposer.mjs";
import { hydrateComposedImages } from "../shared/ComposeHydrator.mjs";
import {
  createRewardResolver,
  normalizeName as sharedNormalizeName,
  getArray as sharedGetArray,
  buildLookup as sharedBuildLookup
} from "../shared/RewardResolver.mjs";

// --- GLOBAL VARIABLES ---
const loader = createLoader();
let currentLanguage = getInitialLanguage();
const composedRewardImageCache = new Map();
let ownLang = {};

initAutoHeight({
  contentSelector: "#content",
  subtractSelectors: [".note", ".page-title"],
  extraOffset: 18
});

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
  unitsById: {},
  lootBoxesById: {},
  constructionById: {},
  equipmentById: {},
  lookSkinsById: {},
  currenciesById: {},
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
    return `<div class="boss-overview-empty">${ownText("no_units", "No units")}</div>`;
  }

  return units.map(unit => {
    const item = buildOverviewUnitItem(unit);
    const imageUrl = imageUrlFor(item);
    const tooltipName = resolveUnitTooltipName(item);
    const imageHtml = imageUrl
      ? `<img class="item-image" loading="lazy" alt="${item.name || ownText("unit", "Unit")}" src="${imageUrl}">`
      : `<div class="item-fallback">${ownText("unit", "Unit").toLowerCase()}</div>`;
    return `
      <div class="item-card" data-name="${tooltipName}" title="${tooltipName}">
        <div class="item-image-wrap">
          ${imageHtml}
        </div>
        <div class="item-amount">${formatNumber(unit.amount)}</div>
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
    isWallRegen: false
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

  const highlightIds = parseSimpleIdList(stage?.HighlightEffectIcon);
  summary.isWallRegen = highlightIds.some(id => {
    const effectName = String(state.effectsById[String(id)]?.name || "").trim();
    return String(id) === "444" || effectName === "raidBossWallRegeneration";
  });

  return summary;
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

      entries.push({
        name: name || `${ownText("reward", "Reward")} ${reward.rewardID || "?"}`,
        amount: Number(item?.amount) || 1,
        type: item?.type || null,
        id: item?.id ?? null,
        addKeyName
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
      return [{
        name: fallbackName,
        amount: state.rewardResolver.getRewardAmount(reward) || 1,
        type: state.rewardResolver.resolveRewardType(reward),
        id: state.rewardResolver.resolveRewardIdStrict(reward),
        addKeyName: fallbackAddKey
      }];
    }
  }

  return [];
}

// --- IMAGE HELPERS ---
function imageUrlFor(entry) {
  if (!state.rewardResolver || !entry) return null;
  if (entry.type === "decoration") return state.rewardResolver.getDecorationImageUrl(entry);
  if (entry.type === "construction") return state.rewardResolver.getConstructionImageUrl(entry);
  if (entry.type === "equipment") return state.rewardResolver.getEquipmentImageUrl(entry);
  if (entry.type === "unit") return state.rewardResolver.getUnitImageUrl(entry);
  if (entry.type === "lootbox") return state.rewardResolver.getLootBoxImageUrl(entry);
  if (entry.type === "currency") return state.rewardResolver.getCurrencyImageUrl(entry);
  return null;
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

function pickIndividualRewardSetForBoss(boss) {
  const leagueTypeId = String(boss?.leaguetypeID || "");
  const eventIds = new Set(state.raidEvents.map(e => String(e.eventID)));

  let rows = state.leaguetypeEvents.filter(row =>
    eventIds.has(String(row.eventID)) &&
    (!leagueTypeId || String(row.leaguetypeID) === leagueTypeId)
  );

  if (rows.length === 0) {
    rows = state.leaguetypeEvents.filter(row => eventIds.has(String(row.eventID)));
  }

  if (rows.length === 0) return null;

  rows.sort((a, b) => Number(b.rewardSetID || 0) - Number(a.rewardSetID || 0));
  return rows[0];
}

function buildIndividualRows(boss) {
  const source = pickIndividualRewardSetForBoss(boss);
  if (!source) return [];

  const points = csv(source.neededPointsForRewards);
  const rewardIds = csv(source.rewardIDs);
  const len = Math.min(points.length, rewardIds.length);
  const rows = [];

  for (let i = 0; i < len; i++) {
    const rewardId = rewardIds[i];
    const reward = state.rewardsById[String(rewardId)];
    const parsedEntries = mapRewardToEntries(reward);
    if (parsedEntries.length === 0) continue;
    const pointsLabelTemplate =
      langValue("dialog_are_activityreward_points") || "Collect {0} points";
    const pointsLabel = formatLangTemplate(pointsLabelTemplate, formatNumber(points[i]));
    rows.push({
      title: pointsLabel,
      meta: "",
      items: parsedEntries
    });
  }

  return rows;
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

function updateBossOverviewFilters() {
  const boss = selectedRift();
  const levelSelect = document.getElementById("bossLevelSelect");
  const stageSelect = document.getElementById("bossStageSelect");
  if (!levelSelect || !stageSelect) return;

  const levels = getLevelEntriesForBoss(boss);
  const savedLevelId = localStorage.getItem("rift_rewards_overview_level_id");
  const savedStageIndex = localStorage.getItem("rift_rewards_overview_stage_id");
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
  const stages = getStagesForLevel(selectedLevelId).slice(0, 6);
  const bossStageLabel = ownText("boss_stage", "Boss stage");

  stageSelect.innerHTML = "";
  stages.forEach((_, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${bossStageLabel} ${index}`;
    stageSelect.appendChild(option);
  });

  if (stages.length === 0) {
    stageSelect.disabled = true;
  } else {
    stageSelect.disabled = false;
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
    root.innerHTML = `<div class="reward-card"><div class="reward-title">${ownText("no_boss_overview_data", "No boss overview data found")}</div></div>`;
    return;
  }

  const level = state.raidBossLevels.find(x => String(x.raidBossLevelID) === String(levelId));
  const stageRows = getStagesForLevel(levelId).slice(0, 6);
  const stage = stageRows[stageIndex];

  if (!level || !stage) {
    root.innerHTML = `<div class="reward-card"><div class="reward-title">${ownText("no_boss_overview_data", "No boss overview data found")}</div></div>`;
    return;
  }

  const valueTrue = ownText("true", "True");
  const valueFalse = ownText("false", "False");
  const effectSummary = getBossEffectSummary(stage);

  const leftUnits = parseWallUnitsList(stage.leftWallUnits);
  const frontUnits = parseWallUnitsList(stage.frontWallUnits);
  const rightUnits = parseWallUnitsList(stage.rightWallUnits);
  const courtyardUnits = parseWallUnitsList(level.courtyardReserveUnits);
  const unitsLabel = uiText("units", "Units");
  const leftFlankLabel = uiText("dialog_defence_leftFlank", "Left flank");
  const frontLabel = uiText("dialog_defence_middleFlank", "Front");
  const rightFlankLabel = uiText("dialog_defence_rightFlank", "Right flank");
  const courtyardLabel = uiText("dialog_defence_courtyard", "Courtyard");
  const bossEffectsTitle = ownText("boss_effects", uiText("dialog_are_boss_effect_title", "Boss effects"));
  const wallRegenLabel = uiText(
    "dialog_are_highlightedeffect_name_raidBossWallRegeneration",
    ownText("wall_regeneration", "Wall regeneration")
  );
  const courtyardSizeLabel = uiText(
    "unitsInCourtyard_limit_player",
    ownText("courtyard_unit_size", "Courtyard unit size")
  );
  const bossStatsLabel = ownText("boss_stats", "Boss Stats");
  const healthLabel = ownText("health", "Health");
  const courtyardMeleeRatioLabel = ownText("courtyard_melee_ratio", "Courtyard Melee Ratio");

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
            <span class="boss-overview-stat-key">${wallRegenLabel}</span>
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
            { title: ownText("wall_protection", "Wall protection"), icon: "../../img_base/battle_simulator/wall-icon.png", value: `${formatNumber(effectSummary.wallProtection)}%` },
            { title: ownText("gate_protection", "Gate protection"), icon: "../../img_base/battle_simulator/gate-icon.png", value: `${formatNumber(effectSummary.gateProtection)}%` },
            { title: ownText("courtyard_defense", "Courtyard defense"), icon: "../../img_base/battle_simulator/cy-icon.png", value: `${formatNumber(effectSummary.courtyardDefense)}%` },
            { title: ownText("flank_defense", "Flank defense"), icon: "../../img_base/battle_simulator/flanks-strength.png", value: `${formatNumber(effectSummary.flankDefense)}%` },
            { title: ownText("front_defense", "Front defense"), icon: "../../img_base/battle_simulator/front-strength.png", value: `${formatNumber(effectSummary.frontDefense)}%` },
            { title: ownText("wall_regeneration", "Wall regeneration"), icon: "../../img_base/time.png", value: effectSummary.isWallRegen ? valueTrue : valueFalse }
          ].map(effect => `
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
    </div>
  `;
}

// --- UI RENDERING ---
function renderCardRows(containerId, rows, emptyText) {
  const root = document.getElementById(containerId);
  root.innerHTML = "";

  if (!rows || rows.length === 0) {
    const col = document.createElement("div");
    col.className = "reward-col";
    col.innerHTML = `<div class="reward-card"><div class="reward-title">${emptyText}</div></div>`;
    root.appendChild(col);
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
      const constructionId = item?.id !== undefined && item?.id !== null && String(item.id).trim() !== ""
        ? String(item.id)
        : null;
      const isConstructionLink = item?.type === "construction" && !!constructionId;
      const itemCard = document.createElement(isConstructionLink ? "a" : "div");
      itemCard.className = "item-card";
      if (isConstructionLink) {
        itemCard.classList.add("id-link");
        itemCard.href = `https://generalscamp.github.io/forum/overviews/building_items#${constructionId}`;
        itemCard.target = "_blank";
        itemCard.rel = "noopener";
      }
      const tooltipName = item?.type === "unit"
        ? resolveUnitTooltipName(item)
        : (item.name || "Reward");
      itemCard.dataset.name = tooltipName;
      itemCard.title = tooltipName;

      const imageWrap = document.createElement("div");
      imageWrap.className = "item-image-wrap";

      const imageUrl = imageUrlFor(item);
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
    root.appendChild(col);
  });

  void hydrateComposedImages({
    root,
    cache: composedRewardImageCache
  });
}

function renderAll() {
  const boss = selectedRift();
  const noIndividualRewards = ownText("no_individual_rewards", "No individual rewards found");
  const noBossRewards = ownText("no_boss_rewards", "No boss rewards found");
  if (!boss) {
    renderCardRows("individualRows", [], noIndividualRewards);
    renderCardRows("bossRows", [], noBossRewards);
    renderBossOverview();
    return;
  }

  const individualRows = buildIndividualRows(boss);
  const bossRows = buildBossRows(boss);
  renderCardRows("individualRows", individualRows, noIndividualRewards);
  renderCardRows("bossRows", bossRows, noBossRewards);
  renderBossOverview();
}

// --- SELECTORS ---
function applyTypeSelection(type) {
  const individualSection = document.getElementById("individualSection");
  const bossSection = document.getElementById("bossSection");
  const bossOverviewSection = document.getElementById("bossOverviewSection");
  const bossLevelWrap = document.getElementById("bossLevelFilterWrap");
  const bossStageWrap = document.getElementById("bossStageFilterWrap");
  const mode =
    type === "boss_overview"
      ? "boss_overview"
      : (type === "boss" ? "boss" : "individual");
  individualSection.style.display = mode === "individual" ? "" : "none";
  bossSection.style.display = mode === "boss" ? "" : "none";
  bossOverviewSection.style.display = mode === "boss_overview" ? "" : "none";
  bossLevelWrap.style.display = mode === "boss_overview" ? "" : "none";
  bossStageWrap.style.display = mode === "boss_overview" ? "" : "none";

  localStorage.setItem("rift_rewards_type", mode);
  if (mode === "boss_overview") {
    renderBossOverview();
  }
  handleAutoHeight({
    contentSelector: "#content",
    subtractSelectors: [".note", ".page-title"],
    extraOffset: 18
  });
}

function setupTypeSelector() {
  const typeSelect = document.getElementById("typeSelect");
  if (!typeSelect) return;
  ensureTypeOptions(typeSelect);
  const saved = localStorage.getItem("rift_rewards_type");
  if (saved === "boss" || saved === "individual" || saved === "boss_overview") {
    typeSelect.value = saved;
  }
  if (typeSelect.value !== "boss" && typeSelect.value !== "individual" && typeSelect.value !== "boss_overview") {
    typeSelect.value = "individual";
  }
  applyTypeSelection(typeSelect.value);
  typeSelect.disabled = false;
  typeSelect.addEventListener("change", () => {
    applyTypeSelection(typeSelect.value);
    renderAll();
  });
}

function ensureTypeOptions(typeSelect) {
  const hasIndividual = Array.from(typeSelect.options).some(opt => opt.value === "individual");
  const hasBoss = Array.from(typeSelect.options).some(opt => opt.value === "boss");
  const hasBossOverview = Array.from(typeSelect.options).some(opt => opt.value === "boss_overview");
  if (hasIndividual && hasBoss && hasBossOverview) return;

  typeSelect.innerHTML = "";
  const individual = document.createElement("option");
  individual.value = "individual";
  individual.textContent = ownText("activity_rewards", "Activity rewards");
  const boss = document.createElement("option");
  boss.value = "boss";
  boss.textContent = ownText("boss_defeat_reward", "Boss defeat reward");
  const bossOverview = document.createElement("option");
  bossOverview.value = "boss_overview";
  bossOverview.textContent = ownText("boss_overview", "Boss overview");
  typeSelect.appendChild(individual);
  typeSelect.appendChild(boss);
  typeSelect.appendChild(bossOverview);
}

function applyTypeLabelsFromLang() {
  const typeSelect = document.getElementById("typeSelect");
  if (!typeSelect) return;
  ensureTypeOptions(typeSelect);

  const activityLabel =
    langValue("dialog_are_activityreward_title") || ownText("activity_rewards", "Activity rewards");
  const bossLabel =
    langValue("dialog_are_bossdefeatreward_title") || ownText("boss_defeat_reward", "Boss defeat reward");

  const individualOption = Array.from(typeSelect.options).find(
    opt => opt.value === "individual"
  );
  const bossOption = Array.from(typeSelect.options).find(
    opt => opt.value === "boss"
  );
  const bossOverviewOption = Array.from(typeSelect.options).find(
    opt => opt.value === "boss_overview"
  );

  if (individualOption) individualOption.textContent = activityLabel;
  if (bossOption) bossOption.textContent = bossLabel;
  if (bossOverviewOption) {
    bossOverviewOption.textContent = ownText("boss_overview", "Boss overview");
  }
}

function setupBossOverviewSelectors() {
  const levelSelect = document.getElementById("bossLevelSelect");
  const stageSelect = document.getElementById("bossStageSelect");
  if (!levelSelect || !stageSelect) return;

  updateBossOverviewFilters();

  levelSelect.addEventListener("change", () => {
    localStorage.setItem("rift_rewards_overview_level_id", levelSelect.value);
    const stages = getStagesForLevel(levelSelect.value).slice(0, 6);
      stageSelect.innerHTML = "";
    const bossStageLabel = ownText("boss_stage", "Boss stage");
    stages.forEach((_, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${bossStageLabel} ${index}`;
      stageSelect.appendChild(option);
    });
    stageSelect.disabled = stages.length === 0;
    if (stages.length > 0) {
      stageSelect.value = "0";
      localStorage.setItem("rift_rewards_overview_stage_id", stageSelect.value);
    }
    renderBossOverview();
  });

  stageSelect.addEventListener("change", () => {
    localStorage.setItem("rift_rewards_overview_stage_id", stageSelect.value);
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

  const saved = localStorage.getItem("rift_rewards_boss_id");
  if (saved && bosses.some(x => String(x.raidBossID) === String(saved))) {
    select.value = saved;
  }

  select.addEventListener("change", () => {
    localStorage.setItem("rift_rewards_boss_id", select.value);
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
        lootboxes: true
      },
      onReady: async ({ lang, data, imageMaps }) => {
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
        state.unitsById = buildLookup(getArray(data, ["units"]), "wodID");
        state.lootBoxesById = buildLookup(getArray(data, ["lootBoxes", "lootboxes"]), "lootBoxID");
        state.constructionById = buildLookup(getArray(data, ["constructionItems"]), "constructionItemID");
        state.equipmentById = buildLookup(getArray(data, ["equipments"]), "equipmentID");
        state.currenciesById = buildLookup(getArray(data, ["currencies"]), "currencyID");
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
            constructionById: state.constructionById,
            decorationsById: {},
            unitsById: state.unitsById,
            lootBoxesById: state.lootBoxesById,
            lookSkinsById: state.lookSkinsById,
            decorationImageUrlMap: state.imageMaps.decorations || {},
            constructionImageUrlMap: state.imageMaps.constructions || {},
            equipmentImageUrlMap: state.imageMaps.looks || {},
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
        handleAutoHeight({
          contentSelector: "#content",
          subtractSelectors: [".note", ".page-title"],
          extraOffset: 18
        });
      }
    });
  } catch (err) {
    console.error(err);
    loader.error("Rift rewards load failed", 30);
  }
}

init();
