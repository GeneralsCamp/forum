import { initAutoHeight } from "../shared/ResizeService.mjs";
import { createLoader } from "../shared/LoadingService.mjs";
import { coreInit } from "../shared/CoreInit.mjs";
import { initImageModal } from "../shared/ModalService.mjs";
import { createEffectItemsModal, getAllianceLayoutName, itemHasEffectID } from "../shared/EffectItemsModal.mjs";
import { initLanguageSelector, getInitialLanguage } from "../shared/LanguageService.mjs";
import { deriveCompanionUrls } from "../shared/AssetComposer.mjs";
import { hydrateComposedImages } from "../shared/ComposeHydrator.mjs";
import { getSharedLanguagePack, getSharedText } from "../shared/SharedTextService.mjs";
import { createLazyList } from "../shared/LazyList.mjs";
import { revealCard } from "../shared/CardReveal.mjs";
import { findNewItemIdsFromPreviousVersions } from "../shared/VersionedItemsDiff.mjs";
import { getSelectedGameSource } from "../shared/GameSettings.mjs";

// --- GLOBAL VARIABLES ---
let lang = {};
let ownLang = {};
let allItems = [];
let allDecorations = [];
let allianceCoatLayouts = [];
let newItemIds = null;
let imageUrlMap = {};
let decorationImageUrlMap = {};
let allianceLayoutImageUrlMap = {};
let typeFilterCheckboxes = [];
let effectDefinitions = {};
let effectCapsMap = {};
let effectItemsModalController = null;
const percentEffectIDs = new Set();
const composedConstructionImageCache = new Map();
let constructionGroupBuildingsMap = new Map();
let noMatchMessage = "No match to the current filters.";
let sharedLangPack = { filters: {}, ui: {} };
const loader = createLoader();
let currentLanguage = getInitialLanguage();
const HOME_SETTINGS_KEY = "gf_home_settings";
const devCommentsEnabled = readHomeSetting("devCommentsEnabled", true);
const activeGameSource = getSelectedGameSource();
const INITIAL_BATCH_SIZE = 40;
const BATCH_SIZE = 30;
const SEARCH_REVEAL_BUFFER = 12;
let appliedSearchText = "";
const lazyList = createLazyList({
    containerSelector: "#cards",
    contentSelector: "#content",
    initialBatchSize: INITIAL_BATCH_SIZE,
    batchSize: BATCH_SIZE,
    revealBuffer: SEARCH_REVEAL_BUFFER,
    emptyHtml: () => `<div class="col-12 filter-empty-message">${noMatchMessage}</div>`,
    onRenderBatch: (groups, ctx) => appendGroups(groups, ctx),
    onAfterBatch: (ctx) => setupMaxCapClick(ctx.container)
});

function readHomeSetting(key, fallback) {
    try {
        const raw = localStorage.getItem(HOME_SETTINGS_KEY);
        const parsed = JSON.parse(raw || "{}");
        return parsed?.[key] ?? fallback;
    } catch {
        return fallback;
    }
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
    const filters = {
        ...(sharedLangPack.filters || {}),
        ...(L.filters || {})
    };
    const ui = {
        ...(sharedLangPack.ui || {}),
        ...(L.ui || {})
    };

    const map = [
        ["filterName", "name"],
        ["filterID", "id"],
        ["filterEffect", "effect"],
        ["filterBuilding", "building"]
    ];

    map.forEach(([id, value]) => {
        const el = document.querySelector(`label[for="${id}"]`);
        if (el) el.textContent = getSearchFilterLabel(value, filters);
    });

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        const selected = Array
            .from(document.querySelectorAll(".search-filter:checked"))
            .map(cb => cb.value);

        const names = selected.map(v => {
            return getSearchFilterLabel(v, filters);
        });

        searchInput.placeholder =
            (filters.search_placeholder_prefix || "Search by: ")
            + names.join(", ");
    }

    const typeDropdown = document.getElementById("typeDropdown");
    if (typeDropdown)
        typeDropdown.textContent =
            filters.type_filter || "Type Filter";

    const showFilter = document.getElementById("showFilter");
    if (showFilter?.options[0]) {
        showFilter.options[0].text = filters.show_all || "Show all items";
    }
    if (showFilter?.options[1]) {
        showFilter.options[1].text = filters.show_new || "Show only new items";
    }

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

        minute: ui.minute || "minute",
        minutes: ui.minutes || "minutes",
        can_be_placed_on: ui.can_be_placed_on || "Can be placed on",
        hour: ui.hour || "hour",
        hours: ui.hours || "hours",
        day: ui.day || "day",
        days: ui.days || "days",

        no_image: ui.no_image || "no image"
    };
}

function getSearchFilterLabel(value, filters = {}) {
    if (value === "name") return filters.search_name || "Name";
    if (value === "id") return filters.search_id || "ID";
    if (value === "effect") return filters.search_effect || "Effect";
    if (value === "building") return lang.filters_filter_40 || "Building";
    return value;
}

// --- EFFECTS AND LEGACY FIELD HANDLING ---
const legacyEffectFields = ["unitWallCount", "recruitSpeedBoost", "woodStorage", "stoneStorage", "ReduceResearchResourceCosts",
    "Stoneproduction", "Woodproduction", "Foodproduction", "foodStorage", "unboostedFoodProduction", "defensiveToolsSpeedBoost",
    "defensiveToolsCostsReduction", "meadStorage", "recruitCostReduction", "honeyStorage", "hospitalCapacity", "healSpeed",
    "marketCarriages", "XPBoostBuildBuildings", "stackSize", "glassStorage", "Glassproduction", "ironStorage", "Ironproduction",
    "coalStorage", "Coalproduction", "oilStorage", "Oilproduction", "offensiveToolsCostsReduction", "feastCostsReduction",
    "Meadreduction", "surviveBoost", "unboostedStoneProduction", "unboostedWoodProduction", "offensiveToolsSpeedBoost",
    "espionageTravelBoost"];

function addLegacyEffects(item, effectsList) {

    function getLangKey(fieldName) {
        const lower = fieldName.toLowerCase();
        for (const key in lang) {
            const keyLower = key.toLowerCase();
            if (keyLower.endsWith("_tt") && keyLower.includes(lower)) {
                return lang[key];
            }
        }
        return fieldName;
    }

    const renderedText = effectsList.join(" ").toLowerCase();

    legacyEffectFields.forEach(field => {

        const val = item[field];
        if (val === undefined || val === null || val === "") return;

        const template = lang[`ci_effect_${field.toLowerCase()}`];
        const labelFallback = getLangKey(field);

        if (template && template.includes("{0}")) {

            let label = template
                .replace(/\{0\}/g, "")
                .replace(/[%+\-]/g, "")
                .replace(/:+/g, "")
                .trim();

            label = label.charAt(0).toUpperCase() + label.slice(1);

            const templateHasMinus = /-\s*\{0\}/.test(template);
            const templateHasPlus = /\+\s*\{0\}/.test(template);

            let sign;
            if (templateHasMinus) sign = "-";
            else if (templateHasPlus) sign = "+";
            else sign = val < 0 ? "-" : "+";

            const absVal = Math.abs(val);

            const hasPercent = template.includes("%");
            const valueText =
                `${sign}${formatNumber(absVal)}${hasPercent ? "%" : ""}`;

            const rendered = `${label}: ${valueText}`;

            if (!renderedText.includes(rendered.toLowerCase())) {
                effectsList.push(rendered);
            }
            return;
        }

        const fallback = `${labelFallback}: ${formatNumber(val)}`;
        if (!renderedText.includes(fallback.toLowerCase())) {
            effectsList.push(fallback);
        }
    });
}

function getLocalizedEffectName(effectDef, variant = null) {
    if (!effectDef) return null;

    const original = effectDef.name;
    const lower = original.toLowerCase();

    const legacyTooltipKeys = [];

    if (variant !== null)
        legacyTooltipKeys.push(`ci_effect_${lower}_${variant}_tt`);

    legacyTooltipKeys.push(`ci_effect_${lower}_tt`);

    for (const key of legacyTooltipKeys) {
        if (lang[key]) return { text: lang[key], mode: "legacy" };
        if (lang[key.toLowerCase()])
            return { text: lang[key.toLowerCase()], mode: "legacy" };
    }

    const legacyNameKeys = [];

    if (variant !== null)
        legacyNameKeys.push(`effect_name_${lower}_${variant}`);

    legacyNameKeys.push(`effect_name_${lower}`);

    for (const key of legacyNameKeys) {
        if (lang[key]) return { text: lang[key], mode: "legacy" };
        if (lang[key.toLowerCase()])
            return { text: lang[key.toLowerCase()], mode: "legacy" };
    }

    const templateKeys = [
        `ci_effect_${lower}`,
        `subscription_effect_description_${lower}`
    ];

    for (const key of templateKeys) {
        if (lang[key]) return { text: lang[key], mode: "template" };
        if (lang[key.toLowerCase()])
            return { text: lang[key.toLowerCase()], mode: "template" };
    }

    return { text: original, mode: "fallback" };
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
        const loc = getLocalizedEffectName(effectDef, variant);

        const nameText = loc?.text || `Effect ID ${id}`;
        const mode = loc?.mode || "fallback";

        const effectName = String(effectDef?.name || "");
        const templateHasPercent =
            String(loc?.text || "").includes("%") ||
            /percent|percentage|boost/i.test(effectName);
        const suffix = (percentEffectIDs.has(id) || templateHasPercent) && !/unboosted/i.test(effectName) ? "%" : "";

        let maxStr = "";
        if (effectDef && effectDef.capID) {
            const cap = effectCapsMap[effectDef.capID];
            if (cap && cap.maxTotalBonus) {
                maxStr = ` <span class="max-bonus" role="button" tabindex="0" data-effectid="${id}" data-capid="${effectDef.capID}" title="Show all items with this effect">(Max: ${formatter.format(Number(cap.maxTotalBonus))}${suffix})</span>`;
            }
        }

        if (mode === "template") {

            let label = nameText
                .replace(/\{0\}/g, "")
                .replace(/[%+\-]/g, "")
                .replace(/:+/g, "")
                .trim();

            label = label.charAt(0).toUpperCase() + label.slice(1);

            const templateHasMinus = /-\s*\{0\}/.test(nameText);
            const templateHasPlus = /\+\s*\{0\}/.test(nameText);

            let sign;
            if (templateHasMinus) sign = "-";
            else if (templateHasPlus) sign = "+";
            else sign = val < 0 ? "-" : "+";

            const absVal = Math.abs(val);

            const valueText = `${sign}${formatter.format(absVal)}${suffix}`;

            return `${label}: ${valueText}${maxStr}`;
        }

        const needsColon = !nameText.includes(":");
        return `${nameText}${needsColon ? ":" : ""} ${formatter.format(val)}${suffix}${maxStr}`;
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

function getDecorationName(item) {
    const type = item.type || "";
    const keyOriginal = `deco_${type}_name`;
    const keyLower = `deco_${type.toLowerCase()}_name`;
    const keyFirstLower = `deco_${type.charAt(0).toLowerCase() + type.slice(1)}_name`;

    return lang[keyOriginal.toLowerCase()] || lang[keyLower.toLowerCase()] || lang[keyFirstLower.toLowerCase()] || type || "???";
}

function normalizeName(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getDecorationImage(item) {
    const normalizedType = normalizeName(item.type || "");
    const urls = decorationImageUrlMap[normalizedType] || {};
    return urls.placedUrl || urls.iconUrl || "assets/img/unknown.webp";
}

function getConstructionItemImage(item) {
    const normalizedName = normalizeName(item.name || "");
    const urls = imageUrlMap[normalizedName] || {};
    return urls.placedUrl || urls.iconUrl || "../../img_base/placeholder.webp";
}

function getConstructionItemType(item) {
    if (item.duration && Number(item.duration) > 0) return "TCI";
    return "CI";
}

function getLocalizedEffectTitle(effectID) {
    const effectDef = effectDefinitions?.[effectID];
    if (!effectDef) return `Effect ${effectID}`;

    const loc = getLocalizedEffectName(effectDef);
    const nameText = loc?.text || effectDef.name;

    if (loc?.mode === "template") {
        return nameText
            .replace(/\{0\}/g, "")
            .replace(/[%+\-]/g, "")
            .replace(/:+/g, "")
            .trim();
    }

    return nameText;
}

function extractDecorations(items) {
    return (items || []).filter(item =>
        item.name?.toLowerCase() === "deco" &&
        (item.decoPoints || item.initialFusionLevel) &&
        !(item.comment1?.toLowerCase().includes("test") || item.comment2?.toLowerCase().includes("test"))
    );
}

function getLocalizedBuildingName(buildingName) {
    const rawName = String(buildingName || "").trim();
    if (!rawName) return "";

    const langKey = `${rawName.toLowerCase()}_name`;
    return lang[langKey] || rawName;
}

function buildConstructionGroupBuildingsMap(buildings) {
    const map = new Map();

    (buildings || []).forEach(building => {
        const buildingName = getLocalizedBuildingName(building?.name);
        const rawGroupIds = String(building?.constructionItemGroupIDs || "").trim();
        if (!buildingName || !rawGroupIds) return;

        rawGroupIds
            .split(",")
            .map(id => id.trim())
            .filter(Boolean)
            .forEach(groupId => {
                if (!map.has(groupId)) {
                    map.set(groupId, new Set());
                }
                map.get(groupId).add(buildingName);
            });
    });

    return new Map(
        Array.from(map.entries()).map(([groupId, names]) => [
            groupId,
            Array.from(names).sort((a, b) => a.localeCompare(b))
        ])
    );
}

function getPlacementBuildingNames(item) {
    const groupId = String(item?.constructionItemGroupID || "").trim();
    if (!groupId) return [];
    return constructionGroupBuildingsMap.get(groupId) || [];
}

// --- GROUPING AND VALUE CALCULATIONS ---
function extractConstructionItems(data) {
    const items = data?.constructionItems || [];
    return Array.isArray(items)
        ? items
        : Object.values(items || {});
}

async function loadNewItemIds(currentVersion) {
    return findNewItemIdsFromPreviousVersions({
        currentVersion,
        currentItems: allItems,
        extractItems: extractConstructionItems,
        getId: item => item.constructionItemID,
        source: activeGameSource,
        logLabel: "construction item"
    });
}

async function prepareNewItemFilter(currentVersion) {
    const showFilter = document.getElementById("showFilter");
    if (!showFilter) return;

    showFilter.disabled = true;
    newItemIds = await loadNewItemIds(currentVersion);
    showFilter.disabled = false;
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

            if (Number(a.slotTypeID) === 1 && Number(b.slotTypeID) === 1) {
                return Number(a.level || 0) - Number(b.level || 0);
            }

            const rarA = Number(a.rarenessID || 0);
            const rarB = Number(b.rarenessID || 0);
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

    if (days)
        result += `${days} ${days === 1 ? UI_LANG.day : UI_LANG.days} `;

    if (hours)
        result += `${hours} ${hours === 1 ? UI_LANG.hour : UI_LANG.hours} `;

    if (mins)
        result += `${mins} ${mins === 1 ? UI_LANG.minute : UI_LANG.minutes}`;

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
        const shouldCompose = typeof placedUrl === "string" &&
            placedUrl.startsWith("https://empire-html5.goodgamestudios.com/default/assets/itemassets/") &&
            /\.(webp|png)$/i.test(placedUrl);
        const composeSource = shouldCompose ? deriveCompanionUrls(placedUrl) : null;
        const composeAttrs = composeSource
            ? `data-compose-asset="1" data-image-url="${composeSource.imageUrl}" data-json-url="${composeSource.jsonUrl}" data-js-url="${composeSource.jsUrl}"`
            : "";

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
          <div class="reward-effect-list">
            ${effects.map(e => `<div class="reward-effect-row">${e}</div>`).join("")}
          </div>
        </div>`;
        }

        const id = item.constructionItemID || "???";
        const ciIdHTML =
            `<span class="wod-id" style="cursor:pointer;" onclick="navigator.clipboard.writeText('${id}')">${id}</span>`;

        const comments = [`constructionItemID: ${ciIdHTML}`, ...commentList];

        if (item.effects && item.effects.trim() !== "") {
            comments.push(`Effect IDs: ${item.effects}`);
        }

        const placementBuildings = getPlacementBuildingNames(item);
        const placementText =
            placementBuildings.length > 0 ? placementBuildings.join(", ") : "-";

        let commentsHTML = "";
        if (devCommentsEnabled && comments.length > 0) {
            commentsHTML = `
        <div class="card-section card-sources border-top">
          <h4 class="card-section-title">${UI_LANG.dev_comments}:</h4>
          <div class="reward-effect-list">
            ${comments.map(c => `<div class="reward-effect-row">${c}</div>`).join("")}
          </div>
        </div>`;
        }

        const typeText =
            isTemporary
                ? `${UI_LANG.temporary} (${formatDuration(item.duration)})`
                : UI_LANG.permanent;

        const imageSection = placedUrl
            ? `
        <div class="col-5 card-cell border-end d-flex justify-content-center align-items-center position-relative ci-image"
             style="cursor:pointer;" data-src="${placedUrl}" data-caption="${safeName}" data-modal-src="${placedUrl}" data-modal-caption="${safeName}">
          <div class="image-wrapper">
            <img src="${placedUrl}" 
                 data-modal-src="${placedUrl}" 
                 data-modal-caption="${safeName}" 
                 alt="${name}" 
                 class="card-image w-100" 
                 loading="lazy"
                 ${composeAttrs}>
          </div>
          <span class="position-absolute bottom-0 end-0 p-1 rounded-circle m-1">
            <i class="bi bi-zoom-in"></i>
          </span>
        </div>`
            : `
        <div class="col-5 card-cell border-end d-flex justify-content-center align-items-center">
          <div class="image-wrapper">
            <img src="../../img_base/placeholder.webp"
                 alt="${UI_LANG.no_image || "no image"}"
                 class="card-image w-100"
                 loading="lazy">
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

              <div class="card-cell border-top flex-fill d-flex flex-column justify-content-center">
                <strong>${UI_LANG.can_be_placed_on}:</strong> ${placementText}
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
            void hydrateComposedImages({
                root: boxContent,
                cache: composedConstructionImageCache,
                onApplied: (img, dataUrl) => {
                    img.dataset.modalSrc = dataUrl;
                }
            });
            bindEvents();
            setupMaxCapClick(boxContent);
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

function buildGroupedList(items) {
    const grouped = groupItemsByNameEffectsLegacyAppearanceAndDuration(items);
    return Object.keys(grouped).map(key => ({
        key,
        items: grouped[key]
    }));
}

function appendGroups(groups, { container, sentinel }) {
    const fragment = document.createDocumentFragment();

    groups.forEach(group => {
        const cardHtml = createGroupedCard(group.items, imageUrlMap, group.key);
        const wrapper = document.createElement("div");
        wrapper.innerHTML = cardHtml;
        const card = wrapper.firstElementChild;

        fragment.appendChild(revealCard(card));
    });

    container.insertBefore(fragment, sentinel);

    void hydrateComposedImages({
        root: container,
        cache: composedConstructionImageCache,
        onApplied: (img, dataUrl) => {
            img.dataset.modalSrc = dataUrl;
        }
    });
}

function resetRenderState(groups, { revealIndex = null } = {}) {
    lazyList.reset(groups, {
        revealIndex,
        emptyHtml: () => `<div class="col-12 filter-empty-message">${noMatchMessage}</div>`
    });
}

// --- FILTERING, SEARCH, SORTING ---
function findRevealIndex(groups, search, selectedFilters) {
    if (!search) return null;

    if (selectedFilters.includes("id")) {
        const exactId = groups.findIndex(group =>
            group.items.some(item => String(item.constructionItemID || "") === search)
        );
        if (exactId !== -1) return exactId;
    }

    if (selectedFilters.includes("name")) {
        const normalizedSearch = normalizeName(search);
        const exactName = groups.findIndex(group =>
            group.items.some(item => normalizeName(getCIName(item)) === normalizedSearch)
        );
        if (exactName !== -1) return exactName;
    }

    return null;
}

function applyFiltersAndSorting({ revealId = null, exactId = null } = {}) {
    const search = appliedSearchText.toLowerCase().trim();
    const showMode = document.getElementById("showFilter")?.value || "all";
    const selectedTypes = Array.from(typeFilterCheckboxes).filter(cb => cb.checked).map(cb => cb.value);

    const selectedFilters = Array.from(document.querySelectorAll(".search-filter:checked")).map(cb => cb.value);
    const hasSearchText = search.length > 0;
    const hasFilters = selectedFilters.length > 0;
    const onlyFullWords = selectedFilters.includes("fullwords");

    const filtered = exactId
        ? allItems.filter(item => String(item.constructionItemID || "") === String(exactId))
        : allItems.filter(item => {
        if (showMode === "new") {
            if (newItemIds === null) return true;

            const id = String(item.constructionItemID || "");
            if (!newItemIds?.has(id)) return false;
        }

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

            if (selectedFilters.includes("building")) {
                const placementText = getPlacementBuildingNames(item).join(" ").toLowerCase();
                if (wordMatch(placementText)) matchSearch = true;
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

        return matchSearch && matchesType;
    });

    filtered.sort((a, b) =>
        Number(b.constructionItemID) - Number(a.constructionItemID)
    );

    const groupedList = buildGroupedList(filtered);

    let revealIndex = null;
    if (revealId) {
        revealIndex = groupedList.findIndex(group =>
            group.items.some(item => String(item.constructionItemID || "") === String(revealId))
        );
    } else {
        revealIndex = findRevealIndex(groupedList, search, selectedFilters);
    }

    resetRenderState(groupedList, { revealIndex });
}

function getDecorationEffectModalItems(effectID, getPrimaryEffectByID, getEffectValueByID) {
    return allDecorations
        .filter(item => itemHasEffectID(item.areaSpecificEffects || "", effectID))
        .map(item => ({
            kind: "Deco",
            name: getDecorationName(item),
            id: item.wodID || "???",
            imageUrl: getDecorationImage(item),
            effectText: getPrimaryEffectByID(item.areaSpecificEffects || "", effectID),
            sortValue: getEffectValueByID(item.areaSpecificEffects || "")
        }));
}

function getConstructionEffectModalItems(effectID, getPrimaryEffectByID, getEffectValueByID) {
    const testingRegex = /testing/i;

    return allItems
        .filter(item =>
            !(item.comment1 && testingRegex.test(item.comment1)) &&
            !(item.comment2 && testingRegex.test(item.comment2)) &&
            itemHasEffectID(item.effects || "", effectID)
        )
        .map(item => ({
            kind: getConstructionItemType(item),
            name: getCIName(item),
            id: item.constructionItemID || "???",
            imageUrl: getConstructionItemImage(item),
            effectText: getPrimaryEffectByID(item.effects || "", effectID),
            sortValue: getEffectValueByID(item.effects || "")
        }));
}

function getAllianceEffectModalItems(effectID, getPrimaryEffectByID, getEffectValueByID) {
    return allianceCoatLayouts
        .filter(item => itemHasEffectID(item.effects || "", effectID))
        .map(item => ({
            kind: "Alliance CoA",
            name: getAllianceLayoutName({ layout: item, lang }),
            id: item.allianceCoatLayoutID || "???",
            imageUrl: allianceLayoutImageUrlMap[String(item.allianceCoatLayoutID || "")] || "../../img_base/placeholder.webp",
            effectText: getPrimaryEffectByID(item.effects || "", effectID),
            sortValue: getEffectValueByID(item.effects || "")
        }));
}

function setupMaxCapClick(root = document) {
    effectItemsModalController?.bind(root);
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
    appliedSearchText = id;

    applyFiltersAndSorting({ revealId: id, exactId: id });
}

function formatNumber(num) {
    return Number(num || 0).toLocaleString();
}

function setupEventListeners() {
    const searchInput = document.getElementById("searchInput");
    const searchButton = document.getElementById("searchButton");
    const showFilter = document.getElementById("showFilter");
    typeFilterCheckboxes = document.querySelectorAll(".type-filter");
    const searchFilters = document.querySelectorAll(".search-filter");
    function runSearch() {
        if (searchInput.disabled) return;
        appliedSearchText = searchInput.value || "";
        applyFiltersAndSorting();
    }

    searchButton?.addEventListener("click", runSearch);
    searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            runSearch();
        }
    });

    typeFilterCheckboxes.forEach(cb => {
        cb.addEventListener("change", applyFiltersAndSorting);
    });

    showFilter?.addEventListener("change", () => {
        applyFiltersAndSorting();
    });

    function updateSearchInputState() {

        const L = ownLang[currentLanguage?.toLowerCase()] || {};
        const filters = {
            ...(sharedLangPack.filters || {}),
            ...(L.filters || {})
        };

        const selected = Array.from(searchFilters).filter(cb => cb.checked);

        if (selected.length === 0) {
            searchInput.disabled = true;
            if (searchButton) searchButton.disabled = true;
            searchInput.placeholder =
                filters.search_disabled || "Unavailable to search!";
            searchInput.value = "";
            appliedSearchText = "";
            return;
        }

        searchInput.disabled = false;
        if (searchButton) searchButton.disabled = false;

        const selectedLabels = selected.map(cb => {
            return getSearchFilterLabel(cb.value, filters);
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

    document.querySelectorAll('#filterName, #filterID, #filterEffect, #filterBuilding').forEach(input => {
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
    try {
        initImageModal();
        effectItemsModalController = createEffectItemsModal({
            getEffectDefinitions: () => effectDefinitions,
            getEffectCapsMap: () => effectCapsMap,
            getPercentEffectIDs: () => percentEffectIDs,
            getLang: () => lang,
            parseEffectEntry: parseEffects,
            getLocalizedEffectTitle,
            getRows: ({ effectID, getPrimaryEffectByID, getEffectValueByID }) => [
                ...getDecorationEffectModalItems(effectID, getPrimaryEffectByID, getEffectValueByID),
                ...getConstructionEffectModalItems(effectID, getPrimaryEffectByID, getEffectValueByID),
                ...getAllianceEffectModalItems(effectID, getPrimaryEffectByID, getEffectValueByID)
            ]
        });

        await coreInit({
            loader,
            langCode: currentLanguage,
            normalizeNameFn: normalizeName,
            itemLabel: "construction items",

            assets: {
                decorations: true,
                constructions: true,
                allianceLayouts: true
            },

            onReady: async ({
                lang: L,
                data,
                imageMaps,
                effectCtx,
                versions
            }) => {

                lang = L;
                allItems = data.constructionItems || [];
                allDecorations = extractDecorations(data.buildings || []);
                allianceCoatLayouts = data.allianceCoatLayouts || data.alliancecoatlayouts || [];
                constructionGroupBuildingsMap =
                    buildConstructionGroupBuildingsMap(data.buildings || []);
                decorationImageUrlMap = imageMaps.decorations || {};
                imageUrlMap = imageMaps.constructions || {};
                allianceLayoutImageUrlMap = imageMaps.allianceLayouts || {};

                effectDefinitions = effectCtx.effectDefinitions;
                effectCapsMap = effectCtx.effectCapsMap;

                percentEffectIDs.clear();
                effectCtx.percentEffectIDs.forEach(id =>
                    percentEffectIDs.add(id)
                );

                initLanguageSelector({
                    currentLanguage,
                    lang,
                    onSelect: () => location.reload()
                });

                await loadOwnLang();
                sharedLangPack = await getSharedLanguagePack(currentLanguage);
                applyOwnLang();
                noMatchMessage = await getSharedText("no_match_filters", currentLanguage, noMatchMessage);

                setupEventListeners();
                await prepareNewItemFilter(versions?.itemVersion);
                applyFiltersAndSorting();
                applyHashSearch();
            }
        });
    } catch (err) {
        console.error(err);
        loader.error("Something went wrong...", 30);
    }
}

init();
