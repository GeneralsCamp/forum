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
  leaguetypeEvents: [],
  rewardsById: {},
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

function formatNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : String(value ?? "-");
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

function resolveUnitTooltipName(entry) {
  const baseName = String(entry?.name || "Unit").trim();
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

// --- REWARD MAPPING ---
function mapRewardToEntries(reward) {
  if (!reward) {
    return [{ name: "Unknown reward", amount: 1, type: null, id: null, addKeyName: null }];
  }

  const entries = [];

  if (state.rewardResolver) {
    const resolved = state.rewardResolver.resolveRewardEntries(reward) || [];
    resolved.forEach(item => {
      const name = String(item?.name || "").trim();
      const addKeyName = item?.addKeyName || null;
      if (isMeadLikeName(name) || isMeadLikeName(addKeyName)) return;

      entries.push({
        name: name || `Reward ${reward.rewardID || "?"}`,
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
    const fallbackName = state.rewardResolver.resolveRewardName(reward) || `Reward ${reward.rewardID || "?"}`;
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
      items: items.length > 0 ? items : [{ name: "No rewards", amount: 1, type: null, id: null, addKeyName: null }]
    });
  }

  return rows;
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
  if (!boss) {
    renderCardRows("individualRows", [], "No individual rewards found");
    renderCardRows("bossRows", [], "No boss rewards found");
    return;
  }

  const individualRows = buildIndividualRows(boss);
  const bossRows = buildBossRows(boss);
  renderCardRows("individualRows", individualRows, "No individual rewards found");
  renderCardRows("bossRows", bossRows, "No boss rewards found");
}

// --- SELECTORS ---
function applyTypeSelection(type) {
  const individualSection = document.getElementById("individualSection");
  const bossSection = document.getElementById("bossSection");
  const mode = type === "boss" ? "boss" : "individual";
  individualSection.style.display = mode === "individual" ? "" : "none";
  bossSection.style.display = mode === "boss" ? "" : "none";
  localStorage.setItem("rift_rewards_type", mode);
}

function setupTypeSelector() {
  const typeSelect = document.getElementById("typeSelect");
  if (!typeSelect) return;
  ensureTypeOptions(typeSelect);
  const saved = localStorage.getItem("rift_rewards_type");
  if (saved === "boss" || saved === "individual") {
    typeSelect.value = saved;
  }
  if (typeSelect.value !== "boss" && typeSelect.value !== "individual") {
    typeSelect.value = "individual";
  }
  applyTypeSelection(typeSelect.value);
  typeSelect.disabled = false;
  typeSelect.addEventListener("change", () => {
    applyTypeSelection(typeSelect.value);
  });
}

function ensureTypeOptions(typeSelect) {
  const hasIndividual = Array.from(typeSelect.options).some(opt => opt.value === "individual");
  const hasBoss = Array.from(typeSelect.options).some(opt => opt.value === "boss");
  if (hasIndividual && hasBoss) return;

  typeSelect.innerHTML = "";
  const individual = document.createElement("option");
  individual.value = "individual";
  individual.textContent = "Activity rewards";
  const boss = document.createElement("option");
  boss.value = "boss";
  boss.textContent = "Boss defeat reward";
  typeSelect.appendChild(individual);
  typeSelect.appendChild(boss);
}

function applyTypeLabelsFromLang() {
  const typeSelect = document.getElementById("typeSelect");
  if (!typeSelect) return;
  ensureTypeOptions(typeSelect);

  const activityLabel =
    langValue("dialog_are_activityreward_title") || "Activity rewards";
  const bossLabel =
    langValue("dialog_are_bossdefeatreward_title") || "Boss defeat reward";

  const individualOption = Array.from(typeSelect.options).find(
    opt => opt.value === "individual"
  );
  const bossOption = Array.from(typeSelect.options).find(
    opt => opt.value === "boss"
  );

  if (individualOption) individualOption.textContent = activityLabel;
  if (bossOption) bossOption.textContent = bossLabel;
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
        state.lang = lang || {};
        state.items = data;
        state.imageMaps = imageMaps || {};

        state.raidEvents = (data.events || []).filter(e => String(e.eventType || "") === "AllianceRaidbossEvent");
        state.raidBosses = getArray(data, ["raidBosses", "raidbosses"]);
        state.raidBossLevels = getArray(data, ["raidBossLevels", "raidbosslevels"]);
        state.leaguetypeEvents = getArray(data, ["leaguetypeevents", "leagueTypeEvents", "leagueTypeevents"]);

        state.rewardsById = buildLookup(getArray(data, ["rewards"]), "rewardID");
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
