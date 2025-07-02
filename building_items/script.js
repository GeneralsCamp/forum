const proxy = "https://corsproxy.io/?";
let lang = {};
let allItems = [];
let imageUrlMap = {};
let currentFilter = "all";

async function getItemVersion() {
  const url = proxy + encodeURIComponent("https://empire-html5.goodgamestudios.com/default/items/ItemsVersion.properties");
  const res = await fetch(url);
  const text = await res.text();
  const match = text.match(/CastleItemXMLVersion=(\d+\.\d+)/);
  if (!match) throw new Error("Version: error");
  return match[1];
}

async function getLangVersion() {
  const url = proxy + encodeURIComponent("https://empire-html5.goodgamestudios.com/config/languages/version.json");
  const res = await fetch(url);
  const json = await res.json();
  return json.languages["en"];
}

async function getLanguageData(version) {
  const url = proxy + encodeURIComponent(`https://langserv.public.ggs-ep.com/12@${version}/en/*`);
  const res = await fetch(url);
  const data = await res.json();
  lang = data;
}

async function getItems(version) {
  const url = proxy + encodeURIComponent(`https://empire-html5.goodgamestudios.com/default/items/items_v${version}.json`);
  const res = await fetch(url);
  const data = await res.json();

  if (Array.isArray(data.effects)) {
    effectDefinitions = {};
    data.effects.forEach(effect => {
      effectDefinitions[effect.effectID] = effect;
    });
  }

  if (Array.isArray(data.effectCaps)) {
    effectCapsMap = {};
    data.effectCaps.forEach(cap => {
      effectCapsMap[cap.capID] = cap;
    });
  }

  return data;
}

const effectNameOverrides = {};

const percentEffectIDs = new Set([
  "61", "62", "370", "386", "387", "413", "414", "415",
  "381", "382", "408", "383", "384", "82", "83", "388",
  "389", "390", "391", "392", "393", "409", "394", "395",
  "396", "611", "416", "397", "398", "399", "612", "417",
  "369", "368", "410", "411", "412", "423", "424", "407",
  "501", "705", "66", "614", "504", "503", "613", "114",
  "80", "401", "402", "373", "259", "701"
]);

const legacyEffectFields = [
  ["unitWallCount", false],
  ["recruitSpeedBoost", true],
  ["woodStorage", false],
  ["stoneStorage", false],
  ["ReduceResearchResourceCosts", true],
  ["Stoneproduction", false],
  ["Woodproduction", false],
  ["Foodproduction", false],
  ["foodStorage", false],
  ["unboostedFoodProduction", false],
  ["defensiveToolsSpeedBoost", true],
  ["defensiveToolsCostsReduction", true],
  ["meadStorage", false],
  ["recruitCostReduction", true],
  ["honeyStorage", false],
  ["hospitalCapacity", false],
  ["healSpeed", false],
  ["marketCarriages", false],
  ["XPBoostBuildBuildings", false],
  ["stackSize", false],
  ["glassStorage", false],
  ["Glassproduction", false],
  ["ironStorage", false],
  ["Ironproduction", false],
  ["coalStorage", false],
  ["Coalproduction", false],
  ["oilStorage", false],
  ["Oilproduction", false],
  ["defensiveToolsCostsReduction", true],
  ["offensiveToolsCostsReduction", true],
  ["feastCostsReduction", true],
  ["Meadreduction", true],
  ["surviveBoost", true],
  ["unboostedStoneProduction", false],
  ["unboostedWoodProduction", false],
  ["offensiveToolsSpeedBoost", true],
  ["defensiveToolsSpeedBoost", true],
];

function extractConstructionItems(data) {
  return data.constructionItems || [];
}

const langKeyOverrides = {
  "XPBoostBuildBuildings": "ci_primary_xpBoostBuildBuildings",
};

function getCIName(item) {
  const rawName = item.name || "???";

  if (langKeyOverrides[rawName] && lang[langKeyOverrides[rawName]]) {
    return lang[langKeyOverrides[rawName]];
  }

  const prefixes = ["appearance", "primary", "secondary"];

  for (const prefix of prefixes) {
    const key = `ci_${prefix}_${rawName}`;
    if (lang[key]) return lang[key];
  }

  const keyPlain = `ci_${rawName}`;
  if (lang[keyPlain]) return lang[keyPlain];

  return rawName;
}

function formatNumber(num) {
  return Number(num).toLocaleString(undefined);
}

function normalizeName(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toPascalCase(str) {
  return str
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function groupItemsByNameAndGroupID(items) {
  const groups = {};
  items.forEach(item => {
    const key = `${item.name}_${item.constructionItemGroupID}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  for (const key in groups) {
    groups[key].sort((a, b) => parseInt(a.level) - parseInt(b.level));
  }
  return groups;
}

function formatDuration(seconds) {
  if (!seconds) return "";
  seconds = Number(seconds);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  let result = "";
  if (days) result += `${days}d `;
  if (hours) result += `${hours}h `;
  if (mins) result += `${mins}m `;
  if (secs) result += `${secs}s`;
  return result.trim();
}

function createGroupedCard(groupItems, imageUrlMap = {}) {
  let currentLevelIndex = 0;
  const groupId = `group-${groupItems[0].name}-${groupItems[0].constructionItemGroupID}`;
  const name = getCIName(groupItems[0]);

  const rarenessNames = {
    1: "Ordinary",
    2: "Rare",
    3: "Epic",
    4: "Legendary",
    5: "Appearance",
    10: "Appearance"
  };

  function formatDuration(seconds) {
    if (!seconds) return "";
    seconds = Number(seconds);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    let result = "";
    if (days) result += `${days} day${days === 1 ? "" : "s"} `;
    if (hours) result += `${hours} hour${hours === 1 ? "" : "s"} `;
    if (mins) result += `${mins} minute${mins === 1 ? "" : "s"}`;
    return result.trim();
  }

  function formatNumber(num) {
    return Number(num).toLocaleString();
  }

  function renderLevel(index) {
    const item = groupItems[index];
    const isTemporary = !!item.duration;
    const removalCost = item.removalCostC1 || "0";
    const removalCostText = (removalCost === 0 || removalCost === "0")
      ? "Non removable"
      : `${removalCost} coins`;
    const commentList = [item.comment1, item.comment2].filter(Boolean);

    const normalizedName = normalizeName(item.name);
    const urls = imageUrlMap[normalizedName] || {};
    const placedUrl = urls.placedUrl || null;

    const safeName = name.replace(/'/g, "\\'");

    const isFirstLevel = index === 0;
    const isLastLevel = index === groupItems.length - 1;

    const rarityName = rarenessNames[item.rarenessID] || "Unknown";

    let effects = parseEffects(item.effects || "");
    addLegacyEffects(item, effects);

    if (item.decoPoints) {
      effects.push(`Public order: ${formatNumber(item.decoPoints)}`);
    }

    let effectsHTML = "";
    if (effects.length > 0) {
      effectsHTML = `
    <hr>
    <h5 class="card-section-title">Effects:</h5>
    <p>${effects.map(e => `- ${e}`).join("<br>")}</p>
  `;
    }

    const levelText = item.decoPoints
      ? "Appearance"
      : isTemporary
        ? `${rarityName} (Level ${item.level})`
        : `Level ${item.level}`;

    const typeText = isTemporary ? `Temporary (${formatDuration(item.duration)})` : "Permanent";

    return `
    <h2>${name} <br> (constructionItemID: ${item.constructionItemID})</h2>
    <hr>
    <div class="level-selector d-flex justify-content-between align-items-center mb-2">
      <button id="${groupId}-prev" class="btn btn-sm btn-outline-primary" ${isFirstLevel ? "disabled" : ""}>&larr;</button>
      <div><strong>${levelText}</strong></div>
      <button id="${groupId}-next" class="btn btn-sm btn-outline-primary" ${isLastLevel ? "disabled" : ""}>&rarr;</button>
    </div>
    <hr>
    <div class="image-wrapper mb-3">
      ${placedUrl
        ? `<img src="${placedUrl}" alt="${name}" class="card-image" onclick="openImageModal('${placedUrl}', '${safeName}')">`
        : `<div class="no-image-text">no image</div>`
      }
    </div>
    <hr>
    <div class="card-table">
      <div class="row g-0">
        <div class="col-6 card-cell border-end">
          <strong>Type:</strong><br> ${typeText}
        </div>
        <div class="col-6 card-cell">
          <strong>Removal Cost:</strong><br> ${removalCostText}
        </div>
      </div>
      <hr>
    </div>

    <div>
      <h4 class="card-section-title">Developer comments:</h4>
      <p>${commentList.map(c => `- ${c}`).join("<br>")}</p>
    </div>

    ${effectsHTML}
  `;
  }

  const containerId = `${groupId}-container`;
  const cardHtml = `
    <div class="col-md-6 col-sm-12 d-flex flex-column">
      <div class="box flex-fill" id="${containerId}">
        <div class="box-content">
          ${renderLevel(currentLevelIndex)}
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    const prevBtn = document.getElementById(`${groupId}-prev`);
    const nextBtn = document.getElementById(`${groupId}-next`);
    const boxContent = document.querySelector(`#${containerId} .box-content`);

    function updateView() {
      boxContent.innerHTML = renderLevel(currentLevelIndex);
      bindEvents();
    }

    function bindEvents() {
      const prev = document.getElementById(`${groupId}-prev`);
      const next = document.getElementById(`${groupId}-next`);

      if (prev) prev.disabled = currentLevelIndex === 0;
      if (next) next.disabled = currentLevelIndex === groupItems.length - 1;

      if (prev) prev.onclick = () => {
        if (currentLevelIndex > 0) {
          currentLevelIndex--;
          updateView();
        }
      };
      if (next) next.onclick = () => {
        if (currentLevelIndex < groupItems.length - 1) {
          currentLevelIndex++;
          updateView();
        }
      };
    }

    bindEvents();
  }, 0);

  return cardHtml;
}

function renderConstructionItems(items) {
  const container = document.getElementById("cards");
  container.innerHTML = "";

  const grouped = groupItemsByNameAndGroupID(items);

  for (const key in grouped) {
    container.insertAdjacentHTML("beforeend", createGroupedCard(grouped[key], imageUrlMap));
  }
}

function applyFiltersAndSorting() {
  const search = document.getElementById("searchInput").value.toLowerCase();
  const filterValue = currentFilter;
  const appearanceFilter = document.getElementById("appearanceFilter").value;

  const filtered = allItems.filter(item => {
    const name = getCIName(item).toLowerCase();
    const id = (item.constructionItemID || "").toString().toLowerCase();

    const effectsText = parseEffects(item.effects || "").join(" ").toLowerCase();

    const matchSearch = name.includes(search) || id.includes(search) || effectsText.includes(search);

    let matchFilter = true;
    if (filterValue === "permanent") matchFilter = !item.duration;
    else if (filterValue === "temporary") matchFilter = !!item.duration;

    let matchAppearance = true;
    if (appearanceFilter === "hide") {
      matchAppearance = !item.decoPoints;
    }

    return matchSearch && matchFilter && matchAppearance;
  });

  filtered.sort((a, b) => getCIName(a).localeCompare(getCIName(b)));

  renderConstructionItems(filtered);
}

function setupEventListeners() {
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", applyFiltersAndSorting);

  const durationFilter = document.getElementById("durationFilter");
  durationFilter.addEventListener("change", () => {
    currentFilter = durationFilter.value;
    applyFiltersAndSorting();
  });

  const appearanceFilter = document.getElementById("appearanceFilter");
  appearanceFilter.addEventListener("change", applyFiltersAndSorting);
}

async function getImageUrlMap() {
  const base = "https://empire-html5.goodgamestudios.com/default/assets/itemassets/";

  try {
    const indexUrl = proxy + encodeURIComponent("https://empire-html5.goodgamestudios.com/default/index.html?inGameShop=1&allowFullScreen=true");
    const indexRes = await fetch(indexUrl);
    if (!indexRes.ok) throw new Error("Failed to fetch index.html: " + indexRes.status);
    const indexHtml = await indexRes.text();

    const dllMatch = indexHtml.match(/<link\s+id=["']dll["']\s+rel=["']preload["']\s+href=["']([^"']+)["']/i);
    if (!dllMatch) throw new Error("DLL preload link not found");

    const dllRelativeUrl = dllMatch[1];
    const dllUrl = `https://empire-html5.goodgamestudios.com/default/${dllRelativeUrl}`;

    const res = await fetch(proxy + dllUrl);
    if (!res.ok) throw new Error("Failed to fetch ggs.dll.js: " + res.status);

    const text = await res.text();

    const regexIcon = /ConstructionItems\/ConstructionItem_([^\s"'`<>]+?)--\d+/g;
    const regexPlaced = /Building\/[^\/]+\/([^\/]+)\/[^\/]+--\d+/g;

    const map = {};

    for (const match of text.matchAll(regexIcon)) {
      const name = match[1];
      const normalized = normalizeName(name);
      const url = `${base}${match[0]}.webp`;
      if (!map[normalized]) map[normalized] = {};
      map[normalized].iconUrl = url;
    }

    for (const match of text.matchAll(regexPlaced)) {
      const nameWithPrefix = match[1];
      const name = nameWithPrefix.split('_Building_').pop();
      const normalized = normalizeName(name);
      const url = `${base}${match[0]}.webp`;
      if (!map[normalized]) map[normalized] = {};
      map[normalized].placedUrl = url;
    }

    return map;

  } catch (error) {
    console.error("getImageUrlMap error", error);
    return {};
  }
}

function openImageModal(src, caption) {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImage");
  const modalCaption = document.getElementById("modalCaption");

  modalImg.src = src;
  modalCaption.innerText = caption;

  modal.style.display = "flex";
  requestAnimationFrame(() => modal.classList.add("show"));
}

function closeImageModal() {
  const modal = document.getElementById("imageModal");

  modal.classList.remove("show");
  setTimeout(() => {
    if (!modal.classList.contains("show")) {
      modal.style.display = "none";
    }
  }, 300);
}

window.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("imageModal");
  modal.classList.remove("show");
  modal.style.display = "none";
});

function getLocalizedEffectName(effectDef) {
  if (!effectDef) return null;

  const baseKeyOriginal = `effect_name_${effectDef.name}`;
  const tooltipKeyOriginal = `ci_effect_${effectDef.name}_tt`;

  const baseKeyLower = `effect_name_${effectDef.name.toLowerCase()}`;
  const tooltipKeyLower = `ci_effect_${effectDef.name.toLowerCase()}_tt`;

  if (effectNameOverrides[baseKeyOriginal]) return effectNameOverrides[baseKeyOriginal];
  if (lang[baseKeyOriginal]) return lang[baseKeyOriginal];
  if (lang[tooltipKeyOriginal]) return lang[tooltipKeyOriginal];

  if (effectNameOverrides[baseKeyLower]) return effectNameOverrides[baseKeyLower];
  if (lang[baseKeyLower]) return lang[baseKeyLower];
  if (lang[tooltipKeyLower]) return lang[tooltipKeyLower];

  return effectDef.name;
}

function parseEffects(effectsStr) {
  if (!effectsStr) return [];

  const formatter = new Intl.NumberFormat(navigator.language);

  return effectsStr.split(",").map(eff => {
    const [id, valRaw] = eff.split("&");

    let val;
    if (valRaw.includes("+")) {
      val = Number(valRaw.split("+")[1]);
    } else {
      val = Number(valRaw);
    }

    const effectDef = effectDefinitions[id];
    const localizedName = getLocalizedEffectName(effectDef) || `Effect ID ${id}`;

    const suffix = percentEffectIDs.has(id) ? "%" : "";

    let maxStr = "";
    if (effectDef && effectDef.capID) {
      const cap = effectCapsMap[effectDef.capID];
      if (cap && cap.maxTotalBonus) {
        maxStr = ` <span class="max-bonus">(Max: ${formatter.format(Number(cap.maxTotalBonus))}${suffix})</span>`;
      }
    }

    const needsColon = !localizedName.includes(":");
    return `${localizedName}${needsColon ? ":" : ""} ${formatter.format(val)}${suffix}${maxStr}`;
  });
}

function addLegacyEffects(item, effectsList) {
  function toLangKey(fieldName) {
    return fieldName.charAt(0).toLowerCase() + fieldName.slice(1);
  }

  legacyEffectFields.forEach(([field, hasPercent]) => {
    const val = item[field];
    if (val !== undefined && val !== null && val !== "") {
      const langKey = `ci_effect_${toLangKey(field)}_tt`;
      const effectName = lang[langKey] || field;

      const endsWithColon = effectName.trim().endsWith(":");
      const formattedValue = formatNumber(val);

      const valueWithSuffix = hasPercent
        ? `${formattedValue}%`
        : formattedValue;

      const effectText = endsWithColon
        ? `${effectName} ${valueWithSuffix}`
        : `${effectName}: ${valueWithSuffix}`;

      effectsList.push(effectText);
    }
  });
}

async function init() {
  try {
    const itemVersion = await getItemVersion();
    const langVersion = await getLangVersion();
    console.log("Item version:", itemVersion, "| Language version:", langVersion);

    await getLanguageData(langVersion);
    imageUrlMap = await getImageUrlMap();

    const json = await getItems(itemVersion);
    allItems = extractConstructionItems(json);

    console.log(`${Object.keys(imageUrlMap).length} construction item URL found.`);
    console.log(`${allItems.length} construction items found.`);

    setupEventListeners();
    applyFiltersAndSorting();
  } catch (err) {
    console.error("Error:", err);
    document.getElementById("cards").innerHTML = "<p class='text-danger'>An error occurred while loading data.</p>";
  }
}

init();
