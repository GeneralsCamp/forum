import { initCustomModal } from "./ModalService.mjs";
import { getProp, normalizeName, resolveEquipmentName } from "./RewardResolver.mjs";
import { deriveCompanionUrls } from "./AssetComposer.mjs";
import { hydrateComposedImages } from "./ComposeHydrator.mjs";

const RARITY_ORDER = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4
};
const CONSTRUCTION_LEGACY_EFFECT_FIELDS = [
  "unitWallCount",
  "recruitSpeedBoost",
  "woodStorage",
  "stoneStorage",
  "ReduceResearchResourceCosts",
  "Stoneproduction",
  "Woodproduction",
  "Foodproduction",
  "foodStorage",
  "unboostedFoodProduction",
  "defensiveToolsSpeedBoost",
  "defensiveToolsCostsReduction",
  "meadStorage",
  "recruitCostReduction",
  "honeyStorage",
  "hospitalCapacity",
  "healSpeed",
  "marketCarriages",
  "XPBoostBuildBuildings",
  "stackSize",
  "glassStorage",
  "Glassproduction",
  "ironStorage",
  "Ironproduction",
  "coalStorage",
  "Coalproduction",
  "oilStorage",
  "Oilproduction",
  "offensiveToolsCostsReduction",
  "feastCostsReduction",
  "Meadreduction",
  "surviveBoost",
  "unboostedStoneProduction",
  "unboostedWoodProduction",
  "offensiveToolsSpeedBoost",
  "espionageTravelBoost"
];
const composedRewardImageCache = new Map();
let sharedLootBoxModal = null;
let sharedUnitStatsModal = null;
let sharedInfoCardModal = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeType(type) {
  const raw = String(type || "").trim();
  const lower = raw.toLowerCase();
  if (lower === "lootbox" || lower === "loot_box") return "lootbox";
  if (lower === "lootboxoffer" || lower === "offering") return "offering";
  if (lower === "soldier" || lower === "troop" || lower === "eventunit") return "unit";
  if (lower === "eventtool") return "unit";
  if (lower === "constructionitem") return "construction";
  if (lower === "item") return "equipment";
  if (lower === "alliance_layout" || lower === "alliancelayout" || lower === "alliancecoatlayout") return "alliance_layout";
  return lower;
}

function createLootBoxModalElement() {
  let modal = document.getElementById("lootBoxModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "lootBoxModal";
  modal.className = "gf-modal lootbox-modal";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="gf-modal-backdrop" data-close-modal="1"></div>
    <div class="gf-modal-card lootbox-modal-card" role="dialog" aria-modal="true" aria-labelledby="lootBoxModalTitle">
      <div class="gf-modal-head lootbox-modal-head">
        <h5 id="lootBoxModalTitle" class="modal-title gf-modal-title"></h5>
        <button type="button" class="gf-modal-close lootbox-modal-close" aria-label="Close">
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      </div>
      <div class="gf-modal-body lootbox-modal-body">
        <div id="lootBoxRewards" class="row g-1"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function createUnitStatsModalElement() {
  let modal = document.getElementById("unitStatsModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "unitStatsModal";
  modal.className = "gf-modal unit-stats-modal";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="gf-modal-backdrop" data-close-modal="1"></div>
    <div class="gf-modal-card unit-stats-modal-card" role="dialog" aria-modal="true" aria-labelledby="unitStatsModalLabel">
      <div class="gf-modal-head unit-stats-modal-head">
        <h5 class="modal-title gf-modal-title" id="unitStatsModalLabel">Details</h5>
        <button type="button" class="gf-modal-close unit-stats-modal-close" aria-label="Close">
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      </div>
      <div class="gf-modal-body unit-stats-modal-body" id="unitStatsModalBody"></div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function createInfoCardModalElement() {
  let modal = document.getElementById("rewardInfoCardModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "rewardInfoCardModal";
  modal.className = "gf-modal reward-info-card-modal";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="gf-modal-backdrop" data-close-modal="1"></div>
    <div class="gf-modal-card reward-info-card-modal-card" role="dialog" aria-modal="true" aria-labelledby="rewardInfoCardModalTitle">
      <div class="gf-modal-head reward-info-card-modal-head">
        <h5 id="rewardInfoCardModalTitle" class="modal-title gf-modal-title"></h5>
        <button type="button" class="gf-modal-close reward-info-card-modal-close" aria-label="Close">
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      </div>
      <div class="gf-modal-body reward-info-card-modal-body" id="rewardInfoCardModalBody"></div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function getLootBoxModal() {
  createLootBoxModalElement();
  if (!sharedLootBoxModal) {
    sharedLootBoxModal = initCustomModal({ modalId: "lootBoxModal" });
  }
  return sharedLootBoxModal;
}

function getUnitStatsModal() {
  createUnitStatsModalElement();
  if (!sharedUnitStatsModal) {
    sharedUnitStatsModal = initCustomModal({ modalId: "unitStatsModal" });
  }
  return sharedUnitStatsModal;
}

function getInfoCardModal() {
  createInfoCardModalElement();
  if (!sharedInfoCardModal) {
    sharedInfoCardModal = initCustomModal({ modalId: "rewardInfoCardModal" });
  }
  return sharedInfoCardModal;
}

function langValue(lang, key, fallback = "") {
  if (!key) return fallback;
  const lower = String(key).toLowerCase();
  return lang?.[key] || lang?.[lower] || fallback;
}

function getDisplayName(type, entity, detail, ctx) {
  const lang = ctx.lang || {};
  if (detail.name) return detail.name;
  if (!entity) return "Reward";

  if (type === "unit") {
    const unitType = getProp(entity, ["type", "Type"]);
    const key = unitType ? `${String(unitType).toLowerCase()}_name` : "";
    return langValue(lang, key, unitType || "Unit");
  }

  if (type === "decoration") {
    const decoType = getProp(entity, ["type", "Type", "name", "Name"]);
    return langValue(lang, `deco_${String(decoType || "").toLowerCase()}_name`, decoType || "Decoration");
  }

  if (type === "construction") {
    const raw = getProp(entity, ["name", "Name", "type", "Type"]);
    const lower = String(raw || "").toLowerCase();
    return langValue(lang, `ci_${lower}`, langValue(lang, `ci_primary_${lower}`, raw || "Construction item"));
  }

  if (type === "lootbox") {
    const name = getProp(entity, ["name", "Name"]);
    const rarity = getProp(entity, ["rarity", "Rarity"]);
    const key = `mysterybox_boxname_${name}_${rarity}`.toLowerCase();
    return langValue(lang, key, name || "Loot box");
  }

  if (type === "currency") {
    return getProp(entity, ["Name", "name", "assetName"]) || "Currency";
  }

  if (type === "equipment") return resolveEquipmentName(ctx.lang, entity);
  if (type === "gem") return getGemDetailName(entity, ctx);

  return getProp(entity, ["name", "Name", "comment1", "comment2"]) || "Reward";
}

function findEntity(type, id, ctx) {
  if (!id) return null;
  const key = String(id);
  if (type === "unit") return ctx.unitsById?.[key] || null;
  if (type === "decoration") return ctx.decorationsById?.[key] || ctx.buildingsById?.[key] || null;
  if (type === "construction") return ctx.constructionById?.[key] || null;
  if (type === "equipment") return ctx.equipmentById?.[key] || null;
  if (type === "gem") return ctx.gemsById?.[key] || null;
  if (type === "lootbox") return ctx.lootBoxesById?.[key] || null;
  if (type === "currency") return ctx.currenciesById?.[key] || null;
  if (type === "offering") return { tombolaID: key };
  if (type === "alliance_layout") return ctx.allianceCoatLayoutsById?.[key] || null;
  return null;
}

function isToolEntity(entity) {
  const name = String(getProp(entity, ["name", "Name"]) || "").toLowerCase();
  const type = String(getProp(entity, ["type", "Type"]) || "").toLowerCase();
  const group = String(getProp(entity, ["group", "Group"]) || "").toLowerCase();
  return (
    name.includes("tool") ||
    type.includes("tool") ||
    group.includes("tool") ||
    name.includes("workshop") ||
    type.includes("workshop") ||
    String(getProp(entity, ["effects"]) || "").trim() !== ""
  );
}

function getEntryImageUrl(entry, ctx) {
  const resolver = ctx.rewardResolver;
  if (!resolver || !entry) return entry?.imageUrl || null;
  if (entry.imageUrl) return entry.imageUrl;
  if (entry.type === "currency") {
    const imageUrl = resolver.getCurrencyImageUrl(entry);
    if (imageUrl) return imageUrl;
    const currencyKey = String(entry.addKeyName || entry.id || entry.name || "").toLowerCase();
    if (["rubies", "ruby", "currency2", "c2"].includes(currencyKey)) return "../../img_base/ruby.png";
    return null;
  }
  if (entry.type === "unit") return resolver.getUnitImageUrl(entry);
  if (entry.type === "decoration") return resolver.getDecorationImageUrl(entry);
  if (entry.type === "construction") return resolver.getConstructionImageUrl(entry);
  if (entry.type === "equipment") return resolver.getEquipmentImageUrl(entry) || "../../img_base/equipment.png";
  if (entry.type === "lootbox") return resolver.getLootBoxImageUrl(entry);
  if (entry.type === "alliance_layout") return resolver.getAllianceLayoutImageUrl(entry);
  return null;
}

function getEquipmentEffectMap(ctx) {
  if (ctx.equipmentEffectToEffectId) return ctx.equipmentEffectToEffectId;
  const map = {};
  (ctx.equipmentEffects || []).forEach((row) => {
    const equipmentEffectId = String(getProp(row, ["equipmentEffectID", "equipmentEffectId", "equipmenteffectid"]) || "").trim();
    const effectId = String(getProp(row, ["effectID", "effectId", "effectid"]) || "").trim();
    if (equipmentEffectId && effectId) map[equipmentEffectId] = effectId;
  });
  return map;
}

function resolveEquipmentEffectId(effectId, sourceType, ctx) {
  const raw = String(effectId || "").trim();
  if (!raw) return raw;
  const map = getEquipmentEffectMap(ctx);
  const mapped = map[raw];
  const hasDirect = Boolean(ctx.effectsById?.[raw]);
  if (sourceType === "equipment") {
    if (mapped) return String(mapped);
    if (hasDirect) return raw;
    return raw;
  }
  if (sourceType === "gem") {
    if (hasDirect) return raw;
    if (mapped) return String(mapped);
    return raw;
  }
  if (hasDirect) return raw;
  return mapped ? String(mapped) : raw;
}

function getEquipmentEffectLabel(effectId, sourceType, ctx) {
  const resolvedEffectId = resolveEquipmentEffectId(effectId, sourceType, ctx);
  const effect = ctx.effectsById?.[String(resolvedEffectId)] || null;
  const rawName = String(getProp(effect, ["name", "Name"]) || "").trim();
  if (!rawName) return `Effect ${resolvedEffectId || effectId}`;

  const directOverride = { charmboost: "additionalwaves" };
  const key = rawName.toLowerCase();
  const normalizedKey = directOverride[key] || key;
  const strippedShapeKey = normalizedKey.endsWith("shapeshifter")
    ? normalizedKey.replace(/shapeshifter$/i, "")
    : null;
  const candidates = [
    strippedShapeKey ? `equip_effect_description_${strippedShapeKey}` : null,
    strippedShapeKey ? `ci_effect_${strippedShapeKey}` : null,
    strippedShapeKey ? `effect_name_${strippedShapeKey}` : null,
    strippedShapeKey ? `equip_effect_description_short_${strippedShapeKey}` : null,
    strippedShapeKey,
    `equip_effect_description_${normalizedKey}`,
    `ci_effect_${normalizedKey}`,
    `effect_name_${normalizedKey}`,
    `effect_desc_${normalizedKey}`,
    `equip_effect_description_short_${normalizedKey}`,
    normalizedKey,
    `equip_effect_description_${key}`,
    `ci_effect_${key}`,
    `effect_name_${key}`,
    `effect_desc_${key}`,
    `equip_effect_description_short_${key}`,
    key
  ].filter(Boolean);
  for (const candidate of candidates) {
    const value = ctx.lang?.[candidate];
    if (!value) continue;
    const text = String(value);
    if (/lost its powers|seems to have run out/i.test(text)) continue;
    return text;
  }
  return rawName.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").trim();
}

function parseEquipmentEffectToken(token, sourceType, ctx) {
  const [idRaw, valueRaw = "0"] = String(token || "").split("&");
  const id = String(idRaw || "").trim();
  if (!id) return [];
  const valuePart = String(valueRaw || "").trim();
  if (valuePart.includes("#")) {
    const nested = valuePart
      .split("#")
      .map((part) => String(part || "").trim())
      .filter((part) => part.includes("+"))
      .map((part) => {
        const [argPartRaw, nestedValueRaw] = part.split("+");
        const argId = String(argPartRaw || "").trim();
        const parsed = Number(nestedValueRaw);
        return argId && Number.isFinite(parsed) ? { id, value: parsed, argId } : null;
      })
      .filter(Boolean);
    const template = getEquipmentEffectLabel(id, sourceType, ctx);
    return template.includes("{1}") || template.includes("{2}") ? nested : nested.slice(0, 1);
  }
  let numericPart = valuePart;
  let argId = "";
  if (numericPart.includes("+")) {
    const [argPart, actual] = numericPart.split("+");
    argId = String(argPart || "").trim();
    numericPart = actual ?? numericPart;
  }
  const parsed = Number(numericPart);
  return [{ id, value: Number.isFinite(parsed) ? parsed : 0, argId }];
}

function formatEquipmentNumber(value, ctx) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return Math.abs(number).toLocaleString(String(ctx.currentLanguage || "en").toLowerCase());
}

function formatEquipmentEffectValue(effectId, value, sourceType, ctx) {
  const resolvedEffectId = resolveEquipmentEffectId(effectId, sourceType, ctx);
  const isPercent = Boolean(ctx.percentEffectIDs?.has?.(String(resolvedEffectId)));
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatEquipmentNumber(value, ctx)}${isPercent ? "%" : ""}`;
}

function formatEquipmentTemplateValue(template, effectId, value, sourceType, ctx) {
  const resolvedEffectId = resolveEquipmentEffectId(effectId, sourceType, ctx);
  const isPercent = Boolean(ctx.percentEffectIDs?.has?.(String(resolvedEffectId)));
  const absText = formatEquipmentNumber(value, ctx);
  const signedText = value > 0 ? `+${absText}` : value < 0 ? `-${absText}` : "0";
  const hasSign = /[+\-]\s*\{0\}/.test(template) || /\{0\}\s*[+\-]/.test(template);
  const hasPercent = /\{0\}\s*%/.test(template) || /%\s*\{0\}/.test(template);
  return `${hasSign ? absText : signedText}${isPercent && !hasPercent ? "%" : ""}`;
}

function normalizeEquipmentEffectValue(effectId, value, sourceType, ctx) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  const template = String(getEquipmentEffectLabel(effectId, sourceType, ctx) || "");
  if (/-\s*\{0\}/.test(template) || /\{0\}\s*-/.test(template)) return -Math.abs(numericValue);
  if (/\+\s*\{0\}/.test(template) || /\{0\}\s*\+/.test(template)) return Math.abs(numericValue);
  return numericValue;
}

function renderEquipmentEffectLine(effectId, value, argId, sourceType, ctx) {
  const template = getEquipmentEffectLabel(effectId, sourceType, ctx);
  const resolveUnitName = (unitId) => {
    if (!unitId) return "";
    const unit = ctx.unitsById?.[String(unitId)];
    if (!unit) return unitId;
    const typeKey = String(getProp(unit, ["type", "Type"]) || "").trim();
    const langKey = `${typeKey}_name`.toLowerCase();
    return ctx.lang?.[langKey] || getProp(unit, ["comment2", "name", "Name", "type", "Type"]) || unitId;
  };
  if (template.includes("{0}")) {
    return template
      .replace(/\{0\}/g, formatEquipmentTemplateValue(template, effectId, value, sourceType, ctx))
      .replace(/\{1\}/g, argId ? resolveUnitName(argId) : "")
      .replace(/\{2\}/g, "")
      .replace(/\{\d+\}/g, "")
      .replace(/\s*\.$/, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  const cleaned = cleanupEffectTitle(template);
  return `${cleaned}${cleaned.endsWith(":") ? "" : ":"} ${formatEquipmentEffectValue(effectId, value, sourceType, ctx)}`;
}

function parseEquipmentEffects(raw, sourceType, ctx) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .flatMap((token) => parseEquipmentEffectToken(token, sourceType, ctx))
    .map((entry) => ({
      ...entry,
      value: normalizeEquipmentEffectValue(entry.id, entry.value, sourceType, ctx)
    }))
    .map((entry) => renderEquipmentEffectLine(entry.id, entry.value, entry.argId, sourceType, ctx));
}

function getGemDetailName(item, ctx) {
  if (!item) return "Gem";
  const id = String(getProp(item, ["gemID", "gemId", "gemid"]) || "");
  const key = `gem_unique_${id}`.toLowerCase();
  return ctx.lang?.[key] || getProp(item, ["comment2", "comment1"]) || `Gem ${id}`;
}

function getEquipmentSlotLabel(item, ctx) {
  const slotId = String(getProp(item, ["slotID", "slotId", "slotid"]) || "");
  const rawBySlot = { "1": "armor", "2": "weapon", "3": "helmet", "4": "artifact", "5": "look", "6": "hero" };
  const raw = String(getProp(ctx.equipmentSlotsById?.[slotId], ["name", "Name"]) || rawBySlot[slotId] || "").toLowerCase();
  const slotTypeKey = { helmet: "equipment_slottype_helmet", armor: "equipment_slottype_armor", weapon: "equipment_slottype_weapon", artifact: "equipment_slottype_artifact", look: "equipment_slottype_skin", skin: "equipment_slottype_skin", hero: "equipment_slottype_hero", heroes: "equipment_slottype_hero" }[raw];
  const filterKey = { helmet: "filters_subfilter_1", armor: "filters_subfilter_2", weapon: "filters_subfilter_3", artifact: "filters_subfilter_4", look: "filters_subfilter_5", skin: "filters_subfilter_5", hero: "filters_subfilter_6" }[raw];
  return (slotTypeKey && ctx.lang?.[slotTypeKey]) || (filterKey && ctx.lang?.[filterKey]) || ctx.lang?.[`equipmentslot_name_${raw}`] || ctx.lang?.[`dialog_equipment_slot_${raw}`] || raw || "Equipment";
}

function getEquipmentDetailImageUrl(item, detail, ctx) {
  const id = String(getProp(item, ["equipmentID", "equipmentId", "equipmentid"]) || detail.id || "");
  const reuseId = String(getProp(item, ["reuseAssetOfEquipmentID", "reuseAssetOfEquipmentId", "reuseassetofequipmentid"]) || "");
  return (reuseId ? ctx.equipmentUniqueImageUrlMap?.[reuseId] : null)
    || ctx.equipmentUniqueImageUrlMap?.[id]
    || detail.imageUrl
    || "../../img_base/equipment.png";
}

function getGemDetailImageUrl(item, detail, ctx) {
  if (detail.imageUrl) return detail.imageUrl;
  const id = String(getProp(item, ["gemID", "gemId", "gemid"]) || detail.id || "");
  const reuseId = String(getProp(item, ["reuseAssetOfGemID", "reuseAssetOfGemId", "reuseassetofgemid"]) || "");
  return ctx.uniqueGemImageUrlMap?.[id] || (reuseId ? ctx.uniqueGemImageUrlMap?.[reuseId] : null) || "../../img_base/placeholder.webp";
}

function getRiftShardLabel(ctx) {
  return ctx.lang?.["currency_name_riftshard"] || ctx.lang?.["currency_name_RiftShard"] || "Rift Shard";
}

function getRiftShardImageUrl(ctx) {
  return ctx.currencyImageUrlMap?.riftshard || ctx.currencyImageUrlMap?.[normalizeName("RiftShard")] || null;
}

function getOfferingShardLabel(ctx) {
  return ctx.lang?.["currency_name_offeringshard"] || ctx.lang?.["currency_name_OfferingShard"] || "Offering Shard";
}

function getOfferingShardImageUrl(ctx) {
  return ctx.currencyImageUrlMap?.offeringshard || ctx.currencyImageUrlMap?.[normalizeName("OfferingShard")] || null;
}

function formatSellValueText(value, ctx, currencyLabel = getRiftShardLabel(ctx)) {
  const valueText = `${formatEquipmentNumber(value, ctx)} ${currencyLabel}`.trim();
  const template = ctx.lang?.["relicequip_dialog_sellvalue_name"] || ctx.lang?.["relicequip_dialog_sellValue_name"];
  return template ? String(template).replace(/\{0\}/g, valueText).replace(/\s+/g, " ").trim() : `Sell value ${valueText}`;
}

function getRewardEntries(reward, ctx) {
  const entries = ctx.rewardResolver?.resolveRewardEntries(reward) || [];
  const resolvedEntries = entries.map((entry) => ({
    ...entry,
    imageUrl: getEntryImageUrl(entry, ctx)
  }));

  const gemIds = getProp(reward, ["gemIDs", "gemIds", "gemids"]);
  if (gemIds) {
    String(gemIds)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((token) => {
        const [idPart, amountPart] = token.split("+");
        const gemId = idPart?.trim() || token;
        if (!gemId) return;
        const amount = Number(amountPart);
        const gem = ctx.gemsById?.[String(gemId)] || null;
        const reusedId = getProp(gem, ["reuseAssetOfGemID", "reuseAssetOfGemId", "reuseassetofgemid"]);
        const imageId = reusedId || gemId;
        resolvedEntries.push({
          type: "gem",
          id: gemId,
          name: ctx.lang?.["gem_item"] || "Gem",
          amount: Number.isNaN(amount) ? 1 : amount,
          imageUrl: ctx.uniqueGemImageUrlMap?.[String(imageId)] || "../../img_base/placeholder.webp"
        });
      });
  }

  ["food", "wood", "stone"].forEach((resource) => {
    const value = getProp(reward, [resource]);
    if (!value) return;
    resolvedEntries.push({
      type: resource,
      name: ctx.lang?.[resource] || resource,
      amount: Number(value) || 1,
      imageUrl: `../../img_base/${resource}.png`
    });
  });

  const vipPoints = getProp(reward, ["vipPoints", "vippoints"]);
  if (vipPoints) {
    resolvedEntries.push({
      type: "vipPoints",
      name: ctx.lang?.["vipPoints_name"] || "VIP points",
      amount: Number(vipPoints) || 1,
      imageUrl: "../../img_base/vipPoints.png"
    });
  }

  const vipTime = getProp(reward, ["vipTime", "viptime"]);
  if (vipTime) {
    const totalSeconds = Number(vipTime);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes || parts.length === 0) parts.push(`${minutes}m`);
    resolvedEntries.push({
      type: "vipTime",
      name: ctx.lang?.["vipTime_name"] || "VIP time",
      amount: parts.join(" "),
      imageUrl: "../../img_base/vipTime.png"
    });
  }

  if (getProp(reward, ["relicEquipments", "relicequipments"])) {
    resolvedEntries.push({
      type: "relic",
      name: ctx.lang?.["relic_equipment"] || "Relic",
      amount: 1,
      imageUrl: "../../img_base/relic.png"
    });
  }

  return resolvedEntries;
}

function getTombolaEntries(tombolaId, ctx) {
  if (!tombolaId) return [];
  return (ctx.lootBoxTombolas || []).filter((entry) => String(getProp(entry, ["tombolaID", "tombolaId", "tombolaid"])) === String(tombolaId));
}

function getRewardPoolTitle(type, detail, entity, ctx) {
  if (detail.name) return detail.name;
  if (type === "lootbox") return getDisplayName(type, entity, detail, ctx);
  return "Rewards";
}

function getRarityFromCategory(categoryValue) {
  const category = Number(categoryValue);
  if (category === 1) return "common";
  if (category === 2) return "rare";
  if (category === 3) return "epic";
  if (category === 4) return "legendary";
  return null;
}

function getEntryRarity(entry, rewards) {
  const fromCategory = getRarityFromCategory(getProp(entry, ["rewardCategory", "rewardcategory"]));
  if (fromCategory) return fromCategory;

  const reward = rewards.find((item) => typeof item?.comment2 === "string");
  const value = String(reward?.comment2 || "").trim().toLowerCase();
  if (value === "common" || value === "rare" || value === "epic" || value === "legendary") return value;
  return "common";
}

function normalizeLootBoxKeyType(value) {
  const keyType = String(value || "").trim().toLowerCase();
  if (keyType === "common" || keyType === "1") return "common";
  if (keyType === "rare" || keyType === "2") return "rare";
  if (keyType === "epic" || keyType === "3") return "epic";
  if (keyType === "legendary" || keyType === "4") return "legendary";
  return "";
}

function getLootBoxSelectedRarity(detail, ctx) {
  if (typeof ctx.getLootBoxKeyType === "function") {
    return normalizeLootBoxKeyType(ctx.getLootBoxKeyType(detail));
  }
  return normalizeLootBoxKeyType(detail.keyType || detail.selectedKeyType || ctx.lootBoxKeyType);
}

function isAllowedByLootBoxKey(cardRarity, selectedRarity) {
  if (!selectedRarity || selectedRarity === "common") return true;
  const cardOrder = RARITY_ORDER[cardRarity] || 0;
  const selectedOrder = RARITY_ORDER[selectedRarity] || 0;
  return cardOrder >= selectedOrder;
}

function getRarityLabel(rarity, ctx) {
  const lang = ctx.lang || {};
  const key = `dialog_mysteryBoxSystem_boxRarity_${rarity}`;
  return lang[key] || lang[key.toLowerCase()] || lang[key.toUpperCase()] || "";
}

function formatPercent(value) {
  const num = Number(value);
  return `${Number.isNaN(num) ? 0 : num.toFixed(2)}%`;
}

function getComposedAttrs(entry) {
  const imageUrl = entry.imageUrl || "";
  const isRemoteItemAsset = typeof imageUrl === "string" &&
    imageUrl.startsWith("https://empire-html5.goodgamestudios.com/default/assets/itemassets/") &&
    /\.(webp|png)$/i.test(imageUrl);
  const shouldCompose = (
    entry.type === "equipment" ||
    entry.type === "gem" ||
    entry.type === "decoration" ||
    entry.type === "construction"
  ) && isRemoteItemAsset;
  const composed = shouldCompose ? deriveCompanionUrls(imageUrl) : null;
  return composed?.imageUrl && composed?.jsonUrl && composed?.jsUrl
    ? `data-compose-equipment="1" data-image-url="${escapeHtml(composed.imageUrl)}" data-json-url="${escapeHtml(composed.jsonUrl)}" data-js-url="${escapeHtml(composed.jsUrl)}"`
    : "";
}

function formatNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : String(value ?? "-");
}

function getDecorationImageUrl(entity, detail, ctx) {
  if (detail.imageUrl) return detail.imageUrl;
  const resolved = ctx.rewardResolver?.getDecorationImageUrl?.({
    type: "decoration",
    id: detail.id,
    name: detail.name
  });
  if (resolved) return resolved;
  const key = normalizeName(getProp(entity, ["type", "Type", "name", "Name"]) || "");
  const entry = key ? ctx.decorationImageUrlMap?.[key] : null;
  return entry?.placedUrl || entry?.iconUrl || "../../img_base/placeholder.webp";
}

function getConstructionImageUrl(entity, detail, ctx) {
  if (detail.imageUrl) return detail.imageUrl;
  const resolved = ctx.rewardResolver?.getConstructionImageUrl?.({
    type: "construction",
    id: detail.id,
    name: detail.name
  });
  if (resolved) return resolved;
  const key = normalizeName(getProp(entity, ["name", "Name", "comment1", "comment2"]) || "");
  const entry = key ? ctx.constructionImageUrlMap?.[key] : null;
  return entry?.placedUrl || entry?.iconUrl || "../../img_base/placeholder.webp";
}

function getDecorationLabels(ctx) {
  const lang = ctx.lang || {};
  return {
    publicOrder: lang.public_order || "Public order",
    poPerTile: "PO per tile",
    size: lang.size || "Size",
    might: lang.playermight || "Might points",
    salePrice: "Sale price",
    fusion: "Fusion",
    effects: lang.effects || "Effects"
  };
}

function getConstructionLabels(ctx) {
  const lang = ctx.lang || {};
  return {
    effects: lang.effects || "Effects",
    type: lang.type || "Type",
    expirationTime: lang.expiration_time || "Expiration time",
    removalCost: "Removal Cost",
    nonRemovable: "Non removable",
    coins: lang.coins || "coins",
    temporary: "Temporary",
    permanent: "Permanent",
    primary: "Primary",
    appearance: "Appearance",
    relic: "Relic",
    level: lang.level || "Level",
    publicOrder: lang.public_order || "Public order",
    canBePlacedOn: "Can be placed on",
    ordinary: "Ordinary",
    rare: "Rare",
    epic: "Epic",
    legendary: "Legendary"
  };
}

function getDecorationPublicOrder(entity) {
  const decoPoints = getProp(entity, ["decoPoints", "decopoints"]);
  if (decoPoints !== undefined && decoPoints !== null && String(decoPoints).trim() !== "") {
    return Number(decoPoints) || 0;
  }
  const fusionLevel = getProp(entity, ["initialFusionLevel", "initialfusionlevel"]);
  if (fusionLevel !== undefined && fusionLevel !== null && String(fusionLevel).trim() !== "") {
    const level = Number(fusionLevel);
    if (Number.isFinite(level)) return 100 + level * 5;
  }
  return 0;
}

function getDecorationFusionText(entity) {
  const source = String(getProp(entity, ["isFusionSource", "isfusionsource"]) || "") === "1";
  const target = String(getProp(entity, ["isFusionTarget", "isfusiontarget"]) || "") === "1";
  if (source && target) return "Source and target";
  if (source) return "Source";
  if (target) return "Target";
  return "No";
}

function getDecorationSellPriceParts(entity) {
  const legendaryToken = getProp(entity, ["sellLegendaryToken", "selllegendarytoken"]);
  const legendaryMaterial = getProp(entity, ["sellLegendaryMaterial", "selllegendarymaterial"]);
  if (legendaryToken || legendaryMaterial) {
    const parts = [];
    const icons = [];
    if (legendaryToken) parts.push(`<img src="../../img_base/construction-token.png" class="effect-icon" alt="">x${escapeHtml(formatNumber(legendaryToken))}`);
    if (legendaryMaterial) parts.push(`<img src="../../img_base/upgrade-token.png" class="effect-icon" alt="">x${escapeHtml(formatNumber(legendaryMaterial))}`);
    if (legendaryToken) icons.push(`<img src="../../img_base/construction-token.png" alt="">`);
    if (legendaryMaterial) icons.push(`<img src="../../img_base/upgrade-token.png" alt="">`);
    return { icon: icons.join(""), value: parts.map((part) => part.replace(/<img[^>]*>/g, "")).join("<br>") };
  }
  const sellC1 = getProp(entity, ["sellC1", "sellc1"]) || "0";
  const riftShard = getProp(entity, ["sellRiftShard", "sellriftshard"]);
  const biscuit = getProp(entity, ["sellSoldierBiscuit", "sellsoldierbiscuit"]);
  if (Number(sellC1) === 0 && riftShard) {
    return { icon: `<img src="../../img_base/rift-shard.png" alt="">`, value: `x${escapeHtml(formatNumber(riftShard))}` };
  }
  if (Number(sellC1) === 0 && biscuit) {
    return { icon: `<img src="../../img_base/biscuit.png" alt="">`, value: `x${escapeHtml(formatNumber(biscuit))}` };
  }
  return { icon: `<img src="../../img_base/coin.png" alt="">`, value: `x${escapeHtml(formatNumber(sellC1))}` };
}

function getDecorationSellPriceHtml(entity) {
  const parts = getDecorationSellPriceParts(entity);
  return `${parts.icon}${parts.value}`;
}

function formatEffectValue(rawValue, isPercent = false) {
  const raw = String(rawValue ?? "").trim();
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw || "-";
  return `${formatNumber(n)}${isPercent ? "%" : ""}`;
}

function parseDetailEffects(effectsStr, ctx) {
  if (!effectsStr) return [];
  return String(effectsStr)
    .split(",")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [effectIdRaw, payloadRaw = "0"] = chunk.split("&");
      const effectId = String(effectIdRaw || "").trim();
      const effect = ctx.effectsById?.[effectId] || {};
      const effectName = getProp(effect, ["name", "Name"]) || `Effect ${effectId}`;
      const payload = String(payloadRaw || "").trim();
      let valueRaw = payload;
      let argName = "";
      if (payload.includes("+")) {
        const [argId, val] = payload.split("+");
        valueRaw = val;
        argName = resolveEffectArgName(argId, ctx);
      }
      let label = getEffectDisplayName(effectName, effectId, ctx);
      if (argName && !label.toLowerCase().includes(argName.toLowerCase())) {
        label = `${label} (${argName})`;
      }
      const isPercent =
        ctx.percentEffectIDs?.has?.(String(effectId)) ||
        ctx.percentEffectIDs?.has?.(Number(effectId));
      const capId = getProp(effect, ["capID", "capId", "capid"]);
      const cap = capId ? ctx.effectCapsMap?.[String(capId)] || ctx.effectCapsMap?.[capId] : null;
      const maxTotalBonus = getProp(cap, ["maxTotalBonus", "maxtotalbonus"]);
      const maxText = maxTotalBonus
        ? ` <span class="max-bonus">(Max: ${escapeHtml(formatNumber(maxTotalBonus))}${isPercent ? "%" : ""})</span>`
        : "";
      return `${escapeHtml(label)}: <span class="effect-amount"><span class="effect-value">${escapeHtml(formatEffectValue(valueRaw, isPercent))}</span>${maxText}</span>`;
    });
}

function getConstructionLegacyEffectFallbackLabel(fieldName, ctx) {
  const lower = String(fieldName || "").toLowerCase();
  const lang = ctx.lang || {};
  for (const key in lang) {
    const keyLower = key.toLowerCase();
    if (keyLower.endsWith("_tt") && keyLower.includes(lower)) {
      return lang[key];
    }
  }
  return fieldName;
}

function cleanupConstructionTemplateLabel(template) {
  const label = String(template || "")
    .replace(/\{0\}/g, "")
    .replace(/[%+\-]/g, "")
    .replace(/:+/g, "")
    .trim();
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "";
}

function formatConstructionLegacyValue(value, template) {
  const num = Number(value);
  const absValue = Number.isFinite(num) ? Math.abs(num) : value;
  const templateText = String(template || "");
  const hasMinus = /-\s*\{0\}/.test(templateText);
  const hasPlus = /\+\s*\{0\}/.test(templateText);
  const sign = hasMinus ? "-" : hasPlus ? "+" : Number(num) < 0 ? "-" : "+";
  return `${sign}${formatNumber(absValue)}${templateText.includes("%") ? "%" : ""}`;
}

function addConstructionLegacyEffects(entity, effects, ctx) {
  const rendered = new Set(effects.map((effect) => String(effect).toLowerCase()));
  CONSTRUCTION_LEGACY_EFFECT_FIELDS.forEach((field) => {
    const value = getProp(entity, [field, field.toLowerCase()]);
    if (value === undefined || value === null || String(value).trim() === "") return;

    const template = ctx.lang?.[`ci_effect_${field.toLowerCase()}`];
    let renderedEffect = "";
    if (template && String(template).includes("{0}")) {
      const label = cleanupConstructionTemplateLabel(template);
      renderedEffect = `${label}: ${formatConstructionLegacyValue(value, template)}`;
    } else {
      const label = getConstructionLegacyEffectFallbackLabel(field, ctx);
      renderedEffect = `${label}: ${formatNumber(value)}`;
    }

    if (!renderedEffect || rendered.has(renderedEffect.toLowerCase())) return;
    effects.push(renderedEffect);
    rendered.add(renderedEffect.toLowerCase());
  });
}

function getConstructionTypeText(entity, labels) {
  if (getProp(entity, ["duration"])) return `${labels.temporary} (${formatDurationText(getProp(entity, ["duration"]))})`;
  return labels.permanent;
}

function formatDurationText(secondsValue) {
  const totalSeconds = Number(secondsValue);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "";
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const parts = [];
  if (days) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  if (hours) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (mins) parts.push(`${mins} ${mins === 1 ? "minute" : "minutes"}`);
  return parts.join(" ");
}

function formatEquipmentDurationCompact(hoursValue) {
  const totalHours = Number(hoursValue);
  if (!Number.isFinite(totalHours) || totalHours <= 0) return "";
  const days = Math.floor(totalHours / 24);
  const hours = Math.floor(totalHours % 24);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  return parts.join(" ");
}

function getEquipmentGemModalTitle(name, slotLabel, entity) {
  const duration = formatEquipmentDurationCompact(getProp(entity, ["duration", "Duration"]));
  return `${name} (${[slotLabel, duration].filter(Boolean).join(", ")})`;
}

function getConstructionRarityName(entity, labels) {
  const rareness = String(getProp(entity, ["rarenessID", "rarenessid"]) || "");
  if (rareness === "1") return labels.ordinary;
  if (rareness === "2") return labels.rare;
  if (rareness === "3") return labels.epic;
  if (rareness === "4") return labels.legendary;
  if (rareness === "5" || rareness === "10") return labels.appearance;
  return "";
}

function getConstructionLevelText(entity, labels) {
  const slotTypeID = Number(getProp(entity, ["slotTypeID", "slottypeid"]) || 0);
  const level = getProp(entity, ["level"]);
  const rarity = getConstructionRarityName(entity, labels);
  const hasDecoPoints = !!getProp(entity, ["decoPoints", "decopoints"]);
  if (slotTypeID === 4) return `${labels.primary} (${labels.level} ${level})`;
  if (slotTypeID === 3 || slotTypeID === 6) return labels.appearance;
  if (slotTypeID === 0 && hasDecoPoints) return labels.appearance;
  if (slotTypeID === 1) return labels.permanent;
  if (slotTypeID === 2) return `${labels.relic} (${labels.level} ${level})`;
  return rarity ? `${rarity} (${labels.level} ${level})` : `${labels.level} ${level}`;
}

function getPlacementBuildingNames(entity, ctx) {
  const groupId = String(getProp(entity, ["constructionItemGroupID", "constructionitemgroupid"]) || "").trim();
  if (!groupId) return [];
  const buildings = ctx.buildings || ctx.allBuildings || [];
  const names = new Set();
  buildings.forEach((building) => {
    const raw = String(getProp(building, ["constructionItemGroupIDs", "constructionitemgroupids"]) || "");
    if (!raw.split(",").map((id) => id.trim()).includes(groupId)) return;
    const buildingName = String(getProp(building, ["name", "Name"]) || "").trim();
    if (!buildingName) return;
    names.add(langValue(ctx.lang || {}, `${buildingName.toLowerCase()}_name`, buildingName));
  });
  return Array.from(names);
}

function renderEffectsSection(title, effects, { showTitle = true } = {}) {
  if (!effects.length) return "";
  return `
    <div class="card-section card-effects border-top reward-detail-effects">
      ${showTitle ? `<h5 class="card-section-title">${escapeHtml(title)}</h5>` : ""}
      <div class="reward-effect-list">
        ${effects.map((effect) => `<div class="reward-effect-row">${effect}</div>`).join("")}
      </div>
    </div>
  `;
}

function fitRewardDetailStatValues(root = document) {
  const values = root.querySelectorAll(
    ".reward-decoration-modal .stat-text strong, .reward-decoration-modal .stat-text .stat-value, .reward-construction-modal .tci-info-value"
  );

  values.forEach(valueEl => {
    valueEl.style.fontSize = "";

    const textEl = valueEl.closest(".stat-text, .tci-info-text");
    if (!textEl) return;

    const availableWidth = textEl.clientWidth;
    if (!availableWidth) return;

    const computed = window.getComputedStyle(valueEl);
    const baseSize = parseFloat(computed.fontSize);
    if (!baseSize) return;

    const naturalWidth = valueEl.scrollWidth;
    if (naturalWidth <= availableWidth) return;

    const scaledSize = Math.max(10, Math.floor(baseSize * (availableWidth / naturalWidth)));
    valueEl.style.fontSize = `${scaledSize}px`;
  });
}

let rewardDetailStatFitResizeFrame = null;
window.addEventListener("resize", () => {
  if (rewardDetailStatFitResizeFrame) {
    cancelAnimationFrame(rewardDetailStatFitResizeFrame);
  }

  rewardDetailStatFitResizeFrame = requestAnimationFrame(() => {
    fitRewardDetailStatValues(document);
    rewardDetailStatFitResizeFrame = null;
  });
});

function renderDecorationModal(detail, ctx) {
  const entity = findEntity("decoration", detail.id, ctx);
  if (!entity) return false;
  const labels = getDecorationLabels(ctx);
  const name = getDisplayName("decoration", entity, detail, ctx);
  const width = Number(getProp(entity, ["width"]) || 0);
  const height = Number(getProp(entity, ["height"]) || 0);
  const area = width * height;
  const po = getDecorationPublicOrder(entity);
  const poPerTile = area > 0 ? (po / area).toFixed(2) : "N/A";
  const imageUrl = getDecorationImageUrl(entity, detail, ctx);
  const effects = parseDetailEffects(getProp(entity, ["areaSpecificEffects", "areaspecificeffects"]) || "", ctx);
  const sellPrice = getDecorationSellPriceParts(entity);
  const statCell = ({ label, value, icon, border = false }) => `
    <div class="col-6 card-cell stat-cell${border ? " border-end" : ""}">
      <span class="stat-icon-box">${icon}</span>
      <span class="stat-text">
        <strong>${escapeHtml(label)}</strong>
        <span class="stat-value">${value}</span>
      </span>
    </div>`;
  const modalEl = createInfoCardModalElement();
  modalEl.classList.add("reward-decoration-modal");
  modalEl.classList.remove("reward-construction-modal");
  modalEl.classList.remove("reward-equipment-modal");
  modalEl.classList.remove("reward-alliance-layout-modal");
  modalEl.querySelector(".modal-title").textContent = name;
  modalEl.querySelector("#rewardInfoCardModalBody").innerHTML = `
    <div class="reward-info-card box-content">
      <div class="card-table">
        <div class="row g-0">
          <div class="col-4 card-cell border-end d-flex justify-content-center align-items-center position-relative reward-info-image-cell">
            <div class="image-wrapper">
              <img src="${escapeHtml(imageUrl)}" class="card-image" loading="lazy" alt="${escapeHtml(name)}" ${getComposedAttrs({ type: "decoration", imageUrl })}>
            </div>
            <div class="deco-modal-id-badge">#${escapeHtml(String(getProp(entity, ["wodID", "wodid"]) || detail.id || ""))}</div>
          </div>
          <div class="col-8 card-cell reward-info-content-cell deco-stat-grid">
            <div class="row g-0">
              ${statCell({ label: labels.publicOrder, value: escapeHtml(formatNumber(po)), icon: `<img src="../../img_base/po.png" alt="">`, border: true })}
              ${statCell({ label: labels.poPerTile, value: escapeHtml(poPerTile), icon: `<img src="../../img_base/po.png" alt="">` })}
            </div>
            <hr>
            <div class="row g-0">
              ${statCell({ label: labels.size, value: escapeHtml(`${width}x${height}`), icon: `<img src="../../img_base/size.png" alt="">`, border: true })}
              ${statCell({ label: labels.might, value: escapeHtml(formatNumber(getProp(entity, ["mightValue", "might"]) || 0)), icon: `<img src="../../img_base/might.png" alt="">` })}
            </div>
            <hr>
            <div class="row g-0">
              ${statCell({ label: labels.salePrice, value: sellPrice.value, icon: sellPrice.icon, border: true })}
              ${statCell({ label: labels.fusion, value: escapeHtml(getDecorationFusionText(entity)), icon: `<img src="../../img_base/fusion.png" alt="">` })}
            </div>
          </div>
        </div>
        ${renderEffectsSection(labels.effects, effects, { showTitle: false })}
      </div>
    </div>
  `;
  getInfoCardModal().open();
  requestAnimationFrame(() => fitRewardDetailStatValues(modalEl));
  void hydrateComposedImages({
    root: modalEl,
    selector: 'img[data-compose-equipment="1"]:not([data-compose-ready])',
    cache: composedRewardImageCache
  });
  return true;
}

function renderConstructionModal(detail, ctx) {
  const entity = findEntity("construction", detail.id, ctx);
  if (!entity) return false;
  const labels = getConstructionLabels(ctx);
  const name = getDisplayName("construction", entity, detail, ctx);
  const imageUrl = getConstructionImageUrl(entity, detail, ctx);
  const removalCost = getProp(entity, ["removalCostC1", "removalcostc1"]) || "0";
  const removalCostText = Number(removalCost) === 0
    ? labels.nonRemovable
    : `${formatNumber(removalCost)} ${labels.coins}`;
  const effects = parseDetailEffects(getProp(entity, ["effects"]) || "", ctx);
  addConstructionLegacyEffects(entity, effects, ctx);
  const decoPoints = getProp(entity, ["decoPoints", "decopoints"]);
  if (decoPoints) effects.push(`${escapeHtml(labels.publicOrder)}: ${escapeHtml(formatNumber(decoPoints))}`);
  const placement = getPlacementBuildingNames(entity, ctx);
  const placementText = placement.length ? placement.join(", ") : "-";
  const placementValueClass = placement.length > 1 || placementText.length > 22 ? " tci-info-value-small" : "";
  const constructionId = String(getProp(entity, ["constructionItemID", "constructionitemid"]) || detail.id || "");
  const infoCell = ({ label, value, icon, valueClass = "" }) => `
    <div class="card-cell tci-info-cell">
      <span class="tci-info-icon">${icon}</span>
      <span class="tci-info-text">
        <strong>${escapeHtml(label)}</strong>
        <span class="tci-info-value${valueClass}">${escapeHtml(value)}</span>
      </span>
    </div>`;
  const modalEl = createInfoCardModalElement();
  modalEl.classList.add("reward-construction-modal");
  modalEl.classList.remove("reward-decoration-modal");
  modalEl.classList.remove("reward-equipment-modal");
  modalEl.classList.remove("reward-alliance-layout-modal");
  modalEl.querySelector(".modal-title").textContent = name;
  modalEl.querySelector("#rewardInfoCardModalBody").innerHTML = `
    <div class="reward-info-card box-content">
      <div class="level-selector d-flex justify-content-center align-items-center">
        <div><strong>${escapeHtml(getConstructionLevelText(entity, labels))}</strong></div>
      </div>
      <div class="card-table border-top">
        <div class="row g-0">
          <div class="col-5 card-cell border-end d-flex justify-content-center align-items-center position-relative ci-image reward-info-image-cell">
            <div class="image-wrapper">
              <img src="${escapeHtml(imageUrl)}" class="card-image" loading="lazy" alt="${escapeHtml(name)}" ${getComposedAttrs({ type: "construction", imageUrl })}>
            </div>
            <div class="tci-modal-id-badge">#${escapeHtml(constructionId)}</div>
          </div>
          <div class="col-7 card-cell d-flex flex-column reward-info-content-cell tci-info-content-cell">
            <div class="tci-info-grid flex-fill d-flex flex-column h-100">
              ${infoCell({ label: labels.expirationTime, value: getConstructionTypeText(entity, labels), icon: `<img src="../../img_base/time.png" alt="">` })}
              <hr>
              ${infoCell({ label: labels.removalCost, value: removalCostText, icon: `<img src="../../img_base/coin.png" alt="">` })}
              <hr>
              ${infoCell({ label: labels.canBePlacedOn, value: placementText, valueClass: placementValueClass, icon: `<img src="../../img_base/canbeplaced.png" alt="">` })}
            </div>
          </div>
        </div>
      </div>
      ${renderEffectsSection(`${labels.effects}:`, effects, { showTitle: false })}
    </div>
  `;
  getInfoCardModal().open();
  requestAnimationFrame(() => fitRewardDetailStatValues(modalEl));
  void hydrateComposedImages({
    root: modalEl,
    selector: 'img[data-compose-equipment="1"]:not([data-compose-ready])',
    cache: composedRewardImageCache
  });
  return true;
}

function renderEquipmentGemModal(detail, ctx) {
  const type = normalizeType(detail.type);
  const entity = findEntity(type, detail.id, ctx);
  if (!entity) return false;

  const isGem = type === "gem";
  const name = isGem ? getGemDetailName(entity, ctx) : resolveEquipmentName(ctx.lang, entity, detail.id);
  const slotLabel = isGem
    ? (ctx.lang?.["gem_name"] || ctx.lang?.["gem_slottype_all"] || "Gem")
    : getEquipmentSlotLabel(entity, ctx);
  const imageUrl = isGem
    ? getGemDetailImageUrl(entity, detail, ctx)
    : getEquipmentDetailImageUrl(entity, detail, ctx);
  const effects = parseEquipmentEffects(getProp(entity, ["effects"]) || "", isGem ? "gem" : "equipment", ctx);
  const sellRiftShard = getProp(entity, ["sellRiftShard", "sellriftshard"]);
  const sellOfferingShard = getProp(entity, ["sellOfferingShard", "sellofferingshard"]);
  const sellEntries = [
    {
      value: sellRiftShard,
      label: getRiftShardLabel(ctx),
      imageUrl: getRiftShardImageUrl(ctx)
    },
    {
      value: sellOfferingShard,
      label: getOfferingShardLabel(ctx),
      imageUrl: getOfferingShardImageUrl(ctx)
    }
  ];
  const sellHtml = sellEntries
    .filter((entry) => Number(entry.value) > 0)
    .map((entry) => `<div class="piece-sell-value reward-equipment-sell-value">
        ${entry.imageUrl ? `<img src="${escapeHtml(entry.imageUrl)}" alt="" loading="lazy">` : ""}
        <span>${escapeHtml(formatSellValueText(entry.value, ctx, entry.label))}</span>
      </div>`)
    .join("");
  const modalEl = createInfoCardModalElement();
  modalEl.classList.add("reward-equipment-modal");
  modalEl.classList.remove("reward-decoration-modal");
  modalEl.classList.remove("reward-construction-modal");
  modalEl.classList.remove("reward-alliance-layout-modal");
  modalEl.querySelector(".modal-title").textContent = getEquipmentGemModalTitle(name, slotLabel, entity);
  modalEl.querySelector("#rewardInfoCardModalBody").innerHTML = `
    <article class="reward-equipment-card box-content">
      <div class="reward-equipment-visual">
        <div class="reward-equipment-image">
          ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name)}" loading="lazy" ${getComposedAttrs({ type: isGem ? "gem" : "equipment", imageUrl })}>` : "<span>?</span>"}
        </div>
      </div>
      <div class="reward-equipment-content">
        <ul class="effect-list reward-equipment-effects">
          ${effects.length ? effects.map((line) => `<li class="reward-effect-row">${escapeHtml(line)}</li>`).join("") : `<li class="reward-effect-row">No effect data</li>`}
        </ul>
        ${sellHtml}
      </div>
    </article>
  `;
  getInfoCardModal().open();
  void hydrateComposedImages({
    root: modalEl,
    selector: 'img[data-compose-equipment="1"]:not([data-compose-ready])',
    cache: composedRewardImageCache
  });
  return true;
}

function formatAllianceLayoutDuration(seconds) {
  const total = Number(seconds || 0);
  if (!Number.isFinite(total) || total <= 0) return "";
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 && days === 0) parts.push(`${minutes}m`);
  return parts.join(" ") || "0m";
}

function getAllianceLayoutDetailName(layout, detail, ctx) {
  if (detail.name) return detail.name;
  const id = String(getProp(layout, ["allianceCoatLayoutID", "allianceCoatLayoutId", "alliancecoatlayoutid", "alliancecoatlayoutID"]) || detail.id || "");
  const localized = ctx.lang?.[`alliancecoat_layout_name_${id}`];
  const comment = getProp(layout, ["comment1", "comment2", "name", "Name"]);
  return localized || comment || `Alliance CoA ${id || ""}`.trim();
}

function getAllianceLayoutImageUrl(layout, detail, ctx) {
  if (detail.imageUrl) return detail.imageUrl;
  const id = String(getProp(layout, ["allianceCoatLayoutID", "allianceCoatLayoutId", "alliancecoatlayoutid", "alliancecoatlayoutID"]) || detail.id || "");
  return ctx.allianceLayoutImageUrlMap?.[id] || null;
}

function renderAllianceLayoutModal(detail, ctx) {
  const layout = findEntity("alliance_layout", detail.id, ctx);
  if (!layout) return false;

  const name = getAllianceLayoutDetailName(layout, detail, ctx);
  const imageUrl = getAllianceLayoutImageUrl(layout, detail, ctx);
  const effectsRaw = getProp(layout, ["effects", "Effects"]) || "";
  const effects = parseEquipmentEffects(effectsRaw, "alliance_layout", ctx);
  const modalEl = createInfoCardModalElement();

  modalEl.classList.add("reward-equipment-modal");
  modalEl.classList.add("reward-alliance-layout-modal");
  modalEl.classList.remove("reward-decoration-modal");
  modalEl.classList.remove("reward-construction-modal");
  modalEl.querySelector(".modal-title").textContent = name;
  modalEl.querySelector("#rewardInfoCardModalBody").innerHTML = `
    <article class="reward-equipment-card box-content">
      <div class="reward-equipment-visual">
        <div class="reward-equipment-image">
          ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name)}" loading="lazy">` : "<span>?</span>"}
        </div>
      </div>
      <div class="reward-equipment-content">
        <ul class="effect-list reward-equipment-effects">
          ${effects.length ? effects.map((line) => `<li class="reward-effect-row">${escapeHtml(line)}</li>`).join("") : `<li class="reward-effect-row">No effect data</li>`}
        </ul>
      </div>
    </article>
  `;
  getInfoCardModal().open();
  return true;
}

function createLootRewardCell(entry) {
  const attrs = rewardDetailAttrs({
    type: entry.type,
    id: entry.id || "",
    name: entry.name,
    amount: entry.amount,
    imageUrl: entry.imageUrl || ""
  });
  const composedAttrs = getComposedAttrs(entry);
  const isClickable = attrs.trim() !== "";
  const core = `
    <div class="loot-reward${isClickable ? " loot-reward-clickable" : ""}" title="${escapeHtml(entry.id ? `${entry.type}=${entry.id}` : entry.type || "")}" ${isClickable ? 'role="button" tabindex="0"' : ""} ${attrs}>
      ${entry.imageUrl ? `<img src="${escapeHtml(entry.imageUrl)}" ${composedAttrs}>` : ""}
      <div class="loot-amount">
        <span>${escapeHtml(entry.amount ?? 1)}</span>
      </div>
    </div>
  `;

  return core;
}

function createLootRow(card, ctx) {
  const row = document.createElement("div");
  row.className = `loot-row rarity-${card.rarity}`;
  row.innerHTML = `
<div class="loot-rarity">
  ${escapeHtml(getRarityLabel(card.rarity, ctx))}
</div>


    <div class="loot-chance">
      ${escapeHtml(formatPercent(card.chance))}
    </div>

    <div class="loot-rewards">
      ${card.rewards.flatMap((reward) => getRewardEntries(reward, ctx)).map(createLootRewardCell).join("")}
    </div>
  `;
  return row;
}

function renderRewardPool(detail, ctx) {
  const type = normalizeType(detail.type);
  const entity = findEntity(type, detail.id, ctx);
  const tombolaId = type === "lootbox"
    ? getProp(entity, ["lootBoxTombolaID", "lootBoxTombolaId", "lootboxtombolaid"])
    : detail.id;
  const tombolaEntries = getTombolaEntries(tombolaId, ctx);
  const selectedRarity = type === "lootbox" ? getLootBoxSelectedRarity(detail, ctx) : "";

  if (!tombolaEntries.length) return false;

  const cardsRaw = tombolaEntries.map((tombolaEntry) => {
    const rewardIds = String(getProp(tombolaEntry, ["rewardIDs", "rewardIds", "rewardids"]) || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const rewards = rewardIds
      .map((rewardId) => ctx.rewardsById?.[String(rewardId)])
      .filter(Boolean);
    return {
      rarity: getEntryRarity(tombolaEntry, rewards),
      shares: Number(getProp(tombolaEntry, ["shares", "Shares"]) || 0),
      rewards
    };
  }).filter((card) => card.rewards.length > 0)
    .filter((card) => isAllowedByLootBoxKey(card.rarity, selectedRarity));

  const cards = cardsRaw
    .map((card) => ({
      ...card,
      order: RARITY_ORDER[card.rarity] || 99
    }))
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return b.shares - a.shares;
    });

  const totalShares = cards.reduce((sum, card) => sum + card.shares, 0);
  cards.forEach((card) => {
    card.chance = totalShares > 0 ? (card.shares / totalShares) * 100 : 0;
  });

  const modalEl = createLootBoxModalElement();
  modalEl.querySelector(".modal-title").textContent = getRewardPoolTitle(type, detail, entity, ctx);
  const container = modalEl.querySelector("#lootBoxRewards");
  container.innerHTML = "";

  if (cards.length === 0) {
    container.innerHTML = `<div class="col-12 filter-empty-message">No rewards</div>`;
  } else {
    cards.forEach((card) => container.appendChild(createLootRow(card, ctx)));
  }

  getLootBoxModal().open();
  void hydrateComposedImages({
    root: container,
    selector: 'img[data-compose-equipment="1"]:not([data-compose-ready])',
    cache: composedRewardImageCache
  });

  return true;
}

const STAT_ICONS = {
  supplyFood: "../../img_base/foodwastage.png",
  supplyMead: "../../img_base/meadwastage.png",
  supplyBeef: "../../img_base/beefwastage.png",
  rangedAttack: "../../img_base/battle_simulator/ranged-icon.png",
  meleeAttack: "../../img_base/battle_simulator/melee-icon.png",
  meleeDefence: "../../img_base/battle_simulator/castellan-modal1.png",
  rangeDefence: "../../img_base/battle_simulator/castellan-modal2.png",
  might: "../../img_base/might.png",
  lootValue: "../../img_base/battle_simulator/loot-icon.png",
  speed: "../../img_base/battle_simulator/travelSpeed-icon.png",
  recruitmentTime: "../../img_base/time.png",
  costC1: "../../img_base/coin.png",
  offRangeBonus: "../../img_base/battle_simulator/ranged-icon.png",
  offMeleeBonus: "../../img_base/battle_simulator/melee-icon.png",
  wallBonus: "../../img_base/battle_simulator/wall-icon.png",
  gateBonus: "../../img_base/battle_simulator/gate-icon.png",
  moatBonus: "../../img_base/battle_simulator/moat-icon.png",
  defRangeBonus: "../../img_base/battle_simulator/castellan-modal2.png",
  defMeleeBonus: "../../img_base/battle_simulator/castellan-modal1.png",
  amountPerWave: "../../img_base/battle_simulator/additionalWave-icon.png",
  unitLimit: "../../img_base/battle_simulator/unitLimit-icon.png",
  fameBonus: "../../img_base/battle_simulator/glory-icon.png",
  killMeleeTroopsYard: "../../img_base/battle_simulator/killMeleeTroopsYard-icon.png",
  killRangedTroopsYard: "../../img_base/battle_simulator/killRangedTroopsYard-icon.png",
  killAnyTroopsYard: "../../img_base/battle_simulator/killAnyTroopsYard-icon.png",
  killMeleeTroopsYardDefense: "../../img_base/battle_simulator/killMeleeTroopsYardDefense-icon.png",
  killRangedTroopsYardDefense: "../../img_base/battle_simulator/killRangedTroopsYardDefense-icon.png",
  killAnyTroopsYardDefense: "../../img_base/battle_simulator/killAnyTroopsYardDefense-icon.png",
  woodCost: "../../img_base/wood.png",
  stoneCost: "../../img_base/stone.png",
  gallantryBonus: "../../img_base/gallantryBoost.png",
  rageBonus: "../../img_base/rageBoost.png",
  xpBonus: "../../img_base/xpBoost.png",
  unknown: "../../img_base/placeholder.webp"
};

const EFFECT_ICON_RULES = [
  { pattern: /ranged?.*defen[cs]e|defen[cs]e.*ranged?|ranged?.*defen[cs]e units/i, icon: STAT_ICONS.defRangeBonus },
  { pattern: /melee.*defen[cs]e|defen[cs]e.*melee|melee.*defen[cs]e units/i, icon: STAT_ICONS.defMeleeBonus },
  { pattern: /additionalwaves|amountperwave|attackunitamount|attack\s*waves|tool\s*limit/i, icon: STAT_ICONS.amountPerWave },
  { pattern: /increase the wall capacity for defenders|wall capacity/i, icon: "../../img_base/battle_simulator/castellan-modal3.png" },
  { pattern: /bonuswallcapacity|wall/i, icon: STAT_ICONS.wallBonus },
  { pattern: /gate/i, icon: STAT_ICONS.gateBonus },
  { pattern: /moat/i, icon: STAT_ICONS.moatBonus },
  { pattern: /killdefendingmeleetroopsyard/i, icon: STAT_ICONS.killMeleeTroopsYard },
  { pattern: /killdefendingrangedtroopsyard/i, icon: STAT_ICONS.killRangedTroopsYard },
  { pattern: /killdefendinganytroopsyard/i, icon: STAT_ICONS.killAnyTroopsYard },
  { pattern: /killattackingmeleetroopsyard/i, icon: STAT_ICONS.killMeleeTroopsYardDefense },
  { pattern: /killattackingrangedtroopsyard/i, icon: STAT_ICONS.killRangedTroopsYardDefense },
  { pattern: /killattackinganytroopsyard/i, icon: STAT_ICONS.killAnyTroopsYardDefense },
  { pattern: /difficultyscalingdefenseboostyard|bonusyarddefensepower|attackboostyard|courtyard|yard/i, icon: "../../img_base/battle_simulator/cy-icon.png" },
  { pattern: /fame|glory/i, icon: STAT_ICONS.fameBonus },
  { pattern: /loot/i, icon: STAT_ICONS.lootValue },
  { pattern: /speed|time|recruit|production/i, icon: STAT_ICONS.recruitmentTime },
  { pattern: /ranged|range/i, icon: STAT_ICONS.rangedAttack },
  { pattern: /melee/i, icon: STAT_ICONS.meleeAttack },
  { pattern: /defense|defence/i, icon: STAT_ICONS.rangeDefence },
  { pattern: /attack/i, icon: STAT_ICONS.rangedAttack }
];

const FORCE_PLUS_PERCENT_EFFECT_NAMES = new Set([
  "bonuswallcapacity",
  "bonusdefencepower",
  "bonusyarddefensepower",
  "difficultyscalingdefenseboostyard"
]);

function formatStatValue(value) {
  if (value === undefined || value === null) return "-";
  const raw = String(value).trim();
  if (!raw) return "-";
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    const num = Number(raw);
    if (!Number.isNaN(num)) return num.toLocaleString();
  }
  return raw;
}

function formatDurationMinSec(secondsValue) {
  const raw = String(secondsValue ?? "").trim();
  if (!raw || raw === "-") return "-";
  const total = Number(raw.replace(/,/g, ""));
  if (Number.isNaN(total)) return raw;
  const secsTotal = Math.max(0, Math.floor(total));
  const hours = Math.floor(secsTotal / 3600);
  const mins = Math.floor((secsTotal % 3600) / 60);
  const secs = secsTotal % 60;
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${pad2(hours)}:${pad2(mins)}:${pad2(secs)}`;
}

function formatPlusPercent(value, sign = "+") {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-") return raw || "-";
  if (raw === "0" || raw === "0.0") return "0";
  if (raw.endsWith("%")) return raw.startsWith("+") || raw.startsWith("-") ? raw : `${sign}${raw}`;
  if (raw.startsWith("+") || raw.startsWith("-")) return `${raw}%`;
  return `${sign}${raw}%`;
}

function formatSignedPercent(value, sign = "+") {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-") return raw || "-";
  if (raw === "0" || raw === "0.0") return "0";
  if (raw.endsWith("%")) {
    if (sign === "-" && raw.startsWith("+")) return `-${raw.slice(1)}`;
    return raw.startsWith("+") || raw.startsWith("-") ? raw : `${sign}${raw}`;
  }
  if (sign === "-" && raw.startsWith("+")) return `-${raw.slice(1)}%`;
  if (raw.startsWith("+") || raw.startsWith("-")) return `${raw}%`;
  return `${sign}${raw}%`;
}

function isZeroStat(value) {
  const n = Number(String(value).replace("%", ""));
  return !Number.isNaN(n) && n === 0;
}

function getFirstProp(entity, names, fallback = "-") {
  for (const name of names) {
    const value = getProp(entity, [name]);
    if (value !== undefined && value !== null && String(value).trim() !== "") return formatStatValue(value);
  }
  return fallback;
}

function getUnitModalLabels(ctx) {
  const lang = ctx.lang || {};
  return {
    rangedAttack: lang["attackpower_range"] || "Ranged attack power",
    meleeAttack: lang["attackpower_melee"] || "Melee attack power",
    rangedDefence: lang["defensepower_range"] || "Ranged defense power",
    meleeDefence: lang["defensepower_melee"] || "Melee defense power",
    speed: "Travel speed",
    loot: lang["lootplace"] || lang["dialog_battlelog_loot"] || "Loot",
    might: lang["playermight"] || "Might points",
    food: lang["foodwastage"] || "Food consumption",
    mead: lang["meadwastage"] || "Mead consumption",
    beef: lang["beefwastage"] || "Beef consumption",
    recruitmentTime: lang["recruitspeed"] || "Recruitment speed",
    productionSpeed: lang["productionspeed"] || "Production speed",
    productionCost: lang["productioncost"] || "Production cost",
    recruitmentCost: "Recruitment cost",
    rangedAttackBonus: lang["offrangebonus"] || "Ranged attack bonus",
    meleeAttackBonus: lang["attackpower_melee"] || lang["offmeleebonus"] || "Melee attack bonus",
    rangedDefenseBonus: lang["defrangebonus"] || "Ranged defense bonus",
    meleeDefenseBonus: lang["defmeleebonus"] || "Melee defense bonus",
    wallBonus: lang["wallprotection"] || "Wall bonus",
    gateBonus: lang["gateprotection"] || "Gate bonus",
    moatBonus: lang["moatprotection"] || "Moat bonus",
    fameBonus: lang["dialog_fame_fame"] || "Fame bonus",
    khanTabletBooster: lang["nomadebooster_name"] || "Khan tablet booster",
    khanMedalBooster: lang["khanmedalbooster_name"] || "Khan medal booster",
    samuraiTokenBooster: lang["samuraibooster_name"] || "Samurai token booster",
    pearlBooster: lang["pearlbooster_name"] || "Pearl bonus",
    pointBonus: lang["gallantrybooster_name"] || "Point bonus",
    xpBonus: lang["xpbooster_name"] || "XP bonus",
    c1Bonus: lang["currency_name_currency1"] || "C1 bonus",
    ragePointBonus: lang["ragebooster_name"] || "Rage point bonus",
    reputationBonus: lang["reputationbooster_name"] || "Reputation bonus",
    attackWaves: "Increase the number of available attack waves",
    toolLimit: lang["amountperwave"] || "Tool limit"
  };
}

function getSupplyInfo(entity, labels) {
  const food = getProp(entity, ["foodSupply", "supplyFood"]);
  if (food !== undefined && food !== null && String(food).trim() !== "") {
    return { title: labels.food, value: formatStatValue(food), iconUrl: STAT_ICONS.supplyFood };
  }
  const mead = getProp(entity, ["meadSupply"]);
  if (mead !== undefined && mead !== null && String(mead).trim() !== "") {
    return { title: labels.mead, value: formatStatValue(mead), iconUrl: STAT_ICONS.supplyMead };
  }
  const beef = getProp(entity, ["beefSupply"]);
  if (beef !== undefined && beef !== null && String(beef).trim() !== "") {
    return { title: labels.beef, value: formatStatValue(beef), iconUrl: STAT_ICONS.supplyBeef };
  }
  return { title: labels.food, value: "0", iconUrl: STAT_ICONS.supplyFood };
}

function getRecruitmentCostInfo(entity, labels) {
  const cost = getProp(entity, ["costC1", "costC2", "costC3", "costC4", "costWood", "costStone"]);
  return {
    title: labels.recruitmentCost,
    value: formatStatValue(cost || 0),
    iconUrl: STAT_ICONS.costC1,
    hasCost: Number(cost || 0) > 0
  };
}

function getCurrencyIcon(currencyKey, ctx, fallback = STAT_ICONS.unknown) {
  const key = normalizeName(currencyKey);
  const map = ctx.currencyImageUrlMap || ctx.collectableCurrencyImageUrlMap || {};
  return map?.[currencyKey] || map?.[key] || fallback;
}

function getCostComponentIcon(index, ctx) {
  return getCurrencyIcon(`component${index}`, ctx, STAT_ICONS.unknown);
}

function getToolBaseBonuses(entity, labels) {
  const toolTypeRaw = String(getProp(entity, ["typ", "Typ"]) || "").toLowerCase();
  const isAttackTool = toolTypeRaw.includes("attack");
  const isDefenceTool = toolTypeRaw.includes("defence");
  const hostileOrFriendlySign = () => {
    if (isAttackTool) return "-";
    if (isDefenceTool) return "+";
    return "+";
  };

  return [
    { iconUrl: STAT_ICONS.offRangeBonus, title: labels.rangedAttackBonus, value: formatPlusPercent(getProp(entity, ["offRangeBonus"]) || "0", "+"), hideIfZero: true },
    { iconUrl: STAT_ICONS.offMeleeBonus, title: labels.meleeAttackBonus, value: formatPlusPercent(getProp(entity, ["offMeleeBonus"]) || "0", "+"), hideIfZero: true },
    { iconUrl: STAT_ICONS.defRangeBonus, title: labels.rangedDefenseBonus, value: formatPlusPercent(getProp(entity, ["defRangeBonus"]) || "0", hostileOrFriendlySign()), hideIfZero: true },
    { iconUrl: STAT_ICONS.defMeleeBonus, title: labels.meleeDefenseBonus, value: formatPlusPercent(getProp(entity, ["defMeleeBonus"]) || "0", hostileOrFriendlySign()), hideIfZero: true },
    { iconUrl: STAT_ICONS.wallBonus, title: labels.wallBonus, value: formatPlusPercent(getProp(entity, ["wallBonus"]) || "0", hostileOrFriendlySign()), hideIfZero: true },
    { iconUrl: STAT_ICONS.gateBonus, title: labels.gateBonus, value: formatPlusPercent(getProp(entity, ["gateBonus"]) || "0", hostileOrFriendlySign()), hideIfZero: true },
    { iconUrl: STAT_ICONS.moatBonus, title: labels.moatBonus, value: formatPlusPercent(getProp(entity, ["moatBonus"]) || "0", hostileOrFriendlySign()), hideIfZero: true },
    { iconUrl: STAT_ICONS.fameBonus, title: labels.fameBonus, value: formatPlusPercent(getProp(entity, ["fameBonus"]) || "0", "+"), hideIfZero: true }
  ];
}

function hasPositiveNumber(entity, key, min = 0) {
  const n = Number(String(getProp(entity, [key]) ?? "").trim());
  return !Number.isNaN(n) && n > min;
}

function cleanupEffectTitle(text) {
  const raw = String(text || "");
  if (!raw) return "";
  let out = raw
    .replace(/\{\d+\}/g, "")
    .replace(/\s*[+\-]\s*%\s*/g, " ")
    .replace(/\s*[+\-]\s*(?=[a-zA-Z])/g, " ")
    .replace(/\s*%\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  out = out.replace(/[.!,;:\-]+$/g, "").trim();
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : "";
}

function getEffectDisplayNameLangKeys(effectName) {
  const key = String(effectName || "").toLowerCase();
  if (!key) return [];
  const keyWithoutToolPrefix = key.startsWith("tool") ? key.slice(4) : "";
  return [
    `equip_effect_description_${key}`,
    keyWithoutToolPrefix ? `equip_effect_description_${keyWithoutToolPrefix}` : null,
    `effect_name_${key}`,
    keyWithoutToolPrefix ? `effect_name_${keyWithoutToolPrefix}` : null,
    key,
    keyWithoutToolPrefix,
    `ci_effect_${key}`,
    keyWithoutToolPrefix ? `ci_effect_${keyWithoutToolPrefix}` : null,
    `effect_description_${key}`
  ].filter(Boolean);
}

function hasLocalizedEffectDisplayName(effectName, ctx) {
  const lang = ctx.lang || {};
  return getEffectDisplayNameLangKeys(effectName).some((langKey) => Boolean(lang[langKey]));
}

function shouldShowEffectArgName(effectName, title, template, ctx) {
  const effectKey = String(effectName || "").toLowerCase();
  const titleKey = String(title || "").toLowerCase();
  if (effectKey.includes("kill") || titleKey.includes("kill")) return true;
  return !template && !hasLocalizedEffectDisplayName(effectName, ctx);
}

function getEffectDisplayName(effectName, effectId, ctx) {
  const lang = ctx.lang || {};
  const key = String(effectName || "").toLowerCase();
  if (!key) return `Effect ${effectId}`;
  if (key === "attackboostyard") {
    return lang["attackboostyard"] || "Increase unit attack strength in the courtyard";
  }
  if (key === "difficultyscalingdefenseboostyard" || key === "bonusyarddefensepower") {
    return lang["effect_name_difficultyscalingdefenseboostyard"] || "Strength in courtyard when defending";
  }
  for (const langKey of getEffectDisplayNameLangKeys(effectName)) {
    const label = lang[langKey];
    if (label) return cleanupEffectTitle(String(label));
  }
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
}

function getEffectIcon(effectName, effectTitle = "") {
  const key = String(effectName || "").toLowerCase();
  const title = String(effectTitle || "").toLowerCase();
  const haystack = `${key} ${title}`;
  for (const rule of EFFECT_ICON_RULES) {
    if (rule.pattern.test(haystack)) return rule.icon;
  }
  return STAT_ICONS.unknown;
}

function splitToolEffectChunk(chunk) {
  const [effectIdRaw, payloadRaw = "0"] = String(chunk || "").split("&");
  const effectId = String(effectIdRaw || "").trim();
  if (!effectId) return null;
  const payload = String(payloadRaw || "").trim();
  let valueRaw = payload;
  let argId = null;
  const match = payload.match(/^(\d+)\+(-?\d+(?:\.\d+)?)$/);
  if (match) {
    argId = match[1];
    valueRaw = match[2];
  }
  return { effectId, valueRaw, argId };
}

function getEffectTemplate(effectName, ctx) {
  const lang = ctx.lang || {};
  const key = String(effectName || "").toLowerCase();
  if (!key) return "";
  const keyWithoutToolPrefix = key.startsWith("tool") ? key.slice(4) : "";
  return String(
    lang[`equip_effect_description_${key}`] ||
    (keyWithoutToolPrefix ? lang[`equip_effect_description_${keyWithoutToolPrefix}`] : "") ||
    lang[`effect_description_${key}`] ||
    (keyWithoutToolPrefix ? lang[`effect_description_${keyWithoutToolPrefix}`] : "") ||
    ""
  ).trim();
}

function resolveEffectArgName(argId, ctx) {
  const id = String(argId || "").trim();
  if (!id) return "";
  const unit = ctx.unitsById?.[id];
  if (!unit) return id;
  const typeKey = String(getProp(unit, ["type", "Type"]) || "").trim();
  if (typeKey) {
    const langKey = `${typeKey}_name`.toLowerCase();
    if (ctx.lang?.[langKey]) return String(ctx.lang[langKey]).trim();
  }
  return String(getProp(unit, ["comment2", "name", "Name", "type", "Type"]) || id).trim();
}

function buildToolDynamicEffects(entity, ctx) {
  const rawEffects = String(getProp(entity, ["effects"]) || "").trim();
  if (!rawEffects) return [];

  const list = [];
  rawEffects.split(",").map((x) => x.trim()).filter(Boolean).forEach((chunk) => {
    const token = splitToolEffectChunk(chunk);
    if (!token) return;
    const { effectId, valueRaw, argId } = token;
    const effect = ctx.effectsById?.[String(effectId)] || {};
    const effectName = getProp(effect, ["name", "Name"]) || `effect_${effectId}`;
    const effectNameLc = String(effectName).toLowerCase();
    const template = getEffectTemplate(effectName, ctx);
    const isPercent =
      ctx.percentEffectIDs?.has?.(String(effectId)) ||
      ctx.percentEffectIDs?.has?.(Number(effectId));
    const isNegativePercent = effectNameLc.includes("malus") || /^\s*-/.test(template);
    const forcePlusPercent = FORCE_PLUS_PERCENT_EFFECT_NAMES.has(effectNameLc);
    const autoPercentByName =
      /(bonus|boost|booster|protection)/.test(effectNameLc) &&
      !/(wave|amount|limit|kill|cost|time|speed)/.test(effectNameLc);
    const rawValue = String(valueRaw || "").trim();
    let value = formatStatValue(rawValue);
    if ((isPercent || forcePlusPercent || autoPercentByName) && rawValue && rawValue !== "-") {
      value = formatSignedPercent(rawValue, isNegativePercent ? "-" : "+");
    }

    let title = getEffectDisplayName(effectName, effectId, ctx);
    if (effectNameLc.includes("attackunitamount")) {
      title = getUnitModalLabels(ctx).toolLimit;
    }
    if (argId && shouldShowEffectArgName(effectName, title, template, ctx)) {
      const argName = resolveEffectArgName(argId, ctx);
      if (argName && !title.toLowerCase().includes(argName.toLowerCase())) {
        title = `${title} (${argName})`;
      }
    }
    list.push({ iconUrl: getEffectIcon(effectName, title), title, value });
  });

  return list;
}

function getUnitStats(entity, ctx) {
  const labels = getUnitModalLabels(ctx);
  const supply = getSupplyInfo(entity, labels);
  const cost = getRecruitmentCostInfo(entity, labels);
  const stats = [
    { iconUrl: STAT_ICONS.rangedAttack, title: labels.rangedAttack, value: getFirstProp(entity, ["rangeAttack", "rangedAttack", "attackRange", "rangedStrength"], "0") },
    { iconUrl: STAT_ICONS.meleeAttack, title: labels.meleeAttack, value: getFirstProp(entity, ["meleeAttack"], "0") },
    { iconUrl: STAT_ICONS.rangeDefence, title: labels.rangedDefence, value: getFirstProp(entity, ["rangeDefence"], "0") },
    { iconUrl: STAT_ICONS.meleeDefence, title: labels.meleeDefence, value: getFirstProp(entity, ["meleeDefence"], "0") },
    { iconUrl: STAT_ICONS.speed, title: labels.speed, value: getFirstProp(entity, ["speed"]) },
    { iconUrl: STAT_ICONS.lootValue, title: labels.loot, value: getFirstProp(entity, ["lootValue"]) },
    { iconUrl: STAT_ICONS.might, title: labels.might, value: getFirstProp(entity, ["mightValue", "might"]) },
    supply
  ].filter((stat) => !isZeroStat(stat.value) || ![
    labels.rangedAttack,
    labels.meleeAttack,
    labels.rangedDefence,
    labels.meleeDefence
  ].includes(stat.title));

  const recruitmentTime = formatDurationMinSec(getProp(entity, ["recruitmentTime"]));
  if (cost.hasCost && recruitmentTime !== "-" && recruitmentTime !== "00:00:00") {
    stats.push(cost, { iconUrl: STAT_ICONS.recruitmentTime, title: labels.recruitmentTime, value: recruitmentTime });
  }
  return stats;
}

function getToolStats(entity, ctx) {
  const labels = getUnitModalLabels(ctx);
  const productionSpeedValue = formatDurationMinSec(getProp(entity, ["recruitmentTime"]));
  const hasProductionSpeed =
    productionSpeedValue !== "-" &&
    productionSpeedValue !== "00:00:00";
  const cost = getRecruitmentCostInfo(entity, labels);
  const hasProductionCost =
    hasPositiveNumber(entity, "costWood") ||
    hasPositiveNumber(entity, "costStone") ||
    hasPositiveNumber(entity, "costSceatToken", 1) ||
    hasPositiveNumber(entity, "costLegendaryToken", 1) ||
    hasPositiveNumber(entity, "costComponent1") ||
    hasPositiveNumber(entity, "costComponent2") ||
    hasPositiveNumber(entity, "costComponent3") ||
    hasPositiveNumber(entity, "costComponent4") ||
    hasPositiveNumber(entity, "costComponent5") ||
    hasPositiveNumber(entity, "costComponent6") ||
    hasPositiveNumber(entity, "costComponent7") ||
    hasPositiveNumber(entity, "costComponent8") ||
    Boolean(cost?.hasCost);

  const rawStats = [
    { iconUrl: STAT_ICONS.speed, title: labels.speed, value: getFirstProp(entity, ["speed"]) },
    { iconUrl: STAT_ICONS.lootValue, title: labels.loot, value: getFirstProp(entity, ["lootValue"], "0") },
    ...getToolBaseBonuses(entity, labels),
    ...buildToolDynamicEffects(entity, ctx),
    { iconUrl: STAT_ICONS.unitLimit, title: labels.toolLimit, value: getFirstProp(entity, ["amountPerWave"], "0") },
    { iconUrl: getCurrencyIcon("khantablet", ctx), title: labels.khanTabletBooster, value: formatPlusPercent(getProp(entity, ["khanTabletBooster"]) || "0", "+") },
    { iconUrl: getCurrencyIcon("khanmedal", ctx), title: labels.khanMedalBooster, value: formatPlusPercent(getProp(entity, ["khanMedalBooster"]) || "0", "+") },
    { iconUrl: getCurrencyIcon("samuraitoken", ctx), title: labels.samuraiTokenBooster, value: formatPlusPercent(getProp(entity, ["samuraiTokenBooster"]) || "0", "+") },
    { iconUrl: getCurrencyIcon("pearlrelic", ctx), title: labels.pearlBooster, value: formatPlusPercent(getProp(entity, ["pearlBooster"]) || "0", "+") },
    { iconUrl: STAT_ICONS.gallantryBonus, title: labels.pointBonus, value: formatPlusPercent(getProp(entity, ["pointBonus"]) || "0", "+") },
    { iconUrl: STAT_ICONS.xpBonus, title: labels.xpBonus, value: formatPlusPercent(getProp(entity, ["xpBonus"]) || "0", "+") },
    { iconUrl: STAT_ICONS.costC1, title: labels.c1Bonus, value: formatPlusPercent(getProp(entity, ["c1Bonus"]) || "0", "+") },
    { iconUrl: STAT_ICONS.rageBonus, title: labels.ragePointBonus, value: formatPlusPercent(getProp(entity, ["ragePointBonus"]) || "0", "+") },
    { iconUrl: STAT_ICONS.unknown, title: labels.reputationBonus, value: formatPlusPercent(getProp(entity, ["reputationBonus"]) || "0", "+") },
    { iconUrl: STAT_ICONS.might, title: labels.might, value: getFirstProp(entity, ["mightValue", "might"]) }
  ];

  if (hasProductionSpeed && hasProductionCost) {
    rawStats.push(
      { iconUrl: STAT_ICONS.recruitmentTime, title: labels.productionSpeed, value: productionSpeedValue },
      { iconUrl: STAT_ICONS.woodCost, title: labels.productionCost, value: getFirstProp(entity, ["costWood"], "0") },
      { iconUrl: STAT_ICONS.stoneCost, title: labels.productionCost, value: getFirstProp(entity, ["costStone"], "0") },
      { iconUrl: STAT_ICONS.unknown, title: labels.productionCost, value: getFirstProp(entity, ["costSceatToken"], "0"), hideIfOne: true },
      { iconUrl: STAT_ICONS.unknown, title: labels.productionCost, value: getFirstProp(entity, ["costLegendaryToken"], "0"), hideIfOne: true },
      { iconUrl: getCostComponentIcon(1, ctx), title: labels.productionCost, value: getFirstProp(entity, ["costComponent1"], "0") },
      { iconUrl: getCostComponentIcon(2, ctx), title: labels.productionCost, value: getFirstProp(entity, ["costComponent2"], "0") },
      { iconUrl: getCostComponentIcon(3, ctx), title: labels.productionCost, value: getFirstProp(entity, ["costComponent3"], "0") },
      { iconUrl: getCostComponentIcon(4, ctx), title: labels.productionCost, value: getFirstProp(entity, ["costComponent4"], "0") },
      { iconUrl: getCostComponentIcon(5, ctx), title: labels.productionCost, value: getFirstProp(entity, ["costComponent5"], "0") },
      { iconUrl: getCostComponentIcon(6, ctx), title: labels.productionCost, value: getFirstProp(entity, ["costComponent6"], "0") },
      { iconUrl: getCostComponentIcon(7, ctx), title: labels.productionCost, value: getFirstProp(entity, ["costComponent7"], "0") },
      { iconUrl: getCostComponentIcon(8, ctx), title: labels.productionCost, value: getFirstProp(entity, ["costComponent8"], "0") },
      { iconUrl: cost.iconUrl, title: labels.productionCost, value: cost.value }
    );
  }

  const filtered = rawStats
    .filter((stat) => stat.value !== "-" && stat.value !== "" && !isZeroStat(stat.value));
  const visible = filtered.filter((stat) => !(stat.hideIfOne && String(stat.value).trim() === "1"));
  const speedIndex = visible.findIndex((stat) => stat.title === labels.speed);
  if (speedIndex === 0) visible.push(visible.shift());
  return visible;
}

function getUnitDisplayTitle(entity, ctx) {
  const name = getDisplayName("unit", entity, {}, ctx);
  const level = getProp(entity, ["level", "Level", "lvl", "Lvl"]);
  return level === undefined || level === null || String(level).trim() === ""
    ? name
    : `${name} (Lvl.${level})`;
}

function renderUnitToolModal(detail, ctx) {
  const entity = findEntity("unit", detail.id, ctx);
  if (!entity) return false;
  const stats = isToolEntity(entity) ? getToolStats(entity, ctx) : getUnitStats(entity, ctx);
  const modalEl = createUnitStatsModalElement();
  const titleEl = modalEl.querySelector(".modal-title");
  const bodyEl = modalEl.querySelector("#unitStatsModalBody");
  const resolvedTitle = getUnitDisplayTitle(entity, ctx);
  titleEl.textContent = resolvedTitle || detail.name || "Details";
  bodyEl.innerHTML = `
    <div class="unit-modal-layout">
      <div class="unit-modal-list">${stats.map((stat) => `
        <div class="unit-modal-row">
          <span class="unit-modal-icon"><img src="${escapeHtml(stat.iconUrl)}" alt="${escapeHtml(stat.title)}" class="stat-icon"></span>
          <span class="unit-modal-label">${escapeHtml(stat.title)}</span>
          <span class="unit-modal-value">${escapeHtml(stat.value)}</span>
        </div>
      `).join("")}</div>
    </div>
  `;
  getUnitStatsModal().open();
  return true;
}

export function initRewardDetailModal({ getContext }) {
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-copy-unit-id], [data-copy-equipment-id], [data-copy-decoration-id], [data-copy-effect-item-id]")) return;

    const trigger = event.target.closest("[data-reward-detail]");
    if (!trigger) return;

    const detail = {
      type: trigger.dataset.rewardType || "",
      id: trigger.dataset.rewardId || "",
      name: trigger.dataset.rewardName || "",
      amount: trigger.dataset.rewardAmount || "",
      imageUrl: trigger.dataset.rewardImage || ""
    };
    const ctx = getContext?.() || {};
    const type = normalizeType(detail.type);

    if (type === "lootbox" && typeof ctx.openLootBoxModal === "function") {
      event.preventDefault();
      event.stopPropagation();
      ctx.openLootBoxModal(detail);
      return;
    }

    if (type === "offering" && typeof ctx.openOfferingModal === "function") {
      event.preventDefault();
      event.stopPropagation();
      ctx.openOfferingModal(detail);
      return;
    }

    if ((type === "unit" || type === "tool") && typeof ctx.openUnitToolModal === "function") {
      event.preventDefault();
      event.stopPropagation();
      ctx.openUnitToolModal(detail);
      return;
    }

    if ((type === "unit" || type === "tool") && renderUnitToolModal(detail, ctx)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (type === "decoration" && renderDecorationModal(detail, ctx)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (type === "construction" && renderConstructionModal(detail, ctx)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if ((type === "equipment" || type === "gem") && renderEquipmentGemModal(detail, ctx)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (type === "alliance_layout" && renderAllianceLayoutModal(detail, ctx)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if ((type === "lootbox" || type === "offering") && renderRewardPool(detail, ctx)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }, true);

  return null;
}

export function rewardDetailAttrs({ type, id, name, amount, imageUrl }) {
  const normalizedType = normalizeType(type);
  if (!["lootbox", "offering", "unit", "tool", "decoration", "construction", "equipment", "gem", "alliance_layout"].includes(normalizedType)) return "";
  return [
    `data-reward-detail="1"`,
    `data-reward-type="${escapeHtml(normalizedType || "")}"`,
    `data-reward-id="${escapeHtml(id || "")}"`,
    `data-reward-name="${escapeHtml(name || "")}"`,
    `data-reward-amount="${escapeHtml(amount || "")}"`,
    `data-reward-image="${escapeHtml(imageUrl || "")}"`
  ].join(" ");
}
