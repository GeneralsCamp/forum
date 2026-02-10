import { initAutoHeight } from "../shared/ResizeService.mjs";
import { createLoader } from "../shared/LoadingService.mjs";
import { coreInit } from "../shared/CoreInit.mjs";
import { initLanguageSelector, getInitialLanguage } from "../shared/LanguageService.mjs";

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
    return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getArray(data, names) {
    for (const name of names) {
        if (Array.isArray(data[name])) return data[name];
    }
    return [];
}

function getProp(obj, names) {
    for (const name of names) {
        if (obj[name] !== undefined && obj[name] !== null) return obj[name];
    }
    return null;
}

function buildLookup(array, idKey) {
    const map = {};
    array.forEach(item => {
        if (!item) return;
        const id = item[idKey];
        if (id !== undefined && id !== null) {
            map[String(id)] = item;
        }
    });
    return map;
}

function parseCsvIds(value) {
    if (!value) return [];
    return String(value)
        .split(",")
        .map(v => v.trim())
        .filter(Boolean);
}

function parseIdAmountToken(token) {
    const trimmed = String(token || "").trim();
    if (!trimmed) return [];
    const parts = trimmed.split("#");
    const primary = parts[0];
    const results = [];

    const [idPart, amountPart] = primary.split("+");
    const primaryId = Number(idPart);
    if (!Number.isNaN(primaryId)) {
        let amount = 1;
        if (amountPart) {
            const parsed = Number(amountPart);
            if (!Number.isNaN(parsed)) amount = parsed;
        }
        results.push({ id: primaryId, amount });
    }

    for (let i = 1; i < parts.length; i++) {
        const extraId = Number(parts[i]);
        if (!Number.isNaN(extraId)) {
            results.push({ id: extraId, amount: 1 });
        }
    }

    return results;
}

function parseUnitReward(value) {
    if (!value) return null;
    const [idPart, amountPart] = String(value).split("+");
    const unitId = Number(idPart);
    const amount = Number(amountPart);
    return {
        unitId: Number.isNaN(unitId) ? null : unitId,
        amount: Number.isNaN(amount) ? null : amount
    };
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
    if (!reward) return null;

    if (reward.units) {
        const parsed = parseUnitReward(reward.units);
        if (parsed && parsed.unitId !== null) {
            const unit = unitsById[String(parsed.unitId)];
            const rawType = unit ? (unit.type || unit.name || unit.Name) : null;
            if (rawType) {
                const langKey = `${rawType}_name`.toLowerCase();
                if (lang[langKey]) return lang[langKey];
                return rawType;
            }
            return "Unit";
        }
    }

    const addKey = Object.keys(reward).find(key => key.toLowerCase().startsWith("add"));
    if (addKey) {
        const rawName = addKey.slice(3);
        if (rawName) {
            const langKey = `currency_name_${rawName}`.toLowerCase();
            if (lang[langKey]) return lang[langKey];
        }
    }

    const currencyId = getProp(reward, ["currencyID", "currencyId", "currencyid"]);
    if (currencyId) {
        const currency = currenciesById[String(currencyId)];
        if (currency) {
            const rawName = currency.Name || currency.name;
            const langKey = rawName ? `currency_name_${rawName}`.toLowerCase() : null;
            if (langKey && lang[langKey]) return lang[langKey];
            if (rawName) return rawName;
        }
        return "Currency";
    }

    const constructionId = getProp(reward, ["constructionItemID", "constructionItemId", "constructionitemid"]);
    const constructionIds = getProp(reward, ["constructionItemIDs", "constructionItemIds", "constructionitemids"]);
    if (constructionId) {
        const item = constructionById[String(constructionId)];
        const name = getCIName(item);
        const baseName = name || "Construction item";
        return baseName;
    }
    if (constructionIds) {
        const ids = parseCsvIds(constructionIds);
        const firstId = ids[0];
        const item = firstId ? constructionById[String(firstId)] : null;
        const name = getCIName(item);
        const baseName = name || "Construction item";
        return firstId ? baseName : null;
    }

    const equipmentId = getProp(reward, ["equipmentID", "equipmentId", "equipmentid"]);
    const equipmentIds = getProp(reward, ["equipmentIDs", "equipmentIds", "equipmentids"]);
    if (equipmentId) {
        const item = equipmentById[String(equipmentId)];
        const rawName = item ? (item.name || item.Name) : null;
        const langName = getLangByPrefixes(rawName, ["equip_name_", "equipment_name_", "equip_"]);
        if (langName) return langName;
        if (rawName) return rawName;
        return "Equipment";
    }
    if (equipmentIds) {
        const ids = parseCsvIds(equipmentIds);
        const firstId = ids[0];
        const langKey = firstId ? `equipment_unique_${firstId}`.toLowerCase() : null;
        if (langKey && lang[langKey]) return lang[langKey];
        return firstId ? "Equipment" : null;
    }

    const decoId = getProp(reward, ["decoWODID", "decoWodID", "decowodid"]);
    if (decoId) {
        const item = decorationsById[String(decoId)];
        const decoName = getDecorationName(item);
        const finalName = decoName || "Decoration";
        return finalName;
    }

    return null;
}

function resolveRewardId(reward, fallbackId = null) {
    if (!reward || typeof reward !== "object") return fallbackId;

    if (reward.units) {
        const parsed = parseUnitReward(reward.units);
        if (parsed && parsed.unitId !== null) return parsed.unitId;
    }

    const currencyId = getProp(reward, ["currencyID", "currencyId", "currencyid"]);
    if (currencyId) return currencyId;

    const constructionId = getProp(reward, ["constructionItemID", "constructionItemId", "constructionitemid"]);
    if (constructionId) return constructionId;
    const constructionIds = getProp(reward, ["constructionItemIDs", "constructionItemIds", "constructionitemids"]);
    if (constructionIds) {
        const ids = parseCsvIds(constructionIds);
        if (ids.length > 0) return ids[0];
    }

    const equipmentId = getProp(reward, ["equipmentID", "equipmentId", "equipmentid"]);
    if (equipmentId) return equipmentId;
    const equipmentIds = getProp(reward, ["equipmentIDs", "equipmentIds", "equipmentids"]);
    if (equipmentIds) {
        const ids = parseCsvIds(equipmentIds);
        if (ids.length > 0) return ids[0];
    }

    const decoId = getProp(reward, ["decoWODID", "decoWodID", "decowodid"]);
    if (decoId) return decoId;

    return fallbackId;
}

function resolveRewardIdStrict(reward) {
    if (!reward || typeof reward !== "object") return null;

    if (reward.units) {
        const parsed = parseUnitReward(reward.units);
        if (parsed && parsed.unitId !== null) return parsed.unitId;
    }

    const currencyId = getProp(reward, ["currencyID", "currencyId", "currencyid"]);
    if (currencyId) return currencyId;

    const constructionId = getProp(reward, ["constructionItemID", "constructionItemId", "constructionitemid"]);
    if (constructionId) return constructionId;
    const constructionIds = getProp(reward, ["constructionItemIDs", "constructionItemIds", "constructionitemids"]);
    if (constructionIds) {
        const ids = parseCsvIds(constructionIds);
        if (ids.length > 0) return ids[0];
    }

    const equipmentId = getProp(reward, ["equipmentID", "equipmentId", "equipmentid"]);
    if (equipmentId) return equipmentId;
    const equipmentIds = getProp(reward, ["equipmentIDs", "equipmentIds", "equipmentids"]);
    if (equipmentIds) {
        const ids = parseCsvIds(equipmentIds);
        if (ids.length > 0) return ids[0];
    }

    const decoId = getProp(reward, ["decoWODID", "decoWodID", "decowodid"]);
    if (decoId) return decoId;

    return null;
}

function resolveRewardType(reward) {
    if (!reward || typeof reward !== "object") return null;

    if (reward.units) return "unit";

    const currencyId = getProp(reward, ["currencyID", "currencyId", "currencyid"]);
    if (currencyId) return "currency";

    const constructionId = getProp(reward, ["constructionItemID", "constructionItemId", "constructionitemid"]);
    const constructionIds = getProp(reward, ["constructionItemIDs", "constructionItemIds", "constructionitemids"]);
    if (constructionId || constructionIds) return "construction";

    const equipmentId = getProp(reward, ["equipmentID", "equipmentId", "equipmentid"]);
    const equipmentIds = getProp(reward, ["equipmentIDs", "equipmentIds", "equipmentids"]);
    if (equipmentId || equipmentIds) return "equipment";

    const decoId = getProp(reward, ["decoWODID", "decoWodID", "decowodid"]);
    if (decoId) return "decoration";

    return null;
}

function resolveRewardEntries(reward) {
    if (!reward || typeof reward !== "object") return [];
    const entries = [];

    if (reward.units) {
        const parsed = parseUnitReward(reward.units);
        if (parsed && parsed.unitId !== null) {
            const unit = unitsById[String(parsed.unitId)];
            const rawType = unit ? (unit.type || unit.name || unit.Name) : null;
            let name = rawType;
            if (rawType) {
                const langKey = `${rawType}_name`.toLowerCase();
                if (lang[langKey]) name = lang[langKey];
            }
            if (!name) name = "Unit";
            entries.push({
                name,
                amount: parsed.amount !== null ? parsed.amount : 1,
                id: parsed.unitId,
                type: "unit"
            });
        }
    }

    const addKey = Object.keys(reward).find(key => key.toLowerCase().startsWith("add"));
    if (addKey) {
        const rawName = addKey.slice(3);
        if (rawName) {
            const langKey = `currency_name_${rawName}`.toLowerCase();
            const name = lang[langKey] || rawName;
            const val = Number(reward[addKey]);
            entries.push({ name, amount: Number.isNaN(val) ? 1 : val, id: null, type: "currency", addKeyName: rawName });
        }
    }

    const currencyId = getProp(reward, ["currencyID", "currencyId", "currencyid"]);
    if (currencyId) {
        const currency = currenciesById[String(currencyId)];
        const rawName = currency ? (currency.Name || currency.name) : null;
        const langKey = rawName ? `currency_name_${rawName}`.toLowerCase() : null;
        const name = (langKey && lang[langKey]) ? lang[langKey] : (rawName || "Currency");
        entries.push({ name, amount: 1, id: currencyId, type: "currency" });
    }

    const constructionId = getProp(reward, ["constructionItemID", "constructionItemId", "constructionitemid"]);
    if (constructionId) {
        const item = constructionById[String(constructionId)];
        const baseName = getCIName(item) || "Construction item";
        entries.push({ name: baseName, amount: 1, id: constructionId, type: "construction" });
    }

    const constructionIds = getProp(reward, ["constructionItemIDs", "constructionItemIds", "constructionitemids"]);
    if (constructionIds) {
        const tokens = parseCsvIds(constructionIds);
        tokens.forEach(token => {
            const parsedItems = parseIdAmountToken(token);
            parsedItems.forEach(parsed => {
                const item = constructionById[String(parsed.id)];
                const baseName = getCIName(item) || "Construction item";
                entries.push({ name: baseName, amount: parsed.amount, id: parsed.id, type: "construction" });
            });
        });
    }

    const equipmentId = getProp(reward, ["equipmentID", "equipmentId", "equipmentid"]);
    if (equipmentId) {
        const item = equipmentById[String(equipmentId)];
        const rawName = item ? (item.name || item.Name) : null;
        const langName = getLangByPrefixes(rawName, ["equip_name_", "equipment_name_", "equip_"]);
        entries.push({
            name: langName || rawName || "Equipment",
            amount: 1,
            id: equipmentId,
            type: "equipment"
        });
    }

    const equipmentIds = getProp(reward, ["equipmentIDs", "equipmentIds", "equipmentids"]);
    if (equipmentIds) {
        const tokens = parseCsvIds(equipmentIds);
        tokens.forEach(token => {
            const parsedItems = parseIdAmountToken(token);
            parsedItems.forEach(parsed => {
                const langKey = `equipment_unique_${parsed.id}`.toLowerCase();
                const name = (lang[langKey]) ? lang[langKey] : "Equipment";
                entries.push({ name, amount: parsed.amount, id: parsed.id, type: "equipment" });
            });
        });
    }

    const decoId = getProp(reward, ["decoWODID", "decoWodID", "decowodid"]);
    if (decoId) {
        const item = decorationsById[String(decoId)];
        const decoName = getDecorationName(item) || "Decoration";
        entries.push({ name: decoName, amount: 1, id: decoId, type: "decoration" });
    }

    return entries;
}

function getRewardAmount(reward) {
    if (!reward || typeof reward !== "object") return 1;
    if (reward.units) {
        const parsed = parseUnitReward(reward.units);
        if (parsed && parsed.amount !== null) return parsed.amount;
    }
    for (const key of Object.keys(reward)) {
        if (key.toLowerCase().includes("add")) {
            const val = Number(reward[key]);
            return Number.isNaN(val) ? 1 : val;
        }
    }
    return 1;
}

function getAddKeyName(reward) {
    if (!reward || typeof reward !== "object") return null;
    const addKey = Object.keys(reward).find(key => key.toLowerCase().startsWith("add"));
    if (!addKey) return null;
    return addKey.slice(3);
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
    if (!reward || reward.type !== "decoration") return null;

    const decoId = reward.id != null
        ? reward.id
        : resolveRewardIdStrict(reward);

    if (!decoId) return null;

    const item = decorationsById[String(decoId)];
    const rawKey = item ? (item.type || item.Type) : "";

    const cleanType = normalizeName(rawKey);

    const urls = cleanType
        ? imageUrlMap[cleanType]
        : null;

    return urls?.placedUrl || urls?.iconUrl || null;
}


function getConstructionImageUrl(reward) {
    if (!reward || reward.type !== "construction") return null;
    const consId = reward.id != null ? reward.id : resolveRewardIdStrict(reward);
    if (!consId) return null;
    const item = constructionById[String(consId)];
    const rawName = item ? (item.name || item.Name) : "";
    const cleanName = normalizeName(rawName);
    const urls = cleanName ? constructionImageUrlMap[cleanName] : null;
    return (urls && (urls.placedUrl || urls.iconUrl)) || null;
}

function getEquipmentImageUrl(reward) {
    if (!reward || reward.type !== "equipment") return null;
    const equipId = reward.id != null ? reward.id : resolveRewardIdStrict(reward);
    if (!equipId) return null;
    const item = equipmentById[String(equipId)];
    const skinId = item ? (item.skinID || item.skinId) : null;
    const skinName = skinId ? lookSkinsById[String(skinId)] : null;
    const rawName = skinName || (item ? (item.skinName || item.name || item.Name) : "");
    const cleanName = normalizeName(rawName);
    const urls = cleanName ? equipmentImageUrlMap[cleanName] : null;
    if (!urls) return null;
    const mapObjects = urls.mapObjects || {};
    const movements = urls.movements || {};
    const hasMapObjects = Object.keys(mapObjects).length > 0;
    const hasMovements = Object.keys(movements).length > 0;
    if (hasMapObjects) {
        return mapObjects.castleUrl ||
            mapObjects.outpostUrl ||
            mapObjects.metroUrl ||
            mapObjects.capitalUrl ||
            null;
    }
    if (hasMovements) {
        return movements.moveNormal ||
            movements.moveBoat ||
            null;
    }
    return null;
}

function getUnitImageUrl(reward) {
    if (!reward || reward.type !== "unit") return null;
    const unitId = reward.id != null ? reward.id : resolveRewardIdStrict(reward);
    if (!unitId) return null;
    const unit = unitsById[String(unitId)];
    const rawName = unit ? (unit.name || unit.Name) : "";
    const rawType = unit ? (unit.type || unit.Type) : "";
    if (!rawName || !rawType) return null;
    const key = normalizeName(`${rawName}_unit_${rawType}`);
    return unitImageUrlMap[key] || null;
}

function getCurrencyImageUrl(reward) {
    if (!reward || typeof reward !== "object") return null;
    const rawName = reward.addKeyName || getAddKeyName(reward);
    if (!rawName) return null;
    const cleanName = normalizeName(rawName);
    return cleanName ? collectableCurrencyImageUrlMap[cleanName] || null : null;
}

// --- UI RENDERING ---
function copyTextToClipboard(text) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => { });
        return;
    }
    const temp = document.createElement("textarea");
    temp.value = text;
    temp.style.position = "fixed";
    temp.style.top = "-9999px";
    document.body.appendChild(temp);
    temp.focus();
    temp.select();
    try {
        document.execCommand("copy");
    } catch (err) {
        console.warn("Copy failed:", err);
    }
    document.body.removeChild(temp);
}

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
        col.className = "col-12 col-md-6 d-flex";
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
                <div class="reward-stat-label">${UI_LANG.amount}</div>
                <div class="reward-stat-value">${amountText}</div>
              </div>
              <div class="reward-stat card-cell flex-fill">
                <div class="reward-stat-label">${label}</div>
                <div class="reward-stat-value"${chanceStyle}>${chanceText}</div>
              </div>
              <div class="reward-stat card-cell flex-fill">
                <div class="reward-stat-label">${UI_LANG.id}</div>
                <div class="reward-stat-value">${idDisplay}</div>
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

document.addEventListener("click", event => {
    const link = event.target.closest(".id-link");
    if (!link) return;
    const id = link.getAttribute("data-id") || link.textContent.trim();
    if (!id || id === "-") return;
    copyTextToClipboard(id);
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
