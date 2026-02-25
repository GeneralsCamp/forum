import {
  getItemVersion,
  loadItems,
  getLangVersion,
  loadLanguage
} from "../../overviews/shared/DataService.mjs";
import { createLoader } from "../../overviews/shared/LoadingService.mjs";

let raidBossData = {};
let langData = {};
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

function normalizeBossName(rawName, bossId) {
  const name = String(rawName || "").trim();
  const langName = getLangValue(`are_boss_name_${name}`);
  if (langName) return String(langName).trim();
  return name || `Raid Boss ${bossId}`;
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
        name: `Raid Boss ${bossId}`,
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
    if (courtyardOption) courtyardOption.textContent = "Courtyard";
    if (wallsOption) wallsOption.textContent = "Walls";
    return;
  }

  if (courtyardOption) {
    courtyardOption.textContent = `Courtyard (${levelData.courtyardPointFactor})`;
  }
  if (wallsOption) {
    wallsOption.textContent = `Walls (${levelData.wallPointFactor})`;
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

function calculateActivityPoints() {
  const defeated = Number(document.getElementById("defeated").value) || 0;
  const defeatedReserveInput = document.getElementById("defeatedReserve");
  const defeatedReserve = sanitizeDefeatedReserveUnits(defeatedReserveInput?.value);
  if (defeatedReserveInput && Number(defeatedReserveInput.value) !== defeatedReserve) {
    defeatedReserveInput.value = String(defeatedReserve);
  }
  const area = getSelectedArea();
  const levelData = getLevelData();

  if (!levelData) {
    document.getElementById("courtyardTroops").value = "";
    document.getElementById("wallTroops").value = "";
    document.getElementById("points").innerHTML = "0";
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
    document.getElementById("points").innerHTML = "0";
    return;
  }

  const ratio = Math.min(totalDefeated / troopsForArea, 1);
  const points = Math.ceil(ratio * pointFactor + Number.EPSILON);
  document.getElementById("points").innerHTML = points;
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

  const previousLevel = levelSelect.value;
  levelSelect.innerHTML = "";
  levels.forEach(level => {
    const levelData = raidBossData[bossId].levels[level];
    const wallFactor = Number(levelData.wallPointFactor) || 0;
    const multiplierText = wallFactor ? `x${Math.round(wallFactor / 100)}` : "-";
    const option = document.createElement("option");
    option.value = String(level);
    option.textContent = `Level ${level} (${multiplierText})`;
    levelSelect.appendChild(option);
  });

  if (levels.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No levels";
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
  ["defeated", "defeatedReserve", "area", "level", "raidBoss"].forEach(id => {
    localStorage.setItem(id, document.getElementById(id).value);
  });
}

function restoreFromLocalStorage() {
  const raidBoss = localStorage.getItem("raidBoss");
  if (raidBoss && raidBossData[raidBoss]) {
    document.getElementById("raidBoss").value = raidBoss;
  }

  populateLevelSelectForBoss();

  const level = localStorage.getItem("level");
  if (level && raidBossData[getSelectedBossId()]?.levels?.[Number(level)]) {
    document.getElementById("level").value = level;
  }

  const area = localStorage.getItem("area");
  if (area === "courtyard" || area === "walls") {
    document.getElementById("area").value = area;
  }

  const defeated = localStorage.getItem("defeated");
  if (defeated !== null) {
    document.getElementById("defeated").value = defeated;
  }

  const defeatedReserve = localStorage.getItem("defeatedReserve");
  if (defeatedReserve !== null) {
    document.getElementById("defeatedReserve").value = sanitizeDefeatedReserveUnits(defeatedReserve);
  }
}

function bindUI() {
  const raidBossSelect = document.getElementById("raidBoss");

  raidBossSelect.addEventListener("change", () => {
    populateLevelSelectForBoss();
    saveToLocalStorage();
    calculateActivityPoints();
  });

  document.querySelectorAll("input, select").forEach(el => {
    if (el.id === "raidBoss") return;
    el.addEventListener("change", () => {
      saveToLocalStorage();
      calculateActivityPoints();
    });
  });
}

async function loadLiveData() {
  const [itemVersion, langVersion] = await Promise.all([
    getItemVersion(),
    getLangVersion()
  ]);

  const [items, lang] = await Promise.all([
    loadItems(itemVersion),
    loadLanguage("en", langVersion)
  ]);

  langData = lang || {};
  const builtData = buildRaidBossData(items);
  if (Object.keys(builtData).length === 0) {
    throw new Error("No raid boss data in items.");
  }
  raidBossData = builtData;
}

async function init() {
  const MIN_LOADING_MS = 1000;
  const loadingStart = Date.now();

  setSectionsVisible(false);
  loader.set(1, 4, "Loading versions...");

  try {
    loader.set(2, 4, "Loading items and language...");
    await loadLiveData();

    loader.set(3, 4, "Building raid boss data...");
    populateRaidBossSelect();
    restoreFromLocalStorage();
    bindUI();
    calculateActivityPoints();
    loader.set(4, 4, "Finalizing...");
    const elapsed = Date.now() - loadingStart;
    const waitMs = Math.max(0, MIN_LOADING_MS - elapsed);
    if (waitMs > 0) {
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
    loader.hide();
    setSectionsVisible(true);
  } catch (err) {
    console.error("Rift raid live data load failed:", err);
    loader.error("Data load failed", 30);
  }
}

init();
