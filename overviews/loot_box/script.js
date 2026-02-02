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

function openLootBoxModal(box) {
  const modalEl = document.getElementById("lootBoxModal");
  const modalTitle = modalEl.querySelector(".modal-title");
  const container = document.getElementById("lootBoxRewards");

  modalTitle.textContent = getLootBoxDisplayName(box);
  container.innerHTML = "";

  const entries = lootBoxTombolas.filter(
    e => String(e.tombolaID) === String(box.lootBoxTombolaID)
  );

  if (entries.length === 0) {
    container.innerHTML = `<div class="col-12">No rewards</div>`;
    new bootstrap.Modal(modalEl).show();
    return;
  }

  const totalShares = entries.reduce(
    (sum, e) => sum + Number(e.shares || 0), 0
  );

  entries.forEach(entry => {
    const rewardIds = String(entry.rewardIDs)
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);

    const rewards = rewardIds
      .map(id => rewardsById[id])
      .filter(Boolean);

    if (rewards.length === 0) return;

    const chance = totalShares > 0
      ? (Number(entry.shares) / totalShares) * 100
      : 0;

    container.appendChild(
      createEntryCard({
        rewards,
        chance,
        rarity: getEntryRarity(rewards)
      })
    );
  });

  new bootstrap.Modal(modalEl).show();
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
      imageUrl: "./placeholder.webp",
      title: `relicEquipments=${reward.relicEquipments}`
    });
  }

  if (reward.constructionItemIDs) {
    entries.push({
      type: "construction",
      name: lang["construction_item"] || "Construction Item",
      amount: 1,
      imageUrl: "./placeholder.webp",
      title: `constructionItemIDs=${reward.constructionItemIDs}`
    });
  }

  if (reward.equipmentIDs) {
    entries.push({
      type: "equipment",
      name: lang["equipment_item"] || "Equipment",
      amount: 1,
      imageUrl: "./placeholder.webp",
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
    entries.push({
      type: "decoration",
      name: lang["decoration"] || "Decoration",
      amount: 1,
      imageUrl: null,
      title: `decoWodID=${reward.decoWodID}`
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
    .map(e => `
      <div class="loot-reward" title="${e.title ?? ""}">
        ${e.imageUrl ? `<img src="${e.imageUrl}">` : ""}
        <div class="loot-amount">
          <span>${e.amount}</span>
        </div>
      </div>
    `)
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
        units: true
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

        const units = Array.isArray(data.units) ? data.units : [];
        unitsById = {};
        units.forEach(u => {
          unitsById[String(u.wodID)] = u;
        });

        unitImageUrlMap = imageMaps?.units ?? {};

        const rewards = Array.isArray(data.rewards) ? data.rewards : [];
        rewardsById = {};
        rewards.forEach(r => {
          rewardsById[String(r.rewardID)] = r;
        });

        lootBoxTombolas = Array.isArray(data.lootBoxTombolas)
          ? data.lootBoxTombolas
          : [];

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
  } catch (err) {
    console.error(err);
    loader.error("Something went wrong...", 30);
  }
}

init();