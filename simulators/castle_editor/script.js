import { coreInit } from "../../overviews/shared/CoreInit.mjs";
import { createLoader } from "../../overviews/shared/LoadingService.mjs";
import { getArray, buildLookup, normalizeName } from "../../overviews/shared/RewardResolver.mjs";
import { composeAssetToDataUrl, deriveCompanionUrls } from "../../overviews/shared/AssetComposer.mjs";
import { initCustomModal } from "../../overviews/shared/ModalService.mjs";
import { loadSimulatorData, saveSimulatorData } from "../../overviews/shared/GameSettings.mjs";
import { getInitialLanguage } from "../../overviews/shared/LanguageService.mjs";

const SIM_NAME = "castle_editor";
const STATE_VERSION = 2;
const REPLACED_WOD_IDS = new Map([["363", 2843]]);
const currentLanguage = getInitialLanguage();
let ownLang = {};

async function loadOwnLang() {
  try {
    const response = await fetch("./ownLang.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    ownLang = await response.json();
  } catch (error) {
    console.warn("Castle editor translations could not be loaded.", error);
    ownLang = {};
  }
}

function ui(key, fallback = "", variables = {}) {
  const exactLanguage = String(currentLanguage || "en").toLowerCase();
  const baseLanguage = exactLanguage.split("-")[0];
  const value = ownLang?.[exactLanguage]?.ui?.[key]
    ?? ownLang?.[baseLanguage]?.ui?.[key]
    ?? ownLang?.en?.ui?.[key]
    ?? fallback;
  return String(value).replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : match
  );
}

function applyPageTranslations() {
  document.documentElement.lang = currentLanguage;
  document.querySelectorAll("[data-i18n]").forEach(element => {
    element.textContent = ui(element.dataset.i18n, element.textContent);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
    element.placeholder = ui(element.dataset.i18nPlaceholder, element.placeholder);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach(element => {
    element.setAttribute("aria-label", ui(element.dataset.i18nAria, element.getAttribute("aria-label") || ""));
  });
  Array.from(expansionSelect.options).forEach(option => {
    option.textContent = ui("expansions", `Expansions: ${option.value}`, { count: option.value });
  });
  setBuildingsPanel(customDecoForm.hidden ? "catalog" : "custom-decorations");
  syncViewToggle();
  syncFullscreenToggle();
  syncBuildingActionBar(true);
}

const canvas = document.getElementById("castleCanvas");
const ctx = canvas.getContext("2d");
const CAN_HOVER_BUILDINGS = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const board = document.querySelector(".board-shell");
const list = document.getElementById("buildingList");
const search = document.getElementById("buildingSearch");
const sizeDropdown = document.getElementById("sizeDropdown");
const sizeFilters = document.getElementById("sizeFilters");
const sizeFilterDropdown = sizeDropdown.closest(".size-filter-dropdown");
const overviewToggle = document.getElementById("overviewToggle");
const fullscreenToggle = document.getElementById("fullscreenToggle");
const expansionSelect = document.getElementById("expansionSelect");
const sidebarToggle = document.getElementById("sidebarToggle");
const savesToggle = document.getElementById("savesToggle");
const customDecoToggle = document.getElementById("customDecoToggle");
const buildingsModalTitle = document.getElementById("buildingsModalTitle");
const buildingCatalogView = document.getElementById("buildingCatalogView");
const customDecoForm = document.getElementById("customDecoForm");
const customDecoRows = document.getElementById("customDecoRows");
const layoutNameInput = document.getElementById("layoutNameInput");
const saveLayoutButton = document.getElementById("saveLayoutButton");
const savedLayoutsList = document.getElementById("savedLayoutsList");
const bottomNavigation = document.querySelector(".bottom-buttons-container");
const bottomNavigationButtons = [sidebarToggle, savesToggle, overviewToggle, fullscreenToggle];
const buildingsModal = initCustomModal({ modalId: "buildingsModal" });
const savesModal = initCustomModal({ modalId: "savesModal" });
const catalogImageItems = new WeakMap();
const imageAlphaMasks = new WeakMap();
const catalogImageObserver = "IntersectionObserver" in window
  ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      catalogImageObserver.unobserve(entry.target);
      const item = catalogImageItems.get(entry.target);
      if (item) hydrateCatalogImage(entry.target, item);
    });
  }, { root: list, rootMargin: "160px 0px" })
  : null;

const state = {
  ready: false,
  mode: "normal",
  scale: 1,
  panX: 0,
  panY: 0,
  tileW: 42,
  tileH: 21,
  worldSize: 180,
  unlocked: 60,
  expansionLevel: 0,
  customDecorationWodIds: [],
  buildings: [],
  buildingCatalog: [],
  images: new Map(),
  terrainImage: null,
  pointer: null,
  drag: null,
  hoveredBuilding: null
};

const DESKTOP_MIN_CAMERA_SCALE = .55;
const MOBILE_MIN_CAMERA_SCALE = .40;
const MAX_CAMERA_SCALE = 1.5;
const TOUCH_LONG_PRESS_MS = 400;
const TOUCH_MOVE_THRESHOLD = 10;
const TOUCH_EDGE_PAN_MAX_SPEED = 720;
const touchInteraction = {
  pointers: new Map(),
  gesture: null,
  longPressTimer: 0,
  longPressCandidate: null
};
let touchEdgePanFrame = 0;
let touchEdgePanLastTime = 0;

let persistedState = loadSimulatorData(SIM_NAME) || {};
let cameraRestored = false;
let cameraSaveTimer = 0;
let catalogSourceContext = null;
let buildingActionBarVisible = null;

function getMinCameraScale() {
  return window.matchMedia("(max-width: 760px)").matches
    ? MOBILE_MIN_CAMERA_SCALE
    : DESKTOP_MIN_CAMERA_SCALE;
}

const loader = createLoader();
// The initial castle is a 3×3 group of 20×20 sectors. Each expansion step
// unlocks four 10×5 slots along the right edge; the geometry is kept separate
// so the expansion map can be adjusted without changing placement logic.
const expansionZones = Array.from({ length: 12 }, (_, index) => ({
  x: 60, y: index * 5, width: 10, height: 5
}));

restoreExpansionState();
restoreActiveLayoutState();
restoreCameraState();
restoreViewState();

const LEGACY_CATALOG_WOD_IDS = new Set([
  "586", "553", "776", "1958", "2027", "3139", "3141", "474",
  "2998", "756", "2895", "2177", "3082", "3092", "481", "1639",
  "1619", "1865", "1940", "226", "158", "1845", "1788", "1819",
  "3136", "3111", "3059", "3039", "63", "1422", "589", "253",
  "556", "196", "3137", "3072", "3097", "257", "256", "834",
  "2988", "150", "4254", "4396", "4259", "2910", "4263", "3675", "2987",
  "2989", "2992", "3116", "1880", "495", "493", "224",
  "490", "2827", "2359", "2843", "3187", "3110", "3162", "3191"
]);
const DEFAULT_KEEP_WOD_ID = "2987";
const DEFAULT_FLIPPED_ASSET_WOD_IDS = new Set(["1422", "589"]);
const BUILDING_ASSET_SCALE = 0.99;
const BUILDING_ASSET_VERTICAL_OFFSET_TILES = -0.5;
const OUTER_GRASS_SCALE_MULTIPLIER = 1.85;
const ASSET_VERTICAL_OFFSET_TILES = new Map([
  // The Keep artwork contains loose rocks below its architectural base, so
  // its cropped image needs a small visual lift to sit on the 12x12 footprint.
  [DEFAULT_KEEP_WOD_ID, -1.5]
]);

const TERRAIN_ATLAS_URL = "https://empire-html5.goodgamestudios.com/default/assets/itemassets/Background/BackgroundsClassic/BackgroundsClassic--1573584429307.png";
const CASTLE_GROUND_COLOR = "#789342";
const TERRAIN_FRAMES = {
  outerGrass: { sx: 2, sy: 2616, sw: 2408, sh: 400 },
  inner20x20: { sx: 1, sy: 1, sw: 1600, sh: 800, offsetX: -800, offsetY: 0 },
  grid20x20: { sx: 1603, sy: 1, sw: 1560, sh: 800, offsetX: -760, offsetY: 0 },
  inner10x20: [
    { sx: 1, sy: 803, sw: 1202, sh: 602, offsetX: -402, offsetY: -2 },
    { sx: 1205, sy: 803, sw: 1202, sh: 602, offsetX: -402, offsetY: -2 },
    { sx: 2409, sy: 803, sw: 1202, sh: 602, offsetX: -402, offsetY: -2 },
    { sx: 1, sy: 1407, sw: 1202, sh: 602, offsetX: -402, offsetY: -2 }
  ],
  inner20x10: [
    { sx: 1, sy: 2011, sw: 1202, sh: 602, offsetX: -802, offsetY: -2 },
    { sx: 1205, sy: 1407, sw: 1202, sh: 602, offsetX: -802, offsetY: -2 },
    { sx: 1205, sy: 2011, sw: 1202, sh: 602, offsetX: -802, offsetY: -2 },
    { sx: 2409, sy: 1407, sw: 1202, sh: 602, offsetX: -802, offsetY: -2 }
  ],
  grid10x20: { sx: 2409, sy: 2011, sw: 1160, sh: 600, offsetX: -760, offsetY: 0 },
  grid20x10: { sx: 2413, sy: 2613, sw: 1160, sh: 600, offsetX: -360, offsetY: 0 }
};

const terrainImage = new Image();
let outerGrassPattern = null;
const terrainReady = new Promise(resolve => {
  terrainImage.onload = () => {
    state.terrainImage = terrainImage;
    draw();
    resolve();
  };
  terrainImage.onerror = () => resolve();
  terrainImage.src = TERRAIN_ATLAS_URL;
});

function resizeCanvas() {
  const rect = board.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!cameraRestored && !state.panX && !state.panY) centerView();
  else clampView();
  scheduleCameraSave();
  draw();
}

function centerView() {
  const rect = board.getBoundingClientRect();
  state.panX = rect.width / 2;
  state.panY = 70;
  clampView();
}

function getWorldViewBounds() {
  const regions = [{ x: 0, y: 0, width: state.unlocked, height: state.unlocked }];
  if (state.expansionLevel > 0) {
    regions.push({ x: 60, y: 0, width: 10, height: state.expansionLevel * 20 });
  }

  const points = regions.flatMap(region => [
    [region.x, region.y],
    [region.x + region.width, region.y],
    [region.x + region.width, region.y + region.height],
    [region.x, region.y + region.height]
  ]).map(([x, y]) => ({
    x: (x - y) * state.tileW * state.scale / 2,
    y: (x + y) * state.tileH * state.scale / 2
  }));

  return {
    minX: Math.min(...points.map(point => point.x)),
    maxX: Math.max(...points.map(point => point.x)),
    minY: Math.min(...points.map(point => point.y)),
    maxY: Math.max(...points.map(point => point.y))
  };
}

function clampAxis(current, viewportSize, worldMin, worldMax, negativeAllowance, positiveAllowance = negativeAllowance) {
  const worldSize = worldMax - worldMin;
  if (worldSize <= viewportSize - negativeAllowance - positiveAllowance) {
    return (viewportSize + positiveAllowance - negativeAllowance - worldMin - worldMax) / 2;
  }

  const minimum = viewportSize - negativeAllowance - worldMax;
  const maximum = positiveAllowance - worldMin;
  return Math.max(minimum, Math.min(maximum, current));
}

function clampView() {
  const rect = board.getBoundingClientRect();
  const bounds = getWorldViewBounds();
  const horizontalAllowance = Math.min(96, Math.max(36, Math.min(rect.width, rect.height) * .08));
  const verticalAllowance = rect.width >= 981
    ? Math.min(360, Math.max(160, rect.height * .32))
    : Math.min(220, Math.max(84, rect.height * .18));
  const isDesktopView = rect.width >= 981;
  const zoomedUpwardExtension = Math.max(0, state.scale - 1) * (isDesktopView ? 260 : 120);
  const upwardCameraAllowance = Math.min(
    rect.height * (isDesktopView ? 1.15 : .78),
    verticalAllowance * (isDesktopView ? 1.35 : 1.25) + zoomedUpwardExtension
  );
  const downwardCameraAllowance = Math.max(54, verticalAllowance * .65);
  state.panX = clampAxis(state.panX, rect.width, bounds.minX, bounds.maxX, horizontalAllowance);
  state.panY = clampAxis(
    state.panY,
    rect.height,
    bounds.minY,
    bounds.maxY,
    downwardCameraAllowance,
    upwardCameraAllowance
  );
}

function restoreCameraState() {
  const camera = persistedState?.camera;
  if (!camera) return;

  const panX = Number(camera.panX);
  const panY = Number(camera.panY);
  const scale = Number(camera.scale);
  if (![panX, panY, scale].every(Number.isFinite)) return;

  state.panX = panX;
  state.panY = panY;
  state.scale = Math.max(getMinCameraScale(), Math.min(MAX_CAMERA_SCALE, scale));
  cameraRestored = true;
}

function normalizeExpansionLevel(value) {
  const level = Number(value);
  return Number.isFinite(level) ? Math.max(0, Math.min(3, Math.trunc(level))) : 0;
}

function restoreExpansionState() {
  state.expansionLevel = normalizeExpansionLevel(persistedState?.expansionLevel);
  expansionSelect.value = String(state.expansionLevel);
}

function syncViewToggle() {
  if (state.drag?.building) return;
  const showingOverview = state.mode === "overview";
  overviewToggle.classList.toggle("active", showingOverview);
  overviewToggle.setAttribute("aria-label", showingOverview
    ? ui("switch_normal", "Switch to normal view")
    : ui("switch_overview", "Switch to overview"));
  const icon = overviewToggle.querySelector("i");
  if (icon) icon.className = `bi ${showingOverview ? "bi-image" : "bi-grid-3x3-gap"} fs-1`;
}

function isFullscreen() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

function syncFullscreenToggle() {
  if (state.drag?.building) return;
  const fullscreenActive = isFullscreen();
  fullscreenToggle.classList.toggle("active", fullscreenActive);
  fullscreenToggle.setAttribute("aria-pressed", String(fullscreenActive));
  fullscreenToggle.setAttribute("aria-label", fullscreenActive ? "Exit fullscreen" : "Enter fullscreen");
  const icon = fullscreenToggle.querySelector("i");
  if (icon) icon.className = `bi ${fullscreenActive ? "bi-fullscreen-exit" : "bi-fullscreen"} fs-1`;
}

function syncBuildingActionBar(force = false) {
  const editingBuilding = Boolean(state.drag?.building);
  if (!force && editingBuilding === buildingActionBarVisible) return;
  buildingActionBarVisible = editingBuilding;
  bottomNavigation.classList.toggle("is-building-actions", editingBuilding);

  if (editingBuilding) {
    const actions = [
      { label: ui("cancel", "Cancel"), icon: "bi-x-lg" },
      { label: ui("rotate", "Rotate"), icon: "bi-arrow-clockwise" },
      { label: ui("destroy", "Destroy"), icon: "bi-trash3" },
      { label: ui("apply", "Apply"), icon: "bi-check-lg" }
    ];
    bottomNavigationButtons.forEach((button, index) => {
      button.classList.remove("active");
      button.setAttribute("aria-label", actions[index].label);
      button.setAttribute("aria-pressed", "false");
      const icon = button.querySelector("i");
      if (icon) icon.className = `bi ${actions[index].icon} fs-1`;
      let label = button.querySelector(".nav-action-label");
      if (!label) {
        label = document.createElement("span");
        label.className = "nav-action-label";
        button.append(label);
      }
      label.textContent = actions[index].label;
      label.hidden = false;
    });
    return;
  }

  const labels = [
    ui("buildings", "Buildings"),
    ui("saves", "Saves"),
    ui("overview", "Overview"),
    ui("fullscreen", "Fullscreen")
  ];
  bottomNavigationButtons.forEach((button, index) => {
    let label = button.querySelector(".nav-action-label");
    if (!label) {
      label = document.createElement("span");
      label.className = "nav-action-label";
      button.append(label);
    }
    label.textContent = labels[index];
    label.hidden = false;
  });
  sidebarToggle.setAttribute("aria-label", ui("open_buildings", "Open buildings"));
  savesToggle.setAttribute("aria-label", ui("open_saves", "Open saves"));
  const sidebarIcon = sidebarToggle.querySelector("i");
  const savesIcon = savesToggle.querySelector("i");
  if (sidebarIcon) sidebarIcon.className = "bi bi-hammer fs-1";
  if (savesIcon) savesIcon.className = "bi bi-save fs-1";
  syncViewToggle();
  syncFullscreenToggle();
}

async function toggleFullscreen() {
  try {
    if (isFullscreen()) {
      const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
      if (exitFullscreen) await exitFullscreen.call(document);
    } else {
      const root = document.documentElement;
      const requestFullscreen = root.requestFullscreen || root.webkitRequestFullscreen;
      if (requestFullscreen) await requestFullscreen.call(root);
    }
  } catch (error) {
    console.warn("Fullscreen mode could not be changed.", error);
  }
}

function restoreViewState() {
  state.mode = persistedState?.viewMode === "overview" ? "overview" : "normal";
  syncViewToggle();
}

function saveCameraState() {
  persistedState = {
    ...persistedState,
    version: STATE_VERSION,
    expansionLevel: state.expansionLevel,
    viewMode: state.mode,
    camera: {
      panX: Math.round(state.panX * 100) / 100,
      panY: Math.round(state.panY * 100) / 100,
      scale: Math.round(state.scale * 10000) / 10000
    }
  };
  saveSimulatorData(SIM_NAME, persistedState);
}

function scheduleCameraSave() {
  if (cameraSaveTimer) return;
  cameraSaveTimer = window.setTimeout(() => {
    cameraSaveTimer = 0;
    saveCameraState();
  }, 80);
}

function flushCameraSave() {
  if (cameraSaveTimer) {
    window.clearTimeout(cameraSaveTimer);
    cameraSaveTimer = 0;
  }
  saveCameraState();
}

function savedLayouts() {
  return Array.isArray(persistedState?.layouts) ? persistedState.layouts : [];
}

function normalizeSavedBuilding(building) {
  if (!building || building.id == null) return null;
  const savedId = String(building.id);
  return {
    id: REPLACED_WOD_IDS.get(savedId) ?? building.id,
    name: String(building.name || ui("building", "Building")),
    group: building.group || "",
    groundType: building.groundType || "",
    width: Math.max(1, Math.trunc(Number(building.width) || 1)),
    height: Math.max(1, Math.trunc(Number(building.height) || 1)),
    rotation: building.rotation ? 1 : 0,
    x: Math.trunc(Number(building.x) || 0),
    y: Math.trunc(Number(building.y) || 0)
  };
}

function restoreActiveLayoutState() {
  const activeId = String(persistedState?.activeLayoutId || "");
  const layout = savedLayouts().find(item => String(item.id) === activeId);
  if (!layout) return;
  state.expansionLevel = normalizeExpansionLevel(layout.expansionLevel);
  state.customDecorationWodIds = parseWodIdList(layout.customDecorationWodIds);
  expansionSelect.value = String(state.expansionLevel);
  state.buildings = (Array.isArray(layout.buildings) ? layout.buildings : [])
    .map(normalizeSavedBuilding)
    .filter(Boolean)
    .filter(isBuildingInsideUnlockedArea);
}

function currentLayoutSnapshot(id, name) {
  return {
    id,
    name,
    expansionLevel: state.expansionLevel,
    customDecorationWodIds: customDecorationWodIds(),
    updatedAt: Date.now(),
    buildings: state.buildings.map(normalizeSavedBuilding).filter(Boolean)
  };
}

function createLayoutId() {
  return globalThis.crypto?.randomUUID?.() || `layout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function hydratePlacedBuildingImages() {
  state.buildings.forEach(building => {
    const item = state.buildingCatalog.find(candidate => String(candidate.id) === String(building.id));
    if (!item) return;
    building.name = item.name;
    building.group = item.group;
    building.groundType = item.groundType;
    loadImage(item);
    void ensureComposedImage(item).then(draw);
  });
}

function waitForImage(image) {
  if (!image || image.complete) return Promise.resolve();
  return new Promise(resolve => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", resolve, { once: true });
  });
}

async function preparePlacedBuildingImages() {
  const items = Array.from(new Set(state.buildings
    .map(building => state.buildingCatalog.find(candidate => String(candidate.id) === String(building.id)))
    .filter(Boolean)));
  await Promise.all(items.map(item => ensureComposedImage(item)));
  items.forEach(loadImage);
  await Promise.all(items.map(item => waitForImage(state.images.get(String(item.id)))));
}

function applySavedLayout(layout) {
  if (!layout) return;
  state.expansionLevel = normalizeExpansionLevel(layout.expansionLevel);
  state.customDecorationWodIds = parseWodIdList(layout.customDecorationWodIds);
  expansionSelect.value = String(state.expansionLevel);
  state.buildings = (Array.isArray(layout.buildings) ? layout.buildings : [])
    .map(normalizeSavedBuilding)
    .filter(Boolean)
    .filter(isBuildingInsideUnlockedArea);
  state.drag = null;
  state.pointer = null;
  rebuildBuildingCatalog();
  populateSizeFilter();
  renderCatalog();
  void prebuildCatalogAssets();
  hydratePlacedBuildingImages();
  clampView();
  saveCameraState();
  draw();
}

function setActiveLayout(id) {
  const layout = savedLayouts().find(item => String(item.id) === String(id));
  if (!layout) return;
  persistedState = { ...persistedState, activeLayoutId: layout.id };
  applySavedLayout(layout);
  renderSavedLayouts();
}

function saveNewLayout() {
  const name = layoutNameInput.value.trim();
  if (!name) {
    window.alert(ui("enter_layout_name", "Please enter a name for the layout."));
    layoutNameInput.focus();
    return;
  }
  if (savedLayouts().some(layout => layout.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    window.alert(ui("duplicate_layout_name", "A layout with this name already exists. Use Update to overwrite it."));
    return;
  }
  const layout = currentLayoutSnapshot(createLayoutId(), name);
  persistedState = {
    ...persistedState,
    layouts: [...savedLayouts(), layout],
    activeLayoutId: layout.id
  };
  layoutNameInput.value = "";
  saveCameraState();
  renderSavedLayouts();
}

function updateSavedLayout(id) {
  const layouts = savedLayouts();
  const index = layouts.findIndex(layout => String(layout.id) === String(id));
  if (index < 0) return;
  const updatedLayouts = layouts.slice();
  updatedLayouts[index] = currentLayoutSnapshot(layouts[index].id, layouts[index].name);
  persistedState = { ...persistedState, layouts: updatedLayouts };
  saveCameraState();
  renderSavedLayouts();
}

function saveCustomDecorationsToActiveLayout(removedWodIds = new Set()) {
  const activeId = String(persistedState?.activeLayoutId || "");
  if (!activeId) return;
  let changed = false;
  const layouts = savedLayouts().map(layout => {
    if (String(layout.id) !== activeId) return layout;
    changed = true;
    return {
      ...layout,
      customDecorationWodIds: customDecorationWodIds(),
      buildings: (Array.isArray(layout.buildings) ? layout.buildings : [])
        .filter(building => !removedWodIds.has(String(building.id))),
      updatedAt: Date.now()
    };
  });
  if (!changed) return;
  persistedState = { ...persistedState, layouts };
  saveCameraState();
}

function deleteSavedLayout(id) {
  const layouts = savedLayouts().filter(layout => String(layout.id) !== String(id));
  const deletedActive = String(persistedState?.activeLayoutId || "") === String(id);
  persistedState = {
    ...persistedState,
    layouts,
    activeLayoutId: deletedActive ? (layouts[0]?.id || null) : persistedState.activeLayoutId
  };
  if (deletedActive && layouts[0]) applySavedLayout(layouts[0]);
  else saveCameraState();
  renderSavedLayouts();
}

function layoutActionButton(label, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "saved-layout-action";
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
}

function renderSavedLayouts() {
  savedLayoutsList.replaceChildren();
  const layouts = savedLayouts();
  if (!layouts.length) {
    const empty = document.createElement("div");
    empty.className = "saved-layout-empty";
    empty.textContent = ui("no_saved_layouts", "No saved layouts yet.");
    savedLayoutsList.append(empty);
    return;
  }
  layouts.forEach(layout => {
    const row = document.createElement("div");
    const isActive = String(layout.id) === String(persistedState?.activeLayoutId || "");
    row.className = `saved-layout-row${isActive ? " is-active" : ""}`;
    const name = document.createElement("div");
    name.className = "saved-layout-name";
    name.textContent = layout.name;
    const activeCell = document.createElement("div");
    activeCell.className = "saved-layout-cell";
    const active = document.createElement("input");
    active.type = "radio";
    active.name = "active-layout";
    active.className = "saved-layout-active";
    active.checked = isActive;
    active.setAttribute("aria-label", ui("set_layout_active", `Set ${layout.name} as active`, { name: layout.name }));
    active.addEventListener("change", () => setActiveLayout(layout.id));
    activeCell.append(active);
    const updateCell = document.createElement("div");
    updateCell.className = "saved-layout-cell";
    updateCell.append(layoutActionButton(ui("update", "Update"), () => updateSavedLayout(layout.id)));
    const deleteCell = document.createElement("div");
    deleteCell.className = "saved-layout-cell";
    deleteCell.append(layoutActionButton(ui("delete", "Delete"), () => deleteSavedLayout(layout.id)));
    row.append(name, activeCell, updateCell, deleteCell);
    savedLayoutsList.append(row);
  });
}

function iso(x, y) {
  return {
    x: state.panX + (x - y) * state.tileW * state.scale / 2,
    y: state.panY + (x + y) * state.tileH * state.scale / 2
  };
}

function screenToGrid(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const sx = (clientX - rect.left - state.panX) / state.scale;
  const sy = (clientY - rect.top - state.panY) / state.scale;
  const a = sx / (state.tileW / 2);
  const b = sy / (state.tileH / 2);
  return { x: Math.floor((a + b) / 2), y: Math.floor((b - a) / 2) };
}

let pendingRenderFrame = 0;

function draw() {
  syncBuildingActionBar();
  if (pendingRenderFrame) return;
  pendingRenderFrame = window.requestAnimationFrame(() => {
    pendingRenderFrame = 0;
    renderScene();
  });
}

function renderScene() {
  if (!ctx) return;
  const rect = board.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "#566b2d";
  ctx.fillRect(0, 0, rect.width, rect.height);
  if (state.ready && state.mode !== "overview" && state.terrainImage) {
    drawOuterGrass(rect);
  }
  if (!state.ready) {
    const restoredExpansionLevel = state.expansionLevel;
    state.expansionLevel = 0;
    drawZones();
    drawGrid();
    state.expansionLevel = restoredExpansionLevel;
    return;
  }
  drawZones();
  drawGrid();
  if (state.mode !== "overview" && state.drag?.building) {
    state.buildings.forEach(drawBuildingGroundShadow);
  }
  state.buildings
    .filter(building => building !== state.drag?.building)
    .sort(compareBuildingDepth)
    .forEach(drawBuilding);
  if (state.mode === "overview") {
    state.buildings
      .filter(building => building !== state.drag?.building)
      .forEach(drawOverviewBuildingLabel);
  }
  if (state.drag?.building) {
    drawDragPreview(state.drag.building);
    drawBuilding(state.drag.building);
  }
}

function compareBuildingDepth(a, b) {
  // Multi-tile isometric footprints cannot always be ordered by one summed
  // depth value. Diagonally adjacent rectangles can each be "behind" the
  // other on a different grid axis, even though their tall sprites overlap.
  const aBehindB = a.x + a.width <= b.x || a.y + a.height <= b.y;
  const bBehindA = b.x + b.width <= a.x || b.y + b.height <= a.y;

  if (aBehindB !== bBehindA) return aBehindB ? -1 : 1;

  const aScreenX = a.x + a.width / 2 - a.y - a.height / 2;
  const bScreenX = b.x + b.width / 2 - b.y - b.height / 2;
  if (aBehindB && bBehindA && aScreenX !== bScreenX) {
    // At a crossed corner, paint the right-hand sprite last. This matches
    // the in-game overlap direction and avoids placement-order flickering.
    return aScreenX - bScreenX;
  }

  const aDepth = a.x + a.y + a.width + a.height;
  const bDepth = b.x + b.y + b.width + b.height;
  if (aDepth !== bDepth) return aDepth - bDepth;
  return aScreenX - bScreenX;
}

function drawBuildingGroundShadow(building) {
  const corners = getFootprintCorners(building);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  corners.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
  ctx.closePath();
  ctx.fillStyle = "rgba(0, 0, 0, .25)";
  ctx.fill();
  ctx.restore();
}

function getRegionScreenBounds(region) {
  const corners = [
    iso(region.x, region.y),
    iso(region.x + region.width, region.y),
    iso(region.x + region.width, region.y + region.height),
    iso(region.x, region.y + region.height)
  ];
  const xs = corners.map(point => point.x);
  const ys = corners.map(point => point.y);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  };
}

function drawOuterGrass(rect) {
  const frame = TERRAIN_FRAMES.outerGrass;
  if (!outerGrassPattern) {
    const grassTile = document.createElement("canvas");
    grassTile.width = frame.sw;
    grassTile.height = frame.sh;
    const grassContext = grassTile.getContext("2d");
    grassContext.drawImage(
      state.terrainImage,
      frame.sx, frame.sy, frame.sw, frame.sh,
      0, 0, frame.sw, frame.sh
    );
    grassContext.fillStyle = "rgba(10, 16, 6, .36)";
    grassContext.fillRect(0, 0, frame.sw, frame.sh);
    outerGrassPattern = ctx.createPattern(grassTile, "repeat");
  }
  if (!outerGrassPattern) return;

  const sourceScale = state.tileW * state.scale / 80 * OUTER_GRASS_SCALE_MULTIPLIER;
  outerGrassPattern.setTransform(new DOMMatrix([
    sourceScale, 0,
    0, sourceScale,
    state.panX, state.panY
  ]));

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = outerGrassPattern;
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.restore();
}

function drawTerrainFrame(frame, region) {
  if (!state.terrainImage || !frame) return;
  if (Number.isFinite(frame.offsetX)) {
    const origin = iso(region.x, region.y);
    const sourceScale = state.tileW * state.scale / 80;
    ctx.drawImage(
      state.terrainImage,
      frame.sx, frame.sy, frame.sw, frame.sh,
      origin.x + frame.offsetX * sourceScale,
      origin.y + (frame.offsetY || 0) * sourceScale,
      frame.sw * sourceScale,
      frame.sh * sourceScale
    );
    return;
  }
  const bounds = getRegionScreenBounds(region);
  const widthRatio = frame.sw / (frame.logicalWidth || frame.sw);
  const heightRatio = frame.sh / (frame.logicalHeight || frame.sh);
  const width = bounds.width * widthRatio;
  const height = bounds.height * heightRatio;
  ctx.drawImage(
    state.terrainImage,
    frame.sx, frame.sy, frame.sw, frame.sh,
    bounds.left + (bounds.width - width) / 2,
    bounds.top + (bounds.height - height) / 2,
    width,
    height
  );
}

function getCastleTerrainPieces() {
  const pieces = [{
    region: { x: 0, y: 0, width: 20, height: 20 },
    terrain: TERRAIN_FRAMES.inner20x20,
    grid: TERRAIN_FRAMES.grid20x20
  }];
  let variant = 0;

  for (let blockY = 0; blockY < 3; blockY++) {
    for (let blockX = 0; blockX < 3; blockX++) {
      if (blockX === 0 && blockY === 0) continue;
      const originX = blockX * 20;
      const originY = blockY * 20;
      const splitAlongX = (blockX + blockY) % 2 === 1;
      for (let half = 0; half < 2; half++) {
        const terrainFrames = splitAlongX ? TERRAIN_FRAMES.inner20x10 : TERRAIN_FRAMES.inner10x20;
        pieces.push({
          region: splitAlongX
            ? { x: originX + half * 10, y: originY, width: 10, height: 20 }
            : { x: originX, y: originY + half * 10, width: 20, height: 10 },
          terrain: terrainFrames[variant % terrainFrames.length],
          grid: splitAlongX ? TERRAIN_FRAMES.grid10x20 : TERRAIN_FRAMES.grid20x10
        });
        variant++;
      }
    }
  }

  for (let index = 0; index < state.expansionLevel; index++) {
    pieces.push({
      region: { x: 60, y: index * 20, width: 10, height: 20 },
      terrain: TERRAIN_FRAMES.inner20x10[index % TERRAIN_FRAMES.inner20x10.length],
      grid: TERRAIN_FRAMES.grid10x20
    });
  }
  return pieces;
}

function fillCastleGround() {
  const regions = [{ x: 0, y: 0, width: 60, height: 60 }];
  if (state.expansionLevel > 0) {
    regions.push({ x: 60, y: 0, width: 10, height: state.expansionLevel * 20 });
  }
  ctx.fillStyle = CASTLE_GROUND_COLOR;
  regions.forEach(region => {
    const corners = [
      iso(region.x, region.y),
      iso(region.x + region.width, region.y),
      iso(region.x + region.width, region.y + region.height),
      iso(region.x, region.y + region.height)
    ];
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    corners.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.fill();
  });
}

function strokeCastleOutline() {
  const expansionHeight = Math.min(60, Math.max(0, state.expansionLevel * 20));
  const outline = expansionHeight === 0
    ? [[0, 0], [60, 0], [60, 60], [0, 60]]
    : expansionHeight === 60
      ? [[0, 0], [70, 0], [70, 60], [0, 60]]
      : [[0, 0], [70, 0], [70, expansionHeight], [60, expansionHeight], [60, 60], [0, 60]];
  const points = outline.map(([x, y]) => iso(x, y));
  ctx.strokeStyle = "rgba(241, 195, 71, .55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
  ctx.closePath();
  ctx.stroke();
}

function drawZones() {
  if (state.ready && state.terrainImage) {
    fillCastleGround();
    if (state.mode !== "overview") {
      getCastleTerrainPieces().forEach(piece => drawTerrainFrame(piece.terrain, piece.region));
    }
    strokeCastleOutline();
    return;
  }
  const regions = [{ x: 0, y: 0, w: state.unlocked, h: state.unlocked, active: true }];
  if (state.expansionLevel > 0) {
    regions.push({ x: 60, y: 0, w: 10, h: state.expansionLevel * 20, active: true });
  }
  for (const region of regions) {
    if (!region.active) continue;
    const p1 = iso(region.x, region.y), p2 = iso(region.x + region.w, region.y);
    const p3 = iso(region.x + region.w, region.y + region.h), p4 = iso(region.x, region.y + region.h);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.closePath();
    ctx.fillStyle = "rgba(125, 151, 68, .34)"; ctx.fill();
  }
  strokeCastleOutline();
}

function drawGrid() {
  if (state.mode === "overview") {
    drawCellGrid("rgba(47, 34, 29, .20)", 1);
    return;
  }
  if (state.ready && state.terrainImage) {
    getCastleTerrainPieces().forEach(piece => drawTerrainFrame(piece.grid, piece.region));
    return;
  }
  drawCellGrid("rgba(47, 34, 29, .20)", 1);
}

function drawCellGrid(strokeStyle, lineWidth) {
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  const main = { x: 0, y: 0, width: state.unlocked, height: state.unlocked };
  const drawCells = (zone, skipIndex = null) => {
    for (let i = 0; i <= zone.width; i++) {
      if (skipIndex === i) continue;
      const a = iso(zone.x + i, zone.y), b = iso(zone.x + i, zone.y + zone.height);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (let i = 0; i <= zone.height; i++) {
      const c = iso(zone.x, zone.y + i), d = iso(zone.x + zone.width, zone.y + i);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
    }
  };
  drawCells(main);
  if (state.expansionLevel > 0) {
    drawCells({ x: 60, y: 0, width: 10, height: state.expansionLevel * 20 }, 0);
  }
}

function drawOverviewBuildingLabel(building) {
  const corners = getFootprintCorners(building);
  const center = {
    x: corners.reduce((sum, point) => sum + point.x, 0) / corners.length,
    y: corners.reduce((sum, point) => sum + point.y, 0) / corners.length
  };
  ctx.fillStyle = "#fff0d0";
  ctx.font = "700 10px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const footprintWidth = Math.max(...corners.map(point => point.x)) - Math.min(...corners.map(point => point.x));
  const lines = wrapOverviewLabel(building.name, Math.max(46, Math.min(150, footprintWidth - 8)));
  const lineHeight = 11;
  const startY = center.y - ((lines.length - 1) * lineHeight / 2);
  lines.forEach((line, index) => ctx.fillText(line, center.x, startY + index * lineHeight));
}

function wrapOverviewLabel(value, maxWidth) {
  const text = String(value || "").trim();
  if (!text || ctx.measureText(text).width <= maxWidth) return [text];
  const words = text.split(/\s+/);
  if (words.length === 1) {
    const middle = Math.ceil(text.length / 2);
    return [fitOverviewLabel(text.slice(0, middle), maxWidth), fitOverviewLabel(text.slice(middle), maxWidth)];
  }

  let best = null;
  for (let index = 1; index < words.length; index++) {
    const first = words.slice(0, index).join(" ");
    const second = words.slice(index).join(" ");
    const widest = Math.max(ctx.measureText(first).width, ctx.measureText(second).width);
    if (!best || widest < best.widest) best = { first, second, widest };
  }
  return [fitOverviewLabel(best.first, maxWidth), fitOverviewLabel(best.second, maxWidth)];
}

function fitOverviewLabel(value, maxWidth) {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let text = value;
  while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
  return `${text}…`;
}

function drawBuilding(building) {
  const { corners, center, bottom, image, width, height } = getBuildingGeometry(building);
  if (state.mode === "overview") {
    const isDragged = state.drag?.building === building;
    if (!isDragged) {
      ctx.save();
      ctx.globalAlpha = .68;
      ctx.fillStyle = categoryColor(building.groundType);
      ctx.beginPath(); ctx.moveTo(corners[0].x, corners[0].y);
      corners.slice(1).forEach(point => ctx.lineTo(point.x, point.y)); ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(247, 234, 213, .82)"; ctx.lineWidth = 1; ctx.stroke();
    }
    if (isDragged && image?.complete && image.naturalWidth) {
      ctx.save();
      ctx.globalAlpha = .62;
      if (isBuildingAssetFlipped(building)) {
        ctx.translate(center.x, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(image, -width / 2, bottom.y - height, width, height);
      } else {
        ctx.drawImage(image, center.x - width / 2, bottom.y - height, width, height);
      }
      ctx.restore();
    }
    return;
  }
  if (image?.complete && image.naturalWidth) {
    ctx.save();
    if (CAN_HOVER_BUILDINGS && state.hoveredBuilding === building && !state.drag) {
      ctx.filter = "drop-shadow(0 0 5px rgba(255, 255, 255, .68)) drop-shadow(0 0 10px rgba(255, 255, 255, .36))";
    }
    if (isBuildingAssetFlipped(building)) {
      ctx.translate(center.x, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(image, -width / 2, bottom.y - height, width, height);
    } else {
      ctx.drawImage(image, center.x - width / 2, bottom.y - height, width, height);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = categoryColor(building.groundType);
    ctx.fillRect(center.x - 18, bottom.y - 26, 36, 26);
  }
}

function toggleBuildingRotation(building) {
  const oldWidth = building.width;
  const oldHeight = building.height;
  const oldRotation = building.rotation || 0;
  building.width = oldHeight;
  building.height = oldWidth;
  building.rotation = oldRotation ? 0 : 1;
  if (!validPosition(building, building.x, building.y)) {
    building.width = oldWidth;
    building.height = oldHeight;
    building.rotation = oldRotation;
    return;
  }
  draw();
}

function finishBuildingEdit({ restore = false, destroy = false } = {}) {
  const drag = state.drag;
  const building = drag?.building;
  if (!building) return;

  if (restore) {
    building.x = drag.x;
    building.y = drag.y;
    building.width = drag.width;
    building.height = drag.height;
    building.rotation = drag.rotation;
  } else if (destroy) {
    const index = state.buildings.indexOf(building);
    if (index !== -1) state.buildings.splice(index, 1);
  }

  stopTouchEdgePan();
  clearTouchLongPress();
  touchInteraction.gesture = null;
  state.pointer = null;
  state.drag = null;
  state.hoveredBuilding = null;
  canvas.classList.remove("is-dragging");
  draw();
}

function applyBuildingEdit() {
  const building = state.drag?.building;
  if (!building || !validPosition(building, building.x, building.y)) return;
  finishBuildingEdit();
}

function isBuildingAssetFlipped(building) {
  const defaultFlip = DEFAULT_FLIPPED_ASSET_WOD_IDS.has(String(building.id));
  return Boolean(building.rotation) !== defaultFlip;
}

function buildingAt(clientX, clientY) {
  const canvasRect = canvas.getBoundingClientRect();
  const screenX = clientX - canvasRect.left;
  const screenY = clientY - canvasRect.top;
  const point = screenToGrid(clientX, clientY);
  const topFirst = state.buildings.slice()
    .sort(compareBuildingDepth)
    .reverse();

  if (state.mode !== "overview") {
    const assetHit = topFirst.find(item => {
      const geometry = getBuildingGeometry(item);
      return visibleAssetContainsPoint(item, geometry, screenX, screenY);
    });
    if (assetHit) return assetHit;
  }

  return topFirst.find(item => point.x >= item.x && point.x < item.x + item.width
    && point.y >= item.y && point.y < item.y + item.height) || null;
}

function getImageAlphaMask(image) {
  if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return null;
  if (imageAlphaMasks.has(image)) return imageAlphaMasks.get(image);
  try {
    const maskCanvas = document.createElement("canvas");
    const maskScale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
    maskCanvas.width = Math.max(1, Math.round(image.naturalWidth * maskScale));
    maskCanvas.height = Math.max(1, Math.round(image.naturalHeight * maskScale));
    const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });
    maskContext.drawImage(image, 0, 0, maskCanvas.width, maskCanvas.height);
    const mask = {
      width: maskCanvas.width,
      height: maskCanvas.height,
      pixels: maskContext.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data
    };
    imageAlphaMasks.set(image, mask);
    return mask;
  } catch {
    // Remote images can be unreadable until their composed data URL replaces them.
    imageAlphaMasks.set(image, null);
    return null;
  }
}

function visibleAssetContainsPoint(building, geometry, screenX, screenY) {
  if (!geometry.image?.complete || !geometry.image.naturalWidth) return false;
  if (screenX < geometry.left || screenX > geometry.left + geometry.width
    || screenY < geometry.top || screenY > geometry.top + geometry.height) return false;
  const mask = getImageAlphaMask(geometry.image);
  if (!mask) return false;
  let relativeX = (screenX - geometry.left) / geometry.width;
  if (isBuildingAssetFlipped(building)) relativeX = 1 - relativeX;
  const relativeY = (screenY - geometry.top) / geometry.height;
  const pixelX = Math.max(0, Math.min(mask.width - 1, Math.floor(relativeX * mask.width)));
  const pixelY = Math.max(0, Math.min(mask.height - 1, Math.floor(relativeY * mask.height)));
  return mask.pixels[(pixelY * mask.width + pixelX) * 4 + 3] > 24;
}

function getFootprintCorners(building) {
  return [
    iso(building.x, building.y),
    iso(building.x + building.width, building.y),
    iso(building.x + building.width, building.y + building.height),
    iso(building.x, building.y + building.height)
  ];
}

function getBuildingGeometry(building) {
  const corners = getFootprintCorners(building);
  const center = {
    x: corners.reduce((sum, point) => sum + point.x, 0) / corners.length,
    y: corners.reduce((sum, point) => sum + point.y, 0) / corners.length
  };
  const verticalOffset = (BUILDING_ASSET_VERTICAL_OFFSET_TILES
    + (ASSET_VERTICAL_OFFSET_TILES.get(String(building.id)) || 0))
    * state.tileH * state.scale;
  const bottom = {
    x: corners[2].x,
    y: corners[2].y + verticalOffset
  };
  const image = state.images.get(String(building.id));
  if (image?.complete && image.naturalWidth) {
    const footprintWidth = Math.abs(corners[1].x - corners[3].x);
    // Decorations are authored to cover their complete ground footprint.
    // Regular buildings retain a little breathing room for overhanging roofs.
    const footprintScale = (String(building.groundType).toUpperCase() === "DECO" ? 1 : .96)
      * BUILDING_ASSET_SCALE;
    const width = Math.max(30, footprintWidth * footprintScale);
    const height = width * image.naturalHeight / image.naturalWidth;
    return { corners, center, bottom, image, width, height, left: center.x - width / 2, top: bottom.y - height };
  }
  return { corners, center, bottom, image, width: 36, height: 26, left: center.x - 18, top: bottom.y - 26 };
}

function drawDragPreview(building) {
  const valid = validPosition(building, building.x, building.y);
  const corners = getFootprintCorners(building);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(corners[0].x, corners[0].y);
  corners.slice(1).forEach(point => ctx.lineTo(point.x, point.y)); ctx.closePath();
  ctx.fillStyle = valid
    ? "rgba(47, 255, 46, .58)"
    : "rgba(255, 54, 35, .62)";
  ctx.strokeStyle = valid
    ? "#58ff55"
    : "#ff493b";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function categoryColor(groundType) {
  switch (String(groundType || "").toUpperCase()) {
    case "DECO": return "#6f4477";
    case "CIVIL": return "#b7c535";
    case "MILITARY": return "#3d828d";
    default: return "#808080";
  }
}

function validPosition(building, x, y) {
  if (!isBuildingInsideUnlockedAt(building, x, y)) return false;
  return !state.buildings.some(other => other !== building && x < other.x + other.width && x + building.width > other.x && y < other.y + other.height && y + building.height > other.y);
}

function isBuildingInsideUnlockedAt(building, x, y) {
  for (let row = y; row < y + building.height; row++) {
    for (let col = x; col < x + building.width; col++) {
      if (!isCellUnlocked(col, row)) return false;
    }
  }
  return true;
}

function isBuildingInsideUnlockedArea(building) {
  return isBuildingInsideUnlockedAt(building, building.x, building.y);
}

function clampBuildingToUnlockedArea(building, x, y) {
  if (isBuildingInsideUnlockedAt(building, x, y)) return { x, y };

  const regions = [{ x: 0, y: 0, width: state.unlocked, height: state.unlocked }];
  if (state.expansionLevel > 0) {
    regions.push({ x: 0, y: 0, width: 70, height: state.expansionLevel * 20 });
  }

  let nearest = null;
  regions.forEach(region => {
    const maxX = region.x + region.width - building.width;
    const maxY = region.y + region.height - building.height;
    if (maxX < region.x || maxY < region.y) return;
    const candidate = {
      x: Math.max(region.x, Math.min(maxX, x)),
      y: Math.max(region.y, Math.min(maxY, y))
    };
    const distance = (candidate.x - x) ** 2 + (candidate.y - y) ** 2;
    if (!nearest || distance < nearest.distance) nearest = { ...candidate, distance };
  });

  return nearest ? { x: nearest.x, y: nearest.y } : { x: building.x, y: building.y };
}

function moveBuildingWithinUnlockedArea(building, x, y) {
  const position = clampBuildingToUnlockedArea(building, x, y);
  building.x = position.x;
  building.y = position.y;
}

function isCellUnlocked(x, y) {
  if (x >= 0 && y >= 0 && x < state.unlocked && y < state.unlocked) return true;
  return expansionZones.some((zone, index) => index < state.expansionLevel * 4 && x >= zone.x && x < zone.x + zone.width && y >= zone.y && y < zone.y + zone.height);
}

async function addBuilding(data) {
  await ensureComposedImage(data);
  const width = Math.max(1, Number(data.width) || 1);
  const height = Math.max(1, Number(data.height) || 1);
  const building = { id: data.id, name: data.name, group: data.group, groundType: data.groundType, width, height, rotation: 0, x: 2, y: 2 };
  const spot = findOpenSpot(building);
  if (!spot) return;
  Object.assign(building, spot);
  state.buildings.push(building);
  loadImage(data);
  void ensureComposedImage(data);
  draw();
}

async function placeDefaultKeep() {
  if (state.buildings.length || state.buildings.some(building => String(building.id) === DEFAULT_KEEP_WOD_ID)) return;
  const item = state.buildingCatalog.find(building => String(building.id) === DEFAULT_KEEP_WOD_ID);
  if (!item) return;

  await ensureComposedImage(item);
  const building = {
    id: item.id,
    name: item.name,
    group: item.group,
    groundType: item.groundType,
    width: Math.max(1, Number(item.width) || 1),
    height: Math.max(1, Number(item.height) || 1),
    rotation: 0,
    x: 0,
    y: 0
  };
  if (!validPosition(building, building.x, building.y)) return;
  state.buildings.push(building);
  loadImage(item);
}

function parseWodIdList(value) {
  return Array.from(new Set(String(value || "")
    .split(/[\s,;]+/)
    .map(id => id.trim())
    .filter(id => /^\d+$/.test(id))));
}

function customDecorationWodIds() {
  return parseWodIdList(state.customDecorationWodIds);
}

function validCustomDecorationWodIds(ids) {
  const requestedIds = parseWodIdList(ids);
  if (!catalogSourceContext || !requestedIds.length) return [];
  const requested = new Set(requestedIds);
  const valid = new Set();
  const { buildings, imageMaps } = catalogSourceContext;

  buildings.forEach(item => {
    const wodId = String(item.wodID ?? "");
    if (!requested.has(wodId) || valid.has(wodId)) return;
    if (!buildingImage(imageMaps, item, itemLevel(item))) return;
    valid.add(wodId);
  });

  return requestedIds.filter(id => valid.has(id));
}

function rebuildBuildingCatalog() {
  if (!catalogSourceContext) return;
  const { buildings, imageMaps, lang } = catalogSourceContext;
  const customIds = new Set(customDecorationWodIds());
  const wantedIds = new Set([...LEGACY_CATALOG_WOD_IDS, ...customIds]);
  const maxDecoDistrict = buildings
    .filter(item => String(item.name || "").toLowerCase() === "decodistrict2x2")
    .sort((a, b) => itemLevel(b) - itemLevel(a))
    .find(item => buildingImage(imageMaps, item, itemLevel(item)));
  if (maxDecoDistrict?.wodID != null) wantedIds.add(String(maxDecoDistrict.wodID));
  const byWodId = new Map();

  buildings.forEach(item => {
    const wodId = String(item.wodID ?? "");
    if (!wantedIds.has(wodId) || byWodId.has(wodId)) return;
    const image = buildingImage(imageMaps, item, itemLevel(item));
    if (!image) return;
    byWodId.set(wodId, {
      id: item.wodID,
      name: localizedBuildingName(item, lang),
      group: item.group || item.type,
      groundType: item.buildingGroundType,
      width: item.width,
      height: item.height,
      image,
      level: itemLevel(item)
    });
  });

  state.buildingCatalog = Array.from(byWodId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function findOpenSpot(building) {
  // Treat an enabled expansion as a direct continuation of its castle rows,
  // not as a separate fallback area. validPosition() rejects the unavailable
  // part of the 70×60 bounding rectangle below a partial expansion.
  const availableWidth = state.unlocked + (state.expansionLevel > 0 ? 10 : 0);
  const orientations = [{
    width: building.width,
    height: building.height,
    rotation: building.rotation || 0
  }];
  if (building.width !== building.height) {
    orientations.push({
      width: building.height,
      height: building.width,
      rotation: building.rotation ? 0 : 1
    });
  }

  for (const orientation of orientations) {
    const candidate = { ...building, ...orientation };
    for (let y = 0; y <= state.unlocked - candidate.height; y++) {
      for (let x = 0; x <= availableWidth - candidate.width; x++) {
        if (validPosition(candidate, x, y)) return { x, y, ...orientation };
      }
    }
  }
  return null;
}

function renderCatalog() {
  const query = search.value.trim().toLowerCase();
  const activeSizes = new Set(Array.from(sizeFilters.querySelectorAll(".filter-checkbox:checked"), checkbox => checkbox.value));
  list.innerHTML = "";
  state.buildingCatalog
    .filter(item => (!query || item.name.toLowerCase().includes(query))
      && activeSizes.has(buildingSizeKey(item)))
    .slice(0, 120)
    .forEach(item => {
      const entry = document.createElement("button"); entry.type = "button"; entry.className = "building-entry";
      entry.draggable = true;
      const img = document.createElement("img");
      img.alt = "";
      if (item.image) img.src = item.image;
      if (DEFAULT_FLIPPED_ASSET_WOD_IDS.has(String(item.id))) img.classList.add("is-default-flipped");
      const text = document.createElement("span");
      text.className = "building-entry-label";
      const name = document.createElement("span");
      name.className = "building-entry-name";
      name.textContent = item.name;
      const meta = document.createElement("span");
      meta.className = "building-entry-meta";
      meta.textContent = ` (${item.width}×${item.height})`;
      text.append(name, meta);
      entry.append(img, text);
      entry.addEventListener("click", () => { void addBuilding(item); });
      entry.addEventListener("dragstart", event => {
        state.paletteDrag = item;
        event.dataTransfer?.setData("text/plain", String(item.id));
        event.dataTransfer?.setDragImage(img, 20, 20);
      });
      list.append(entry);
      if (catalogImageObserver) {
        catalogImageItems.set(img, item);
        catalogImageObserver.observe(img);
      } else {
        hydrateCatalogImage(img, item);
      }
    });
}

function buildingSizeKey(item) {
  const width = Math.max(1, Number(item.width) || 1);
  const height = Math.max(1, Number(item.height) || 1);
  return `${width}x${height}`;
}

function populateSizeFilter() {
  const sizes = new Set(state.buildingCatalog.map(buildingSizeKey));
  const sortedSizes = Array.from(sizes).sort((a, b) => {
    const [aw, ah] = a.split("x").map(Number);
    const [bw, bh] = b.split("x").map(Number);
    return bw * bh - aw * ah;
  });
  sizeFilters.replaceChildren();
  sortedSizes.forEach(size => {
    const item = document.createElement("li");
    const check = document.createElement("div");
    check.className = "form-check";
    const checkbox = document.createElement("input");
    checkbox.className = "form-check-input filter-checkbox";
    checkbox.type = "checkbox";
    checkbox.value = size;
    checkbox.id = `size-${size}`;
    checkbox.checked = true;
    const label = document.createElement("label");
    label.className = "form-check-label";
    label.htmlFor = checkbox.id;
    label.textContent = size;
    checkbox.addEventListener("change", renderCatalog);
    check.addEventListener("click", event => {
      if (event.target !== checkbox && event.target !== label) {
        checkbox.checked = !checkbox.checked;
        renderCatalog();
      }
      event.stopPropagation();
    });
    check.append(checkbox, label);
    item.append(check);
    sizeFilters.append(item);
  });
}

function setSizeDropdownOpen(isOpen) {
  sizeFilters.hidden = !isOpen;
  sizeFilters.classList.toggle("show", isOpen);
  sizeDropdown.setAttribute("aria-expanded", String(isOpen));
}

function hydrateCatalogImage(img, item) {
  void ensureComposedImage(item).then(() => {
    if (img.isConnected && item.image) img.src = item.image;
  });
}

function localizedBuildingName(item, lang) {
  const rawName = String(item.name || "").trim();
  const type = String(item.type || "").trim().toLowerCase();
  if (rawName.toLowerCase() === "hunter") {
    return lang?.hunter_surroundings_name
      || lang?.hunter_name
      || rawName;
  }
  return lang?.[`${rawName}_name`.toLowerCase()]
    || (type && lang?.[`deco_${type}_name`])
    || rawName;
}

function itemLevel(item) {
  const numeric = Number(item?.level);
  if (Number.isFinite(numeric)) return numeric;
  const match = String(item?.type || "").match(/level\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function buildingImage(imageMaps, item, maxLevel) {
  const map = imageMaps?.buildings || {};
  const nameKey = normalizeName(item.name);
  const desired = Math.max(1, Number(maxLevel) || 1);
  const isDecoration = nameKey === "deco";
  const typeLevel = /^level\d+$/i.test(String(item.type || ""))
    ? String(item.type)
    : "";
  const exactAssetKeys = (isDecoration
    ? [`Deco_Building_${item.type}`]
    : [
      `${item.name}_Building_Level${desired}`,
      typeLevel ? `${item.name}_Building_${typeLevel}` : ""
    ])
    .filter(Boolean)
    .map(normalizeName);

  for (const exactAssetKey of exactAssetKeys) {
    const exactRecord = map[exactAssetKey];
    if (!exactRecord) continue;
    const exactCandidate = exactRecord.candidates?.find(record =>
      normalizeName(record.path || record.url || "").includes(exactAssetKey)
    );
    const exactUrl = exactCandidate?.url
      || exactRecord.placedUrl
      || (typeof exactRecord === "string" ? exactRecord : "");
    if (exactUrl) return exactUrl;
  }

  const records = [];
  const addRecord = record => {
    if (!record) return;
    if (record.candidates) records.push(...record.candidates);
    else if (record.placedUrl || typeof record === "string") records.push({ url: record.placedUrl || record, path: record.placedUrl || record });
  };
  addRecord(map[nameKey]);
  const namePart = nameKey.replace(/[^a-z0-9]/g, "");
  Object.entries(map).forEach(([key, record]) => {
    const compactKey = key.replace(/[^a-z0-9]/g, "");
    if (namePart && compactKey.includes(namePart)) addRecord(record);
  });
  const unique = Array.from(new Map(records.map(record => [record.url, record])).values());
  const levelPattern = new RegExp(`level[^a-z0-9]*${desired}(?:[^0-9]|$)`, "i");
  const typePart = normalizeName(item.type);
  const typed = typePart && !/^level\d+$/.test(typePart)
    ? unique.find(record => normalizeName(record.path || record.url || "").includes(typePart))
    : null;
  const base = unique.find(record => levelPattern.test(record.path || record.url || "")
    && !/(?:\/deco\/|skin|skinned|appearance)/i.test(record.path || record.url || ""));
  const anyLevel = unique.find(record => levelPattern.test(record.path || record.url || ""));
  const selected = typed || base || anyLevel || unique[unique.length - 1];
  return selected?.url || map[nameKey]?.placedUrl || map[nameKey];
}

function loadImage(item) {
  if (!item.image || state.images.has(String(item.id))) return;
  const img = new Image();
  img.onload = () => draw();
  img.src = item.image;
  state.images.set(String(item.id), img);
}

async function ensureComposedImage(item) {
  if (!item.image || item.composed) return item.image;
  if (item.compositionPromise) return item.compositionPromise;
  const companions = deriveCompanionUrls(item.image);
  if (!companions) {
    item.composed = true;
    return item.image;
  }
  item.compositionPromise = (async () => {
    try {
      const composed = await composeAssetToDataUrl({
        ...companions,
        maxWidth: 900,
        maxHeight: 900,
        localizeSingleFrame: true,
        skipDynamicColorLayers: true
      });
      if (composed) {
        item.image = composed;
        state.images.delete(String(item.id));
        loadImage(item);
      }
      item.composed = true;
    } catch (error) {
      console.debug("Building asset composition skipped", item.name, error);
    } finally {
      item.compositionPromise = null;
    }
    return item.image;
  })();
  return item.compositionPromise;
}

async function prebuildCatalogAssets(workerCount = 4) {
  const queue = state.buildingCatalog.slice();
  const worker = async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item) await ensureComposedImage(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(workerCount, queue.length) }, worker));
}

canvas.addEventListener("wheel", event => {
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const anchorX = (event.clientX - rect.left - state.panX) / state.scale;
  const anchorY = (event.clientY - rect.top - state.panY) / state.scale;
  state.scale = Math.max(getMinCameraScale(), Math.min(MAX_CAMERA_SCALE, state.scale * (event.deltaY < 0 ? 1.1 : .9)));
  state.panX = event.clientX - rect.left - anchorX * state.scale;
  state.panY = event.clientY - rect.top - anchorY * state.scale;
  clampView();
  scheduleCameraSave();
  draw();
}, { passive: false });

canvas.addEventListener("dragover", event => event.preventDefault());
canvas.addEventListener("drop", async event => {
  event.preventDefault();
  if (!state.paletteDrag) return;
  const point = screenToGrid(event.clientX, event.clientY);
  const item = state.paletteDrag;
  await ensureComposedImage(item);
  const building = { id: item.id, name: item.name, group: item.group, groundType: item.groundType, width: item.width, height: item.height, rotation: 0, x: point.x, y: point.y };
  if (validPosition(building, building.x, building.y)) { state.buildings.push(building); void ensureComposedImage(item); loadImage(item); draw(); }
  state.paletteDrag = null;
});

function clearTouchLongPress() {
  if (touchInteraction.longPressTimer) window.clearTimeout(touchInteraction.longPressTimer);
  touchInteraction.longPressTimer = 0;
  touchInteraction.longPressCandidate = null;
}

function touchMidpoint(first, second) {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function stopTouchEdgePan() {
  if (touchEdgePanFrame) window.cancelAnimationFrame(touchEdgePanFrame);
  touchEdgePanFrame = 0;
  touchEdgePanLastTime = 0;
}

function runTouchEdgePan(timestamp) {
  touchEdgePanFrame = 0;
  const gesture = touchInteraction.gesture;
  const building = state.drag?.building;
  const pointer = gesture?.type === "building" && gesture.moved
    ? touchInteraction.pointers.get(gesture.pointerId)
    : null;
  if (!pointer || !building) {
    touchEdgePanLastTime = 0;
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const horizontalEdgeSize = Math.min(80, Math.max(52, rect.width * .16));
  const verticalEdgeSize = Math.min(90, Math.max(56, rect.height * .12));
  const localX = pointer.x - rect.left;
  const localY = pointer.y - rect.top;
  let horizontalStrength = 0;
  let verticalStrength = 0;
  if (localX < horizontalEdgeSize) {
    horizontalStrength = (horizontalEdgeSize - Math.max(0, localX)) / horizontalEdgeSize;
  } else if (localX > rect.width - horizontalEdgeSize) {
    horizontalStrength = -(horizontalEdgeSize - Math.max(0, rect.width - localX)) / horizontalEdgeSize;
  }
  if (localY < verticalEdgeSize) {
    verticalStrength = (verticalEdgeSize - Math.max(0, localY)) / verticalEdgeSize;
  } else if (localY > rect.height - verticalEdgeSize) {
    verticalStrength = -(verticalEdgeSize - Math.max(0, rect.height - localY)) / verticalEdgeSize;
  }
  if (!horizontalStrength && !verticalStrength) {
    touchEdgePanLastTime = 0;
    return;
  }

  const elapsedSeconds = touchEdgePanLastTime
    ? Math.min(32, timestamp - touchEdgePanLastTime) / 1000
    : 1 / 60;
  touchEdgePanLastTime = timestamp;
  state.panX += Math.sign(horizontalStrength)
    * TOUCH_EDGE_PAN_MAX_SPEED
    * Math.pow(Math.abs(horizontalStrength), 1.35)
    * elapsedSeconds;
  state.panY += Math.sign(verticalStrength)
    * TOUCH_EDGE_PAN_MAX_SPEED
    * Math.pow(Math.abs(verticalStrength), 1.35)
    * elapsedSeconds;
  clampView();

  const point = screenToGrid(pointer.x, pointer.y);
  moveBuildingWithinUnlockedArea(building, point.x - gesture.offsetX, point.y - gesture.offsetY);
  scheduleCameraSave();
  draw();
  touchEdgePanFrame = window.requestAnimationFrame(runTouchEdgePan);
}

function startTouchEdgePan() {
  if (!touchEdgePanFrame) touchEdgePanFrame = window.requestAnimationFrame(runTouchEdgePan);
}

function touchDistance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function startTouchPan(pointer) {
  touchInteraction.gesture = {
    type: "pan",
    pointerId: pointer.id,
    startX: pointer.startX,
    startY: pointer.startY,
    panX: state.panX,
    panY: state.panY,
    moved: false
  };
  canvas.classList.add("is-dragging");
}

function startTouchPinch() {
  stopTouchEdgePan();
  clearTouchLongPress();
  const pointers = Array.from(touchInteraction.pointers.values()).slice(0, 2);
  if (pointers.length < 2) return;
  const midpoint = touchMidpoint(pointers[0], pointers[1]);
  const rect = canvas.getBoundingClientRect();
  touchInteraction.gesture = {
    type: "pinch",
    startDistance: Math.max(1, touchDistance(pointers[0], pointers[1])),
    startScale: state.scale,
    anchorX: (midpoint.x - rect.left - state.panX) / state.scale,
    anchorY: (midpoint.y - rect.top - state.panY) / state.scale
  };
  canvas.classList.add("is-dragging");
}

function beginSelectedBuildingGesture(pointer) {
  const selected = state.drag?.building;
  if (!selected) return;
  const point = screenToGrid(pointer.x, pointer.y);
  touchInteraction.gesture = {
    type: "building",
    pointerId: pointer.id,
    startX: pointer.x,
    startY: pointer.y,
    offsetX: point.x - selected.x,
    offsetY: point.y - selected.y,
    moved: false
  };
  canvas.classList.add("is-dragging");
}

function handleTouchPointerDown(event) {
  event.preventDefault();
  const pointer = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    startX: event.clientX,
    startY: event.clientY
  };
  touchInteraction.pointers.set(event.pointerId, pointer);
  canvas.setPointerCapture?.(event.pointerId);

  if (touchInteraction.pointers.size >= 2) {
    startTouchPinch();
    return;
  }

  if (state.drag?.touchSelected && state.drag.building) {
    beginSelectedBuildingGesture(pointer);
    return;
  }

  const building = buildingAt(event.clientX, event.clientY);
  if (!building) {
    startTouchPan(pointer);
    return;
  }

  touchInteraction.longPressCandidate = {
    pointerId: event.pointerId,
    building,
    startX: event.clientX,
    startY: event.clientY,
    panX: state.panX,
    panY: state.panY
  };
  touchInteraction.longPressTimer = window.setTimeout(() => {
    const candidate = touchInteraction.longPressCandidate;
    const activePointer = touchInteraction.pointers.get(event.pointerId);
    if (!candidate || !activePointer || touchInteraction.pointers.size !== 1) return;
    touchInteraction.longPressTimer = 0;
    touchInteraction.longPressCandidate = null;
    const point = screenToGrid(activePointer.x, activePointer.y);
    state.drag = {
      building: candidate.building,
      x: candidate.building.x,
      y: candidate.building.y,
      width: candidate.building.width,
      height: candidate.building.height,
      rotation: candidate.building.rotation || 0,
      offsetX: point.x - candidate.building.x,
      offsetY: point.y - candidate.building.y,
      touchSelected: true
    };
    beginSelectedBuildingGesture(activePointer);
    navigator.vibrate?.(18);
    draw();
  }, TOUCH_LONG_PRESS_MS);
}

function handleTouchPointerMove(event) {
  const pointer = touchInteraction.pointers.get(event.pointerId);
  if (!pointer) return;
  event.preventDefault();
  pointer.x = event.clientX;
  pointer.y = event.clientY;

  if (touchInteraction.pointers.size >= 2) {
    if (touchInteraction.gesture?.type !== "pinch") startTouchPinch();
    const pointers = Array.from(touchInteraction.pointers.values()).slice(0, 2);
    const gesture = touchInteraction.gesture;
    if (pointers.length < 2 || gesture?.type !== "pinch") return;
    const midpoint = touchMidpoint(pointers[0], pointers[1]);
    const rect = canvas.getBoundingClientRect();
    state.scale = Math.max(getMinCameraScale(), Math.min(MAX_CAMERA_SCALE,
      gesture.startScale * touchDistance(pointers[0], pointers[1]) / gesture.startDistance));
    state.panX = midpoint.x - rect.left - gesture.anchorX * state.scale;
    state.panY = midpoint.y - rect.top - gesture.anchorY * state.scale;
    clampView();
    scheduleCameraSave();
    draw();
    return;
  }

  const candidate = touchInteraction.longPressCandidate;
  if (candidate?.pointerId === event.pointerId) {
    const distance = Math.hypot(pointer.x - candidate.startX, pointer.y - candidate.startY);
    if (distance <= TOUCH_MOVE_THRESHOLD) return;
    clearTouchLongPress();
    touchInteraction.gesture = {
      type: "pan",
      pointerId: event.pointerId,
      startX: candidate.startX,
      startY: candidate.startY,
      panX: candidate.panX,
      panY: candidate.panY,
      moved: true
    };
    canvas.classList.add("is-dragging");
  }

  const gesture = touchInteraction.gesture;
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  const movedDistance = Math.hypot(pointer.x - gesture.startX, pointer.y - gesture.startY);
  if (movedDistance > TOUCH_MOVE_THRESHOLD) gesture.moved = true;

  if (gesture.type === "pan") {
    stopTouchEdgePan();
    state.panX = gesture.panX + pointer.x - gesture.startX;
    state.panY = gesture.panY + pointer.y - gesture.startY;
    clampView();
    scheduleCameraSave();
    draw();
    return;
  }

  if (gesture.type === "building" && gesture.moved && state.drag?.building) {
    const point = screenToGrid(pointer.x, pointer.y);
    moveBuildingWithinUnlockedArea(
      state.drag.building,
      point.x - gesture.offsetX,
      point.y - gesture.offsetY
    );
    draw();
    startTouchEdgePan();
  }
}

function handleTouchPointerEnd(event) {
  stopTouchEdgePan();
  const gesture = touchInteraction.gesture;
  const endingPinch = gesture?.type === "pinch";
  const endingGesture = gesture?.pointerId === event.pointerId;
  clearTouchLongPress();
  touchInteraction.pointers.delete(event.pointerId);
  canvas.releasePointerCapture?.(event.pointerId);

  if (endingPinch) {
    flushCameraSave();
    touchInteraction.gesture = touchInteraction.pointers.size ? { type: "blocked" } : null;
  } else if (endingGesture && gesture.type === "pan") {
    flushCameraSave();
    touchInteraction.gesture = null;
  } else if (endingGesture && gesture.type === "building") {
    touchInteraction.gesture = null;
  }

  if (!touchInteraction.pointers.size) {
    touchInteraction.gesture = null;
    canvas.classList.remove("is-dragging");
  }
  draw();
}

canvas.addEventListener("pointerdown", event => {
  if (event.pointerType === "touch") {
    state.hoveredBuilding = null;
    handleTouchPointerDown(event);
    return;
  }
  const activeBuildingEdit = state.drag?.building ? state.drag : null;
  if (event.button === 1) {
    event.preventDefault();
    state.pointer = {
      x: event.clientX,
      y: event.clientY,
      panX: state.panX,
      panY: state.panY,
      cameraPan: true
    };
    if (!activeBuildingEdit) state.drag = { pan: true };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-dragging");
    return;
  }
  if (event.button !== 0) return;
  const point = screenToGrid(event.clientX, event.clientY);
  const building = buildingAt(event.clientX, event.clientY);
  if (activeBuildingEdit && building !== activeBuildingEdit.building) {
    if (building) return;
    state.pointer = {
      x: event.clientX,
      y: event.clientY,
      panX: state.panX,
      panY: state.panY,
      cameraPan: true
    };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-dragging");
    return;
  }
  state.pointer = { x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY };
  state.drag = activeBuildingEdit
    ? { ...activeBuildingEdit, offsetX: point.x - building.x, offsetY: point.y - building.y }
    : building
      ? {
        building,
        x: building.x,
        y: building.y,
        width: building.width,
        height: building.height,
        rotation: building.rotation || 0,
        offsetX: point.x - building.x,
        offsetY: point.y - building.y
      }
    : { pan: true };
  canvas.setPointerCapture(event.pointerId); canvas.classList.add("is-dragging");
});
canvas.addEventListener("auxclick", event => {
  if (event.button === 1) event.preventDefault();
});
canvas.addEventListener("pointermove", event => {
  if (event.pointerType === "touch") {
    handleTouchPointerMove(event);
    return;
  }
  if (!state.drag || !state.pointer) {
    const hoveredBuilding = CAN_HOVER_BUILDINGS && state.mode === "normal"
      ? buildingAt(event.clientX, event.clientY)
      : null;
    if (hoveredBuilding !== state.hoveredBuilding) {
      state.hoveredBuilding = hoveredBuilding;
      draw();
    }
    return;
  }
  if (state.pointer.cameraPan || state.drag.pan) {
    state.panX = state.pointer.panX + event.clientX - state.pointer.x;
    state.panY = state.pointer.panY + event.clientY - state.pointer.y;
    clampView();
    scheduleCameraSave();
    draw();
    return;
  }
  const point = screenToGrid(event.clientX, event.clientY);
  moveBuildingWithinUnlockedArea(
    state.drag.building,
    point.x - state.drag.offsetX,
    point.y - state.drag.offsetY
  );
  draw();
});
canvas.addEventListener("pointerup", event => {
  if (event.pointerType === "touch") {
    handleTouchPointerEnd(event);
    return;
  }
  const cameraWasMoved = Boolean(state.pointer?.cameraPan || state.drag?.pan);
  if (state.drag?.building) {
    state.pointer = null;
    canvas.classList.remove("is-dragging");
    canvas.releasePointerCapture?.(event.pointerId);
    draw();
    if (cameraWasMoved) flushCameraSave();
    return;
  }
  state.pointer = null;
  state.drag = null;
  state.hoveredBuilding = CAN_HOVER_BUILDINGS && state.mode === "normal"
    ? buildingAt(event.clientX, event.clientY)
    : null;
  canvas.classList.remove("is-dragging"); canvas.releasePointerCapture?.(event.pointerId); draw();
  if (cameraWasMoved) flushCameraSave();
});
canvas.addEventListener("pointercancel", event => {
  if (event.pointerType === "touch") handleTouchPointerEnd(event);
});
canvas.addEventListener("pointerleave", event => {
  if (event.pointerType === "touch" || state.drag || !state.hoveredBuilding) return;
  state.hoveredBuilding = null;
  draw();
});

overviewToggle.addEventListener("click", () => {
  if (state.drag?.building) {
    finishBuildingEdit({ destroy: true });
    return;
  }
  state.mode = state.mode === "normal" ? "overview" : "normal";
  state.hoveredBuilding = null;
  syncViewToggle();
  saveCameraState();
  draw();
});

fullscreenToggle.addEventListener("click", () => {
  if (state.drag?.building) {
    applyBuildingEdit();
    return;
  }
  void toggleFullscreen();
});
document.addEventListener("fullscreenchange", syncFullscreenToggle);
document.addEventListener("webkitfullscreenchange", syncFullscreenToggle);

function setBuildingsPanel(panel) {
  const showingCustomDecorations = panel === "custom-decorations";
  buildingCatalogView.hidden = showingCustomDecorations;
  customDecoForm.hidden = !showingCustomDecorations;
  buildingsModalTitle.textContent = showingCustomDecorations
    ? ui("custom_decorations", "Custom buildings")
    : ui("buildings", "Buildings");
  customDecoToggle.dataset.panel = showingCustomDecorations ? "custom-decorations" : "catalog";
  customDecoToggle.setAttribute("aria-label", showingCustomDecorations
    ? ui("back_to_buildings", "Back to buildings")
    : ui("add_custom_decoration", "Add custom building"));
  const icon = customDecoToggle.querySelector("i");
  if (icon) icon.className = `bi ${showingCustomDecorations ? "bi-arrow-left" : "bi-plus-lg"}`;
}

function addCustomDecoIdRow(value = "", focus = false) {
  const row = document.createElement("div");
  row.className = "custom-deco-id-row";
  const input = document.createElement("input");
  input.className = "form-control custom-deco-id-input";
  input.type = "number";
  input.min = "1";
  input.step = "1";
  input.inputMode = "numeric";
  input.placeholder = ui("wod_id", "WOD ID");
  input.value = value;
  input.setAttribute("aria-label", ui("decoration_wod_id", "Building WOD ID"));
  input.addEventListener("input", () => {
    if (input.value && row === customDecoRows.lastElementChild) addCustomDecoIdRow();
  });
  input.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const nextInput = row.nextElementSibling?.querySelector(".custom-deco-id-input");
    if (nextInput) nextInput.focus();
    else if (input.value) addCustomDecoIdRow("", true);
  });
  input.addEventListener("paste", event => {
    const ids = parseWodIdList(event.clipboardData?.getData("text"));
    if (ids.length < 2) return;
    event.preventDefault();
    input.value = ids[0];
    ids.slice(1).forEach(id => addCustomDecoIdRow(id));
    if (customDecoRows.lastElementChild?.querySelector(".custom-deco-id-input")?.value) {
      addCustomDecoIdRow();
    }
  });
  const remove = document.createElement("button");
  remove.className = "custom-deco-remove-row";
  remove.type = "button";
  remove.setAttribute("aria-label", ui("remove_wod_id", "Remove WOD ID"));
  remove.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
  remove.addEventListener("click", event => {
    event.stopPropagation();
    row.remove();
    const lastInput = customDecoRows.lastElementChild?.querySelector(".custom-deco-id-input");
    if (!lastInput || lastInput.value) addCustomDecoIdRow("", true);
  });
  row.append(input, remove);
  customDecoRows.append(row);
  if (focus) input.focus();
}

function renderCustomDecoIdRows(ids) {
  customDecoRows.replaceChildren();
  const values = parseWodIdList(ids);
  values.forEach(value => addCustomDecoIdRow(value));
  addCustomDecoIdRow();
}

function customDecoIdsFromRows() {
  return parseWodIdList(Array.from(customDecoRows.querySelectorAll(".custom-deco-id-input"), input => input.value));
}

sidebarToggle.addEventListener("click", () => {
  if (state.drag?.building) {
    finishBuildingEdit({ restore: true });
    return;
  }
  setSizeDropdownOpen(false);
  setBuildingsPanel("catalog");
  buildingsModal.open();
});
customDecoToggle.addEventListener("click", () => {
  const showingCustomDecorations = customDecoToggle.dataset.panel === "custom-decorations";
  if (showingCustomDecorations) {
    setBuildingsPanel("catalog");
    return;
  }
  setSizeDropdownOpen(false);
  renderCustomDecoIdRows(customDecorationWodIds());
  setBuildingsPanel("custom-decorations");
  customDecoRows.querySelector(".custom-deco-id-input")?.focus();
});
customDecoForm.addEventListener("submit", event => {
  event.preventDefault();
  const previousWodIds = new Set(customDecorationWodIds());
  const nextWodIds = validCustomDecorationWodIds(customDecoIdsFromRows());
  const nextWodIdSet = new Set(nextWodIds);
  const removedWodIds = new Set(Array.from(previousWodIds).filter(id => !nextWodIdSet.has(id)));
  state.customDecorationWodIds = nextWodIds;
  if (removedWodIds.size) {
    state.buildings = state.buildings.filter(building => !removedWodIds.has(String(building.id)));
    if (state.drag?.building && removedWodIds.has(String(state.drag.building.id))) {
      state.drag = null;
      state.pointer = null;
    }
  }
  saveCustomDecorationsToActiveLayout(removedWodIds);
  rebuildBuildingCatalog();
  populateSizeFilter();
  hydratePlacedBuildingImages();
  renderCatalog();
  void prebuildCatalogAssets();
  draw();
  setBuildingsPanel("catalog");
});
savesToggle.addEventListener("click", () => {
  if (state.drag?.building) {
    toggleBuildingRotation(state.drag.building);
    return;
  }
  renderSavedLayouts();
  savesModal.open();
});
saveLayoutButton.addEventListener("click", saveNewLayout);
layoutNameInput.addEventListener("keydown", event => {
  if (event.key === "Enter") saveNewLayout();
});
expansionSelect.addEventListener("change", () => {
  state.expansionLevel = normalizeExpansionLevel(expansionSelect.value);
  expansionSelect.value = String(state.expansionLevel);
  const removedBuildings = state.buildings.filter(building => !isBuildingInsideUnlockedArea(building));
  if (removedBuildings.length) {
    const removedSet = new Set(removedBuildings);
    state.buildings = state.buildings.filter(building => !removedSet.has(building));
    if (state.drag?.building && removedSet.has(state.drag.building)) {
      state.drag = null;
      state.pointer = null;
    }
  }
  clampView();
  scheduleCameraSave();
  draw();
});
search.addEventListener("input", renderCatalog);
sizeDropdown.addEventListener("click", () => {
  setSizeDropdownOpen(sizeFilters.hidden);
});
document.addEventListener("pointerdown", event => {
  if (sizeFilterDropdown?.contains(event.target)) return;
  setSizeDropdownOpen(false);
});
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  setSizeDropdownOpen(false);
});
window.addEventListener("resize", resizeCanvas);
window.addEventListener("pagehide", flushCameraSave);

resizeCanvas();

await loadOwnLang();
applyPageTranslations();

await coreInit({
  loader,
  itemLabel: ui("loader_item", "castle buildings"),
  langCode: currentLanguage,
  normalizeNameFn: normalizeName,
  assets: { buildings: true },
  onReady: async ({ data, imageMaps, lang }) => {
    const buildings = getArray(data, ["buildings"]);
    catalogSourceContext = { buildings, imageMaps, lang };
    rebuildBuildingCatalog();
    populateSizeFilter();
    hydratePlacedBuildingImages();
    await placeDefaultKeep();
    await Promise.all([terrainReady, prebuildCatalogAssets()]);
    await preparePlacedBuildingImages();
    renderCatalog();
    state.ready = true;
    resizeCanvas();
  }
});
