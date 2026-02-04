function loadWins() {
    return Number(localStorage.getItem("empire_duels_wins") || 0);
}

function loadSelectedGeneralId() {
    return Number(localStorage.getItem("empire_duels_general_id") || 0);
}

function saveSelectedGeneralId(id) {
    localStorage.setItem("empire_duels_general_id", String(id));
}

function loadEnemyGeneralId() {
    return Number(localStorage.getItem("empire_duels_enemy_general_id") || 0);
}

function saveEnemyGeneralId(id) {
    localStorage.setItem("empire_duels_enemy_general_id", String(id));
}

function loadDeckSize() {
    const raw = Number(localStorage.getItem("empire_duels_deck_size") || 30);
    return raw === 40 ? 40 : 30;
}

function saveDeckSize(size) {
    localStorage.setItem("empire_duels_deck_size", String(size));
}

function loadHandSize() {
    const raw = Number(localStorage.getItem("empire_duels_hand_size") || 8);
    return raw === 10 ? 10 : 8;
}

function saveHandSize(size) {
    localStorage.setItem("empire_duels_hand_size", String(size));
}


function populateGenerals(selectEl) {
    return fetch("data/generals.json")
        .then(r => r.json())
        .then(generals => {
            const friendly = generals.filter(g => g.type === "friendly");
            selectEl.innerHTML = "";
            for (const g of friendly) {
                const opt = document.createElement("option");
                opt.value = String(g.id);
                opt.textContent = `${g.name} (${g.rarity})`;
                selectEl.appendChild(opt);
            }

            const saved = loadSelectedGeneralId();
            if (saved && friendly.some(g => g.id === saved)) {
                selectEl.value = String(saved);
            } else if (friendly.length > 0) {
                selectEl.value = String(friendly[0].id);
                saveSelectedGeneralId(friendly[0].id);
            }

            selectEl.addEventListener("change", () => {
                saveSelectedGeneralId(Number(selectEl.value));
            });
        })
        .catch(() => {
            selectEl.innerHTML = "<option>Failed to load</option>";
        });
}

function populateEnemyGenerals(selectEl) {
    return fetch("data/generals.json")
        .then(r => r.json())
        .then(generals => {
            const enemies = generals.filter(g => g.type === "enemy");
            selectEl.innerHTML = "";
            for (const g of enemies) {
                const opt = document.createElement("option");
                opt.value = String(g.id);
                opt.textContent = `${g.name} (${g.rarity})`;
                selectEl.appendChild(opt);
            }

            const saved = loadEnemyGeneralId();
            if (saved && enemies.some(g => g.id === saved)) {
                selectEl.value = String(saved);
            } else if (enemies.length > 0) {
                selectEl.value = String(enemies[0].id);
                saveEnemyGeneralId(enemies[0].id);
            }

            selectEl.addEventListener("change", () => {
                saveEnemyGeneralId(Number(selectEl.value));
            });
        })
        .catch(() => {
            selectEl.innerHTML = "<option>Failed to load</option>";
        });
}

function mountHome() {
    fetch("home/home.html")
        .then(r => r.text())
        .then(html => {
            document.getElementById("root").innerHTML = html;

            const selectEl = document.getElementById("generalSelect");
            if (selectEl) {
                populateGenerals(selectEl);
            }
            const enemySelect = document.getElementById("enemyGeneralSelect");
            if (enemySelect) {
                populateEnemyGenerals(enemySelect);
            }
            const deckSelect = document.getElementById("deckSizeSelect");
            if (deckSelect) {
                const savedSize = loadDeckSize();
                deckSelect.value = String(savedSize);
                deckSelect.addEventListener("change", () => {
                    saveDeckSize(Number(deckSelect.value));
                });
            }
            const handSelect = document.getElementById("handSizeSelect");
            if (handSelect) {
                const savedSize = loadHandSize();
                handSelect.value = String(savedSize);
                handSelect.addEventListener("change", () => {
                    saveHandSize(Number(handSelect.value));
                });
            }
            document.getElementById("startBtn").addEventListener("click", () => {
                window.location.href = "./game/game.html";
            });

        });
}

mountHome();
