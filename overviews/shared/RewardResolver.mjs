export function normalizeName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getArray(data, names) {
  for (const name of names) {
    if (Array.isArray(data?.[name])) return data[name];

    if (data && typeof data === "object") {
      const actualKey = Object.keys(data).find(
        (key) => String(key).toLowerCase() === String(name).toLowerCase()
      );

      if (actualKey && Array.isArray(data[actualKey])) {
        return data[actualKey];
      }
    }
  }
  return [];
}

export function getProp(obj, names) {
  for (const name of names) {
    if (obj?.[name] !== undefined && obj?.[name] !== null) return obj[name];

    if (obj && typeof obj === "object") {
      const actualKey = Object.keys(obj).find(
        (key) => String(key).toLowerCase() === String(name).toLowerCase()
      );

      if (actualKey && obj[actualKey] !== undefined && obj[actualKey] !== null) {
        return obj[actualKey];
      }
    }
  }
  return null;
}

export function buildLookup(array, idKey) {
  const map = {};
  (array || []).forEach((item) => {
    if (!item) return;
    const id = item[idKey];
    if (id !== undefined && id !== null) map[String(id)] = item;
  });
  return map;
}

export function parseCsvIds(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function parseIdAmountToken(token) {
  const trimmed = String(token || "").trim();
  if (!trimmed) return [];

  const parts = trimmed.split("#");
  const primary = parts[0];
  const results = [];
  const [idPart, amountPart] = primary.split("+");
  const primaryId = Number(idPart);
  if (!Number.isNaN(primaryId)) {
    let amount = 1;
    if (amountPart) {
      const parsed = Number(amountPart);
      if (!Number.isNaN(parsed)) amount = parsed;
    }
    results.push({ id: primaryId, amount });
  }

  for (let i = 1; i < parts.length; i++) {
    const extraId = Number(parts[i]);
    if (!Number.isNaN(extraId)) results.push({ id: extraId, amount: 1 });
  }

  return results;
}

export function parseUnitReward(value) {
  return parseUnitRewards(value)[0] || {
    unitId: null,
    amount: null,
  };
}

export function parseUnitRewards(value) {
  if (!value) return [];
  return String(value)
    .split(/[#,]/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const [idPart, amountPart] = token.split("+");
      const unitId = Number(idPart);
      const amount = Number(amountPart);
      return {
        unitId: Number.isNaN(unitId) ? null : unitId,
        amount: Number.isNaN(amount) ? null : amount,
      };
    })
    .filter((parsed) => parsed.unitId !== null);
}

export function parseLootBoxReward(value) {
  if (!value) return null;
  const [idPart, amountPart] = String(value).split("+");
  const lootBoxId = String(idPart || "").trim();
  const amount = Number(amountPart);
  return {
    lootBoxId: lootBoxId || null,
    amount: Number.isNaN(amount) ? 1 : amount,
  };
}

export function parseAllianceCoatLayoutReward(value) {
  if (!value) return null;
  const [idPart, durationPart] = String(value).split("+");
  const layoutId = String(idPart || "").trim();
  const duration = Number(durationPart);
  return {
    layoutId: layoutId || null,
    duration: Number.isNaN(duration) ? null : duration,
  };
}

const DECORATION_REWARD_ID_KEYS = [
  "decoWODID",
  "decoWodID",
  "decowodid",
  "buildingWodID",
  "buildingWODID",
  "buildingwodid"
];

function parseDecorationRewardIds(reward) {
  const value = getProp(reward, DECORATION_REWARD_ID_KEYS);
  if (!value) return [];
  return parseCsvIds(value).flatMap((token) => parseIdAmountToken(token));
}

function getUnitImageLookupKeys(rawName, rawType) {
  const names = [rawName].filter(Boolean);
  if (normalizeName(rawName) === "eventtool") {
    names.push("Elitetool");
  }

  const types = [rawType].filter(Boolean);
  const typeWithoutTier = rawType ? String(rawType).replace(/\d+$/, "") : "";
  if (typeWithoutTier && typeWithoutTier !== rawType) {
    types.push(typeWithoutTier);
  }

  const keys = [];
  names.forEach((name) => {
    types.forEach((type) => {
      keys.push(normalizeName(`${name}_unit_${type}`));
      keys.push(normalizeName(`${type}_unit_${name}`));
    });
  });
  return [...new Set(keys.filter(Boolean))];
}

function formatDurationCompact(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return null;
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 && days === 0) parts.push(`${mins}m`);
  return parts.length > 0 ? parts.join(" ") : "0m";
}

function getAllianceLayoutName(lang, layoutId, layout, duration) {
  const suffix = formatDurationCompact(duration);
  const langKey = layoutId ? `alliancecoat_layout_name_${layoutId}`.toLowerCase() : null;
  const localized = langKey && lang?.[langKey] ? lang[langKey] : null;
  const comment = String(layout?.comment1 || "").trim();
  const base = localized || comment || `Alliance layout ${layoutId || "?"}`;
  return suffix ? `${base} (${suffix})` : base;
}

function getLangByPrefixes(lang, rawName, prefixes) {
  if (!rawName) return null;
  const lowerName = String(rawName).toLowerCase();
  for (const prefix of prefixes) {
    const key = `${prefix}${lowerName}`.toLowerCase();
    if (lang?.[key]) return lang[key];
  }
  return null;
}

function getCIName(lang, item) {
  if (!item) return null;
  const rawName = String(item.name || "???").toLowerCase();
  const prefixes = ["appearance", "primary", "secondary"];
  const suffixes = ["", "_premium"];

  for (const prefix of prefixes) {
    for (const suffix of suffixes) {
      const key = `ci_${prefix}_${rawName}${suffix}`.toLowerCase();
      if (lang?.[key]) return lang[key];
    }
  }

  for (const key of [...suffixes.map((s) => `ci_${rawName}${s}`), rawName]) {
    const lower = key.toLowerCase();
    if (lang?.[lower]) return lang[lower];
  }

  return item.name || null;
}

function getDecorationName(lang, item) {
  if (!item) return null;
  const rawType = item.type || item.Type;
  const lowerType = rawType ? String(rawType).toLowerCase() : "";
  if (lowerType) {
    const key = `deco_${lowerType}_name`;
    if (lang?.[key]) return lang[key];
  }
  const rawName = item.name || item.Name;
  return getLangByPrefixes(lang, rawName, [
    "decoration_name_",
    "deco_name_",
    "decoration_",
  ]) || rawName || null;
}

function getLootBoxDisplayName(lang, lootBox) {
  if (!lootBox) return "Loot box";
  const key = `mysterybox_boxname_${lootBox.name}_${lootBox.rarity}`.toLowerCase();
  return lang?.[key] || lootBox.name || "Loot box";
}

function getUnitDisplayName(lang, unit, includeLevel) {
  if (!unit) return "Unit";
  const rawType = unit.type || unit.name || unit.Name || "";
  let baseName = rawType || "Unit";
  if (rawType) {
    const langKey = `${rawType}_name`.toLowerCase();
    if (lang?.[langKey]) baseName = lang[langKey];
  }

  if (!includeLevel) return baseName;
  const levelRaw = getProp(unit, ["level", "Level", "lvl", "Lvl"]);
  if (levelRaw === undefined || levelRaw === null || String(levelRaw).trim() === "") {
    return baseName;
  }
  return `${baseName} (lvl.${levelRaw})`;
}

function isGenericEquipmentName(value) {
  const normalized = normalizeName(value);
  return (
    !normalized ||
    normalized === "equipment" ||
    normalized === "commander" ||
    normalized === "general" ||
    normalized === "baron" ||
    normalized === "castellan" ||
    normalized.includes("placeholder")
  );
}

function getEquipmentDisplayName(lang, item, id) {
  const equipmentId = String(id || item?.equipmentID || "").trim();
  const langKey = equipmentId ? `equipment_unique_${equipmentId}`.toLowerCase() : null;
  if (langKey && lang?.[langKey]) return lang[langKey];

  const areSetName = String(item?.comment1 || "").match(/^9 piece ARE set\s*-?\s*(.+?)\s+\d+$/i);
  if (areSetName?.[1]) {
    const slot = String(item?.slotID || "").trim();
    const slotName =
      slot === "6"
        ? "Commander"
        : "";
    return [areSetName[1].trim(), slotName].filter(Boolean).join(" ");
  }

  const candidates = [
    item?.comment2,
    item?.comment1,
    item?.name,
    item?.Name
  ];

  const specific = candidates.find((value) => !isGenericEquipmentName(value));
  return specific || (equipmentId ? `Equipment ${equipmentId}` : "Equipment");
}

export function createRewardResolver(getContext, options = {}) {
  const opts = {
    includeCurrency2: true,
    includeLootBox: true,
    includeUnitLevel: false,
    rubyImageUrl: null,
    ...options,
  };

  const ctx = () => getContext() || {};

  const api = {};

  api.resolveRewardName = (reward) => {
    if (!reward) return null;
    const c = ctx();
    const lang = c.lang || {};

    if (reward.allianceCoatLayout) {
      const parsed = parseAllianceCoatLayoutReward(reward.allianceCoatLayout);
      const layout = parsed?.layoutId ? c.allianceCoatLayoutsById?.[String(parsed.layoutId)] : null;
      return getAllianceLayoutName(lang, parsed?.layoutId, layout, parsed?.duration);
    }

    if (opts.includeCurrency2 && reward.currency2 !== undefined && reward.currency2 !== null) {
      return lang.rubies_name || lang.rubies || "Rubies";
    }

    if (opts.includeLootBox && reward.lootBox) {
      const parsed = parseLootBoxReward(reward.lootBox);
      const box = parsed?.lootBoxId ? c.lootBoxesById?.[String(parsed.lootBoxId)] : null;
      return getLootBoxDisplayName(lang, box);
    }

    if (reward.units) {
      const parsed = parseUnitReward(reward.units);
      if (parsed?.unitId !== null) {
        const unit = c.unitsById?.[String(parsed.unitId)];
        return getUnitDisplayName(lang, unit, opts.includeUnitLevel);
      }
    }

    const addKeys = Object.keys(reward).filter((k) => k.toLowerCase().startsWith("add"));
    if (addKeys.length > 0) {
      const rawName = addKeys[0].slice(3);
      if (rawName) {
        const key = `currency_name_${rawName}`.toLowerCase();
        if (lang[key]) return lang[key];
      }
    }

    const currencyId = getProp(reward, ["currencyID", "currencyId", "currencyid"]);
    if (currencyId) {
      const currency = c.currenciesById?.[String(currencyId)];
      if (currency) {
        const rawName = currency.Name || currency.name;
        const key = rawName ? `currency_name_${rawName}`.toLowerCase() : null;
        if (key && lang[key]) return lang[key];
        if (rawName) return rawName;
      }
      return "Currency";
    }

    const constructionId = getProp(reward, ["constructionItemID", "constructionItemId", "constructionitemid"]);
    const constructionIds = getProp(reward, ["constructionItemIDs", "constructionItemIds", "constructionitemids"]);
    if (constructionId) {
      const item = c.constructionById?.[String(constructionId)];
      return getCIName(lang, item) || "Construction item";
    }
    if (constructionIds) {
      const ids = parseCsvIds(constructionIds);
      const item = ids[0] ? c.constructionById?.[String(ids[0])] : null;
      return ids[0] ? getCIName(lang, item) || "Construction item" : null;
    }

    const equipmentId = getProp(reward, ["equipmentID", "equipmentId", "equipmentid"]);
    const equipmentIds = getProp(reward, ["equipmentIDs", "equipmentIds", "equipmentids"]);
    if (equipmentId) {
      const item = c.equipmentById?.[String(equipmentId)];
      return getEquipmentDisplayName(lang, item, equipmentId);
    }
    if (equipmentIds) {
      const ids = parseCsvIds(equipmentIds);
      const firstId = ids[0];
      const parsed = firstId ? parseIdAmountToken(firstId)[0] : null;
      const id = parsed?.id ?? firstId;
      const item = id != null ? c.equipmentById?.[String(id)] : null;
      return id != null ? getEquipmentDisplayName(lang, item, id) : null;
    }

    const decoIds = parseDecorationRewardIds(reward);
    const decoId = decoIds[0]?.id;
    if (decoId !== undefined && decoId !== null) {
      const item = c.decorationsById?.[String(decoId)];
      return getDecorationName(lang, item) || "Decoration";
    }

    return null;
  };

  api.resolveRewardId = (reward, fallbackId = null) => {
    if (!reward || typeof reward !== "object") return fallbackId;
    if (reward.allianceCoatLayout) {
      const parsed = parseAllianceCoatLayoutReward(reward.allianceCoatLayout);
      if (parsed?.layoutId) return parsed.layoutId;
    }
    if (opts.includeCurrency2 && reward.currency2 !== undefined && reward.currency2 !== null) return "currency2";
    if (opts.includeLootBox && reward.lootBox) {
      const parsed = parseLootBoxReward(reward.lootBox);
      if (parsed?.lootBoxId) return parsed.lootBoxId;
    }
    if (reward.units) {
      const parsed = parseUnitReward(reward.units);
      if (parsed?.unitId !== null) return parsed.unitId;
    }
    const currencyId = getProp(reward, ["currencyID", "currencyId", "currencyid"]);
    if (currencyId) return currencyId;
    const constructionId = getProp(reward, ["constructionItemID", "constructionItemId", "constructionitemid"]);
    if (constructionId) return constructionId;
    const constructionIds = getProp(reward, ["constructionItemIDs", "constructionItemIds", "constructionitemids"]);
    if (constructionIds) {
      const ids = parseCsvIds(constructionIds);
      if (ids.length > 0) return ids[0];
    }
    const equipmentId = getProp(reward, ["equipmentID", "equipmentId", "equipmentid"]);
    if (equipmentId) return equipmentId;
    const equipmentIds = getProp(reward, ["equipmentIDs", "equipmentIds", "equipmentids"]);
    if (equipmentIds) {
      const ids = parseCsvIds(equipmentIds);
      if (ids.length > 0) return ids[0];
    }
    const decoIds = parseDecorationRewardIds(reward);
    if (decoIds.length > 0) return decoIds[0].id;
    return fallbackId;
  };

  api.resolveRewardIdStrict = (reward) => api.resolveRewardId(reward, null);

  api.resolveRewardType = (reward) => {
    if (!reward || typeof reward !== "object") return null;
    if (reward.allianceCoatLayout) return "alliance_layout";
    if (opts.includeCurrency2 && reward.currency2 !== undefined && reward.currency2 !== null) return "currency";
    if (opts.includeLootBox && reward.lootBox) return "lootbox";
    if (reward.units) return "unit";
    if (getProp(reward, ["currencyID", "currencyId", "currencyid"])) return "currency";
    const constructionId = getProp(reward, ["constructionItemID", "constructionItemId", "constructionitemid"]);
    const constructionIds = getProp(reward, ["constructionItemIDs", "constructionItemIds", "constructionitemids"]);
    if (constructionId || constructionIds) return "construction";
    const equipmentId = getProp(reward, ["equipmentID", "equipmentId", "equipmentid"]);
    const equipmentIds = getProp(reward, ["equipmentIDs", "equipmentIds", "equipmentids"]);
    if (equipmentId || equipmentIds) return "equipment";
    if (parseDecorationRewardIds(reward).length > 0) return "decoration";
    return null;
  };

  api.resolveRewardEntries = (reward) => {
    if (!reward || typeof reward !== "object") return [];
    const c = ctx();
    const lang = c.lang || {};
    const entries = [];

    if (reward.allianceCoatLayout) {
      const parsed = parseAllianceCoatLayoutReward(reward.allianceCoatLayout);
      const layout = parsed?.layoutId ? c.allianceCoatLayoutsById?.[String(parsed.layoutId)] : null;
      entries.push({
        name: getAllianceLayoutName(lang, parsed?.layoutId, layout, parsed?.duration),
        amount: 1,
        id: parsed?.layoutId || null,
        type: "alliance_layout",
      });
    }

    if (opts.includeCurrency2 && reward.currency2 !== undefined && reward.currency2 !== null) {
      const amount = Number(reward.currency2);
      entries.push({
        name: lang.rubies_name || lang.rubies || "Rubies",
        amount: Number.isNaN(amount) ? 1 : amount,
        id: "currency2",
        type: "currency",
        addKeyName: "rubies",
      });
    }

    if (opts.includeLootBox && reward.lootBox) {
      const parsed = parseLootBoxReward(reward.lootBox);
      const box = parsed?.lootBoxId ? c.lootBoxesById?.[String(parsed.lootBoxId)] : null;
      entries.push({
        name: getLootBoxDisplayName(lang, box),
        amount: parsed?.amount ?? 1,
        id: parsed?.lootBoxId || null,
        type: "lootbox",
      });
    }

    if (reward.units) {
      parseUnitRewards(reward.units).forEach((parsed) => {
        const unit = c.unitsById?.[String(parsed.unitId)];
        entries.push({
          name: getUnitDisplayName(lang, unit, opts.includeUnitLevel),
          amount: parsed.amount !== null ? parsed.amount : 1,
          id: parsed.unitId,
          type: "unit",
        });
      });
    }

    const addKeys = Object.keys(reward).filter((k) => k.toLowerCase().startsWith("add"));
    addKeys.forEach((addKey) => {
      const rawName = addKey.slice(3);
      if (!rawName) return;
      const key = `currency_name_${rawName}`.toLowerCase();
      const val = Number(reward[addKey]);
      entries.push({
        name: lang[key] || rawName,
        amount: Number.isNaN(val) ? 1 : val,
        id: null,
        type: "currency",
        addKeyName: rawName,
      });
    });

    const currencyId = getProp(reward, ["currencyID", "currencyId", "currencyid"]);
    if (currencyId) {
      const currency = c.currenciesById?.[String(currencyId)];
      const rawName = currency ? currency.Name || currency.name : null;
      const key = rawName ? `currency_name_${rawName}`.toLowerCase() : null;
      entries.push({ name: key && lang[key] ? lang[key] : rawName || "Currency", amount: 1, id: currencyId, type: "currency" });
    }

    const constructionId = getProp(reward, ["constructionItemID", "constructionItemId", "constructionitemid"]);
    if (constructionId) {
      const item = c.constructionById?.[String(constructionId)];
      entries.push({ name: getCIName(lang, item) || "Construction item", amount: 1, id: constructionId, type: "construction" });
    }

    const constructionIds = getProp(reward, ["constructionItemIDs", "constructionItemIds", "constructionitemids"]);
    if (constructionIds) {
      parseCsvIds(constructionIds).forEach((token) => {
        parseIdAmountToken(token).forEach((parsed) => {
          const item = c.constructionById?.[String(parsed.id)];
          entries.push({ name: getCIName(lang, item) || "Construction item", amount: parsed.amount, id: parsed.id, type: "construction" });
        });
      });
    }

    const equipmentId = getProp(reward, ["equipmentID", "equipmentId", "equipmentid"]);
    if (equipmentId) {
      const item = c.equipmentById?.[String(equipmentId)];
      entries.push({
        name: getEquipmentDisplayName(lang, item, equipmentId),
        amount: 1,
        id: equipmentId,
        type: "equipment",
      });
    }

    const equipmentIds = getProp(reward, ["equipmentIDs", "equipmentIds", "equipmentids"]);
    if (equipmentIds) {
      parseCsvIds(equipmentIds).forEach((token) => {
        parseIdAmountToken(token).forEach((parsed) => {
          const item = c.equipmentById?.[String(parsed.id)];
          entries.push({
            name: getEquipmentDisplayName(lang, item, parsed.id),
            amount: parsed.amount,
            id: parsed.id,
            type: "equipment"
          });
        });
      });
    }

    parseDecorationRewardIds(reward).forEach((parsed) => {
      const item = c.decorationsById?.[String(parsed.id)];
      entries.push({
        name: getDecorationName(lang, item) || "Decoration",
        amount: parsed.amount,
        id: parsed.id,
        type: "decoration"
      });
    });

    return entries;
  };

  api.getRewardAmount = (reward) => {
    if (!reward || typeof reward !== "object") return 1;
    if (reward.allianceCoatLayout) return 1;
    if (opts.includeLootBox && reward.lootBox) {
      const parsed = parseLootBoxReward(reward.lootBox);
      return parsed?.amount ?? 1;
    }
    if (opts.includeCurrency2 && reward.currency2 !== undefined && reward.currency2 !== null) {
      const amount = Number(reward.currency2);
      return Number.isNaN(amount) ? 1 : amount;
    }
    if (reward.units) {
      const parsed = parseUnitReward(reward.units);
      if (parsed?.amount !== null) return parsed.amount;
    }
    for (const key of Object.keys(reward)) {
      if (key.toLowerCase().includes("add")) {
        const val = Number(reward[key]);
        return Number.isNaN(val) ? 1 : val;
      }
    }
    return 1;
  };

  api.getAddKeyName = (reward) => {
    if (!reward || typeof reward !== "object") return null;
    if (reward.allianceCoatLayout) return null;
    if (opts.includeCurrency2 && reward.currency2 !== undefined && reward.currency2 !== null) return "rubies";
    const addKey = Object.keys(reward).find((key) => key.toLowerCase().startsWith("add"));
    return addKey ? addKey.slice(3) : null;
  };

  api.getDecorationImageUrl = (reward) => {
    if (!reward || reward.type !== "decoration") return null;
    const c = ctx();
    const decoId = reward.id != null ? reward.id : api.resolveRewardIdStrict(reward);
    if (!decoId) return null;
    const item = c.decorationsById?.[String(decoId)];
    const key = normalizeName(item ? item.type || item.Type : "");
    const urls = key ? c.decorationImageUrlMap?.[key] : null;
    return urls?.placedUrl || urls?.iconUrl || null;
  };

  api.getConstructionImageUrl = (reward) => {
    if (!reward || reward.type !== "construction") return null;
    const c = ctx();
    const consId = reward.id != null ? reward.id : api.resolveRewardIdStrict(reward);
    if (!consId) return null;
    const item = c.constructionById?.[String(consId)];
    const candidates = [item?.name, item?.Name, item?.comment2, item?.comment1];
    for (const raw of candidates) {
      if (!raw) continue;
      const key = normalizeName(raw);
      const entry = c.constructionImageUrlMap?.[key];
      if (!entry) continue;
      if (typeof entry === "string") return entry;
      if (entry.iconUrl) return entry.iconUrl;
      if (entry.placedUrl) return entry.placedUrl;
    }
    return null;
  };

  api.getEquipmentImageUrl = (reward) => {
    if (!reward || reward.type !== "equipment") return null;
    const c = ctx();
    const equipId = reward.id != null ? reward.id : api.resolveRewardIdStrict(reward);
    if (!equipId) return null;
    const item = c.equipmentById?.[String(equipId)];
    const skinId = item ? item.skinID || item.skinId : null;
    const skinName = skinId ? c.lookSkinsById?.[String(skinId)] : null;
    const rawName = skinName || (item ? item.skinName || item.name || item.Name : "");
    const key = normalizeName(rawName);
    const urls = key ? c.equipmentImageUrlMap?.[key] : null;
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
  };

  const originalGetEquipmentImageUrl = api.getEquipmentImageUrl;
  api.getEquipmentImageUrl = (reward) => {
    const bySkin = originalGetEquipmentImageUrl(reward);
    if (bySkin) return bySkin;

    const c = ctx();
    const equipId = reward?.id != null ? String(reward.id) : String(api.resolveRewardIdStrict(reward) || "");
    if (!equipId) return null;

    return c.equipmentUniqueImageUrlMap?.[equipId] || null;
  };

  api.getUnitImageUrl = (reward) => {
    if (!reward || reward.type !== "unit") return null;
    const c = ctx();
    const unitId = reward.id != null ? reward.id : api.resolveRewardIdStrict(reward);
    if (!unitId) return null;
    const unit = c.unitsById?.[String(unitId)];
    const rawName = unit ? unit.name || unit.Name : "";
    const rawType = unit ? unit.type || unit.Type : "";
    if (!rawName || !rawType) return null;
    for (const key of getUnitImageLookupKeys(rawName, rawType)) {
      if (c.unitImageUrlMap?.[key]) return c.unitImageUrlMap[key];
    }
    return null;
  };

  api.getCurrencyImageUrl = (reward) => {
    if (!reward || typeof reward !== "object") return null;
    const c = ctx();
    const rawName = reward.addKeyName || api.getAddKeyName(reward);
    if (!rawName) return null;
    if (
      opts.rubyImageUrl &&
      ["rubies", "ruby", "currency2", "c2"].includes(String(rawName).toLowerCase())
    ) {
      return opts.rubyImageUrl;
    }
    const key = normalizeName(rawName);
    return key ? c.currencyImageUrlMap?.[key] || null : null;
  };

  api.getLootBoxImageUrl = (reward) => {
    if (!opts.includeLootBox || !reward || reward.type !== "lootbox") return null;
    const c = ctx();
    const lootBoxId = reward.id != null ? String(reward.id) : null;
    if (!lootBoxId) return null;
    const box = c.lootBoxesById?.[lootBoxId];
    if (!box) return null;
    const key = normalizeName(String(box.name || "").trim());
    return c.lootBoxImageUrlMap?.[key] || null;
  };

  api.getAllianceLayoutImageUrl = (reward) => {
    if (!reward || reward.type !== "alliance_layout") return null;
    const c = ctx();
    const layoutId = reward.id != null ? String(reward.id) : null;
    if (!layoutId) return null;
    return c.allianceLayoutImageUrlMap?.[layoutId] || null;
  };

  return api;
}
