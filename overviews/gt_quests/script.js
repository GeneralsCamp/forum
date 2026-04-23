import { initAutoHeight } from "../shared/ResizeService.mjs";
import { findNewIDs } from "../shared/VersionService.mjs";
import { createLoader } from "../shared/LoadingService.mjs";
import { coreInit } from "../shared/CoreInit.mjs";
import { initLanguageSelector, getInitialLanguage } from "../shared/LanguageService.mjs";
import { getSelectedGameSource } from "../shared/GameSettings.mjs";

let lang = {};
let itemsData = null;
let ownLang = {};
let UI_LANG = {};
let currentLanguage = getInitialLanguage();

let quests = [];
let questsById = {};
let currenciesById = {};
let unitsById = {};
let newQuestIDsSet = new Set();
let totalQuestChance = 0;
const activeGameSource = getSelectedGameSource();

const loader = createLoader();

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
        search_placeholder: L.search_placeholder || "Search by title or requirement...",
        show_all: L.show_all || "Show all quests",
        show_new: L.show_new || "Show only new quests",
        chance: L.chance || "Chance",
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
    return {
        type: parts[0] || "unknown",
        amount: parts[1] || "",
        targetId: parts[2] || ""
    };
}

function resolveQuestTitle(quest) {
    return getLangValue([`popup_ame_quest_title_${quest.allianceQuestId}`], capitalizeWords(quest.parsed.type));
}

function formatLargeNumbersInText(text) {
    return String(text || "").replace(/\b\d{5,}\b/g, match => {
        const parsed = Number(match);
        return Number.isFinite(parsed) ? parsed.toLocaleString(currentLanguage) : match;
    });
}

function resolveQuestDescription(quest) {
    const req = getLangValue([`popup_ame_quest_requirement_${quest.allianceQuestId}`]);
    if (req) return formatLargeNumbersInText(req);
    const typeLabel = capitalizeWords(quest.parsed.type);
    const conditionRaw = String(quest.condition || "").replace(/\+/g, " + ");
    return formatLargeNumbersInText(`${typeLabel}: ${conditionRaw}`);
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
    if (!totalQuestChance || totalQuestChance <= 0) return "-";
    const percent = (chanceValue / totalQuestChance) * 100;
    return `${percent.toFixed(2)}%`;
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

    quests = allianceQuests
        .map(q => {
            const qId = String(q.questid || "");
            const baseQuest = questsById[qId] || {};
            const condition = String(q.comment4 || baseQuest.conditions || "");
            const chanceValue = parseChanceValue(q.chance);
            return {
                allianceQuestId: String(q.alliancequestid || ""),
                questId: qId,
                tier: String(q.comment2 || "").trim(),
                questType: String(q.questtype || ""),
                condition,
                parsed: parseCondition(condition),
                rewardPoints: Number(q.rewardpoints || 0),
                duration: Number(q.duration || 0),
                chanceValue
            };
        });

    totalQuestChance = quests.reduce((sum, q) => sum + q.chanceValue, 0);
}

async function compareWithOldVersion() {
    try {
        const newIDs = await findNewIDs({
            currentItems: quests,
            extractItemsFn: json =>
                (json.allianceQuests || [])
                    .map(q => ({ allianceQuestId: String(q.allianceQuestID || "") })),
            idField: "allianceQuestId"
        });

        newQuestIDsSet = newIDs;
    } catch (err) {
        console.error("new quest detection error:", err);
        newQuestIDsSet = new Set();
    }
}

function getSearchQuery() {
    const el = document.getElementById("searchInput");
    return String(el?.value || "").trim().toLowerCase();
}

function getShowFilterMode() {
    const el = document.getElementById("showFilter");
    return el?.value === "new" ? "new" : "all";
}

function getTypeFilterValue() {
    const el = document.getElementById("typeFilter");
    return String(el?.value || "all");
}

function getQuestTypeLabel(typeRaw) {
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

function populateTypeFilterOptions() {
    const typeFilter = document.getElementById("typeFilter");
    if (!typeFilter) return;

    const selected = String(typeFilter.value || "all");
    const types = [...new Set(
        quests
            .map(q => String(q.questType || "").trim())
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

function getFilteredQuests() {
    const searchQuery = getSearchQuery();
    const showMode = getShowFilterMode();
    const typeValue = getTypeFilterValue();

    return quests.filter(q => {
        if (showMode === "new" && !newQuestIDsSet.has(q.allianceQuestId)) return false;
        if (typeValue !== "all" && String(q.questType || "") !== typeValue) return false;

        if (!searchQuery) return true;

        const title = resolveQuestTitle(q).toLowerCase();
        const requirement = resolveQuestDescription(q).toLowerCase();
        return title.includes(searchQuery) || requirement.includes(searchQuery);
    });
}

function renderQuests() {
    const container = document.getElementById("questRows");
    if (!container) return;

    const rows = getFilteredQuests();
    container.innerHTML = "";

    if (!rows.length) {
        const empty = document.createElement("div");
        empty.className = "col-12 quest-empty";
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
        container.appendChild(col);
    });
}

function setFiltersLoadingState(isLoading) {
    const searchInput = document.getElementById("searchInput");
    const showFilter = document.getElementById("showFilter");
    const typeFilter = document.getElementById("typeFilter");
    if (!searchInput || !showFilter || !typeFilter) return;

    if (isLoading) {
        searchInput.disabled = true;
        searchInput.placeholder = "Loading search filter...";
        if (showFilter.options[0]) showFilter.options[0].textContent = "Loading quest filters...";
        if (showFilter.options[1]) showFilter.options[1].textContent = "Loading...";
        showFilter.value = "all";
        showFilter.disabled = true;
        typeFilter.innerHTML = `<option value="all" selected>Loading quest types...</option>`;
        typeFilter.disabled = true;
        return;
    }

    searchInput.disabled = false;
    showFilter.disabled = false;
    typeFilter.disabled = false;
}

function setupFilters() {
    const searchInput = document.getElementById("searchInput");
    const showFilter = document.getElementById("showFilter");
    const typeFilter = document.getElementById("typeFilter");
    if (!searchInput || !showFilter || !typeFilter) return;

    setFiltersLoadingState(false);
    populateTypeFilterOptions();
    searchInput.placeholder = UI_LANG.search_placeholder;
    if (showFilter.options[0]) showFilter.options[0].textContent = UI_LANG.show_all;
    if (showFilter.options[1]) showFilter.options[1].textContent = UI_LANG.show_new;
    if (showFilter.options[1]) showFilter.options[1].disabled = activeGameSource === "e4k";
    if (activeGameSource === "e4k" && showFilter.value === "new") {
        showFilter.value = "all";
    }

    if (!searchInput.dataset.bound) {
        searchInput.addEventListener("input", renderQuests);
        searchInput.dataset.bound = "1";
    }

    if (!showFilter.dataset.bound) {
        showFilter.addEventListener("change", async () => {
            if (activeGameSource === "e4k" && showFilter.value === "new") {
                showFilter.value = "all";
                renderQuests();
                return;
            }
            if (showFilter.value === "new" && newQuestIDsSet.size === 0) {
                await compareWithOldVersion();
            }
            renderQuests();
        });
        showFilter.dataset.bound = "1";
    }

    if (!typeFilter.dataset.bound) {
        typeFilter.addEventListener("change", renderQuests);
        typeFilter.dataset.bound = "1";
    }
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
            itemLabel: "gt quests",
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
