import { initAutoHeight } from "../shared/ResizeService.mjs";
import { createLoader } from "../shared/LoadingService.mjs";
import { coreInit } from "../shared/CoreInit.mjs";
import { initLanguageSelector, getInitialLanguage } from "../shared/LanguageService.mjs";
import { deriveCompanionUrls } from "../shared/AssetComposer.mjs";
import { hydrateComposedImages } from "../shared/ComposeHydrator.mjs";
import { normalizeName } from "../shared/RewardResolver.mjs";

let lang = {};
let effectCtx = null;
let equipmentSets = [];
let setIndexById = {};
let slotById = {};
let wearerById = {};
let unitsById = {};
let equipmentUniqueImageUrlMap = {};
let uniqueGemImageUrlMap = {};
let equipmentEffectToEffectId = {};
let ownLang = {};

const loader = createLoader();
const composedImageCache = new Map();
let currentLanguage = getInitialLanguage();

const SLOT_ORDER = {
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "6": 5,
  "gem": 6
};

async function loadOwnLang() {
  try {
    const res = await fetch("./ownLang.json");
    const raw = await res.json();

    function normalize(obj) {
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        return Object.fromEntries(
          Object.entries(obj).map(([k, v]) => [k.toLowerCase(), normalize(v)])
        );
      }
      if (Array.isArray(obj)) return obj.map(normalize);
      return obj;
    }

    ownLang = normalize(raw);
  } catch (err) {
    console.error("ownLang error:", err);
    ownLang = {};
  }
}

function ui(key, fallback) {
  return ownLang[currentLanguage?.toLowerCase()]?.ui?.[key] || fallback;
}

function getArray(data, names) {
  for (const name of names) {
    if (Array.isArray(data?.[name])) return data[name];
  }
  return [];
}

function buildLookup(array, idKey) {
  const map = {};
  (array || []).forEach((item) => {
    if (!item) return;
    const id = item[idKey];
    if (id !== undefined && id !== null) map[String(id)] = item;
  });
  return map;
}

function normalizeSetId(value) {
  const s = String(value || "").trim();
  if (!s || s === "0") return null;
  return s;
}

function cleanTemplateText(text) {
  return String(text || "")
    .replace(/\{\d+\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitEffectToken(token) {
  const [idRaw, valueRaw = "0"] = String(token || "").split("&");
  const id = String(idRaw || "").trim();
  if (!id) return null;

  let valuePart = String(valueRaw || "").trim();
  let argId = null;
  if (valuePart.includes("+")) {
    const [argPart, actual] = valuePart.split("+");
    argId = String(argPart || "").trim() || null;
    valuePart = actual ?? valuePart;
  }

  const parsed = Number(valuePart);
  return {
    id,
    value: Number.isFinite(parsed) ? parsed : 0,
    argId
  };
}

function resolveEffectId(effectId) {
  const raw = String(effectId || "").trim();
  if (!raw) return raw;
  const mapped = equipmentEffectToEffectId[raw];
  if (mapped) return String(mapped);
  if (effectCtx?.effectDefinitions?.[raw]) return raw;
  return raw;
}

function formatEffectValue(effectId, value) {
  const resolvedEffectId = resolveEffectId(effectId);
  const isPercent = Boolean(effectCtx?.percentEffectIDs?.has?.(String(resolvedEffectId)));
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const numberText = Math.abs(Number(value)).toLocaleString();
  return `${sign}${numberText}${isPercent ? "%" : ""}`;
}

function formatTemplateValue(template, effectId, value) {
  const resolvedEffectId = resolveEffectId(effectId);
  const isPercent = Boolean(effectCtx?.percentEffectIDs?.has?.(String(resolvedEffectId)));
  const absText = Math.abs(Number(value)).toLocaleString();
  const signedText = value > 0 ? `+${absText}` : value < 0 ? `-${absText}` : "0";

  const hasSignAroundPlaceholder =
    /[+\-]\s*\{0\}/.test(template) ||
    /\{0\}\s*[+\-]/.test(template);

  const hasPercentAroundPlaceholder =
    /\{0\}\s*%/.test(template) ||
    /%\s*\{0\}/.test(template);

  let token = hasSignAroundPlaceholder ? absText : signedText;

  if (isPercent && !hasPercentAroundPlaceholder) {
    token += "%";
  }

  return token;
}

function getEffectLabel(effectId) {
  const resolvedEffectId = resolveEffectId(effectId);
  const effectDef = effectCtx?.effectDefinitions?.[String(resolvedEffectId)] || null;
  const rawName = String(effectDef?.name || "").trim();

  if (!rawName) return `Effect ${resolvedEffectId || effectId}`;

  const directOverride = {
    charmboost: "additionalwaves"
  };

  const key = rawName.toLowerCase();
  const normalizedKey = directOverride[key] || key;
  const strippedShapeKey = normalizedKey.endsWith("shapeshifter")
    ? normalizedKey.replace(/shapeshifter$/i, "")
    : null;

  const candidates = [
    strippedShapeKey ? `equip_effect_description_short_${strippedShapeKey}` : null,
    strippedShapeKey ? `equip_effect_description_${strippedShapeKey}` : null,
    strippedShapeKey ? `ci_effect_${strippedShapeKey}` : null,
    strippedShapeKey ? `effect_name_${strippedShapeKey}` : null,
    strippedShapeKey,
    `equip_effect_description_short_${normalizedKey}`,
    `equip_effect_description_${normalizedKey}`,
    `ci_effect_${normalizedKey}`,
    `effect_name_${normalizedKey}`,
    `effect_desc_${normalizedKey}`,
    normalizedKey,
    `equip_effect_description_short_${key}`,
    `equip_effect_description_${key}`,
    `ci_effect_${key}`,
    `effect_name_${key}`,
    `effect_desc_${key}`,
    key
  ].filter(Boolean);

  for (const c of candidates) {
    const value = lang[c];
    if (!value) continue;
    const text = String(value);
    if (/lost its powers|seems to have run out|örökség|elvesztette erejét/i.test(text)) {
      continue;
    }
    return text;
  }

  return rawName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}

function renderEffectLine(effectId, value) {
  const template = getEffectLabel(effectId);
  const entryArgId = arguments.length > 2 ? String(arguments[2] || "").trim() : "";

  const resolveUnitName = (unitId) => {
    if (!unitId) return "";
    const unit = unitsById[String(unitId)];
    if (!unit) return unitId;

    const typeKey = String(unit.type || "").trim();
    if (typeKey) {
      const langKey = `${typeKey}_name`.toLowerCase();
      if (lang[langKey]) return lang[langKey];
    }

    return unit.comment2 || unit.name || unit.type || unitId;
  };

  if (template.includes("{0}")) {
    const token = formatTemplateValue(template, effectId, value);
    let text = template
      .replace(/\{0\}/g, token)
      .replace(/\{1\}/g, entryArgId ? resolveUnitName(entryArgId) : "")
      .replace(/\{2\}/g, "")
      .replace(/\{\d+\}/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return text;
  }

  const valueText = formatEffectValue(effectId, value);
  const cleaned = cleanTemplateText(template);
  return `${cleaned}${cleaned.endsWith(":") ? "" : ":"} ${valueText}`;
}

function parseEffects(raw) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map(splitEffectToken)
    .filter(Boolean)
    .map((entry) => renderEffectLine(entry.id, entry.value, entry.argId));
}

function parseEffectTokens(raw) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map(splitEffectToken)
    .filter(Boolean);
}

function sortEffectTokensByValueDesc(tokens) {
  return (tokens || [])
    .slice()
    .sort((a, b) => {
      const valueDiff = Number(b.value || 0) - Number(a.value || 0);
      if (valueDiff !== 0) return valueDiff;
      return Number(a.id || 0) - Number(b.id || 0);
    });
}

function getLocalizedWearerName(wearerId) {
  const wearer = wearerById[String(wearerId)];
  if (!wearer) return `Wearer ${wearerId}`;

  const raw = String(wearer.name || "").toLowerCase();
  if (raw.includes("baron")) {
    return (
      lang["equipment_itemtype_baron"] ||
      lang["equipment_itemType_baron"] ||
      lang["dialog_allianceCrestGenerator_castellan_tab"] ||
      "Castellan"
    );
  }
  if (raw.includes("general")) {
    return (
      lang["equipment_itemtype_general"] ||
      lang["equipment_itemType_general"] ||
      lang["dialog_allianceCrestGenerator_commander_tab"] ||
      "Commander"
    );
  }

  return wearer.name || `Wearer ${wearerId}`;
}

function getLocalizedSlotName(slotId) {
  const slot = slotById[String(slotId)];
  const raw = String(slot?.name || "").toLowerCase();
  const byRawToFilterKey = {
    helmet: "filters_subfilter_1",
    armor: "filters_subfilter_2",
    weapon: "filters_subfilter_3",
    artifact: "filters_subfilter_4",
    look: "filters_subfilter_5",
    skin: "filters_subfilter_5",
    hero: "filters_subfilter_6",
    heroes: "filters_subfilter_6"
  };
  const mappedKey = byRawToFilterKey[raw];
  if (mappedKey && lang[mappedKey]) return lang[mappedKey];
  if (!raw) return `Slot ${slotId}`;

  const candidates = [
    `equipmentslot_name_${raw}`,
    `dialog_equipment_slot_${raw}`,
    raw
  ];

  for (const key of candidates) {
    if (lang[key]) return lang[key];
  }

  return raw;
}

function getEquipmentName(item) {
  if (!item) return "Equipment";
  const id = String(item.equipmentID || "");
  const langKey = `equipment_unique_${id}`.toLowerCase();
  return lang[langKey] || item.comment2 || item.comment1 || `Equipment ${id}`;
}

function getEquipmentImageUrl(item) {
  if (!item) return null;
  const ownId = String(item.equipmentID || "");
  const reuseId = String(item.reuseAssetOfEquipmentID || "");

  if (ownId && equipmentUniqueImageUrlMap[ownId]) {
    return equipmentUniqueImageUrlMap[ownId];
  }

  if (reuseId && equipmentUniqueImageUrlMap[reuseId]) {
    return equipmentUniqueImageUrlMap[reuseId];
  }

  return null;
}

function getGemName(item) {
  if (!item) return "Gem";
  const key = `gem_unique_${String(item.gemID || "")}`.toLowerCase();
  return lang[key] || item.comment2 || item.comment1 || `Gem ${item.gemID}`;
}

function getSetTitle(setEntry) {
  const setId = String(setEntry?.id || "").trim();
  if (setId) {
    const langKey = `equipment_set_${setId}`.toLowerCase();
    if (lang[langKey]) return lang[langKey];
    const directKey = `equipment_set_${setId}`;
    if (lang[directKey]) return lang[directKey];
  }

  const fromBonus = setEntry.bonuses.find((x) => String(x.comment2 || "").trim())?.comment2;
  if (fromBonus) return fromBonus;

  const fromEquip = setEntry.equipments.find((x) => String(x.comment1 || "").trim())?.comment1;
  if (fromEquip) {
    return fromEquip
      .replace(/\b(armor|weapon|helmet|artifact|hero)\b/ig, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  return `${ui("set_label", "Set")} #${setEntry.id}`;
}

function toPieceRows(setEntry) {
  const rows = [];
  const gemSlotLabel =
    lang["gem_name"] ||
    lang["gem_slottype_all"] ||
    ui("linked_gems", "Linked gems");

  setEntry.equipments.forEach((item) => {
    rows.push({
      type: "equipment",
      id: String(item.equipmentID),
      slotId: String(item.slotID || ""),
      slotLabel: getLocalizedSlotName(item.slotID),
      wearerLabel: getLocalizedWearerName(item.wearerID),
      name: getEquipmentName(item),
      effects: parseEffects(item.effects),
      imageUrl: getEquipmentImageUrl(item)
    });
  });

  setEntry.gems.forEach((item) => {
    const gemId = String(item.gemID || "");
    const reuseGemId = String(item.reuseAssetOfGemID || "");
    const gemImage =
      uniqueGemImageUrlMap[gemId] ||
      (reuseGemId ? uniqueGemImageUrlMap[reuseGemId] : null) ||
      "../../img_base/placeholder.webp";
    rows.push({
      type: "gem",
      id: gemId,
      slotId: "gem",
      slotLabel: gemSlotLabel,
      wearerLabel: getLocalizedWearerName(item.wearerID),
      name: getGemName(item),
      effects: parseEffects(item.effects),
      imageUrl: gemImage
    });
  });

  rows.sort((a, b) => {
    const orderA = SLOT_ORDER[a.slotId] || 99;
    const orderB = SLOT_ORDER[b.slotId] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return Number(a.id) - Number(b.id);
  });

  return rows;
}

function buildSetIndex({ equipments, gems, setBonuses }) {
  const byId = {};

  function ensure(id) {
    byId[id] ||= {
      id,
      equipments: [],
      gems: [],
      bonuses: []
    };
    return byId[id];
  }

  equipments.forEach((item) => {
    const setId = normalizeSetId(item.setID);
    if (!setId) return;
    ensure(setId).equipments.push(item);
  });

  gems.forEach((item) => {
    const setId = normalizeSetId(item.setID);
    if (!setId) return;
    ensure(setId).gems.push(item);
  });

  setBonuses.forEach((item) => {
    const setId = normalizeSetId(item.setID);
    if (!setId) return;
    ensure(setId).bonuses.push(item);
  });

  Object.values(byId).forEach((entry) => {
    entry.bonuses.sort((a, b) => Number(a.neededItems || 0) - Number(b.neededItems || 0));
    entry.equipments.sort((a, b) => Number(a.slotID || 0) - Number(b.slotID || 0));
  });

  return byId;
}

function getSetOptions(wearerFilter = "all") {
  const options = [];

  Object.values(setIndexById).forEach((setEntry) => {
    if (!Array.isArray(setEntry.equipments) || setEntry.equipments.length === 0) {
      return;
    }

    const title = getSetTitle(setEntry);

    const matchesWearer = wearerFilter === "all"
      ? true
      : setEntry.equipments.some((x) => String(x.wearerID) === String(wearerFilter));

    if (!matchesWearer) return;

    options.push({
      id: setEntry.id,
      title
    });
  });

  options.sort((a, b) => {
    const idA = Number(a.id) || 0;
    const idB = Number(b.id) || 0;
    return idB - idA;
  });

  return options;
}

function renderEmpty(message) {
  const root = document.getElementById("setOverview");
  if (!root) return;
  root.innerHTML = `<div class="empty-state">${message}</div>`;
}

function getSelectedBonusView() {
  const select = document.getElementById("bonusViewSelect");
  const value = String(select?.value || "set_bonus");
  if (value === "effect_summary") return "effect_summary";
  return "set_bonus";
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function getSelectedMobilePanel() {
  const select = document.getElementById("mobilePanelSelect");
  const value = String(select?.value || "set_pieces");
  if (value === "set_bonuses") return "set_bonuses";
  if (value === "effect_summary") return "effect_summary";
  return "set_pieces";
}

function buildEffectSummaryHtml(setEntry) {
  const totals = new Map();

  const addTokens = (raw) => {
    parseEffectTokens(raw).forEach((entry) => {
      const key = `${String(entry.id || "")}::${String(entry.argId || "")}`;
      const prev = totals.get(key);
      if (!prev) {
        totals.set(key, { id: entry.id, argId: entry.argId || null, value: Number(entry.value || 0) });
        return;
      }
      prev.value += Number(entry.value || 0);
    });
  };

  setEntry.equipments.forEach((item) => addTokens(item.effects));
  setEntry.gems.forEach((item) => addTokens(item.effects));
  setEntry.bonuses.forEach((item) => addTokens(item.effects));

  const rows = Array.from(totals.values())
    .sort((a, b) => {
      const valueDiff = Number(b.value || 0) - Number(a.value || 0);
      if (valueDiff !== 0) return valueDiff;
      return Number(a.id || 0) - Number(b.id || 0);
    })
    .map((entry, idx) => {
      const polarityClass = entry.value < 0 ? "is-negative" : "is-positive";
      return `
        <article class="summary-row ${polarityClass}">
          <div class="summary-rank">${idx + 1}</div>
          <div class="summary-main">
            <p class="summary-text">${renderEffectLine(entry.id, entry.value, entry.argId)}</p>
          </div>
        </article>
      `;
    })
    .join("");

  if (!rows) return `<div class="empty-state">No effect data</div>`;

  return `
    <section class="summary-view">
      <div class="summary-grid">
        ${rows}
      </div>
    </section>
  `;
}

function renderSet(setId) {
  const root = document.getElementById("setOverview");
  if (!root) return;

  const setEntry = setIndexById[String(setId)];
  if (!setEntry) {
    renderEmpty(ui("no_sets", "No sets found for this filter."));
    return;
  }

  const pieceRows = toPieceRows(setEntry);
  const title = getSetTitle(setEntry);

  const pieceRowsHtml = pieceRows.map((piece, idx) => {
    const displayName = `${piece.name} (${piece.slotLabel})`;
    const itemEffects = piece.effects.length > 0
      ? piece.effects.map((line) => `<li>${line}</li>`).join("")
      : `<li>No effect data</li>`;

    const composed =
      piece.imageUrl &&
      piece.imageUrl.startsWith("https://empire-html5.goodgamestudios.com/default/assets/itemassets/") &&
      /\.(webp|png)$/i.test(piece.imageUrl)
        ? deriveCompanionUrls(piece.imageUrl)
        : null;

    const composeAttrs = composed
      ? ` data-compose-asset="1" data-image-url="${composed.imageUrl}" data-json-url="${composed.jsonUrl}" data-js-url="${composed.jsUrl}"`
      : "";

    return `
      <article class="piece-row">
        <div class="piece-visual">
          <div class="piece-image">
            ${piece.imageUrl ? `<img src="${piece.imageUrl}" alt="" loading="lazy"${composeAttrs}>` : "<span>?</span>"}
          </div>
        </div>
        <div>
          <h3 class="piece-name">${displayName}</h3>
          <ul class="effect-list">${itemEffects}</ul>
        </div>
      </article>
    `;
  }).join("");

  const bonusHtml = setEntry.bonuses.length > 0
    ? setEntry.bonuses.map((bonus) => {
      const effects = sortEffectTokensByValueDesc(parseEffectTokens(bonus.effects))
        .map((entry) => renderEffectLine(entry.id, entry.value, entry.argId));
      const effectText = effects.length > 0
        ? effects.map((x) => `<div>${x}</div>`).join("")
        : "<div>No effect data</div>";

      return `
        <div class="bonus-line">
          <span class="bonus-node"></span>
          <article class="bonus-card">
            <h3 class="bonus-threshold">${bonus.neededItems} ${ui("pieces_suffix", "pieces")}</h3>
            <div class="bonus-effects">${effectText}</div>
          </article>
        </div>
      `;
    }).join("")
    : `<div class="empty-state">${ui("no_set_milestones", "No set milestone data.")}</div>`;

  const desktopSelectedView = getSelectedBonusView();
  const mobilePanel = getSelectedMobilePanel();
  const mobile = isMobileLayout();
  const selectedView = mobile
    ? (mobilePanel === "effect_summary" ? "effect_summary" : "set_bonus")
    : desktopSelectedView;

  const rightPanelTitle = selectedView === "effect_summary"
    ? ui("effect_summary", "Effect summary")
    : ui("set_bonuses", "Set bonuses");
  const rightPanelContent = selectedView === "effect_summary"
    ? buildEffectSummaryHtml(setEntry)
    : bonusHtml;
  const mobileClass = mobile
    ? `mobile-show-${
      mobilePanel === "set_pieces"
        ? "pieces"
        : mobilePanel === "effect_summary"
          ? "effect-summary"
          : "set-bonuses"
    }`
    : "";

  root.innerHTML = `
    <section class="set-shell">
      <header class="set-head">
        <h2 class="set-title">${title}</h2>
      </header>

      <div class="set-layout ${mobileClass}">
        <section class="panel">
          <div class="panel-head">${ui("set_pieces", "Set pieces")}</div>
          <div class="pieces-wrap">${pieceRowsHtml || `<div class="empty-state">${ui("no_pieces_found", "No pieces found.")}</div>`}</div>
        </section>

        <section class="panel">
          <div class="panel-head">${rightPanelTitle}</div>
          <div class="bonus-wrap ${selectedView === "effect_summary" ? "summary-mode" : ""}">${rightPanelContent}</div>
        </section>
      </div>
    </section>
  `;

  void hydrateComposedImages({
    root,
    selector: 'img[data-compose-asset="1"]:not([data-compose-ready])',
    cache: composedImageCache
  });
}

function setupWearerOptions(wearers) {
  const select = document.getElementById("wearerSelect");
  if (!select) return;

  const previous = select.value || "all";
  select.innerHTML = "";

  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = ui("all_wearers", "All wearers");
  select.appendChild(allOpt);

  wearers.forEach((wearer) => {
    const opt = document.createElement("option");
    opt.value = String(wearer.wearerID);
    opt.textContent = getLocalizedWearerName(wearer.wearerID);
    select.appendChild(opt);
  });

  select.value = Array.from(select.options).some((x) => x.value === previous) ? previous : "all";
}

function setupSetOptions(wearerFilter = "all") {
  const select = document.getElementById("setSelect");
  if (!select) return;

  const previous = select.value || "";
  const options = getSetOptions(wearerFilter);

  select.innerHTML = "";

  if (options.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = ui("no_sets", "No sets found for this filter.");
    select.appendChild(opt);
    renderEmpty(ui("no_sets", "No sets found for this filter."));
    return;
  }

  options.forEach((entry) => {
    const opt = document.createElement("option");
    opt.value = entry.id;
    opt.textContent = `#${entry.id} - ${entry.title}`;
    select.appendChild(opt);
  });

  select.value = options.some((x) => x.id === previous) ? previous : options[0].id;
  renderSet(select.value);
}

function bindControls() {
  const wearerSelect = document.getElementById("wearerSelect");
  const setSelect = document.getElementById("setSelect");
  const bonusViewSelect = document.getElementById("bonusViewSelect");
  const mobilePanelSelect = document.getElementById("mobilePanelSelect");

  if (wearerSelect && !wearerSelect.dataset.bound) {
    wearerSelect.addEventListener("change", () => {
      setupSetOptions(wearerSelect.value || "all");
    });
    wearerSelect.dataset.bound = "true";
  }

  if (setSelect && !setSelect.dataset.bound) {
    setSelect.addEventListener("change", () => {
      renderSet(setSelect.value);
    });
    setSelect.dataset.bound = "true";
  }

  if (bonusViewSelect && !bonusViewSelect.dataset.bound) {
    bonusViewSelect.addEventListener("change", () => {
      const currentSetId = String(document.getElementById("setSelect")?.value || "").trim();
      if (!currentSetId) return;
      renderSet(currentSetId);
    });
    bonusViewSelect.dataset.bound = "true";
  }

  if (mobilePanelSelect && !mobilePanelSelect.dataset.bound) {
    mobilePanelSelect.addEventListener("change", () => {
      const currentSetId = String(document.getElementById("setSelect")?.value || "").trim();
      if (!currentSetId) return;
      renderSet(currentSetId);
    });
    mobilePanelSelect.dataset.bound = "true";
  }

  if (!window.__equipmentSetsResizeBound) {
    window.addEventListener("resize", () => {
      const currentSetId = String(document.getElementById("setSelect")?.value || "").trim();
      if (!currentSetId) return;
      renderSet(currentSetId);
    });
    window.__equipmentSetsResizeBound = true;
  }
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
      itemLabel: "equipment sets",
      langCode: currentLanguage,
      normalizeNameFn: normalizeName,
      assets: {
        equipmentUniques: true,
        uniqueGems: true
      },
      onReady: async ({ lang: L, data, imageMaps, effectCtx: E }) => {
        lang = L;
        effectCtx = E;
        equipmentEffectToEffectId = {};

        const equipments = getArray(data, ["equipments"]);
        const gems = getArray(data, ["gems"]);
        const setBonuses = getArray(data, ["equipment_sets", "equipmentSets"]);
        const equipmentEffects = getArray(data, ["equipment_effects", "equipmentEffects"]);
        const slots = getArray(data, ["equipment_slots", "equipmentSlots"]);
        const wearers = getArray(data, ["equipment_wearers", "equipmentWearers"]);
        const units = getArray(data, ["units"]);

        equipmentEffects.forEach((row) => {
          const equipmentEffectId = String(row?.equipmentEffectID || "").trim();
          const effectId = String(row?.effectID || "").trim();
          if (!equipmentEffectId || !effectId) return;
          equipmentEffectToEffectId[equipmentEffectId] = effectId;
        });

        slotById = buildLookup(slots, "slotID");
        wearerById = buildLookup(wearers, "wearerID");
        unitsById = buildLookup(units, "wodID");
        equipmentUniqueImageUrlMap = imageMaps?.equipmentUniques ?? {};
        uniqueGemImageUrlMap = imageMaps?.uniqueGems ?? {};

        setIndexById = buildSetIndex({
          equipments,
          gems,
          setBonuses
        });

        equipmentSets = Object.values(setIndexById);

        initLanguageSelector({
          currentLanguage,
          lang,
          onSelect: () => location.reload()
        });

        await loadOwnLang();
        const bonusViewSelect = document.getElementById("bonusViewSelect");
        if (bonusViewSelect) {
          const optionSetBonus = bonusViewSelect.querySelector('option[value="set_bonus"]');
          const optionSummary = bonusViewSelect.querySelector('option[value="effect_summary"]');
          if (optionSetBonus) optionSetBonus.textContent = ui("set_bonus_view", "Set bonus view");
          if (optionSummary) optionSummary.textContent = ui("effect_summary_view", "Effect summary view");
        }

        const mobilePanelSelect = document.getElementById("mobilePanelSelect");
        if (mobilePanelSelect) {
          const optionPieces = mobilePanelSelect.querySelector('option[value="set_pieces"]');
          const optionSetBonus = mobilePanelSelect.querySelector('option[value="set_bonuses"]');
          const optionSummary = mobilePanelSelect.querySelector('option[value="effect_summary"]');
          if (optionPieces) optionPieces.textContent = ui("set_pieces", "Set pieces");
          if (optionSetBonus) optionSetBonus.textContent = ui("set_bonuses", "Set bonuses");
          if (optionSummary) optionSummary.textContent = ui("total_bonus_overview", "Total bonus overview");
        }

        const wearerSelect = document.getElementById("wearerSelect");
        if (wearerSelect) {
          const first = wearerSelect.querySelector('option[value="all"]');
          if (first) first.textContent = ui("all_wearers", "All wearers");
        }

        const setSelect = document.getElementById("setSelect");
        if (setSelect) {
          const first = setSelect.querySelector("option");
          if (first) first.textContent = ui("loading_sets", "Loading sets...");
        }

        bindControls();
        setupWearerOptions(wearers);
        setupSetOptions("all");

        if (equipmentSets.length === 0) {
          renderEmpty(ui("no_sets", "No sets found for this filter."));
        }
      }
    });
  } catch (err) {
    console.error(err);
    loader.error("Something went wrong...", 30);
  }
}

init();
