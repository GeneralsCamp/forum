// --- PROXY AND GLOBAL VARIABLES ---
const myProxy = "https://my-proxy-8u49.onrender.com/";
const fallbackProxy = "https://corsproxy.io/?";

let lang = {};
let allItems = [];
let imageUrlMap = {};

// --- FETCH FUNCTIONS (WITH FALLBACK, VERSIONS, DATA) ---
async function fetchWithFallback(url, timeout = 5000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(myProxy + url, { signal: controller.signal });
        if (!response.ok) throw new Error("myProxy: bad response");
        return response;
    } catch (err) {
        console.warn("Proxy error:", err);

        const encodedUrl = encodeURIComponent(url);
        const fallbackResponse = await fetch(fallbackProxy + encodedUrl);
        if (!fallbackResponse.ok) throw new Error("fallbackProxy: bad response");
        return fallbackResponse;
    } finally {
        clearTimeout(timer);
    }
}

async function getItemVersion() {
    const url = "https://empire-html5.goodgamestudios.com/default/items/ItemsVersion.properties";
    const res = await fetchWithFallback(url);
    const text = await res.text();
    const match = text.match(/CastleItemXMLVersion=(\d+\.\d+)/);
    if (!match) throw new Error("LookItems Version: error");
    return match[1];
}

async function getLangVersion() {
    const url = "https://langserv.public.ggs-ep.com/12/fr/@metadata";
    const res = await fetchWithFallback(url);
    const json = await res.json();
    return json["@metadata"].versionNo;
}

async function getLanguageData(version) {
    const url = `https://langserv.public.ggs-ep.com/12@${version}/en/*`;
    const res = await fetchWithFallback(url);
    const data = await res.json();
    lang = data;
}

async function getItems(version) {
    const url = `https://empire-html5.goodgamestudios.com/default/items/items_v${version}.json`;
    const res = await fetchWithFallback(url);
    if (!res.ok) throw new Error("Failed to fetch lookItems");
    const data = await res.json();
    return data;
}

async function getCurrenVersionInfo() {
    try {
        const urlVersion = "https://empire-html5.goodgamestudios.com/default/items/ItemsVersion.properties";
        const resVersion = await fetchWithFallback(urlVersion);
        if (!resVersion.ok) throw new Error("Failed to fetch current version");

        const text = await resVersion.text();
        const match = text.match(/CastleItemXMLVersion=(\d+\.\d+)/);
        if (!match) throw new Error("Version not found");
        const version = match[1];

        const urlJson = `https://empire-html5.goodgamestudios.com/default/items/items_v${version}.json`;
        const resJson = await fetchWithFallback(urlJson);
        if (!resJson.ok) throw new Error("Failed to fetch version JSON");

        const json = await resJson.json();
        const date = json.versionInfo?.date?.["@value"] || "unknown";

        return { version, date };

    } catch (e) {
        console.warn("Error fetching current lookItems version info:", e);
        return { version: "unknown", date: "unknown" };
    }
}

// --- NAME LOCALIZATION HELPERS (LOOK ITEMS) ---
function getLookName(item) {
    if (item.equipmentID) {
        const key = `equipment_unique_${item.equipmentID}`;
        if (lang[key]) return lang[key];
    }

    if (item.skinName) {
        return item.skinName;
    }

    return item.comment2 || `LookItem ${item.equipmentID || item.skinID || "???"}`;
}

function normalizeName(str) {
    return (str || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

// --- GROUPING AND VALUE CALCULATIONS ---
function extractLookItems(data) {
    const skins = data.worldmapskins || [];
    const equips = data.equipments || [];

    return equips
        .filter(eq => eq.slotID === "5")
        .map(eq => {
            const skin = skins.find(s => s.skinID === eq.skinID);
            return {
                ...eq,
                skinName: skin ? skin.name : "???"
            };
        });
}

// --- CARD CREATION (HTML RENDERING) ---
function createLookCard(item, imageUrlMap = {}, showFilter = null) {
    const name = getLookName(item);
    const normalized = normalizeName(item.skinName);
    const urls = imageUrlMap[normalized] || {};
    const mapObjects = urls.mapObjects || {};
    const movements = urls.movements || {};

    let cardsHtml = "";

    if ((showFilter === "castellan" || !showFilter) && Object.keys(mapObjects).length > 0) {
        const mapImages = Object.values(mapObjects).filter(Boolean);
        cardsHtml += `
        <div class="col-md-6 col-sm-12 d-flex flex-column">
            <div class="box flex-fill">
                <div class="box-content">
                    <h2 class="deco-title">${name}</h2>
                    <hr>
                    <div class="row castellan-row">
                        ${mapImages.map(url => `
                        <div class="col-6 mb-2 text-center">
                            <img src="${url}" alt="${name}">
                        </div>`).join("")}
                    </div>
                </div>
            </div>
        </div>`;
    }

    if ((showFilter === "commander" || !showFilter) && Object.keys(movements).length > 0) {
        const moveImages = Object.values(movements).filter(Boolean);
        cardsHtml += `
        <div class="col-md-6 col-sm-12 d-flex flex-column">
            <div class="box flex-fill">
                <div class="box-content">
                    <h2 class="deco-title">${name}</h2>
                    <hr>
                    <div class="row commander-row">
                        ${moveImages.map(url => `
                        <div class="col-6 text-center">
                            <img src="${url}" alt="${name}">
                        </div>`).join("")}
                    </div>
                </div>
            </div>
        </div>`;
    }

    return cardsHtml;
}

function renderUniqueLookItems() {
    const seenKeys = new Set();
    const uniqueItems = [];

    for (const item of allItems) {
        const normalized = normalizeName(item.skinName);
        if (!imageUrlMap[normalized]) continue;

        if (seenKeys.has(normalized)) continue;
        seenKeys.add(normalized);

        uniqueItems.push({
            equipmentID: item.equipmentID,
            skinName: item.skinName,
            comment1: item.comment1,
            comment2: item.comment2
        });
    }

    const container = document.getElementById("cards");
    container.innerHTML = uniqueItems.map(item => createLookCard(item, imageUrlMap)).join("");

    console.log(`Rendered ${uniqueItems.length} unique look items.`);
}

function applyFiltersAndSorting() {
    const searchValue = normalizeName(document.getElementById("searchInput").value);
    const showFilter = document.getElementById("showFilter").value;

    const filtered = allItems.filter(item => {
        const normalized = normalizeName(item.skinName);
        const urls = imageUrlMap[normalized] || {};
        const mapObjects = urls.mapObjects || {};
        const movements = urls.movements || {};

        const hasMapObjects = Object.keys(mapObjects).length > 0;
        const hasMovements = Object.keys(movements).length > 0;

        const name = normalizeName(getLookName(item));
        if (searchValue && !name.includes(searchValue)) return false;

        if (showFilter === "castellan" && !hasMapObjects) return false;
        if (showFilter === "commander" && !hasMovements) return false;

        return true;
    });

    const seen = new Set();
    const uniqueFiltered = filtered.filter(item => {
        const key = normalizeName(item.skinName);
        if (seen.has(key)) return false;
        seen.add(key);
        return !!imageUrlMap[key];
    });

    uniqueFiltered.sort((a, b) => getLookName(a).localeCompare(getLookName(b)));

    const container = document.getElementById("cards");
    container.innerHTML = uniqueFiltered
        .map(item => createLookCard(item, imageUrlMap, showFilter))
        .join("");
}

// --- IMAGE LOADING (DLL PARSING) ---
async function getImageUrlMap() {
    const base = "https://empire-html5.goodgamestudios.com/default/assets/itemassets/";

    try {
        const indexUrl = "https://empire-html5.goodgamestudios.com/default/index.html";
        const indexRes = await fetchWithFallback(indexUrl);
        if (!indexRes.ok) throw new Error("Failed to fetch index.html: " + indexRes.status);
        const indexHtml = await indexRes.text();

        const dllMatch = indexHtml.match(/<link\s+id=["']dll["']\s+rel=["']preload["']\s+href=["']([^"']+)["']/i);
        if (!dllMatch) throw new Error("DLL preload link not found");

        const dllRelativeUrl = dllMatch[1];
        const dllUrl = `https://empire-html5.goodgamestudios.com/default/${dllRelativeUrl}`;

        console.log("");
        console.log(`DLL version: ${dllRelativeUrl}`);
        console.log(`DLL URL: %c${dllUrl}`, "color:blue; text-decoration:underline;");
        console.log("");

        const dllRes = await fetchWithFallback(dllUrl);
        if (!dllRes.ok) throw new Error("Failed to fetch ggs.dll.js: " + dllRes.status);

        const text = await dllRes.text();

        const regexCastle = /Castle_Mapobject_Special_([A-Za-z0-9]+)--\d+/g;
        const regexOutpost = /Outpost_Mapobject_Special_([A-Za-z0-9]+)--\d+/g;
        const regexMetro = /Metropol_Mapobject_Special_([A-Za-z0-9]+)--\d+/g;
        const regexCapital = /Capital_Mapobject_Special_([A-Za-z0-9]+)--\d+/g;
        const regexMoveNormal = /Skin_Mapmovement_([A-Za-z0-9]+)_Common--\d+/g;
        const regexMoveBoat = /Skin_Mapmovement_([A-Za-z0-9]+)_Eiland--\d+/g;

        const map = {};

        function addMatch(regex, keyName, folderBuilder) {
            for (const match of text.matchAll(regex)) {
                const fullMatch = match[0];
                const name = match[1];
                const normalized = normalizeName(name);

                const [fileName, suffix] = fullMatch.split("--");
                const path = folderBuilder(fileName, suffix);
                const url = `${base}${path}.webp`;

                if (!map[normalized]) map[normalized] = { mapObjects: {}, movements: {} };

                switch (keyName) {
                    case "castleUrl":
                    case "capitalUrl":
                    case "metroUrl":
                    case "outpostUrl":
                        map[normalized].mapObjects[keyName] = url;
                        break;
                    case "moveNormal":
                    case "moveBoat":
                        map[normalized].movements[keyName] = url;
                        break;
                }
            }
        }

        addMatch(regexCastle, "castleUrl", (file, suffix) =>
            `Worldmap/WorldmapObjects/Castles/${file}/${file}--${suffix}`
        );

        addMatch(regexOutpost, "outpostUrl", (file, suffix) =>
            `Worldmap/WorldmapObjects/Outposts/${file}/${file}--${suffix}`
        );

        addMatch(regexMetro, "metroUrl", (file, suffix) =>
            `Worldmap/WorldmapObjects/Landmarks/${file}/${file}--${suffix}`
        );

        addMatch(regexCapital, "capitalUrl", (file, suffix) =>
            `Worldmap/WorldmapObjects/Landmarks/${file}/${file}--${suffix}`
        );

        addMatch(regexMoveNormal, "moveNormal", (file, suffix) =>
            `Worldmap/WorldmapObjects/Movements/Skins/${file}/${file}--${suffix}`
        );

        addMatch(regexMoveBoat, "moveBoat", (file, suffix) =>
            `Worldmap/WorldmapObjects/Movements/Skins/${file}/${file}--${suffix}`
        );
        return map;

    } catch (error) {
        console.error("getImageUrlMap error", error);
        return {};
    }
}

// --- INITIALIZATION AND EVENT SETUP ---
function handleResize() {
    const note = document.querySelector('.note');
    const pageTitle = document.querySelector('.page-title');
    const content = document.getElementById('content');

    if (note && pageTitle && content) {
        const totalHeightToSubtract = note.offsetHeight + pageTitle.offsetHeight + 18;
        const newHeight = window.innerHeight - totalHeightToSubtract;
        content.style.height = `${newHeight}px`;
    }
}

window.addEventListener('resize', handleResize);
window.addEventListener('DOMContentLoaded', handleResize);

function setLoadingProgress(step, totalSteps, text) {
    const status = document.getElementById("loadingStatus");
    const bar = document.getElementById("loadingProgress");
    const percentText = document.getElementById("loadingPercentText");

    if (!status || !bar || !percentText) return;

    const targetPercent = Math.round((step / totalSteps) * 100);
    status.textContent = text;

    let currentPercent = parseInt(bar.style.width) || 0;
    const interval = setInterval(() => {
        if (currentPercent >= targetPercent) {
            clearInterval(interval);
            return;
        }
        currentPercent++;
        bar.style.width = currentPercent + "%";
        percentText.textContent = currentPercent + "%";
    }, 25);
}

async function init() {
    try {
        const totalSteps = 5;
        let step = 0;

        setLoadingProgress(++step, totalSteps, "Checking item version...");
        const itemVersion = await getItemVersion();
        const itemUrl = `https://empire-html5.goodgamestudios.com/default/items/items_v${itemVersion}.json`;
        console.log(`Item version: ${itemVersion}`);
        console.log(`Item URL: %c${itemUrl}`, "color:blue; text-decoration:underline;");
        console.log("");

        setLoadingProgress(++step, totalSteps, "Checking language version...");
        const langVersion = await getLangVersion();
        const langUrl = `https://langserv.public.ggs-ep.com/12@${langVersion}/en/*`;
        console.log(`Language version: ${langVersion}`);
        console.log(`Language URL: %c${langUrl}`, "color:blue; text-decoration:underline;");

        setLoadingProgress(++step, totalSteps, "Loading language data...");
        await getLanguageData(langVersion);

        setLoadingProgress(++step, totalSteps, "Loading items...");
        const json = await getItems(itemVersion);
        allItems = extractLookItems(json);

        setLoadingProgress(++step, totalSteps, "Loading images...");
        imageUrlMap = await getImageUrlMap();

        console.log(`Found ${allItems.length} look items, and created ${Object.keys(imageUrlMap).length} look item URL map entries.`);

        const searchInput = document.getElementById("searchInput");
        if (searchInput) {
            searchInput.addEventListener("input", () => {
                applyFiltersAndSorting();
            });
        }

        const showFilter = document.getElementById("showFilter");
        if (showFilter) {
            showFilter.addEventListener("change", () => {
                applyFiltersAndSorting();
            });
        }

        applyFiltersAndSorting();

        setLoadingProgress(totalSteps, totalSteps, "Rendering complete...");
        const loadingBox = document.getElementById("loadingBox");
        if (loadingBox) loadingBox.style.display = "none";

    } catch (err) {
        console.error("Error:", err);
        const loadingBox = document.getElementById("loadingBox");
        if (loadingBox) {
            loadingBox.innerHTML = `
                <h3>Something went wrong...</h3>
                <p>The page will automatically reload in <span id="retryCountdown">30</span> seconds!</p>
            `;

            let seconds = 30;
            const countdownEl = document.getElementById("retryCountdown");

            const interval = setInterval(() => {
                seconds--;
                if (countdownEl) countdownEl.textContent = seconds.toString();
                if (seconds <= 0) {
                    clearInterval(interval);
                    location.reload();
                }
            }, 1000);
        }
    }
}

init();