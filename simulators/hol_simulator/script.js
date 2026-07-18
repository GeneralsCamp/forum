import { coreInit } from "../../overviews/shared/CoreInit.mjs";
import { createLoader } from "../../overviews/shared/LoadingService.mjs";
import { getInitialLanguage } from "../../overviews/shared/LanguageService.mjs";
import { normalizeName } from "../../overviews/shared/RewardResolver.mjs";
import { saveSimulatorData, loadSimulatorData } from "../../overviews/shared/GameSettings.mjs";
import { handleAutoHeight, initAutoHeight } from "../../overviews/shared/ResizeService.mjs";

const SIM_NAME = "hol";
const ROW_REQUIREMENTS = [0, 40, 80, 90, 90];
const TREE_CONFIG = {
    attack: { treeId: "0", containerId: "attack-container", specialGroups: [10, 26] },
    defense: { treeId: "1", containerId: "defense-container", specialGroups: [36, 52] }
};

const loader = createLoader();
const currentLanguage = getInitialLanguage();
const states = {
    attack: { totalPoints: 0, rows: [], pointsPerRow: [] },
    defense: { totalPoints: 0, rows: [], pointsPerRow: [] }
};

let lang = {};
let ownLang = {};
let maxPoints = 550;
let currentState = "attack";
let selectedSlot = null;

const AUTO_HEIGHT_OPTIONS = {
    contentSelector: "#content",
    subtractSelectors: [".hol-filter-bar"],
    extraOffset: 0
};

initAutoHeight(AUTO_HEIGHT_OPTIONS);

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getArray(data, keys) {
    for (const key of keys) {
        if (Array.isArray(data?.[key])) return data[key];
    }
    return [];
}

function gameText(key, fallback = "") {
    return lang?.[String(key).toLowerCase()] || fallback;
}

async function loadOwnLang() {
    try {
        const response = await fetch("./ownLang.json");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        ownLang = await response.json();
    } catch (error) {
        console.error("Error loading ownLang.json:", error);
        ownLang = {};
    }
}

function ui(key, fallback = "") {
    const language = String(currentLanguage || "en").toLowerCase();
    const baseLanguage = language.split("-")[0];
    return ownLang?.[language]?.ui?.[key]
        || ownLang?.[baseLanguage]?.ui?.[key]
        || ownLang?.en?.ui?.[key]
        || fallback;
}

function formatNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value ?? "");
    return new Intl.NumberFormat(currentLanguage, { maximumFractionDigits: 2 }).format(number);
}

function applyValue(template, value) {
    return String(template || "").replace(/\{0(?:[^}]*)?\}/g, formatNumber(value));
}

function buildSkillGroups(rows, iconMap) {
    const groups = new Map();

    rows.forEach((row) => {
        const groupId = String(row?.skillGroupID || "").trim();
        if (!groupId) return;
        if (!groups.has(groupId)) groups.set(groupId, []);
        groups.get(groupId).push(row);
    });

    return [...groups.entries()].map(([groupId, levels]) => {
        levels.sort((a, b) => Number(a?.level || 0) - Number(b?.level || 0));
        const first = levels[0] || {};
        const name = gameText(`dialog_legendTemple_${groupId}_name`, `Skill ${groupId}`);
        const shortTemplate = gameText(`dialog_legendTemple_${groupId}_desc_short`, "");
        const longTemplate = gameText(`dialog_legendTemple_${groupId}_desc`, "");
        const description = applyValue(shortTemplate || longTemplate, first?.effectValue ?? first?.totalEffectValue ?? "");
        const costs = levels.map((level) => Number(level?.costSkillPoints || 0));

        return {
            id: Number(groupId),
            treeId: String(first?.skillTreeID || "0"),
            tier: Number(first?.tier || 0),
            specialType: String(first?.specialType || ""),
            maxLevel: Math.max(1, ...levels.map((level) => Number(level?.level || 1))),
            costs,
            name,
            description: description || name,
            iconUrl: iconMap?.[groupId] || ""
        };
    }).sort((a, b) => a.id - b.id);
}

function renderSkillSlot(skill) {
    const displayedCost = skill.costs[0] || 0;
    return `
        <div class="skill-column text-center">
            <div class="slot" data-skill-group="${skill.id}" data-level-costs="${escapeHtml(JSON.stringify(skill.costs))}"
                data-skill-name="${escapeHtml(skill.name)}" data-skill-description="${escapeHtml(skill.description)}">
                <div class="badge">0/${skill.maxLevel}</div>
                <img src="${escapeHtml(skill.iconUrl)}" alt="${escapeHtml(skill.name)}" title="${escapeHtml(skill.name)}">
                <div class="badge-bottom">${displayedCost}</div>
            </div>
        </div>`;
}

function renderTierRow(stateName, tier, skills) {
    const spacing = tier === 1 ? "mb-4" : (tier === 2 || tier === 5 ? "mt-4 mb-2" : "mt-4 mb-4");
    return `
        <div class="row position-relative row-real ${spacing}" id="${stateName}-row-${tier}" data-tier="${tier}">
            <div class="col-2 text-center">
                <div class="square"><div class="big-number"><span>${tier}</span></div></div>
            </div>
            <div class="col-10 skill-row-slots">
                ${skills.map(renderSkillSlot).join("")}
            </div>
            <div class="line-horizontal"></div>
        </div>`;
}

function renderSpecialRow(skill, position) {
    if (!skill) return "";
    return `
        <div class="row justify-content-left position-relative mb-4 special-row" data-special-position="${position}">
            <div class="col-5 text-center"></div>
            <div class="col-2 text-center extra${position}">
                <div class="center-slot" data-skill-group="${skill.id}" data-skill-name="${escapeHtml(skill.name)}"
                    data-skill-description="${escapeHtml(skill.description)}">
                    <img src="${escapeHtml(skill.iconUrl)}" alt="${escapeHtml(skill.name)}">
                </div>
            </div>
            <div class="line-horizontal"></div>
        </div>`;
}

function renderTrees(skills) {
    Object.entries(TREE_CONFIG).forEach(([stateName, config]) => {
        const treeSkills = skills.filter((skill) => skill.treeId === config.treeId);
        const regularSkills = treeSkills.filter((skill) => !skill.specialType);
        const specials = config.specialGroups.map((id) => treeSkills.find((skill) => skill.id === id));
        const html = [];

        for (let tier = 1; tier <= 5; tier += 1) {
            const tierSkills = regularSkills.filter((skill) => skill.tier === tier);
            html.push(renderTierRow(stateName, tier, tierSkills));
            if (tier === 2) html.push(renderSpecialRow(specials[0], 1));
            if (tier === 5) html.push(renderSpecialRow(specials[1], 2));
        }

        document.getElementById(config.containerId).innerHTML = html.join("");
        states[stateName].rows = [...document.querySelectorAll(`#${config.containerId} .row-real`)];
    });
}

function getSlotProgress(slot) {
    const badge = slot.querySelector(".badge");
    const [current, max] = String(badge?.textContent || "0/0").split("/").map(Number);
    return { badge, current: current || 0, max: max || 0 };
}

function getSlotCosts(slot) {
    try {
        const costs = JSON.parse(slot.dataset.levelCosts || "[]");
        return Array.isArray(costs) ? costs.map(Number) : [];
    } catch {
        return [];
    }
}

function getAllocatedCost(slot, current = getSlotProgress(slot).current) {
    return getSlotCosts(slot).slice(0, current).reduce((sum, cost) => sum + (Number(cost) || 0), 0);
}

function calculatePointsPerRow(stateName) {
    states[stateName].pointsPerRow = states[stateName].rows.map((row) =>
        [...row.querySelectorAll(".slot")].reduce((sum, slot) => sum + getAllocatedCost(slot), 0)
    );
}

function recomputeTotals() {
    Object.keys(states).forEach((stateName) => {
        calculatePointsPerRow(stateName);
        states[stateName].totalPoints = states[stateName].pointsPerRow.reduce((sum, points) => sum + points, 0);
    });
}

function getTotalAllocatedPoints() {
    return states.attack.totalPoints + states.defense.totalPoints;
}

function updatePointDisplays() {
    const attackOption = document.getElementById("attack-option");
    const defenseOption = document.getElementById("defense-option");
    const attackLabel = gameText("dialog_legendTemple_tooltipAttack", "Attack");
    const defenseLabel = gameText("dialog_legendTemple_tooltipDefence", "Defense");
    const pointsTemplate = gameText("points", "{0} points");
    const compact = window.matchMedia("(max-width: 768px)").matches;
    const attackPoints = compact ? formatNumber(states.attack.totalPoints) : applyValue(pointsTemplate, states.attack.totalPoints);
    const defensePoints = compact ? formatNumber(states.defense.totalPoints) : applyValue(pointsTemplate, states.defense.totalPoints);
    attackOption.textContent = `${attackLabel} · ${attackPoints}`;
    defenseOption.textContent = `${defenseLabel} · ${defensePoints}`;
    document.getElementById("total-allocated-points").textContent = getTotalAllocatedPoints();
}

function resetLockedRow(row) {
    row.querySelectorAll(".slot").forEach((slot) => {
        const { badge, max } = getSlotProgress(slot);
        if (badge) badge.textContent = `0/${max}`;
    });
}

function setRowActive(row, active) {
    row.classList.toggle("is-inactive", !active);
    row.querySelectorAll(".slot, .square, .big-number, .line-horizontal").forEach((element) => {
        element.classList.toggle("inactive", !active);
    });
    if (!active) resetLockedRow(row);
}

function updateSpecialStates(stateName) {
    const container = document.getElementById(TREE_CONFIG[stateName].containerId);
    [
        { position: 1, sourceRow: 1 },
        { position: 2, sourceRow: 4 }
    ].forEach(({ position, sourceRow }) => {
        const row = container.querySelector(`[data-special-position="${position}"]`);
        if (!row) return;
        const active = (states[stateName].pointsPerRow[sourceRow] || 0) >= 80;
        row.classList.toggle("is-inactive", !active);
        row.querySelectorAll(".center-slot, .line-horizontal").forEach((element) => {
            element.classList.toggle("inactive", !active);
        });
    });
}

function updateSlotStates() {
    Object.keys(states).forEach((stateName) => {
        calculatePointsPerRow(stateName);
        let previousRowsActive = true;

        states[stateName].rows.forEach((row, index) => {
            const active = index === 0
                || (previousRowsActive && states[stateName].pointsPerRow[index - 1] >= ROW_REQUIREMENTS[index]);
            setRowActive(row, active);
            previousRowsActive = active;
            calculatePointsPerRow(stateName);
        });
    });

    recomputeTotals();

    Object.keys(states).forEach((stateName) => {
        updateSpecialStates(stateName);
        states[stateName].rows.forEach((row) => {
            row.querySelectorAll(".slot").forEach((slot) => {
                const { current, max } = getSlotProgress(slot);
                const costs = getSlotCosts(slot);
                const nextCost = Number(costs[current] || 0);
                slot.classList.toggle("maxed", current >= max);
                slot.querySelector(".badge-bottom")?.classList.toggle(
                    "insufficient-points",
                    !slot.classList.contains("inactive")
                        && current < max
                        && getTotalAllocatedPoints() + nextCost > maxPoints
                );
            });
        });
    });

    updatePointDisplays();
}

function getAllocations() {
    const allocations = {};
    document.querySelectorAll(".slot[data-skill-group]").forEach((slot) => {
        allocations[slot.dataset.skillGroup] = getSlotProgress(slot).current;
    });
    return allocations;
}

function saveState() {
    saveSimulatorData(SIM_NAME, {
        version: 2,
        currentView: currentState,
        allocations: getAllocations()
    });
}

function restoreVersionTwo(saved) {
    Object.entries(saved?.allocations || {}).forEach(([groupId, value]) => {
        const normalizedGroupId = String(Number(groupId));
        if (!/^\d+$/.test(normalizedGroupId)) return;
        const slot = document.querySelector(`.slot[data-skill-group="${normalizedGroupId}"]`);
        if (!slot) return;
        const { badge, max } = getSlotProgress(slot);
        const current = Math.max(0, Math.min(max, Number(value) || 0));
        badge.textContent = `${current}/${max}`;
    });
}

function restoreLegacyState(saved) {
    Object.keys(states).forEach((stateName) => {
        states[stateName].rows.forEach((row, rowIndex) => {
            const rowData = saved?.[stateName]?.[rowIndex] || [];
            row.querySelectorAll(".slot").forEach((slot, slotIndex) => {
                const { badge, max } = getSlotProgress(slot);
                const current = Math.max(0, Math.min(max, Number(rowData?.[slotIndex]?.current) || 0));
                badge.textContent = `${current}/${max}`;
            });
        });
    });
}

function loadState() {
    const saved = loadSimulatorData(SIM_NAME);
    if (!saved) return;
    if (Number(saved.version) >= 2 && saved.allocations) restoreVersionTwo(saved);
    else restoreLegacyState(saved);
    currentState = saved.currentView === "defense" ? "defense" : "attack";
}

function updateDetails(element) {
    const name = element?.dataset?.skillName || "";
    const description = element?.dataset?.skillDescription || "";
    document.getElementById("details-text").textContent = description ? `${name}: ${description}` : name;
    requestAnimationFrame(() => handleAutoHeight(AUTO_HEIGHT_OPTIONS));
}

function allocatePoint(slot, increment) {
    const stateName = slot.closest("#defense-container") ? "defense" : "attack";
    const { badge, current, max } = getSlotProgress(slot);
    const costs = getSlotCosts(slot);

    if (increment) {
        const nextCost = Number(costs[current] || 0);
        if (current >= max || getTotalAllocatedPoints() + nextCost > maxPoints) return;
        badge.textContent = `${current + 1}/${max}`;
    } else {
        if (current <= 0) return;
        badge.textContent = `${current - 1}/${max}`;
    }

    updateSlotStates();
    updateWarnings();
    saveState();
    if (stateName !== currentState) switchView(stateName, false);
}

function switchView(stateName, persist = true) {
    currentState = stateName;
    document.getElementById("attack-container").classList.toggle("active", stateName === "attack");
    document.getElementById("defense-container").classList.toggle("active", stateName === "defense");
    document.getElementById("tree-select").value = stateName;
    if (persist) saveState();
}

function updateWarnings() {
    document.querySelectorAll(".warning").forEach((warning) => warning.remove());

    Object.keys(states).forEach((stateName) => {
        const points = states[stateName].pointsPerRow;
        const rowIndex = states[stateName].rows.findIndex((row, index) =>
            index < states[stateName].rows.length - 1 && points[index] < ROW_REQUIREMENTS[index + 1]
        );
        if (rowIndex < 0) return;

        const pointsNeeded = ROW_REQUIREMENTS[rowIndex + 1] - points[rowIndex];
        const warning = document.createElement("div");
        warning.className = "text-center warning";
        warning.textContent = applyValue(
            gameText(
                "dialog_legendTemple_tierLocked",
                "Allocate another {0} legendary points to the previous level to unlock this legendary skill."
            ),
            pointsNeeded
        );
        states[stateName].rows[rowIndex].after(warning);
    });
}

function resetAll() {
    document.querySelectorAll(".slot").forEach((slot) => {
        const { badge, max } = getSlotProgress(slot);
        badge.textContent = `0/${max}`;
        slot.classList.remove("selected");
    });
    document.querySelectorAll(".center-slot.selected").forEach((slot) => slot.classList.remove("selected"));
    selectedSlot = null;
    updateSlotStates();
    updateWarnings();
    saveState();
}

function bindControls() {
    document.getElementById("tree-select").addEventListener("change", (event) => switchView(event.target.value));
    document.getElementById("reset-button").addEventListener("click", resetAll);
    window.addEventListener("resize", updatePointDisplays);

    document.querySelector(".scrollable-content").addEventListener("click", (event) => {
        const special = event.target.closest(".center-slot");
        if (special) {
            if (!special.classList.contains("inactive")) {
                selectedSlot?.classList.remove("selected");
                selectedSlot = special;
                special.classList.add("selected");
                updateDetails(special);
            }
            return;
        }

        const slot = event.target.closest(".slot");
        if (!slot || slot.classList.contains("inactive")) return;
        if (slot === selectedSlot) {
            allocatePoint(slot, true);
            return;
        }
        selectedSlot?.classList.remove("selected");
        selectedSlot = slot;
        slot.classList.add("selected");
        updateDetails(slot);
    });

    document.querySelector(".scrollable-content").addEventListener("contextmenu", (event) => {
        const slot = event.target.closest(".slot");
        if (!slot) return;
        event.preventDefault();
        if (!slot.classList.contains("inactive") && slot === selectedSlot) allocatePoint(slot, false);
    });

}

function applyLanguageToStaticUi() {
    const reset = gameText("dialog_legendTemple_reset", "Reset");
    updatePointDisplays();
    document.getElementById("total-allocated-label").textContent = `${ui("total_allocated_points", "Total Allocated Points")}:`;
    document.getElementById("details-text").textContent = ui("skill_description_prompt", "Click on a skill to view its description.");
    document.getElementById("reset-button-label").textContent = reset;
    document.getElementById("reset-button").setAttribute("aria-label", reset);
    document.documentElement.lang = currentLanguage;
    requestAnimationFrame(() => handleAutoHeight(AUTO_HEIGHT_OPTIONS));
}

async function init() {
    try {
        await loadOwnLang();
        await coreInit({
            loader,
            itemLabel: "Hall of Legends skills",
            langCode: currentLanguage,
            normalizeNameFn: normalizeName,
            assets: { legendSkills: true },
            onReady: async ({ lang: languageData, data, imageMaps }) => {
                lang = languageData;
                const legendSkills = getArray(data, ["legendskills", "legendSkills"]);
                if (!legendSkills.length) throw new Error("Hall of Legends skill data is unavailable.");

                const hallLevels = getArray(data, ["buildings"]).filter((building) =>
                    String(building?.name || "").toLowerCase() === "legendtemple"
                );
                const dataMaxPoints = Math.max(0, ...hallLevels.map((building) => Number(building?.skillPoints || 0)));
                if (dataMaxPoints > 0) maxPoints = dataMaxPoints;

                const skillGroups = buildSkillGroups(legendSkills, imageMaps?.legendSkills || {});
                renderTrees(skillGroups);
                applyLanguageToStaticUi();
                bindControls();
                loadState();
                updateSlotStates();
                updateWarnings();
                switchView(currentState, false);
            }
        });
    } catch (error) {
        console.error(error);
        loader.error("Hall of Legends data could not be loaded.", 30);
    }
}

init();
