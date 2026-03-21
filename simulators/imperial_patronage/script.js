import {
  getItemVersion,
  getLangVersion,
  loadItems,
  loadLanguage
} from "../../overviews/shared/DataService.mjs";
import { createLoader } from "../../overviews/shared/LoadingService.mjs";
import { loadImageMaps } from "../../overviews/shared/ImageService.mjs";
import { initAutoHeight } from "../../overviews/shared/ResizeService.mjs";
import { initLanguageSelector, getInitialLanguage } from "../../overviews/shared/LanguageService.mjs";
import {
  createRewardResolver,
  buildLookup,
  normalizeName
} from "../../overviews/shared/RewardResolver.mjs";

const STORAGE_KEY = "gf_imperial_patronage_simulator_v1";
const FALLBACK_IMAGE = "../../img_base/placeholder.webp";
const loader = createLoader();

initAutoHeight({
  contentSelector: "#content",
  subtractSelectors: [".page-title", ".patronage-toolbar"],
  extraOffset: 18
});

let simulatorModel = null;
let rewardResolver = null;
let ownLang = {};
let currentLanguage = getInitialLanguage();
let lang = {};

const state = {
  selectedSetId: "",
  selectedTypeId: "",
  progressBySet: {}
};

const els = {
  content: document.getElementById("content"),
  setSelect: document.getElementById("setSelect"),
  typeSelect: document.getElementById("typeSelect"),
  donationRows: document.getElementById("donationRows"),
  rewardMeterFill: document.getElementById("rewardMeterFill"),
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
  donateBtn: document.getElementById("donateBtn")
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
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.selectedSetId = String(parsed.selectedSetId || "");
    state.selectedTypeId = String(parsed.selectedTypeId || "");
    state.progressBySet = parsed.progressBySet && typeof parsed.progressBySet === "object"
      ? parsed.progressBySet
      : {};
  } catch {
    state.selectedSetId = "";
    state.selectedTypeId = "";
    state.progressBySet = {};
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  const nextReward = findNextRewardAfterPoints(typeModel, previewPoints);

  const currentIndex = currentReward ? typeModel.rewards.findIndex((reward) => reward.id === currentReward.id) + 1 : 0;
  const previewIndex = previewReward ? typeModel.rewards.findIndex((reward) => reward.id === previewReward.id) + 1 : 0;
  const nextIndex = nextReward ? typeModel.rewards.findIndex((reward) => reward.id === nextReward.id) + 1 : previewIndex;
  const previewBaseReward = previewReward || currentReward;
  const currentMin = Number(previewBaseReward?.minPoints) || 0;
  const nextMin = Number(nextReward?.minPoints) || currentMin;
  const progressSpan = Math.max(1, nextMin - currentMin);
  const progressInside = nextReward ? Math.min(progressSpan, Math.max(0, previewPoints - currentMin)) : progressSpan;

  return {
    committedPoints,
    previewPoints,
    currentReward,
    previewReward,
    nextReward,
    currentIndex,
    previewIndex,
    nextIndex,
    pointsToNext: nextReward ? Math.max(0, nextMin - previewPoints) : 0,
    percent: nextReward ? Math.round((progressInside / progressSpan) * 100) : 100,
    overcap: previewPoints > getHighestThreshold(typeModel)
      ? previewPoints - getHighestThreshold(typeModel)
      : 0
  };
}

function getRewardImage(reward) {
  if (!reward?.entries?.length) return FALLBACK_IMAGE;
  const primary = reward.entries[0];
  return (
    rewardResolver.getDecorationImageUrl(primary) ||
    rewardResolver.getCurrencyImageUrl(primary) ||
    rewardResolver.getLootBoxImageUrl(primary) ||
    FALLBACK_IMAGE
  );
}

function getRewardLabel(reward) {
  if (!reward) return "No reward yet";
  const main = reward.entries?.[0];
  if (!main) return reward.commentLabel || "Reward";
  return `${main.name}${main.amount > 1 ? ` x${formatNumber(main.amount)}` : ""}`;
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
            <div class="amount-display" data-role="amount-display">
              <span class="amount-display-current">${formatAmountDisplayValue(currentAmount)}</span>
            </div>
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
  const amountDisplayCurrent = row.querySelector('.amount-display-current');
  const usedCap = row.querySelector('[data-role="used-cap"]');
  const usedTotal = row.querySelector('[data-role="used-total"]');
  const slider = row.querySelector('.amount-slider');
  const decreaseBtn = row.querySelector('[data-action="decrease"]');
  const increaseBtn = row.querySelector('[data-action="increase"]');
  const maxBtn = row.querySelector('[data-action="max"]');

  if (amountDisplayCurrent) amountDisplayCurrent.textContent = formatAmountDisplayValue(currentAmount);
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
  if (slider) slider.disabled = capped;
  if (decreaseBtn) decreaseBtn.disabled = currentAmount <= 0;
}

function renderRewardPanel(typeModel) {
  const status = getRewardStatus(typeModel);
  const currentReward = status.currentReward;
  const currentLevelLabel = lang?.dialog_maindonationevent_reward_currentlevel || ui("current_level", "Current Level");
  const nextLevelLabel = lang?.dialog_maindonationevent_reward_nextlevel || ui("next_level", "Next Level");
  const pointsLabel = lang?.points_novalue || "Points";
  const isMobile = window.matchMedia("(max-width: 700px)").matches;
  const mobileLevelLabel = String(lang?.dialog_maindonationevent_reward_tier || "Level").replace("{0}", "").trim() || "Level";
  const previewReachedFinalReward = !status.nextReward
    && status.previewReward
    && status.previewReward.id !== currentReward?.id
    && status.previewPoints > status.committedPoints;
  const nextReward = status.nextReward || (previewReachedFinalReward ? status.previewReward : null);
  const nextIndex = status.nextReward ? status.nextIndex : (previewReachedFinalReward ? status.previewIndex : 0);
  const stagedPoints = Math.max(0, status.previewPoints - status.committedPoints);
  els.pointsToNextValue.textContent = formatNumber(status.pointsToNext);
  if (els.mobileCurrentPointsValue) {
    els.mobileCurrentPointsValue.innerHTML = stagedPoints > 0
      ? `${formatNumber(status.committedPoints)} <span class="reward-inline-note">(+${formatNumber(stagedPoints)})</span>`
      : formatNumber(status.committedPoints);
  }
  if (els.mobilePointsToNextValue) els.mobilePointsToNextValue.textContent = formatNumber(status.pointsToNext);
  els.rewardPreviewTotal.innerHTML = stagedPoints > 0
    ? `${formatNumber(status.committedPoints)} <span class="reward-inline-note">(+${formatNumber(stagedPoints)})</span>`
    : formatNumber(status.committedPoints);
  els.rewardWarning.textContent = "";

  if (window.matchMedia("(max-width: 991px)").matches) {
    els.rewardMeterFill.style.width = `${status.percent}%`;
    els.rewardMeterFill.style.height = "100%";
  } else {
    els.rewardMeterFill.style.height = `${status.percent}%`;
    els.rewardMeterFill.style.width = "100%";
  }

  els.currentRewardImage.src = getRewardImage(currentReward);
  els.currentRewardImage.alt = getRewardLabel(currentReward);
  els.currentRewardName.textContent = currentReward ? getRewardLabel(currentReward) : "";
  els.currentRewardLevelLabel.textContent = currentReward
    ? (isMobile
      ? `${mobileLevelLabel}: ${status.currentIndex}`
      : `${currentLevelLabel}: ${status.currentIndex} (${formatNumber(currentReward.minPoints)} ${pointsLabel})`)
    : currentLevelLabel;

  els.nextRewardImage.src = getRewardImage(nextReward);
  els.nextRewardImage.alt = getRewardLabel(nextReward);
  els.nextRewardName.textContent = nextReward ? getRewardLabel(nextReward) : "";
  els.nextRewardLevelLabel.textContent = nextReward
    ? (isMobile
      ? `${mobileLevelLabel}: ${nextIndex}`
      : `${nextLevelLabel}: ${nextIndex} (${formatNumber(nextReward.minPoints)} ${pointsLabel})`)
    : nextLevelLabel;

  if (els.currentRewardCard) {
    els.currentRewardCard.style.display = currentReward ? "" : "none";
  }

  if (els.nextRewardCard) {
    els.nextRewardCard.style.display = nextReward ? "" : "none";
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
}

function bindEvents() {
  els.setSelect.addEventListener("change", (event) => {
    const nextSet = simulatorModel.setsById[String(event.target.value)];
    if (!nextSet) return;
    state.selectedSetId = nextSet.id;
    state.selectedTypeId = nextSet.typesById[String(state.selectedTypeId)] ? state.selectedTypeId : nextSet.types[0].id;
    ensureSetProgress(nextSet.id, nextSet.types.map((type) => type.id));
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
    if (input.dataset.action !== "slider") return;
    updateAmount(getCurrentTypeModel(), input.dataset.optionId, input.value);
  });

  els.resetSlidersBtn.addEventListener("click", resetCurrentTypeStaged);
  els.resetStagedBtn.addEventListener("click", resetCurrentTypeProgress);
  els.donateBtn.addEventListener("click", commitStaged);
  window.addEventListener("resize", render);
}

function buildDonationModel(data, lang, imageMaps) {
  const currenciesById = buildLookup(data.currencies || [], "currencyID");
  const rewardsById = buildLookup(data.rewards || [], "rewardID");
  const decorationsById = buildLookup(extractDecorations(data.buildings || []), "wodID");

  rewardResolver = createRewardResolver(() => ({
    lang,
    currenciesById,
    decorationsById,
    currencyImageUrlMap: imageMaps.currencies || {},
    decorationImageUrlMap: imageMaps.decorations || {}
  }));

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
  const MIN_LOADING_MS = 900;
  const startedAt = Date.now();

  readSavedState();
  loader.set(1, 5, "Initializing...");

  try {
    const [itemVersion, langVersion] = await Promise.all([getItemVersion(), getLangVersion()]);
    await loadOwnLang();

    loader.set(2, 5, "Loading data...");
    const [items, langRaw] = await Promise.all([loadItems(itemVersion), loadLanguage(currentLanguage, langVersion)]);
    lang = lowercaseKeysRecursive(langRaw);

    loader.set(3, 5, "Loading images...");
    const imageMaps = await loadImageMaps({
      decorations: true,
      currencies: true,
      normalizeNameFn: normalizeName
    });

    loader.set(4, 5, "Preparing view...");
    simulatorModel = buildDonationModel(items, lang, imageMaps);

    if (!simulatorModel.sets.length) {
      throw new Error("Imperial Patronage data is missing.");
    }

    const latestSet = simulatorModel.sets[simulatorModel.sets.length - 1];
    state.selectedSetId = simulatorModel.setsById[String(state.selectedSetId)] ? state.selectedSetId : latestSet.id;
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

    loader.set(5, 5, "Finalizing...");
    const waitMs = Math.max(0, MIN_LOADING_MS - (Date.now() - startedAt));
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    els.content.style.display = "";
    saveState();
    loader.hide();
  } catch (error) {
    console.error("Imperial Patronage simulator init failed:", error);
    loader.error("Data load failed", 30);
  }
}

function applyLanguage() {
  document.title = `GGE ${ui("page_title", "Imperial Patronage Simulator")}`;
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
    currentPointsTitle.textContent = lang?.dialog_achv_totalprogress || ui("current_points", "Current points:");
  }
  if (els.resetSlidersBtn) els.resetSlidersBtn.textContent = ui("reset_sliders", "Reset Sliders");
  if (els.resetStagedBtn) els.resetStagedBtn.textContent = ui("reset_all", "Reset All");
  if (els.donateBtn) els.donateBtn.textContent = lang?.dialog_alliance_donate || ui("donate", "Donate");
}

init();
