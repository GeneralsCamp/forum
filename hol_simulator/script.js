document.addEventListener('DOMContentLoaded', function () {
    loadState();
    calculatePointsPerRow('attack');
    calculatePointsPerRow('defense');
    updateSlotStates();
});

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
                    const [current, max] = badge.textContent.split("/").map(Number);
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
};


const switchView = (state) => {
    currentState = state;
    ["attack", "defense"].forEach(state => calculatePointsPerRow(state));
    updateSlotStates();
    if (state === "attack") {
        document.getElementById("attack-container").classList.add("active");
        document.getElementById("defense-container").classList.remove("active");
    } else {
        document.getElementById("defense-container").classList.add("active");
        document.getElementById("attack-container").classList.remove("active");
    }
};

document.getElementById("attack-toggle").addEventListener("click", () => switchView("attack"));
document.getElementById("defense-toggle").addEventListener("click", () => switchView("defense"));

document.querySelectorAll(".slot").forEach(slot => {
    slot.addEventListener("click", () => {
        if (!slot.classList.contains("inactive")) {
            allocatePoint(slot, currentState, true);
        }
    });

    slot.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (!slot.classList.contains("inactive")) {
            allocatePoint(slot, currentState, false);
        }
    });
});

["attack", "defense"].forEach(state => calculatePointsPerRow(state));
