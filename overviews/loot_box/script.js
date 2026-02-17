import { initAutoHeight } from "../shared/ResizeService.mjs";
import { createLoader } from "../shared/LoadingService.mjs";
import { coreInit } from "../shared/CoreInit.mjs";
import { initLanguageSelector, getInitialLanguage } from "../shared/LanguageService.mjs";
import { createRewardResolver } from "../shared/RewardResolver.mjs";
import { deriveCompanionUrls } from "../shared/AssetComposer.mjs";
import { hydrateComposedImages } from "../shared/ComposeHydrator.mjs";

// --- GLOBAL VARIABLES ---
let lang = {};
let lootBoxes = [];
let lootBoxKeyTombolas = [];
let rewardsById = {};
let lootBoxTombolas = [];
let characters = [];
let offeringsByCharacterId = {};
let currenciesById = {};
let buildingsById = {};
let constructionItemsById = {};
let equipmentsById = {};
let lootBoxesById = {};
let lookSkinsById = {};
let rewardResolver = null;

let lootBoxImageUrlMap = {};
let currencyImageUrlMap = {};
let decorationImageUrlMap = {};
let constructionImageUrlMap = {};
let lookImageUrlMap = {};
let equipmentUniqueImageUrlMap = {};
let uniqueGemImageUrlMap = {};
const composedEquipmentImageCache = new Map();

const loader = createLoader();
let currentLanguage = getInitialLanguage();

const RARITY_ORDER = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4
};

const KEY_TYPE_MIN_RARITY = {
  Common: RARITY_ORDER.common,
  Rare: RARITY_ORDER.rare,
  Epic: RARITY_ORDER.epic,
  Legendary: RARITY_ORDER.legendary
};

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
  if (entry.addCommonMysteryBoxKey === "1") return "Common";
  if (entry.addRareMysteryBoxKey === "1") return "Rare";
  if (entry.addEpicMysteryBoxKey === "1") return "Epic";
  if (entry.addLegendaryMysteryBoxKey === "1") return "Legendary";
  return "Unknown";
}

function getKeyImageUrl(keyType) {
  if (keyType === "Common") return currencyImageUrlMap[normalizeName("CommonMysteryBoxKey")] || null;
  if (keyType === "Rare") return currencyImageUrlMap[normalizeName("RareMysteryBoxKey")] || null;
  if (keyType === "Epic") return currencyImageUrlMap[normalizeName("EpicMysteryBoxKey")] || null;
  if (keyType === "Legendary") return currencyImageUrlMap[normalizeName("LegendaryMysteryBoxKey")] || null;
  return null;
}

function getKeyTypeLabel(keyType) {
  if (keyType === "Common") return lang["currency_name_commonmysteryboxkey"] || "Common mystery key";
  if (keyType === "Rare") return lang["currency_name_raremysteryboxkey"] || "Rare mystery key";
  if (keyType === "Epic") return lang["currency_name_epicmysteryboxkey"] || "Epic mystery key";
  if (keyType === "Legendary") return lang["currency_name_legendarymysteryboxkey"] || "Legendary mystery key";
  return keyType || "Key";
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

function getUiLabel(key, fallback) {
  const raw = lang[String(key || "").toLowerCase()] || fallback;
  if (!raw) return fallback || "";
  return String(raw).replace(/:\s*$/, "");
}

// --- OFFERINGS ---
function getCharacterDisplayName(character) {
  if (!character) return "Unknown character";
  const key = `dialog_generals_inn_character_${character.name}`.toLowerCase();
  return lang[key] || character.name || `Character ${character.characterID}`;
}

function getCurrencyDisplayName(currency) {
  if (!currency) return "Unknown offering";
  const key = `currency_name_${currency.Name}`.toLowerCase();
  return lang[key] || currency.Name || currency.JSONKey || `Currency ${currency.currencyID}`;
}

function getCurrencyImageUrl(currency) {
  if (!currency) return null;
  const raw = currency.assetName || currency.Name || currency.JSONKey || "";
  return currencyImageUrlMap[normalizeName(raw)] || null;
}

function parseTombolaString(value) {
  return String(value || "")
    .split("#")
    .map(x => x.trim())
    .filter(Boolean)
    .map(entry => {
      const [currencyId, tombolaId] = entry.split("+").map(s => s.trim());
      if (!currencyId || !tombolaId) return null;
      return { currencyId, tombolaId };
    })
    .filter(Boolean);
}

function getGemImageUrlByRewardValue(gemValue) {
  const raw = String(gemValue || "").trim();
  if (!raw) return null;
  const match = raw.match(/\d+/);
  if (!match) return null;
  const gemId = String(match[0]);
  return uniqueGemImageUrlMap[gemId] || null;
}

function buildOfferingsForCharacter(character) {
  const rows = parseTombolaString(character?.tombolas);
  return rows.map(row => ({
    characterId: String(character.characterID),
    characterName: getCharacterDisplayName(character),
    currencyId: String(row.currencyId),
    tombolaId: String(row.tombolaId),
  }));
}

// --- REWARDS ---
let unitsById = {};
let unitImageUrlMap = {};
function getRarityFromCategory(categoryValue) {
  const category = Number(categoryValue);
  if (category === 1) return "common";
  if (category === 2) return "rare";
  if (category === 3) return "epic";
  if (category === 4) return "legendary";
  return null;
}

function getEntryRarity(entry, rewards) {
  const fromCategory = getRarityFromCategory(entry?.rewardCategory ?? entry?.rewardcategory);
  if (fromCategory) return fromCategory;

  const r = rewards.find(x => typeof x.comment2 === "string");
  if (!r) return "common";

  const v = r.comment2.trim().toLowerCase();

  if (v === "common") return "common";
  if (v === "rare") return "rare";
  if (v === "epic") return "epic";
  if (v === "legendary") return "legendary";

  return "common";
}

function openTombolaModal({ title, tombolaId, keyType = null }) {
  const modalEl = document.getElementById("lootBoxModal");
  const modalTitle = modalEl.querySelector(".modal-title");
  const container = document.getElementById("lootBoxRewards");

  modalTitle.textContent = title || "Rewards";
  container.innerHTML = "";

  const entries = lootBoxTombolas.filter(
    e => String(e.tombolaID) === String(tombolaId)
  );

  if (entries.length === 0) {
    container.innerHTML = `<div class="col-12">No rewards</div>`;
    new bootstrap.Modal(modalEl).show();
    return;
  }

  const cardsRaw = entries
    .map(entry => {
      const rewardIds = String(entry.rewardIDs)
        .split(",")
        .map(x => x.trim())
        .filter(Boolean);

      const rewards = rewardIds
        .map(id => rewardsById[id])
        .filter(Boolean);

      if (rewards.length === 0) return null;

      const rarity = getEntryRarity(entry, rewards);
      const shares = Number(entry.shares || 0);

      return {
        rarity,
        order: RARITY_ORDER[rarity] || 99,
        shares,
        rewards
      };
    })
    .filter(Boolean);

  const minRarity = keyType && KEY_TYPE_MIN_RARITY[keyType]
    ? KEY_TYPE_MIN_RARITY[keyType]
    : null;

  const cards = cardsRaw
    .filter(card => minRarity === null || card.order >= minRarity)
    .map(card => ({ ...card }))
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return b.shares - a.shares;
    });

  const totalShares = cards.reduce((sum, card) => sum + card.shares, 0);
  cards.forEach(card => {
    card.chance = totalShares > 0 ? (card.shares / totalShares) * 100 : 0;
  });

  if (cards.length === 0) {
    container.innerHTML = `<div class="col-12">No rewards</div>`;
    new bootstrap.Modal(modalEl).show();
    return;
  }

  cards.forEach(card => {
    container.appendChild(
      createEntryCard({
        rewards: card.rewards,
        chance: card.chance,
        rarity: card.rarity
      })
    );
  });

  new bootstrap.Modal(modalEl).show();
  void hydrateComposedImages({
    root: container,
    selector: 'img[data-compose-equipment="1"]:not([data-compose-ready])',
    cache: composedEquipmentImageCache
  });
}

function openLootBoxModal(box, keyType = null) {
  openTombolaModal({
    title: getLootBoxDisplayName(box),
    tombolaId: box.lootBoxTombolaID,
    keyType
  });
}

function explodeReward(reward) {
  const entries = [];
  const resolved = rewardResolver
    ? rewardResolver.resolveRewardEntries(reward)
    : [];

  resolved.forEach((entry) => {
    let imageUrl = null;

    if (entry.type === "currency") {
      imageUrl = rewardResolver.getCurrencyImageUrl(entry);
    } else if (entry.type === "unit") {
      imageUrl = rewardResolver.getUnitImageUrl(entry);
    } else if (entry.type === "construction") {
      imageUrl = rewardResolver.getConstructionImageUrl(entry);
    } else if (entry.type === "decoration") {
      imageUrl = rewardResolver.getDecorationImageUrl(entry);
    } else if (entry.type === "equipment") {
      imageUrl = rewardResolver.getEquipmentImageUrl(entry);
      if (!imageUrl) {
        imageUrl = "../../img_base/equipment.png";
      }
    } else if (entry.type === "lootbox") {
      imageUrl = rewardResolver.getLootBoxImageUrl(entry);
    }

    const isRemoteItemAsset = typeof imageUrl === "string" &&
      imageUrl.startsWith("https://empire-html5.goodgamestudios.com/default/assets/itemassets/") &&
      /\.(webp|png)$/i.test(imageUrl);
    const shouldCompose = (
      entry.type === "equipment" ||
      entry.type === "gem" ||
      entry.type === "construction"
    ) && isRemoteItemAsset;
    const composedSource = shouldCompose ? deriveCompanionUrls(imageUrl) : null;

    entries.push({
      ...entry,
      imageUrl,
      composedSource,
      title: entry.id ? `${entry.type}=${entry.id}` : entry.type
    });
  });

  const simpleResources = ["food", "wood", "stone"];
  for (const res of simpleResources) {
    if (!reward[res]) continue;

    entries.push({
      type: res,
      name: lang[res] ?? res,
      amount: Number(reward[res]) || 1,
      imageUrl: `../../img_base/${res}.png`,
      title: `${res}=${reward[res]}`
    });
  }

  if (reward.vipPoints) {
    entries.push({
      type: "vipPoints",
      name: lang["vipPoints_name"] ?? "VIP points",
      amount: Number(reward.vipPoints),
      imageUrl: "../../img_base/vipPoints.png",
      title: `vipPoints=${reward.vipPoints}`
    });
  }

  if (reward.vipTime) {
    const totalSeconds = Number(reward.vipTime);

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    let label = [];
    if (days) label.push(`${days}d`);
    if (hours) label.push(`${hours}h`);
    if (minutes || label.length === 0) label.push(`${minutes}m`);

    entries.push({
      type: "vipTime",
      name: lang["vipTime_name"] ?? "VIP time",
      amount: label.join(" "),
      imageUrl: "../../img_base/vipTime.png",
      title: `vipTime=${reward.vipTime}`
    });
  }

  if (reward.relicEquipments) {
    entries.push({
      type: "relic",
      name: lang["relic_equipment"] || "Relic",
      amount: 1,
      imageUrl: "../../img_base/relic.png",
      title: `relicEquipments=${reward.relicEquipments}`
    });
  }

  if (reward.gemIDs) {
    const gemImageUrl = getGemImageUrlByRewardValue(reward.gemIDs) || "../../img_base/placeholder.webp";
    const isComposedGem = typeof gemImageUrl === "string" &&
      gemImageUrl.startsWith("https://empire-html5.goodgamestudios.com/default/assets/itemassets/") &&
      /\.(webp|png)$/i.test(gemImageUrl);
    entries.push({
      type: "gem",
      name: lang["gem_item"] || "Gem",
      amount: 1,
      imageUrl: gemImageUrl,
      composedSource: isComposedGem ? deriveCompanionUrls(gemImageUrl) : null,
      title: `gemIDs=${reward.gemIDs}`
    });
  }

  if (reward.enchantedEquipmentIDs) {
    entries.push({
      type: "enchantedEquipment",
      name: lang["enchanted_equipment"] || "Enchanted Equipment",
      amount: 1,
      imageUrl: "../../img_base/placeholder.webp",
      title: `enchantedEquipmentIDs=${reward.enchantedEquipmentIDs}`
    });
  }

  return entries;
}

function getRarityLabel(rarity) {
  const key = `dialog_mysteryBoxSystem_boxRarity_${rarity}`;

  if (lang[key]) return lang[key];
  if (lang[key.toLowerCase()]) return lang[key.toLowerCase()];
  if (lang[key.toUpperCase()]) return lang[key.toUpperCase()];

  return "";
}

function createEntryCard({ rewards, chance, rarity }) {
  const row = document.createElement("div");
  row.className = `loot-row rarity-${rarity}`;


  const rewardCells = rewards
    .flatMap(r => explodeReward(r))
    .map(e => {
      const composedAttrs = e.composedSource
        ? `data-compose-equipment="1" data-image-url="${e.composedSource.imageUrl}" data-json-url="${e.composedSource.jsonUrl}" data-js-url="${e.composedSource.jsUrl}"`
        : "";
      const core = `
        <div class="loot-reward" title="${e.title ?? ""}">
          ${e.imageUrl ? `<img src="${e.imageUrl}" ${composedAttrs}>` : ""}
          <div class="loot-amount">
            <span>${e.amount}</span>
          </div>
        </div>
      `;

      if (e.id && e.type === "decoration") {
        return `
          <a class="id-link" data-id="${e.id}" href="https://generalscamp.github.io/forum/overviews/decorations#${e.id}" target="_blank" rel="noopener">
            ${core}
          </a>
        `;
      }

      if (e.id && e.type === "construction") {
        return `
          <a class="id-link" data-id="${e.id}" href="https://generalscamp.github.io/forum/overviews/building_items#${e.id}" target="_blank" rel="noopener">
            ${core}
          </a>
        `;
      }

      return core;
    })
    .join("");

  row.innerHTML = `
<div class="loot-rarity">
  ${getRarityLabel(rarity)}
</div>


    <div class="loot-chance">
      ${formatPercent(chance)}
    </div>

    <div class="loot-rewards">
      ${rewardCells}
    </div>
  `;

  return row;
}

function createOfferingCard(offering) {
  const currency = currenciesById[offering.currencyId];
  const displayName = getCurrencyDisplayName(currency);
  const imgUrl = getCurrencyImageUrl(currency);

  const imageSection = imgUrl
    ? `<img src="${imgUrl}" alt="${displayName}" class="card-image offering-image" loading="lazy">`
    : `<div class="no-image-text">no image</div>`;

  return `
    <div class="col-md-4 col-sm-6 d-flex flex-column">
      <div class="box flex-fill offering-card" data-tombola-id="${offering.tombolaId}" data-title="${displayName}">
        <div class="box-content">
          <h2 class="ci-title">${displayName}</h2>
          <div class="offering-body">
            <div class="image-wrapper">
              ${imageSection}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

document.addEventListener("click", (e) => {
  const img = e.target.closest(".card-image");
  if (!img) return;

  const card = img.closest(".lootbox-card");
  if (!card) return;

  const lootBoxId = card.getAttribute("data-lootbox-id");
  const box = lootBoxes.find(b => String(b.lootBoxID) === String(lootBoxId));
  if (!box) return;

  openLootBoxModal(box, getSelectedKeyType());
});

document.addEventListener("click", (e) => {
  const card = e.target.closest(".offering-card");
  if (!card) return;

  const tombolaId = card.getAttribute("data-tombola-id");
  const title = card.getAttribute("data-title");

  if (!tombolaId) return;
  openTombolaModal({ title, tombolaId });
});

// --- RENDER ---
function createLootBoxCard(box) {
  const displayName = getLootBoxDisplayName(box);
  const chances = getKeyChancesForLootBox(box);

  const imgUrl = lootBoxImageUrlMap[normalizeName(box.name?.trim())] ?? null;

  const wanted = ["Common", "Rare", "Epic", "Legendary"];

  const chanceMap = {};
  chances.forEach(c => (chanceMap[c.keyType] = c));

  const visibleTypes = wanted.filter((type) => {
    if (type !== "Common") return true;
    const c = chanceMap[type];
    return Boolean(c && c.percent > 0);
  });

  const typesToRender = visibleTypes.length > 0 ? visibleTypes : wanted;

  const keyRowsHtml = typesToRender
    .map((type, idx) => {
      const c = chanceMap[type];

      const icon = c?.iconUrl
        ? `<img src="${c.iconUrl}" alt="${type}" style="height:22px; width:auto;">`
        : "";

      const percent = c ? formatPercent(c.percent) : "0.00%";
      const border = idx < typesToRender.length - 1 ? "border-bottom" : "";

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
      <div class="box flex-fill lootbox-card" data-lootbox-id="${box.lootBoxID}">
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

function renderOfferings(list) {
  const container = document.getElementById("cards");
  container.innerHTML = "";

  if (!list || list.length === 0) {
    container.innerHTML = `<div class="col-12">No offerings</div>`;
    return;
  }

  list.forEach(offering => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = createOfferingCard(offering);
    container.appendChild(wrapper.firstElementChild);
  });
}

function buildOfferingsIndex() {
  offeringsByCharacterId = {};

  const all = [];
  characters.forEach(character => {
    const offerings = buildOfferingsForCharacter(character);
    offeringsByCharacterId[String(character.characterID)] = offerings;
    all.push(...offerings);
  });

  offeringsByCharacterId.all = all;
}

function setupSecondarySelect() {
  const select = document.getElementById("characterSelect");
  if (!select || select.dataset.bound) return;

  select.addEventListener("change", () => {
    renderCurrentView();
  });
  select.dataset.bound = "true";
}

function setupCharacterOptions(select) {
  const previous = select.value || "all";
  select.innerHTML = "";

  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = getUiLabel("dialog_changePassword_show", "Show characters");
  select.appendChild(allOpt);

  characters
    .slice()
    .sort((a, b) => getCharacterDisplayName(a).localeCompare(getCharacterDisplayName(b)))
    .forEach(character => {
      const opt = document.createElement("option");
      opt.value = String(character.characterID);
      opt.textContent = getCharacterDisplayName(character);
      select.appendChild(opt);
    });

  select.value = offeringsByCharacterId[previous] ? previous : "all";
}

function setupKeyTypeOptions(select) {
  const previous = select.value || "Common";
  const options = ["Common", "Rare", "Epic", "Legendary"];

  select.innerHTML = "";
  options.forEach(type => {
    const opt = document.createElement("option");
    opt.value = type;
    opt.textContent = getKeyTypeLabel(type);
    select.appendChild(opt);
  });

  select.value = options.includes(previous) ? previous : "Common";
}

function getSelectedKeyType() {
  const viewSelect = document.getElementById("viewSelect");
  const secondarySelect = document.getElementById("characterSelect");
  if (!viewSelect || !secondarySelect) return "Common";
  if (viewSelect.value !== "mystery_boxes") return "Common";
  return secondarySelect.value || "Common";
}

function setupViewSelect() {
  const viewSelect = document.getElementById("viewSelect");
  if (!viewSelect || viewSelect.dataset.bound) return;

  const mysteryLabel = getUiLabel(
    "dialog_mysteryBoxSystem_mysteryBoxHUB_header",
    "Mystery boxes"
  );
  const offeringsLabel = getUiLabel("offerings_colon", "Offerings");

  const mysteryOpt = viewSelect.querySelector('option[value="mystery_boxes"]');
  const offeringsOpt = viewSelect.querySelector('option[value="offerings"]');
  if (mysteryOpt) mysteryOpt.textContent = mysteryLabel;
  if (offeringsOpt) offeringsOpt.textContent = offeringsLabel;

  viewSelect.addEventListener("change", () => {
    updateHashForView(viewSelect.value);
    renderCurrentView();
  });

  viewSelect.dataset.bound = "true";
}

function getViewFromHash() {
  const hash = window.location.hash.replace("#", "").toLowerCase();
  if (!hash) return null;
  if (hash === "offerings" || hash === "offering") return "offerings";
  if (hash === "boxes" || hash === "box" || hash === "mystery" || hash === "mystery_boxes") {
    return "mystery_boxes";
  }
  return null;
}

function updateHashForView(view) {
  if (view === "offerings") {
    window.location.hash = "offerings";
    return;
  }
  if (view === "mystery_boxes") {
    window.location.hash = "boxes";
  }
}

function renderCurrentView() {
  const viewSelect = document.getElementById("viewSelect");
  const secondarySelect = document.getElementById("characterSelect");
  const secondaryWrap = document.getElementById("characterSelectWrap");

  const view = viewSelect?.value || "mystery_boxes";
  updateHashForView(view);

  if (view === "offerings") {
    if (secondaryWrap) secondaryWrap.style.display = "";
    if (secondarySelect) {
      setupCharacterOptions(secondarySelect);
      secondarySelect.disabled = false;
    }
    const characterId = secondarySelect?.value || "all";
    const list = offeringsByCharacterId[characterId] || offeringsByCharacterId.all || [];
    renderOfferings(list);
    return;
  }

  if (secondaryWrap) secondaryWrap.style.display = "";
  if (secondarySelect) {
    setupKeyTypeOptions(secondarySelect);
    secondarySelect.disabled = false;
  }
  renderLootBoxes(lootBoxes);
}

// --- INIT ---
initAutoHeight({
  contentSelector: "#content",
  subtractSelectors: [".note", ".page-title"],
  extraOffset: 18
});

async function init() {
  try {
    await coreInit({
      loader,
      itemLabel: "loot boxes",
      langCode: currentLanguage,
      normalizeNameFn: normalizeName,

      assets: {
        lootboxes: true,
        currencies: true,
        units: true,
        decorations: true,
        constructions: true,
        looks: true,
        equipmentUniques: true,
        uniqueGems: true
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
        lootBoxesById = {};
        lootBoxes.forEach((box) => {
          lootBoxesById[String(box.lootBoxID)] = box;
        });

        lootBoxKeyTombolas = Array.isArray(data.lootBoxKeyTombolas)
          ? data.lootBoxKeyTombolas
          : [];

        lootBoxImageUrlMap = imageMaps?.lootboxes ?? {};
        currencyImageUrlMap = imageMaps?.currencies ?? {};
        decorationImageUrlMap = imageMaps?.decorations ?? {};
        constructionImageUrlMap = imageMaps?.constructions ?? {};
        lookImageUrlMap = imageMaps?.looks ?? {};
        equipmentUniqueImageUrlMap = imageMaps?.equipmentUniques ?? {};
        uniqueGemImageUrlMap = imageMaps?.uniqueGems ?? {};

        const units = Array.isArray(data.units) ? data.units : [];
        unitsById = {};
        units.forEach(u => {
          unitsById[String(u.wodID)] = u;
        });

        unitImageUrlMap = imageMaps?.units ?? {};

        const buildings = Array.isArray(data.buildings) ? data.buildings : [];
        buildingsById = {};
        buildings.forEach(b => {
          buildingsById[String(b.wodID)] = b;
        });

        const constructionItems = Array.isArray(data.constructionItems)
          ? data.constructionItems
          : [];
        constructionItemsById = {};
        constructionItems.forEach(item => {
          constructionItemsById[String(item.constructionItemID)] = item;
        });

        const equipments = Array.isArray(data.equipments) ? data.equipments : [];
        equipmentsById = {};
        equipments.forEach(item => {
          equipmentsById[String(item.equipmentID)] = item;
        });

        const skins = Array.isArray(data.worldmapskins) ? data.worldmapskins : [];
        lookSkinsById = {};
        skins.forEach(item => {
          lookSkinsById[String(item.skinID)] = item.name || item.Name || "";
        });

        rewardResolver = createRewardResolver(
          () => ({
            lang,
            unitsById,
            currenciesById,
            constructionById: constructionItemsById,
            equipmentById: equipmentsById,
            decorationsById: buildingsById,
            lootBoxesById,
            lookSkinsById,
            currencyImageUrlMap,
            unitImageUrlMap,
            constructionImageUrlMap,
            decorationImageUrlMap,
            equipmentImageUrlMap: lookImageUrlMap,
            equipmentUniqueImageUrlMap,
            lootBoxImageUrlMap
          }),
          {
            includeCurrency2: true,
            includeLootBox: true,
            includeUnitLevel: false,
            rubyImageUrl: "../../img_base/ruby.png"
          }
        );

        const rewards = Array.isArray(data.rewards) ? data.rewards : [];
        rewardsById = {};
        rewards.forEach(r => {
          rewardsById[String(r.rewardID)] = r;
        });

        lootBoxTombolas = Array.isArray(data.lootBoxTombolas)
          ? data.lootBoxTombolas
          : [];

        const currencies = Array.isArray(data.currencies) ? data.currencies : [];
        currenciesById = {};
        currencies.forEach(c => {
          currenciesById[String(c.currencyID)] = c;
        });

        characters = Array.isArray(data.characters) ? data.characters : [];
        buildOfferingsIndex();

        initLanguageSelector({
          currentLanguage,
          lang,
          onSelect: () => location.reload()
        });

        setupViewSelect();
        setupSecondarySelect();

        const hashView = getViewFromHash();
        const viewSelect = document.getElementById("viewSelect");
        if (hashView && viewSelect) {
          viewSelect.value = hashView;
        }

        lootBoxes.sort((a, b) => {
          const la = getLegendaryPercent(a);
          const lb = getLegendaryPercent(b);

          if (lb !== la) return lb - la;
          return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
        });

        renderCurrentView();
      }
    });
  } catch (err) {
    console.error(err);
    loader.error("Something went wrong...", 30);
  }
}

init();
