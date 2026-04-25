import { initAutoHeight } from "../shared/ResizeService.mjs";
import { createLoader } from "../shared/LoadingService.mjs";
import { coreInit } from "../shared/CoreInit.mjs";
import { initLanguageSelector, getInitialLanguage } from "../shared/LanguageService.mjs";
import { getSharedText } from "../shared/SharedTextService.mjs";
import { createLazyList } from "../shared/LazyList.mjs";
import { deriveCompanionUrls } from "../shared/AssetComposer.mjs";
import { hydrateComposedImages } from "../shared/ComposeHydrator.mjs";
import {
  normalizeName,
  getArray,
  buildLookup,
  parseCsvIds,
  parseIdAmountToken,
  parseLootBoxReward
} from "../shared/RewardResolver.mjs";

let lang = {};
let ownLang = {};
let offers = [];
let filteredOffers = [];
let currenciesById = {};
let currenciesByName = {};
let unitsById = {};
let buildingsById = {};
let constructionById = {};
let equipmentById = {};
let gemsById = {};
let lootBoxesById = {};
let rewardBagsById = {};
let lookSkinsById = {};
let currencyImageUrlMap = {};
let unitImageUrlMap = {};
let buildingImageUrlMap = {};
let decorationImageUrlMap = {};
let constructionImageUrlMap = {};
let equipmentUniqueImageUrlMap = {};
let uniqueGemImageUrlMap = {};
let lootBoxImageUrlMap = {};
let noRewardsMessage = "No Master Blacksmith offers for this selection.";
let currentLanguage = getInitialLanguage();

const loader = createLoader();
const composedImageCache = new Map();
const SHOP_CATEGORY_EXTRA = {
  "119": {
    costField: "packagePriceC2",
    currencyName: "Rubies",
    currencyImageUrl: "../../img_base/ruby.png",
    sortOrder: 119
  },
  "121": {
    costField: "costLegendaryRiftCoin",
    currencyName: "LegendaryRiftCoin",
    sortOrder: 121
  },
  "122": {
    costField: "packagePriceC1",
    currencyName: "Coin",
    currencyImageUrl: "../../img_base/coin.png",
    sortOrder: 122
  }
};

const LOCAL_RESOURCE_IMAGES = {
  wood: "../../img_base/wood.png",
  stone: "../../img_base/stone.png",
  food: "../../img_base/food.png",
  c1: "../../img_base/coin.png",
  coin: "../../img_base/coin.png",
  c2: "../../img_base/ruby.png",
  rubies: "../../img_base/ruby.png",
  vipPoints: "../../img_base/vipPoints.png",
  vipTime: "../../img_base/vipTime.png",
  relic: "../../img_base/relic.png",
  equipment: "../../img_base/equipment.png",
  mead: "../../img_base/meadwastage.png",
  xp: "../../img_base/xpBoost.png"
};

const lazyList = createLazyList({
  containerSelector: "#cards",
  contentSelector: "#content",
  initialBatchSize: 48,
  batchSize: 36,
  revealBuffer: 12,
  emptyHtml: () => `<div class="col-12 filter-empty-message">${escapeHtml(noRewardsMessage)}</div>`,
  onRenderBatch: (items, ctx) => appendOffers(items, ctx)
});

async function loadOwnLang() {
  try {
    const res = await fetch("./ownLang.json");
    const raw = await res.json();
    ownLang = normalizeKeys(raw);
  } catch (err) {
    console.error("ownLang error:", err);
    ownLang = {};
  }
}

function normalizeKeys(obj) {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [String(k).toLowerCase(), normalizeKeys(v)])
    );
  }
  if (Array.isArray(obj)) return obj.map(normalizeKeys);
  return obj;
}

function ui(key, fallback) {
  return ownLang[currentLanguage?.toLowerCase()]?.ui?.[key] || fallback;
}

function gameText(key, fallback) {
  const normalized = String(key || "").toLowerCase();
  return lang[normalized] || fallback;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? "-");
  return number.toLocaleString(currentLanguage || undefined);
}

function getCurrencyLangName(rawName, fallback = null) {
  const name = String(rawName || "").trim();
  if (!name) return fallback || "";
  const key = `currency_name_${name}`.toLowerCase();
  return lang[key] || fallback || name;
}

function getCurrencyByName(rawName) {
  return currenciesByName[normalizeName(rawName)];
}

function getCurrencyImage(rawName, fallback = null) {
  const currency = getCurrencyByName(rawName);
  const key = normalizeName(currency?.assetName || currency?.Name || rawName);
  return (key && currencyImageUrlMap[key]) || fallback || null;
}

function getRelationIds(pkg) {
  return parseCsvIds(pkg?.relationIDs);
}

function buildShopDefinitions(data) {
  const costRelations = getArray(data, ["packageCategoryCostRelations"]);
  const categories = buildLookup(getArray(data, ["packageCategories"]), "categoryID");
  const relations = buildLookup(getArray(data, ["packageCategoryFilterRelations"]), "relationID");
  const definitionsByCategory = {};

  costRelations.forEach((row) => {
    const categoryId = String(row.categoryID || "").trim();
    if (!categoryId) return;

    if (row.currencyID) {
      const currency = currenciesById[String(row.currencyID)];
      const currencyName = currency?.Name || categories[categoryId]?.name || `Currency ${row.currencyID}`;
      definitionsByCategory[categoryId] = {
        categoryId,
        costField: `cost${currencyName}`,
        currencyName,
        currencyLabel: getCurrencyLangName(currencyName),
        currencyImageUrl: getCurrencyImage(currencyName),
        sortOrder: Number(categoryId) || 999
      };
      return;
    }

    if (SHOP_CATEGORY_EXTRA[categoryId]) {
      const extra = SHOP_CATEGORY_EXTRA[categoryId];
      definitionsByCategory[categoryId] = {
        categoryId,
        ...extra,
        currencyLabel: getCurrencyLangName(extra.currencyName, extra.currencyName),
        currencyImageUrl: getCurrencyImage(extra.currencyName, extra.currencyImageUrl)
      };
    }
  });

  Object.entries(SHOP_CATEGORY_EXTRA).forEach(([categoryId, extra]) => {
    if (definitionsByCategory[categoryId]) return;
    definitionsByCategory[categoryId] = {
      categoryId,
      ...extra,
      currencyLabel: getCurrencyLangName(extra.currencyName, extra.currencyName),
      currencyImageUrl: getCurrencyImage(extra.currencyName, extra.currencyImageUrl)
    };
  });

  const definitionsByRelation = {};
  Object.values(relations).forEach((relation) => {
    const categoryId = String(relation.categoryID || "").trim();
    if (!definitionsByCategory[categoryId]) return;
    definitionsByRelation[String(relation.relationID)] = definitionsByCategory[categoryId];
  });

  return {
    definitionsByCategory,
    definitionsByRelation
  };
}

function getShopForPackage(pkg, definitionsByRelation) {
  const relationIds = getRelationIds(pkg);
  for (const relationId of relationIds) {
    const def = definitionsByRelation[relationId];
    if (!def) continue;
    if (pkg[def.costField] !== undefined && pkg[def.costField] !== null && String(pkg[def.costField]).trim() !== "") {
      return def;
    }
  }
  return null;
}

function getCIName(item) {
  if (!item) return null;
  const rawName = String(item.name || "???").toLowerCase();
  const prefixes = ["appearance", "primary", "secondary"];
  const suffixes = ["", "_premium"];

  for (const prefix of prefixes) {
    for (const suffix of suffixes) {
      const key = `ci_${prefix}_${rawName}${suffix}`.toLowerCase();
      if (lang[key]) return lang[key];
    }
  }

  for (const key of [...suffixes.map((s) => `ci_${rawName}${s}`), rawName]) {
    const lower = key.toLowerCase();
    if (lang[lower]) return lang[lower];
  }

  return item.name || item.comment2 || null;
}

function getBuildingName(item) {
  if (!item) return null;
  const type = String(item.type || "").toLowerCase();
  if (type && lang[`deco_${type}_name`]) return lang[`deco_${type}_name`];
  const name = String(item.name || "").trim();
  if (name && lang[`${name}_name`.toLowerCase()]) return lang[`${name}_name`.toLowerCase()];
  return item.comment2 || item.comment1 || item.type || item.name || null;
}

function getEquipmentName(item, id) {
  const key = `equipment_unique_${id}`.toLowerCase();
  return lang[key] || item?.comment2 || item?.comment1 || `Equipment ${id}`;
}

function getGemName(item, id) {
  const key = `gem_unique_${id}`.toLowerCase();
  return lang[key] || item?.comment2 || item?.comment1 || `Gem ${id}`;
}

function getUnitName(item) {
  if (!item) return null;
  const rawType = item.type || item.name || "";
  const key = `${rawType}_name`.toLowerCase();
  return lang[key] || item.comment2 || rawType || null;
}

function getLootBoxName(box) {
  if (!box) return "Loot box";
  const key = `mysterybox_boxname_${box.name}_${box.rarity}`.toLowerCase();
  return lang[key] || box.name || "Loot box";
}

function getRewardBagName(bag, id) {
  if (!bag) return `Reward bag ${id || ""}`.trim();
  const rarityMap = {
    1: "Common",
    2: "Rare",
    3: "Epic",
    4: "Legendary"
  };
  const sizeMap = {
    1: "Small",
    2: "Medium",
    3: "Large",
    4: "Huge"
  };
  const rarity = rarityMap[Number(bag.rareness)] || `Rarity ${bag.rareness || "?"}`;
  const size = sizeMap[Number(bag.size)] || `Size ${bag.size || "?"}`;
  const focus = String(bag.focused || "") === "1" ? "focused" : "unfocused";
  return `${rarity} ${size} ${focus} reward bag`;
}

function getPackageTypeLabel(type) {
  const raw = String(type || "").trim();
  if (!raw) return "Other";
  const map = {
    constructionItem: "Construction item",
    packageBundle: "Bundle",
    relicItem: "Relic equipment",
    relicGem: "Relic gem",
    lootBox: "Loot box",
    minuteSkip: "Time skip"
  };
  return map[raw] || raw.charAt(0).toUpperCase() + raw.slice(1);
}

function parseOptionalNumber(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getLevelRequirement(pkg) {
  return {
    minLevel: parseOptionalNumber(pkg.minLevel),
    maxLevel: parseOptionalNumber(pkg.maxLevel),
    minLegendLevel: parseOptionalNumber(pkg.minLegendLevel),
    maxLegendLevel: parseOptionalNumber(pkg.maxLegendLevel)
  };
}

function getLevelBracket(requirement) {
  const minLevel = requirement.minLevel;
  const maxLevel = requirement.maxLevel;
  const minLegendLevel = requirement.minLegendLevel;
  const maxLegendLevel = requirement.maxLegendLevel;
  const parts = [];
  const levelLabel = gameText("level", ui("level", "Level"));
  const legendLevelLabel = gameText("legendLevel", ui("legend_level", "Legendary level"));

  if (minLevel !== null || maxLevel !== null) {
    if (minLevel !== null && maxLevel !== null) parts.push(`${levelLabel} ${minLevel}-${maxLevel}`);
    else if (minLevel !== null) parts.push(`${levelLabel} ${minLevel}+`);
    else parts.push(`${levelLabel} <=${maxLevel}`);
  }

  if (minLegendLevel !== null || maxLegendLevel !== null) {
    if (minLegendLevel !== null && maxLegendLevel !== null) parts.push(`${legendLevelLabel} ${minLegendLevel}-${maxLegendLevel}`);
    else if (minLegendLevel !== null) parts.push(`${legendLevelLabel} ${minLegendLevel}+`);
    else parts.push(`${legendLevelLabel} <=${maxLegendLevel}`);
  }

  return parts.length ? parts.join(" / ") : ui("level_all", "All levels");
}

function getShopLabel(shop) {
  const shopWord = ui("shop", "shop");
  let currencyLabel = shop.currencyLabel;

  if (shop.categoryId === "119") {
    currencyLabel = ui("ruby", "Ruby");
  } else if (shop.categoryId === "122") {
    currencyLabel = ui("coin", "Coin");
  }

  return `${currencyLabel} ${shopWord}`.trim();
}

function hasLevelRequirement(requirement) {
  return Object.values(requirement).some((value) => value !== null);
}

function getBuildingImage(item) {
  if (!item) return null;
  const exactAssetKey =
    item.name && item.type
      ? normalizeName(`${item.name}_Building_${item.type}`)
      : "";
  const buildingEntry = buildingImageUrlMap[exactAssetKey] ||
    buildingImageUrlMap[normalizeName(item.name)] ||
    buildingImageUrlMap[normalizeName(item.comment1)] ||
    buildingImageUrlMap[normalizeName(item.comment2)];
  if (typeof buildingEntry === "string") return buildingEntry;
  if (buildingEntry?.placedUrl) return buildingEntry.placedUrl;

  const isDecoration =
    /deco|decoration/i.test(String(item.group || "")) ||
    /deco|decoration/i.test(String(item.name || ""));
  if (isDecoration) {
    const byType = decorationImageUrlMap[normalizeName(item.type)]?.placedUrl;
    if (byType) return byType;
  }

  const byName = constructionImageUrlMap[normalizeName(item.name)];
  if (typeof byName === "string") return byName;
  return byName?.placedUrl || byName?.iconUrl || null;
}

function getConstructionImage(item) {
  if (!item) return null;
  const entry = constructionImageUrlMap[normalizeName(item.name)];
  if (typeof entry === "string") return entry;
  return entry?.iconUrl || entry?.placedUrl || null;
}

function getUnitImage(item) {
  if (!item) return null;
  const key = normalizeName(`${item.name || ""}_unit_${item.type || ""}`);
  return unitImageUrlMap[key] || null;
}

function getLootBoxImage(box) {
  if (!box) return null;
  return lootBoxImageUrlMap[normalizeName(box.name)] || null;
}

function firstParsedId(value) {
  const first = parseCsvIds(value)[0];
  return parseIdAmountToken(first)[0] || null;
}

function resolvePrimaryReward(pkg) {
  if (pkg.buildingID) {
    const item = buildingsById[String(pkg.buildingID)];
    return {
      type: "deco",
      id: pkg.buildingID,
      name: getBuildingName(item) || pkg.comment1 || ui("unknown_reward", "Unknown reward"),
      quantity: pkg.buildingAmount || "1",
      imageUrl: getBuildingImage(item)
    };
  }

  if (pkg.constructionItemID) {
    const item = constructionById[String(pkg.constructionItemID)];
    return {
      type: "constructionItem",
      id: pkg.constructionItemID,
      name: getCIName(item) || pkg.comment1 || ui("unknown_reward", "Unknown reward"),
      quantity: pkg.constructionItemAmount || "1",
      imageUrl: getConstructionImage(item)
    };
  }

  if (pkg.unitID) {
    const item = unitsById[String(pkg.unitID)];
    return {
      type: "soldier",
      id: pkg.unitID,
      name: getUnitName(item) || pkg.comment1 || ui("unknown_reward", "Unknown reward"),
      quantity: pkg.unitAmount || "1",
      imageUrl: getUnitImage(item)
    };
  }

  if (pkg.equipmentIDs) {
    const parsed = firstParsedId(pkg.equipmentIDs);
    const id = parsed?.id != null ? String(parsed.id) : parseCsvIds(pkg.equipmentIDs)[0];
    const item = equipmentById[String(id)];
    return {
      type: "item",
      id,
      name: getEquipmentName(item, id),
      quantity: pkg.equipmentAmount || parsed?.amount || "1",
      imageUrl: equipmentUniqueImageUrlMap[String(item?.reuseAssetOfEquipmentID || id)] || "../../img_base/equipment.png"
    };
  }

  if (pkg.gemIDs) {
    const parsed = firstParsedId(pkg.gemIDs);
    const id = parsed?.id != null ? String(parsed.id) : parseCsvIds(pkg.gemIDs)[0];
    const item = gemsById[String(id)];
    return {
      type: "gem",
      id,
      name: getGemName(item, id),
      quantity: pkg.gemAmount || parsed?.amount || "1",
      imageUrl: uniqueGemImageUrlMap[String(item?.reuseAssetOfGemID || id)] || "../../img_base/placeholder.webp"
    };
  }

  if (pkg.lootBox) {
    const parsed = parseLootBoxReward(pkg.lootBox);
    const box = parsed?.lootBoxId ? lootBoxesById[String(parsed.lootBoxId)] : null;
    return {
      type: "lootBox",
      id: parsed?.lootBoxId || null,
      name: getLootBoxName(box),
      quantity: parsed?.amount || "1",
      imageUrl: getLootBoxImage(box)
    };
  }

  if (pkg.packageIDs) {
    const ids = parseCsvIds(pkg.packageIDs);
    return {
      type: "packageBundle",
      id: ids[0] || pkg.packageID,
      name: pkg.comment1 || pkg.comment2 || "Bundle",
      quantity: ids.length || "1",
      imageUrl: "../../img_base/placeholder.webp"
    };
  }

  if (pkg.relicEquipments) {
    return {
      type: "relicItem",
      id: pkg.relicEquipments,
      name: lang.relicequipment_name || lang.relic_equipment || "Relic equipment",
      quantity: "1",
      imageUrl: LOCAL_RESOURCE_IMAGES.relic
    };
  }

  if (pkg.relicGems) {
    return {
      type: "relicGem",
      id: pkg.relicGems,
      name: lang.relicgem_name || "Relic gem",
      quantity: "1",
      imageUrl: "../../img_base/placeholder.webp"
    };
  }

  if (pkg.rewardBags) {
    const parsed = firstParsedId(pkg.rewardBags);
    const bagId = parsed?.id ? String(parsed.id) : String(pkg.rewardBags || "");
    const bag = rewardBagsById[bagId];
    return {
      type: "rewardBag",
      id: bagId,
      name: getRewardBagName(bag, bagId),
      quantity: parsed?.amount || "1",
      imageUrl: "../../img_base/placeholder.webp"
    };
  }

  const addKey = Object.keys(pkg).find((key) => /^add[A-Z0-9]/.test(key));
  if (addKey) {
    const rawName = addKey.slice(3);
    return {
      type: "currency",
      id: rawName,
      name: getCurrencyLangName(rawName, rawName),
      quantity: pkg[addKey],
      imageUrl: getCurrencyImage(rawName)
    };
  }

  const amountKey = Object.keys(pkg).find((key) => /^amount[A-Z0-9]/.test(key));
  if (amountKey) {
    const rawName = amountKey.slice(6);
    const normalized = normalizeName(rawName);
    return {
      type: "resources",
      id: rawName,
      name: lang[normalized] || getCurrencyLangName(rawName, rawName),
      quantity: pkg[amountKey],
      imageUrl: LOCAL_RESOURCE_IMAGES[rawName] || LOCAL_RESOURCE_IMAGES[normalized] || getCurrencyImage(rawName)
    };
  }

  if (pkg.vipTime) {
    return {
      type: "VIP",
      id: "vipTime",
      name: lang.viptime_name || "VIP time",
      quantity: formatDuration(pkg.vipTime),
      imageUrl: LOCAL_RESOURCE_IMAGES.vipTime
    };
  }

  if (pkg.vipPoints) {
    return {
      type: "VIP",
      id: "vipPoints",
      name: lang.vippoints_name || "VIP points",
      quantity: pkg.vipPoints,
      imageUrl: LOCAL_RESOURCE_IMAGES.vipPoints
    };
  }

  return {
    type: pkg.packageType || "unknown",
    id: pkg.packageID,
    name: pkg.comment1 || pkg.comment2 || ui("unknown_reward", "Unknown reward"),
    quantity: "1",
    imageUrl: "../../img_base/placeholder.webp"
  };
}

function formatDuration(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return String(seconds || "0");
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins || parts.length === 0) parts.push(`${mins}m`);
  return parts.join(" ");
}

function buildOffers(data) {
  const { definitionsByRelation } = buildShopDefinitions(data);
  const packages = getArray(data, ["packages"]);

  return packages
    .filter((pkg) => !isTempServerPackage(pkg))
    .filter((pkg) => !isIgnoredPackage(pkg))
    .map((pkg) => {
      const shop = getShopForPackage(pkg, definitionsByRelation);
      if (!shop) return null;
      const reward = resolvePrimaryReward(pkg);
      const levelRequirement = getLevelRequirement(pkg);
      const shopLabel = getShopLabel(shop);
      return {
        packageId: String(pkg.packageID || ""),
        sortOrder: Number(pkg.sortOrder || 0),
        rawSortOrder: String(pkg.sortOrder || ""),
        comment1: pkg.comment1 || "",
        comment2: pkg.comment2 || "",
        cost: pkg[shop.costField],
        costField: shop.costField,
        currencyKey: shop.costField,
        currencyLabel: shopLabel,
        currencySortOrder: Number(shop.sortOrder || 999),
        currencyImageUrl: shop.currencyImageUrl,
        levelRequirement,
        levelBracket: getLevelBracket(levelRequirement),
        stock: pkg.stock || ui("unlimited", "Unlimited"),
        reward
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const currencyDiff = a.currencySortOrder - b.currencySortOrder;
      if (currencyDiff !== 0) return currencyDiff;
      const sortDiff = a.sortOrder - b.sortOrder;
      if (sortDiff !== 0) return sortDiff;
      return Number(a.packageId || 0) - Number(b.packageId || 0);
    });
}

function isTempServerPackage(pkg) {
  const text = `${pkg?.comment1 || ""} ${pkg?.comment2 || ""}`.toLowerCase();
  return text.includes("tempserver") || text.includes("temp server");
}

function isIgnoredPackage(pkg) {
  const text = `${pkg?.comment1 || ""} ${pkg?.comment2 || ""}`.toLowerCase();
  if (text.includes("x-play") || text.includes("xplay")) return true;
  if (/\bold\b/.test(text) || /\bdelete\b/.test(text)) return true;
  if (pkg?.cost1MinSkip !== undefined) return true;
  if (String(pkg?.packageID || "") === "10822") return true;
  return false;
}

function setupSelectOptions() {
  const currencySelect = document.getElementById("currencySelect");
  const levelSelect = document.getElementById("levelSelect");
  if (!currencySelect || !levelSelect) return;

  const currentCurrency = currencySelect.value || "";
  const currentLevel = levelSelect.value || "";

  const currencyOptions = uniqueOptions(offers, "currencyKey", "currencyLabel", "currencySortOrder");
  fillSelect(currencySelect, currencyOptions, currentCurrency);
  setupLevelOptions(currentLevel);
}

function setupLevelOptions(previousValue = "") {
  const currencyValue = document.getElementById("currencySelect")?.value || "";
  const levelSelect = document.getElementById("levelSelect");
  if (!levelSelect) return;

  const source = currencyValue
    ? offers.filter((offer) => offer.currencyKey === currencyValue)
    : offers;
  const levelOptions = buildLevelOptions(source);

  fillSelect(levelSelect, levelOptions, previousValue);
}

function buildLevelOptions(list) {
  const map = new Map();
  list.forEach((offer) => {
    if (!hasLevelRequirement(offer.levelRequirement)) return;
    const value = String(offer.levelBracket || "");
    if (!value || map.has(value)) return;
    map.set(value, {
      value,
      label: value,
      requirement: offer.levelRequirement
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    const levelA = a.requirement.minLevel ?? (a.requirement.minLegendLevel !== null ? 70 : 0);
    const levelB = b.requirement.minLevel ?? (b.requirement.minLegendLevel !== null ? 70 : 0);
    if (levelA !== levelB) return levelB - levelA;

    const legendA = a.requirement.minLegendLevel ?? -1;
    const legendB = b.requirement.minLegendLevel ?? -1;
    if (legendA !== legendB) return legendB - legendA;

    const maxA = a.requirement.maxLevel ?? 9999;
    const maxB = b.requirement.maxLevel ?? 9999;
    if (maxA !== maxB) return maxB - maxA;

    const maxLegendA = a.requirement.maxLegendLevel ?? 9999;
    const maxLegendB = b.requirement.maxLegendLevel ?? 9999;
    if (maxLegendA !== maxLegendB) return maxLegendB - maxLegendA;

    return a.label.localeCompare(b.label);
  });
}

function uniqueOptions(list, valueKey, labelKey, sortKey = null) {
  const map = new Map();
  list.forEach((item) => {
    const value = String(item[valueKey] || "");
    if (!value || map.has(value)) return;
    map.set(value, {
      value,
      label: String(item[labelKey] || value),
      sort: sortKey ? Number(item[sortKey] || 999) : 999
    });
  });
  return Array.from(map.values()).sort((a, b) => {
    if (a.sort !== b.sort) return a.sort - b.sort;
    return a.label.localeCompare(b.label);
  });
}

function fillSelect(select, options, previousValue) {
  select.innerHTML = "";
  options.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.value;
    option.textContent = entry.label;
    select.appendChild(option);
  });
  select.disabled = options.length === 0;
  select.value = options.some((entry) => entry.value === previousValue) ? previousValue : options[0]?.value || "";
}

function applyFilters() {
  const currencyValue = document.getElementById("currencySelect")?.value || "";
  const levelValue = document.getElementById("levelSelect")?.value || "";
  const sourceForLevel = currencyValue
    ? offers.filter((offer) => offer.currencyKey === currencyValue)
    : offers;
  const selectedLevelRequirement =
    levelValue
      ? sourceForLevel.find((offer) => offer.levelBracket === levelValue)?.levelRequirement || null
      : null;

  filteredOffers = offers.filter((offer) => {
    if (currencyValue && offer.currencyKey !== currencyValue) return false;
    if (selectedLevelRequirement && !isOfferAvailableForLevelSelection(offer.levelRequirement, selectedLevelRequirement)) return false;
    return true;
  });

  lazyList.reset(filteredOffers, {
    emptyHtml: () => `<div class="col-12 filter-empty-message">${escapeHtml(noRewardsMessage)}</div>`
  });
}

function isOfferAvailableForLevelSelection(offerRequirement, selectedRequirement) {
  if (!hasLevelRequirement(offerRequirement)) return true;

  const selectedLevel =
    selectedRequirement.minLevel ??
    (selectedRequirement.minLegendLevel !== null ? 70 : null);
  const selectedLegend = selectedRequirement.minLegendLevel;

  if (offerRequirement.minLevel !== null && selectedLevel !== null && selectedLevel < offerRequirement.minLevel) {
    return false;
  }

  if (offerRequirement.maxLevel !== null && selectedLevel !== null && selectedLevel > offerRequirement.maxLevel) {
    return false;
  }

  if (offerRequirement.minLegendLevel !== null) {
    if (selectedLegend === null) return false;
    if (selectedLegend < offerRequirement.minLegendLevel) return false;
  }

  if (offerRequirement.maxLegendLevel !== null) {
    if (selectedLegend === null) return false;
    if (selectedLegend > offerRequirement.maxLegendLevel) return false;
  }

  return true;
}

function setupEventListeners() {
  document.getElementById("currencySelect")?.addEventListener("change", () => {
    setupLevelOptions("");
    applyFilters();
  });
  document.getElementById("levelSelect")?.addEventListener("change", applyFilters);
  document.getElementById("cards")?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const imageTarget = target.closest("[data-offer-debug]");
    if (!imageTarget) return;
    console.log(imageTarget.getAttribute("data-offer-debug"));
  });
}

function appendOffers(items, { container, sentinel }) {
  const fragment = document.createDocumentFragment();
  items.forEach((offer) => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = createOfferCard(offer);
    const card = wrapper.firstElementChild;
    card.classList.add("card-hidden");
    window.setTimeout(() => card.classList.add("card-visible"), 30);
    fragment.appendChild(card);
  });
  container.insertBefore(fragment, sentinel);

  void hydrateComposedImages({
    root: container,
    selector: 'img[data-compose-asset="1"]:not([data-compose-ready])',
    cache: composedImageCache
  });
}

function createOfferCard(offer) {
  const reward = offer.reward;
  const shouldCompose =
    typeof reward.imageUrl === "string" &&
    reward.imageUrl.startsWith("https://empire-html5.goodgamestudios.com/default/assets/itemassets/") &&
    /\.(webp|png)$/i.test(reward.imageUrl);
  const composeSource = shouldCompose ? deriveCompanionUrls(reward.imageUrl) : null;
  const composeAttrs = composeSource
    ? ` data-compose-asset="1" data-image-url="${escapeHtml(composeSource.imageUrl)}" data-json-url="${escapeHtml(composeSource.jsonUrl)}" data-js-url="${escapeHtml(composeSource.jsUrl)}"`
    : "";
  const imageHtml = reward.imageUrl
    ? `<img src="${escapeHtml(reward.imageUrl)}" alt="${escapeHtml(reward.name)}" class="card-image ${reward.type === "currency" ? "currency-image" : ""}" loading="lazy"${composeAttrs}>`
    : `<img src="../../img_base/placeholder.webp" alt="${escapeHtml(reward.name)}" class="card-image" loading="lazy">`;
  const costIcon = offer.currencyImageUrl
    ? `<img src="${escapeHtml(offer.currencyImageUrl)}" alt="" class="cost-image" loading="lazy">`
    : "";
  const debugLabel = `${offer.currencyLabel} #${offer.packageId}`;

  return `
    <div class="col-md-6 col-lg-4 col-sm-12 d-flex flex-column blacksmith-card">
      <div class="box flex-fill">
        <div class="box-content">
          <h2 class="blacksmith-title">${escapeHtml(reward.name)}</h2>
          <hr>
          <div class="card-table blacksmith-table">
            <div class="row g-0">
              <div class="col-4 card-cell blacksmith-image-cell border-end d-flex justify-content-center align-items-center">
                <div class="image-wrapper" data-offer-debug="${escapeHtml(debugLabel)}">${imageHtml}</div>
              </div>
              <div class="col-8 card-cell">
                <div class="row g-0">
                  <div class="col-6 card-cell border-end blacksmith-stat-cell">
                    <strong>${escapeHtml(ui("quantity", "Quantity"))}</strong>
                    <span>${escapeHtml(formatNumber(reward.quantity))}</span>
                  </div>
                  <div class="col-6 card-cell blacksmith-stat-cell">
                    <strong>${escapeHtml(ui("stock", "Stock"))}</strong>
                    <span>${escapeHtml(formatNumber(offer.stock))}</span>
                  </div>
                </div>
                <hr>
                <div class="row g-0">
                  <div class="col-12 card-cell blacksmith-stat-cell">
                    <strong>${escapeHtml(ui("cost", "Cost"))}</strong>
                    <span class="cost-value">${costIcon}<span>x${formatNumber(offer.cost)}</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

initAutoHeight({
  contentSelector: "#content",
  subtractSelectors: [".note", ".page-title"],
  extraOffset: 18
});

async function init() {
  try {
    await coreInit({
      loader,
      itemLabel: "master blacksmith offers",
      langCode: currentLanguage,
      normalizeNameFn: normalizeName,
      assets: {
        currencies: true,
        units: true,
        buildings: true,
        decorations: true,
        constructions: true,
        equipmentUniques: true,
        uniqueGems: true,
        lootboxes: true
      },
      onReady: async ({ lang: L, data, imageMaps }) => {
        lang = L;
        currenciesById = buildLookup(getArray(data, ["currencies"]), "currencyID");
        currenciesByName = {};
        Object.values(currenciesById).forEach((currency) => {
          currenciesByName[normalizeName(currency.Name)] = currency;
          currenciesByName[normalizeName(currency.assetName)] = currency;
        });
        unitsById = buildLookup(getArray(data, ["units"]), "wodID");
        buildingsById = buildLookup(getArray(data, ["buildings"]), "wodID");
        constructionById = buildLookup(getArray(data, ["constructionItems"]), "constructionItemID");
        equipmentById = buildLookup(getArray(data, ["equipments"]), "equipmentID");
        gemsById = buildLookup(getArray(data, ["gems"]), "gemID");
        lootBoxesById = buildLookup(getArray(data, ["lootBoxes", "lootboxes"]), "lootBoxID");
        rewardBagsById = buildLookup(getArray(data, ["rewardBags"]), "bagID");
        lookSkinsById = buildLookup(getArray(data, ["worldmapskins"]), "skinID");
        void lookSkinsById;

        currencyImageUrlMap = imageMaps?.currencies || {};
        unitImageUrlMap = imageMaps?.units || {};
        buildingImageUrlMap = imageMaps?.buildings || {};
        decorationImageUrlMap = imageMaps?.decorations || {};
        constructionImageUrlMap = imageMaps?.constructions || {};
        equipmentUniqueImageUrlMap = imageMaps?.equipmentUniques || {};
        uniqueGemImageUrlMap = imageMaps?.uniqueGems || {};
        lootBoxImageUrlMap = imageMaps?.lootboxes || {};

        initLanguageSelector({
          currentLanguage,
          lang,
          onSelect: () => location.reload()
        });

        await loadOwnLang();
        noRewardsMessage = await getSharedText("no_match_filters", currentLanguage, ui("no_rewards", noRewardsMessage));
        offers = buildOffers(data);
        setupSelectOptions();
        setupEventListeners();
        applyFilters();
      }
    });
  } catch (err) {
    console.error(err);
    loader.error("Something went wrong...", 30);
  }
}

init();
