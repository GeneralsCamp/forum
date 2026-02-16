import { initAutoHeight } from "../shared/ResizeService.mjs";
import { createLoader } from "../shared/LoadingService.mjs";
import { coreInit } from "../shared/CoreInit.mjs";
import { initImageModal } from "../shared/ModalService.mjs";
import { initLanguageSelector, getInitialLanguage } from "../shared/LanguageService.mjs";
import { deriveCompanionUrls } from "../shared/AssetComposer.mjs";
import { hydrateComposedImages } from "../shared/ComposeHydrator.mjs";

// --- GLOBAL VARIABLES ---
let lang = {};
let ownLang = {};
let allItems = [];
let imageUrlMap = {};
const composedLookImageCache = new Map();

// --- FETCH FUNCTIONS ---
const loader = createLoader();
let currentLanguage = getInitialLanguage();

async function loadOwnLang() {
    try {
        const res = await fetch("./ownLang.json");
        const raw = await res.json();

        function normalizeKeys(obj) {
            if (obj && typeof obj === "object" && !Array.isArray(obj)) {
                return Object.fromEntries(
                    Object.entries(obj).map(([k, v]) => [
                        k.toLowerCase(),
                        normalizeKeys(v)
                    ])
                );
            }
            if (Array.isArray(obj)) return obj.map(normalizeKeys);
            return obj;
        }

        ownLang = normalizeKeys(raw);

    } catch (err) {
        console.error("ownLang load error:", err);
        ownLang = {};
    }
}

function applyOwnLang() {

    const L = ownLang[currentLanguage?.toLowerCase()] || {};
    const filters = L.filters || {};
    const ui = L.ui || {};

    const search = document.getElementById("searchInput");
    if (search) {
        search.placeholder =
            filters.search_placeholder || "Search...";
    }

    const showFilter = document.getElementById("showFilter");

    if (showFilter) {

        for (const opt of showFilter.options) {

            if (opt.value === "commander")
                opt.text =
                    filters.show_commander || "Commander skins";

            if (opt.value === "castellan")
                opt.text =
                    filters.show_castellan || "Castellan skins";
        }
    }
    window.UI_LANG = {
        no_image: ui.no_image || "No image"
    };


}

// --- NAME LOCALIZATION HELPERS ---
function normalizeName(str) {
    return (str || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function getLookName(item) {

    if (item.equipmentID) {
        const key = `equipment_unique_${item.equipmentID}`;
        if (lang[key]) return lang[key];
    }

    if (item.skinName)
        return item.skinName;

    return item.comment2 ||
        `LookItem ${item.equipmentID || item.skinID || "???"}`;
}

function extractLookItems(data) {

    const skins = data.worldmapskins || [];
    const equips = data.equipments || [];

    return equips
        .filter(eq => eq.slotID === "5")
        .map(eq => {

            const skin = skins.find(
                s => s.skinID === eq.skinID
            );

            return {
                ...eq,
                skinName: skin ? skin.name : "???"
            };
        });
}

// --- CARD CREATION (HTML RENDERING) ---
function createLookCard(item, showFilter = null) {

    const name = getLookName(item);
    const normalized = normalizeName(item.skinName);

    const urls = imageUrlMap[normalized] || {};
    const mapObjects = urls.mapObjects || {};
    const movements = urls.movements || {};

    const imgOrPlaceholder = (url) => {
        if (!url) {
            return `<div class="no-image-text text-muted py-4">
                ${UI_LANG.no_image}
               </div>`;
        }

        const isRemoteItemAsset =
            url.startsWith("https://empire-html5.goodgamestudios.com/default/assets/itemassets/") &&
            /\.(webp|png)$/i.test(url);

        if (!isRemoteItemAsset) {
            return `<img src="${url}" alt="${name}" class="img-fluid">`;
        }

        const companion = deriveCompanionUrls(url);
        return `<img src="${url}" alt="${name}" class="img-fluid" data-compose-asset="1" data-image-url="${companion.imageUrl}" data-json-url="${companion.jsonUrl}" data-js-url="${companion.jsUrl}">`;
    };

    let cardsHtml = "";

    if ((showFilter === "castellan" || !showFilter) &&
        Object.keys(mapObjects).length > 0) {

        cardsHtml += `
        <div class="col-md-6 col-sm-12 d-flex flex-column">
            <div class="box flex-fill">
                <div class="box-content">
                    <h2 class="deco-title">${name}</h2>

                    <div class="row g-0 border-top castellan-grid">
                        <div class="col-6 border-end border-bottom text-center p-4">
                            ${imgOrPlaceholder(mapObjects.castleUrl)}
                        </div>

                        <div class="col-6 border-bottom text-center p-4">
                            ${imgOrPlaceholder(mapObjects.outpostUrl)}
                        </div>

                        <div class="col-6 border-end text-center p-4">
                            ${imgOrPlaceholder(mapObjects.metroUrl)}
                        </div>

                        <div class="col-6 text-center p-4">
                            ${imgOrPlaceholder(mapObjects.capitalUrl)}
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    }

    if ((showFilter === "commander" || !showFilter) &&
        Object.keys(movements).length > 0) {

        cardsHtml += `
        <div class="col-md-6 col-sm-12 d-flex flex-column">
            <div class="box flex-fill">
                <div class="box-content">
                    <h2 class="deco-title">${name}</h2>

                    <div class="row g-0 border-top commander-grid">
                        <div class="col-6 border-end text-center p-4">
                            ${imgOrPlaceholder(movements.moveNormal)}
                        </div>

                        <div class="col-6 text-center p-4">
                            ${imgOrPlaceholder(movements.moveBoat)}
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    }

    return cardsHtml;
}

// --- FILTERING, SEARCH, SORTING ---
function applyFiltersAndSorting() {

    const searchValue =
        normalizeName(
            document.getElementById("searchInput").value
        );

    const showFilter =
        document.getElementById("showFilter").value;

    const filtered = allItems.filter(item => {

        const normalized =
            normalizeName(item.skinName);

        const urls =
            imageUrlMap[normalized] || {};

        const mapObjects =
            urls.mapObjects || {};

        const movements =
            urls.movements || {};

        const hasMapObjects =
            Object.keys(mapObjects).length > 0;

        const hasMovements =
            Object.keys(movements).length > 0;

        const name =
            normalizeName(getLookName(item));

        if (searchValue &&
            !name.includes(searchValue))
            return false;

        if (showFilter === "castellan" &&
            !hasMapObjects)
            return false;

        if (showFilter === "commander" &&
            !hasMovements)
            return false;

        return true;
    });

    const seen = new Set();

    const uniqueFiltered =
        filtered.filter(item => {

            const key =
                normalizeName(item.skinName);

            if (seen.has(key))
                return false;

            seen.add(key);

            return !!imageUrlMap[key];
        });

    uniqueFiltered.sort((a, b) =>
        (Number(b.equipmentID) || 0) -
        (Number(a.equipmentID) || 0)
    );

    const container =
        document.getElementById("cards");

    container.innerHTML =
        uniqueFiltered
            .map(item =>
                createLookCard(item, showFilter))
            .join("");

    void hydrateComposedImages({
        root: container,
        cache: composedLookImageCache
    });
}

function setupEventListeners() {

    const searchInput =
        document.getElementById("searchInput");

    const showFilter =
        document.getElementById("showFilter");

    if (searchInput)
        searchInput.addEventListener(
            "input",
            applyFiltersAndSorting
        );

    if (showFilter)
        showFilter.addEventListener(
            "change",
            applyFiltersAndSorting
        );
}

// --- INITIALIZATION AND EVENT SETUP ---
initAutoHeight({
    contentSelector: "#content",
    subtractSelectors: [".note", ".page-title"],
    extraOffset: 18
});

async function init() {
    try {
        initImageModal();

        await coreInit({
            loader,
            langCode: currentLanguage,
            normalizeNameFn: normalizeName,
            itemLabel: "look items",

            assets: {
                looks: true
            },

            onReady: async ({
                lang: L,
                data,
                imageMaps
            }) => {

                lang = L;
                allItems = extractLookItems(data);
                imageUrlMap = imageMaps.looks || {};

                initLanguageSelector({
                    currentLanguage,
                    lang,
                    onSelect: () => location.reload()
                });

                await loadOwnLang();
                applyOwnLang();

                setupEventListeners();
                applyFiltersAndSorting();
            }
        });
    } catch (err) {
        console.error(err);
        loader.error("Something went wrong...", 30);
    }
}

init();