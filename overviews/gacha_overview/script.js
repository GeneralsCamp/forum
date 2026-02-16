import { initAutoHeight } from "../shared/ResizeService.mjs";
import { createLoader } from "../shared/LoadingService.mjs";
import { coreInit } from "../shared/CoreInit.mjs";
import { initLanguageSelector, getInitialLanguage } from "../shared/LanguageService.mjs";
import {
    createRewardResolver,
    normalizeName as sharedNormalizeName,
    getArray as sharedGetArray,
    getProp as sharedGetProp,
    buildLookup as sharedBuildLookup,
    parseCsvIds as sharedParseCsvIds,
    parseIdAmountToken as sharedParseIdAmountToken,
    parseUnitReward as sharedParseUnitReward
} from "../shared/RewardResolver.mjs";

// --- GLOBAL VARIABLES ---
let lang = {};
let itemsData = null;
let gachaEvents = [];
let rewardsById = {};
let currenciesById = {};
let equipmentById = {};
let constructionById = {};
let decorationsById = {};
let unitsById = {};
let imageUrlMap = {};
let constructionImageUrlMap = {};
let equipmentImageUrlMap = {};
let lookSkinsById = {};
let unitImageUrlMap = {};
let collectableCurrencyImageUrlMap = {};
let ownLang = {};
let UI_LANG = {};
let rewardResolver = null;
const loader = createLoader();
let currentLanguage = getInitialLanguage();

const rarityStyles = {
    1: { label: "common", color: "#ffffffff" },
    2: { label: "rare", color: "#58e16fff" },
    3: { label: "epic", color: "#c09bf8ff" },
    4: { label: "legendary", color: "#f4b551ff" }
};

// --- FETCH FUNCTIONS ---
async function loadOwnLang() {
    try {
        const res = await fetch("./ownLang.json");
        const raw = await res.json();

        function normalize(obj) {
            if (obj && typeof obj === "object" && !Array.isArray(obj)) {
                return Object.fromEntries(
                    Object.entries(obj).map(([k, v]) =>
                        [k.toLowerCase(), normalize(v)]
                    )
                );
            }
            if (Array.isArray(obj)) return obj.map(normalize);
            return obj;
        }

        ownLang = normalize(raw);

    } catch (err) {
        console.error("ownLang error:", err);
        ownLang = {};
    }
}

function applyOwnLang() {

    const L = ownLang[currentLanguage?.toLowerCase()]?.ui || {};

    UI_LANG = {
        amount: L.amount ?? "Amount",
        chance: L.chance ?? "Chance",
        ranking: L.ranking ?? "Ranking",
        id: L.id ?? "ID",

        no_rewards: L.no_rewards ?? "No rewards for this selection.",
        latest_version: L.latest_version ?? "Latest version",
        version: L.version ?? "Version",
        old: L.old ?? "old",

        no_events: L.no_events ?? "No gacha events found",
        no_sets: L.no_sets ?? "No versions",
        no_levels: L.no_levels ?? "No levels",

        top_rewards: L.top_rewards ?? "TOP rewards",
        level: L.level ?? "Level"
    };
}

// --- DATA HELPERS ---
function normalizeName(value) {
    return sharedNormalizeName(value);
}

function getArray(data, names) {
    return sharedGetArray(data, names);
}

function getProp(obj, names) {
    return sharedGetProp(obj, names);
}

function buildLookup(array, idKey) {
    return sharedBuildLookup(array, idKey);
}

function parseCsvIds(value) {
    return sharedParseCsvIds(value);
}

function parseIdAmountToken(token) {
    return sharedParseIdAmountToken(token);
}

function parseUnitReward(value) {
    return sharedParseUnitReward(value);
}

// --- NAME HELPERS ---
function getCIName(item) {
    if (!item) return null;
    const rawName = (item.name || "???").toLowerCase();
    const prefixes = ["appearance", "primary", "secondary"];
    const suffixes = ["", "_premium"];

    for (const prefix of prefixes) {
        for (const suffix of suffixes) {
            const key = `ci_${prefix}_${rawName}${suffix}`.toLowerCase();
            if (lang[key]) return lang[key];
        }
    }

    const keysToTry = [
        ...suffixes.map(s => `ci_${rawName}${s}`),
        rawName
    ];

    for (const key of keysToTry) {
        const lower = key.toLowerCase();
        if (lang[lower]) return lang[lower];
    }

    return item.name || null;
}

function getLangByPrefixes(rawName, prefixes) {
    if (!rawName) return null;
    const lowerName = rawName.toLowerCase();
    for (const prefix of prefixes) {
        const key = `${prefix}${lowerName}`.toLowerCase();
        if (lang[key]) return lang[key];
    }
    return null;
}

function getDecorationName(item) {
    if (!item) return null;
    const rawType = item.type || item.Type;
    const lowerType = rawType ? rawType.toLowerCase() : "";
    if (lowerType) {
        const key = `deco_${lowerType}_name`;
        if (lang[key]) return lang[key];
    }
    const rawName = item.name || item.Name;
    return getLangByPrefixes(rawName, ["decoration_name_", "deco_name_", "decoration_"]) || rawName || null;
}

function resolveRewardName(reward) {
    return rewardResolver ? rewardResolver.resolveRewardName(reward) : null;
}

function resolveRewardId(reward, fallbackId = null) {
    return rewardResolver ? rewardResolver.resolveRewardId(reward, fallbackId) : fallbackId;
}

function resolveRewardIdStrict(reward) {
    return rewardResolver ? rewardResolver.resolveRewardIdStrict(reward) : null;
}

function resolveRewardType(reward) {
    return rewardResolver ? rewardResolver.resolveRewardType(reward) : null;
}

function resolveRewardEntries(reward) {
    return rewardResolver ? rewardResolver.resolveRewardEntries(reward) : [];
}

function getRewardAmount(reward) {
    return rewardResolver ? rewardResolver.getRewardAmount(reward) : 1;
}

function getAddKeyName(reward) {
    return rewardResolver ? rewardResolver.getAddKeyName(reward) : null;
}

function formatPercent(value) {
    if (!Number.isFinite(value)) return "0%";
    const rounded = Math.round(value * 100) / 100;
    return `${rounded.toFixed(rounded % 1 === 0 ? 0 : 2)}%`;
}

function formatNumber(value) {
    return Number(value).toLocaleString();
}

function getRarityColor(rarity) {
    const style = rarityStyles[Number(rarity)];
    return style ? style.color : null;
}

function getDecorationImageUrl(reward) {
    return rewardResolver ? rewardResolver.getDecorationImageUrl(reward) : null;
}


function getConstructionImageUrl(reward) {
    return rewardResolver ? rewardResolver.getConstructionImageUrl(reward) : null;
}

function getEquipmentImageUrl(reward) {
    return rewardResolver ? rewardResolver.getEquipmentImageUrl(reward) : null;
}

function getUnitImageUrl(reward) {
    return rewardResolver ? rewardResolver.getUnitImageUrl(reward) : null;
}

function getCurrencyImageUrl(reward) {
    return rewardResolver ? rewardResolver.getCurrencyImageUrl(reward) : null;
}

// --- UI RENDERING ---

function getEventLabel(event) {
    if (!event) return "Unknown event";
    const eventId = event.eventID;
    const titleKey = `event_title_${eventId}`.toLowerCase();
    const titleName = lang[titleKey];
    const eventType = event.eventType || event.EventType;
    const tooltipKey = eventType ? `tooltip_gachaName_${eventType}`.toLowerCase() : null;
    const tooltipName = tooltipKey ? lang[tooltipKey] : null;
    const name = titleName || tooltipName || event.comment1 || event.comment2 || "Event";
    return name;
}

function setupSelectors() {
    const eventSelect = document.getElementById("eventSelect");
    const setSelect = document.getElementById("setSelect");
    const levelSelect = document.getElementById("levelSelect");

    const events = getArray(itemsData, ["events"]);
    const gachaList = getArray(itemsData, ["gachaEvents", "gachaevents"]);
    gachaEvents = gachaList;

    const eventIds = new Set(gachaList.map(e => String(getProp(e, ["eventID", "eventId", "eventid"]))));
    const availableEvents = events.filter(e => eventIds.has(String(e.eventID)));

    availableEvents.sort((a, b) => {
        const idA = Number(a.eventID) || 0;
        const idB = Number(b.eventID) || 0;
        return idB - idA;
    });

    eventSelect.innerHTML = "";
    if (availableEvents.length === 0) {
        eventSelect.innerHTML = `<option value="" selected>${UI_LANG.no_events}</option>`;
        setSelect.innerHTML = `<option value="" selected>No sets</option>`;
        levelSelect.innerHTML = `<option value="" selected>No levels</option>`;
        renderRewards([]);
        return;
    }

    availableEvents.forEach(event => {
        const option = document.createElement("option");
        option.value = String(event.eventID);
        option.textContent = getEventLabel(event);
        eventSelect.appendChild(option);
    });

    eventSelect.addEventListener("change", () => {
        updateHashForEvent(eventSelect.value);
        updateSetOptions();
        updateLevelOptions();
        renderRewardsForSelection();
    });

    setSelect.addEventListener("change", () => {
        updateLevelOptions();
        renderRewardsForSelection();
    });

    levelSelect.addEventListener("change", () => {
        renderRewardsForSelection();
    });

    const hashEvent = getEventFromHash();
    const hasHashEvent = hashEvent && availableEvents.some(e => String(e.eventID) === String(hashEvent));
    eventSelect.value = hasHashEvent ? String(hashEvent) : String(availableEvents[0].eventID);
    updateHashForEvent(eventSelect.value);
    updateSetOptions();
    updateLevelOptions();
    renderRewardsForSelection();
}

function updateSetOptions() {
    const eventSelect = document.getElementById("eventSelect");
    const setSelect = document.getElementById("setSelect");
    const eventId = eventSelect.value;

    const sets = gachaEvents
        .filter(e => String(getProp(e, ["eventID", "eventId", "eventid"])) === String(eventId))
        .map(e => String(getProp(e, ["rewardSetID", "rewardSetId", "rewardsetid"]) || ""))
        .filter(v => v !== "");

    const uniqueSets = Array.from(new Set(sets)).sort((a, b) => Number(a) - Number(b));

    setSelect.innerHTML = "";
    if (uniqueSets.length === 0) {
        setSelect.innerHTML = `<option value="" selected>${UI_LANG.no_sets}</option>`;
        setSelect.disabled = true;
        return;
    }

    const latestSet = uniqueSets[uniqueSets.length - 1];
    const hasMultiple = uniqueSets.length > 1;
    uniqueSets.forEach(setId => {
        const option = document.createElement("option");
        option.value = String(setId);
        if (!hasMultiple) {
            option.textContent = UI_LANG.latest_version;
        } else {
            const suffix = setId !== latestSet ? ` (${UI_LANG.old})` : "";
            option.textContent =
                setId === latestSet
                    ? UI_LANG.latest_version
                    : `${UI_LANG.version} ${setId}${suffix}`;
        }
        setSelect.appendChild(option);
    });

    setSelect.value = String(latestSet);
    setSelect.disabled = uniqueSets.length === 1;
}

function updateLevelOptions() {
    const eventSelect = document.getElementById("eventSelect");
    const setSelect = document.getElementById("setSelect");
    const levelSelect = document.getElementById("levelSelect");
    const eventId = eventSelect.value;
    const setId = setSelect.value;

    const levels = gachaEvents
        .filter(e => {
            const eventMatch = String(getProp(e, ["eventID", "eventId", "eventid"])) === String(eventId);
            const setMatch = String(getProp(e, ["rewardSetID", "rewardSetId", "rewardsetid"]) || "") === String(setId);
            return eventMatch && setMatch;
        })
        .map(e => Number(getProp(e, ["gachaLevel", "gachaLevelID", "gachalevel"])))
        .filter(n => !Number.isNaN(n));

    const uniqueLevels = Array.from(new Set(levels)).sort((a, b) => a - b);

    levelSelect.innerHTML = "";
    if (uniqueLevels.length === 0) {
        levelSelect.innerHTML = `<option value="" selected>${UI_LANG.no_levels}</option>`;
        return;
    }

    uniqueLevels.forEach(level => {
        const option = document.createElement("option");
        option.value = String(level);
        option.textContent = `${UI_LANG.level} ${level}`;
        levelSelect.appendChild(option);
    });

    const topOption = document.createElement("option");
    topOption.value = "top";
    topOption.textContent = UI_LANG.top_rewards;
    levelSelect.appendChild(topOption);

    levelSelect.value = String(uniqueLevels[0]);
}

function renderRewardsForSelection() {
    const eventSelect = document.getElementById("eventSelect");
    const setSelect = document.getElementById("setSelect");
    const levelSelect = document.getElementById("levelSelect");
    const eventId = eventSelect.value;
    const setId = setSelect.value;
    const level = levelSelect.value;

    if (!eventId || !setId || !level) {
        renderRewards([]);
        return;
    }
    updateHashForEvent(eventId);

    if (level === "top") {
        renderTopRewardsForSelection(eventId, setId);
        return;
    }

    const gachaEvent = gachaEvents.find(e => {
        const eventMatch = String(getProp(e, ["eventID", "eventId", "eventid"])) === String(eventId);
        const setMatch = String(getProp(e, ["rewardSetID", "rewardSetId", "rewardsetid"]) || "") === String(setId);
        const levelMatch = String(getProp(e, ["gachaLevel", "gachaLevelID", "gachalevel"])) === String(level);
        return eventMatch && setMatch && levelMatch;
    });

    if (!gachaEvent) {
        renderRewards([]);
        return;
    }

    const tombolaId = String(getProp(gachaEvent, ["lootBoxTombolaID", "lootBoxTombolaId", "lootboxtombolaid"]));
    const tombolas = getArray(itemsData, ["lootBoxTombolas", "lootboxtombolas"]);

    const rewardIds = [];
    const rewardShares = {};
    const rewardMeta = {};
    let totalShares = 0;
    tombolas.forEach(tombola => {
        const tombolaMatch = String(getProp(tombola, ["tombolaID", "tombolaId", "tombolaid"])) === tombolaId;
        if (!tombolaMatch) return;
        const ids = parseCsvIds(getProp(tombola, ["rewardIDs", "rewardIds", "rewardids"]));
        const rarity = Number(getProp(tombola, ["rewardCategory", "rewardcategory"]));
        const tombolaNumeric = Number(getProp(tombola, ["tombolaID", "tombolaId", "tombolaid"]));
        const shares = Number(getProp(tombola, ["shares", "share", "Share", "Shares"]));
        const shareValue = Number.isNaN(shares) ? 0 : shares;
        totalShares += shareValue;
        rewardIds.push(...ids);
        ids.forEach(id => {
            rewardShares[id] = (rewardShares[id] || 0) + shareValue;
            if (!rewardMeta[id]) {
                rewardMeta[id] = {
                    rarity: Number.isNaN(rarity) ? 0 : rarity,
                    tombolaId: Number.isNaN(tombolaNumeric) ? 0 : tombolaNumeric
                };
            }
        });
    });

    const rewards = [];
    const seen = new Set();
    const uniqueRewardIds = Array.from(new Set(rewardIds));
    uniqueRewardIds.sort((a, b) => {
        const metaA = rewardMeta[a] || { rarity: 0, tombolaId: 0 };
        const metaB = rewardMeta[b] || { rarity: 0, tombolaId: 0 };
        if (metaA.rarity !== metaB.rarity) return metaA.rarity - metaB.rarity;
        return metaA.tombolaId - metaB.tombolaId;
    });

    uniqueRewardIds.forEach(id => {
        const reward = rewardsById[String(id)];
        const name = resolveRewardName(reward) || "Reward";
        const amount = getRewardAmount(reward);
        const percent = totalShares > 0 ? (rewardShares[id] / totalShares) * 100 : 0;
        const rewardId = resolveRewardId(reward, id);
        const displayId = resolveRewardIdStrict(reward);
        const addKeyName = getAddKeyName(reward);
        const key = `${name}::${amount}::${percent}::${rewardId}`;
        if (!seen.has(key)) {
            seen.add(key);
            const meta = rewardMeta[id] || { rarity: 0 };
            rewards.push({
                name,
                amount,
                chanceText: formatPercent(percent),
                rarity: meta.rarity,
                id: displayId,
                type: resolveRewardType(reward),
                addKeyName
            });
        }
    });

    renderRewards(rewards, UI_LANG.chance);
}

function getEventFromHash() {
    const hash = window.location.hash.replace("#", "").trim();
    return hash || null;
}

function updateHashForEvent(eventId) {
    if (!eventId) return;
    window.location.hash = String(eventId);
}

function renderRewards(rewards, label) {
    const container = document.getElementById("rewardRows");
    container.innerHTML = "";

    if (!rewards || rewards.length === 0) {
        const emptyCol = document.createElement("div");
        emptyCol.className = "col-12";
        emptyCol.innerHTML = `
      <div class="box">
        <div class="box-content d-flex align-items-center px-2 py-1">
          <p class="mb-0">No rewards for this selection.</p>
        </div>
      </div>`;
        container.appendChild(emptyCol);
        return;
    }

    rewards.forEach(reward => {
        const col = document.createElement("div");
        col.className = "col-12 col-sm-6 col-lg-4 d-flex";
        const amountText = formatNumber(reward.amount);
        const chanceText = reward.chanceText || "";
        const rarityColor = getRarityColor(reward.rarity);
        const chanceStyle = rarityColor ? ` style="color:${rarityColor};"` : "";
        const idText = (reward.id !== undefined && reward.id !== null && reward.id !== "") ? String(reward.id) : "-";
        const idDisplay = idText;
        let imageUrl = null;
        let imageClass = "card-image";
        if (reward.type === "decoration") {
            imageUrl = getDecorationImageUrl(reward);
        } else if (reward.type === "construction") {
            imageUrl = getConstructionImageUrl(reward);
        } else if (reward.type === "equipment") {
            imageUrl = getEquipmentImageUrl(reward);
        } else if (reward.type === "unit") {
            imageUrl = getUnitImageUrl(reward);
        }
        if (!imageUrl) {
            imageUrl = getCurrencyImageUrl(reward);
            if (imageUrl) imageClass += " card-image-currency";
        }
        const imageInner = imageUrl
            ? `<div class="image-wrapper"><img src="${imageUrl}" class="${imageClass}" loading="lazy" alt=""></div>`
            : `<div class="reward-image-placeholder">img</div>`;
        let imageBlock = imageInner;
        if (idText !== "-" && reward.type === "decoration") {
            imageBlock = `<a class="id-link" data-id="${idText}" href="https://generalscamp.github.io/forum/overviews/decorations#${idText}" target="_blank" rel="noopener">${imageInner}</a>`;
        } else if (idText !== "-" && reward.type === "construction") {
            imageBlock = `<a class="id-link" data-id="${idText}" href="https://generalscamp.github.io/forum/overviews/building_items#${idText}" target="_blank" rel="noopener">${imageInner}</a>`;
        }
        col.innerHTML = `
      <div class="box flex-fill">
        <div class="box-content">
          <h2 class="ci-title reward-title">${reward.name}</h2>
          <div class="reward-body row g-0 align-items-stretch">
            <div class="col-4 reward-image">
              ${imageBlock}
            </div>
            <div class="col-8 d-flex flex-column">
              <div class="reward-stat card-cell flex-fill">
                <div class="reward-stat-line">
                  <span class="reward-stat-label">${UI_LANG.amount}:</span>
                  <span class="reward-stat-value">${amountText}</span>
                </div>
              </div>
              <div class="reward-stat card-cell flex-fill">
                <div class="reward-stat-line">
                  <span class="reward-stat-label">${label}:</span>
                  <span class="reward-stat-value"${chanceStyle}>${chanceText}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
        container.appendChild(col);
    });
}

function renderTopRewardsForSelection(eventId, setId) {
    const leagueEvents = getArray(itemsData, ["leaguetypeevents", "leagueTypeEvents", "leagueTypeevents"]);
    const matching = leagueEvents.filter(e => {
        const eventMatch = String(getProp(e, ["eventID", "eventId", "eventid"])) === String(eventId);
        const setMatch = String(getProp(e, ["rewardSetID", "rewardSetId", "rewardsetid"]) || "") === String(setId);
        return eventMatch && setMatch;
    });
    let entry = null;

    if (matching.length === 1) {
        entry = matching[0];
    } else if (matching.length > 1) {
        entry = matching[0];
    }

    if (!entry) {
        renderRewards([]);
        return;
    }

    const rewardIds = parseCsvIds(getProp(entry, ["rewardIDs", "rewardIds", "rewardids"]));
    const topValuesRaw = parseCsvIds(getProp(entry, ["topXValue", "topxvalue"]));
    const topValues = topValuesRaw.map(v => Number(v)).filter(v => !Number.isNaN(v));
    topValues.push(1);
    const tiers = Array.from(new Set(topValues)).sort((a, b) => a - b);

    const topRewardIds = rewardIds.slice(-tiers.length);
    const rewards = [];
    const seen = new Set();

    tiers.forEach((tier, index) => {
        const rewardId = topRewardIds[topRewardIds.length - 1 - index];
        const reward = rewardsById[String(rewardId)];
        const entries = resolveRewardEntries(reward);
        if (entries.length === 0) {
            const name = resolveRewardName(reward) || "Reward";
            const amount = getRewardAmount(reward);
            const rewardKeyId = resolveRewardId(reward, rewardId);
            const displayId = resolveRewardIdStrict(reward);
            const addKeyName = getAddKeyName(reward);
            const key = `${name}::${amount}::${tier}::${rewardKeyId}`;
            if (!seen.has(key)) {
                seen.add(key);
                rewards.push({
                    name,
                    amount,
                    chanceText: `TOP${tier}`,
                    id: displayId,
                    type: resolveRewardType(reward),
                    addKeyName
                });
            }
            return;
        }
        entries.forEach(entry => {
            const entryKeyId = entry.id !== undefined && entry.id !== null ? entry.id : "-";
            const key = `${entry.name}::${entry.amount}::${tier}::${entryKeyId}`;
            if (!seen.has(key)) {
                seen.add(key);
                rewards.push({
                    name: entry.name,
                    amount: entry.amount,
                    chanceText: `TOP${tier}`,
                    id: entry.id,
                    type: entry.type || null,
                    addKeyName: entry.addKeyName || null
                });
            }
        });
    });

    renderRewards(rewards, UI_LANG.ranking);
}

// --- INITIALIZATION ---
initAutoHeight({
    contentSelector: "#content",
    subtractSelectors: [".note", ".page-title"],
    extraOffset: 18
});

async function init() {
    try {
        await coreInit({
            loader,
            itemLabel: "gacha",
            langCode: currentLanguage,
            normalizeNameFn: normalizeName,

            assets: {
                decorations: true,
                constructions: true,
                looks: true,
                units: true,
                currencies: true
            },

            onReady: async ({
                lang: L,
                data,
                imageMaps
            }) => {

                lang = L;
                itemsData = data;

                imageUrlMap = imageMaps?.decorations ?? {};
                constructionImageUrlMap = imageMaps?.constructions ?? {};
                equipmentImageUrlMap = imageMaps?.looks ?? {};
                unitImageUrlMap = imageMaps?.units ?? {};
                collectableCurrencyImageUrlMap = imageMaps?.currencies ?? {};

                const rewards = getArray(itemsData, ["rewards"]);
                const currencies = getArray(itemsData, ["currencies"]);
                const equipment = getArray(itemsData, ["equipments"]);
                const skins = getArray(itemsData, ["worldmapskins"]);

                lookSkinsById = {};
                skins.forEach(s => {
                    lookSkinsById[String(s.skinID)] = s.name;
                });

                const constructions = getArray(itemsData, ["constructionItems"]);
                const decorations = getArray(itemsData, ["buildings"]);
                const units = getArray(itemsData, ["units"]);

                rewardsById = buildLookup(rewards, "rewardID");
                currenciesById = buildLookup(currencies, "currencyID");
                equipmentById = buildLookup(equipment, "equipmentID");
                constructionById = buildLookup(constructions, "constructionItemID");
                decorationsById = buildLookup(decorations, "wodID");
                unitsById = buildLookup(units, "wodID");
                rewardResolver = createRewardResolver(
                    () => ({
                        lang,
                        currenciesById,
                        equipmentById,
                        constructionById,
                        decorationsById,
                        unitsById,
                        lootBoxesById: {},
                        lookSkinsById,
                        decorationImageUrlMap: imageUrlMap,
                        constructionImageUrlMap,
                        equipmentImageUrlMap,
                        unitImageUrlMap,
                        currencyImageUrlMap: collectableCurrencyImageUrlMap,
                        lootBoxImageUrlMap: {}
                    }),
                    {
                        includeCurrency2: false,
                        includeLootBox: false,
                        includeUnitLevel: false
                    }
                );

                initLanguageSelector({
                    currentLanguage,
                    lang,
                    onSelect: () => location.reload()
                });

                await loadOwnLang();
                applyOwnLang();

                setupSelectors();
            }
        });
    } catch (err) {
        console.error(err);
        loader.error("Something went wrong...", 30);
    }
}

init();
