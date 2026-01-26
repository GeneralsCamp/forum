// --- PROXY AND GLOBAL VARIABLES ---
const myProxy = "https://my-proxy-8u49.onrender.com/";
const fallbackProxy = "https://corsproxy.io/?";

let lang = {};
let lootBoxes = [];
let lootBoxKeyTombolas = [];

let lootBoxImageUrlMap = {};
let currencyImageUrlMap = {};

// --- FETCH WITH FALLBACK ---
async function fetchWithFallback(url, timeout = 10000) {
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

// --- VERSION FETCH ---
async function getItemVersion() {
    const url = "https://empire-html5.goodgamestudios.com/default/items/ItemsVersion.properties";
    const res = await fetchWithFallback(url);
    const text = await res.text();
    const match = text.match(/CastleItemXMLVersion=(\d+\.\d+)/);
    if (!match) throw new Error("Item version not found");
    return match[1];
}

async function getLangVersion() {
    const url = "https://langserv.public.ggs-ep.com/12/fr/@metadata";
    const res = await fetchWithFallback(url);
    const json = await res.json();
    return json["@metadata"].versionNo;
}

// --- LANG LOADING ---
function lowercaseKeysRecursive(input) {
    if (input === null || input === undefined) return input;
    if (Array.isArray(input)) return input.map(lowercaseKeysRecursive);
    if (typeof input === "object") {
        const out = {};
        Object.keys(input).forEach((key) => {
            const lowerKey = key.toString().toLowerCase();
            out[lowerKey] = lowercaseKeysRecursive(input[key]);
        });
        return out;
    }
    return input;
}

async function getLanguageData(version) {
    const url = `https://langserv.public.ggs-ep.com/12@${version}/en/*`;
    const res = await fetchWithFallback(url);
    const data = await res.json();
    lang = lowercaseKeysRecursive(data);
}

// --- ITEMS LOADING ---
async function getItems(version) {
    const url = `https://empire-html5.goodgamestudios.com/default/items/items_v${version}.json`;
    const res = await fetchWithFallback(url);
    return await res.json();
}

// --- DLL IMAGE MAP LOADING (Collectable_...) ---
async function getDllText() {
    const indexUrl = "https://empire-html5.goodgamestudios.com/default/index.html";
    const indexRes = await fetchWithFallback(indexUrl);
    if (!indexRes.ok) throw new Error("Failed to fetch index.html");

    const indexHtml = await indexRes.text();

    const dllMatch = indexHtml.match(
        /<link\s+id=["']dll["']\s+rel=["']preload["']\s+href=["']([^"']+)["']/i
    );
    if (!dllMatch) throw new Error("DLL preload link not found");

    const dllRelativeUrl = dllMatch[1];
    const dllUrl = `https://empire-html5.goodgamestudios.com/default/${dllRelativeUrl}`;

    const dllRes = await fetchWithFallback(dllUrl);
    if (!dllRes.ok) throw new Error("Failed to fetch dll");

    return await dllRes.text();
}

async function getCollectableImageMaps() {
    const base = "https://empire-html5.goodgamestudios.com/default/assets/";

    try {
        const text = await getDllText();
        const regex = /this\.assets\.(Collectable_[A-Za-z0-9_]+)\s*=\s*"([^"]+)"/g;

        const boxMap = {};
        const currencyMap = {};

        for (const m of text.matchAll(regex)) {
            const assetName = m[1];
            const relPath = m[2];

            const url = `${base}${relPath}.webp`;

            if (assetName.startsWith("Collectable_") && !assetName.startsWith("Collectable_Currency_")) {
                const shortName = assetName.replace(/^Collectable_/, "");
                boxMap[shortName] = url;
            }

            if (assetName.startsWith("Collectable_Currency_")) {
                const shortName = assetName.replace(/^Collectable_Currency_/, "");
                currencyMap[shortName] = url;
            }
        }

        return { boxMap, currencyMap };
    } catch (e) {
        console.warn("getCollectableImageMaps error:", e);
        return { boxMap: {}, currencyMap: {} };
    }
}

// --- LOOTBOX HELPERS ---
function getLootBoxLangKey(box) {
    return `mysterybox_boxname_${box.name}_${box.rarity}`.toLowerCase();
}

function getLootBoxDisplayName(box) {
    const key = getLootBoxLangKey(box);
    return lang[key] || `${box.name} (rarity ${box.rarity})`;
}

function getKeyTypeFromEntry(entry) {
    if (entry.addRareMysteryBoxKey === "1") return "Rare";
    if (entry.addEpicMysteryBoxKey === "1") return "Epic";
    if (entry.addLegendaryMysteryBoxKey === "1") return "Legendary";
    return "Unknown";
}

function getKeyImageUrl(keyType) {
    if (keyType === "Rare") return currencyImageUrlMap["RareMysteryBoxKey"] || null;
    if (keyType === "Epic") return currencyImageUrlMap["EpicMysteryBoxKey"] || null;
    if (keyType === "Legendary") return currencyImageUrlMap["LegendaryMysteryBoxKey"] || null;
    return null;
}

function getKeyChancesForLootBox(box) {
    const tid = String(box.lootBoxKeyTombolaID);

    const rows = lootBoxKeyTombolas
        .filter((x) => String(x.tombolaID) === tid)
        .map((x) => ({
            keyType: getKeyTypeFromEntry(x),
            shares: Number(x.shares || 0),
        }));

    const total = rows.reduce((sum, r) => sum + r.shares, 0);

    const order = { Rare: 1, Epic: 2, Legendary: 3, Unknown: 99 };

    return rows
        .map((r) => ({
            keyType: r.keyType,
            percent: total > 0 ? (r.shares / total) * 100 : 0,
            iconUrl: getKeyImageUrl(r.keyType),
        }))
        .sort((a, b) => (order[a.keyType] || 99) - (order[b.keyType] || 99));
}

function getLegendaryPercent(box) {
    const chances = getKeyChancesForLootBox(box);
    const legendary = chances.find((c) => c.keyType === "Legendary");
    return legendary ? legendary.percent : 0;
}

function formatPercent(p) {
    return `${p.toFixed(2)}%`;
}

// --- RENDER ---
function createLootBoxCard(box) {
  const displayName = getLootBoxDisplayName(box);
  const chances = getKeyChancesForLootBox(box);

  const imgUrl = lootBoxImageUrlMap[box.name] || null;
  const wanted = ["Rare", "Epic", "Legendary"];

  const chanceMap = {};
  chances.forEach(c => (chanceMap[c.keyType] = c));

  const keyRowsHtml = wanted
    .map((type, idx) => {
      const c = chanceMap[type];

      const icon = c?.iconUrl
        ? `<img src="${c.iconUrl}" alt="${type}" style="height:22px; width:auto;">`
        : "";

      const percent = c ? formatPercent(c.percent) : "0.00%";
      const border = idx < wanted.length - 1 ? "border-bottom" : "";

      return `
        <div class="card-cell d-flex align-items-center justify-content-center gap-2 flex-fill ${border}">
          ${icon}
          <strong>${percent}</strong>
        </div>
      `;
    })
    .join("");

  const imageSection = imgUrl
    ? `
      <div class="col-5 card-cell border-end d-flex justify-content-center align-items-center">
        <div class="image-wrapper">
          <img src="${imgUrl}" alt="${displayName}" class="card-image w-100" loading="lazy">
        </div>
      </div>
    `
    : `
      <div class="col-5 card-cell border-end d-flex justify-content-center align-items-center">
        <div class="image-wrapper">
          <div class="no-image-text">no image</div>
        </div>
      </div>
    `;

  return `
    <div class="col-md-6 col-sm-12 d-flex flex-column">
      <div class="box flex-fill">
        <div class="box-content">

          <h2 class="ci-title">${displayName}</h2>

          <div class="card-table border-top">
            <div class="row g-0 h-100">
              ${imageSection}

              <div class="col-7 d-flex flex-column lootbox-keys-col">
                ${keyRowsHtml}
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  `;
}

function renderLootBoxes(list) {
    const container = document.getElementById("cards");
    container.innerHTML = "";

    list.forEach((box) => {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = createLootBoxCard(box);
        container.appendChild(wrapper.firstElementChild);
    });
}

// --- LOADING UI ---
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
    }, 15);
}

// --- INIT ---
function handleResize() {
    const pageTitle = document.querySelector(".page-title");
    const content = document.getElementById("content");

    if (!pageTitle || !content) return;

    const totalHeightToSubtract = pageTitle.offsetHeight + 18;
    const newHeight = window.innerHeight - totalHeightToSubtract;

    content.style.height = `${newHeight}px`;
}

window.addEventListener("resize", handleResize);
window.addEventListener("DOMContentLoaded", handleResize);


async function init() {
    try {
        const totalSteps = 5;
        let step = 0;

        setLoadingProgress(++step, totalSteps, "Checking item version...");
        const itemVersion = await getItemVersion();

        setLoadingProgress(++step, totalSteps, "Checking language version...");
        const langVersion = await getLangVersion();

        setLoadingProgress(++step, totalSteps, "Loading language data...");
        await getLanguageData(langVersion);

        setLoadingProgress(++step, totalSteps, "Loading loot boxes...");
        const itemsJson = await getItems(itemVersion);

        lootBoxes = Array.isArray(itemsJson.lootBoxes) ? itemsJson.lootBoxes : [];
        lootBoxKeyTombolas = Array.isArray(itemsJson.lootBoxKeyTombolas)
            ? itemsJson.lootBoxKeyTombolas
            : [];

        setLoadingProgress(++step, totalSteps, "Loading images from DLL...");
        const maps = await getCollectableImageMaps();
        lootBoxImageUrlMap = maps.boxMap;
        currencyImageUrlMap = maps.currencyMap;

        lootBoxes.sort((a, b) => {
            const la = getLegendaryPercent(a);
            const lb = getLegendaryPercent(b);

            if (lb !== la) return lb - la;
            return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
        });

        renderLootBoxes(lootBoxes);

        const loadingBox = document.getElementById("loadingBox");
        if (loadingBox) loadingBox.style.display = "none";
    } catch (err) {
        console.error("Error:", err);

        const loadingBox = document.getElementById("loadingBox");
        if (loadingBox) {
            loadingBox.innerHTML = `
        <h3>Something went wrong...</h3>
        <p>Reload in <span id="retryCountdown">30</span> seconds</p>
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
