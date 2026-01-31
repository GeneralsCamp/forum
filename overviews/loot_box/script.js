import { initAutoHeight } from "../shared/ResizeService.mjs";
import { createLoader } from "../shared/LoadingService.mjs";
import { coreInit } from "../shared/CoreInit.mjs";
import { initLanguageSelector, getInitialLanguage } from "../shared/LanguageService.mjs";

// --- GLOBAL VARIABLES ---
let lang = {};
let lootBoxes = [];
let lootBoxKeyTombolas = [];

let lootBoxImageUrlMap = {};
let currencyImageUrlMap = {};

const loader = createLoader();
let currentLanguage = getInitialLanguage();

// --- LOOTBOX HELPERS ---
function normalizeName(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

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
    if (keyType === "Rare") return currencyImageUrlMap[normalizeName("RareMysteryBoxKey")] || null;
    if (keyType === "Epic") return currencyImageUrlMap[normalizeName("EpicMysteryBoxKey")] || null;
    if (keyType === "Legendary") return currencyImageUrlMap[normalizeName("LegendaryMysteryBoxKey")] || null;
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

    const imgUrl = lootBoxImageUrlMap[normalizeName(box.name?.trim())] ?? null;

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

// --- INIT ---
initAutoHeight({
    contentSelector: "#content",
    subtractSelectors: [".note", ".page-title"],
    extraOffset: 18
});

async function init() {
    await coreInit({
        loader,
        itemLabel: "loot boxes",
        langCode: currentLanguage,
        normalizeNameFn: normalizeName,

        assets: {
            lootboxes: true,
            currencies: true
        },

        onReady: async ({
            lang: L,
            data,
            imageMaps,
        }) => {

            lang = L;

            lootBoxes = Array.isArray(data.lootBoxes)
                ? data.lootBoxes
                : [];

            lootBoxKeyTombolas = Array.isArray(data.lootBoxKeyTombolas)
                ? data.lootBoxKeyTombolas
                : [];

            lootBoxImageUrlMap = imageMaps?.lootboxes ?? {};
            currencyImageUrlMap = imageMaps?.currencies ?? {};


            initLanguageSelector({
                currentLanguage,
                lang,
                onSelect: () => location.reload()
            });

            lootBoxes.sort((a, b) => {
                const la = getLegendaryPercent(a);
                const lb = getLegendaryPercent(b);

                if (lb !== la) return lb - la;
                return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
            });

            renderLootBoxes(lootBoxes);
        }
    });
}

init();