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
const STORAGE_PREFIX = "kingdom_league_";

const MEDALS = [
    { key: "gold", name: "Gold", points: 1000 },
    { key: "silver", name: "Silver", points: 950 },
    { key: "bronze", name: "Bronze", points: 850 },
    { key: "glass", name: "Glass", points: 700 },
    { key: "copper", name: "Copper", points: 500 },
    { key: "stone", name: "Stone", points: 300 },
    { key: "wood", name: "Wood", points: 100 }
];

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

function formatNumber(value) {
    return value.toLocaleString("en-US");
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
        return "No additional medal needed.";
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
        return "No medal combination found.";
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
        .map((count, index) => ({ count, name: MEDALS[index].name }))
        .filter((x) => x.count > 0)
        .map((x) => `${x.count}x ${x.name}`);

    const overflow = bestSum - pointsNeeded;
    if (overflow > 0) {
        return `${parts.join(" + ")} (${formatNumber(bestSum)} points, +${formatNumber(overflow)} points over)`;
    }

    return `${parts.join(" + ")} (${formatNumber(bestSum)} points exact)`;
}

function saveToLocalStorage() {
    medalInputs.forEach(({ key, el }) => {
        localStorage.setItem(`${STORAGE_PREFIX}${key}`, el.value);
    });
}

function loadFromLocalStorage() {
    medalInputs.forEach(({ key, el }) => {
        const value = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
        if (value !== null) {
            el.value = value;
        }
    });
}

function calculate() {
    const totalPoints = getTotalPoints();
    const currentRank = getCurrentRank(totalPoints);
    const currentTitle = TITLES[currentRank - 1];

    currentTitleEl.textContent = `${currentTitle} (Rank ${currentRank})`;

    if (currentRank >= TITLES.length) {
        nextTitleEl.textContent = "Next title: Maximum rank reached";
        medalAdviceEl.textContent = "Already at max title.";
        return;
    }

    const nextRank = currentRank + 1;
    const nextTitle = TITLES[nextRank - 1];
    const pointsForNext = (nextRank - 1) * RANK_STEP_POINTS;
    const pointsNeeded = Math.max(0, pointsForNext - totalPoints);

    nextTitleEl.textContent = `${nextTitle} (Rank ${nextRank})`;
    medalAdviceEl.textContent = buildMinimumMedalAdvice(pointsNeeded);
}
