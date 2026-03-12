import { initConsentManager } from "./overviews/shared/ConsentManager.mjs";
const FAVORITES_KEY = "gf_favorites_v1";
const MAX_FAVORITES = 12;
const HOME_SETTINGS_KEY = "gf_home_settings_v1";
const KOFI_PROMPT_SEEN_KEY = "gf_kofi_prompt_seen_v1";
const KOFI_PROMPT_OPTOUT_KEY = "gf_kofi_prompt_optout_v1";
const KOFI_URL = "https://ko-fi.com/Y8Y11VBX5C";
const DESKTOP_DND_ENABLED = window.matchMedia?.("(pointer:fine)").matches ?? true;
let lastAddedFavoriteLink = "";
let mobileReorderMode = false;
let activeMobileReorder = null;
let mobileReorderRaf = 0;
let mobileReorderIdleTimer = 0;
const MOBILE_REORDER_IDLE_MS = 5000;
const CARD_EXIT_DURATION_MS = 190;
let lockedScrollY = 0;
let uiSettings = readHomeSettings();

const categories = {
    overviews: [
        { name: "Decorations Overview", desc: "This page loads the in-game decorations automatically!", icon: "main_page/decorations.webp", link: "./overviews/decorations/index.html", disabled: false },
        { name: "CI's & TCI's Overview", desc: "This page loads the in-game CI's & TCI's automatically!", icon: "main_page/ci-icon.webp", link: "./overviews/building_items/index.html", disabled: false },
        { name: "Look-items Overview", desc: "This page loads the in-game look items automatically!", icon: "main_page/look-items.webp", link: "./overviews/look_items/index.html", disabled: false },
        { name: "Unique Set Overview", desc: "This page loads the in-game equipment sets, and set bonuses!", icon: "main_page/equipment-icon.webp", link: "./overviews/equipment_sets/index.html", disabled: false },
        { name: "Generals Overview", desc: "This page loads the in-game generals automatically!", icon: "main_page/generals-icon.webp", link: "./overviews/generals/index.html", disabled: false },
        { name: "Event Rewards Overview", desc: "This page loads in-game event rewards with a vary of filters!", icon: "main_page/event-rewards-icon.webp", link: "./overviews/event_rewards/index.html", disabled: false },
        { name: "Gacha Overview", desc: "This page loads the in-game gacha rewards automatically!", icon: "main_page/gacha-icon.webp", link: "./overviews/gacha_events/index.html", disabled: false },
        { name: "Mystery Boxes Overview", desc: "This page loads in-game mystery box key chances and full reward pools!", icon: "main_page/lootbox-icon.webp", link: "./overviews/loot_box/index.html#boxes", disabled: false },
        { name: "Offerings Overview", desc: "This page loads in-game offerings and their linked reward pools!", icon: "main_page/offerings-icon.webp", link: "./overviews/loot_box/index.html#offerings", disabled: false },
        { name: "Troops Overview", desc: "This page loads all in-game troops with detailed stats!", icon: "main_page/troops-icon.webp", link: "./overviews/troops_and_tools/index.html#troops", disabled: false },
        { name: "Tools Overview", desc: "This page loads all in-game tools with detailed stats!", icon: "main_page/tools-icon.webp", link: "./overviews/troops_and_tools/index.html#tools", disabled: false },
        { name: "Rift Event Overview", desc: "This page loads in-game Rift activity and boss defeat rewards!", icon: "main_page/rift-raid-points-icon.webp", link: "./overviews/rift_event/index.html", disabled: false },
        { name: "Event Plan Overview", desc: "This page loads the event plans automatically!", icon: "main_page/event-plan-icon.webp", link: "./overviews/event_plan/index.html", disabled: false },
        { name: "GT Quests Overview", desc: "This page loads the in-game grand tournament quests automatically!", icon: "event_icons/grandtournament.webp", link: "./overviews/gt_quests/index.html", disabled: false }
    ],

    calculators: [
        { name: "Food Production Calculator", desc: "Calculate your in-game food production easily.", icon: "main_page/food-production-icon.webp", link: "./calculators/food_production/index.html", disabled: false },
        { name: "Mead Production Calculator", desc: "Calculate your mead production easily.", icon: "main_page/mead-icon.webp", link: "./calculators/mead_production/index.html", disabled: false },
        { name: "Wall Limit Calculator", desc: "Calculate your wall unit limit with absolute accuracy.", icon: "main_page/wall-icon.webp", link: "./calculators/wall_limit/index.html", disabled: false },
        { name: "Collector Event Calculator", desc: "Calculate that how many points you need to reach your goal.", icon: "main_page/collector-icon.webp", link: "./calculators/collector_event/index.html", disabled: false },
        { name: "Detection Time Calculator", desc: "Calculate the exact land time, and detection time of an attack.", icon: "main_page/detection-icon.webp", link: "./calculators/travel_speed/index.html", disabled: false },
        { name: "Rift Raid Point Calculator", desc: "Calculate Rift Raid event activity points", icon: "main_page/rift-raid-points-icon.webp", link: "./calculators/rift_raid_points/index.html", disabled: false },
        { name: "Kingdom League Calculator", desc: "Calculate your Kingdom League points, title, and next rank requirements.", icon: "main_page/leauge-icon.webp", link: "./calculators/kingdom_league/index.html", disabled: false }
    ],

    simulators: [
        { name: "Castle Layout Simulator", desc: "Design and manage your castle layouts.", icon: "main_page/layout-icon.webp", link: "./simulators/layout_editor/index.html", disabled: false },
        { name: "Hall of Legends Simulator", desc: "Try point allocations without spending rubies.", icon: "main_page/hall-of-legends-simulator-icon.webp", link: "./simulators/hol_simulator/index.html", disabled: false },
    ]
};

const nowWorkingOn = [
    {
        title: "Battle Simulator",
        text: "Paused until current overviews are stabilized.",
        status: "Paused"
    },
    {
        title: "Attack speed & Detection Calculator",
        text: "Fixing the currently incorrect detection time calculation.",
        status: "Paused"
    }
];


function createCategoryCard(item, options = {}) {
    const {
        draggable = false,
        showReorderHandle = false,
        showFavoriteToggle = true,
        showDescription = false
    } = options;
    const shell = document.createElement("div");
    shell.className = "category-card-shell";
    shell.dataset.link = item.link || "";
    shell.draggable = Boolean(draggable && item.link && DESKTOP_DND_ENABLED);

    const box = document.createElement("a");
    box.classList.add("category-box");
    box.dataset.link = item.link || "";

    if (!item.disabled) {
        box.href = item.link;
    } else {
        box.classList.add("disabled");
    }

    box.innerHTML = `
        <div class="category-icon">
            <img src="./img_base/${item.icon}" alt="${item.name}" loading="lazy">
        </div>
        <div class="category-content">
            <h3>${item.name}</h3>
            ${showDescription ? `<p class="category-description">${item.desc || ""}</p>` : ""}
        </div>
    `;

    if (showReorderHandle) {
        box.classList.add("has-reorder-handle");
    }

    if (showDescription) {
        box.classList.add("has-description");
    }

    if (showFavoriteToggle) {
        const favActive = isFavorite(item.link);
        const favDisabled = isFavoritesFull() && !favActive;
        box.classList.add("has-favorite-toggle");
        const fav = document.createElement("button");
        fav.className = `favorite-toggle ${favActive ? "is-favorite" : ""} ${favDisabled ? "is-disabled" : ""}`.trim();
        fav.type = "button";
        fav.setAttribute("aria-label", "Toggle favorite");
        fav.dataset.link = item.link || "";
        fav.disabled = favDisabled;
        fav.title = favDisabled ? `Maximum ${MAX_FAVORITES} favorites reached` : "";
        fav.innerHTML = `<i class="bi ${favActive ? "bi-star-fill" : "bi-star"}"></i>`;
        box.appendChild(fav);
    }

    shell.appendChild(box);

    if (showReorderHandle) {
        const reorderHandle = document.createElement("button");
        reorderHandle.className = "favorite-reorder-handle";
        reorderHandle.type = "button";
        reorderHandle.setAttribute("aria-label", "Reorder favorite");
        reorderHandle.dataset.link = item.link || "";
        reorderHandle.innerHTML = `<i class="bi bi-list"></i>`;
        shell.appendChild(reorderHandle);
    }

    return shell;
}

function renderCategory(list, targetId) {
    const container = document.querySelector(`#${targetId} .category-grid`);
    if (!container) return;
    container.innerHTML = "";

    list.forEach((item) => {
        const card = createCategoryCard(item, {
            draggable: false,
            showFavoriteToggle: uiSettings.favoritesEnabled,
            showDescription: uiSettings.descriptionsEnabled
        });
        container.appendChild(card);
    });
}

function getDefaultHomeSettings() {
    return {
        descriptionsEnabled: true,
        currentProjectsEnabled: false,
        favoritesEnabled: true,
        videosEnabled: true,
        devCommentsEnabled: true
    };
}

function readHomeSettings() {
    const defaults = getDefaultHomeSettings();
    try {
        const raw = localStorage.getItem(HOME_SETTINGS_KEY);
        const parsed = JSON.parse(raw || "{}");
        return {
            descriptionsEnabled: parsed.descriptionsEnabled ?? defaults.descriptionsEnabled,
            currentProjectsEnabled: parsed.currentProjectsEnabled ?? defaults.currentProjectsEnabled,
            favoritesEnabled: parsed.favoritesEnabled ?? defaults.favoritesEnabled,
            videosEnabled: parsed.videosEnabled ?? defaults.videosEnabled,
            devCommentsEnabled: parsed.devCommentsEnabled ?? defaults.devCommentsEnabled
        };
    } catch {
        return defaults;
    }
}

function writeHomeSettings(settings) {
    localStorage.setItem(HOME_SETTINGS_KEY, JSON.stringify(settings));
}

function applyHomeSettingsToLayout() {
    const currentHeader = document.getElementById("currentProjectsSection");
    const currentPanel = document.getElementById("nowPanel");
    const videosHeader = document.getElementById("latestVideosSection");
    const videosPanel = document.getElementById("latestVideos");
    if (currentHeader) currentHeader.style.display = uiSettings.currentProjectsEnabled ? "" : "none";
    if (currentPanel) currentPanel.style.display = uiSettings.currentProjectsEnabled ? "" : "none";
    if (videosHeader) videosHeader.style.display = uiSettings.videosEnabled ? "" : "none";
    if (videosPanel) videosPanel.style.display = uiSettings.videosEnabled ? "" : "none";
}

function rerenderMainSections() {
    renderCategory(categories.overviews, "overviews");
    renderCategory(categories.calculators, "calculators");
    renderCategory(categories.simulators, "simulators");
    renderFavorites();
    renderNowPanel(nowWorkingOn);
    applyHomeSettingsToLayout();
}

function getAllCategoryItems() {
    return [
        ...categories.overviews,
        ...categories.simulators,
        ...categories.calculators
    ].filter(item => !item.disabled && item.link);
}

function readFavorites() {
    try {
        const raw = localStorage.getItem(FAVORITES_KEY);
        const parsed = JSON.parse(raw || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeFavorites(favs) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
}

function isFavorite(link) {
    if (!link) return false;
    return readFavorites().includes(link);
}

function isFavoritesFull() {
    return readFavorites().length >= MAX_FAVORITES;
}

function toggleFavorite(link) {
    if (!link) return;
    const favs = readFavorites();
    const idx = favs.indexOf(link);
    let added = false;
    if (idx >= 0) {
        favs.splice(idx, 1);
        lastAddedFavoriteLink = "";
    } else {
        if (favs.length >= MAX_FAVORITES) {
            return "limit";
        }
        favs.unshift(link);
        added = true;
        lastAddedFavoriteLink = link;
    }
    writeFavorites(favs);
    return added;
}

function updateAllFavoriteButtons() {
    const full = isFavoritesFull();
    document.querySelectorAll(".favorite-toggle").forEach(btn => {
        const link = btn.dataset.link || "";
        const fav = isFavorite(link);
        const disabled = full && !fav;
        btn.classList.toggle("is-favorite", fav);
        btn.classList.toggle("is-disabled", disabled);
        btn.disabled = disabled;
        btn.title = disabled ? `Maximum ${MAX_FAVORITES} favorites reached` : "";
        const icon = btn.querySelector("i");
        if (icon) {
            icon.className = `bi ${fav ? "bi-star-fill" : "bi-star"}`;
        }
    });
}

function renderFavorites() {
    const header = document.getElementById("favoritesSection");
    const wrapper = document.getElementById("favorites");
    const container = document.querySelector("#favorites .category-grid");
    const mobileReorderToggle = document.getElementById("mobileReorderToggle");
    if (!header || !wrapper || !container) return;

    if (!uiSettings.favoritesEnabled) {
        mobileReorderMode = false;
        header.style.display = "none";
        wrapper.style.display = "none";
        return;
    }
    header.style.display = "";
    wrapper.style.display = "";

    const allByLink = new Map(getAllCategoryItems().map(item => [item.link, item]));
    const items = readFavorites().map(link => allByLink.get(link)).filter(Boolean);
    const mobileReorderAvailable = isMobileReorderAvailable();

    document.body.classList.toggle("favorites-reorder-mode", mobileReorderMode);

    if (mobileReorderToggle) {
        const canReorder = items.length > 1;
        mobileReorderToggle.style.display = canReorder ? "inline-flex" : "none";
        mobileReorderToggle.textContent = mobileReorderMode && canReorder ? "Confirm" : "Reorder";
    }

    container.innerHTML = "";
    wrapper.classList.add("has-items");

    if (!items.length) {
        container.innerHTML = `
            <div class="favorites-empty">
                Click the <i class="bi bi-star"></i> icon on any card to add it to Favorites (up to ${MAX_FAVORITES}).
            </div>
        `;
        return;
    }

    const enableDesktopDndReorder = mobileReorderMode && !mobileReorderAvailable;

    items.forEach((item) => {
        const card = createCategoryCard(item, {
            draggable: enableDesktopDndReorder,
            showReorderHandle: mobileReorderMode,
            showFavoriteToggle: mobileReorderMode && uiSettings.favoritesEnabled
        });
        if (item.link === lastAddedFavoriteLink) {
            card.classList.add("card-enter");
        }
        container.appendChild(card);
    });
    lastAddedFavoriteLink = "";
}

function setupFavoriteToggles() {
    const commitToggle = (link, button) => {
        const result = toggleFavorite(link);
        if (result === "limit") {
            if (button) {
                button.classList.add("is-limit-hit");
                setTimeout(() => button.classList.remove("is-limit-hit"), 320);
            }
            return;
        }

        const added = result === true;
        if (added && button) {
            button.classList.add("is-popping");
            setTimeout(() => button.classList.remove("is-popping"), 260);
        }
        renderFavorites();
        updateAllFavoriteButtons();
    };

    document.addEventListener("click", (event) => {
        if (!uiSettings.favoritesEnabled) return;
        const button = event.target.closest(".favorite-toggle");
        if (!button) return;
        if (button.disabled) return;

        event.preventDefault();
        event.stopPropagation();

        const link = button.dataset.link || "";
        const removing = isFavorite(link);

        if (removing) {
            const removingCard = Array.from(document.querySelectorAll("#favorites .category-card-shell"))
                .find((el) => el.dataset.link === link);
            if (removingCard) {
                removingCard.classList.add("card-exit");
                setTimeout(() => commitToggle(link, button), CARD_EXIT_DURATION_MS);
                return;
            }
        }

        commitToggle(link, button);
    });
}

function setupFavoritesDragAndDrop() {
    if (!DESKTOP_DND_ENABLED) return;

    const favoritesWrapper = document.getElementById("favorites");
    const favoritesGrid = document.querySelector("#favorites .category-grid");
    if (!favoritesWrapper || !favoritesGrid) return;

    let draggedLink = "";

    document.addEventListener("dragstart", (event) => {
        if (!uiSettings.favoritesEnabled) return;
        if (!mobileReorderMode) return;

        const shell = event.target.closest(".category-card-shell");
        if (!shell || !shell.draggable) return;

        const link = shell.dataset.link || "";
        if (!link) return;

        draggedLink = link;
        shell.classList.add("is-dragging");

        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", link);
        }
    });

    document.addEventListener("dragend", () => {
        document.querySelectorAll(".category-card-shell.is-dragging").forEach(el => el.classList.remove("is-dragging"));
        favoritesWrapper.classList.remove("drag-over");
        draggedLink = "";
    });

    favoritesGrid.addEventListener("dragover", (event) => {
        if (!draggedLink) return;
        event.preventDefault();
        favoritesWrapper.classList.add("drag-over");
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    });

    favoritesGrid.addEventListener("dragleave", (event) => {
        if (!favoritesWrapper.contains(event.relatedTarget)) {
            favoritesWrapper.classList.remove("drag-over");
        }
    });

    favoritesGrid.addEventListener("drop", (event) => {
        if (!uiSettings.favoritesEnabled) return;
        if (!draggedLink) return;
        event.preventDefault();
        favoritesWrapper.classList.remove("drag-over");

        const targetShell = event.target.closest(".category-card-shell");
        const targetLink = targetShell?.dataset.link || "";

        const favs = readFavorites();
        const sourceIndex = favs.indexOf(draggedLink);
        if (sourceIndex < 0) return;

        if (!targetLink || targetLink === draggedLink) {
            return;
        }

        const targetIndex = favs.indexOf(targetLink);
        if (targetIndex < 0) return;

        [favs[sourceIndex], favs[targetIndex]] = [favs[targetIndex], favs[sourceIndex]];

        writeFavorites([...new Set(favs)]);
        renderFavorites();
        updateAllFavoriteButtons();
    });
}

function renderNowPanel(list) {
    const container = document.querySelector("#nowPanel .now-grid");
    if (!container) return;

    const getStatusClass = (status) => {
        const v = String(status || "").toLowerCase();
        if (v.includes("active") || v.includes("progress") || v.includes("megy")) return "status-active";
        if (v.includes("pause") || v.includes("szunet")) return "status-paused";
        if (v.includes("plan")) return "status-planned";
        if (v.includes("done") || v.includes("kesz")) return "status-done";
        return "status-default";
    };

    container.innerHTML = list.map(item => `
        <article class="now-card ${getStatusClass(item.status)}">
            <div class="now-card-head">
                <h3>${item.title}</h3>
            </div>
            <p>${item.text}</p>
        </article>
    `).join("");
}

function isMobileReorderAvailable() {
    const coarse = window.matchMedia?.("(pointer:coarse)").matches ?? false;
    const smallViewport = window.matchMedia?.("(max-width: 900px)").matches ?? false;
    return coarse || smallViewport;
}

function writeFavoritesFromDomOrder() {
    const links = Array.from(document.querySelectorAll("#favorites .category-grid .category-card-shell"))
        .map(el => el.dataset.link || "")
        .filter(Boolean);
    if (!links.length) return;
    writeFavorites([...new Set(links)]);
}

function setPageScrollLock(lock) {
    const body = document.body;
    const docEl = document.documentElement;
    if (!body) return;

    if (lock) {
        if (body.classList.contains("scroll-locked")) return;
        lockedScrollY = window.scrollY || window.pageYOffset || 0;
        body.classList.add("scroll-locked");
        body.style.top = `-${lockedScrollY}px`;
        return;
    }

    if (!body.classList.contains("scroll-locked")) return;
    const restoreY = lockedScrollY;
    const prevScrollBehavior = docEl ? docEl.style.scrollBehavior : "";
    if (docEl) docEl.style.scrollBehavior = "auto";

    body.classList.remove("scroll-locked");
    body.style.top = "";
    window.scrollTo(0, restoreY);
    window.requestAnimationFrame(() => {
        window.scrollTo(0, restoreY);
        window.requestAnimationFrame(() => {
            window.scrollTo(0, restoreY);
            if (docEl) docEl.style.scrollBehavior = prevScrollBehavior;
        });
    });
}

function processMobileReorderFrame() {
    mobileReorderRaf = 0;
    if (!activeMobileReorder || !activeMobileReorder.shell || !activeMobileReorder.grid) return;
    if (!activeMobileReorder.shell.isConnected) return;

    const touchY = activeMobileReorder.currentY;
    if (activeMobileReorder.ghost) {
        activeMobileReorder.ghost.style.top = `${touchY - activeMobileReorder.offsetY}px`;
    }

    const candidates = Array.from(activeMobileReorder.grid.querySelectorAll(".category-card-shell"))
        .filter((el) => el !== activeMobileReorder.shell);

    let insertBeforeEl = null;
    for (const candidate of candidates) {
        const rect = candidate.getBoundingClientRect();
        const midpoint = rect.top + (rect.height / 2);
        if (touchY < midpoint) {
            insertBeforeEl = candidate;
            break;
        }
    }

    const currentNext = activeMobileReorder.shell.nextElementSibling;
    if (insertBeforeEl !== currentNext) {
        activeMobileReorder.grid.insertBefore(activeMobileReorder.shell, insertBeforeEl);
    }
}

function setupMobileFavoritesReorder() {
    const toggle = document.getElementById("mobileReorderToggle");
    const favoritesGrid = document.querySelector("#favorites .category-grid");
    if (!toggle) return;

    const clearIdleTimer = () => {
        if (!mobileReorderIdleTimer) return;
        window.clearTimeout(mobileReorderIdleTimer);
        mobileReorderIdleTimer = 0;
    };

    const resetActiveMobileReorder = ({ persistOrder = false, rerender = false } = {}) => {
        clearIdleTimer();

        if (mobileReorderRaf) {
            window.cancelAnimationFrame(mobileReorderRaf);
            mobileReorderRaf = 0;
        }

        if (!activeMobileReorder) {
            setPageScrollLock(false);
            if (rerender) renderFavorites();
            return;
        }

        if (activeMobileReorder.ghost?.parentNode) {
            activeMobileReorder.ghost.parentNode.removeChild(activeMobileReorder.ghost);
        }

        if (activeMobileReorder.shell?.classList) {
            activeMobileReorder.shell.classList.remove("is-reorder-active", "is-reorder-placeholder");
        }

        if (persistOrder) {
            writeFavoritesFromDomOrder();
        }

        activeMobileReorder = null;
        setPageScrollLock(false);
        if (rerender) renderFavorites();
    };

    const armIdleTimer = () => {
        clearIdleTimer();
        mobileReorderIdleTimer = window.setTimeout(() => {
            if (!mobileReorderMode) return;
            resetActiveMobileReorder({ persistOrder: true, rerender: true });
        }, MOBILE_REORDER_IDLE_MS);
    };

    toggle.addEventListener("click", () => {
        if (!uiSettings.favoritesEnabled) return;
        const nextMode = !mobileReorderMode;
        if (!nextMode) {
            resetActiveMobileReorder({ persistOrder: true, rerender: false });
        }
        mobileReorderMode = nextMode;
        renderFavorites();
    });

    document.addEventListener("click", (event) => {
        if (!uiSettings.favoritesEnabled) return;
        if (!mobileReorderMode) return;
        const inFavoritesCard = event.target.closest("#favorites .category-box");
        if (!inFavoritesCard) return;
        if (event.target.closest(".favorite-reorder-handle")) return;
        if (event.target.closest(".favorite-toggle")) return;
        event.preventDefault();
        event.stopPropagation();
    }, true);

    document.addEventListener("touchstart", (event) => {
        if (!uiSettings.favoritesEnabled) return;
        if (!mobileReorderMode || !isMobileReorderAvailable()) return;

        const handle = event.target.closest(".favorite-reorder-handle");
        if (!handle) return;

        const shell = handle.closest(".category-card-shell");
        const link = shell?.dataset.link || "";
        if (!shell || !link) return;

        const touch = event.touches?.[0];
        if (!touch) return;

        resetActiveMobileReorder({ persistOrder: false, rerender: false });

        const shellRect = shell.getBoundingClientRect();
        const ghost = shell.cloneNode(true);
        ghost.classList.add("favorite-drag-ghost");
        ghost.style.width = `${shellRect.width}px`;
        ghost.style.left = `${shellRect.left}px`;
        ghost.style.top = `${shellRect.top}px`;
        document.body.appendChild(ghost);

        activeMobileReorder = {
            link,
            shell,
            grid: favoritesGrid,
            ghost,
            offsetY: touch.clientY - shellRect.top,
            currentY: touch.clientY
        };

        setPageScrollLock(true);
        armIdleTimer();
        shell.classList.add("is-reorder-active", "is-reorder-placeholder");
        event.preventDefault();
    }, { passive: false });

    document.addEventListener("touchmove", (event) => {
        if (!activeMobileReorder || !mobileReorderMode) return;

        const touch = event.touches?.[0];
        if (!touch) return;

        activeMobileReorder.currentY = touch.clientY;
        armIdleTimer();
        if (!mobileReorderRaf) {
            mobileReorderRaf = window.requestAnimationFrame(processMobileReorderFrame);
        }

        event.preventDefault();
    }, { passive: false });

    const finishTouchReorder = () => {
        if (!activeMobileReorder) return;
        resetActiveMobileReorder({ persistOrder: true, rerender: true });
    };

    document.addEventListener("touchend", finishTouchReorder);
    document.addEventListener("touchcancel", finishTouchReorder);
    document.addEventListener("pointercancel", finishTouchReorder);

    window.addEventListener("resize", () => {
        if (!activeMobileReorder) return;
        resetActiveMobileReorder({ persistOrder: false, rerender: true });
    });

    window.addEventListener("blur", () => {
        if (!mobileReorderMode && !activeMobileReorder) return;
        resetActiveMobileReorder({ persistOrder: true, rerender: true });
    });

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) return;
        if (!mobileReorderMode && !activeMobileReorder) return;
        resetActiveMobileReorder({ persistOrder: true, rerender: true });
    });
}

function setupSettingsModal() {
    const openBtn = document.getElementById("openSettingsBtn");
    const closeBtn = document.getElementById("closeSettingsBtn");
    const modal = document.getElementById("settingsModal");
    const descriptionsInput = document.getElementById("settingsDescriptions");
    const currentProjectsInput = document.getElementById("settingsCurrentProjects");
    const favoritesInput = document.getElementById("settingsFavorites");
    const videosInput = document.getElementById("settingsVideos");
    const devCommentsInput = document.getElementById("settingsDevComments");
    if (!openBtn || !closeBtn || !modal || !descriptionsInput || !currentProjectsInput || !favoritesInput || !videosInput || !devCommentsInput) return;
    const MODAL_CLOSE_ANIM_MS = 190;
    let closeTimer = 0;

    const syncForm = () => {
        descriptionsInput.checked = Boolean(uiSettings.descriptionsEnabled);
        currentProjectsInput.checked = Boolean(uiSettings.currentProjectsEnabled);
        favoritesInput.checked = Boolean(uiSettings.favoritesEnabled);
        videosInput.checked = Boolean(uiSettings.videosEnabled);
        devCommentsInput.checked = Boolean(uiSettings.devCommentsEnabled);
    };

    const closeModal = () => {
        if (!modal.classList.contains("open")) return;
        modal.classList.remove("open");
        modal.classList.add("closing");
        modal.setAttribute("aria-hidden", "true");
        if (closeTimer) {
            window.clearTimeout(closeTimer);
        }
        closeTimer = window.setTimeout(() => {
            modal.classList.remove("closing");
            closeTimer = 0;
        }, MODAL_CLOSE_ANIM_MS);
    };

    const openModal = () => {
        syncForm();
        if (closeTimer) {
            window.clearTimeout(closeTimer);
            closeTimer = 0;
        }
        modal.classList.remove("closing");
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
    };

    const handleChange = () => {
        uiSettings = {
            descriptionsEnabled: descriptionsInput.checked,
            currentProjectsEnabled: currentProjectsInput.checked,
            favoritesEnabled: favoritesInput.checked,
            videosEnabled: videosInput.checked,
            devCommentsEnabled: devCommentsInput.checked
        };
        writeHomeSettings(uiSettings);
        rerenderMainSections();
        if (uiSettings.videosEnabled) {
            renderLatestVideos();
        }
    };

    openBtn.addEventListener("click", openModal);
    closeBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", (event) => {
        if (!event.target.closest(".settings-modal-card") || event.target.closest("[data-close-settings]")) {
            closeModal();
        }
    });

    descriptionsInput.addEventListener("change", handleChange);
    currentProjectsInput.addEventListener("change", handleChange);
    favoritesInput.addEventListener("change", handleChange);
    videosInput.addEventListener("change", handleChange);
    devCommentsInput.addEventListener("change", handleChange);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modal.classList.contains("open")) {
            closeModal();
        }
    });
}

function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
}

function openYouTubeVideoPreferApp(videoId) {
    const webUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const ua = navigator.userAgent || "";
    const isAndroid = /Android/i.test(ua);
    const isiOS = /iPhone|iPad|iPod/i.test(ua);

    if (isAndroid) {
        window.location.href = `intent://www.youtube.com/watch?v=${videoId}#Intent;package=com.google.android.youtube;scheme=https;end`;
        setTimeout(() => {
            window.open(webUrl, "_blank", "noopener");
        }, 700);
        return;
    }

    if (isiOS) {
        window.location.href = `vnd.youtube://watch?v=${videoId}`;
        setTimeout(() => {
            window.open(webUrl, "_blank", "noopener");
        }, 700);
        return;
    }

    window.open(webUrl, "_blank", "noopener");
}

async function renderLatestVideos() {
    const container = document.querySelector("#latestVideos .video-grid");
    if (!container) return;
    const videosSection = document.getElementById("latestVideos");
    const videosHeader = videosSection?.previousElementSibling;
    if (!uiSettings.videosEnabled) {
        if (videosSection) videosSection.style.display = "none";
        if (videosHeader && videosHeader.classList.contains("collapse-header")) {
            videosHeader.style.display = "none";
        }
        return;
    }

    const proxy = "https://my-proxy-8u49.onrender.com/";
    const fixedChannelId = "UCzHQ9zuwxhmJ2xmmANwrZfw";
    const channelVideosUrl = "https://www.youtube.com/@GeneralsCamp/videos";

    try {
        let pairs = [];

        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${fixedChannelId}`;
        const feedRes = await fetch(proxy + feedUrl, {
            headers: { "x-requested-with": "XMLHttpRequest" }
        });
        if (feedRes.ok) {
            const xmlText = await feedRes.text();
            const xml = new DOMParser().parseFromString(xmlText, "application/xml");
            const entries = Array.from(xml.querySelectorAll("entry"));
            pairs = entries.map((entry) => {
                const id =
                    entry.querySelector("yt\\:videoId")?.textContent?.trim() ||
                    entry.querySelector("videoId")?.textContent?.trim() ||
                    "";
                const title = entry.querySelector("title")?.textContent?.trim() || "";
                return { id, title };
            }).filter((x) => x.id && x.title);
        }

        if (!pairs.length) {
            const res = await fetch(proxy + channelVideosUrl, {
                headers: { "x-requested-with": "XMLHttpRequest" }
            });
            if (!res.ok) throw new Error(`Failed to load channel page (${res.status})`);

            const html = await res.text();
            const regex = /"videoId":"([A-Za-z0-9_-]{11})","thumbnail":[\s\S]{0,2200}?"title":\{"runs":\[\{"text":"([^"]+)"/g;
            let match = null;
            while ((match = regex.exec(html)) !== null) {
                const id = match[1];
                const title = (match[2] || "").replace(/\\u0026/g, "&");
                if (!id || !title) continue;
                pairs.push({ id, title });
                if (pairs.length >= 120) break;
            }
        }

        const uniquePairs = [];
        const seenIds = new Set();
        pairs.forEach((item) => {
            if (seenIds.has(item.id)) return;
            seenIds.add(item.id);
            uniquePairs.push(item);
        });

        const ggeOnly = uniquePairs.filter((item) => /goodgame empire/i.test(item.title));
        const latestTwenty = ggeOnly.slice(0, 10);
        if (!latestTwenty.length) throw new Error("No videos found");

        container.innerHTML = latestTwenty.map(({ id, title }) => `
            <a class="video-card video-link" href="https://www.youtube.com/watch?v=${id}" data-video-id="${id}" target="_blank" rel="noopener">
                <div class="video-frame-wrap">
                    <img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="${title}" loading="lazy">
                    <span class="video-play-icon"><i class="bi bi-play-fill"></i></span>
                </div>
            </a>
        `).join("");

        if (!container.dataset.mobileVideoHandlerBound) {
            container.addEventListener("click", (event) => {
                const link = event.target.closest(".video-link");
                if (!link || !container.contains(link)) return;
                if (!isMobileDevice()) return;

                const videoId = link.dataset.videoId;
                if (!videoId) return;

                event.preventDefault();
                openYouTubeVideoPreferApp(videoId);
            });
            container.dataset.mobileVideoHandlerBound = "1";
        }

        if (videosSection) videosSection.style.display = "";
        if (videosHeader && videosHeader.classList.contains("collapse-header")) {
            videosHeader.style.display = "";
        }
    } catch (err) {
        if (videosSection) videosSection.style.display = "none";
        if (videosHeader && videosHeader.classList.contains("collapse-header")) {
            videosHeader.style.display = "none";
        }
        console.error(err);
    }
}

function setupSearch() {
    const input = document.getElementById("globalSearchInput");
    const box = document.getElementById("searchSuggestions");
    if (!input || !box) return;

    const index = getAllCategoryItems().map(item => ({
        ...item,
        hay: `${item.name} ${item.desc}`.toLowerCase()
    }));

    const closeSuggestions = () => {
        box.classList.remove("open");
        box.innerHTML = "";
    };

    input.addEventListener("input", () => {
        const q = input.value.trim().toLowerCase();
        if (!q) {
            closeSuggestions();
            return;
        }

        const starts = [];
        const contains = [];

        index.forEach(item => {
            if (item.hay.startsWith(q)) {
                starts.push(item);
            } else if (item.hay.includes(q)) {
                contains.push(item);
            }
        });

        const hits = [...starts, ...contains].slice(0, 8);
        if (!hits.length) {
            closeSuggestions();
            return;
        }

        box.innerHTML = hits.map(item => `
            <button type="button" class="search-suggestion-btn" data-link="${item.link}">
                ${item.name}
            </button>
        `).join("");
        box.classList.add("open");
    });

    input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        const firstHit = box.querySelector(".search-suggestion-btn");
        if (!firstHit) return;
        event.preventDefault();
        const link = firstHit.dataset.link;
        if (link) window.location.href = link;
    });

    box.addEventListener("click", (event) => {
        const btn = event.target.closest(".search-suggestion-btn");
        if (!btn) return;
        const link = btn.dataset.link;
        if (link) window.location.href = link;
    });

    document.addEventListener("click", (event) => {
        if (event.target === input || box.contains(event.target)) return;
        closeSuggestions();
    });

    setupSearchPlaceholderTyping(input);
}

function setupSearchPlaceholderTyping(input) {
    const basePlaceholder = "Search:";
    const prompts = [...new Set(
        getAllCategoryItems()
            .map(item => String(item?.name || "").trim())
            .filter(Boolean)
    )];
    if (prompts.length === 0) prompts.push("Rift Event");

    let timer = null;
    let lastPhrase = "";
    let currentPhrase = "";
    let charIndex = 0;
    let deleting = false;

    const canAnimate = () =>
        String(input.value || "").trim() === "";

    const schedule = (delay) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(tick, delay);
    };

    const pickRandomPhrase = () => {
        if (prompts.length === 1) return prompts[0];
        let next = prompts[Math.floor(Math.random() * prompts.length)];
        while (next === lastPhrase) {
            next = prompts[Math.floor(Math.random() * prompts.length)];
        }
        return next;
    };

    const tick = () => {
        if (!canAnimate()) {
            input.placeholder = basePlaceholder;
            deleting = false;
            currentPhrase = "";
            charIndex = 0;
            schedule(900);
            return;
        }

        if (!currentPhrase) {
            currentPhrase = pickRandomPhrase();
        }

        const phrase = currentPhrase;
        if (!deleting) {
            charIndex += 1;
            input.placeholder = `Search: ${phrase.slice(0, charIndex)}`;

            if (charIndex >= phrase.length) {
                deleting = true;
                schedule(1100);
                return;
            }
            schedule(70 + Math.floor(Math.random() * 60));
            return;
        }

        charIndex -= 1;
        input.placeholder = charIndex > 0
            ? `Search: ${phrase.slice(0, charIndex)}`
            : basePlaceholder;

        if (charIndex <= 0) {
            deleting = false;
            lastPhrase = phrase;
            currentPhrase = "";
            schedule(450);
            return;
        }
        schedule(35 + Math.floor(Math.random() * 45));
    };

    input.addEventListener("input", () => {
        if (canAnimate()) {
            schedule(500);
        } else {
            input.placeholder = basePlaceholder;
        }
    });

    schedule(1200);
}

function setupBrandEasterEgg() {
    const brand = document.getElementById("brandEasterEgg");
    if (!brand) return;

    let tapCount = 0;
    let resetTimer = 0;

    const registerTap = () => {
        tapCount += 1;
        if (resetTimer) {
            window.clearTimeout(resetTimer);
        }
        resetTimer = window.setTimeout(() => {
            tapCount = 0;
            resetTimer = 0;
        }, 2200);

        if (tapCount >= 5) {
            tapCount = 0;
            if (resetTimer) {
                window.clearTimeout(resetTimer);
                resetTimer = 0;
            }
            window.location.href = "./empire_duels/index.html";
        }
    };

    brand.addEventListener("pointerup", registerTap);
}

function setupKofiPrompt() {
    const bar = document.getElementById("kofiInlineBar");
    const closeBtn = document.getElementById("kofiInlineCloseBtn");
    if (!bar || !closeBtn) return;

    const hasSeen = localStorage.getItem(KOFI_PROMPT_SEEN_KEY) === "1";
    const optedOut = localStorage.getItem(KOFI_PROMPT_OPTOUT_KEY) === "1";
    if (hasSeen || optedOut) return;

    const markSeen = () => localStorage.setItem(KOFI_PROMPT_SEEN_KEY, "1");

    bar.classList.add("open");

    bar.addEventListener("click", (event) => {
        if (event.target.closest("#kofiInlineCloseBtn")) return;
        markSeen();
        window.open(KOFI_URL, "_blank", "noopener");
    });

    closeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        localStorage.setItem(KOFI_PROMPT_OPTOUT_KEY, "1");
        markSeen();
        bar.classList.remove("open");
    });
}

document.addEventListener("DOMContentLoaded", () => {
    initConsentManager({
        measurementId: "G-8TGZRNFGRR",
        storageKey: "gf_analytics_state_v1",
        defaultState: "enabled"
    });
    setupSettingsModal();
    rerenderMainSections();
    setupFavoriteToggles();
    setupFavoritesDragAndDrop();
    setupMobileFavoritesReorder();
    setupSearch();
    setupBrandEasterEgg();
    renderLatestVideos();
    setupKofiPrompt();
});
