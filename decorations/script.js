const proxy = "https://corsproxy.io/?";
let lang = {};
let selectedSizes = new Set();
let currentSort = "po";
let allDecorations = [];
let imageUrlMap = {};
let currentFilter = "all";
let showOnlyNew = false;
let newWodIDsSet = new Set();

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

  Object.values(effectDefinitions).forEach(effect => {
    const descKey = `equip_effect_description_${effect.name}`;
    const description = lang[descKey];
    if (description && description.includes('%') && !descKey.includes('Unboosted')) {
      percentEffectIDs.add(effect.effectID);
    }
  });

  hardcodedPercentEffectIDs.forEach(id => {
    if (!percentEffectIDs.has(id)) {
      percentEffectIDs.add(id);
    }
  });

  return data;
}

function extractDecorations(buildings) {
  const decorations = buildings.filter(b =>
    b.name?.toLowerCase() === "deco" &&
    getPO(b) > 0 &&
    !(
      (b.comment1 && b.comment1.toLowerCase().includes("test")) ||
      (b.comment2 && b.comment2.toLowerCase().includes("test"))
    )
  );
  console.log(`Found ${decorations.length} decorations`);
  return decorations;
}

function getName(item) {
  const type = item.type || "";
  const keyOriginal = `deco_${type}_name`;
  const keyLower = `deco_${type.toLowerCase()}_name`;
  const keyFirstLower = `deco_${type.charAt(0).toLowerCase() + type.slice(1)}_name`;

  return lang[keyOriginal] || lang[keyLower] || lang[keyFirstLower] || type || "???";
}

function getSize(item) {
  return `${item.width}x${item.height}`;
}

function getPO(item) {
  if (item.decoPoints !== undefined && item.decoPoints !== null) {
    return parseInt(item.decoPoints);
  }
  if (item.initialFusionLevel !== undefined && item.initialFusionLevel !== null) {
    const level = parseInt(item.initialFusionLevel);
    if (!isNaN(level)) {
      return 100 + level * 5;
    }
  }
  return 0;
}

function getFusionStatus(item) {
  const isSource = item.isFusionSource === "1";
  const isTarget = item.isFusionTarget === "1";

  if (isSource && isTarget) return "target & source";
  if (isSource) return "source";
  if (isTarget) return "target";
  return "-";
}

const hardcodedPercentEffectIDs = new Set([
  "61", "62", "370", "386", "387", "413", "414", "415",
  "381", "382", "408", "383", "384", "82", "83", "388",
  "389", "390", "391", "392", "393", "409", "394", "395",
  "396", "611", "416", "397", "398", "399", "612", "417",
  "369", "368", "410", "411", "412", "423", "424", "407",
  "501", "705", "66", "614", "504", "503", "613", "114",
  "80", "401", "402", "373", "259", "701", "343", "202",
  "340", "339", "11", "363", "404", "403"
]);

const percentEffectIDs = new Set();

const effectNameOverrides = {
  "effect_name_AttackBoostFlankCapped": "Combat strength of units when attacking the flanks",
  "effect_name_defenseUnitAmountYardMinorBoost": "Bonus to courtyard defense troop capacity",
  "effect_name_AttackUnitAmountFrontCapped": "Increase front unit limit when attacking",
  "effect_name_AttackBoostYardCapped": "Bonus to courtyard attack combat strength"
};

function parseEffects(effectsStr) {
  if (!effectsStr) return [];

  const formatter = new Intl.NumberFormat(navigator.language);

  return effectsStr.split(",").map(eff => {
    const [id, valRaw] = eff.split("&");
    const val = Number(valRaw);
    const effectDef = effectDefinitions[id];

    const localizedName = effectDef
      ? (effectNameOverrides[`effect_name_${effectDef.name}`] || lang[`effect_name_${effectDef.name}`] || effectDef.name)
      : `Effect ID ${id}`;

    const suffix = percentEffectIDs.has(id) ? "%" : "";

    let maxStr = "";
    if (effectDef && effectDef.capID) {
      const cap = effectCapsMap[effectDef.capID];
      if (cap && cap.maxTotalBonus) {
        maxStr = ` <span class="max-bonus">(Max: ${formatter.format(Number(cap.maxTotalBonus))}${suffix})</span>`;
      }
    }

    return `${localizedName}: ${formatter.format(val)}${suffix}${maxStr}`;
  });
}

function formatNumber(num) {
  return Number(num).toLocaleString(undefined);
}

function toPascalCase(str) {
  return str
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function normalizeName(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function createCard(item, imageUrlMap = {}) {
  const name = getName(item);
  const size = getSize(item);
  const width = parseInt(item.width);
  const height = parseInt(item.height);
  const area = width * height;
  const po = getPO(item);
  const poPerTile = area > 0 ? (po / area).toFixed(2) : "N/A";
  const might = item.mightValue || "0";

  const isFusionSource = item.isFusionSource === "1";
  const isFusionTarget = item.isFusionTarget === "1";
  const fusion = isFusionSource && isFusionTarget ? "Source & Target" :
    isFusionSource ? "Source" :
      isFusionTarget ? "Target" : "none";

  const sellPriceRaw = item.sellC1 || "0";
  let sellPriceDisplay;

  if (Number(sellPriceRaw) === 0 && item.sellSoldierBiscuit) {
    sellPriceDisplay = `${formatNumber(item.sellSoldierBiscuit)} biscuits`;
  } else {
    sellPriceDisplay = `${formatNumber(sellPriceRaw)} coins`;
  }

  const sources = [item.comment1, item.comment2].filter(Boolean);
  const id = item.wodID || "???";

  const effects = parseEffects(item.areaSpecificEffects || "");
  let effectsHTML = "";
  if (effects.length > 0) {
    effectsHTML = `
    <hr>
    <div class="card-section card-effects">
      <h5 class="card-section-title">Effects:</h5>
      <p>${effects.map(e => `- ${e}`).join("<br>")}</p>
    </div>
  `;
  }

  let sourceHTML = "";
  if (sources.length > 0) {
    sourceHTML = `
    <hr>
    <div class="card-section card-sources">
      <h4 class="card-section-title">Developer comments:</h4>
      <p>${sources.map(s => `- ${s}`).join("<br>")}</p>
    </div>
  `;
  }

  const cleanedType = normalizeName(item.type);
  const imageUrl = imageUrlMap[cleanedType] || "assets/img/unknown.webp";

  const safeName = name.replace(/'/g, "\\'");

  return `
  <div class="col-md-6 col-sm-12 d-flex flex-column">
    <div class="box flex-fill">
      <div class="box-content">
        <h2 class="deco-title">${name} <br> (wodID: ${id})</h2>
        <hr>
        <div class="image-wrapper">
          <img src="${imageUrl}" alt="${name}" class="card-image" onclick="openImageModal('${imageUrl}', '${safeName}')">
        </div>
        <hr>
        <div class="card-table">
          <div class="row g-0">
            <div class="col-6 card-cell border-end">
              <strong>Public order:</strong><br>${formatNumber(po)}
            </div>
            <div class="col-6 card-cell">
              <strong>Public order/tile:</strong><br>${poPerTile}
            </div>
          </div>
          <hr>
          <div class="row g-0">
            <div class="col-6 card-cell border-end">
              <strong>Size:</strong><br>${size}
            </div>
            <div class="col-6 card-cell">
              <strong>Might points:</strong><br>${formatNumber(might)}
            </div>
          </div>
          <hr>
          <div class="row g-0">
            <div class="col-6 card-cell border-end">
              <strong>Sale price:</strong><br>${sellPriceDisplay}
            </div>
            <div class="col-6 card-cell">
              <strong>Fusion:</strong><br>${fusion}
            </div>
          </div>
        </div>
          ${effectsHTML}
          ${sourceHTML}
      </div>
    </div>
  </div>
  `;
}

function renderDecorations(decos) {
  const container = document.getElementById("cards");
  container.innerHTML = decos.map(item => createCard(item, imageUrlMap)).join("");
}

function getAvailableSizes(items) {
  const sizes = new Set();
  items.forEach(item => {
    const size = getSize(item);
    if (size) sizes.add(size);
  });

  return [...sizes].sort((a, b) => {
    const [aW, aH] = a.split('x').map(Number);
    const [bW, bH] = b.split('x').map(Number);
    const aArea = aW * aH;
    const bArea = bW * bH;
    return bArea - aArea;
  });
}

function renderSizeFilters(allDecorations) {
  const sizeFiltersContainer = document.getElementById("sizeFilters");
  sizeFiltersContainer.innerHTML = "";

  const sizes = getAvailableSizes(allDecorations);
  sizes.forEach(size => {
    const li = document.createElement("li");

    const div = document.createElement("div");
    div.className = "form-check";

    const checkbox = document.createElement("input");
    checkbox.className = "form-check-input";
    checkbox.type = "checkbox";
    checkbox.value = size;
    checkbox.id = `size-${size}`;
    checkbox.checked = true;

    checkbox.addEventListener("change", () => {
      updateSelectedSizes();
      applyFiltersAndSorting();
    });

    const label = document.createElement("label");
    label.className = "form-check-label";
    label.htmlFor = `size-${size}`;
    label.textContent = size;

    div.appendChild(checkbox);
    div.appendChild(label);
    li.appendChild(div);
    sizeFiltersContainer.appendChild(li);
  });

  updateSelectedSizes();
}

function updateSelectedSizes() {
  const checkboxes = document.querySelectorAll("#sizeFilters input[type='checkbox']");
  selectedSizes.clear();
  checkboxes.forEach(cb => {
    if (cb.checked) {
      selectedSizes.add(cb.value);
    }
  });
}

function applyFiltersAndSorting() {
  const search = document.getElementById("searchInput").value.toLowerCase().trim();

  const selectedFilters = Array.from(document.querySelectorAll(".search-filter:checked")).map(cb => cb.value);
  const hasSearchText = search.length > 0;
  const hasFilters = selectedFilters.length > 0;
  const onlyFullWords = selectedFilters.includes("fullwords");

  const filtered = allDecorations.filter(item => {
    if (showOnlyNew && !newWodIDsSet.has(item.wodID)) return false;

    const size = getSize(item);
    if (!selectedSizes.has(size)) return false;

    let matchSearch = true;

    if (hasSearchText && hasFilters) {
      matchSearch = false;

      function wordMatch(text) {
        if (!text) return false;
        if (onlyFullWords) {
          const pattern = new RegExp(`\\b${escapeRegExp(search)}\\b`, 'i');
          return pattern.test(text);
        } else {
          return text.includes(search);
        }
      }

      if (selectedFilters.includes("name")) {
        const name = getName(item).toLowerCase();
        if (wordMatch(name)) matchSearch = true;
      }

      if (selectedFilters.includes("id")) {
        const wodID = (item.wodID || "").toString().toLowerCase();
        if (wordMatch(wodID)) matchSearch = true;
      }

      if (selectedFilters.includes("effect")) {
        const effectsText = parseEffects(item.areaSpecificEffects || "").join(" ").toLowerCase();
        if (wordMatch(effectsText)) matchSearch = true;
      }
    }

    return matchSearch;
  });

  filtered.sort((a, b) => {
    const va = currentSort === "po" ? getPO(a) : getPO(a) / (a.width * a.height);
    const vb = currentSort === "po" ? getPO(b) : getPO(b) / (b.width * b.height);
    return vb - va;
  });

  renderDecorations(filtered);
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function setupEventListeners() {
  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");
  const searchFilters = document.querySelectorAll(".search-filter");
  const showFilter = document.getElementById("showFilter");

  searchInput.addEventListener("input", applyFiltersAndSorting);

  function updateSearchInputState() {
    const selected = Array.from(searchFilters).filter(cb => cb.checked);
    if (selected.length === 0) {
      searchInput.disabled = true;
      searchInput.placeholder = "Unavailable to search!";
      searchInput.value = "";
    } else {
      searchInput.disabled = false;
      const selectedLabels = selected.map(cb => {
        if (cb.value === "name") return "Name";
        if (cb.value === "effect") return "Effect";
        if (cb.value === "id") return "ID";
        return cb.value;
      });
      searchInput.placeholder = "Search by: " + selectedLabels.join(", ");
    }
  }

  sortSelect.addEventListener("change", () => {
    const val = sortSelect.value;
    currentSort = val === "pot" ? "pot" : "po";
    applyFiltersAndSorting();
  });

  if (showFilter) {
    showFilter.addEventListener("change", async () => {
      const val = showFilter.value;
      if (val === "new") {
        if (newWodIDsSet.size === 0) {
          await compareWithOldVersion();
        } else {
          showOnlyNew = true;
          applyFiltersAndSorting();
        }
      } else {
        showOnlyNew = false;
        applyFiltersAndSorting();
      }
    });
  }

  searchFilters.forEach(cb => {
    cb.addEventListener("change", () => {
      updateSearchInputState();
      applyFiltersAndSorting();
    });
  });

  updateSearchInputState();
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
    console.log("DLL URL:", dllRelativeUrl);

    const dllUrl = `https://empire-html5.goodgamestudios.com/default/${dllRelativeUrl}`;

    const res = await fetch(proxy + dllUrl);
    if (!res.ok) throw new Error("Failed to fetch ggs.dll.js: " + res.status);

    const text = await res.text();
    const regex = /Building\/Deco\/[^\s"'`<>]+?--\d+/g;
    const matches = [...text.matchAll(regex)];

    const uniquePaths = [...new Set(matches.map(m => m[0]))];

    const imageUrlMap = {};
    for (const path of uniquePaths) {
      const fileName = path.split('/').pop();
      const nameWithTimestamp = fileName.split('--')[0];
      const cleanNameRaw = nameWithTimestamp.replace(/^Deco_Building_/, '');
      const cleanName = normalizeName(cleanNameRaw);
      imageUrlMap[cleanName] = `${base}${path}.webp`;
    }

    console.log(`${Object.keys(imageUrlMap).length} deco URL map is created.`);
    return imageUrlMap;

  } catch (error) {
    console.error("getImageUrlMap error", error);
    return {};
  }
}

async function init() {
  try {
    const itemVersion = await getItemVersion();
    const langVersion = await getLangVersion();
    console.log("Item version:", itemVersion, "| Language version:", langVersion);

    await getLanguageData(langVersion);
    imageUrlMap = await getImageUrlMap();

    const json = await getItems(itemVersion);
    allDecorations = extractDecorations(json.buildings);

    renderSizeFilters(allDecorations);
    setupEventListeners();
    applyFiltersAndSorting();
  } catch (err) {
    console.error("Error:", err);
    const cardsEl = document.getElementById("cards");
    cardsEl.innerHTML = `
      <div class="error-message">
        <h3>Something went wrong...</h3>
        <p>The page will automatically reload in <span id="retryCountdown">30</span> seconds!</p>
      </div>
    `;

    let seconds = 30;
    const countdownEl = document.getElementById("retryCountdown");

    const interval = setInterval(() => {
      seconds--;
      if (countdownEl) countdownEl.textContent = seconds.toString();
      if (seconds <= 0) {
        clearInterval(interval);
        location.reload();
      }
    }, 1000);
  }
}

init();

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

async function compareWithOldVersion(oldVersion) {
  const currentVersionInfo = await getCurrentVersionInfo();
  const currentVersion = currentVersionInfo.version;

  if (!oldVersion) {
    const [majorStr] = currentVersion.split(".");
    let major = parseInt(majorStr, 10);
    oldVersion = `${major - 1}.01`;
  }

  let oldDecorations = [];
  let addedWodIDs = [];

  while (true) {
    const urlOld = proxy + encodeURIComponent(`https://empire-html5.goodgamestudios.com/default/items/items_v${oldVersion}.json`);
    const resOld = await fetch(urlOld);
    if (!resOld.ok) return;

    const jsonOld = await resOld.json();
    oldDecorations = extractDecorations(jsonOld.buildings);

    const oldWodIDs = new Set(oldDecorations.map(d => d.wodID));
    const newWodIDs = new Set(allDecorations.map(d => d.wodID));
    addedWodIDs = Array.from(newWodIDs).filter(id => !oldWodIDs.has(id));

    if (addedWodIDs.length > 0 || oldVersion.startsWith("1")) break;

    const [majorStr] = oldVersion.split(".");
    const major = parseInt(majorStr, 10);
    oldVersion = `${major - 1}.01`;
  }

  if (addedWodIDs.length === 0) {
    newWodIDsSet = new Set();
  } else {
    newWodIDsSet = new Set(addedWodIDs);
  }

  showOnlyNew = true;
  applyFiltersAndSorting();
}

function countBySize(items) {
  const counts = {};
  items.forEach(item => {
    const size = getSize(item);
    counts[size] = (counts[size] || 0) + 1;
  });
  return counts;
}

async function getCurrentVersionInfo() {
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

function handleResize() {
  const select = document.getElementById('showFilter');
  if (select) {
    const isMobile = window.innerWidth < 576;
    select.options[0].text = isMobile ? "Show all" : "Show all decorations";
    select.options[1].text = isMobile ? "Show newest" : "Show only new decorations";
  }

  const note = document.querySelector('.note');
  const pageTitle = document.querySelector('.page-title');
  const content = document.getElementById('content');

  if (note && pageTitle && content) {
    const totalHeightToSubtract = note.offsetHeight + pageTitle.offsetHeight + 18;
    const newHeight = window.innerHeight - totalHeightToSubtract;
    content.style.height = `${newHeight}px`;
  }
}
window.addEventListener('resize', handleResize);
window.addEventListener('DOMContentLoaded', handleResize);
