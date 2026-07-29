import { initAutoHeight } from "../shared/ResizeService.mjs";
import {
  getItemVersionForSource,
  getLangVersion,
  loadItemsForSource,
  loadLanguage
} from "../shared/DataService.mjs";
import { loadImageMaps } from "../shared/ImageService.mjs";
import { initImageModal } from "../shared/ModalService.mjs";
import { getInitialLanguage } from "../shared/LanguageService.mjs";
import { resolveEquipmentName } from "../shared/RewardResolver.mjs";
import { deriveCompanionUrls } from "../shared/AssetComposer.mjs";
import { hydrateComposedImages } from "../shared/ComposeHydrator.mjs";

const currentLanguage = getInitialLanguage();
const composedImageCache = new Map();

let text = {};
let lang = {};
let rows = [];
let imageUrlMap = {};

const searchInput = document.getElementById("searchInput");
const showFilter = document.getElementById("showFilter");
const tableWrap = document.getElementById("tableWrap");
const tableBody = document.getElementById("lookRows");
const emptyState = document.getElementById("emptyState");

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function t(key, fallback, variables = {}) {
  let value = String(text[key] || fallback || key);
  Object.entries(variables).forEach(([name, replacement]) => {
    value = value.replaceAll(`{${name}}`, String(replacement));
  });
  return value;
}

async function loadOwnLanguage() {
  try {
    const response = await fetch("./ownLang.json");
    const pack = await response.json();
    text = pack[currentLanguage] || pack.en || {};
  } catch {
    text = {};
  }
}

function applyTranslations() {
  document.documentElement.lang = currentLanguage;
  document.documentElement.dir = currentLanguage === "ar" ? "rtl" : "ltr";
  searchInput.placeholder = t("search", "Search by name, look ID or skin ID...");
  showFilter.options[0].textContent = t("commander", "Commander skins");
  showFilter.options[1].textContent = t("castellan", "Castellan skins");

  const headers = document.querySelectorAll(".look-table th");
  const labels = [
    t("look_id", "ID"),
    t("preview", "Preview"),
    t("name", "Name"),
    "EM",
    "E4K"
  ];
  headers.forEach((header, index) => {
    header.textContent = labels[index];
  });
}

function isPermanentEffectlessLook(item) {
  const duration = String(item?.duration || "").trim();
  return String(item?.slotID || "") === "5"
    && String(item?.effects || "").trim() === ""
    && (!duration || Number(duration) === 0);
}

function indexSkins(data) {
  const index = new Map();
  (data?.worldmapskins || []).forEach((skin) => {
    index.set(String(skin.skinID), skin);
  });
  return index;
}

function getDisplayName(item, skin) {
  const localized = resolveEquipmentName(lang, item, item?.equipmentID);
  if (localized && !/^Equipment \d+$/i.test(localized)) return localized;
  return skin?.name || item?.comment2 || localized || `Equipment ${item?.equipmentID}`;
}

function getLookType(item, assets) {
  const hasMovements = Object.keys(assets?.movements || {}).length > 0;
  const hasMapObjects = Object.keys(assets?.mapObjects || {}).length > 0;
  if (hasMovements && !hasMapObjects) return "commander";
  if (hasMapObjects && !hasMovements) return "castellan";
  return String(item?.wearerID || "") === "2" ? "commander" : "castellan";
}

function buildRows(empireData, e4kData) {
  const empireSkins = indexSkins(empireData);
  const e4kSkins = indexSkins(e4kData);
  const byId = new Map();

  function addGame(data, skinIndex, game) {
    (data?.equipments || [])
      .filter(isPermanentEffectlessLook)
      .forEach((item) => {
        const id = String(item.equipmentID || "").trim();
        if (!id) return;
        const entry = byId.get(id) || { id, empire: null, e4k: null };
        entry[game] = item;
        entry[`${game}Skin`] = skinIndex.get(String(item.skinID)) || null;
        byId.set(id, entry);
      });
  }

  addGame(empireData, empireSkins, "empire");
  addGame(e4kData, e4kSkins, "e4k");

  return Array.from(byId.values()).map((entry) => {
    const item = entry.empire || entry.e4k;
    const skin = entry.empireSkin || entry.e4kSkin;
    const normalizedSkinName = normalizeName(skin?.name);
    const assets = imageUrlMap[normalizedSkinName] || {};
    const type = getLookType(item, assets);
    const name = getDisplayName(item, skin);

    return {
      ...entry,
      item,
      skin,
      assets,
      type,
      name,
      hasGemSlot: [entry.empire?.canSlotGem, entry.e4k?.canSlotGem]
        .some((value) => ["1", "true"].includes(String(value || "").toLowerCase())),
      searchText: normalizeName([
        entry.id,
        item?.skinID,
        name,
        skin?.name,
        item?.comment1,
        item?.comment2
      ].join(" "))
    };
  }).filter((row) => {
    const relevantAssets = row.type === "commander"
      ? row.assets?.movements
      : row.assets?.mapObjects;
    return Object.values(relevantAssets || {}).some(Boolean);
  }).sort((a, b) => Number(b.id) - Number(a.id));
}

function imageTag(url, name) {
  if (!url) return "";
  const safeUrl = escapeHtml(url);
  const safeName = escapeHtml(name);
  const isComposedAsset =
    url.startsWith("https://empire-html5.goodgamestudios.com/default/assets/itemassets/")
    && /\.(webp|png)$/i.test(url);

  if (!isComposedAsset) {
    return `<img src="${safeUrl}" alt="${safeName}" loading="lazy">`;
  }

  const companion = deriveCompanionUrls(url);
  return `<img src="${safeUrl}" alt="${safeName}" loading="lazy"
    data-compose-asset="1"
    data-image-url="${escapeHtml(companion.imageUrl)}"
    data-json-url="${escapeHtml(companion.jsonUrl)}"
    data-js-url="${escapeHtml(companion.jsUrl)}">`;
}

function renderPreview(row) {
  const urls = row.type === "commander"
    ? Object.values(row.assets?.movements || {})
    : Object.values(row.assets?.mapObjects || {});
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));

  return `<div class="look-preview ${row.type}">
    ${uniqueUrls.map((url) => imageTag(url, row.name)).join("")}
    ${row.hasGemSlot
      ? '<span class="gem-slot-marker" title="Gem slot"><i class="bi bi-star-fill"></i></span>'
      : ""}
  </div>`;
}

function gameState(available, label) {
  return available
    ? `<span class="game-state available" title="${label}: available"><i class="bi bi-check-lg"></i></span>`
    : `<span class="game-state unavailable" title="${label}: unavailable"><i class="bi bi-x-lg"></i></span>`;
}

function render() {
  const search = normalizeName(searchInput.value);
  const type = showFilter.value;
  const filtered = rows.filter((row) =>
    row.type === type && (!search || row.searchText.includes(search))
  );

  if (!filtered.length) {
    tableBody.replaceChildren();
    emptyState.textContent = t("no_match", "No match to the current filters.");
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  tableBody.innerHTML = filtered.map((row) => `
    <tr>
      <td>${escapeHtml(row.id)}</td>
      <td>${renderPreview(row)}</td>
      <td><div class="look-name">${escapeHtml(row.name)}</div></td>
      <td>${gameState(Boolean(row.empire), "EM")}</td>
      <td>${gameState(Boolean(row.e4k), "E4K")}</td>
    </tr>
  `).join("");

  void hydrateComposedImages({
    root: tableBody,
    cache: composedImageCache
  });
}

function setupEvents() {
  searchInput.addEventListener("input", render);
  showFilter.addEventListener("change", render);
  tableBody.addEventListener("click", (event) => {
    const preview = event.target.closest(".look-preview img");
    if (preview && window.openImageModal) {
      window.openImageModal(preview.currentSrc || preview.src, preview.alt || "");
    }
  });
}

initAutoHeight({
  contentSelector: "#tableWrap",
  subtractSelectors: [".note", ".page-title"],
  extraOffset: 4
});

async function init() {
  try {
    initImageModal();
    await loadOwnLanguage();
    applyTranslations();

    const [langVersion, empireVersion, e4kVersion] = await Promise.all([
      getLangVersion(),
      getItemVersionForSource("empire"),
      getItemVersionForSource("e4k")
    ]);

    const [languageData, empireData, e4kData, imageMaps] = await Promise.all([
      loadLanguage(currentLanguage, langVersion),
      loadItemsForSource("empire", empireVersion),
      loadItemsForSource("e4k", e4kVersion),
      loadImageMaps({ looks: true, normalizeNameFn: normalizeName })
    ]);

    lang = Object.fromEntries(
      Object.entries(languageData || {}).map(([key, value]) => [key.toLowerCase(), value])
    );
    imageUrlMap = imageMaps.looks || {};
    rows = buildRows(empireData, e4kData);

    tableWrap.hidden = false;
    setupEvents();
    render();
  } catch (error) {
    console.error(error);
    tableWrap.hidden = false;
    tableBody.replaceChildren();
  }
}

init();
