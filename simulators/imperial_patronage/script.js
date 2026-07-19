import {
  getItemVersion,
  getLangVersion,
  loadItems,
  loadLanguage,
  logResolvedDataUrls
} from "../../overviews/shared/DataService.mjs";
import { loadImageMaps } from "../../overviews/shared/ImageService.mjs";
import { initAutoHeight } from "../../overviews/shared/ResizeService.mjs";
import { initLanguageSelector, getInitialLanguage } from "../../overviews/shared/LanguageService.mjs";
import { initCustomModal } from "../../overviews/shared/ModalService.mjs";
import { createLoader } from "../../overviews/shared/LoadingService.mjs";
import { buildEffectContext } from "../../overviews/shared/EffectService.mjs";
import { initRewardDetailModal, rewardDetailAttrs } from "../../overviews/shared/RewardDetailModal.mjs";
import {
    createRewardResolver,
    buildLookup,
    getArray,
    normalizeName
} from "../../overviews/shared/RewardResolver.mjs";
import {
  getSelectedGameSource,
  saveSimulatorData,
  loadSimulatorData,
  setSelectedGameSource
} from "../../overviews/shared/GameSettings.mjs";

const SIM_NAME = "imperial_patronage";
const FALLBACK_IMAGE = "../../img_base/placeholder.webp";

initAutoHeight({
  contentSelector: "#content",
  subtractSelectors: [".page-title", ".patronage-toolbar"],
  extraOffset: 0
});

let simulatorModel = null;
let rewardResolver = null;
let ownLang = {};
let currentLanguage = getInitialLanguage();
let lang = {};
let rewardListModal = null;
let rewardDetailContext = null;
const loader = createLoader();

const state = {
  selectedSetId: "",
  selectedTypeId: "",
  gameChoiceSeen: false,
  progressBySet: {}
};

const els = {
  content: document.getElementById("content"),
  setSelect: document.getElementById("setSelect"),
  typeSelect: document.getElementById("typeSelect"),
  donationPanel: document.querySelector(".donation-panel"),
  donationRows: document.getElementById("donationRows"),
  panelFooter: document.querySelector(".panel-footer"),
  rewardPanel: document.querySelector(".reward-panel"),
  rewardMeterFill: document.getElementById("rewardMeterFill"),
  rewardMeterStagedFill: document.getElementById("rewardMeterStagedFill"),
  rewardMeterLevelGain: document.getElementById("rewardMeterLevelGain"),
  pointsToNextValue: document.getElementById("pointsToNextValue"),
  mobileCurrentPointsValue: document.getElementById("mobileCurrentPointsValue"),
  mobilePointsToNextValue: document.getElementById("mobilePointsToNextValue"),
  currentRewardImage: document.getElementById("currentRewardImage"),
  currentRewardName: document.getElementById("currentRewardName"),
  currentRewardLevelLabel: document.getElementById("currentRewardLevelLabel"),
  nextRewardImage: document.getElementById("nextRewardImage"),
  nextRewardName: document.getElementById("nextRewardName"),
  nextRewardLevelLabel: document.getElementById("nextRewardLevelLabel"),
  rewardCardsStack: document.getElementById("rewardCardsStack"),
  currentRewardCard: document.getElementById("currentRewardCard"),
  nextRewardCard: document.getElementById("nextRewardCard"),
  rewardPreviewTotal: document.getElementById("rewardPreviewTotal"),
  rewardWarning: document.getElementById("rewardWarning"),
  resetSlidersBtn: document.getElementById("resetSlidersBtn"),
  resetStagedBtn: document.getElementById("resetStagedBtn"),
  donateBtn: document.getElementById("donateBtn"),
  rewardListBtn: document.getElementById("rewardListBtn"),
  rewardListModal: document.getElementById("rewardListModal"),
  rewardListModalBody: document.getElementById("rewardListModalBody")
};

function lowercaseKeysRecursive(input) {
  if (!input || typeof input !== "object") return input;
  if (Array.isArray(input)) return input.map(lowercaseKeysRecursive);
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key.toLowerCase(), lowercaseKeysRecursive(value)])
  );
}

function titleCase(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatNumber(value) {
  return (Number(value) || 0).toLocaleString("en-US");
}

function formatAmountDisplayValue(value) {
  return formatNumber(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseAmountInput(value) {
  return String(value ?? "")
    .replace(/[.,\s]/g, "")
    .replace(/[^\d]/g, "");
}

function resolveDonationTypeLabel(type, lang) {
  const rawName = String(type?.name || "").toLowerCase();
  const typeLabel = String(lang?.filters_filter_21 || "Type").toLowerCase();

  if (rawName.includes("builder")) {
    return `${lang?.dialog_maindonationevent_tooltip_builder || "Builder"} ${typeLabel}`;
  }

  if (rawName.includes("architect")) {
    return `${lang?.dialog_maindonationevent_tooltip_architect || "Architect"} ${typeLabel}`;
  }

  return `${titleCase(type?.name)} ${typeLabel}`.trim();
}

function getUiLang() {
  return ownLang?.[currentLanguage?.toLowerCase()]?.ui
    || ownLang?.[currentLanguage?.split("-")[0]?.toLowerCase()]?.ui
    || ownLang?.en?.ui
    || {};
}

function ui(key, fallback) {
  return getUiLang()?.[key] || fallback;
}

function initTooltips(root = document) {
  if (!window.bootstrap?.Tooltip) return;
  const isMobile = window.matchMedia("(max-width: 700px)").matches;
  root.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((element) => {
    const instance = window.bootstrap.Tooltip.getInstance(element);
    if (isMobile) {
      instance?.dispose();
      return;
    }
    window.bootstrap.Tooltip.getOrCreateInstance(element);
  });
}

function syncMobileDonationPanelHeight() {
  if (!els.donationPanel || !els.donationRows || !els.panelFooter) return;

  const isMobile = window.matchMedia("(max-width: 700px)").matches;
  if (!isMobile) {
    els.donationPanel.style.height = "";
    els.donationPanel.style.maxHeight = "";
    els.donationRows.style.height = "";
    els.donationRows.style.maxHeight = "";
    return;
  }

  const panelRect = els.donationPanel.getBoundingClientRect();
  const footerRect = els.panelFooter.getBoundingClientRect();
  const availablePanelHeight = Math.floor(footerRect.top - panelRect.top);

  if (availablePanelHeight > 120) {
    els.donationPanel.style.height = `${availablePanelHeight}px`;
    els.donationPanel.style.maxHeight = `${availablePanelHeight}px`;
    els.donationRows.style.height = `${availablePanelHeight}px`;
    els.donationRows.style.maxHeight = `${availablePanelHeight}px`;
  }
}

function extractDecorations(buildings) {
  return (buildings || []).filter((item) =>
    item?.wodID && String(item.name || "").toLowerCase() === "deco"
  );
}

async function loadOwnLang() {
  try {
    const res = await fetch("./ownLang.json");
    ownLang = lowercaseKeysRecursive(await res.json());
  } catch {
    ownLang = {};
  }
}

function readSavedState() {
  try {
    const parsed = loadSimulatorData(SIM_NAME) || {};
    state.selectedSetId = String(parsed.selectedSetId || "");
    state.selectedTypeId = String(parsed.selectedTypeId || "");
    state.gameChoiceSeen = Boolean(parsed.gameChoiceSeen);
    state.progressBySet = parsed.progressBySet && typeof parsed.progressBySet === "object"
      ? parsed.progressBySet
      : {};
  } catch {
    state.selectedSetId = "";
    state.selectedTypeId = "";
    state.gameChoiceSeen = false;
    state.progressBySet = {};
  }
}

function saveState() {
  saveSimulatorData(SIM_NAME, state);
}

function applyGameChoiceLanguage() {
  const title = document.getElementById("patronageGameChoiceTitle");
  const text = document.getElementById("patronageGameChoiceText");
  const continueBtn = document.getElementById("patronageGameChoiceContinue");
  if (title) title.textContent = ui("game_choice_title", "Choose game");
  if (text) {
    text.textContent = ui(
      "game_choice_text",
      "EM (computer) and E4K (mobile) games may use different data. Choose your game."
    );
  }
  if (continueBtn) continueBtn.textContent = ui("continue", "Continue");
}

function syncGameChoiceOptionLabels(select) {
  if (!select) return;
  const empireOption = select.querySelector('option[value="empire"]');
  const e4kOption = select.querySelector('option[value="e4k"]');
  const isMobile = window.matchMedia("(max-width: 700px)").matches;
  if (empireOption) empireOption.textContent = isMobile ? "EM (Browser)" : "Empire (Browser)";
  if (e4kOption) e4kOption.textContent = isMobile ? "E4K (Mobile)" : "Empire: Four Kingdoms (Mobile)";
}

function showInitialGameChoiceIfNeeded() {
  if (state.gameChoiceSeen) return Promise.resolve();
  const modalEl = document.getElementById("patronageGameChoiceModal");
  const select = document.getElementById("patronageGameChoiceSelect");
  const continueBtn = document.getElementById("patronageGameChoiceContinue");
  if (!modalEl || !select || !continueBtn) {
    state.gameChoiceSeen = true;
    saveState();
    return Promise.resolve();
  }

  applyGameChoiceLanguage();
  syncGameChoiceOptionLabels(select);
  select.value = getSelectedGameSource();

  const gameChoiceModal = {
    open() {
      modalEl.setAttribute("aria-hidden", "false");
      modalEl.classList.remove("closing");
      modalEl.classList.add("open");
      document.body.classList.add("gf-modal-open");
    },
    close() {
      modalEl.classList.remove("open");
      modalEl.setAttribute("aria-hidden", "true");
      document.body.classList.remove("gf-modal-open");
    }
  };

  return new Promise((resolve) => {
    const finish = ({ reload = false } = {}) => {
      state.gameChoiceSeen = true;
      saveState();
      if (reload) {
        window.location.reload();
        return;
      }
      gameChoiceModal?.close?.();
      resolve();
    };

    const handleSelectChange = () => {
      const previousGame = getSelectedGameSource();
      const nextGame = setSelectedGameSource(select.value);
      finish({ reload: nextGame !== previousGame });
    };

    select.addEventListener("change", handleSelectChange, { once: true });
    continueBtn.addEventListener("click", () => finish(), { once: true });
    window.addEventListener("resize", () => syncGameChoiceOptionLabels(select));
    gameChoiceModal?.open?.();
  });
}

function ensureSetProgress(setId, typeIds) {
  const safeSetId = String(setId || "");
  state.progressBySet[safeSetId] ??= {
    committedPointsByType: {},
    committedAmountsByType: {},
    stagedAmountsByType: {}
  };

  const progress = state.progressBySet[safeSetId];
  progress.committedPointsByType ??= {};
  progress.committedAmountsByType ??= {};
  progress.stagedAmountsByType ??= {};

  typeIds.forEach((typeId) => {
    const safeTypeId = String(typeId);
    progress.committedPointsByType[safeTypeId] = Number(progress.committedPointsByType[safeTypeId]) || 0;
    progress.committedAmountsByType[safeTypeId] ??= {};
    progress.stagedAmountsByType[safeTypeId] ??= {};
  });

  return progress;
}

function getCurrentSetModel() {
  return simulatorModel?.setsById?.[String(state.selectedSetId)] || simulatorModel?.sets?.[0] || null;
}

function getCurrentTypeModel() {
  const setModel = getCurrentSetModel();
  return setModel?.typesById?.[String(state.selectedTypeId)] || setModel?.types?.[0] || null;
}

function normalizeHash(value) {
  return String(value || "")
    .replace(/^#/, "")
    .trim()
    .toLowerCase();
}

function getSetIdFromHash() {
  const hash = normalizeHash(window.location.hash);
  if (!hash) return "";
  const versionMatch = hash.match(/^v(?:ersion)?[-_]?(\d+)$/);
  if (versionMatch) {
    const setId = versionMatch[1];
    return simulatorModel?.setsById?.[setId] ? setId : "";
  }
  return simulatorModel?.setsById?.[hash] ? hash : "";
}

function updateHashForSet(setId) {
  if (!setId) return;
  const nextHash = `version${setId}`;
  if (normalizeHash(window.location.hash) !== nextHash) {
    window.location.hash = nextHash;
  }
}

function applySetSelection(setId, { updateHash = true } = {}) {
  const nextSet = simulatorModel?.setsById?.[String(setId)];
  if (!nextSet) return false;
  state.selectedSetId = nextSet.id;
  state.selectedTypeId = nextSet.typesById[String(state.selectedTypeId)] ? state.selectedTypeId : nextSet.types[0].id;
  ensureSetProgress(nextSet.id, nextSet.types.map((type) => type.id));
  if (updateHash) updateHashForSet(nextSet.id);
  return true;
}

function getCurrentProgress() {
  const setModel = getCurrentSetModel();
  return setModel ? ensureSetProgress(setModel.id, setModel.types.map((type) => type.id)) : null;
}

function getCommittedAmount(typeModel, optionId) {
  const progress = getCurrentProgress();
  return Number(progress?.committedAmountsByType?.[String(typeModel.id)]?.[String(optionId)]) || 0;
}

function getAllowedStageAmount(typeModel, option) {
  if (option.maxAmount === null) return Infinity;
  return Math.max(0, option.maxAmount - getCommittedAmount(typeModel, option.id));
}

function sanitizeAmount(typeModel, option, value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  const stepped = Math.floor(parsed / option.ratio) * option.ratio;
  const allowedStageAmount = getAllowedStageAmount(typeModel, option);
  if (allowedStageAmount !== Infinity) {
    return Math.max(0, Math.min(stepped, allowedStageAmount));
  }
  return Math.max(0, stepped);
}

function getStagedAmounts(typeModel) {
  const progress = getCurrentProgress();
  return progress?.stagedAmountsByType?.[String(typeModel.id)] || {};
}

function getCommittedPoints(typeModel) {
  const progress = getCurrentProgress();
  return Number(progress?.committedPointsByType?.[String(typeModel.id)]) || 0;
}

function getStagedPoints(typeModel) {
  const stagedAmounts = getStagedAmounts(typeModel);
  return typeModel.options.reduce((sum, option) =>
    sum + Math.floor((sanitizeAmount(typeModel, option, stagedAmounts[String(option.id)] || 0)) / option.ratio), 0);
}

function getPreviewPoints(typeModel) {
  return getCommittedPoints(typeModel) + getStagedPoints(typeModel);
}

function getHighestThreshold(typeModel) {
  return Number(typeModel.rewards[typeModel.rewards.length - 1]?.minPoints) || 0;
}

function findRewardAtPoints(typeModel, points) {
  let reward = null;
  typeModel.rewards.forEach((entry) => {
    if (Number(entry.minPoints) <= points) {
      reward = entry;
    }
  });
  return reward;
}

function findNextRewardAfterPoints(typeModel, points) {
  return typeModel.rewards.find((entry) => Number(entry.minPoints) > points) || null;
}

function getSoftSliderMax(option, typeModel) {
  if (option.maxAmount !== null) return option.maxAmount;
  const currentOptionAmount = sanitizeAmount(
    typeModel,
    option,
    getStagedAmounts(typeModel)[String(option.id)] || 0
  );
  const highestThreshold = getHighestThreshold(typeModel);
  const thresholdDrivenMax = Math.max(option.ratio * highestThreshold, option.ratio * 80);
  return Math.max(thresholdDrivenMax, currentOptionAmount);
}

function getRewardStatus(typeModel) {
  const committedPoints = getCommittedPoints(typeModel);
  const previewPoints = getPreviewPoints(typeModel);
  const currentReward = findRewardAtPoints(typeModel, committedPoints);
  const previewReward = findRewardAtPoints(typeModel, previewPoints);
  const nextReward = findNextRewardAfterPoints(typeModel, committedPoints);

  const currentIndex = currentReward ? typeModel.rewards.findIndex((reward) => reward.id === currentReward.id) + 1 : 0;
  const previewIndex = previewReward ? typeModel.rewards.findIndex((reward) => reward.id === previewReward.id) + 1 : 0;
  const nextIndex = nextReward ? typeModel.rewards.findIndex((reward) => reward.id === nextReward.id) + 1 : previewIndex;
  const currentRewardMin = Number(currentReward?.minPoints) || 0;
  const nextMin = Number(nextReward?.minPoints) || currentRewardMin;
  const progressSpan = Math.max(1, nextMin - currentRewardMin);
  const committedLevelPoints = Math.max(0, committedPoints - currentRewardMin);
  const previewLevelPoints = Math.max(0, previewPoints - currentRewardMin);
  const clampedPreviewPoints = nextReward ? Math.min(previewPoints, nextMin) : previewPoints;
  const committedInside = nextReward ? Math.min(progressSpan, Math.max(0, committedPoints - currentRewardMin)) : progressSpan;
  const progressInside = nextReward ? Math.min(progressSpan, Math.max(0, clampedPreviewPoints - currentRewardMin)) : progressSpan;

  return {
    committedPoints,
    previewPoints,
    committedLevelPoints,
    previewLevelPoints,
    currentReward,
    previewReward,
    nextReward,
    currentIndex,
    previewIndex,
    levelGain: Math.max(0, previewIndex - currentIndex),
    nextIndex,
    pointsToNext: nextReward ? Math.max(0, nextMin - committedPoints) : 0,
    committedPercent: nextReward ? Math.round((committedInside / progressSpan) * 100) : 100,
    percent: nextReward ? Math.round((progressInside / progressSpan) * 100) : 100,
    overcap: previewPoints > getHighestThreshold(typeModel)
      ? previewPoints - getHighestThreshold(typeModel)
      : 0
  };
}

function getRewardImage(reward) {
  if (!reward?.entries?.length) return FALLBACK_IMAGE;
  return getRewardEntryImage(reward.entries[0]);
}

function getRewardEntryImage(entry) {
  if (!entry) return FALLBACK_IMAGE;
  return (
    rewardResolver.getDecorationImageUrl(entry) ||
    rewardResolver.getConstructionImageUrl(entry) ||
    rewardResolver.getEquipmentImageUrl(entry) ||
    rewardResolver.getUnitImageUrl(entry) ||
    rewardResolver.getCurrencyImageUrl(entry) ||
    rewardResolver.getLootBoxImageUrl(entry) ||
    rewardResolver.getAllianceLayoutImageUrl(entry) ||
    FALLBACK_IMAGE
  );
}

function getRewardLabel(reward) {
  if (!reward) return "No reward yet";
  const main = reward.entries?.[0];
  if (!main) return reward.commentLabel || "Reward";
  return `${main.name}${main.amount > 1 ? ` x${formatNumber(main.amount)}` : ""}`;
}

function normalizeRewardDetailType(type) {
  const raw = String(type || "").trim();
  const lower = raw.toLowerCase();
  if (lower === "lootbox" || lower === "loot_box") return "lootbox";
  if (lower === "lootboxoffer" || lower === "offering") return "offering";
  if (lower === "soldier" || lower === "troop" || lower === "eventunit") return "unit";
  if (lower === "eventtool" || lower === "tool") return "unit";
  if (lower === "constructionitem") return "construction";
  if (lower === "item") return "equipment";
  return lower;
}

function canOpenRewardDetail(entry) {
  return ["lootbox", "offering", "unit", "decoration", "construction", "equipment", "gem"]
    .includes(normalizeRewardDetailType(entry?.type));
}

function getRewardDetail(entry) {
  if (!entry || !canOpenRewardDetail(entry)) return null;
  return {
    type: normalizeRewardDetailType(entry.type),
    id: entry.id || "",
    name: entry.name || "",
    amount: entry.amount || "",
    imageUrl: getRewardEntryImage(entry)
  };
}

function clearRewardDetailAttrs(element) {
  [
    "rewardDetail",
    "rewardType",
    "rewardId",
    "rewardName",
    "rewardAmount",
    "rewardImage"
  ].forEach((key) => {
    delete element.dataset[key];
  });
}

function applyRewardDetailTrigger(card, reward) {
  if (!card) return;
  const detail = getRewardDetail(reward?.entries?.[0]);

  clearRewardDetailAttrs(card);
  if (detail) {
    card.dataset.rewardDetail = "1";
    card.dataset.rewardType = detail.type;
    card.dataset.rewardId = String(detail.id || "");
    card.dataset.rewardName = String(detail.name || "");
    card.dataset.rewardAmount = String(detail.amount || "");
    card.dataset.rewardImage = String(detail.imageUrl || "");
    card.style.cursor = "pointer";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
  } else {
    card.style.cursor = "";
    card.removeAttribute("role");
    card.removeAttribute("tabindex");
  }
}

function getRewardEntryLabel(entry) {
  const rewardLabel = lang?.reward || "Reward";
  if (!entry) return rewardLabel;
  return `${entry.name || rewardLabel}${entry.amount > 1 ? ` x${formatNumber(entry.amount)}` : ""}`;
}

function getRewardDetailAttrs(entry, imageUrl) {
  const detail = getRewardDetail(entry);
  return detail ? rewardDetailAttrs({ ...detail, imageUrl }) : "";
}

function renderRewardListModal() {
  if (!els.rewardListModalBody || !simulatorModel?.sets?.length) return;
  const visibleSets = simulatorModel.sets
    .filter((setModel) => String(setModel.id) === String(state.selectedSetId));

  els.rewardListModalBody.innerHTML = `
    <div class="patronage-reward-list">
      ${visibleSets.map((setModel) => `
        <section class="patronage-version-group">
          ${setModel.types.map((typeModel) => `
            <section class="patronage-type-group">
              <h4 class="patronage-type-title">${escapeHtml(typeModel.label)}</h4>
              <table class="patronage-reward-table">
                <thead>
                  <tr>
                    <th>${escapeHtml(lang?.level || "Level")}</th>
                    <th>${escapeHtml(lang?.points_novalue || "Points")}</th>
                    <th>${escapeHtml(lang?.reward || "Reward")}</th>
                  </tr>
                </thead>
                <tbody>
                  ${typeModel.rewards.map((reward, index) => `
                    <tr>
                      <td class="patronage-level-cell">${formatNumber(index + 1)}</td>
                      <td class="patronage-points-cell">${formatNumber(reward.minPoints)}</td>
                      <td>
                        <div class="patronage-reward-items">
                          ${(reward.entries?.length ? reward.entries : [null]).map((entry) => {
                            const label = getRewardEntryLabel(entry);
                            const imageUrl = getRewardEntryImage(entry);
                            const detailAttrs = getRewardDetailAttrs(entry, imageUrl);
                            const content = `
                              <img src="${escapeHtml(imageUrl)}" alt="">
                              <span>${escapeHtml(label)}</span>
                            `;
                            return detailAttrs
                              ? `<button class="patronage-reward-item patronage-reward-item-button" type="button" ${detailAttrs}>${content}</button>`
                              : `<div class="patronage-reward-item">${content}</div>`;
                          }).join("")}
                        </div>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </section>
          `).join("")}
        </section>
      `).join("")}
    </div>
  `;
}

function updateAmount(typeModel, optionId, rawValue) {
  const option = typeModel?.optionsById?.[String(optionId)];
  const progress = getCurrentProgress();
  if (!option || !progress) return;
  progress.stagedAmountsByType[String(typeModel.id)][String(optionId)] =
    sanitizeAmount(typeModel, option, rawValue);
  saveState();
  updateLivePanels(typeModel, optionId);
}

function adjustAmount(typeModel, optionId, deltaPoints) {
  const option = typeModel?.optionsById?.[String(optionId)];
  if (!option) return;
  const current = Number(getStagedAmounts(typeModel)[String(optionId)]) || 0;
  updateAmount(typeModel, optionId, current + (deltaPoints * option.ratio));
}

function setMaxAmount(typeModel, optionId) {
  const option = typeModel?.optionsById?.[String(optionId)];
  if (!option) return;
  updateAmount(typeModel, optionId, option.maxAmount ?? getSoftSliderMax(option, typeModel));
}

function commitStaged() {
  const typeModel = getCurrentTypeModel();
  const progress = getCurrentProgress();
  if (!typeModel || !progress) return;
  const stagedPoints = getStagedPoints(typeModel);
  if (stagedPoints <= 0) return;
  const typeId = String(typeModel.id);
  const stagedAmounts = progress.stagedAmountsByType[typeId] || {};
  progress.committedPointsByType[typeId] = (Number(progress.committedPointsByType[typeId]) || 0) + stagedPoints;
  progress.committedAmountsByType[typeId] ??= {};
  Object.entries(stagedAmounts).forEach(([optionId, amount]) => {
    progress.committedAmountsByType[typeId][optionId] =
      (Number(progress.committedAmountsByType[typeId][optionId]) || 0) + (Number(amount) || 0);
  });
  progress.stagedAmountsByType[typeId] = {};
  saveState();
  updateLivePanels(typeModel);
}

function resetCurrentTypeProgress() {
  const typeModel = getCurrentTypeModel();
  const progress = getCurrentProgress();
  if (!typeModel || !progress) return;
  const typeId = String(typeModel.id);
  progress.stagedAmountsByType[typeId] = {};
  progress.committedPointsByType[typeId] = 0;
  progress.committedAmountsByType[typeId] = {};
  saveState();
  updateLivePanels(typeModel);
}

function resetCurrentTypeStaged() {
  const typeModel = getCurrentTypeModel();
  const progress = getCurrentProgress();
  if (!typeModel || !progress) return;
  const typeId = String(typeModel.id);
  progress.stagedAmountsByType[typeId] = {};
  saveState();
  updateLivePanels(typeModel);
}

function resetAllProgress() {
  const setModel = getCurrentSetModel();
  if (!setModel) return;
  state.progressBySet[String(setModel.id)] = {
    committedPointsByType: {},
    committedAmountsByType: {},
    stagedAmountsByType: {}
  };
  ensureSetProgress(setModel.id, setModel.types.map((type) => type.id));
  saveState();
  render();
}

function renderSetSelect() {
  const currentSet = getCurrentSetModel();
  els.setSelect.innerHTML = simulatorModel.sets.map((setModel) => `
    <option value="${setModel.id}" ${setModel.id === currentSet?.id ? "selected" : ""}>${setModel.label}</option>
  `).join("");
}

function renderTypeSelect(setModel) {
  els.typeSelect.innerHTML = setModel.types.map((typeModel) => `
    <option value="${typeModel.id}" ${String(typeModel.id) === String(state.selectedTypeId) ? "selected" : ""}>
      ${typeModel.label}
    </option>
  `).join("");
}

function renderDonationRows(typeModel) {
  const stagedAmounts = getStagedAmounts(typeModel);
  els.donationRows.innerHTML = typeModel.options.map((option) => {
    const currentAmount = sanitizeAmount(typeModel, option, stagedAmounts[String(option.id)] || 0);
    const committedAmount = getCommittedAmount(typeModel, option.id);
    const totalUsedAmount = committedAmount + currentAmount;
    const allowedStageAmount = getAllowedStageAmount(typeModel, option);
    const sliderMax = getSoftSliderMax(option, typeModel);

    return `
      <div class="donation-row" data-option-row="${option.id}">
        <div class="currency-badge" data-bs-toggle="tooltip" data-bs-placement="right" data-bs-title="1 point = ${formatNumber(option.ratio)}">
          <div class="currency-frame">
            <img src="${option.imageUrl || FALLBACK_IMAGE}" alt="${option.label}">
          </div>
        </div>
        <div class="row-main">
          <div class="row-meta">
            <div><h3 class="row-title">${option.label}</h3></div>
          </div>
          <div class="row-controls">
            <button type="button" class="amount-button" data-action="decrease" data-option-id="${option.id}">-</button>
            <input class="amount-display amount-display-current" data-action="amount-input" data-option-id="${option.id}" data-role="amount-display" type="text" inputmode="numeric" pattern="[0-9,.\\s]*" autocomplete="off" aria-label="${option.label} amount" value="${formatAmountDisplayValue(currentAmount)}">
            <button type="button" class="amount-button" data-action="increase" data-option-id="${option.id}">+</button>
            <input class="amount-slider" data-action="slider" data-option-id="${option.id}" type="range" min="0" max="${Math.min(sliderMax, allowedStageAmount === Infinity ? sliderMax : allowedStageAmount)}" step="${option.ratio}" value="${Math.min(currentAmount, sliderMax, allowedStageAmount === Infinity ? sliderMax : allowedStageAmount)}">
            <button type="button" class="max-button" data-action="max" data-option-id="${option.id}">Max</button>
          </div>
          <div class="row-foot">
            ${option.maxAmount !== null
        ? `<span data-role="used-cap">${ui("total_used", "Total used")}: ${formatNumber(totalUsedAmount)} / ${formatNumber(option.maxAmount)}</span>`
        : `<span data-role="used-total">${ui("total_used", "Total used")}: ${formatNumber(totalUsedAmount)}</span>`}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function updateOptionRow(typeModel, optionId) {
  const option = typeModel?.optionsById?.[String(optionId)];
  const row = els.donationRows.querySelector(`[data-option-row="${optionId}"]`);
  if (!option || !row) return;

  const stagedAmounts = getStagedAmounts(typeModel);
  const currentAmount = sanitizeAmount(typeModel, option, stagedAmounts[String(option.id)] || 0);
  const committedAmount = getCommittedAmount(typeModel, option.id);
  const totalUsedAmount = committedAmount + currentAmount;
  const allowedStageAmount = getAllowedStageAmount(typeModel, option);
  const sliderMax = getSoftSliderMax(option, typeModel);
  const effectiveSliderMax = Math.min(
    sliderMax,
    allowedStageAmount === Infinity ? sliderMax : allowedStageAmount
  );

  const amountDisplay = row.querySelector('[data-role="amount-display"]');
  const usedCap = row.querySelector('[data-role="used-cap"]');
  const usedTotal = row.querySelector('[data-role="used-total"]');
  const slider = row.querySelector('.amount-slider');
  const decreaseBtn = row.querySelector('[data-action="decrease"]');
  const increaseBtn = row.querySelector('[data-action="increase"]');
  const maxBtn = row.querySelector('[data-action="max"]');

  if (amountDisplay && document.activeElement !== amountDisplay) {
    amountDisplay.value = formatAmountDisplayValue(currentAmount);
  }
  if (usedCap && option.maxAmount !== null) {
    usedCap.textContent = `${ui("total_used", "Total used")}: ${formatNumber(totalUsedAmount)} / ${formatNumber(option.maxAmount)}`;
  }
  if (usedTotal && option.maxAmount === null) {
    usedTotal.textContent = `${ui("total_used", "Total used")}: ${formatNumber(totalUsedAmount)}`;
  }
  if (slider) {
    slider.max = String(effectiveSliderMax);
    slider.value = String(Math.min(currentAmount, effectiveSliderMax));
  }

  const capped = option.maxAmount !== null && allowedStageAmount <= 0;
  if (increaseBtn) increaseBtn.disabled = capped;
  if (maxBtn) maxBtn.disabled = capped;
  if (amountDisplay) amountDisplay.classList.toggle("is-capped", capped);
  if (amountDisplay) amountDisplay.disabled = capped;
  if (slider) slider.disabled = capped;
  if (decreaseBtn) decreaseBtn.disabled = currentAmount <= 0;
}

function renderRewardPanel(typeModel) {
  const status = getRewardStatus(typeModel);
  const currentReward = status.currentReward;
  const currentLevelLabel = lang?.dialog_maindonationevent_reward_currentlevel || ui("current_level", "Current Level");
  const nextLevelLabel = lang?.dialog_maindonationevent_reward_nextlevel || ui("next_level", "Next Level");
  const pointsLabel = lang?.points_novalue || "Points";
  const isCompactLevelView = window.matchMedia("(max-width: 991px)").matches;
  const mobileLevelLabel = String(lang?.dialog_maindonationevent_reward_tier || "Level").replace("{0}", "").trim() || "Level";
  const nextReward = status.nextReward;
  const nextIndex = status.nextIndex;
  const stagedTotalPoints = Math.max(0, status.previewPoints - status.committedPoints);
  els.pointsToNextValue.textContent = formatNumber(status.pointsToNext);
  if (els.mobileCurrentPointsValue) {
    els.mobileCurrentPointsValue.innerHTML = stagedTotalPoints > 0
      ? `${formatNumber(status.committedLevelPoints)} <span class="reward-inline-note">(+${formatNumber(stagedTotalPoints)})</span>`
      : formatNumber(status.committedLevelPoints);
  }
  if (els.mobilePointsToNextValue) els.mobilePointsToNextValue.textContent = formatNumber(status.pointsToNext);
  els.rewardPreviewTotal.innerHTML = stagedTotalPoints > 0
    ? `${formatNumber(status.committedLevelPoints)} <span class="reward-inline-note">(+${formatNumber(stagedTotalPoints)})</span>`
    : formatNumber(status.committedLevelPoints);
  els.rewardWarning.textContent = "";
  if (els.rewardMeterLevelGain) {
    const showLevelGain = status.levelGain > 0;
    els.rewardMeterLevelGain.textContent = showLevelGain ? `+${status.levelGain}` : "";
    els.rewardMeterLevelGain.classList.toggle("is-visible", showLevelGain);
  }

  if (window.matchMedia("(max-width: 991px)").matches) {
    const stagedPercent = Math.max(0, status.percent - status.committedPercent);
    els.rewardMeterFill.style.width = `${status.committedPercent}%`;
    els.rewardMeterFill.style.height = "100%";
    els.rewardMeterFill.style.left = "0";
    if (els.rewardMeterStagedFill) {
      els.rewardMeterStagedFill.style.width = `${stagedPercent}%`;
      els.rewardMeterStagedFill.style.height = "100%";
      els.rewardMeterStagedFill.style.left = `${status.committedPercent}%`;
      els.rewardMeterStagedFill.style.bottom = "0";
    }
  } else {
    const stagedPercent = Math.max(0, status.percent - status.committedPercent);
    els.rewardMeterFill.style.height = `${status.committedPercent}%`;
    els.rewardMeterFill.style.width = "100%";
    els.rewardMeterFill.style.left = "0";
    if (els.rewardMeterStagedFill) {
      els.rewardMeterStagedFill.style.height = `${stagedPercent}%`;
      els.rewardMeterStagedFill.style.width = "100%";
      els.rewardMeterStagedFill.style.bottom = `${status.committedPercent}%`;
      els.rewardMeterStagedFill.style.left = "0";
    }
  }

  els.currentRewardImage.src = getRewardImage(currentReward);
  els.currentRewardImage.alt = getRewardLabel(currentReward);
  els.currentRewardName.textContent = currentReward ? getRewardLabel(currentReward) : "";
  els.currentRewardLevelLabel.textContent = currentReward
    ? (isCompactLevelView
      ? `${mobileLevelLabel}: ${status.currentIndex}`
      : `${currentLevelLabel}: ${status.currentIndex} (${formatNumber(currentReward.minPoints)} ${pointsLabel})`)
    : currentLevelLabel;

  els.nextRewardImage.src = getRewardImage(nextReward);
  els.nextRewardImage.alt = getRewardLabel(nextReward);
  els.nextRewardName.textContent = nextReward ? getRewardLabel(nextReward) : "";
  els.nextRewardLevelLabel.textContent = nextReward
    ? (isCompactLevelView
      ? `${mobileLevelLabel}: ${nextIndex}`
      : `${nextLevelLabel}: ${nextIndex} (${formatNumber(nextReward.minPoints)} ${pointsLabel})`)
    : nextLevelLabel;

  if (els.currentRewardCard) {
    els.currentRewardCard.style.display = currentReward ? "" : "none";
    applyRewardDetailTrigger(els.currentRewardCard, currentReward);
  }

  if (els.nextRewardCard) {
    els.nextRewardCard.style.display = nextReward ? "" : "none";
    applyRewardDetailTrigger(els.nextRewardCard, nextReward);
  }

  if (els.rewardCardsStack) {
    const visibleCards = [els.currentRewardCard, els.nextRewardCard]
      .filter((card) => card && card.style.display !== "none").length;
    els.rewardCardsStack.classList.toggle("single-card", visibleCards === 1);
  }
}

function updateLivePanels(typeModel, optionId = null) {
  if (!typeModel) return;
  if (optionId !== null) {
    updateOptionRow(typeModel, optionId);
  } else {
    typeModel.options.forEach((option) => updateOptionRow(typeModel, option.id));
  }
  renderRewardPanel(typeModel);
  initTooltips(els.donationRows);
  syncMobileDonationPanelHeight();
}

function render() {
  const setModel = getCurrentSetModel();
  const typeModel = getCurrentTypeModel();
  if (!setModel || !typeModel) return;
  ensureSetProgress(setModel.id, setModel.types.map((type) => type.id));
  renderSetSelect();
  renderTypeSelect(setModel);
  renderDonationRows(typeModel);
  updateLivePanels(typeModel);
  syncMobileDonationPanelHeight();
}

function bindEvents() {
  els.setSelect.addEventListener("change", (event) => {
    if (!applySetSelection(event.target.value)) return;
    saveState();
    render();
  });

  els.typeSelect.addEventListener("change", (event) => {
    state.selectedTypeId = String(event.target.value || "");
    saveState();
    render();
  });

  els.donationRows.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const typeModel = getCurrentTypeModel();
    const optionId = button.dataset.optionId;
    if (button.dataset.action === "decrease") adjustAmount(typeModel, optionId, -1);
    if (button.dataset.action === "increase") adjustAmount(typeModel, optionId, 1);
    if (button.dataset.action === "max") setMaxAmount(typeModel, optionId);
  });

  els.donationRows.addEventListener("input", (event) => {
    const input = event.target.closest("[data-action]");
    if (!input) return;
    if (input.dataset.action !== "slider" && input.dataset.action !== "amount-input") return;
    const rawValue = input.dataset.action === "amount-input" ? parseAmountInput(input.value) : input.value;
    updateAmount(getCurrentTypeModel(), input.dataset.optionId, rawValue);
  });

  els.donationRows.addEventListener("change", (event) => {
    const input = event.target.closest('[data-action="amount-input"]');
    if (!input) return;
    const typeModel = getCurrentTypeModel();
    updateAmount(typeModel, input.dataset.optionId, parseAmountInput(input.value));
    updateOptionRow(typeModel, input.dataset.optionId);
  });

  els.rewardCardsStack.addEventListener("keydown", (event) => {
    const card = event.target.closest("[data-reward-detail]");
    if (!card) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    card.click();
  });

  els.resetSlidersBtn.addEventListener("click", resetCurrentTypeStaged);
  els.resetStagedBtn.addEventListener("click", resetCurrentTypeProgress);
  els.donateBtn.addEventListener("click", commitStaged);
  els.rewardListBtn?.addEventListener("click", () => {
    renderRewardListModal();
    rewardListModal?.open();
  });
  window.addEventListener("resize", () => {
    render();
    syncMobileDonationPanelHeight();
  });

  window.addEventListener("hashchange", () => {
    const hashSetId = getSetIdFromHash();
    if (!hashSetId || String(hashSetId) === String(state.selectedSetId)) return;
    if (!applySetSelection(hashSetId, { updateHash: false })) return;
    saveState();
    render();
  });
}

function buildDonationModel(data, lang, imageMaps) {
  const effectCtx = buildEffectContext(data, lang);
  const currenciesById = buildLookup(data.currencies || [], "currencyID");
  const rewardsById = buildLookup(data.rewards || [], "rewardID");
  const decorationsById = buildLookup(extractDecorations(data.buildings || []), "wodID");
  const constructionById = buildLookup(getArray(data, ["constructionItems"]), "constructionItemID");
  const equipmentById = buildLookup(getArray(data, ["equipments"]), "equipmentID");
  const gemsById = buildLookup(getArray(data, ["gems"]), "gemID");
  const unitsById = buildLookup(getArray(data, ["units"]), "wodID");
  const lootBoxesById = buildLookup(getArray(data, ["lootBoxes", "lootboxes"]), "lootBoxID");
  const allianceCoatLayoutsById = buildLookup(getArray(data, ["allianceCoatLayouts"]), "allianceCoatLayoutID");

  rewardResolver = createRewardResolver(() => ({
    lang,
    currenciesById,
    decorationsById,
    constructionById,
    equipmentById,
    gemsById,
    unitsById,
    lootBoxesById,
    allianceCoatLayoutsById,
    currencyImageUrlMap: imageMaps.currencies || {},
    decorationImageUrlMap: imageMaps.decorations || {},
    constructionImageUrlMap: imageMaps.constructions || {},
    equipmentImageUrlMap: imageMaps.looks || {},
    equipmentUniqueImageUrlMap: imageMaps.equipmentUniques || {},
    uniqueGemImageUrlMap: imageMaps.uniqueGems || {},
    unitImageUrlMap: imageMaps.units || {},
    lootBoxImageUrlMap: imageMaps.lootboxes || {},
    allianceLayoutImageUrlMap: imageMaps.allianceLayouts || {}
  }));

  rewardDetailContext = {
    lang,
    rewardResolver,
    currenciesById,
    decorationsById,
    buildingsById: decorationsById,
    buildings: getArray(data, ["buildings"]),
    allBuildings: getArray(data, ["buildings"]),
    constructionById,
    equipmentById,
    gemsById,
    unitsById,
    lootBoxesById,
    rewardsById,
    lootBoxTombolas: getArray(data, ["lootBoxTombolas", "lootboxtombolas"]),
    effectsById: effectCtx.effectDefinitions || {},
    effectCapsMap: effectCtx.effectCapsMap || {},
    percentEffectIDs: effectCtx.percentEffectIDs || new Set(),
    equipmentEffects: getArray(data, ["equipment_effects", "equipmentEffects"]),
    equipmentSlotsById: buildLookup(getArray(data, ["equipment_slots", "equipmentSlots"]), "slotID"),
    currentLanguage,
    currencyImageUrlMap: imageMaps.currencies || {},
    decorationImageUrlMap: imageMaps.decorations || {},
    constructionImageUrlMap: imageMaps.constructions || {},
    equipmentImageUrlMap: imageMaps.looks || {},
    equipmentUniqueImageUrlMap: imageMaps.equipmentUniques || {},
    uniqueGemImageUrlMap: imageMaps.uniqueGems || {},
    unitImageUrlMap: imageMaps.units || {},
    lootBoxImageUrlMap: imageMaps.lootboxes || {}
  };

  const itemsBySetAndType = {};
  const rewardsBySetAndType = {};

  (data.donationItems || []).forEach((item) => {
    const setId = String(item.donationItemSetID || "");
    const typeId = String(item.donationTypeID || "");
    if (!setId || !typeId) return;
    itemsBySetAndType[setId] ??= {};
    itemsBySetAndType[setId][typeId] ??= [];
    itemsBySetAndType[setId][typeId].push(item);
  });

  (data.donationRewards || []).forEach((reward) => {
    const setId = String(reward.rewardSetID || "");
    const typeId = String(reward.donationTypeID || "");
    if (!setId || !typeId) return;
    rewardsBySetAndType[setId] ??= {};
    rewardsBySetAndType[setId][typeId] ??= [];
    rewardsBySetAndType[setId][typeId].push(reward);
  });

  const sets = (data.donationSettings || []).map((setting) => {
    const itemSetId = String(setting.donationItemSetID || "");
    const rewardSetId = String(setting.rewardSetID || "");

    const types = (data.donationTypes || []).map((type) => {
      const typeId = String(type.donationTypeID || "");
      const items = (itemsBySetAndType[itemSetId]?.[typeId] || [])
        .slice()
        .sort((a, b) => Number(a.donationItemID) - Number(b.donationItemID));
      const rewards = (rewardsBySetAndType[rewardSetId]?.[typeId] || [])
        .slice()
        .sort((a, b) => Number(a.minPoints) - Number(b.minPoints));
      if (!items.length || !rewards.length) return null;

      const options = items.map((item) => {
        const currency = currenciesById[String(item.currencyID)] || null;
        const ratio = Math.max(1, Number(item.ratio) || 1);
        const maxPointLimit = item.maxPointLimit == null || item.maxPointLimit === "" ? null : Math.max(0, Number(item.maxPointLimit) || 0);
        const currencyName = currency?.Name || currency?.name || `Currency ${item.currencyID}`;

        return {
          id: String(item.donationItemID),
          ratio,
          maxPointLimit,
          maxAmount: maxPointLimit === null ? null : maxPointLimit * ratio,
          label: lang[`currency_name_${currencyName}`.toLowerCase()] || titleCase(currencyName),
          imageUrl: rewardResolver.getCurrencyImageUrl({
            type: "currency",
            addKeyName: currencyName
          })
        };
      });

      const resolvedRewards = rewards.map((reward) => {
        const rewardData = rewardsById[String(reward.rewardID)] || {};
        return {
          id: String(reward.donationRewardID),
          minPoints: Math.max(0, Number(reward.minPoints) || 0),
          commentLabel: [rewardData.comment1, rewardData.comment2].filter(Boolean).join(" "),
          entries: rewardResolver.resolveRewardEntries(rewardData)
        };
      });

      return {
        id: typeId,
        label: resolveDonationTypeLabel(type, lang),
        options,
        optionsById: Object.fromEntries(options.map((option) => [option.id, option])),
        rewards: resolvedRewards
      };
    }).filter(Boolean);

    return {
      id: rewardSetId,
      types,
      typesById: Object.fromEntries(types.map((type) => [type.id, type]))
    };
  }).filter((setModel) => setModel.types.length > 0)
    .sort((a, b) => Number(a.id) - Number(b.id));

  const latestSetId = sets[sets.length - 1]?.id || "";
  sets.forEach((setModel) => {
    setModel.label = setModel.id === latestSetId
      ? ui("latest_version", "Latest version")
      : `${ui("version", "Version")} ${setModel.id}`;
  });

  return {
    sets,
    setsById: Object.fromEntries(sets.map((setModel) => [setModel.id, setModel]))
  };
}

async function init() {
  rewardListModal = initCustomModal({ modalId: "rewardListModal" });
  initRewardDetailModal({
    getContext: () => rewardDetailContext || {}
  });
  readSavedState();

  try {
    await loadOwnLang();
    await showInitialGameChoiceIfNeeded();
    const [itemVersion, langVersion] = await Promise.all([getItemVersion(), getLangVersion()]);
    await logResolvedDataUrls({
      langCode: currentLanguage,
      itemVersion,
      langVersion
    });

    const [items, langRaw] = await Promise.all([loadItems(itemVersion), loadLanguage(currentLanguage, langVersion)]);
    lang = lowercaseKeysRecursive(langRaw);

    const imageMaps = await loadImageMaps({
      decorations: true,
      constructions: true,
      units: true,
      currencies: true,
      looks: true,
      equipmentUniques: true,
      uniqueGems: true,
      lootboxes: true,
      allianceLayouts: true,
      normalizeNameFn: normalizeName
    });

    simulatorModel = buildDonationModel(items, lang, imageMaps);

    if (!simulatorModel.sets.length) {
      throw new Error("Imperial Patronage data is missing.");
    }

    const latestSet = simulatorModel.sets[simulatorModel.sets.length - 1];
    const hashSetId = getSetIdFromHash();
    applySetSelection(hashSetId || latestSet.id, { updateHash: false });
    const currentSet = getCurrentSetModel();
    ensureSetProgress(currentSet.id, currentSet.types.map((type) => type.id));
    state.selectedTypeId = currentSet.typesById[String(state.selectedTypeId)] ? state.selectedTypeId : currentSet.types[0].id;

    bindEvents();
    applyLanguage();
    initLanguageSelector({
      currentLanguage,
      lang,
      onSelect: (code) => {
        currentLanguage = code;
        window.location.reload();
      }
    });
    render();
    updateHashForSet(currentSet.id);

    els.content.style.display = "";
    saveState();
    syncMobileDonationPanelHeight();
  } catch (error) {
    console.error("Imperial Patronage simulator init failed:", error);
    if (els.content) {
      els.content.innerHTML = "";
      els.content.style.display = "";
      loader.error("Something went wrong...", 30);
    }
  }
}

function applyLanguage() {
  const pageTitle = document.querySelector(".page-title h1");
  if (pageTitle) pageTitle.textContent = ui("page_title", "IMPERIAL PATRONAGE SIMULATOR");
  const donationTitle = document.getElementById("donationPanelTitle");
  if (donationTitle) donationTitle.textContent = ui("donation_options", "Donation Options");
  const rewardTitle = document.getElementById("rewardPanelTitle");
  if (rewardTitle) rewardTitle.textContent = ui("reward_track", "Reward Track");
  const nextPointsTitle = document.querySelector(".reward-points-box .reward-points-title");
  if (nextPointsTitle) {
    nextPointsTitle.textContent = lang?.dialog_maindonationevent_nextlevelpoints || ui("points_for_next_level", "Points for next level:");
  }
  const currentPointsTitle = document.querySelector(".reward-progress-box .reward-points-title");
  if (currentPointsTitle) {
    const pointsLabel = lang?.points_novalue || lang?.points_noValue || ui("current_points", "Points");
    currentPointsTitle.textContent = `${String(pointsLabel).replace(/[:\s]+$/, "")}:`;
  }
  if (els.resetSlidersBtn) els.resetSlidersBtn.textContent = ui("reset_sliders", "Reset Sliders");
  if (els.resetStagedBtn) els.resetStagedBtn.textContent = ui("reset_all", "Reset All");
  if (els.donateBtn) els.donateBtn.textContent = lang?.dialog_alliance_donate || ui("donate", "Donate");
  if (els.rewardListBtn) {
    const rewardListLabel = ui("patronage_reward_list", ui("reward_list", "Reward list"));
    els.rewardListBtn.setAttribute("aria-label", rewardListLabel);
    els.rewardListBtn.setAttribute("title", rewardListLabel);
  }
  const rewardListTitle = document.getElementById("rewardListModalTitle");
  if (rewardListTitle) rewardListTitle.textContent = ui("patronage_reward_list", "Patronage Reward List");
}

init();
