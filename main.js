import { loadGoogleAnalytics } from "./overviews/shared/ConsentManager.mjs";
import {
    getDefaultGameSource,
    HOME_SETTINGS_KEY
} from "./overviews/shared/GameSettings.mjs";
import { availableLanguages, getInitialLanguage } from "./overviews/shared/LanguageService.mjs";
import { initCustomModal } from "./overviews/shared/ModalService.mjs";
let uiSettings = readHomeSettings();
let currentLanguage = getSavedSiteLanguage();
let ownLang = {};

const categories = {
    overviews: [
        { key: "decorations", name: "Decorations Overview", icon: "main_page/decorations.webp", link: "./overviews/decorations/index.html", disabled: false },
        { key: "building_items", name: "CI's & TCI's Overview", icon: "main_page/ci-icon.webp", link: "./overviews/building_items/index.html", disabled: false },
        { key: "look_items", name: "Look-items Overview", icon: "main_page/look-items.webp", link: "./overviews/look_items/index.html", disabled: false },
        { key: "equipment_sets", name: "Unique Sets Overview", icon: "main_page/equipment-icon.webp", link: "./overviews/equipment_sets/index.html", disabled: false },
        { key: "generals", name: "Generals Overview", icon: "main_page/generals-icon.webp", link: "./overviews/generals/index.html", disabled: false },
        { key: "event_rewards", name: "Event Rewards Overview", icon: "main_page/event-rewards-icon.webp", link: "./overviews/event_rewards/index.html", disabled: false },
        { key: "gacha", name: "Gacha Overview", icon: "main_page/gacha-icon.webp", link: "./overviews/gacha_events/index.html", disabled: false },
        { key: "loot_boxes", name: "Loot Boxes Overview", icon: "main_page/lootbox-icon.webp", link: "./overviews/loot_box/index.html#boxes", disabled: false },
        { key: "offerings", name: "Offerings Overview", icon: "main_page/offerings-icon.webp", link: "./overviews/loot_box/index.html#offerings", disabled: false },
        { key: "master_blacksmith", name: "Master Blacksmith Overview", icon: "main_page/master-blacksmith.webp", link: "./overviews/master_blacksmith/index.html", disabled: false },
        { key: "troops", name: "Troops Overview", icon: "main_page/troops-icon.webp", link: "./overviews/troops_and_tools/index.html#troops", disabled: false },
        { key: "tools", name: "Tools Overview", icon: "main_page/tools-icon.webp", link: "./overviews/troops_and_tools/index.html#tools", disabled: false },
        { key: "rift_event", name: "Rift Event Overview", icon: "main_page/rift-raid-icon.webp", link: "./overviews/rift_event/index.html", disabled: false },
        { key: "quests", name: "Quests Overview", icon: "main_page/quest-icon.webp", link: "./overviews/quests/index.html", disabled: false },
        { key: "event_plan", name: "Event Plan Overview", icon: "main_page/event-plan-icon.webp", link: "./overviews/event_plan/index.html", disabled: false }
    ],

    calculators: [
        { key: "food_production", name: "Food Production Calculator", icon: "main_page/food-production-icon.webp", link: "./calculators/food_production/index.html", disabled: false },
        { key: "mead_production", name: "Mead Production Calculator", icon: "main_page/mead-icon.webp", link: "./calculators/mead_production/index.html", disabled: false },
        { key: "wall_limit", name: "Wall Limit Calculator", icon: "main_page/wall-icon.webp", link: "./calculators/wall_limit/index.html", disabled: false },
        { key: "collector_event", name: "Collector Event Calculator", icon: "main_page/collector-icon.webp", link: "./calculators/collector_event/index.html", disabled: false },
        { key: "detection_time", name: "Detection Time Calculator", icon: "main_page/detection-icon.webp", link: "./calculators/travel_speed/index.html", disabled: false },
        { key: "rift_points", name: "Rift Raid Point Calculator", icon: "main_page/rift-raid-points-icon.webp", link: "./calculators/rift_raid_points/index.html", disabled: false },
        { key: "kingdom_league", name: "Kingdom League Calculator", icon: "main_page/leauge-icon.webp", link: "./calculators/kingdom_league/index.html", disabled: false }
    ],

    simulators: [
        { key: "imperial_patronage", name: "Imperial Patronage Simulator", icon: "main_page/patronage-icon.webp", link: "./simulators/imperial_patronage/index.html", disabled: false },
        { key: "equipment_builder", name: "Equipment Set Builder", icon: "main_page/equipment-icon.webp", link: "./simulators/equipment_builder/index.html", disabled: false },
        { key: "castle_layout", name: "Castle Layout Simulator", icon: "main_page/layout-icon.webp", link: "./simulators/layout_editor/index.html", disabled: false },
        { key: "hall_of_legends", name: "Hall of Legends Simulator", icon: "main_page/hall-of-legends-simulator-icon.webp", link: "./simulators/hol_simulator/index.html", disabled: false },
    ]
};

async function loadOwnLanguage() {
    try {
        const response = await fetch("./ownLang.json");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        ownLang = await response.json();
    } catch (error) {
        console.error("Homepage ownLang load error:", error);
        ownLang = {};
    }
}

function translate(key, fallback = "", variables = {}) {
    const selected = ownLang?.[currentLanguage]?.ui?.[key];
    const english = ownLang?.en?.ui?.[key];
    let value = String(selected || english || fallback || key);
    Object.entries(variables).forEach(([name, replacement]) => {
        value = value.replaceAll(`{${name}}`, String(replacement));
    });
    return value;
}

function localizeItem(item) {
    const selected = ownLang?.[currentLanguage]?.cards?.[item.key];
    const english = ownLang?.en?.cards?.[item.key];
    return {
        ...item,
        name: selected?.name || english?.name || item.name
    };
}

function setText(selector, key, fallback) {
    const element = document.querySelector(selector);
    if (element) element.textContent = translate(key, fallback);
}

function applyHomeTranslations() {
    document.documentElement.lang = currentLanguage;
    document.documentElement.dir = currentLanguage === "ar" ? "rtl" : "ltr";

    setText(".main-nav-brand-subtext", "brand_subtitle", "Tools & Simulators");
    const sectionKeys = [
        ["overviews", "overviews", "OVERVIEWS"],
        ["calculators", "calculators", "CALCULATORS"],
        ["simulators", "simulators", "SIMULATORS"]
    ];
    sectionKeys.forEach(([id, key, fallback]) => {
        const title = document.querySelector(`#${id}`)?.previousElementSibling?.querySelector(".header-title");
        if (title) title.textContent = translate(key, fallback).toUpperCase();
    });

    setText(".contact-note-intro", "contact_intro", "Questions or suggestions?");
    setText(".nav-settings-label", "settings", "Settings");
    setText("#settingsModalTitle", "settings", "Settings");

    const settingsButton = document.getElementById("openSettingsBtn");
    if (settingsButton) {
        settingsButton.setAttribute("aria-label", translate("settings", "Settings"));
    }

    const optionTitles = document.querySelectorAll(".settings-option-title");
    if (optionTitles[0]) optionTitles[0].textContent = translate("game", "Game");
    if (optionTitles[1]) optionTitles[1].textContent = translate("language", "Language");
    const devLabel = document.querySelector("#settingsDevComments")?.previousElementSibling;
    if (devLabel) devLabel.textContent = translate("developer_comments", "Developer Comments");

    window.dispatchEvent(new CustomEvent("home-language-change"));
}

function createCategoryCard(item) {
    const shell = document.createElement("div");
    shell.className = "category-card-shell";
    shell.dataset.link = item.link || "";

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
        </div>
    `;

    shell.appendChild(box);

    return shell;
}

function renderCategory(list, targetId) {
    const container = document.querySelector(`#${targetId} .category-grid`);
    if (!container) return;
    container.innerHTML = "";

    list.forEach((rawItem) => {
        const item = localizeItem(rawItem);
        const card = createCategoryCard(item);
        container.appendChild(card);
    });
}

function getDefaultHomeSettings() {
    return {
        selectedGame: getDefaultGameSource(),
        devCommentsEnabled: true
    };
}

function readHomeSettings() {
    const defaults = getDefaultHomeSettings();
    try {
        const raw = localStorage.getItem(HOME_SETTINGS_KEY);
        const parsed = JSON.parse(raw || "{}");
        return {
            selectedGame: parsed.selectedGame ?? defaults.selectedGame,
            devCommentsEnabled: parsed.devCommentsEnabled ?? defaults.devCommentsEnabled
        };
    } catch {
        return defaults;
    }
}

function writeHomeSettings(settings) {
    localStorage.setItem(HOME_SETTINGS_KEY, JSON.stringify(settings));
}

function getSavedSiteLanguage() {
    const saved = localStorage.getItem("selectedLanguage");
    return availableLanguages.includes(saved) ? saved : getInitialLanguage();
}

function writeSiteLanguage(languageCode) {
    if (!languageCode) return;
    localStorage.setItem("selectedLanguage", String(languageCode));
}

function buildLanguageLabel(code) {
    try {
        const display = new Intl.DisplayNames([code], { type: "language" });
        const nativeName = display.of(code);
        return nativeName ? `${nativeName} (${String(code).toUpperCase()})` : String(code).toUpperCase();
    } catch {
        return String(code).toUpperCase();
    }
}

function populateLanguageSelect(select) {
    if (!select) return;
    select.innerHTML = availableLanguages.map((code) =>
        `<option value="${code}">${buildLanguageLabel(code)}</option>`
    ).join("");
}

function rerenderMainSections() {
    renderCategory(categories.overviews, "overviews");
    renderCategory(categories.calculators, "calculators");
    renderCategory(categories.simulators, "simulators");
}

function getAllCategoryItems() {
    return [
        ...categories.overviews,
        ...categories.simulators,
        ...categories.calculators
    ].filter(item => !item.disabled && item.link).map(localizeItem);
}

function setupSettingsModal() {
    const openBtn = document.getElementById("openSettingsBtn");
    const closeBtn = document.getElementById("closeSettingsBtn");
    const modal = document.getElementById("settingsModal");
    const devCommentsInput = document.getElementById("settingsDevComments");
    const selectedGameInput = document.getElementById("settingsSelectedGame");
    const selectedLanguageInput = document.getElementById("settingsSelectedLanguage");
    if (!openBtn || !closeBtn || !modal || !devCommentsInput || !selectedGameInput || !selectedLanguageInput) return;
    const settingsModal = initCustomModal({ modalId: "settingsModal", closeAnimMs: 190 });

    const empireOption = selectedGameInput.querySelector('option[value="empire"]');
    const e4kOption = selectedGameInput.querySelector('option[value="e4k"]');

    const syncGameOptionLabels = () => {
        const isMobile = window.matchMedia("(max-width: 700px)").matches;
        if (empireOption) {
            empireOption.textContent = isMobile
                ? translate("empire_browser_short", "EM (Browser)")
                : translate("empire_browser", "Empire (Browser)");
        }
        if (e4kOption) {
            e4kOption.textContent = isMobile
                ? translate("e4k_mobile_short", "E4K (Mobile)")
                : translate("e4k_mobile", "Empire: Four Kingdoms (Mobile)");
        }
    };

    populateLanguageSelect(selectedLanguageInput);

    const syncForm = () => {
        syncGameOptionLabels();
        selectedGameInput.value = uiSettings.selectedGame || getDefaultGameSource();
        selectedLanguageInput.value = getSavedSiteLanguage();
        devCommentsInput.checked = Boolean(uiSettings.devCommentsEnabled);
    };

    const openModal = () => {
        syncForm();
        settingsModal.open();
    };

    const handleChange = () => {
        const selectedGame = selectedGameInput.value || getDefaultGameSource();
        const nextLanguage = selectedLanguageInput.value || getInitialLanguage();
        writeSiteLanguage(nextLanguage);
        currentLanguage = nextLanguage;
        uiSettings = {
            ...uiSettings,
            selectedGame,
            devCommentsEnabled: devCommentsInput.checked
        };
        writeHomeSettings(uiSettings);
        applyHomeTranslations();
        syncGameOptionLabels();
        rerenderMainSections();
    };

    openBtn.addEventListener("click", openModal);

    selectedGameInput.addEventListener("change", handleChange);
    selectedLanguageInput.addEventListener("change", handleChange);
    devCommentsInput.addEventListener("change", handleChange);
    window.addEventListener("resize", syncGameOptionLabels);
    syncGameOptionLabels();

}

function setupSearch() {
    const input = document.getElementById("globalSearchInput");
    const box = document.getElementById("searchSuggestions");
    if (!input || !box) return;

    const closeSuggestions = () => {
        box.classList.remove("open");
        box.innerHTML = "";
    };

    input.addEventListener("input", () => {
        const q = input.value.trim().toLocaleLowerCase(currentLanguage);
        if (!q) {
            closeSuggestions();
            return;
        }

        const starts = [];
        const contains = [];
        const index = getAllCategoryItems().map(item => ({
            ...item,
            hay: item.name.toLocaleLowerCase(currentLanguage)
        }));

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
    let basePlaceholder = translate("search_prefix", "Search:");
    let prompts = [];

    let timer = null;
    let lastPhrase = "";
    let currentPhrase = "";
    let charIndex = 0;
    let deleting = false;

    const syncLanguage = () => {
        basePlaceholder = translate("search_prefix", "Search:");
        prompts = [...new Set(
            getAllCategoryItems()
                .map(item => String(item?.name || "").trim())
                .filter(Boolean)
        )];
        if (prompts.length === 0) prompts.push("Rift Event");
        lastPhrase = "";
        currentPhrase = "";
        charIndex = 0;
        deleting = false;
        if (String(input.value || "").trim() === "") input.placeholder = basePlaceholder;
    };

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
            input.placeholder = `${basePlaceholder} ${phrase.slice(0, charIndex)}`;

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
            ? `${basePlaceholder} ${phrase.slice(0, charIndex)}`
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

    window.addEventListener("home-language-change", () => {
        syncLanguage();
        schedule(500);
    });
    syncLanguage();
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

document.addEventListener("DOMContentLoaded", async () => {
    loadGoogleAnalytics("G-8TGZRNFGRR");
    await loadOwnLanguage();
    currentLanguage = getSavedSiteLanguage();
    applyHomeTranslations();
    setupSettingsModal();
    rerenderMainSections();
    setupSearch();
    setupBrandEasterEgg();
});
