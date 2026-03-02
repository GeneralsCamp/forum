import { initAutoHeight } from "../shared/ResizeService.mjs";
import { findNewIDs } from "../shared/VersionService.mjs";
import { createLoader } from "../shared/LoadingService.mjs";
import { coreInit } from "../shared/CoreInit.mjs";
import { initLanguageSelector, getInitialLanguage } from "../shared/LanguageService.mjs";

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
        no_quests: L.no_quests || "No quests for this filter.",
        search_placeholder: L.search_placeholder || "Search by description, requirement...",
        show_all: L.show_all || "Show all quests",
        show_new: L.show_new || "Show only new quests"
    };
}

function capitalizeWords(str) {
    return String(str || "")
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

function resolveQuestDescription(quest) {
    const req = getLangValue([`popup_ame_quest_requirement_${quest.allianceQuestId}`]);
    if (req) return req;
    const typeLabel = capitalizeWords(quest.parsed.type);
    const conditionRaw = String(quest.condition || "").replace(/\+/g, " + ");
    return `${typeLabel}: ${conditionRaw}`;
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

function formatDurationClock(totalSeconds) {
    const safe = Math.max(0, Number(totalSeconds) || 0);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
        .filter(q => String(q.comment1 || "").toLowerCase() === "ame")
        .map(q => {
            const qId = String(q.questid || "");
            const baseQuest = questsById[qId] || {};
            const condition = String(q.comment4 || baseQuest.conditions || "");
            return {
                allianceQuestId: String(q.alliancequestid || ""),
                questId: qId,
                tier: String(q.comment2 || "").trim(),
                condition,
                parsed: parseCondition(condition),
                rewardPoints: Number(q.rewardpoints || 0),
                duration: Number(q.duration || 0)
            };
        });
}

async function compareWithOldVersion() {
    try {
        const newIDs = await findNewIDs({
            currentItems: quests,
            extractItemsFn: json =>
                (json.allianceQuests || [])
                    .filter(q => String(q.comment1 || "").toLowerCase() === "ame")
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

function getFilteredQuests() {
    const searchQuery = getSearchQuery();
    const showMode = getShowFilterMode();

    return quests.filter(q => {
        if (showMode === "new" && !newQuestIDsSet.has(q.allianceQuestId)) return false;

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

    rows.sort((a, b) => Number(a.allianceQuestId) - Number(b.allianceQuestId));

    rows.forEach(q => {
        const col = document.createElement("div");
        col.className = "col-12 col-lg-6";

        const title = document.createElement("h2");
        title.className = "quest-panel-title";
        title.textContent = resolveQuestTitle(q);

        const infoGrid = document.createElement("div");
        infoGrid.className = "quest-info-grid";

        infoGrid.appendChild(
            createInfoCell(
                getRequirementLabel(),
                resolveQuestDescription(q),
                "quest-span-2"
            )
        );
        infoGrid.appendChild(createRewardCell(q.rewardPoints));
        infoGrid.appendChild(
            createInfoCell(
                getLangValue(["runTime", "runtime"], "Duration"),
                formatDurationClock(q.duration),
                "quest-cell-duration"
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

function setupFilters() {
    const searchInput = document.getElementById("searchInput");
    const showFilter = document.getElementById("showFilter");
    if (!searchInput || !showFilter) return;

    searchInput.placeholder = UI_LANG.search_placeholder;
    if (showFilter.options[0]) showFilter.options[0].textContent = UI_LANG.show_all;
    if (showFilter.options[1]) showFilter.options[1].textContent = UI_LANG.show_new;

    if (!searchInput.dataset.bound) {
        searchInput.addEventListener("input", renderQuests);
        searchInput.dataset.bound = "1";
    }

    if (!showFilter.dataset.bound) {
        showFilter.addEventListener("change", async () => {
            if (showFilter.value === "new" && newQuestIDsSet.size === 0) {
                await compareWithOldVersion();
            }
            renderQuests();
        });
        showFilter.dataset.bound = "1";
    }
}

initAutoHeight({
    contentSelector: "#content",
    subtractSelectors: [".note", ".page-title"],
    extraOffset: 18
});

async function init() {
    try {
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
