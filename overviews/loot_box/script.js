import { initAutoHeight } from "../shared/ResizeService.mjs";
import { createLoader } from "../shared/LoadingService.mjs";
import { coreInit } from "../shared/CoreInit.mjs";
import { initLanguageSelector, getInitialLanguage } from "../shared/LanguageService.mjs";

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
let skinsById = {};

let lootBoxImageUrlMap = {};
let currencyImageUrlMap = {};
let decorationImageUrlMap = {};
let constructionImageUrlMap = {};
let lookImageUrlMap = {};

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

function getDecorationImageUrl(decoId) {
  if (!decoId) return null;
  const building = buildingsById[String(decoId)];
  const candidates = [
    building?.type,
    building?.comment2,
    building?.name
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    const key = normalizeName(raw);
    const entry = decorationImageUrlMap[key];
    if (!entry) continue;
    if (typeof entry === "string") return entry;
    if (entry.placedUrl) return entry.placedUrl;
  }

  return null;
}

function getConstructionImageUrl(constructionItemId) {
  if (!constructionItemId) return null;
  const item = constructionItemsById[String(constructionItemId)];
  const candidates = [
    item?.name,
    item?.comment2,
    item?.comment1
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    const key = normalizeName(raw);
    const entry = constructionImageUrlMap[key];
    if (!entry) continue;
    if (typeof entry === "string") return entry;
    if (entry.iconUrl) return entry.iconUrl;
    if (entry.placedUrl) return entry.placedUrl;
  }

  return null;
}

function getLookImageUrl(skinId) {
  if (!skinId) return null;
  const skin = skinsById[String(skinId)];
  const skinName = skin?.name;
  if (!skinName) return null;

  const key = normalizeName(skinName);
  const urls = lookImageUrlMap[key];
  if (!urls) return null;

  const mapObjects = urls.mapObjects || {};
  const movements = urls.movements || {};

  return (
    mapObjects.castleUrl ||
    mapObjects.outpostUrl ||
    mapObjects.metroUrl ||
    mapObjects.capitalUrl ||
    movements.moveNormal ||
    movements.moveBoat ||
    null
  );
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
function getEntryRarity(rewards) {
  const r = rewards.find(x => typeof x.comment2 === "string");
  if (!r) return "common";

  const v = r.comment2.trim().toLowerCase();

  if (v === "common") return "common";
  if (v === "rare") return "rare";
  if (v === "epic") return "epic";
  if (v === "legendary") return "legendary";

  return "common";
}

function openTombolaModal({ title, tombolaId }) {
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

  const totalShares = entries.reduce(
    (sum, e) => sum + Number(e.shares || 0), 0
  );

  const rarityOrder = {
    common: 1,
    rare: 2,
    epic: 3,
    legendary: 4
  };

  const cards = entries
    .map(entry => {
      const rewardIds = String(entry.rewardIDs)
        .split(",")
        .map(x => x.trim())
        .filter(Boolean);

      const rewards = rewardIds
        .map(id => rewardsById[id])
        .filter(Boolean);

      if (rewards.length === 0) return null;

      const chance = totalShares > 0
        ? (Number(entry.shares) / totalShares) * 100
        : 0;

      const rarity = getEntryRarity(rewards);

      return {
        rarity,
        order: rarityOrder[rarity] || 99,
        chance,
        rewards
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return b.chance - a.chance;
    });

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
}

function openLootBoxModal(box) {
  openTombolaModal({
    title: getLootBoxDisplayName(box),
    tombolaId: box.lootBoxTombolaID
  });
}

function explodeReward(reward) {
  const entries = [];

  for (const [key, value] of Object.entries(reward)) {
    if (!key.toLowerCase().startsWith("add")) continue;

    const raw = key.slice(3);

    entries.push({
      type: "currency",
      name: lang[`${raw}_name`] ?? lang[raw] ?? raw,
      amount: Number(value) || 1,
      imageUrl: currencyImageUrlMap[normalizeName(raw)] || null,
      title: key
    });
  }

  if (reward.units) {
    const [unitIdRaw, amountRaw] = String(reward.units).split("+");
    const unitId = String(unitIdRaw);
    const amount = Number(amountRaw) || 1;

    const unit = unitsById[unitId];
    const unitName =
      unit
        ? lang[`${unit.type}_name`.toLowerCase()] || unit.name || unit.type
        : `Unit ${unitId}`;

    const imageKey = unit
      ? normalizeName(`${unit.name}_unit_${unit.type}`)
      : null;

    entries.push({
      type: "unit",
      name: unitName,
      amount,
      imageUrl: imageKey ? unitImageUrlMap[imageKey] || null : null,
      title: `units=${reward.units}`
    });
  }

  const simpleResources = ["food", "wood", "stone"];
  for (const res of simpleResources) {
    if (!reward[res]) continue;

    entries.push({
      type: res,
      name: lang[res] ?? res,
      amount: Number(reward[res]) || 1,
      imageUrl: currencyImageUrlMap[res] || "./placeholder.webp",
      title: `${res}=${reward[res]}`
    });
  }

  if (reward.currency2) {
    entries.push({
      type: "rubies",
      name: lang["rubies_name"] ?? lang["rubies"] ?? "Rubies",
      amount: Number(reward.currency2) || 1,
      imageUrl: "./img/ruby.png",
      title: `currency2=${reward.currency2}`
    });
  }

  if (reward.vipPoints) {
    entries.push({
      type: "vipPoints",
      name: lang["vipPoints_name"] ?? "VIP points",
      amount: Number(reward.vipPoints),
      imageUrl: currencyImageUrlMap["vippoints"] || "./placeholder.webp",
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
      imageUrl: currencyImageUrlMap["viptime"] || "./placeholder.webp",
      title: `vipTime=${reward.vipTime}`
    });
  }

  if (reward.relicEquipments) {
    entries.push({
      type: "relic",
      name: lang["relic_equipment"] || "Relic",
      amount: 1,
      imageUrl: "./img/relic.png",
      title: `relicEquipments=${reward.relicEquipments}`
    });
  }

  if (reward.constructionItemIDs) {
    const constructionIds = String(reward.constructionItemIDs)
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);
    const firstId = constructionIds[0];
    const constructionImageUrl = getConstructionImageUrl(firstId);
    entries.push({
      type: "construction",
      name: lang["construction_item"] || "Construction Item",
      amount: 1,
      imageUrl: constructionImageUrl || "./placeholder.webp",
      title: `constructionItemIDs=${reward.constructionItemIDs}`,
      id: firstId || null
    });
  }

  if (reward.equipmentIDs) {
    const equipmentIds = String(reward.equipmentIDs)
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);
    const firstId = equipmentIds[0];
    const equipment = firstId ? equipmentsById[String(firstId)] : null;
    const lookImageUrl = equipment?.skinID ? getLookImageUrl(equipment.skinID) : null;
    entries.push({
      type: "equipment",
      name: lang["equipment_item"] || "Equipment",
      amount: 1,
      imageUrl: lookImageUrl || "./img/equipment.png",
      title: `equipmentIDs=${reward.equipmentIDs}`
    });
  }

  if (reward.gemIDs) {
    entries.push({
      type: "gem",
      name: lang["gem_item"] || "Gem",
      amount: 1,
      imageUrl: "./placeholder.webp",
      title: `gemIDs=${reward.gemIDs}`
    });
  }

  if (reward.decoWodID) {
    const decoImageUrl = getDecorationImageUrl(reward.decoWodID);
    entries.push({
      type: "decoration",
      name: lang["decoration"] || "Decoration",
      amount: 1,
      imageUrl: decoImageUrl,
      title: `decoWodID=${reward.decoWodID}`,
      id: String(reward.decoWodID)
    });
  }

  if (reward.enchantedEquipmentIDs) {
    entries.push({
      type: "enchantedEquipment",
      name: lang["enchanted_equipment"] || "Enchanted Equipment",
      amount: 1,
      imageUrl: "./placeholder.webp",
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
      const core = `
        <div class="loot-reward" title="${e.title ?? ""}">
          ${e.imageUrl ? `<img src="${e.imageUrl}">` : ""}
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

  openLootBoxModal(box);
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

function setupCharacterSelect() {
  const select = document.getElementById("characterSelect");
  if (!select) return;

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

  if (!select.dataset.bound) {
    select.addEventListener("change", () => {
      renderCurrentView();
    });
    select.dataset.bound = "true";
  }
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
  const characterSelect = document.getElementById("characterSelect");

  const view = viewSelect?.value || "mystery_boxes";
  updateHashForView(view);

  if (view === "offerings") {
    if (characterSelect) characterSelect.disabled = false;
    const characterId = characterSelect?.value || "all";
    const list = offeringsByCharacterId[characterId] || offeringsByCharacterId.all || [];
    renderOfferings(list);
    return;
  }

  if (characterSelect) characterSelect.disabled = true;
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
        looks: true
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
        decorationImageUrlMap = imageMaps?.decorations ?? {};
        constructionImageUrlMap = imageMaps?.constructions ?? {};
        lookImageUrlMap = imageMaps?.looks ?? {};

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
        skinsById = {};
        skins.forEach(item => {
          skinsById[String(item.skinID)] = item;
        });

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
        setupCharacterSelect();

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
