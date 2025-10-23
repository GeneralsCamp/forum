// --- PROXY AND GLOBAL VARIABLES ---
const myProxy = "https://my-proxy-8u49.onrender.com/";
const fallbackProxy = "https://corsproxy.io/?";

const availableLanguages = ["en", "de", "fr", "pl", "hu", "ro", "es", "ru", "el", "nl", "cs", "ar", "it", "ja"];

let browserLanguage = navigator.language || "en";
let primaryLang = browserLanguage.split("-")[0];

if (availableLanguages.includes(primaryLang)) {
  currentLanguage = primaryLang;
} else {
  currentLanguage = "en";
}

let langModal;
let ownLang = {};

let lang = {};
let selectedSizes = new Set();
let currentSort = "po";
let allDecorations = [];
let imageUrlMap = {};
let currentFilter = "all";
let specialFilter = null;
let newWodIDsSet = new Set();

// --- FETCH FUNCTIONS (WITH FALLBACK, VERSIONS, DATA) ---
async function fetchWithFallback(url, timeout = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(myProxy + url, { signal: controller.signal });
    if (!response.ok) throw new Error("myProxy: bad response");
    return response;
  } catch (err) {
    console.warn("Proxy error:", err);

    const encodedUrl = encodeURIComponent(url);
    const fallbackResponse = await fetch(fallbackProxy + encodedUrl);
    if (!fallbackResponse.ok) throw new Error("fallbackProxy: bad response");
    return fallbackResponse;
  } finally {
    clearTimeout(timer);
  }
}

async function getItemVersion() {
  const url = "https://empire-html5.goodgamestudios.com/default/items/ItemsVersion.properties";
  const res = await fetchWithFallback(url);
  const text = await res.text();
  const match = text.match(/CastleItemXMLVersion=(\d+\.\d+)/);
  if (!match) throw new Error("Version: error");
  return match[1];
}

async function getLangVersion() {
  const url = "https://langserv.public.ggs-ep.com/12/fr/@metadata";
  const res = await fetchWithFallback(url);
  const json = await res.json();
  return json["@metadata"].versionNo;
}

async function getLanguageData(version) {
  const url = `https://langserv.public.ggs-ep.com/12@${version}/${currentLanguage}/*`;
  const res = await fetchWithFallback(url);
  const data = await res.json();
  lang = lowercaseKeysRecursive(data);
}

async function getItems(version) {
  const url = `https://empire-html5.goodgamestudios.com/default/items/items_v${version}.json`;
  const res = await fetchWithFallback(url);
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

  percentEffectIDs.clear();
  Object.values(effectDefinitions).forEach(effect => {
    const descKey = `equip_effect_description_${effect.name}`.toLowerCase();
    const description = lang[descKey];
    if (description && description.includes('%') && !descKey.includes('unboosted')) {
      percentEffectIDs.add(effect.effectID);
    }
  });

  if (Array.isArray(data.units)) {
    units = data.units;
  }

  return data;
}

async function compareWithOldVersion(oldVersion) {
  const currentVersionInfo = await getCurrentVersionInfo();
  const currentVersion = currentVersionInfo.version;

  if (!oldVersion) {
    const [majorStr] = currentVersion.split(".");
    let major = parseInt(majorStr, 10);

    let found = false;

    while (major > 0 && !found) {
      for (let minor = 1; minor <= 5; minor++) {
        const candidate = `${major - 1}.${String(minor).padStart(2, "0")}`;
        try {
          const testUrl = `https://empire-html5.goodgamestudios.com/default/items/items_v${candidate}.json`;
          const testRes = await fetchWithFallback(testUrl);
          if (testRes.ok) {
            oldVersion = candidate;
            found = true;
            break;
          }
        } catch (e) {
        }
      }
      if (!found) {
        major--;
      }
    }

    if (!found) {
      console.warn("No previous version found.");
      return;
    }
  }

  let oldDecorations = [];
  let addedWodIDs = [];

  while (true) {
    const [majorStr, minorStr] = oldVersion.split(".");
    let major = parseInt(majorStr, 10);
    let minor = parseInt(minorStr, 10);

    let foundNew = false;

    while (major > 0 && !foundNew) {
      while (minor > 0) {
        const candidate = `${major}.${String(minor).padStart(2, "0")}`;
        const url = `https://empire-html5.goodgamestudios.com/default/items/items_v${candidate}.json`;
        try {
          const res = await fetchWithFallback(url);
          if (res.ok) {
            const jsonOld = await res.json();
            const oldDecorations = extractDecorations(jsonOld.buildings);
            const oldWodIDs = new Set(oldDecorations.map(d => d.wodID));
            const newWodIDs = new Set(allDecorations.map(d => d.wodID));
            const added = Array.from(newWodIDs).filter(id => !oldWodIDs.has(id));
            if (added.length > 0) {
              oldVersion = candidate;
              addedWodIDs = added;
              foundNew = true;
              break;
            }
          }
        } catch (e) { }
        minor--;
      }
      major--;
      minor = 5;
    }

    break;
  }

  if (addedWodIDs.length === 0) {
    newWodIDsSet = new Set();
    specialFilter = null;
  } else {
    newWodIDsSet = new Set(addedWodIDs);
    specialFilter = "new";
  }

  applyFiltersAndSorting();
}

async function getCurrentVersionInfo() {
  try {
    const urlVersion = "https://empire-html5.goodgamestudios.com/default/items/ItemsVersion.properties";
    const resVersion = await fetchWithFallback(urlVersion);
    if (!resVersion.ok) throw new Error("Failed to fetch current version");

    const text = await resVersion.text();
    const match = text.match(/CastleItemXMLVersion=(\d+\.\d+)/);
    if (!match) throw new Error("Version not found");
    const version = match[1];

    const urlJson = `https://empire-html5.goodgamestudios.com/default/items/items_v${version}.json`;
    const resJson = await fetchWithFallback(urlJson);
    if (!resJson.ok) throw new Error("Failed to fetch version JSON");
    const json = await resJson.json();

    const date = json.versionInfo?.date?.["@value"] || "unknown";
    return { version, date };
  } catch (e) {
    console.warn("Error fetching current version info:", e);
    return { version: "unknown", date: "unknown" };
  }
}

function setupLanguageSelector() {
  const langBtn = document.getElementById("languageButtonContainer");
  const langModalEl = document.getElementById("languageModal");
  const langList = document.getElementById("languageList");
  const modalTitle = langModalEl.querySelector(".modal-title");

  if (!langModal) {
    langModal = new bootstrap.Modal(langModalEl, { keyboard: true });
  }

  modalTitle.innerText = lang?.dialog_allLanguages_desc || "All languages";

  langList.innerHTML = "";
  availableLanguages.forEach((code) => {
    const col = document.createElement("div");
    col.className = "col-12 col-md-6 mb-2";

    const btn = document.createElement("button");
    btn.className = "btn w-100 text-center lang-btn fw-bold";
    btn.style.backgroundColor = "#f3e0c2";
    btn.style.color = "#433120";

    const langLabel = lang[`language_native_${code}`] || code.toUpperCase();
    btn.innerHTML = langLabel;
    btn.dataset.lang = code;

    if (code === currentLanguage) {
      btn.disabled = true;
      btn.style.opacity = "0.6";
    }

    btn.addEventListener("click", async () => {
      currentLanguage = code;
      localStorage.setItem("selectedLanguage", code);
      langModal.hide();
      await reloadLanguage();
    });

    col.appendChild(btn);
    langList.appendChild(col);
  });

  langBtn.addEventListener("click", (e) => {
    e.preventDefault();
    langModal.show();
  });
}

async function reloadLanguage() {
  try {
    const version = await getLangVersion();
    await getLanguageData(version);
    await loadOwnLang();
    applyOwnLang();
    handleResize();

    applyFiltersAndSorting();
    setupLanguageSelector();
  } catch (err) {
    console.error("Error reloading language:", err);
  }
}

async function loadOwnLang() {
  try {
    const res = await fetch("./ownLang.json");
    const rawLang = await res.json();

    function normalizeKeys(obj) {
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        return Object.fromEntries(
          Object.entries(obj).map(([key, val]) => [key.toLowerCase(), normalizeKeys(val)])
        );
      } else if (Array.isArray(obj)) {
        return obj.map(normalizeKeys);
      }
      return obj;
    }

    ownLang = normalizeKeys(rawLang);
  } catch (err) {
    console.error("Error loading ownLang.json:", err);
    ownLang = {};
  }
}

async function applyOwnLang() {
  const filters = ownLang[currentLanguage.toLowerCase()]?.filters || {};

  document.querySelector('label[for="filterName"]').textContent = filters.search_name || "Name";
  document.querySelector('label[for="filterID"]').textContent = filters.search_id || "ID";
  document.querySelector('label[for="filterEffect"]').textContent = filters.search_effect || "Effect";

  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.options[0].text = filters.sort_po || "Sort by Public Order";
    sortSelect.options[1].text = filters.sort_pot || "Sort by Public Order/Tile";
  }

  const showFilter = document.getElementById('showFilter');
  if (showFilter) {
    showFilter.options[0].text = filters.show_all || "Show all decorations";
    showFilter.options[1].text = filters.show_new || "Show only new decorations";
    const lastCapOption = document.getElementById('lastCapOption');
    if (lastCapOption) lastCapOption.text = filters.show_selected_effect || "Selected effect";
  }

  const sizeDropdown = document.getElementById('sizeDropdown');
  if (sizeDropdown) sizeDropdown.textContent = filters.size_filter || "Size Filter";

  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    const selectedFilters = Array.from(document.querySelectorAll(".search-filter:checked")).map(cb => cb.value);
    const selectedLabels = selectedFilters.map(f => {
      if (f === "name") return filters.search_name || "Name";
      if (f === "id") return filters.search_id || "ID";
      if (f === "effect") return filters.search_effect || "Effect";
      return f;
    });
    searchInput.placeholder = (filters.search_placeholder_prefix || "Search by: ") + selectedLabels.join(", ");
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  const savedLang = localStorage.getItem("selectedLanguage");
  if (savedLang) currentLanguage = savedLang;
  await reloadLanguage();
});

function lowercaseKeysRecursive(input) {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map(lowercaseKeysRecursive);
  if (typeof input === 'object') {
    const out = {};
    Object.keys(input).forEach(key => {
      const lowerKey = key.toString().toLowerCase();
      out[lowerKey] = lowercaseKeysRecursive(input[key]);
    });
    return out;
  }
  return input;
}

// --- EFFECTS AND LEGACY FIELD HANDLING ---
const effectKeyOverrides = {
  "effect_name_AttackBoostFlankCapped": { key: "effect_group_1_5_passive", percent: true },
  "effect_name_AttackBoostFrontCapped": { key: "effect_group_1_4_passive", percent: true },
  "effect_name_defenseUnitAmountYardMinorBoost": { key: "effect_name_defenseUnitAmountYardBonus", percent: true },
  "effect_name_AttackUnitAmountFrontCapped": { key: "effect_name_attackUnitAmountFrontCapped", percent: true },
  "effect_name_AttackBoostYardCapped": { key: "effect_name_attackBoostYard", percent: true }
};

const percentEffectIDs = new Set();

function parseEffects(effectsStr) {
  if (!effectsStr) return [];

  const formatter = new Intl.NumberFormat(navigator.language);
  const results = [];

  effectsStr.split(",").forEach(eff => {
    const [id, rest] = eff.split("&");
    const effectDef = effectDefinitions[id];

    let baseKey = effectDef ? "effect_name_" + effectDef.name : "";
    let isPercent = percentEffectIDs.has(id);

    const override = effectKeyOverrides[baseKey];
    if (override) {
      baseKey = override.key;
      isPercent = !!override.percent;
    }

    const normalizedKey = baseKey.toLowerCase();
    let localizedTemplate = effectDef ? (lang[normalizedKey] || effectDef.name) : `Effect ID ${id}`;
    const suffix = isPercent ? "%" : "";

    if (rest.includes("+")) {
      const [subType, valStr] = rest.split("+");
      const val = Number(valStr);

      let unitName = `Unit ${subType}`;
      const unit = units.find(u => u.wodID == subType);
      if (unit) {
        const key = unit.type;
        const unitKey = (key + "_name").toLowerCase();
        unitName = lang[unitKey] || unit.type;
        if (unit.level != null) unitName += ` (lvl.${unit.level})`;
      }

      let templateKey = ("effect_name_" + effectDef.name).toLowerCase();
      const templateOverride = effectKeyOverrides[templateKey];
      if (templateOverride) {
        templateKey = templateOverride.key.toLowerCase();
        isPercent = !!templateOverride.percent;
      }

      localizedTemplate = lang[templateKey] || effectDef.name;
      const localizedName = localizedTemplate.replace("{1}", unitName);

      if (!isNaN(val)) {
        let maxStr = "";
        if (effectDef?.capID) {
          const cap = effectCapsMap[effectDef.capID];
          if (cap?.maxTotalBonus) {
            maxStr = ` <span class="max-bonus">(Max: ${formatter.format(Number(cap.maxTotalBonus))}${suffix})</span>`;
          }
        }
        results.push(`${localizedName}: ${formatter.format(val)}${suffix}${maxStr}`);
      } else {
        results.push(`${localizedName}: Invalid value (${rest})`);
      }
    } else {
      const val = Number(rest);
      if (!isNaN(val)) {
        let maxStr = "";
        if (effectDef?.capID) {
          const cap = effectCapsMap[effectDef.capID];
          if (cap?.maxTotalBonus) {
            maxStr = ` <span class="max-bonus" data-capid="${effectDef.capID}" style="cursor:pointer">(Max: ${formatter.format(Number(cap.maxTotalBonus))}${suffix})</span>`;
          }
        }
        results.push(`${localizedTemplate}: ${formatter.format(val)}${suffix}${maxStr}`);
      } else {
        results.push(`${localizedTemplate}: Invalid value (${rest})`);
      }
    }
  });

  return results;
}

// --- NAME LOCALIZATION HELPERS ---
function getName(item) {
  const type = item.type || "";
  const keyOriginal = `deco_${type}_name`;
  const keyLower = `deco_${type.toLowerCase()}_name`;
  const keyFirstLower = `deco_${type.charAt(0).toLowerCase() + type.slice(1)}_name`;

  return lang[keyOriginal.toLowerCase()] || lang[keyLower.toLowerCase()] || lang[keyFirstLower.toLowerCase()] || type || "???";
}

function normalizeName(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// --- GET VALUES & CALCULATIONS ---
function extractDecorations(buildings) {
  return buildings.filter(b =>
    b.name?.toLowerCase() === "deco" &&
    getPO(b) > 0 &&
    !(
      (b.comment1 && b.comment1.toLowerCase().includes("test")) ||
      (b.comment2 && b.comment2.toLowerCase().includes("test"))
    )
  );
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

// --- SIZE FILTERS ---
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

    li.innerHTML = `
      <div class="form-check">
        <input class="form-check-input size-filter-checkbox" type="checkbox" value="${size}" id="size-${size}" checked>
        <label class="form-check-label" for="size-${size}">${size}</label>
      </div>
    `;

    sizeFiltersContainer.appendChild(li);
  });

  document.querySelectorAll('#sizeFilters .form-check').forEach(formCheck => {
    formCheck.addEventListener('click', function (e) {
      const target = e.target;
      const isCheckbox = target.classList.contains('form-check-input');
      const isLabel = target.tagName.toLowerCase() === 'label';

      if (!isCheckbox && !isLabel) {
        const checkbox = formCheck.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event("change"));
        }
      }
      e.stopPropagation();
    });
  });

  document.querySelectorAll(".size-filter-checkbox").forEach(checkbox => {
    checkbox.addEventListener("change", () => {
      updateSelectedSizes();
      applyFiltersAndSorting();
    });
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

// --- CARD CREATION (HTML RENDERING) ---
function createCard(item, imageUrlMap = {}) {
  const langData = ownLang[currentLanguage] || {};

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
  const fusion = isFusionSource && isFusionTarget ? langData.fusion_both :
    isFusionSource ? langData.fusion_source :
      isFusionTarget ? langData.fusion_target : langData.fusion_none;

  let sellPriceDisplay = "";
  if (item.sellLegendaryToken || item.sellLegendaryMaterial) {
    const parts = [];
    if (item.sellLegendaryToken) parts.push(`<img src="./img/construction-token.png" class="effect-icon">x${formatNumber(item.sellLegendaryToken)}`);
    if (item.sellLegendaryMaterial) parts.push(`<img src="./img/upgrade-token.png" class="effect-icon">x${formatNumber(item.sellLegendaryMaterial)}`);
    sellPriceDisplay = parts.join("<br>");
  } else {
    const sellPriceRaw = item.sellC1 || "0";
    if (Number(sellPriceRaw) === 0 && item.sellSoldierBiscuit) {
      sellPriceDisplay = `<img src="./img/biscuit.png" class="effect-icon">x${formatNumber(item.sellSoldierBiscuit)}`;
    } else {
      sellPriceDisplay = `<img src="./img/coin.png" class="effect-icon">x${formatNumber(sellPriceRaw)}`;
    }
  }

  const id = item.wodID || "???";
  const sources = [item.comment1, item.comment2].filter(Boolean);
  const wodIDHTML = `<span class="wod-id" style="cursor:pointer;" onclick="navigator.clipboard.writeText('${id}')">${id}</span>`;
  sources.unshift(`wodID: ${wodIDHTML}`);
  if (item.maximumCount) sources.splice(1, 0, `Maximum count per castle: ${item.maximumCount}`);

  const effects = parseEffects(item.areaSpecificEffects || "");
  let effectsHTML = "";
  if (effects.length > 0) {
    effectsHTML = `
      <hr>
      <div class="card-section card-effects">
        <h5 class="card-section-title">${langData.label_effects}</h5>
        <p>${effects.map(e => `- ${e}`).join("<br>")}</p>
      </div>`;
  }

  let sourceHTML = "";
  if (sources.length > 0) {
    sourceHTML = `
      <hr>
      <div class="card-section card-sources">
        <h4 class="card-section-title">${langData.label_developer_comments}</h4>
        <p>${sources.map(s => `- ${s}`).join("<br>")}</p>
      </div>`;
  }

  const cleanedType = normalizeName(item.type);
  const imageUrl = imageUrlMap[cleanedType] || "assets/img/unknown.webp";
  const safeName = name.replace(/'/g, "\\'");

  return `
  <div class="col-md-6 col-sm-12 d-flex flex-column">
    <div class="box flex-fill">
      <div class="box-content">
        <h2 class="deco-title">${name}</h2>
        <hr>
        <div class="card-table">
          <div class="row g-0">
            <div class="col-4 card-cell border-end d-flex justify-content-center align-items-center position-relative" style="cursor:pointer;" onclick="openImageModal('${imageUrl}', '${safeName}')">
              <div class="image-wrapper">
                <img src="${imageUrl}" class="card-image w-100" loading="lazy">
              </div>
              <span class="position-absolute bottom-0 end-0 p-1 rounded-circle m-1">
                 <i class="bi bi-zoom-in"></i>
              </span>
            </div>
            <div class="col-8 card-cell">
              <div class="row g-0">
                <div class="col-6 card-cell border-end">
                  <strong>${langData.label_public_order}</strong><br><img src="./img/po.png" class="effect-icon">${formatNumber(po)}
                </div>
                <div class="col-6 card-cell">
                  <strong>${langData.label_po_per_tile}</strong><br><img src="./img/po.png" class="effect-icon">${poPerTile}
                </div>
              </div>
              <hr>
              <div class="row g-0">
                <div class="col-6 card-cell border-end">
                  <strong>${langData.label_size}</strong><br><img src="./img/size.png" class="effect-icon">${size}
                </div>
                <div class="col-6 card-cell">
                  <strong>${langData.label_might_points}</strong><br><img src="./img/might.png" class="effect-icon">${formatNumber(might)}
                </div>
              </div>
              <hr>
              <div class="row g-0">
                <div class="col-6 card-cell border-end">
                  <strong>${langData.label_sale_price}</strong><br>${sellPriceDisplay}
                </div>
                <div class="col-6 card-cell">
                  <strong>${langData.label_fusion}</strong><br>${fusion}
                </div>
              </div>
            </div>
          </div>
        </div>
        ${effectsHTML}
        ${sourceHTML}
      </div>
    </div>
  </div>`;
}

function renderDecorations(decos) {
  const container = document.getElementById("cards");
  container.innerHTML = "";

  decos.forEach((item, index) => {
    const cardHtml = createCard(item, imageUrlMap);
    const wrapper = document.createElement("div");
    wrapper.innerHTML = cardHtml;
    const card = wrapper.firstElementChild;

    card.classList.add("card-hidden");

    setTimeout(() => {
      card.classList.add("card-visible");
    }, 50);

    container.appendChild(card);
  });
}

// --- FILTERING, SEARCH, SORTING ---
function applyFiltersAndSorting() {
  const search = document.getElementById("searchInput").value.toLowerCase().trim();

  const selectedFilters = Array.from(document.querySelectorAll(".search-filter:checked")).map(cb => cb.value);
  const hasSearchText = search.length > 0;
  const hasFilters = selectedFilters.length > 0;
  const onlyFullWords = selectedFilters.includes("fullwords");

  const filtered = allDecorations.filter(item => {
    if (specialFilter === "new" && !newWodIDsSet.has(item.wodID)) return false;
    if (specialFilter && specialFilter.startsWith("cap-")) {
      const capID = specialFilter.slice(4);
      if (!item.areaSpecificEffects || !item.areaSpecificEffects.split(",").some(eff => {
        const [id] = eff.split("&");
        const effectDef = effectDefinitions[id];
        return effectDef && effectDef.capID === capID;
      })) return false;
    }

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
  setupMaxCapClick();
}

function setupMaxCapClick() {
  const langData = ownLang[currentLanguage]?.filters || {};
  document.querySelectorAll(".max-bonus").forEach(span => {
    span.addEventListener("click", () => {
      const capID = span.dataset.capid;
      if (!capID) return;

      specialFilter = `cap-${capID}`;

      const showFilter = document.getElementById("showFilter");
      if (showFilter) {
        let lastCapOption = document.getElementById("lastCapOption");

        if (!lastCapOption) {
          lastCapOption = document.createElement("option");
          lastCapOption.id = "lastCapOption";
          lastCapOption.disabled = false;
          showFilter.appendChild(lastCapOption);
        }

        lastCapOption.value = `cap-${capID}`;
        lastCapOption.text = langData.show_selected_effect || "Selected effect";
        lastCapOption.disabled = false;
        lastCapOption.selected = true;

        showFilter.dataset.previousValue = lastCapOption.value;
        showFilter.dataset.previousText = lastCapOption.text;
      }

      applyFiltersAndSorting();
    });
  });
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatNumber(num) {
  return Number(num).toLocaleString(undefined);
}

function setupEventListeners() {
  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");
  const searchFilters = document.querySelectorAll(".search-filter");
  const showFilter = document.getElementById("showFilter");

  searchInput.addEventListener("input", applyFiltersAndSorting);

  function updateSearchInputState() {
    const searchInput = document.getElementById("searchInput");
    const selected = Array.from(document.querySelectorAll(".search-filter:checked")).map(cb => cb.value);
    if (selected.length === 0) {
      searchInput.disabled = true;
      searchInput.placeholder = "Unavailable to search!";
      searchInput.value = "";
    } else {
      searchInput.disabled = false;
      const filters = ownLang[currentLanguage]?.filters || {};
      const selectedLabels = selected.map(f => {
        if (f === "name") return filters.search_name || "Name";
        if (f === "effect") return filters.search_effect || "Effect";
        if (f === "id") return filters.search_id || "ID";
        return f;
      });
      searchInput.placeholder = (filters.search_placeholder_prefix || "Search by: ") + selectedLabels.join(", ");
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

      if (val.startsWith("cap-")) {
        specialFilter = val;
        applyFiltersAndSorting();
        return;
      }

      if (val === "new") {
        specialFilter = "new";
        if (newWodIDsSet.size === 0) {
          await compareWithOldVersion();
        } else {
          applyFiltersAndSorting();
        }
      } else {
        specialFilter = null;
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

  document.querySelectorAll('#filterName, #filterID, #filterEffect').forEach(input => {
    const formCheckDiv = input.closest('.form-check');
    if (!formCheckDiv) return;

    formCheckDiv.addEventListener('click', (e) => {
      const target = e.target;
      if (target !== input && target.tagName.toLowerCase() !== 'label') {
        input.checked = !input.checked;
        input.dispatchEvent(new Event('change'));
      }
      e.stopPropagation();
    });
  });

  updateSearchInputState();
}

// --- IMAGE LOADING (DLL PARSING) ---
async function getImageUrlMap() {
  const base = "https://empire-html5.goodgamestudios.com/default/assets/itemassets/";

  try {
    const indexUrl = "https://empire-html5.goodgamestudios.com/default/index.html";
    const indexRes = await fetchWithFallback(indexUrl);
    const indexHtml = await indexRes.text();

    const dllMatch = indexHtml.match(/<link\s+id=["']dll["']\s+rel=["']preload["']\s+href=["']([^"']+)["']/i);
    const dllRelativeUrl = dllMatch[1];
    const dllUrl = `https://empire-html5.goodgamestudios.com/default/${dllRelativeUrl}`;

    console.log("");
    console.log(`DLL version: ${dllRelativeUrl}`);
    console.log(`DLL URL: %c${dllUrl}`, "color:blue; text-decoration:underline;");
    console.log("");

    const dllRes = await fetchWithFallback(dllUrl);
    const text = await dllRes.text();

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

    console.log(`Found ${allDecorations.length} decorations, and created ${Object.keys(imageUrlMap).length} URL map entries.`);

    return imageUrlMap;
  } catch (error) {
    console.error("getImageUrlMap error", error);
    return {};
  }
}

// --- MODAL HANDLING ---
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

// --- INITIALIZATION AND EVENT SETUP ---
function handleResize() {
  const select = document.getElementById('showFilter');
  const langData = ownLang[currentLanguage]?.filters || {};

  if (select) {
    const isMobile = window.innerWidth < 576;
    select.options[0].text = isMobile
      ? (langData.show_all_short || "Show all")
      : (langData.show_all || "Show all decorations");

    select.options[1].text = isMobile
      ? (langData.show_new_short || "Show newest")
      : (langData.show_new || "Show only new decorations");
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

function setLoadingProgress(step, totalSteps, text) {
  const status = document.getElementById("loadingStatus");
  const bar = document.getElementById("loadingProgress");
  const percentText = document.getElementById("loadingPercentText");

  if (!status || !bar || !percentText) return;

  const targetPercent = Math.round((step / totalSteps) * 100);
  status.textContent = text;

  let currentPercent = parseInt(bar.style.width) || 0;
  const interval = setInterval(() => {
    if (currentPercent >= targetPercent) {
      clearInterval(interval);
      return;
    }
    currentPercent++;
    bar.style.width = currentPercent + "%";
    percentText.textContent = currentPercent + "%";
  }, 25);
}

async function init() {
  try {
    const totalSteps = 5;
    let step = 0;

    setLoadingProgress(++step, totalSteps, "Checking item version...");
    const itemVersion = await getItemVersion();
    const itemUrl = `https://empire-html5.goodgamestudios.com/default/items/items_v${itemVersion}.json`;
    console.log(`Item version: ${itemVersion}`);
    console.log(`Item URL: %c${itemUrl}`, "color:blue; text-decoration:underline;");
    console.log("");

    setLoadingProgress(++step, totalSteps, "Checking language version...");
    const langVersion = await getLangVersion();
    const langUrl = `https://langserv.public.ggs-ep.com/12@${langVersion}/en/*`;
    console.log(`Language version: ${langVersion}`);
    console.log(`Language URL: %c${langUrl}`, "color:blue; text-decoration:underline;");

    setLoadingProgress(++step, totalSteps, "Loading language data...");
    await getLanguageData(langVersion);

    setLoadingProgress(++step, totalSteps, "Loading decorations...");
    const json = await getItems(itemVersion);
    allDecorations = extractDecorations(json.buildings);

    setLoadingProgress(++step, totalSteps, "Loading images...");
    imageUrlMap = await getImageUrlMap();
    await loadOwnLang();

    setLoadingProgress(totalSteps, totalSteps, "Rendering decorations...");
    renderSizeFilters(allDecorations);
    setupEventListeners();
    applyFiltersAndSorting();

    const loadingBox = document.getElementById("loadingBox");
    if (loadingBox) loadingBox.style.display = "none";

  } catch (err) {
    console.error("Error:", err);
    const loadingBox = document.getElementById("loadingBox");
    if (loadingBox) {
      loadingBox.innerHTML = `
        <h3>Something went wrong...</h3>
        <p>The page will automatically reload in <span id="retryCountdown">30</span> seconds!</p>
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
}

init();