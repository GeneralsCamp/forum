import { initAutoHeight } from "../shared/ResizeService.mjs";
import { findNewIDs } from "../shared/VersionService.mjs";
import { createLoader } from "../shared/LoadingService.mjs";
import { coreInit } from "../shared/CoreInit.mjs";
import { initImageModal } from "../shared/ModalService.mjs";
import { initLanguageSelector, getInitialLanguage } from "../shared/LanguageService.mjs";

// --- GLOBAL VARIABLES ---
let lang = {};
let ownLang = {};
let allItems = [];
let imageUrlMap = {};
let typeFilterCheckboxes = [];
let newItemIDsSet = new Set();
let showOnlyNew = false;
let effectDefinitions = {};
let effectCapsMap = {};
const percentEffectIDs = new Set();
const loader = createLoader();
let currentLanguage = getInitialLanguage();

// --- FETCH FUNCTIONS ---
async function compareWithOldVersion() {

    const newIDs = await findNewIDs({
        currentItems: allItems,
        extractItemsFn: extractConstructionItems,
        idField: "constructionItemID"
    });

    newItemIDsSet = newIDs;
    showOnlyNew = true;
    applyFiltersAndSorting();
}

async function loadOwnLang() {
    try {
        const res = await fetch("./ownLang.json");
        const rawLang = await res.json();

        function normalizeKeys(obj) {
            if (obj && typeof obj === "object" && !Array.isArray(obj)) {
                return Object.fromEntries(
                    Object.entries(obj).map(([k, v]) =>
                        [k.toLowerCase(), normalizeKeys(v)]
                    )
                );
            }
            if (Array.isArray(obj)) return obj.map(normalizeKeys);
            return obj;
        }

        ownLang = normalizeKeys(rawLang);

    } catch (err) {
        console.error("ownLang load error:", err);
        ownLang = {};
    }
}

async function applyOwnLang() {

    const L = ownLang[currentLanguage?.toLowerCase()] || {};
    const filters = L.filters || {};
    const ui = L.ui || {};

    const map = [
        ["filterName", "search_name", "Name"],
        ["filterID", "search_id", "ID"],
        ["filterEffect", "search_effect", "Effect"]
    ];

    map.forEach(([id, key, fallback]) => {
        const el = document.querySelector(`label[for="${id}"]`);
        if (el) el.textContent = filters[key] || fallback;
    });

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        const selected = Array
            .from(document.querySelectorAll(".search-filter:checked"))
            .map(cb => cb.value);

        const names = selected.map(v => {
            if (v === "name") return filters.search_name || "Name";
            if (v === "id") return filters.search_id || "ID";
            if (v === "effect") return filters.search_effect || "Effect";
            return v;
        });

        searchInput.placeholder =
            (filters.search_placeholder_prefix || "Search by: ")
            + names.join(", ");
    }

    const showFilter = document.getElementById("showFilter");
    if (showFilter) {
        if (showFilter.options[0])
            showFilter.options[0].text =
                filters.show_all || "Show all items";

        if (showFilter.options[1])
            showFilter.options[1].text =
                filters.show_new || "Show only new items";
    }

    const typeDropdown = document.getElementById("typeDropdown");
    if (typeDropdown)
        typeDropdown.textContent =
            filters.type_filter || "Type Filter";

    const typeMap = [
        ["filterPermanent", "type_permanent", "Permanent"],
        ["filterTemporary", "type_temporary", "Temporary"],
        ["filterAppearance", "type_appearance", "Appearance"],
        ["filterPrimary", "type_primary", "Primary"],
        ["filterRelic", "type_relic", "Relic"]
    ];

    typeMap.forEach(([id, key, fallback]) => {
        const el = document.querySelector(`label[for="${id}"]`);
        if (el) el.textContent = filters[key] || fallback;
    });

    window.UI_LANG = {
        effects: ui.effects || "Effects",
        dev_comments: ui.dev_comments || "Developer comments",
        type: ui.type || "Type",
        removal_cost: ui.removal_cost || "Removal Cost",
        non_removable: ui.non_removable || "Non removable",
        coins: ui.coins || "coins",
        temporary: ui.temporary || "Temporary",
        permanent: ui.permanent || "Permanent",
        primary: ui.primary || "Primary",
        appearance: ui.appearance || "Appearance",
        relic: ui.relic || "Relic",

        rarity_ordinary: ui.rarity_ordinary || "Ordinary",
        rarity_rare: ui.rarity_rare || "Rare",
        rarity_epic: ui.rarity_epic || "Epic",
        rarity_legendary: ui.rarity_legendary || "Legendary",
        rarity_appearance: ui.rarity_appearance || "Appearance",

        level: ui.level || "Level",
        public_order: ui.public_order || "Public order",

        no_image: ui.no_image || "no image"
    };
}

// --- EFFECTS AND LEGACY FIELD HANDLING ---
const legacyEffectFields = ["unitWallCount", "recruitSpeedBoost", "woodStorage", "stoneStorage", "ReduceResearchResourceCosts", "Stoneproduction", "Woodproduction", "Foodproduction", "foodStorage", "unboostedFoodProduction", "defensiveToolsSpeedBoost", "defensiveToolsCostsReduction", "meadStorage", "recruitCostReduction", "honeyStorage", "hospitalCapacity", "healSpeed", "marketCarriages", "XPBoostBuildBuildings", "stackSize", "glassStorage", "Glassproduction", "ironStorage", "Ironproduction", "coalStorage", "Coalproduction", "oilStorage", "Oilproduction", "offensiveToolsCostsReduction", "feastCostsReduction", "Meadreduction", "surviveBoost", "unboostedStoneProduction", "unboostedWoodProduction", "offensiveToolsSpeedBoost", "espionageTravelBoost"];

const effectNameOverrides = {
    "lootBonusPVE": "Loot bonus from NPC targets",
    "defenseBonusNotMainCastle": "Bonus to the strength of defensive units not in the main castle", //relicequip_effect_description_relicDefenseBonusNotMainCastleCapA_undefined with %
    "attackUnitAmountReinforcementBonus": "Troop capacity for final assault",
    "attackUnitAmountReinforcementBoost": "Troop capacity for final assault",
    "PublicOrderBonusMain": "Public order bonus in the main castle", //webshop_subscription_effect_description_publicOrderBonusMain_short without %
    "rangeBonusTCI": "Ranged unit attack strength when attacking", //ci_effect_offensiveRangeBonusTCI_tt with %
    "meleeBonusTCI": "Melee unit attack strength when attacking", //ci_effect_offensiveMeleeBonusTCI_tt with %
    "defenseUnitAmountYardMinorBoost": "Bonus to courtyard defense troop capacity", //effect_name_defenseUnitAmountYardBonus with %
};

function addLegacyEffects(item, effectsList) {
    function getLangKey(fieldName) {
        const lower = fieldName.toLowerCase();
        for (const key in lang) {
            const keyLower = key.toLowerCase();
            if (keyLower.endsWith('_tt') && keyLower.includes(lower)) {
                return lang[key];
            }
        }
        return fieldName;
    }

    legacyEffectFields.forEach(field => {
        const val = item[field];
        if (val !== undefined && val !== null && val !== "") {
            const effectName = getLangKey(field);

            const langKey = `ci_effect_${field.toLowerCase()}`;
            const isPercent = lang[langKey]?.includes("%");

            const formattedValue = isPercent
                ? `${formatNumber(val)}%`
                : formatNumber(val);

            const endsWithColon = effectName.trim().endsWith(":");
            const effectText = endsWithColon
                ? `${effectName} ${formattedValue}`
                : `${effectName}: ${formattedValue}`;

            effectsList.push(effectText);
        }
    });
}

function getLocalizedEffectName(effectDef, variant = null) {
    if (!effectDef) return null;

    const original = effectDef.name;
    const allLower = original.toLowerCase();

    if (effectNameOverrides[original]) return effectNameOverrides[original];
    if (effectNameOverrides[allLower]) return effectNameOverrides[allLower];

    const candidates = [];

    if (variant !== null) {

        candidates.push(`ci_effect_${allLower}_${variant}_tt`);

        candidates.push(`effect_name_${allLower}_${variant}`);
    }

    candidates.push(`effect_name_${allLower}`);
    candidates.push(`ci_effect_${allLower}_tt`);

    candidates.push(allLower);

    for (const key of candidates) {
        if (lang[key]) return lang[key];
        if (lang[key.toLowerCase()]) return lang[key.toLowerCase()];
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

// --- NAME LOCALIZATION HELPERS ---
function getCIName(item) {
    const rawName = (item.name || "???").toLowerCase();
    const prefixes = ["appearance", "primary", "secondary"];
    const suffixes = ["", "_premium"];

    for (const prefix of prefixes) {
        for (const suffix of suffixes) {
            const key = `ci_${prefix}_${rawName}${suffix}`;
            if (lang[key]) return lang[key];
        }
    }

    const keysToTry = [
        ...suffixes.map(s => `ci_${rawName}${s}`),
        rawName
    ];

    for (const key of keysToTry) {
        if (lang[key]) return lang[key];
    }

    return item.name;
}

function normalizeName(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// --- GROUPING AND VALUE CALCULATIONS ---
function extractConstructionItems(data) {
    return data.constructionItems || [];
}

function groupItemsByNameEffectsLegacyAppearanceAndDuration(items) {
    const groups = {};
    const testingRegex = /testing/i;

    items.forEach(item => {
        if ((item.comment1 && testingRegex.test(item.comment1)) ||
            (item.comment2 && testingRegex.test(item.comment2))) {
            return;
        }

        const effectIDs = item.effects
            ? Array.from(new Set(item.effects.split(",").map(eff => eff.split("&")[0])))
            : [];

        const allEffects = [...new Set(effectIDs)].sort().join(",");

        const legacyParts = legacyEffectFields
            .filter(f => item[f] !== undefined && item[f] !== null && item[f] !== "")
            .sort()
            .join(",");

        const appearanceFlag = (Number(item.slotTypeID) === 0 && item.decoPoints) ? "appearance" : "normal";
        const durationFlag = (item.duration && Number(item.duration) > 0) ? "temporary" : "permanent";

        const key = `${item.name}_${allEffects}_${legacyParts}_${appearanceFlag}_${durationFlag}_${item.slotTypeID}`;

        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });

    for (const key in groups) {
        groups[key].sort((a, b) => {
            const rarA = parseInt(a.rarenessID || 0);
            const rarB = parseInt(b.rarenessID || 0);

            if (rarA !== rarB) return rarA - rarB;

            const totalEffectA = getTotalEffectValue(a);
            const totalEffectB = getTotalEffectValue(b);

            return totalEffectA - totalEffectB;
        });
    }

    return groups;
}

function getTotalEffectValue(item) {
    let total = 0;

    if (item.effects) {
        item.effects.split(",").forEach(eff => {
            const [, valRaw] = eff.split("&");
            if (valRaw) {
                if (valRaw.includes("+")) {
                    const [, valPart] = valRaw.split("+");
                    total += Number(valPart) || 0;
                } else {
                    total += Number(valRaw) || 0;
                }
            }
        });
    };

    return total;
}

function getLevelText(item, rarityName) {

    const slotTypeID = Number(item.slotTypeID);
    const duration = item.duration ? Number(item.duration) : 0;
    const hasDecoPoints = !!item.decoPoints;

    if (slotTypeID === 1) {
        return `${UI_LANG.primary} (${UI_LANG.level} ${item.level})`;
    }

    if (slotTypeID === 0 && hasDecoPoints) {
        return UI_LANG.appearance;
    }

    if (slotTypeID === 0 && !hasDecoPoints && duration === 0) {
        return UI_LANG.permanent;
    }

    if (slotTypeID === 0 && !hasDecoPoints && duration > 0) {
        return `${rarityName} (${UI_LANG.level} ${item.level})`;
    }

    if (slotTypeID === 2) {
        return `${UI_LANG.relic} (${UI_LANG.level} ${item.level})`;
    }

    return `${UI_LANG.level} ${item.level}`;
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

// --- CARD CREATION (HTML RENDERING) ---
function createGroupedCard(groupItems, imageUrlMap = {}, groupKey = '') {

    let currentLevelIndex = 0;
    const safeKey = groupKey.replace(/[^a-zA-Z0-9]/g, '-');
    const groupId = `group-${safeKey}`;
    const name = getCIName(groupItems[0]);

    const rarenessNames = {
        1: UI_LANG.rarity_ordinary,
        2: UI_LANG.rarity_rare,
        3: UI_LANG.rarity_epic,
        4: UI_LANG.rarity_legendary,
        5: UI_LANG.rarity_appearance,
        10: UI_LANG.rarity_appearance
    };

    function renderLevel(index) {

        const item = groupItems[index];
        const isTemporary = !!item.duration;

        const removalCost = item.removalCostC1 || "0";

        const removalCostText =
            (removalCost === 0 || removalCost === "0")
                ? UI_LANG.non_removable
                : `${new Intl.NumberFormat().format(removalCost)} ${UI_LANG.coins}`;

        const commentList = [item.comment1, item.comment2].filter(Boolean);

        const normalizedName = normalizeName(item.name);
        const urls = imageUrlMap[normalizedName] || {};
        const placedUrl = urls.placedUrl || null;

        const safeName = name.replace(/'/g, "\\'");

        const isFirstLevel = index === 0;
        const isLastLevel = index === groupItems.length - 1;

        const rarityName = rarenessNames[item.rarenessID] || "Unknown";
        const levelText = getLevelText(item, rarityName);

        let effects = parseEffects(item.effects || "");
        addLegacyEffects(item, effects);

        if (item.decoPoints) {
            effects.push(`${UI_LANG.public_order}: ${formatNumber(item.decoPoints)}`);
        }

        let effectsHTML = "";
        if (effects.length > 0) {
            effectsHTML = `
        <div class="card-section card-effects border-top">
          <h5 class="card-section-title">${UI_LANG.effects}:</h5>
          <p>${effects.map(e => `- ${e}`).join("<br>")}</p>
        </div>`;
        }

        const id = item.constructionItemID || "???";
        const ciIdHTML =
            `<span class="wod-id" style="cursor:pointer;" onclick="navigator.clipboard.writeText('${id}')">${id}</span>`;

        const comments = [`constructionItemID: ${ciIdHTML}`, ...commentList];

        if (item.effects && item.effects.trim() !== "") {
            comments.push(`Effect IDs: ${item.effects}`);
        }

        let commentsHTML = "";
        if (comments.length > 0) {
            commentsHTML = `
        <div class="card-section card-sources border-top">
          <h4 class="card-section-title">${UI_LANG.dev_comments}:</h4>
          <p>${comments.map(c => `- ${c}`).join("<br>")}</p>
        </div>`;
        }

        const typeText =
            isTemporary
                ? `${UI_LANG.temporary} (${formatDuration(item.duration)})`
                : UI_LANG.permanent;

        const imageSection = placedUrl
            ? `
        <div class="col-5 card-cell border-end d-flex justify-content-center align-items-center position-relative ci-image"
             style="cursor:pointer;" data-src="${placedUrl}" data-caption="${safeName}">
          <div class="image-wrapper">
            <img src="${placedUrl}" 
                 data-modal-src="${placedUrl}" 
                 data-modal-caption="${safeName}" 
                 alt="${name}" 
                 class="card-image w-100" 
                 loading="lazy">
          </div>
          <span class="position-absolute bottom-0 end-0 p-1 rounded-circle m-1">
            <i class="bi bi-zoom-in"></i>
          </span>
        </div>`
            : `
        <div class="col-5 card-cell border-end d-flex justify-content-center align-items-center">
          <div class="image-wrapper">
            <div class="no-image-text">${UI_LANG.no_image || "no image"}</div>
          </div>
        </div>`;

        return `
      <div class="level-selector d-flex justify-content-between align-items-center">
        <button id="${groupId}-prev" ${isFirstLevel ? "disabled" : ""}>
          <i class="bi bi-arrow-left"></i>
        </button>

        <div><strong>${levelText}</strong></div>

        <button id="${groupId}-next" ${isLastLevel ? "disabled" : ""}>
          <i class="bi bi-arrow-right"></i>
        </button>
      </div>

      <h2 class="ci-title">${name}</h2>

      <div class="card-table border-top">
        <div class="row g-0">

          ${imageSection}

          <div class="col-7 card-cell d-flex flex-column">
            <div class="flex-fill d-flex flex-column justify-content-between h-100">

              <div class="card-cell border-bottom flex-fill d-flex flex-column justify-content-center">
                <strong>${UI_LANG.type}:</strong> ${typeText}
              </div>

              <div class="card-cell flex-fill d-flex flex-column justify-content-center">
                <strong>${UI_LANG.removal_cost}:</strong> ${removalCostText}
              </div>

            </div>
          </div>

        </div>
      </div>

      ${effectsHTML}
      ${commentsHTML}`;
    }

    const containerId = `${groupId}-container`;

    const cardHtml = `
    <div class="col-md-6 col-sm-12 d-flex flex-column">
      <div class="box flex-fill" id="${containerId}">
        <div class="box-content">
          ${renderLevel(currentLevelIndex)}
        </div>
      </div>
    </div>`;

    setTimeout(() => {

        const boxContent =
            document.querySelector(`#${containerId} .box-content`);

        function updateView() {
            boxContent.innerHTML = renderLevel(currentLevelIndex);
            bindEvents();
        }

        function bindEvents() {
            const prev =
                document.getElementById(`${groupId}-prev`);
            const next =
                document.getElementById(`${groupId}-next`);

            if (prev) prev.disabled = currentLevelIndex === 0;
            if (next) next.disabled =
                currentLevelIndex === groupItems.length - 1;

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
    const grouped = groupItemsByNameEffectsLegacyAppearanceAndDuration(items);
    container.innerHTML = "";

    Object.keys(grouped).forEach((key, index) => {
        const cardHtml = createGroupedCard(grouped[key], imageUrlMap, key);
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
    const selectedTypes = Array.from(typeFilterCheckboxes).filter(cb => cb.checked).map(cb => cb.value);

    const selectedFilters = Array.from(document.querySelectorAll(".search-filter:checked")).map(cb => cb.value);
    const hasSearchText = search.length > 0;
    const hasFilters = selectedFilters.length > 0;
    const onlyFullWords = selectedFilters.includes("fullwords");

    const filtered = allItems.filter(item => {
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
                const name = getCIName(item).toLowerCase();
                if (wordMatch(name)) matchSearch = true;
            }

            if (selectedFilters.includes("id")) {
                const id = (item.constructionItemID || "").toString().toLowerCase();
                if (wordMatch(id)) matchSearch = true;
            }

            if (selectedFilters.includes("effect")) {
                let effects = parseEffects(item.effects || "");
                const effectsText = effects.join(" ").toLowerCase();
                if (wordMatch(effectsText)) matchSearch = true;
            }
        }

        let matchesType = false;

        for (const type of selectedTypes) {
            if (type === "primary" && Number(item.slotTypeID) === 1) matchesType = true;
            if (type === "relic" && Number(item.slotTypeID) === 2) matchesType = true;
            if (type === "temporary" && item.duration) matchesType = true;
            if (type === "appearance" && item.decoPoints) matchesType = true;
            if (type === "permanent" && Number(item.slotTypeID) === 0 && !item.decoPoints && !item.duration) matchesType = true;
        }

        if (showOnlyNew && !newItemIDsSet.has(item.constructionItemID)) return false;

        return matchSearch && matchesType;
    });

    filtered.sort((a, b) =>
        Number(b.constructionItemID) - Number(a.constructionItemID)
    );

    renderConstructionItems(filtered);
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyHashSearch() {
    const hash = window.location.hash;
    if (!hash || hash.length <= 1) return;

    const id = hash.substring(1).trim();
    if (!id) return;

    const searchInput = document.getElementById("searchInput");
    const idFilter = document.getElementById("filterID");

    if (!searchInput || !idFilter) return;

    idFilter.checked = true;

    document.querySelectorAll(".search-filter").forEach(cb => {
        if (cb !== idFilter) cb.checked = false;
    });

    searchInput.disabled = false;
    searchInput.value = id;

    searchInput.dispatchEvent(new Event("input"));
}

function formatNumber(num) {
    return Number(num || 0).toLocaleString();
}

function setupEventListeners() {
    const searchInput = document.getElementById("searchInput");
    typeFilterCheckboxes = document.querySelectorAll(".type-filter");
    const searchFilters = document.querySelectorAll(".search-filter");
    const showFilter = document.getElementById("showFilter");

    showFilter.addEventListener("change", () => {
        const value = showFilter.value;

        if (value === "new") {
            compareWithOldVersion();
        } else {
            showOnlyNew = false;
            applyFiltersAndSorting();
        }
    });

    searchInput.addEventListener("input", applyFiltersAndSorting);

    typeFilterCheckboxes.forEach(cb => {
        cb.addEventListener("change", applyFiltersAndSorting);
    });

    function updateSearchInputState() {

        const L = ownLang[currentLanguage?.toLowerCase()] || {};
        const filters = L.filters || {};

        const selected = Array.from(searchFilters).filter(cb => cb.checked);

        if (selected.length === 0) {
            searchInput.disabled = true;
            searchInput.placeholder =
                filters.search_disabled || "Unavailable to search!";
            searchInput.value = "";
            return;
        }

        searchInput.disabled = false;

        const selectedLabels = selected.map(cb => {
            if (cb.value === "name")
                return filters.search_name || "Name";

            if (cb.value === "effect")
                return filters.search_effect || "Effect";

            if (cb.value === "id")
                return filters.search_id || "ID";

            return cb.value;
        });

        searchInput.placeholder =
            (filters.search_placeholder_prefix || "Search by: ")
            + selectedLabels.join(", ");
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

    document.querySelectorAll('.type-filter').forEach(input => {
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

// --- INITIALIZATION AND EVENT SETUP ---
initAutoHeight({
    contentSelector: "#content",
    subtractSelectors: [".note", ".page-title"],
    extraOffset: 18
});
async function init() {

    initImageModal();

    await coreInit({
        loader,
        langCode: currentLanguage,
        normalizeNameFn: normalizeName,
        itemLabel: "construction items",
        assets: {
            constructions: true
        },

        onReady: async ({
            lang: L,
            data,
            imageMaps,
            effectCtx
        }) => {

            lang = L;
            allItems = data.constructionItems || [];
            imageUrlMap = imageMaps.constructions || {};

            effectDefinitions = effectCtx.effectDefinitions;
            effectCapsMap = effectCtx.effectCapsMap;
            percentEffectIDs.clear();

            effectCtx.percentEffectIDs
                .forEach(id =>
                    percentEffectIDs.add(id)
                );

            initLanguageSelector({
                currentLanguage,
                lang,
                onSelect: () => location.reload()
            });

            await loadOwnLang();
            applyOwnLang();

            setupEventListeners();
            applyFiltersAndSorting();
            applyHashSearch();
        }
    });
}

init();