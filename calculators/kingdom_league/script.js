import { saveCalculatorData, loadCalculatorData } from "../../overviews/shared/GameSettings.mjs";
import { getLangVersion, loadLanguage } from "../../overviews/shared/DataService.mjs";
import { initCalculatorI18n } from "../shared/CalculatorI18n.mjs";

const { language, t, formatNumber } = await initCalculatorI18n();

let gameLang = {};
try {
    gameLang = await loadLanguage(language, await getLangVersion());
} catch (error) {
    console.warn("Kingdom League in-game translations could not be loaded:", error);
}

const CALC_NAME = "kingdom_league";

const TITLES = [
    "Brawler",
    "Wild brawler",
    "Adept brawler",
    "Skilled brawler",
    "Hunter",
    "Bounty hunter",
    "Expert hunter",
    "Master hunter",
    "Guard",
    "Castle guardian",
    "Noble guardian",
    "Throne guardian",
    "Warrior",
    "Gallant warrior",
    "Veteran warrior",
    "Heroic warrior",
    "Warlord",
    "Great warlord",
    "Supreme warlord",
    "Ultimate warlord",
    "Annihilator"
];

const RANK_STEP_POINTS = 2000;
const MEDALS = [
    { key: "gold", langKey: "seasonLeague_goldMedal_name", name: "Gold medal", points: 1000 },
    { key: "silver", langKey: "seasonLeague_silverMedal_name", name: "Silver medal", points: 950 },
    { key: "bronze", langKey: "seasonLeague_bronzeMedal_name", name: "Bronze medal", points: 850 },
    { key: "glass", langKey: "seasonLeague_glasMedal_name", name: "Glass medal", points: 700 },
    { key: "copper", langKey: "seasonLeague_copperMedal_name", name: "Copper medal", points: 500 },
    { key: "stone", langKey: "seasonLeague_stoneMedal_name", name: "Stone medal", points: 300 },
    { key: "wood", langKey: "seasonLeague_woodMedal_name", name: "Wood medal", points: 100 }
];

function getGameText(key, fallback) {
    return gameLang[key] || fallback;
}

document.querySelectorAll("[data-game-lang]").forEach((element) => {
    element.textContent = getGameText(element.dataset.gameLang, element.textContent.trim());
});

const medalInputs = MEDALS.map((medal) => ({
    ...medal,
    el: document.getElementById(medal.key)
}));

const currentTitleEl = document.getElementById("currentTitle");
const nextTitleEl = document.getElementById("nextTitle");
const medalAdviceEl = document.getElementById("medalAdvice");

medalInputs.forEach(({ el }) => {
    el.addEventListener("input", () => {
        saveToLocalStorage();
        calculate();
    });
    el.addEventListener("change", () => {
        saveToLocalStorage();
        calculate();
    });
});

loadFromLocalStorage();
calculate();

function sanitizeValue(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
}

function getTotalPoints() {
    return medalInputs.reduce((sum, medal) => {
        const count = sanitizeValue(medal.el.value);
        medal.el.value = String(count);
        return sum + (count * medal.points);
    }, 0);
}

function getCurrentRank(totalPoints) {
    const rawRank = Math.floor(totalPoints / RANK_STEP_POINTS) + 1;
    return Math.min(TITLES.length, rawRank);
}

function buildMinimumMedalAdvice(pointsNeeded) {
    if (pointsNeeded <= 0) {
        return t("no_additional_medal");
    }

    const maxMedal = MEDALS[0].points;
    const upperBound = pointsNeeded + maxMedal;
    const bestCount = Array(upperBound + 1).fill(Infinity);
    const prevIndex = Array(upperBound + 1).fill(-1);

    bestCount[0] = 0;

    for (let sum = 1; sum <= upperBound; sum += 1) {
        for (let i = 0; i < MEDALS.length; i += 1) {
            const medal = MEDALS[i];
            if (sum < medal.points) continue;
            const candidate = bestCount[sum - medal.points] + 1;
            if (candidate < bestCount[sum]) {
                bestCount[sum] = candidate;
                prevIndex[sum] = i;
            }
        }
    }

    let bestSum = -1;
    let bestMedalCount = Infinity;

    for (let sum = pointsNeeded; sum <= upperBound; sum += 1) {
        const count = bestCount[sum];
        if (!Number.isFinite(count)) continue;
        if (count < bestMedalCount) {
            bestMedalCount = count;
            bestSum = sum;
        }
    }

    if (bestSum < 0) {
        return t("no_combination_found");
    }

    const counts = new Array(MEDALS.length).fill(0);
    let cursor = bestSum;

    while (cursor > 0) {
        const medalIndex = prevIndex[cursor];
        if (medalIndex < 0) break;
        counts[medalIndex] += 1;
        cursor -= MEDALS[medalIndex].points;
    }

    const parts = counts
        .map((count, index) => ({
            count,
            name: getGameText(MEDALS[index].langKey, MEDALS[index].name)
        }))
        .filter((x) => x.count > 0)
        .map((x) => `${formatNumber(x.count)}× ${x.name}`);

    const overflow = bestSum - pointsNeeded;
    if (overflow > 0) {
        return t("advice_over", {
            medals: parts.join(" + "),
            total: formatNumber(bestSum),
            overflow: formatNumber(overflow)
        });
    }

    return t("advice_exact", {
        medals: parts.join(" + "),
        total: formatNumber(bestSum)
    });
}

function saveToLocalStorage() {
    const data = {};
    medalInputs.forEach(({ key, el }) => {
        data[key] = el.value;
    });
    saveCalculatorData(CALC_NAME, data);
}

function loadFromLocalStorage() {
    const data = loadCalculatorData(CALC_NAME);
    if (data) {
        medalInputs.forEach(({ key, el }) => {
            if (data[key] !== undefined) {
                el.value = data[key];
            }
        });
    }
}

function calculate() {
    const totalPoints = getTotalPoints();
    const currentRank = getCurrentRank(totalPoints);
    const currentTitle = getGameText(`seasonLeague_rank_${currentRank}`, TITLES[currentRank - 1]);

    currentTitleEl.textContent = t("rank_format", {
        title: currentTitle,
        rank: formatNumber(currentRank)
    });

    if (currentRank >= TITLES.length) {
        nextTitleEl.textContent = t("maximum_rank_reached");
        medalAdviceEl.textContent = t("already_max_title");
        return;
    }

    const nextRank = currentRank + 1;
    const nextTitle = getGameText(`seasonLeague_rank_${nextRank}`, TITLES[nextRank - 1]);
    const pointsForNext = (nextRank - 1) * RANK_STEP_POINTS;
    const pointsNeeded = Math.max(0, pointsForNext - totalPoints);

    nextTitleEl.textContent = t("rank_format", {
        title: nextTitle,
        rank: formatNumber(nextRank)
    });
    medalAdviceEl.textContent = buildMinimumMedalAdvice(pointsNeeded);
}

window.calculate = calculate;
