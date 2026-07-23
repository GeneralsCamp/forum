import { initAutoHeight } from "../shared/ResizeService.mjs";
import { createLoader } from "../shared/LoadingService.mjs";
import { coreInit } from "../shared/CoreInit.mjs";
import { initLanguageSelector, getInitialLanguage } from "../shared/LanguageService.mjs";
import { revealCard } from "../shared/CardReveal.mjs";

let lang = {};
let itemsData = null;
let ownLang = {};
let UI_LANG = {};
let currentLanguage = getInitialLanguage();

let quests = [];
let questsById = {};
let currenciesById = {};
let unitsById = {};
let lootBoxesById = {};
let raidBossesById = {};

const loader = createLoader();
const GT_QUEST_EVENT_ID = "129";
const RIFT_QUEST_EVENT_ID = "133";

function lowercaseKeysRecursive(input) {
    if (!input || typeof input !== "object") return input;
    if (Array.isArray(input)) return input.map(lowercaseKeysRecursive);

    const out = {};
    for (const key in input) out[key.toLowerCase()] = lowercaseKeysRecursive(input[key]);
    return out;
}

async function loadOwnLang() {
    try {
        const res = await fetch("./ownLang.json");
        ownLang = lowercaseKeysRecursive(await res.json());
    } catch (err) {
        console.error("ownLang error:", err);
        ownLang = {};
    }
}

function applyOwnLang() {
    const L = ownLang[currentLanguage?.toLowerCase()]?.ui || ownLang.en?.ui || {};
    UI_LANG = {
        no_quests: L.no_quests || "No quests match the current filters.",
        chance: L.chance || "Chance",
        level: getLangValue(["level"], "Level"),
        level_filter_unavailable: L.level_filter_unavailable || "Level filter unavailable",
        type_all: L.type_all || "All quest types",
        type_defeat_target: L.type_defeat_target || "Defeat Target",
        type_obtain_currencies_or_resources: L.type_obtain_currencies_or_resources || "Obtain Currencies Or Resources",
        type_obtain_units: L.type_obtain_units || "Obtain Units",
        type_spend_currencies_or_resources: L.type_spend_currencies_or_resources || "Spend Currencies Or Resources"
    };
}

function capitalizeWords(str) {
    return String(str || "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase());
}

function getLangValue(keys, fallback = null) {
    for (const key of keys) {
        const value = lang[String(key || "").toLowerCase()];
        if (value) return value;
    }
    return fallback;
}

function parseCondition(condition) {
    const parts = String(condition || "").split("+");
    const targetParts = String(parts[2] || "").split("|");
    return {
        type: parts[0] || "unknown",
        amount: parts[1] || "",
        targetId: parts[2] || "",
        level: targetParts[0] || "",
        itemId: targetParts[1] || targetParts[0] || ""
    };
}

function resolveQuestTitle(quest) {
    const title = quest.eventKey === "rift"
        ? resolveRiftQuestTitle(quest)
        : getLangValue([`popup_ame_quest_title_${quest.allianceQuestId}`], capitalizeWords(quest.parsed.type));
    const levelLabel = getQuestLevelLabel(quest);
    return levelLabel ? `${title} (${levelLabel})` : title;
}

function resolveRiftQuestTitle(quest) {
    const template = getLangValue([`popup_arme_quest_title_${quest.parsed.type}`]);
    if (!template) return capitalizeWords(quest.parsed.type);
    return String(template)
        .replace(/\{[^}]+\}/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function getQuestLevelLabel(quest) {
    if (quest?.eventKey !== "rift") return "";

    const minLevel = Number(quest.minRaidBossLevel || 0);
    const maxLevel = Number(quest.maxRaidBossLevel || 0);
    if (!minLevel && !maxLevel) return "";
    if (!maxLevel || minLevel === maxLevel) return `lvl.${minLevel || maxLevel}`;
    return `lvl.${minLevel}-${maxLevel}`;
}

function formatLargeNumbersInText(text) {
    return String(text || "").replace(/\b\d{5,}\b/g, match => {
        const parsed = Number(match);
        return Number.isFinite(parsed) ? parsed.toLocaleString(currentLanguage) : match;
    });
}

function resolveQuestDescription(quest) {
    if (quest.eventKey === "rift") {
        const resolved = resolveRiftQuestDescription(quest);
        if (resolved) return resolved;
    }

    const req = getLangValue([`popup_ame_quest_requirement_${quest.allianceQuestId}`]);
    if (req) return formatLargeNumbersInText(req);
    const conditionRaw = String(quest.condition || "").replace(/\+/g, " + ");
    return formatLargeNumbersInText(conditionRaw);
}

function formatLangTemplate(template, values = []) {
    return String(template || "").replace(/\{(\d+)\}/g, (match, index) =>
        values[index] !== undefined && values[index] !== null ? String(values[index]) : match
    );
}

function formatQuestNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toLocaleString(currentLanguage) : String(value || "");
}

function getCurrencyName(currencyId) {
    const currency = currenciesById[String(currencyId)];
    if (!currency) return `Currency ${currencyId}`;
    const rawName = currency.name || currency.jsonkey || currency.assetname || "";
    return getLangValue([`currency_name_${rawName}`], rawName || `Currency ${currencyId}`);
}

function getUnitName(wodId) {
    const unit = unitsById[String(wodId)];
    if (!unit) return `Unit ${wodId}`;
    const rawType = unit.type || unit.name || "";
    return getLangValue([`${rawType}_name`], unit.comment1 || rawType || `Unit ${wodId}`);
}

function getLootBoxName(lootBoxId) {
    const lootBox = lootBoxesById[String(lootBoxId)];
    if (!lootBox) return `Loot box ${lootBoxId}`;
    return getLangValue(
        [`mysterybox_boxname_${lootBox.name}_${lootBox.rarity}`],
        lootBox.name || `Loot box ${lootBoxId}`
    );
}

function getRiftBossName(bossId) {
    const boss = raidBossesById[String(bossId)];
    if (!boss) return `Boss ${bossId}`;

    const rawName = String(boss.name || "").trim();
    return getLangValue([`are_boss_name_${rawName}`], rawName || `Boss ${bossId}`);
}

function getRiftQuestTemplateValues(quest) {
    const parsed = quest.parsed || {};
    const amount = formatQuestNumber(parsed.amount);
    const level = formatQuestNumber(parsed.level || quest.minRaidBossLevel || 0);
    const type = String(parsed.type || "");

    if (type === "collectCurrency" || type === "spendCurrency" || type === "buyCurrency") {
        return [amount, getCurrencyName(parsed.itemId)];
    }

    if (type === "openLootBox") {
        return [amount, getLootBoxName(parsed.itemId)];
    }

    if (type === "killWallUnits" || type === "killCourtyardUnits" || type === "consumeTool") {
        return [amount, getUnitName(parsed.itemId), level];
    }

    if (type === "killWallUnitsAny" || type === "killCourtyardUnitsAny" ||
        type === "obtainRiftPointsWall" || type === "obtainRiftPointsCourtyard") {
        return [amount, level];
    }

    if (type === "offMeleeUnits" || type === "offRangeUnits" ||
        type === "defMeleeUnits" || type === "defRangeUnits") {
        return [amount, formatQuestNumber(parsed.itemId)];
    }

    return [amount, parsed.itemId, level];
}

function resolveRiftQuestDescription(quest) {
    const template = getLangValue([`popup_arme_quest_requirement_${quest.parsed.type}`]);
    if (!template) return null;
    return formatLargeNumbersInText(formatLangTemplate(template, getRiftQuestTemplateValues(quest)));
}

function getRequirementLabel() {
    return getLangValue(["popup_ame_quest_requirement_title"], "Quest Requirement");
}

function getRewardTitleLabel() {
    return getLangValue(["popup_ame_quest_reward_title"], "Reward");
}

function getRewardPointsLabel() {
    return getLangValue(["points_noValue", "popup_ame_quest_reward"], "Points");
}

function getChanceLabel() {
    return UI_LANG.chance || "Chance";
}

function formatDurationClock(totalSeconds) {
    const safe = Math.max(0, Number(totalSeconds) || 0);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parseChanceValue(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
}

function formatQuestChancePercent(chanceValue) {
    const chanceTotal = getCurrentQuestChanceTotal();
    if (!chanceTotal || chanceTotal <= 0) return "-";
    const percent = (chanceValue / chanceTotal) * 100;
    return `${percent.toFixed(2)}%`;
}

function getEventLabel(eventId, fallback = "Event") {
    const titleName = getLangValue([`event_title_${eventId}`]);
    if (titleName) return titleName;

    const events = Array.isArray(itemsData?.events) ? itemsData.events : [];
    const event = events.find(e => String(e.eventid) === String(eventId));
    if (!event) return fallback;

    const tooltipName = event.eventtype
        ? getLangValue([`tooltip_gachaName_${event.eventtype}`])
        : null;

    return tooltipName || event.comment1 || event.comment2 || fallback;
}

function createInfoCell(label, value, extraClass = "") {
    const cell = document.createElement("div");
    cell.className = `quest-info-cell ${extraClass}`.trim();

    const labelEl = document.createElement("div");
    labelEl.className = "quest-info-label";
    labelEl.textContent = label;

    const valueEl = document.createElement("div");
    valueEl.className = "quest-info-value";
    valueEl.textContent = value;

    cell.appendChild(labelEl);
    cell.appendChild(valueEl);
    return cell;
}

function createRewardCell(points) {
    const cell = document.createElement("div");
    cell.className = "quest-info-cell quest-cell-reward";

    const labelEl = document.createElement("div");
    labelEl.className = "quest-info-label";
    labelEl.textContent = getRewardPointsLabel();

    const pointsAmountEl = document.createElement("div");
    pointsAmountEl.className = "quest-info-value quest-reward-amount";
    pointsAmountEl.textContent = `+${points.toLocaleString(currentLanguage)}`;

    cell.appendChild(labelEl);
    cell.appendChild(pointsAmountEl);
    return cell;
}

function buildQuestData() {
    const questsArr = itemsData.quests || [];
    const allianceQuests = itemsData.alliancequests || [];

    questsById = Object.fromEntries(questsArr.map(q => [String(q.questid), q]));
    currenciesById = Object.fromEntries((itemsData.currencies || []).map(c => [String(c.currencyid), c]));
    unitsById = Object.fromEntries((itemsData.units || []).map(u => [String(u.wodid), u]));
    lootBoxesById = Object.fromEntries((itemsData.lootboxes || []).map(box => [String(box.lootboxid), box]));
    raidBossesById = Object.fromEntries((itemsData.raidbosses || []).map(boss => [String(boss.raidbossid), boss]));

    quests = allianceQuests
        .map(q => {
            const qId = String(q.questid || "");
            const baseQuest = questsById[qId] || {};
            const condition = String(q.comment4 || baseQuest.conditions || "");
            const chanceValue = parseChanceValue(q.chance);
            return {
                allianceQuestId: String(q.alliancequestid || ""),
                questId: qId,
                eventId: String(q.eventid || ""),
                eventKey: String(q.eventid || "") === RIFT_QUEST_EVENT_ID ? "rift" : "gt",
                tier: String(q.comment2 || "").trim(),
                questType: String(q.questtype || ""),
                condition,
                parsed: parseCondition(condition),
                rewardPoints: Number(q.rewardpoints || 0),
                duration: Number(q.duration || 0),
                minRaidBossLevel: Number(q.minraidbosslevel || 0),
                maxRaidBossLevel: Number(q.maxraidbosslevel || 0),
                raidBossId: String(q.raidbossid || ""),
                chanceValue
            };
        });
}

function getTypeFilterValue() {
    const el = document.getElementById("typeFilter");
    return String(el?.value || "all");
}

function getQuestTypeFilterKey(quest) {
    return quest?.eventKey === "rift"
        ? String(quest.parsed?.type || quest.questType || "")
        : String(quest.questType || "");
}

function getLevelFilterValue() {
    const el = document.getElementById("levelFilter");
    return String(el?.value || "");
}

function getBossFilterValue() {
    const el = document.getElementById("bossFilter");
    return String(el?.value || "");
}

function getEventFilterValue() {
    const el = document.getElementById("eventFilter");
    return String(el?.value || "gt");
}

function getEventFilterValueFromHash() {
    const hash = window.location.hash.replace("#", "").trim().toLowerCase();
    if (hash === GT_QUEST_EVENT_ID || hash === "gt") return "gt";
    if (hash === RIFT_QUEST_EVENT_ID || hash === "rift") return "rift";
    return null;
}

function updateHashForEventFilter(value) {
    const eventId = value === "rift" ? RIFT_QUEST_EVENT_ID : GT_QUEST_EVENT_ID;
    if (window.location.hash.replace("#", "") === eventId) return;
    window.location.hash = eventId;
}

function getQuestTypeLabel(typeRaw) {
    if (getEventFilterValue() !== "rift") {
        const key = String(typeRaw || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const labels = {
            defeattarget: UI_LANG.type_defeat_target,
            obtaincurrenciesorresources: UI_LANG.type_obtain_currencies_or_resources,
            obtainunits: UI_LANG.type_obtain_units,
            spendcurrenciesorresources: UI_LANG.type_spend_currencies_or_resources,
            samuraiinvasion: getLangValue(["event_title_80"], "Samurai Invasion"),
            nomadinvasion: getLangValue(["event_title_72"], "Nomad Invasion")
        };
        return labels[key] || capitalizeWords(typeRaw);
    }

    const matchingQuests = getLevelFilteredQuests().filter(q => getQuestTypeFilterKey(q) === String(typeRaw || ""));
    const labels = [...new Set(
        matchingQuests
            .map(q => q.eventKey === "rift" ? resolveRiftQuestTitle(q) : resolveQuestTitle(q))
            .map(label => String(label || "").replace(/\s*\([^)]*\)\s*$/, "").trim())
            .filter(Boolean)
    )];

    if (labels.length === 1) return labels[0];
    if (labels.length > 1) return labels.slice(0, 3).join(" / ");

    const eventLabel = getLangValue([`event_title_${typeRaw}`]);
    return eventLabel || capitalizeWords(typeRaw);
}

function populateTypeFilterOptions() {
    const typeFilter = document.getElementById("typeFilter");
    if (!typeFilter) return;

    const selected = String(typeFilter.value || "all");
    const types = [...new Set(
        getLevelFilteredQuests()
            .map(q => getQuestTypeFilterKey(q).trim())
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    typeFilter.innerHTML = "";

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = UI_LANG.type_all;
    typeFilter.appendChild(allOption);

    types.forEach(type => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = getQuestTypeLabel(type);
        typeFilter.appendChild(option);
    });

    const hasSelected = [...typeFilter.options].some(o => o.value === selected);
    typeFilter.value = hasSelected ? selected : "all";
}

function populateEventFilterOptions() {
    const eventFilter = document.getElementById("eventFilter");
    if (!eventFilter) return;

    const selected = getEventFilterValueFromHash() || String(eventFilter.value || "gt");
    eventFilter.innerHTML = "";

    [
        ["gt", getEventLabel(GT_QUEST_EVENT_ID, "Grand Tournament")],
        ["rift", getEventLabel(RIFT_QUEST_EVENT_ID, "Rift Raid")]
    ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        eventFilter.appendChild(option);
    });

    const hasSelected = [...eventFilter.options].some(o => o.value === selected);
    eventFilter.value = hasSelected ? selected : "gt";
}

function populateBossFilterOptions() {
    const bossFilter = document.getElementById("bossFilter");
    const bossFilterWrap = document.getElementById("bossFilterWrap");
    if (!bossFilter || !bossFilterWrap) return;

    const isRift = getEventFilterValue() === "rift";
    bossFilterWrap.style.display = isRift ? "" : "none";

    if (!isRift) {
        bossFilter.disabled = true;
        return;
    }

    const selected = String(bossFilter.value || "");
    const bossIds = [...new Set(
        getEventFilteredQuests()
            .map(q => String(q.raidBossId || "").trim())
            .filter(Boolean)
    )].sort((a, b) => Number(a) - Number(b));

    bossFilter.innerHTML = "";

    bossIds.forEach(bossId => {
        const option = document.createElement("option");
        option.value = bossId;
        option.textContent = getRiftBossName(bossId);
        bossFilter.appendChild(option);
    });

    const hasSelected = [...bossFilter.options].some(option => option.value === selected);
    bossFilter.value = hasSelected ? selected : String(bossIds[0] || "");
    bossFilter.disabled = bossIds.length === 0;
}

function getAvailableRiftLevels() {
    const levels = new Set();
    getBossFilteredQuests()
        .forEach(q => {
            const minLevel = Number(q.minRaidBossLevel || 0);
            const maxLevel = Number(q.maxRaidBossLevel || minLevel || 0);
            if (!minLevel && !maxLevel) return;
            const start = minLevel || maxLevel;
            const end = maxLevel || minLevel;
            for (let level = start; level <= end; level += 1) {
                levels.add(level);
            }
        });

    return [...levels].sort((a, b) => a - b);
}

function populateLevelFilterOptions() {
    const levelFilter = document.getElementById("levelFilter");
    const levelFilterWrap = document.getElementById("levelFilterWrap");
    if (!levelFilter || !levelFilterWrap) return;

    const isRift = getEventFilterValue() === "rift";
    const selected = String(levelFilter.value || "");
    levelFilter.innerHTML = "";
    levelFilterWrap.style.display = isRift ? "" : "none";

    if (!isRift) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = UI_LANG.level_filter_unavailable;
        levelFilter.appendChild(option);
        levelFilter.disabled = true;
        return;
    }

    const levels = getAvailableRiftLevels();
    levels.forEach(level => {
        const option = document.createElement("option");
        option.value = String(level);
        option.textContent = `${UI_LANG.level} ${level}`;
        levelFilter.appendChild(option);
    });

    levelFilter.disabled = levels.length === 0;
    const hasSelected = [...levelFilter.options].some(o => o.value === selected);
    levelFilter.value = hasSelected ? selected : String(levels[0] || "");
}

function getEventFilteredQuests() {
    const eventValue = getEventFilterValue();
    if (eventValue === "rift") return quests.filter(q => q.eventKey === "rift");
    return quests.filter(q => q.eventKey === "gt");
}

function getBossFilteredQuests() {
    const eventQuests = getEventFilteredQuests();
    if (getEventFilterValue() !== "rift") return eventQuests;

    const bossValue = getBossFilterValue();
    if (!bossValue) return [];
    return eventQuests.filter(q => String(q.raidBossId || "") === bossValue);
}

function matchesSelectedLevel(quest) {
    const selectedLevel = Number(getLevelFilterValue() || 0);
    if (quest?.eventKey !== "rift" || !selectedLevel) return true;

    const minLevel = Number(quest.minRaidBossLevel || 0);
    const maxLevel = Number(quest.maxRaidBossLevel || minLevel || 0);
    return selectedLevel >= (minLevel || maxLevel) && selectedLevel <= (maxLevel || minLevel);
}

function getLevelFilteredQuests() {
    return getBossFilteredQuests().filter(matchesSelectedLevel);
}

function getCurrentQuestChanceTotal() {
    return getLevelFilteredQuests().reduce((sum, q) => sum + Number(q.chanceValue || 0), 0);
}

function getFilteredQuests() {
    const typeValue = getTypeFilterValue();

    return getLevelFilteredQuests().filter(q => {
        if (typeValue !== "all" && getQuestTypeFilterKey(q) !== typeValue) return false;
        return true;
    });
}

function renderQuests() {
    const container = document.getElementById("questRows");
    if (!container) return;

    const rows = getFilteredQuests();
    container.innerHTML = "";

    if (!rows.length) {
        const empty = document.createElement("div");
        empty.className = "col-12 filter-empty-message";
        empty.textContent = UI_LANG.no_quests;
        container.appendChild(empty);
        return;
    }

    rows.sort((a, b) => {
        const pointsDiff = Number(b.rewardPoints || 0) - Number(a.rewardPoints || 0);
        if (pointsDiff !== 0) return pointsDiff;

        const chanceDiff = Number(b.chanceValue || 0) - Number(a.chanceValue || 0);
        if (chanceDiff !== 0) return chanceDiff;

        const durationDiff = Number(a.duration || 0) - Number(b.duration || 0);
        if (durationDiff !== 0) return durationDiff;

        return Number(a.allianceQuestId || 0) - Number(b.allianceQuestId || 0);
    });

    rows.forEach(q => {
        const col = document.createElement("div");
        col.className = "col-12 col-lg-6 quest-col";

        const title = document.createElement("h2");
        title.className = "quest-panel-title";
        title.textContent = resolveQuestTitle(q);

        const infoGrid = document.createElement("div");
        infoGrid.className = "quest-info-grid";

        infoGrid.appendChild(createRewardCell(q.rewardPoints));
        infoGrid.appendChild(
            createInfoCell(
                getLangValue(["runTime", "runtime"], "Duration"),
                formatDurationClock(q.duration),
                "quest-cell-duration"
            )
        );
        infoGrid.appendChild(
            createInfoCell(
                getChanceLabel(),
                formatQuestChancePercent(q.chanceValue),
                "quest-cell-chance"
            )
        );
        infoGrid.appendChild(
            createInfoCell(
                getRequirementLabel(),
                resolveQuestDescription(q),
                "quest-span-3 quest-cell-requirement"
            )
        );

        const panel = document.createElement("article");
        panel.className = "quest-panel";
        panel.appendChild(title);
        panel.appendChild(infoGrid);

        col.appendChild(panel);
        container.appendChild(revealCard(col));
    });
}

function setFiltersLoadingState(isLoading) {
    const eventFilter = document.getElementById("eventFilter");
    const bossFilter = document.getElementById("bossFilter");
    const levelFilter = document.getElementById("levelFilter");
    const typeFilter = document.getElementById("typeFilter");
    if (!eventFilter || !bossFilter || !levelFilter || !typeFilter) return;

    if (isLoading) {
        eventFilter.innerHTML = `<option value="gt" selected>Loading quest events...</option>`;
        eventFilter.disabled = true;
        bossFilter.innerHTML = `<option value="" selected>Loading Rift bosses...</option>`;
        bossFilter.disabled = true;
        levelFilter.innerHTML = `<option value="" selected>Loading levels...</option>`;
        levelFilter.disabled = true;
        typeFilter.innerHTML = `<option value="all" selected>Loading quest types...</option>`;
        typeFilter.disabled = true;
        return;
    }

    eventFilter.disabled = false;
    typeFilter.disabled = false;
}

function setupFilters() {
    const eventFilter = document.getElementById("eventFilter");
    const bossFilter = document.getElementById("bossFilter");
    const levelFilter = document.getElementById("levelFilter");
    const typeFilter = document.getElementById("typeFilter");
    if (!eventFilter || !bossFilter || !levelFilter || !typeFilter) return;

    setFiltersLoadingState(false);
    populateEventFilterOptions();
    populateBossFilterOptions();
    populateLevelFilterOptions();
    populateTypeFilterOptions();

    if (!eventFilter.dataset.bound) {
        eventFilter.addEventListener("change", () => {
            updateHashForEventFilter(eventFilter.value);
            populateBossFilterOptions();
            populateLevelFilterOptions();
            populateTypeFilterOptions();
            renderQuests();
        });
        eventFilter.dataset.bound = "1";
    }

    if (!bossFilter.dataset.bound) {
        bossFilter.addEventListener("change", () => {
            populateLevelFilterOptions();
            populateTypeFilterOptions();
            renderQuests();
        });
        bossFilter.dataset.bound = "1";
    }

    if (!levelFilter.dataset.bound) {
        levelFilter.addEventListener("change", () => {
            populateTypeFilterOptions();
            renderQuests();
        });
        levelFilter.dataset.bound = "1";
    }

    if (!typeFilter.dataset.bound) {
        typeFilter.addEventListener("change", renderQuests);
        typeFilter.dataset.bound = "1";
    }

    updateHashForEventFilter(eventFilter.value);
}

initAutoHeight({
    contentSelector: "#content",
    subtractSelectors: [".note", ".page-title"],
    extraOffset: 18
});

async function init() {
    try {
        setFiltersLoadingState(true);

        await coreInit({
            loader,
            itemLabel: "quests",
            langCode: currentLanguage,
            normalizeNameFn: s => String(s || "").toLowerCase(),
            onReady: async ({ lang: loadedLang, data }) => {
                lang = loadedLang;
                itemsData = lowercaseKeysRecursive(data);

                await loadOwnLang();
                applyOwnLang();

                buildQuestData();
                setupFilters();

                initLanguageSelector({
                    currentLanguage,
                    lang,
                    onSelect: () => location.reload()
                });

                renderQuests();
            }
        });
    } catch (err) {
        console.error(err);
        loader.error("Something went wrong...", 30);
    }
}

init();
