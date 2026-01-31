document.addEventListener('DOMContentLoaded', function () {
    loadState();
    calculatePointsPerRow('attack');
    calculatePointsPerRow('defense');
    updateSlotStates();
    switchView("attack");
    updateTotalAllocatedPoints();
    updateWarnings();
});

let selectedSlot = null;
const skillDescriptions = {
    //Attack
    "o-1-1": "Gate protection reduction (-3%)",
    "o-1-2": "Loot bonus (+6%)",
    "o-1-3": "Honor (+5%)",
    "o-1-4": "Melee strength in attack (+0,5%)",

    "o-2-1": "Additional agents (+1)",
    "o-2-2": "Reduced cooldown (+2%)",
    "o-2-3": "Ranged strength in attack (+0.5%)",
    "o-2-4": "Reduced movement costs (-18%)",
    "o-2-5": "Chance of destroying a building (+1%)",

    "o-3-1": "Units on the front (+5%)",
    "o-3-2": "Additional fire damage (+5%)",
    "o-3-3": "Experience (+4%)",
    "o-3-4": "Melee strength in attack (+1%)",
    "o-3-5": "Wall protection reduction (-3%)",

    "o-4-1": "Strength on courtyard in attack (+1%)",
    "o-4-2": "Outbound speed (+10%)",
    "o-4-3": "Glory bonus in attack (+10%)",
    "o-4-4": "Return speed from castle lords (+10%)",
    "o-4-5": "Units on the flanks (+3%)",

    "o-5-1": "Looting capacity (+500)",
    "o-5-2": "Tool on the flanks (+2)",
    "o-5-3": "Ranged strength in attack (+2%)",
    "o-5-4": "6th wave of attack (+1)",
    "o-5-5": "Moat protection reduction (-5%)",

    //Defense
    "d-1-1": "Gate protection (+3%)",
    "d-1-2": "Resources lost reduction (-2%)",
    "d-1-3": "Experience for construction (+5%)",
    "d-1-4": "Melee strength in defense (+0,5%)",

    "d-2-1": "City guards (+4%)",
    "d-2-2": "Experience when defending (+3%)",
    "d-2-3": "Ranged strength in defense (+0.5%)",
    "d-2-4": "Occupations movement speed (+8%)",
    "d-2-5": "Citizens/Population (+10%)",

    "d-3-1": "Units on the castle wall (+0.5%)",
    "d-3-2": "Reduced fire damage (+5%)",
    "d-3-3": "Experience for attacking NPCs (+4%)",
    "d-3-4": "Melee strength in defense (+1%)",
    "d-3-5": "Wall protection (+6%)",

    "d-4-1": "Strength on courtyard in defense (+0.5%)",
    "d-4-2": "Chance for better equipment (+20%)",
    "d-4-3": "Glory bonus in defense (+20%)",
    "d-4-4": "Return speed from NPCs (+25%)",
    "d-4-5": "Units on the castle wall (+1%)",

    "d-5-1": "Safe storage (+500)",
    "d-5-2": "Additional defense flank tool slot (+1)",
    "d-5-3": "Ranged strength in defense (+2%)",
    "d-5-4": "Strength on courtyard in defense (+6%)",
    "d-5-5": "Moat protection (+5%)",
};

const saveState = () => {
    const state = {
        attack: [],
        defense: []
    };

    ["attack", "defense"].forEach(stateType => {
        states[stateType].rows.forEach((row, rowIndex) => {
            const rowSlots = row.querySelectorAll(".slot");
            const rowData = [];

            rowSlots.forEach(slot => {
                const badge = slot.querySelector(".badge");
                const [current, max] = badge.textContent.split("/").map(Number);
                rowData.push({ current, max });
            });

            state[stateType].push(rowData);
        });
    });

    localStorage.setItem("gameState", JSON.stringify(state));
};

const loadState = () => {
    const savedState = localStorage.getItem("gameState");
    if (!savedState) return;

    const state = JSON.parse(savedState);

    ["attack", "defense"].forEach(stateType => {
        if (state[stateType]) {
            states[stateType].rows.forEach((row, rowIndex) => {
                const rowSlots = row.querySelectorAll(".slot");
                const rowData = state[stateType][rowIndex] || [];

                rowSlots.forEach((slot, slotIndex) => {
                    const badge = slot.querySelector(".badge");
                    const badgeBottom = slot.querySelector(".badge-bottom");
                    const slotValue = badgeBottom ? parseInt(badgeBottom.textContent) : 0;

                    if (rowData[slotIndex]) {
                        const { current, max } = rowData[slotIndex];
                        badge.textContent = `${current}/${max}`;
                        states[stateType].totalPoints += current * slotValue;
                    }
                });
            });
        }
    });

    updateTotalPointsDisplay();
};
const maxPoints = 550;
const rowRequirements = [0, 40, 80, 90, 90];

const states = {
    attack: {
        totalPoints: 0,
        rows: [...document.querySelectorAll("#attack-container .row-real")],
        pointsPerRow: []
    },
    defense: {
        totalPoints: 0,
        rows: [...document.querySelectorAll("#defense-container .row-real")],
        pointsPerRow: []
    }
};

let currentState = "attack";

const totalPointsDisplays = {
    attack: document.getElementById("total-points-attack"),
    defense: document.getElementById("total-points-defense")
};

const updateTotalPointsDisplay = () => {
    totalPointsDisplays.attack.textContent = states.attack.totalPoints;
    totalPointsDisplays.defense.textContent = states.defense.totalPoints;
};

const calculatePointsPerRow = (state) => {
    const pointsPerRow = [];
    states[state].rows.forEach((row) => {
        let rowPoints = 0;
        const rowSlots = row.querySelectorAll(".slot");

        rowSlots.forEach(slot => {
            const badge = slot.querySelector(".badge");
            const badgeBottom = slot.querySelector(".badge-bottom");
            const [current] = badge.textContent.split("/").map(Number);
            const slotValue = badgeBottom ? Number(badgeBottom.textContent) : 0;

            rowPoints += current * slotValue;
        });

        pointsPerRow.push(rowPoints);
    });

    states[state].pointsPerRow = pointsPerRow;
};

const updateSlotStates = () => {
    ["attack", "defense"].forEach(state => {
        let pointsPerRow = states[state].pointsPerRow;
        let isPreviousRowActive = true;

        states[state].rows.forEach((row, index) => {
            const rowSlots = row.querySelectorAll(".slot");
            const rowSquares = row.querySelectorAll(".square");
            const rowBigNumbers = row.querySelectorAll(".big-number");
            const rowLines = row.querySelectorAll(".line-horizontal");

            if (index === 0 || (isPreviousRowActive && pointsPerRow[index - 1] >= rowRequirements[index])) {
                rowSlots.forEach(slot => {
                    slot.classList.remove("inactive");

                    const badge = slot.querySelector(".badge");
                    const badgeBottom = slot.querySelector(".badge-bottom");
                    const [current, max] = badge.textContent.split("/").map(Number);
                    const slotValue = badgeBottom ? parseInt(badgeBottom.textContent) : 0;

                    const totalAllocatedPoints = states.attack.totalPoints + states.defense.totalPoints;

                    if (totalAllocatedPoints + slotValue > maxPoints) {
                        badgeBottom.classList.add("insufficient-points");
                    } else {
                        badgeBottom.classList.remove("insufficient-points");
                    }

                    if (current === max) {
                        slot.classList.add("maxed");
                    } else {
                        slot.classList.remove("maxed");
                    }
                });
                rowSquares.forEach(square => square.classList.remove("inactive"));
                rowBigNumbers.forEach(bigNumber => bigNumber.classList.remove("inactive"));
                rowLines.forEach(line => line.classList.remove("inactive"));
                isPreviousRowActive = true;
            } else {
                rowSlots.forEach(slot => {
                    slot.classList.add("inactive");
                    slot.classList.remove("maxed");

                    const badge = slot.querySelector(".badge");
                    const badgeBottom = slot.querySelector(".badge-bottom");
                    if (badge && badgeBottom) {
                        const slotValue = parseInt(badgeBottom.textContent);
                        const [current, max] = badge.textContent.split("/").map(Number);
                        const pointsToRemove = current * slotValue;
                        states[state].totalPoints -= pointsToRemove;
                        badge.textContent = `0/${max}`;
                        badgeBottom.classList.remove("insufficient-points");
                    }
                });
                rowSquares.forEach(square => square.classList.add("inactive"));
                rowBigNumbers.forEach(bigNumber => bigNumber.classList.add("inactive"));
                rowLines.forEach(line => line.classList.add("inactive"));
                isPreviousRowActive = false;
            }
        });

        const extra1 = document.querySelector(`#${state}-container .extra1`);
        const extra2 = document.querySelector(`#${state}-container .extra2`);
        const line1 = extra1 ? extra1.closest(".row").querySelector(".line-horizontal") : null;
        const line2 = extra2 ? extra2.closest(".row").querySelector(".line-horizontal") : null;

        ["attack", "defense"].forEach(state => calculatePointsPerRow(state));
        pointsPerRow = states[state].pointsPerRow;

        const extra1Active = pointsPerRow[1] >= 80;
        const extra2Active = pointsPerRow[4] >= 80;

        if (extra1) {
            const centerSlot1 = extra1.querySelector(".center-slot");
            if (extra1Active) {
                if (line1) line1.classList.remove("inactive");
                if (centerSlot1) centerSlot1.classList.remove("inactive");
            } else {
                if (line1) line1.classList.add("inactive");
                if (centerSlot1) centerSlot1.classList.add("inactive");
            }
        }

        if (extra2) {
            const centerSlot2 = extra2.querySelector(".center-slot");
            if (extra2Active) {
                if (line2) line2.classList.remove("inactive");
                if (centerSlot2) centerSlot2.classList.remove("inactive");
            } else {
                if (line2) line2.classList.add("inactive");
                if (centerSlot2) centerSlot2.classList.add("inactive");
            }
        }
    });

    updateTotalPointsDisplay();
};

const allocatePoint = (slot, state, increment) => {
    const badge = slot.querySelector(".badge");
    const badgeBottom = slot.querySelector(".badge-bottom");
    const [current, max] = badge.textContent.split("/").map(Number);
    const pointValue = parseInt(badgeBottom.textContent);

    const totalAllocatedPoints = states.attack.totalPoints + states.defense.totalPoints;

    if (increment) {
        if (current < max && totalAllocatedPoints + pointValue <= maxPoints) {
            badge.textContent = `${current + 1}/${max}`;
            states[state].totalPoints += pointValue;
        }
    } else {
        if (current > 0) {
            badge.textContent = `${current - 1}/${max}`;
            states[state].totalPoints -= pointValue;
        }
    }

    calculatePointsPerRow(state);
    updateSlotStates();
    saveState();
    updateTotalAllocatedPoints();
    updateWarnings();
};


const switchView = (state) => {
    currentState = state;
    document.getElementById("attack-toggle").classList.remove("active-tab");
    document.getElementById("defense-toggle").classList.remove("active-tab");
    ["attack", "defense"].forEach(state => calculatePointsPerRow(state));
    updateSlotStates();
    if (state === "attack") {
        document.getElementById("attack-container").classList.add("active");
        document.getElementById("defense-container").classList.remove("active");
        document.getElementById("attack-toggle").classList.add("active-tab");
    } else {
        document.getElementById("defense-container").classList.add("active");
        document.getElementById("attack-container").classList.remove("active");
        document.getElementById("defense-toggle").classList.add("active-tab");
    }
};

document.getElementById("attack-toggle").addEventListener("click", () => switchView("attack"));
document.getElementById("defense-toggle").addEventListener("click", () => switchView("defense"));

document.querySelectorAll(".slot").forEach(slot => {
    slot.addEventListener("click", () => {
        if (slot.classList.contains("inactive")) return;

        if (slot === selectedSlot) {
            allocatePoint(slot, currentState, true);
            return;
        }

        if (selectedSlot) {
            selectedSlot.classList.remove("selected");
        }

        selectedSlot = slot;
        selectedSlot.classList.add("selected");

        const imgSrc = selectedSlot.querySelector("img").getAttribute("src");
        const skillId = imgSrc.split("/").pop().split(".")[0];
        const description = skillDescriptions[skillId] || "No description available.";
        document.getElementById("details-text").textContent = description;
    });

    slot.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (slot.classList.contains("inactive")) return;

        if (slot === selectedSlot) {
            allocatePoint(slot, currentState, false);
        }
    });
});

document.getElementById("reset-button").addEventListener("click", () => {
    ["attack", "defense"].forEach(state => {
        states[state].rows.forEach(row => {
            const rowSlots = row.querySelectorAll(".slot");

            rowSlots.forEach(slot => {
                const badge = slot.querySelector(".badge");
                const badgeBottom = slot.querySelector(".badge-bottom");
                const [current, max] = badge.textContent.split("/").map(Number);
                const slotValue = badgeBottom ? parseInt(badgeBottom.textContent) : 0;

                states[state].totalPoints -= current * slotValue;

                badge.textContent = `0/${max}`;
            });
        });

        calculatePointsPerRow(state);
        updateSlotStates();
    });
    updateTotalAllocatedPoints();
    updateWarnings();
    saveState();
});

const updateTotalAllocatedPoints = () => {
    const totalAllocatedPoints =
        states.attack.totalPoints + states.defense.totalPoints;
    document.getElementById("total-allocated-points").textContent =
        totalAllocatedPoints;
};

["attack", "defense"].forEach(state => {
    calculatePointsPerRow(state);
    updateSlotStates();
    updateTotalAllocatedPoints();
});

const updateWarnings = () => {
    document.querySelectorAll(".warning").forEach(warning => warning.remove());

    ["attack", "defense"].forEach(state => {
        const pointsPerRow = states[state].pointsPerRow;
        let warningDisplayed = false;

        states[state].rows.forEach((row, index) => {
            if (warningDisplayed) return;

            if (index < states[state].rows.length - 1) {
                const requiredPoints = rowRequirements[index + 1];
                const currentPoints = pointsPerRow[index];

                if (currentPoints < requiredPoints) {
                    const pointsNeeded = requiredPoints - currentPoints;

                    const warningDiv = document.createElement("div");
                    warningDiv.classList.add("text-center", "warning", "mb-3");
                    warningDiv.innerHTML = `<span>Allocate another ${pointsNeeded} points to this level to unlock the next one!</span>`;

                    row.parentNode.insertBefore(warningDiv, row.nextSibling);

                    warningDisplayed = true;
                }
            }
        });
    });
};

["attack", "defense"].forEach(state => calculatePointsPerRow(state));