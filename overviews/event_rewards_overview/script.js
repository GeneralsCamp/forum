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
    parseUnitReward as sharedParseUnitReward,
    parseLootBoxReward as sharedParseLootBoxReward
} from "../shared/RewardResolver.mjs";

// --- GLOBAL VARIABLES ---
let lang = {};
let itemsData = null;
let leagueEntries = [];
let rewardsById = {};
let currenciesById = {};
let equipmentById = {};
let constructionById = {};
let decorationsById = {};
let unitsById = {};
let lootBoxesById = {};
let imageUrlMap = {};
let constructionImageUrlMap = {};
let equipmentImageUrlMap = {};
let lookSkinsById = {};
let unitImageUrlMap = {};
let collectableCurrencyImageUrlMap = {};
let lootBoxImageUrlMap = {};
let ownLang = {};
let UI_LANG = {};
let difficultyTypeById = {};
let difficultyByEvent = {};
let rewardResolver = null;
const loader = createLoader();
let currentLanguage = getInitialLanguage();

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
    const cleanUiText = (value) => {
        if (value === undefined || value === null) return null;
        return String(value)
            .replace(/\{[^}]+\}/g, "")
            .replace(/:\s*$/, "")
            .trim();
    };

    const getFromLang = (keys = []) => {
        for (const key of keys) {
            if (!key) continue;
            const direct = lang[key];
            if (direct) {
                const cleaned = cleanUiText(direct);
                if (cleaned) return cleaned;
            }
            const lower = lang[String(key).toLowerCase()];
            if (lower) {
                const cleaned = cleanUiText(lower);
                if (cleaned) return cleaned;
            }
        }
        return null;
    };

    const pick = ({ ownKey, fallback, langKeys = [] }) =>
        getFromLang(langKeys) || L[ownKey] || fallback;
    
    UI_LANG = {
        amount: pick({ ownKey: "amount", fallback: "Amount", langKeys: ["amount"] }),
        requirement: pick({ ownKey: "requirement", fallback: "Requirement", langKeys: ["generic_points"] }),
        id: pick({ ownKey: "id", fallback: "ID", langKeys: ["id"] }),
        mode: pick({ ownKey: "mode", fallback: "Mode", langKeys: ["gameMode_placeholder"] }),
        individual: pick({ ownKey: "individual", fallback: "Individual", langKeys: ["individual"] }),
        alliance: pick({ ownKey: "alliance", fallback: "Alliance", langKeys: ["alliance_colon"] }),
        alliance_rewards: pick({
            ownKey: "alliance_rewards",
            fallback: "Alliance rewards",
            langKeys: ["dialog_pointsEvent_rewardsList_allianceRewards_tooltip"]
        }),
        level: pick({ ownKey: "level", fallback: "Level", langKeys: ["levelcount", "levelx_colon"] }),
        difficulty: pick({ ownKey: "difficulty", fallback: "Difficulty", langKeys: ["dialog_difficultyScaling_selectedDifficultyLevel_tooltip"] }),
        view: pick({ ownKey: "view", fallback: "View", langKeys: [] }),
        view_detailed: pick({ ownKey: "view_detailed", fallback: "Detailed", langKeys: [] }),
        view_summary_activity: pick({
            ownKey: "view_summary_activity",
            fallback: "Summarized activity",
            langKeys: []
        }),
        view_summary_all: pick({
            ownKey: "view_summary_all",
            fallback: "Summarized all",
            langKeys: []
        }),

        no_rewards: pick({ ownKey: "no_rewards", fallback: "No rewards for this selection.", langKeys: [] }),
        no_events: pick({ ownKey: "no_events", fallback: "No events found", langKeys: [] }),
        no_modes: pick({ ownKey: "no_modes", fallback: "No reward types", langKeys: [] }),
        no_levels: pick({ ownKey: "no_levels", fallback: "No levels", langKeys: [] }),
        no_difficulties: pick({ ownKey: "no_difficulties", fallback: "No difficulties", langKeys: [] }),
        no_difficulty_for_event: pick({ ownKey: "no_difficulty_for_event", fallback: "No difficulty for this event", langKeys: [] }),

        top: pick({ ownKey: "top", fallback: "TOP", langKeys: ["top"] })
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

function parseLootBoxReward(value) {
    return sharedParseLootBoxReward(value);
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

function getLootBoxDisplayName(lootBox) {
    if (!lootBox) return "Loot box";
    const key = `mysterybox_boxname_${lootBox.name}_${lootBox.rarity}`.toLowerCase();
    return lang[key] || lootBox.name || "Loot box";
}

function getUnitDisplayName(unit) {
    if (!unit) return "Unit";

    const rawType = unit.type || unit.name || unit.Name || "";
    let baseName = rawType || "Unit";
    if (rawType) {
        const langKey = `${rawType}_name`.toLowerCase();
        if (lang[langKey]) baseName = lang[langKey];
    }

    const levelRaw = getProp(unit, ["level", "Level", "lvl", "Lvl"]);
    if (levelRaw === undefined || levelRaw === null || String(levelRaw).trim() === "") {
        return baseName;
    }

    return `${baseName} (lvl.${levelRaw})`;
}

function resolveRewardName(reward) {
    return rewardResolver ? rewardResolver.resolveRewardName(reward) : null;
}

function getBerimondFactionLabel(subType) {
    const isRed = String(subType) === "1";
    const langKey = isRed
        ? "dialog_berimondInvasion_redFaction_name"
        : "dialog_berimondInvasion_blueFaction_name";
    const fallback = isRed ? "The House of Gerbrandt" : "The House of Ursidae";
    return lang[langKey] || lang[langKey.toLowerCase()] || fallback;
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

function formatNumber(value) {
    return Number(value).toLocaleString();
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

function getLootBoxImageUrl(reward) {
    return rewardResolver ? rewardResolver.getLootBoxImageUrl(reward) : null;
}

// --- UI RENDERING ---

function getEventLabel(eventId, fallback = "Event") {
    const events = getArray(itemsData, ["events"]);
    const event = events.find(e => String(e.eventID) === String(eventId));
    if (!event) return fallback;
    const titleKey = `event_title_${eventId}`.toLowerCase();
    const titleName = lang[titleKey];
    const eventType = event.eventType || event.EventType;
    const tooltipKey = eventType ? `tooltip_gachaName_${eventType}`.toLowerCase() : null;
    const tooltipName = tooltipKey ? lang[tooltipKey] : null;
    const name = titleName || tooltipName || event.comment1 || event.comment2 || fallback;
    return name;
}

function getEntriesForEventLatestSet(eventId) {
    const eventEntries = leagueEntries.filter(e =>
        String(getProp(e, ["eventID", "eventId", "eventid"])) === String(eventId)
    );

    const setIds = Array.from(new Set(
        eventEntries
            .map(e => Number(getProp(e, ["rewardSetID", "rewardSetId", "rewardsetid"])))
            .filter(v => !Number.isNaN(v))
    ));

    if (setIds.length === 0) return eventEntries;

    const latestSetId = Math.max(...setIds);
    return eventEntries.filter(e =>
        Number(getProp(e, ["rewardSetID", "rewardSetId", "rewardsetid"])) === latestSetId
    );
}

function prettifyDifficultyName(rawName) {
    const name = String(rawName || "").toLowerCase();
    const langKey = `dialog_difficultyscaling_${name}`;
    if (lang[langKey]) return lang[langKey];

    const map = {
        easy: "Easy",
        easyplus: "Easy+",
        intermediate: "Intermediate",
        intermediateplus: "Intermediate+",
        hard: "Hard",
        hardplus: "Hard+",
        expert: "Extreme",
        expertplus: "Extreme+",
        master: "Master",
        masterplus: "Master+",
        archmaster: "Archmaster"
    };
    return map[name] || rawName || "Difficulty";
}

function hasSubType(entry) {
    return entry && entry.subType !== undefined && entry.subType !== null && String(entry.subType).trim() !== "";
}

function isIndividualEntry(entry) {
    return !hasSubType(entry);
}

function isAllianceEntry(entry) {
    return String(entry.subType || "") === "1";
}

function isBerimondBlueEntry(entry) {
    return String(entry?.subType ?? "") === "0";
}

function isBerimondRedEntry(entry) {
    return String(entry?.subType ?? "") === "1";
}

function getLevelLabel(eventId, leagueTypeId) {
    const leagueTypes = getArray(itemsData, ["leaguetypes"]);
    const matches = leagueTypes
        .filter(x =>
            String(x.leaguetypeID) === String(leagueTypeId) &&
            String(x.eventID) === String(eventId))
        .map(x => ({ min: Number(x.minLevel), max: Number(x.maxLevel) }))
        .filter(x => !Number.isNaN(x.min) && !Number.isNaN(x.max))
        .sort((a, b) => (a.max - a.min) - (b.max - b.min));

    const best = matches[0];
    if (!best) return `Lv ${leagueTypeId}`;
    return `Lv ${best.min}-${best.max}`;
}

function getEntriesFiltered({ eventId, mode, levelId = null }) {
    let entries = getEntriesForEventLatestSet(eventId);
    if (isIndividualOnlyEvent(eventId)) {
        if (mode === "berimond_blue") entries = entries.filter(isBerimondBlueEntry);
        else if (mode === "berimond_red") entries = entries.filter(isBerimondRedEntry);
    } else {
        entries = mode === "individual" ? entries.filter(isIndividualEntry) : entries.filter(isAllianceEntry);
    }
    if (levelId !== null && levelId !== undefined && String(levelId).trim() !== "") {
        entries = entries.filter(e =>
            String(getProp(e, ["leaguetypeID", "leagueTypeID", "leaguetypeid"])) === String(levelId));
    }
    return entries;
}

function getDifficultyOptions(eventId) {
    const difficulties = (difficultyByEvent[String(eventId)] || [])
        .map(item => {
            const type = difficultyTypeById[String(item.difficultyTypeID)] || {};
            const normalizedName = String(type.name || "").toLowerCase();
            return {
                difficultyId: String(item.difficultyID),
                sortOrder: Number(type.sortOrder || 999),
                label: prettifyDifficultyName(type.name || `difficulty_${item.difficultyTypeID}`),
                normalizedName
            };
        })
        .sort((a, b) => a.sortOrder - b.sortOrder);

    return difficulties;
}

function getPreferredDifficultyOption(options) {
    if (!Array.isArray(options) || options.length === 0) return null;
    const masterPlus = options.find(opt => opt.normalizedName === "masterplus");
    if (masterPlus) return masterPlus;
    return options[options.length - 1];
}

function getAllianceFixedDifficultyOption(options) {
    if (!Array.isArray(options) || options.length === 0) return null;
    const easy = options.find(opt => opt.normalizedName === "easy");
    if (easy) return easy;
    return options[0];
}

function isIndividualOnlyEvent(eventId) {
    return String(eventId) === "3";
}

function hasDifficultyFilter(eventId) {
    return String(eventId) !== "3";
}

function shouldRenderTopRewards(eventId) {
    return true;
}

function expandRewardIdTokens(rewardIdTokens) {
    const expanded = [];
    (rewardIdTokens || []).forEach(token => {
        parseIdAmountToken(token).forEach(parsed => {
            if (parsed && parsed.id !== null && parsed.id !== undefined) {
                expanded.push(String(parsed.id));
            }
        });
    });
    return expanded;
}

function isTopRewardObject(reward) {
    if (!reward) return false;
    const c1 = String(reward.comment1 || "").toLowerCase();
    const c2 = String(reward.comment2 || "").toLowerCase();
    return c1.includes("top") || c2.includes("top");
}

function getTopRewardPairsForEntry({ entry, eventId, baseRewardIds, baseNeededPoints, scalingRewards, topValues }) {
    if (!shouldRenderTopRewards(eventId)) return [];

    const topTiers = [...(topValues || [])].sort((a, b) => b - a);
    topTiers.push(1);

    if (String(eventId) === "3") {
        const rankingCount = Math.max(0, (baseRewardIds || []).length - (baseNeededPoints || []).length);
        if (rankingCount <= 0) return [];

        const tiers = [...(topValues || [])].sort((a, b) => a - b);
        while (tiers.length < rankingCount) tiers.unshift(1);
        if (tiers.length > rankingCount) tiers.splice(0, tiers.length - rankingCount);

        const rankingRewardIds = (baseRewardIds || []).slice(-rankingCount);
        return tiers
            .map((tier, index) => ({
                tier,
                rewardId: rankingRewardIds[rankingRewardIds.length - 1 - index]
            }))
            .sort((a, b) => b.tier - a.tier)
            .filter(pair => pair.rewardId);
    }

    const collectTopIds = (candidates) => {
        const topIds = [];
        for (let i = candidates.length - 1; i >= 0; i--) {
            const rewardId = candidates[i];
            const reward = rewardsById[String(rewardId)];
            if (!isTopRewardObject(reward)) continue;
            if (!topIds.includes(String(rewardId))) {
                topIds.unshift(String(rewardId));
            }
            if (topIds.length >= topTiers.length) break;
        }
        return topIds;
    };

    let topRewardIds = collectTopIds(expandRewardIdTokens(scalingRewards || []));
    if (topRewardIds.length === 0) {
        topRewardIds = collectTopIds(expandRewardIdTokens(baseRewardIds || []));
    }

    if (topRewardIds.length === 0) return [];

    while (topTiers.length < topRewardIds.length) topTiers.push(1);
    if (topTiers.length > topRewardIds.length) {
        topTiers.splice(topRewardIds.length);
    }

    return topRewardIds.map((rewardId, index) => ({
        tier: topTiers[index],
        rewardId
    }));
}

function updateSelectorVisibility() {
    const difficultySelect = document.getElementById("difficultySelect");
    const difficultyContainer = difficultySelect?.parentElement;
    if (!difficultyContainer) return;
    difficultyContainer.style.display = "";
}

function setupSelectors() {
    const eventSelect = document.getElementById("eventSelect");
    const modeSelect = document.getElementById("modeSelect");
    const levelSelect = document.getElementById("levelSelect");
    const difficultySelect = document.getElementById("difficultySelect");
    const viewSelect = document.getElementById("viewSelect");

    const availableEvents = [
        { id: "3", fallback: "Event 3" },
        { id: "71", fallback: "Event 71" },
        { id: "72", fallback: "Nomad Invasion" },
        { id: "80", fallback: "Samurai Invasion" },
        { id: "103", fallback: "Event 103" }
    ].filter(ev => leagueEntries.some(e => String(getProp(e, ["eventID", "eventId", "eventid"])) === ev.id));

    eventSelect.innerHTML = "";
    if (availableEvents.length === 0) {
        eventSelect.innerHTML = `<option value="" selected>${UI_LANG.no_events}</option>`;
        modeSelect.innerHTML = `<option value="" selected>${UI_LANG.no_modes}</option>`;
        levelSelect.innerHTML = `<option value="" selected>${UI_LANG.no_levels}</option>`;
        difficultySelect.innerHTML = `<option value="" selected>${UI_LANG.no_difficulties}</option>`;
        renderRewards([]);
        return;
    }

    availableEvents.forEach(event => {
        const option = document.createElement("option");
        option.value = String(event.id);
        option.textContent = getEventLabel(event.id, event.fallback);
        eventSelect.appendChild(option);
    });

    eventSelect.addEventListener("change", () => {
        updateHashForEvent(eventSelect.value);
        updateSelectorVisibility();
        updateModeOptions();
        updateLevelOptions();
        updateDifficultyOptions();
        renderRewardsForSelection();
    });

    modeSelect.addEventListener("change", () => {
        updateLevelOptions();
        updateDifficultyOptions();
        renderRewardsForSelection();
    });

    levelSelect.addEventListener("change", () => {
        updateDifficultyOptions();
        renderRewardsForSelection();
    });

    difficultySelect.addEventListener("change", () => {
        renderRewardsForSelection();
    });

    if (viewSelect) {
        viewSelect.innerHTML = "";
        const detailedOption = document.createElement("option");
        detailedOption.value = "detailed";
        detailedOption.textContent = UI_LANG.view_detailed;
        viewSelect.appendChild(detailedOption);

        const summaryActivityOption = document.createElement("option");
        summaryActivityOption.value = "summary_activity";
        summaryActivityOption.textContent = UI_LANG.view_summary_activity;
        viewSelect.appendChild(summaryActivityOption);

        const summaryAllOption = document.createElement("option");
        summaryAllOption.value = "summary_all";
        summaryAllOption.textContent = UI_LANG.view_summary_all;
        viewSelect.appendChild(summaryAllOption);

        viewSelect.value = "detailed";
        viewSelect.addEventListener("change", () => {
            renderRewardsForSelection();
        });
    }

    const hashEvent = getEventFromHash();
    const hasHashEvent = hashEvent && availableEvents.some(e => String(e.id) === String(hashEvent));
    eventSelect.value = hasHashEvent ? String(hashEvent) : String(availableEvents[0].id);
    updateHashForEvent(eventSelect.value);
    updateSelectorVisibility();
    updateModeOptions();
    updateLevelOptions();
    updateDifficultyOptions();
    renderRewardsForSelection();
}

function summarizeRewards(rewards, includeTopRewards = true) {
    const sourceRewards = includeTopRewards
        ? rewards
        : rewards.filter(reward => !reward.isTopReward);
    const map = new Map();

    sourceRewards.forEach(reward => {
        const key = [
            String(reward.type || ""),
            String(reward.id ?? ""),
            String(reward.addKeyName || ""),
            String(reward.name || "")
        ].join("|");

        if (!map.has(key)) {
            map.set(key, {
                ...reward,
                amount: Number(reward.amount) || 0,
                _modes: new Set([reward.modeText || "-"]),
                _requirements: new Set([reward.chanceText || "-"])
            });
            return;
        }

        const agg = map.get(key);
        agg.amount += Number(reward.amount) || 0;
        agg._modes.add(reward.modeText || "-");
        agg._requirements.add(reward.chanceText || "-");
    });

    const summarized = Array.from(map.values()).map(item => {
        return {
            ...item,
            modeText: "-",
            chanceText: "-"
        };
    });

    summarized.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    return summarized;
}

function updateModeOptions() {
    const eventSelect = document.getElementById("eventSelect");
    const modeSelect = document.getElementById("modeSelect");
    const eventId = eventSelect.value;

    if (isIndividualOnlyEvent(eventId)) {
        const entries = getEntriesForEventLatestSet(eventId);
        const hasBlue = entries.some(isBerimondBlueEntry);
        const hasRed = entries.some(isBerimondRedEntry);

        modeSelect.innerHTML = "";
        if (hasBlue) {
            const blueOption = document.createElement("option");
            blueOption.value = "berimond_blue";
            blueOption.textContent = getBerimondFactionLabel("0");
            modeSelect.appendChild(blueOption);
        }
        if (hasRed) {
            const redOption = document.createElement("option");
            redOption.value = "berimond_red";
            redOption.textContent = getBerimondFactionLabel("1");
            modeSelect.appendChild(redOption);
        }
        if (!hasBlue && !hasRed) {
            modeSelect.innerHTML = `<option value="" selected>${UI_LANG.no_modes}</option>`;
            modeSelect.disabled = true;
            return;
        }
        modeSelect.value = hasBlue ? "berimond_blue" : "berimond_red";
        modeSelect.disabled = !(hasBlue && hasRed);
        return;
    }

    const entries = getEntriesForEventLatestSet(eventId);

    const hasIndividual = entries.some(isIndividualEntry);
    const hasAlliance = entries.some(isAllianceEntry);

    modeSelect.innerHTML = "";
    if (!hasIndividual && !hasAlliance) {
        modeSelect.innerHTML = `<option value="" selected>${UI_LANG.no_modes}</option>`;
        modeSelect.disabled = true;
        return;
    }

    if (hasIndividual) {
        const option = document.createElement("option");
        option.value = "individual";
        option.textContent = UI_LANG.individual;
        modeSelect.appendChild(option);
    }

    if (hasAlliance) {
        const option = document.createElement("option");
        option.value = "alliance";
        option.textContent = UI_LANG.alliance;
        modeSelect.appendChild(option);
    }

    modeSelect.disabled = false;
    modeSelect.value = hasIndividual ? "individual" : "alliance";
}

function updateLevelOptions() {
    const eventSelect = document.getElementById("eventSelect");
    const modeSelect = document.getElementById("modeSelect");
    const levelSelect = document.getElementById("levelSelect");
    const eventId = eventSelect.value;
    const mode = modeSelect.value;

    const entries = getEntriesFiltered({ eventId, mode, levelId: null });
    const levelIds = Array.from(
        new Set(entries.map(e => String(getProp(e, ["leaguetypeID", "leagueTypeID", "leaguetypeid"]))).filter(Boolean))
    ).sort((a, b) => Number(a) - Number(b));

    levelSelect.innerHTML = "";
    if (levelIds.length === 0) {
        levelSelect.innerHTML = `<option value="" selected>${UI_LANG.no_levels}</option>`;
        levelSelect.disabled = true;
        return;
    }

    levelIds.forEach(levelId => {
        const option = document.createElement("option");
        option.value = levelId;
        option.textContent = getLevelLabel(eventId, levelId);
        levelSelect.appendChild(option);
    });

    levelSelect.value = levelIds[levelIds.length - 1];
    levelSelect.disabled = levelIds.length === 1;
}

function updateDifficultyOptions() {
    const eventSelect = document.getElementById("eventSelect");
    const modeSelect = document.getElementById("modeSelect");
    const levelSelect = document.getElementById("levelSelect");
    const difficultySelect = document.getElementById("difficultySelect");
    const eventId = eventSelect.value;
    const mode = modeSelect.value;
    const levelId = levelSelect.value;

    if (!hasDifficultyFilter(eventId)) {
        difficultySelect.innerHTML = "";
        const option = document.createElement("option");
        option.value = "";
        option.textContent = UI_LANG.no_difficulty_for_event;
        difficultySelect.appendChild(option);
        difficultySelect.value = "";
        difficultySelect.disabled = true;
        return;
    }

    if (mode === "alliance") {
        const entries = getEntriesFiltered({ eventId, mode, levelId });
        const difficultyIdsInEntries = new Set(
            entries.flatMap(e => parseCsvIds(getProp(e, ["difficultyIDforMaxPoints", "difficultyidformaxpoints"])))
        );
        const difficultyOptions = getDifficultyOptions(eventId)
            .filter(opt => difficultyIdsInEntries.size === 0 || difficultyIdsInEntries.has(opt.difficultyId));
        const fixed = getAllianceFixedDifficultyOption(difficultyOptions);

        difficultySelect.innerHTML = "";
        const option = document.createElement("option");
        option.value = fixed ? fixed.difficultyId : "alliance_fixed";
        option.textContent = UI_LANG.alliance_rewards || UI_LANG.alliance;
        difficultySelect.appendChild(option);
        difficultySelect.value = option.value;
        difficultySelect.disabled = true;
        return;
    }

    const entries = getEntriesFiltered({ eventId, mode, levelId });
    const difficultyIdsInEntries = new Set(
        entries.flatMap(e => parseCsvIds(getProp(e, ["difficultyIDforMaxPoints", "difficultyidformaxpoints"])))
    );

    const difficultyOptions = getDifficultyOptions(eventId)
        .filter(opt => difficultyIdsInEntries.size === 0 || difficultyIdsInEntries.has(opt.difficultyId));

    difficultySelect.innerHTML = "";
    if (difficultyOptions.length === 0) {
        difficultySelect.innerHTML = `<option value="" selected>${UI_LANG.no_difficulties}</option>`;
        difficultySelect.disabled = true;
        return;
    }

    difficultyOptions.forEach(opt => {
        const option = document.createElement("option");
        option.value = opt.difficultyId;
        option.textContent = opt.label;
        difficultySelect.appendChild(option);
    });

    const preferred = getPreferredDifficultyOption(difficultyOptions);
    difficultySelect.value = preferred ? preferred.difficultyId : difficultyOptions[0].difficultyId;
    difficultySelect.disabled = difficultyOptions.length === 1;
}

function renderRewardsForSelection() {
    const eventSelect = document.getElementById("eventSelect");
    const modeSelect = document.getElementById("modeSelect");
    const levelSelect = document.getElementById("levelSelect");
    const difficultySelect = document.getElementById("difficultySelect");
    const viewSelect = document.getElementById("viewSelect");
    const eventId = eventSelect.value;
    const mode = modeSelect.value;
    const levelId = levelSelect.value;
    const difficultyRaw = difficultySelect.value;
    const difficulty = hasDifficultyFilter(eventId) ? difficultyRaw : "all";

    if (!eventId || !mode || !levelId || (hasDifficultyFilter(eventId) && !difficultyRaw)) {
        renderRewards([]);
        return;
    }

    updateHashForEvent(eventId);

    const entries = getEntriesFiltered({ eventId, mode, levelId });

    if (entries.length === 0) {
        renderRewards([]);
        return;
    }

    entries.sort((a, b) =>
        Number(getProp(a, ["leaguetypeID", "leagueTypeID", "leaguetypeid"])) -
        Number(getProp(b, ["leaguetypeID", "leagueTypeID", "leaguetypeid"]))
    );

    const difficultyOptions = getDifficultyOptions(eventId);
    const selectedDifficultySort = difficultyOptions.find(o => String(o.difficultyId) === String(difficulty))?.sortOrder ?? null;
    const difficultyLabelById = Object.fromEntries(difficultyOptions.map(o => [String(o.difficultyId), o.label]));

    const rewards = [];
    entries.forEach(entry => {
        const baseRewardIds = parseCsvIds(getProp(entry, ["rewardIDs", "rewardIds", "rewardids"]));
        const baseNeededPoints = parseCsvIds(getProp(entry, ["neededPointsForRewards", "neededpointsforrewards"]));
        const topValues = parseCsvIds(getProp(entry, ["topXValue", "topxvalue"]))
            .map(v => Number(v))
            .filter(v => !Number.isNaN(v))
            .sort((a, b) => a - b);

        const scalingDifficultyIds = parseCsvIds(getProp(entry, ["difficultyIDforMaxPoints", "difficultyidformaxpoints"]));
        const scalingMaxPoints = parseCsvIds(getProp(entry, ["difficultyMaxPoints", "difficultymaxpoints"])).map(v => Number(v));
        const scalingNeeded = parseCsvIds(getProp(entry, ["difficultyScalingNeededPointsForRewards", "difficultyscalingneededpointsforrewards"]));
        const scalingRewards = parseCsvIds(getProp(entry, ["difficultyScalingRewardIDs", "difficultyscalingrewardids"]));
        const scalingByDifficulty = {};
        if (scalingDifficultyIds.length > 0 && scalingNeeded.length > 0 && scalingRewards.length > 0) {
            let start = 0;
            for (let i = 0; i < scalingDifficultyIds.length; i++) {
                const maxVal = Number(scalingMaxPoints[i]);
                let end = -1;
                for (let j = start; j < scalingNeeded.length; j++) {
                    if (Number(scalingNeeded[j]) === maxVal) {
                        end = j;
                        break;
                    }
                }
                if (end < start) break;
                scalingByDifficulty[String(scalingDifficultyIds[i])] = {
                    neededPoints: scalingNeeded.slice(start, end + 1),
                    rewardIds: scalingRewards.slice(start, end + 1)
                };
                start = end + 1;
            }
        }

        let selectedDifficultyIds = [];
        if (difficulty === "all") {
            selectedDifficultyIds = [];
        } else if (mode === "individual" && selectedDifficultySort !== null) {
            selectedDifficultyIds = difficultyOptions
                .filter(o => o.sortOrder <= selectedDifficultySort)
                .map(o => String(o.difficultyId));
        } else {
            selectedDifficultyIds = [String(difficulty)];
        }

        const scenarios = [];
        if (selectedDifficultyIds.length === 0) {
            scenarios.push({
                difficultyId: null,
                neededPoints: baseNeededPoints,
                rewardIds: baseRewardIds
            });
        } else {
            selectedDifficultyIds.forEach(diffId => {
                const segment = scalingByDifficulty[diffId];
                if (!segment) return;
                scenarios.push({
                    difficultyId: diffId,
                    neededPoints: segment.neededPoints,
                    rewardIds: segment.rewardIds
                });
            });
        }

        scenarios.forEach(scenario => {
            const rewardIds = scenario.rewardIds;
            const neededPoints = scenario.neededPoints;
            const milestoneCount = Math.min(rewardIds.length, neededPoints.length);

            for (let i = 0; i < milestoneCount && i < neededPoints.length; i++) {
                const reward = rewardsById[String(rewardIds[i])];
                const pointsValue = Number(neededPoints[i]);
                const pointsText = Number.isNaN(pointsValue) ? String(neededPoints[i]) : formatNumber(pointsValue);
                const requirementText = pointsText;
                const modeText = mode === "alliance"
                    ? UI_LANG.alliance_rewards
                    : (scenario.difficultyId ? (difficultyLabelById[String(scenario.difficultyId)] || String(scenario.difficultyId)) : "-");
                const entriesToPush = resolveRewardEntries(reward);

                if (entriesToPush.length > 0) {
                    entriesToPush.forEach(it => {
                        rewards.push({
                            name: it.name,
                            amount: it.amount,
                            chanceText: requirementText,
                            modeText,
                            id: it.id,
                            type: it.type || null,
                            addKeyName: it.addKeyName || null,
                            isTopReward: false
                        });
                    });
                } else {
                    rewards.push({
                        name: resolveRewardName(reward) || "Reward",
                        amount: getRewardAmount(reward),
                        chanceText: requirementText,
                        modeText,
                        id: resolveRewardIdStrict(reward),
                        type: resolveRewardType(reward),
                        addKeyName: getAddKeyName(reward),
                        isTopReward: false
                    });
                }
            }
        });

        const rankingPairs = getTopRewardPairsForEntry({
            entry,
            eventId,
            baseRewardIds,
            baseNeededPoints,
            scalingRewards,
            topValues
        });
        if (rankingPairs.length > 0) {
            rankingPairs.forEach(pair => {
                const reward = rewardsById[String(pair.rewardId)];
                const requirementText = `${UI_LANG.top}${pair.tier}`;
                const modeText = "-";
                const entriesToPush = resolveRewardEntries(reward);

                if (entriesToPush.length > 0) {
                    entriesToPush.forEach(it => {
                        rewards.push({
                            name: it.name,
                            amount: it.amount,
                            chanceText: requirementText,
                            modeText,
                            id: it.id,
                            type: it.type || null,
                            addKeyName: it.addKeyName || null,
                            isTopReward: true
                        });
                    });
                } else {
                    rewards.push({
                        name: resolveRewardName(reward) || "Reward",
                        amount: getRewardAmount(reward),
                        chanceText: requirementText,
                        modeText,
                        id: resolveRewardIdStrict(reward),
                        type: resolveRewardType(reward),
                        addKeyName: getAddKeyName(reward),
                        isTopReward: true
                    });
                }
            });
        }
    });

    const selectedView = viewSelect?.value || "detailed";
    let outputRewards = rewards;
    if (selectedView === "summary_activity") {
        outputRewards = summarizeRewards(rewards, false);
    } else if (selectedView === "summary_all") {
        outputRewards = summarizeRewards(rewards, true);
    }

    renderRewards(outputRewards, UI_LANG.requirement);
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
          <p class="mb-0">${UI_LANG.no_rewards}</p>
        </div>
      </div>`;
        container.appendChild(emptyCol);
        return;
    }

    rewards.forEach(reward => {
        const col = document.createElement("div");
        col.className = "col-12 col-md-6 d-flex";
        const amountText = formatNumber(reward.amount);
        const chanceText = reward.chanceText || "-";
        const modeText = reward.modeText || "-";
        const idText = (reward.id !== undefined && reward.id !== null && reward.id !== "") ? String(reward.id) : "-";
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
        } else if (reward.type === "lootbox") {
            imageUrl = getLootBoxImageUrl(reward);
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
                <div class="reward-stat-value">${chanceText}</div>
              </div>
              <div class="reward-stat card-cell flex-fill">
                <div class="reward-stat-label">${UI_LANG.mode}</div>
                <div class="reward-stat-value">${modeText}</div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
        container.appendChild(col);
    });
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
            itemLabel: "event rewards",
            langCode: currentLanguage,
            normalizeNameFn: normalizeName,

            assets: {
                decorations: true,
                constructions: true,
                looks: true,
                units: true,
                currencies: true,
                lootboxes: true
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
                lootBoxImageUrlMap = imageMaps?.lootboxes ?? {};

                const rewards = getArray(itemsData, ["rewards"]);
                const currencies = getArray(itemsData, ["currencies"]);
                const equipment = getArray(itemsData, ["equipments"]);
                const skins = getArray(itemsData, ["worldmapskins"]);
                const lootBoxes = getArray(itemsData, ["lootBoxes", "lootboxes"]);

                lookSkinsById = {};
                skins.forEach(s => {
                    lookSkinsById[String(s.skinID)] = s.name;
                });

                const constructions = getArray(itemsData, ["constructionItems"]);
                const decorations = getArray(itemsData, ["buildings"]);
                const units = getArray(itemsData, ["units"]);
                leagueEntries = getArray(itemsData, ["leaguetypeevents", "leagueTypeEvents", "leagueTypeevents"]);
                const autoScalingDifficulties = getArray(itemsData, ["eventAutoScalingDifficulties", "eventautoscalingdifficulties"]);
                const autoScalingDifficultyTypes = getArray(itemsData, ["eventAutoScalingDifficultyTypes", "eventautoscalingdifficultytypes"]);

                rewardsById = buildLookup(rewards, "rewardID");
                currenciesById = buildLookup(currencies, "currencyID");
                equipmentById = buildLookup(equipment, "equipmentID");
                constructionById = buildLookup(constructions, "constructionItemID");
                decorationsById = buildLookup(decorations, "wodID");
                unitsById = buildLookup(units, "wodID");
                lootBoxesById = buildLookup(lootBoxes, "lootBoxID");
                difficultyTypeById = buildLookup(autoScalingDifficultyTypes, "difficultyTypeID");
                rewardResolver = createRewardResolver(
                    () => ({
                        lang,
                        currenciesById,
                        equipmentById,
                        constructionById,
                        decorationsById,
                        unitsById,
                        lootBoxesById,
                        lookSkinsById,
                        decorationImageUrlMap: imageUrlMap,
                        constructionImageUrlMap,
                        equipmentImageUrlMap,
                        unitImageUrlMap,
                        currencyImageUrlMap: collectableCurrencyImageUrlMap,
                        lootBoxImageUrlMap
                    }),
                    {
                        includeCurrency2: true,
                        includeLootBox: true,
                        includeUnitLevel: true,
                        rubyImageUrl: "../loot_box/img/ruby.png"
                    }
                );
                difficultyByEvent = {};
                autoScalingDifficulties.forEach(item => {
                    const eventId = String(item.eventID || "");
                    if (!difficultyByEvent[eventId]) difficultyByEvent[eventId] = [];
                    difficultyByEvent[eventId].push(item);
                });

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