import { initAutoHeight } from "../shared/ResizeService.mjs";
import { createLoader } from "../shared/LoadingService.mjs";
import { coreInit } from "../shared/CoreInit.mjs";
import { initLanguageSelector, getInitialLanguage } from "../shared/LanguageService.mjs";
import { createRewardResolver, getArray, buildLookup } from "../shared/RewardResolver.mjs";
import { revealCard } from "../shared/CardReveal.mjs";
import { initRewardDetailModal, rewardDetailAttrs } from "../shared/RewardDetailModal.mjs";

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
let gemsById = {};
let unitsById = {};
let lootBoxesById = {};
let lookSkinsById = {};
let rewardResolver = null;

let lootBoxImageUrlMap = {};
let currencyImageUrlMap = {};
let decorationImageUrlMap = {};
let constructionImageUrlMap = {};
let lookImageUrlMap = {};
let equipmentUniqueImageUrlMap = {};
let unitImageUrlMap = {};
let uniqueGemImageUrlMap = {};

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

function buildOfferingsForCharacter(character) {
  const rows = parseTombolaString(character?.tombolas);
  return rows.map(row => ({
    characterId: String(character.characterID),
    characterName: getCharacterDisplayName(character),
    currencyId: String(row.currencyId),
    tombolaId: String(row.tombolaId),
  }));
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
      <div class="box flex-fill offering-card" data-tombola-id="${offering.tombolaId}" data-title="${displayName}" ${rewardDetailAttrs({ type: "offering", id: offering.tombolaId, name: displayName, amount: "", imageUrl: imgUrl || "" })}>
        <div class="box-content">
          <h2 class="ci-title">${displayName}</h2>
          <div class="offering-body">
            <div class="image-wrapper offering-image-slot" ${rewardDetailAttrs({ type: "offering", id: offering.tombolaId, name: displayName, amount: "", imageUrl: imgUrl || "" })}>
              ${imageSection}
            </div>
          </div>
          <span class="position-absolute bottom-0 end-0 p-1 rounded-circle m-1 offering-zoom-indicator">
            <i class="bi bi-zoom-in"></i>
          </span>
        </div>
      </div>
    </div>
  `;
}

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
      <div class="col-5 card-cell border-end d-flex justify-content-center align-items-center position-relative lootbox-image-slot">
        <div class="image-wrapper">
          <img src="${imgUrl}" alt="${displayName}" class="card-image w-100" loading="lazy">
        </div>
        <span class="position-absolute bottom-0 end-0 p-1 rounded-circle m-1">
          <i class="bi bi-zoom-in"></i>
        </span>
      </div>
    `
    : `
      <div class="col-5 card-cell border-end d-flex justify-content-center align-items-center position-relative lootbox-image-slot">
        <div class="image-wrapper">
          <div class="no-image-text">no image</div>
        </div>
        <span class="position-absolute bottom-0 end-0 p-1 rounded-circle m-1">
          <i class="bi bi-zoom-in"></i>
        </span>
      </div>
    `;

  return `
    <div class="col-md-6 col-sm-12 d-flex flex-column">
      <div class="box flex-fill lootbox-card" data-lootbox-id="${box.lootBoxID}" ${rewardDetailAttrs({ type: "lootbox", id: box.lootBoxID, name: displayName, amount: "", imageUrl: imgUrl || "" })}>
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
    container.appendChild(revealCard(wrapper.firstElementChild));
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
    container.appendChild(revealCard(wrapper.firstElementChild));
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

  const mysteryLabel = getUiLabel("dialog_mysteryBoxSystem_mysteryBoxHUB_header", "Mystery boxes");
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
        effectCtx
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
        gemsById = {};
        getArray(data, ["gems"]).forEach(item => {
          gemsById[String(item.gemID)] = item;
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
            gemsById,
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
            includeUnitLevel: true,
            rubyImageUrl: "../../img_base/ruby.png"
          }
        );
        initRewardDetailModal({
          getContext: () => ({
            lang,
            rewardResolver,
            currenciesById,
            equipmentById: equipmentsById,
            gemsById,
            constructionById: constructionItemsById,
            decorationsById: buildingsById,
            buildingsById,
            buildings,
            unitsById,
            effectsById: effectCtx?.effectDefinitions || {},
            effectCapsMap: effectCtx?.effectCapsMap || {},
            percentEffectIDs: effectCtx?.percentEffectIDs || new Set(),
            lootBoxesById,
            rewardsById,
            lootBoxTombolas,
            getLootBoxKeyType: getSelectedKeyType,
            unitImageUrlMap,
            currencyImageUrlMap,
            lootBoxImageUrlMap,
            decorationImageUrlMap,
            constructionImageUrlMap,
            equipmentImageUrlMap: lookImageUrlMap,
            equipmentUniqueImageUrlMap,
            uniqueGemImageUrlMap,
            equipmentEffects: getArray(data, ["equipment_effects", "equipmentEffects"]),
            equipmentSlotsById: buildLookup(getArray(data, ["equipment_slots", "equipmentSlots"]), "slotID"),
            currentLanguage
          })
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
