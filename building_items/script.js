// --- PROXY AND GLOBAL VARIABLES ---
const myProxy = "https://my-proxy-8u49.onrender.com/";
const fallbackProxy = "https://corsproxy.io/?";

let lang = {};
let allItems = [];
let imageUrlMap = {};
let currentFilter = "all";
let typeFilterCheckboxes = [];
let newItemIDsSet = new Set();
let showOnlyNew = false;

// --- FETCH FUNCTIONS (WITH FALLBACK, VERSIONS, DATA) ---
async function fetchWithFallback(url) {
    try {
        const response = await fetch(myProxy + url);
        if (!response.ok) throw new Error("myProxy: bad response");
        return response;
    } catch (err) {
        console.warn("Proxy error:", err);
        const encodedUrl = encodeURIComponent(url);
        const fallbackResponse = await fetch(fallbackProxy + encodedUrl);
        if (!fallbackResponse.ok) throw new Error("fallbackProxy: bad response");
        return fallbackResponse;
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
    const url = `https://langserv.public.ggs-ep.com/12@${version}/en/*`;
    const res = await fetchWithFallback(url);
    const data = await res.json();
    lang = data;
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

    let oldItems = [];
    let addedIDs = [];

    while (true) {
        const [majorStr, minorStr] = oldVersion.split(".");
        let major = parseInt(majorStr, 10);
        let minor = parseInt(minorStr, 10);

        let foundNew = false;

        while (major > 0 && !foundNew) {
            while (minor > 0) {
                const candidate = `${major}.${String(minor).padStart(2, "0")}`;
                const urlOld = `https://empire-html5.goodgamestudios.com/default/items/items_v${candidate}.json`;

                let resOld;
                try {
                    resOld = await fetchWithFallback(urlOld);
                } catch (err) {
                    console.error("Error loading previous version:", err);
                    minor--;
                    continue;
                }

                if (!resOld.ok) {
                    minor--;
                    continue;
                }

                const jsonOld = await resOld.json();
                oldItems = extractConstructionItems(jsonOld);

                const oldIDs = new Set(oldItems.map(i => i.constructionItemID));
                const newIDs = new Set(allItems.map(i => i.constructionItemID));
                addedIDs = Array.from(newIDs).filter(id => !oldIDs.has(id));

                if (addedIDs.length > 0) {
                    oldVersion = candidate;
                    foundNew = true;
                    break;
                }

                minor--;
            }

            major--;
            minor = 5;
        }

        break;
    }

    newItemIDsSet = new Set(addedIDs);
    showOnlyNew = true;
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

// --- EFFECTS AND LEGACY FIELD HANDLING ---
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

    "RelicBeefCapacityIncrease": "ci_secondary_RelicBeefCapacityIncrease_premium",
    "BeefCapacityIncrease": "ci_primary_Beef_CapacityIncrease_premium"
};

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
    ["healSpeed", true],
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
    ["offensiveToolsCostsReduction", true],
    ["feastCostsReduction", true],
    ["Meadreduction", true],
    ["surviveBoost", true],
    ["unboostedStoneProduction", false],
    ["unboostedWoodProduction", false],
    ["offensiveToolsSpeedBoost", true],
    ["espionageTravelBoost", true],
];

const legacyEffectOverrides = {
    "Woodproduction": "ci_effect_unboostedWoodProduction_tt",
    "Stoneproduction": "ci_effect_unboostedStoneProduction_tt",
    "Foodproduction": "ci_effect_unboostedFoodProduction_tt",
    "Oilproduction": "effect_name_oilProductionBoost",
    "Ironproduction": "effect_name_ironProductionBoost",
    "Coalproduction": "effect_name_coalProductionBoost",
    "Glassproduction": "effect_name_glassProductionBoost",
};

function addLegacyEffects(item, effectsList) {
    function getLangKey(fieldName) {
        if (legacyEffectOverrides[fieldName]) {
            const key = legacyEffectOverrides[fieldName];
            if (lang[key]) return lang[key];
        }

        const original = fieldName;
        const variants = [
            `${original}_capacityBonus_tt`,
            `${original}CapacityBonus_tt`,
            `ci_effect_${original}_tt`,
            `ci_effect_${lowerFirstN(original, 1)}_tt`,
            `ci_effect_${lowerFirstN(original, 2)}_tt`,
            `ci_effect_${original.toLowerCase()}_tt`,
        ];

        for (const key of variants) {
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
            const valueWithSuffix = hasPercent ? `${formattedValue}%` : formattedValue;
            const effectText = endsWithColon
                ? `${effectName} ${valueWithSuffix}`
                : `${effectName}: ${valueWithSuffix}`;

            effectsList.push(effectText);
        }
    });
}

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
        candidates.push(`effect_name_${original}_${variant}`);
        candidates.push(`effect_name_${lowerFirst}_${variant}`);
        candidates.push(`effect_name_${allLower}_${variant}`);
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

// --- NAME LOCALIZATION HELPERS ---
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

function normalizeName(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toPascalCase(str) {
    return str
        .replace(/[^a-zA-Z0-9 ]/g, ' ')
        .split(/\\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

// --- GROUPING AND VALUE CALCULATIONS ---
function extractConstructionItems(data) {
    return data.constructionItems || [];
}

function groupItemsByNameEffectsLegacyAppearanceAndDuration(items) {
    const groups = {};

    const testingRegex = /testing/i;

    items.forEach(item => {
        if (
            (item.comment1 && testingRegex.test(item.comment1)) ||
            (item.comment2 && testingRegex.test(item.comment2))
        ) {
            return;
        }

        const effectIDs = item.effects
            ? Array.from(new Set(item.effects.split(",").map(eff => eff.split("&")[0])))
            : [];

        const legacyKeys = [];
        legacyEffectFields.forEach(([fieldName, _]) => {
            if (item[fieldName] !== undefined && item[fieldName] !== null && item[fieldName] !== "" && Number(item[fieldName]) !== 0) {
                legacyKeys.push(fieldName);
            }
        });

        const allEffects = [...new Set([...effectIDs, ...legacyKeys])].sort().join(",");

        const appearanceFlag = (Number(item.slotTypeID) === 0 && item.decoPoints) ? "appearance" : "normal";
        const durationFlag = (item.duration && Number(item.duration) > 0) ? "temporary" : "permanent";

        const key = `${item.name}_${allEffects}_${appearanceFlag}_${durationFlag}_${item.slotTypeID}`;

        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });

    for (const key in groups) {
        groups[key].sort((a, b) => {
            const rarA = parseInt(a.rarenessID || 0);
            const rarB = parseInt(b.rarenessID || 0);

            if (rarA !== rarB) {
                return rarA - rarB;
            }

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
    }
    legacyEffectFields.forEach(([field, _]) => {
        if (item[field] !== undefined && item[field] !== null && item[field] !== "") {
            total += Number(item[field]) || 0;
        }
    });

    return total;
}

function getLevelText(item, rarityName) {
    const slotTypeID = Number(item.slotTypeID);
    const duration = item.duration ? Number(item.duration) : 0;
    const hasDecoPoints = !!item.decoPoints;

    if (slotTypeID === 1) {
        return `Primary (Level ${item.level})`;
    } else if (slotTypeID === 0 && hasDecoPoints) {
        return "Appearance";
    } else if (slotTypeID === 0 && !hasDecoPoints && duration === 0) {
        return "Permanent";
    } else if (slotTypeID === 0 && !hasDecoPoints && duration > 0) {
        return `${rarityName} (Level ${item.level})`;
    } else if (slotTypeID === 2) {
        return `Relic (Level ${item.level})`;
    } else {
        return `Level ${item.level}`;
    }
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
            : `${new Intl.NumberFormat().format(removalCost)} coins`;
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
            effects.push(`Public order: ${formatNumber(item.decoPoints)}`);
        }

        let effectsHTML = "";
        if (effects.length > 0) {
            effectsHTML = `
    <hr>
    <div class="card-effects">
      <h5 class="card-section-title">Effects:</h5>
      <p>${effects.map(e => `- ${e}`).join("<br>")}</p>
    </div>
  `;
        }

        let commentsHTML = "";
        if (commentList.length > 0) {
            commentsHTML = `
    <hr>
    <div class="card-sources">
      <h4 class="card-section-title">Developer comments:</h4>
      <p>${commentList.map(c => `- ${c}`).join("<br>")}</p>
    </div>
  `;
        }

        const typeText = isTemporary ? `Temporary (${formatDuration(item.duration)})` : "Permanent";

        return `
    <div class="level-selector d-flex justify-content-between align-items-center">
      <button id="${groupId}-prev" class="btn btn-sm btn-outline-primary" ${isFirstLevel ? "disabled" : ""}>
        <i class="bi bi-arrow-left"></i>
      </button>
      <div><strong>${levelText}</strong></div>
      <button id="${groupId}-next" class="btn btn-sm btn-outline-primary" ${isLastLevel ? "disabled" : ""}>
        <i class="bi bi-arrow-right"></i>
      </button>
    </div>
    <h2 class="ci-title">${name} <br> (constructionItemID: ${item.constructionItemID})</h2>
    <hr>
    <div class="image-wrapper">
      ${placedUrl
                ? `<img src="${placedUrl}" alt="${name}" class="card-image" loading="lazy" onclick="openImageModal('${placedUrl}', '${safeName}')">`
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
    </div>
  ${effectsHTML}
  ${commentsHTML}
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
                addLegacyEffects(item, effects);
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

    filtered.sort((a, b) => getCIName(a).localeCompare(getCIName(b)));

    renderConstructionItems(filtered);
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
}

function formatNumber(num) {
    return Number(num).toLocaleString();
}

function lowerFirstN(str, n = 1) {
    return str.slice(0, n).toLowerCase() + str.slice(n);
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

// --- IMAGE LOADING (DLL PARSING) ---
async function getImageUrlMap() {
    const base = "https://empire-html5.goodgamestudios.com/default/assets/itemassets/";

    try {
        const indexUrl = "https://empire-html5.goodgamestudios.com/default/index.html";
        const indexRes = await fetchWithFallback(indexUrl);
        if (!indexRes.ok) throw new Error("Failed to fetch index.html: " + indexRes.status);
        const indexHtml = await indexRes.text();

        const dllMatch = indexHtml.match(/<link\s+id=["']dll["']\s+rel=["']preload["']\s+href=["']([^"']+)["']/i);
        if (!dllMatch) throw new Error("DLL preload link not found");

        const dllRelativeUrl = dllMatch[1];
        const dllUrl = `https://empire-html5.goodgamestudios.com/default/${dllRelativeUrl}`;

        console.log("");
        console.log(`DLL version: ${dllRelativeUrl}`);
        console.log(`DLL URL: %c${dllUrl}`, "color:blue; text-decoration:underline;");
        console.log("");

        const dllRes = await fetchWithFallback(dllUrl);
        if (!dllRes.ok) throw new Error("Failed to fetch ggs.dll.js: " + dllRes.status);

        const text = await dllRes.text();

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
        console.log(`Item version: ${itemVersion}`);
        console.log(`Item URL: %chttps://empire-html5.goodgamestudios.com/default/items/items_v${itemVersion}.json`, "color:blue; text-decoration:underline;");
        console.log("");

        setLoadingProgress(++step, totalSteps, "Checking language version...");
        const langVersion = await getLangVersion();
        console.log(`Language version: ${langVersion}`);
        console.log(`Language URL: %chttps://langserv.public.ggs-ep.com/12@${langVersion}/en/*`, "color:blue; text-decoration:underline;");

        setLoadingProgress(++step, totalSteps, "Loading language data...");
        await getLanguageData(langVersion);

        setLoadingProgress(++step, totalSteps, "Loading items...");
        const json = await getItems(itemVersion);
        allItems = extractConstructionItems(json);

        setLoadingProgress(++step, totalSteps, "Loading images...");
        imageUrlMap = await getImageUrlMap();

        console.log(`Found ${allItems.length} construction items, and created ${Object.keys(imageUrlMap).length} construction item URL map entries.`);

        setLoadingProgress(totalSteps, totalSteps, "Rendering items...");
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