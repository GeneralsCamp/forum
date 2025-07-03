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

const effectNameOverrides = {
  "lootBonusPVE": "Loot bonus from NPC targets",
  "defenseBonusNotMainCastle": "Bonus to the strength of defensive units not in the main castle",
  "attackUnitAmountReinforcementBonus": "Troop capacity for final assault",
  "rangeBonusTCI": "Ranged unit attack strength when attacking",
  "meleeBonusTCI": "Melee unit attack strength when attacking",
  "MeadProductionIncrease": "Mead production bonus",
  "HoneyProductionIncrease": "Honey production bonus",
  "rangeBonus": "Ranged unit attack strength when attacking",
  "beefProductionBoost": "Beef production bonus",
  "defenseUnitAmountYardMinorBoost": "Bonus to courtyard defense troop capacity",
  "attackUnitAmountReinforcementBoost": "Troop capacity for final assault"
};

const langKeyOverrides = {
  "XPBoostBuildBuildings": "ci_primary_xpBoostBuildBuildings",
  "natureResearchtower": "ci_appearance_natureResearchTower",
  "winterResearchtower": "ci_appearance_winterResearchTower",
};

const percentEffectIDs = new Set([
  "61", "62", "370", "386", "387", "413", "414", "415",
  "381", "382", "408", "383", "384", "82", "83", "388",
  "389", "390", "391", "392", "393", "409", "394", "395",
  "396", "611", "416", "397", "398", "399", "612", "417",
  "369", "368", "410", "411", "412", "423", "424", "407",
  "501", "705", "66", "614", "504", "503", "613", "114",
  "80", "401", "402", "373", "259", "701", "343", "202",
  "340", "339", "11", "363"
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
  ["XPBoostBuildBuildings", true],
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
  ["espionageTravelBoost", false],
];

function getCIName(item) {
  const rawName = item.name || "???";

  const pascalName = toPascalCase(rawName);

  if (langKeyOverrides[rawName]) {
    const overriddenKey = langKeyOverrides[rawName];
    if (lang[overriddenKey]) return lang[overriddenKey];
    if (lang[overriddenKey.toLowerCase()]) return lang[overriddenKey.toLowerCase()];
  }

  const prefixes = ["appearance", "primary", "secondary"];

  for (const prefix of prefixes) {
    const found = findLangKeyVariations(prefix, rawName);
    if (found) return found;
  }

  const keysToTry = [
    `ci_${rawName}`,
    `ci_${rawName.toLowerCase()}`,
    `ci_${rawName.charAt(0).toLowerCase() + rawName.slice(1)}`
  ];
  for (const key of keysToTry) {
    if (lang[key]) return lang[key];
  }

  for (const prefix of prefixes) {
    const foundPascal = findLangKeyVariations(prefix, pascalName);
    if (foundPascal) return foundPascal;
  }

  const keysPascalPlain = [
    `ci_${pascalName}`,
    `ci_${pascalName.toLowerCase()}`,
    `ci_${pascalName.charAt(0).toLowerCase() + pascalName.slice(1)}`
  ];
  for (const key of keysPascalPlain) {
    if (lang[key]) return lang[key];
  }

  return rawName;
}

function findLangKeyVariations(prefix, name) {
  const keysToTry = [
    `ci_${prefix}_${name}`,
    `ci_${prefix}_${name.toLowerCase()}`,
    `ci_${prefix}_${name.charAt(0).toLowerCase() + name.slice(1)}`,
  ];

  for (const key of keysToTry) {
    if (lang[key]) return lang[key];
  }

  return null;
}

function extractConstructionItems(data) {
  return data.constructionItems || [];
}

function formatNumber(num) {
  return Number(num).toLocaleString();
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
  let result = "";
  if (days) result += `${days} day${days === 1 ? "" : "s"} `;
  if (hours) result += `${hours} hour${hours === 1 ? "" : "s"} `;
  if (mins) result += `${mins} minute${mins === 1 ? "" : "s"}`;
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
      <button id="${groupId}-prev" class="btn btn-sm btn-outline-primary" ${isFirstLevel ? "disabled" : ""}>
        <i class="bi bi-arrow-left"></i>
      </button>
      <div><strong>${levelText}</strong></div>
      <button id="${groupId}-next" class="btn btn-sm btn-outline-primary" ${isLastLevel ? "disabled" : ""}>
        <i class="bi bi-arrow-right"></i>
      </button>
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
    dllVersion = dllRelativeUrl;
    dllUrl = `https://empire-html5.goodgamestudios.com/default/${dllRelativeUrl}`;

    console.log(`DLL URL: ${dllVersion}`);

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

function getLocalizedEffectName(effectDef, variant = null) {
  if (!effectDef) return null;

  const original = effectDef.name;
  const lowerFirst = original.charAt(0).toLowerCase() + original.slice(1);
  const allLower = original.toLowerCase();

  if (effectNameOverrides[original]) return effectNameOverrides[original];
  if (effectNameOverrides[lowerFirst]) return effectNameOverrides[lowerFirst];
  if (effectNameOverrides[allLower]) return effectNameOverrides[allLower];

  const candidates = [];

  if (variant !== null) {
    candidates.push(`ci_effect_${original}_${variant}_tt`);
    candidates.push(`ci_effect_${lowerFirst}_${variant}_tt`);
    candidates.push(`ci_effect_${allLower}_${variant}_tt`);
  }

  candidates.push(`effect_name_${original}`);
  candidates.push(`ci_effect_${original}_tt`);
  candidates.push(`effect_name_${lowerFirst}`);
  candidates.push(`ci_effect_${lowerFirst}_tt`);
  candidates.push(`effect_name_${allLower}`);
  candidates.push(`ci_effect_${allLower}_tt`);

  for (const key of candidates) {
    if (lang[key]) return lang[key];
  }

  return original;
}

function parseEffects(effectsStr) {
  if (!effectsStr) return [];

  const formatter = new Intl.NumberFormat(navigator.language);

  return effectsStr.split(",").map(eff => {
    const [id, valRaw] = eff.split("&");

    let variant = null;
    let val;

    if (valRaw.includes("+")) {
      const [varPart, valPart] = valRaw.split("+");
      variant = Number(varPart);
      val = Number(valPart);
    } else {
      val = Number(valRaw);
    }

    const effectDef = effectDefinitions[id];
    const localizedName = getLocalizedEffectName(effectDef, variant) || `Effect ID ${id}`;

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
  function getLangKey(fieldName) {
    const original = fieldName;
    const variants = [
      original,
      lowerFirstN(original, 1),
      lowerFirstN(original, 2),
      original.toLowerCase()
    ];

    const candidates = [];

    for (const variant of variants) {
      candidates.push(`ci_effect_${variant}_tt`);
    }

    for (const key of candidates) {
      if (lang[key]) return lang[key];
    }

    return fieldName;
  }

  legacyEffectFields.forEach(([field, hasPercent]) => {
    const val = item[field];
    if (val !== undefined && val !== null && val !== "") {
      const effectName = getLangKey(field);

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

function lowerFirstN(str, n = 1) {
  return str.slice(0, n).toLowerCase() + str.slice(n);
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

    console.log(`${Object.keys(imageUrlMap).length} construction item URL map is created.`);
    console.log(`Found ${allItems.length} construction items`);

    setupEventListeners();
    applyFiltersAndSorting();
  } catch (err) {
    console.error("Error:", err);
    document.getElementById("cards").innerHTML = "<p class='text-danger'>An error occurred while loading data.</p>";
  }
}

init();

// Console Command: compareWithOldVersion(<version>)
async function compareWithOldVersion(oldVersion = "741.01") {
  const url = proxy + encodeURIComponent(`https://empire-html5.goodgamestudios.com/default/items/items_v${oldVersion}.json`);
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`Failed to fetch version ${oldVersion}.`);
    return;
  }

  const json = await res.json();
  const oldItems = extractConstructionItems(json);

  const currentVersionInfo = await getVersionInfo();
  const oldVersionInfo = {
    version: oldVersion,
    date: json.versionInfo?.date?.["@value"] || "unknown"
  };

  const categorizedOld = categorizeItemsByDuration(oldItems);
  const categorizedNew = categorizeItemsByDuration(allItems);

  console.log(`Current Version: ${currentVersionInfo.version} (${currentVersionInfo.date})`);
  console.log(`Compared Version: ${oldVersionInfo.version} (${oldVersionInfo.date})\n`);

  ["temporary", "permanent"].forEach(type => {
    const oldList = categorizedOld[type];
    const newList = categorizedNew[type];

    const oldCount = oldList.length;
    const newCount = newList.length;
    const diff = newCount - oldCount;

    if (diff === 0) {
      console.log(`No changes in ${type} items.`);
    } else if (diff > 0) {
      const oldIDs = new Set(oldList.map(i => i.constructionItemID));
      const added = newList.filter(i => !oldIDs.has(i.constructionItemID));
      console.log(`Added ${added.length} ${type} item(s) (constructionItemID): ${added.map(i => i.constructionItemID).join(", ")}`);
    } else {
      console.log(`${type} items decreased by ${-diff}`);
    }
  });
}

async function getVersionInfo() {
  try {
    const urlVersion = proxy + encodeURIComponent("https://empire-html5.goodgamestudios.com/default/items/ItemsVersion.properties");
    const resVersion = await fetch(urlVersion);
    if (!resVersion.ok) throw new Error("Failed to fetch current version");

    const text = await resVersion.text();
    const match = text.match(/CastleItemXMLVersion=(\d+\.\d+)/);
    if (!match) throw new Error("Version not found");
    const version = match[1];

    const urlJson = proxy + encodeURIComponent(`https://empire-html5.goodgamestudios.com/default/items/items_v${version}.json`);
    const resJson = await fetch(urlJson);
    if (!resJson.ok) throw new Error("Failed to fetch version JSON");

    const json = await resJson.json();
    const date = json.versionInfo?.date?.["@value"] || "unknown";

    return { version, date };

  } catch (e) {
    console.warn("Error fetching current version info:", e);
    return { version: "unknown", date: "unknown" };
  }
}

function categorizeItemsByDuration(items) {
  return {
    temporary: items.filter(item => item.duration && Number(item.duration) > 0),
    permanent: items.filter(item => !item.duration || Number(item.duration) === 0)
  };
}
