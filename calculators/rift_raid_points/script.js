import { saveCalculatorData, loadCalculatorData } from "../../overviews/shared/GameSettings.mjs";
import {
  getItemVersion,
  loadItems,
  getLangVersion,
  loadLanguage,
  logResolvedDataUrls
} from "../../overviews/shared/DataService.mjs";
import { createLoader } from "../../overviews/shared/LoadingService.mjs";
import { initCalculatorI18n } from "../shared/CalculatorI18n.mjs";

const { language, t, formatNumber } = await initCalculatorI18n();

let raidBossData = {};
let langData = {};
const CALC_NAME = "rift_raid_points";
const loader = createLoader();
const MAX_DEFEATED_RESERVE_UNITS = 10000000;

function parseWallUnits(rawValue) {
  if (!rawValue) return 0;
  return String(rawValue)
    .split("#")
    .reduce((sum, token) => {
      const [, countRaw] = token.split("+");
      const count = Number(countRaw) || 0;
      return sum + count;
    }, 0);
}

function getLangValue(key) {
  if (!key) return null;
  return langData[key] || langData[String(key).toLowerCase()] || null;
}

function getGameText(key, fallback) {
  return getLangValue(key) || fallback;
}

function applyGameTranslations() {
  const courtyard = getGameText("dialog_battleLogDetail_courtyard", t("courtyard"));
  const walls = getGameText("wall", t("walls"));
  const riftPoints = getGameText("currency_name_RiftPoint", t("rift_points"));
  const courtyardOption = document.querySelector('#area option[value="courtyard"]');
  const wallsOption = document.querySelector('#area option[value="walls"]');

  if (courtyardOption) courtyardOption.textContent = courtyard;
  if (wallsOption) wallsOption.textContent = walls;
  document.getElementById("riftPointsLabel").textContent = riftPoints;
}

function normalizeBossName(rawName, bossId) {
  const name = String(rawName || "").trim();
  const langName = getLangValue(`are_boss_name_${name}`);
  if (langName) return String(langName).trim();
  return name || t("raid_boss_fallback", { id: bossId });
}

function buildRaidBossData(items) {
  const bosses = Array.isArray(items?.raidBosses) ? items.raidBosses : [];
  const levels = Array.isArray(items?.raidBossLevels) ? items.raidBossLevels : [];
  const stages = Array.isArray(items?.raidBossStages) ? items.raidBossStages : [];

  const stageByLevelId = new Map();
  for (const stage of stages) {
    const levelId = String(stage.raidBossLevelID || "");
    const health = Number(stage.health);
    if (!levelId || health !== 100 || stageByLevelId.has(levelId)) continue;
    stageByLevelId.set(levelId, stage);
  }

  const result = {};
  for (const boss of bosses) {
    const bossId = String(boss.raidBossID || "");
    if (!bossId) continue;
    result[bossId] = {
      name: normalizeBossName(boss.name, bossId),
      levels: {}
    };
  }

  for (const levelEntry of levels) {
    const bossId = String(levelEntry.raidBossID || "");
    const levelId = String(levelEntry.raidBossLevelID || "");
    const level = Number(levelEntry.level);
    if (!bossId || !levelId || !Number.isFinite(level)) continue;

    const stage = stageByLevelId.get(levelId);
    if (!stage) continue;

    if (!result[bossId]) {
      result[bossId] = {
        name: t("raid_boss_fallback", { id: bossId }),
        levels: {}
      };
    }

    const wallTroops =
      parseWallUnits(stage.leftWallUnits) +
      parseWallUnits(stage.frontWallUnits) +
      parseWallUnits(stage.rightWallUnits);

    result[bossId].levels[level] = {
      courtyardTroops: Number(levelEntry.courtyardSize) || 0,
      wallTroops,
      courtyardPointFactor: Number(stage.courtyardPointFactor) || 0,
      wallPointFactor: Number(stage.wallPointFactor) || 0
    };
  }

  return result;
}

function getSelectedBossId() {
  return document.getElementById("raidBoss").value;
}

function getSelectedLevel() {
  return Number(document.getElementById("level").value) || 1;
}

function getSelectedArea() {
  return document.getElementById("area").value;
}

function getLevelData() {
  const bossId = getSelectedBossId();
  const level = getSelectedLevel();
  return raidBossData?.[bossId]?.levels?.[level] || null;
}

function refreshAreaLabels(levelData) {
  const areaSelect = document.getElementById("area");
  const courtyardOption = Array.from(areaSelect.options).find(opt => opt.value === "courtyard");
  const wallsOption = Array.from(areaSelect.options).find(opt => opt.value === "walls");

  if (!levelData) {
    if (courtyardOption) courtyardOption.textContent = getGameText("dialog_battleLogDetail_courtyard", t("courtyard"));
    if (wallsOption) wallsOption.textContent = getGameText("wall", t("walls"));
    return;
  }

  if (courtyardOption) {
    courtyardOption.textContent = `${getGameText("dialog_battleLogDetail_courtyard", t("courtyard"))} (${formatNumber(levelData.courtyardPointFactor)})`;
  }
  if (wallsOption) {
    wallsOption.textContent = `${getGameText("wall", t("walls"))} (${formatNumber(levelData.wallPointFactor)})`;
  }
}

function updateTroopsVisibility(area) {
  const courtyardBox = document.getElementById("courtyardBox");
  const wallBox = document.getElementById("wallBox");

  if (area === "walls") {
    wallBox.style.display = "block";
    courtyardBox.style.display = "none";
  } else {
    courtyardBox.style.display = "block";
    wallBox.style.display = "none";
  }
}

function sanitizeDefeatedReserveUnits(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(Math.floor(n), MAX_DEFEATED_RESERVE_UNITS));
}

function sanitizeRiftPointBonus(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function calculateRiftPoints() {
  const defeated = Number(document.getElementById("defeated").value) || 0;
  const defeatedReserveInput = document.getElementById("defeatedReserve");
  const defeatedReserve = sanitizeDefeatedReserveUnits(defeatedReserveInput?.value);
  const riftPointBonusInput = document.getElementById("riftPointBonus");
  const riftPointBonus = sanitizeRiftPointBonus(riftPointBonusInput?.value);
  if (defeatedReserveInput && Number(defeatedReserveInput.value) !== defeatedReserve) {
    defeatedReserveInput.value = String(defeatedReserve);
  }
  if (riftPointBonusInput && Number(riftPointBonusInput.value) !== riftPointBonus) {
    riftPointBonusInput.value = String(riftPointBonus);
  }
  const area = getSelectedArea();
  const levelData = getLevelData();

  if (!levelData) {
    document.getElementById("courtyardTroops").value = "";
    document.getElementById("wallTroops").value = "";
    document.getElementById("points").textContent = "0";
    refreshAreaLabels(null);
    return;
  }

  document.getElementById("courtyardTroops").value = levelData.courtyardTroops;
  document.getElementById("wallTroops").value = levelData.wallTroops;
  refreshAreaLabels(levelData);
  updateTroopsVisibility(area);

  const troopsForArea = area === "walls" ? levelData.wallTroops : levelData.courtyardTroops;
  const pointFactor = area === "walls" ? levelData.wallPointFactor : levelData.courtyardPointFactor;
  const totalDefeated = defeated + defeatedReserve;

  if (troopsForArea <= 0 || totalDefeated <= 0 || pointFactor <= 0) {
    document.getElementById("points").textContent = "0";
    return;
  }

  const ratio = Math.min(totalDefeated / troopsForArea, 1);
  const basePoints = Math.ceil(ratio * pointFactor + Number.EPSILON);
  const points = Math.ceil(basePoints * (1 + riftPointBonus / 100) + Number.EPSILON);
  document.getElementById("points").textContent = formatNumber(points);
}

function setSectionsVisible(visible) {
  const inputsSection = document.getElementById("inputsSection");
  const resultsSection = document.getElementById("resultsSection");
  if (inputsSection) inputsSection.style.display = visible ? "" : "none";
  if (resultsSection) resultsSection.style.display = visible ? "" : "none";
}

function populateRaidBossSelect() {
  const raidBossSelect = document.getElementById("raidBoss");
  const sortedBossEntries = Object.entries(raidBossData).sort((a, b) =>
    Number(a[0]) - Number(b[0])
  );

  raidBossSelect.innerHTML = "";
  sortedBossEntries.forEach(([bossId, bossData]) => {
    const option = document.createElement("option");
    option.value = bossId;
    option.textContent = bossData.name;
    raidBossSelect.appendChild(option);
  });
}

function populateLevelSelectForBoss() {
  const bossId = getSelectedBossId();
  const levelSelect = document.getElementById("level");
  const levels = Object.keys(raidBossData?.[bossId]?.levels || {})
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const pointFactors = levels.map(level => {
    const levelData = raidBossData[bossId].levels[level];
    return `${Number(levelData.wallPointFactor) || 0}:${Number(levelData.courtyardPointFactor) || 0}`;
  });
  const hasLevelPointMultiplier = new Set(pointFactors).size > 1;

  const previousLevel = levelSelect.value;
  levelSelect.innerHTML = "";
  levels.forEach(level => {
    const levelData = raidBossData[bossId].levels[level];
    const wallFactor = Number(levelData.wallPointFactor) || 0;
    const multiplierText = wallFactor ? `x${Math.round(wallFactor / 100)}` : "-";
    const option = document.createElement("option");
    option.value = String(level);
    option.textContent = hasLevelPointMultiplier
      ? `${getGameText("level", t("level"))} ${formatNumber(level)} (${multiplierText})`
      : `${getGameText("level", t("level"))} ${formatNumber(level)}`;
    levelSelect.appendChild(option);
  });

  if (levels.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = t("no_levels");
    levelSelect.appendChild(option);
    levelSelect.disabled = true;
    return;
  }

  levelSelect.disabled = false;
  if (levels.includes(Number(previousLevel))) {
    levelSelect.value = previousLevel;
  } else {
    levelSelect.value = String(levels[0]);
  }
}

function saveToLocalStorage() {
  const data = {};
  ["defeated", "defeatedReserve", "riftPointBonus", "area", "level", "raidBoss"].forEach(id => {
    const value = document.getElementById(id).value;
    data[id] = id === "riftPointBonus" ? String(sanitizeRiftPointBonus(value)) : value;
  });
  saveCalculatorData(CALC_NAME, data);
}

function restoreFromLocalStorage() {
  const data = loadCalculatorData(CALC_NAME);
  if (!data) {
    populateLevelSelectForBoss();
    return;
  }

  if (data.raidBoss && raidBossData[data.raidBoss]) {
    document.getElementById("raidBoss").value = data.raidBoss;
  }

  populateLevelSelectForBoss();

  if (data.level && raidBossData[getSelectedBossId()]?.levels?.[Number(data.level)]) {
    document.getElementById("level").value = data.level;
  }
  if (data.area) document.getElementById("area").value = data.area;
  if (data.defeated) document.getElementById("defeated").value = data.defeated;
  if (data.defeatedReserve) {
    document.getElementById("defeatedReserve").value = sanitizeDefeatedReserveUnits(data.defeatedReserve);
  }
  if (data.riftPointBonus) {
    document.getElementById("riftPointBonus").value = sanitizeRiftPointBonus(data.riftPointBonus);
  }
}

function bindUI() {
  const raidBossSelect = document.getElementById("raidBoss");

  raidBossSelect.addEventListener("change", () => {
    populateLevelSelectForBoss();
    saveToLocalStorage();
    calculateRiftPoints();
  });

  document.querySelectorAll("input, select").forEach(el => {
    if (el.id === "raidBoss") return;
    el.addEventListener("change", () => {
      saveToLocalStorage();
      calculateRiftPoints();
    });
  });
}

async function loadLiveData() {
  const [itemVersion, langVersion] = await Promise.all([
    getItemVersion(),
    getLangVersion()
  ]);

  await logResolvedDataUrls({
    langCode: language,
    itemVersion,
    langVersion
  });

  const [items, lang] = await Promise.all([
    loadItems(itemVersion),
    loadLanguage(language, langVersion)
  ]);

  langData = lang || {};
  applyGameTranslations();
  const builtData = buildRaidBossData(items);
  if (Object.keys(builtData).length === 0) {
    throw new Error("No raid boss data in items.");
  }
  raidBossData = builtData;
}

async function init() {
  setSectionsVisible(false);

  try {
    await loadLiveData();

    populateRaidBossSelect();
    restoreFromLocalStorage();
    bindUI();
    calculateRiftPoints();
    setSectionsVisible(true);
  } catch (err) {
    console.error("Rift raid live data load failed:", err);
    loader.error(t("loading_error"), 30);
  }
}

window.calculateRiftPoints = calculateRiftPoints;

init();
