export let unitStats = [];
export let units = [];
export let defense_units = [];
export let tools = [];
export let defense_tools = [];
export let supportTools = [];

export let toolEffects = {};
export let supportToolEffects = {};
export let toolEffectsDefense = {};

export let unitImages = {};
export let toolImages = {};
export let supportToolImages = {};
export let unitImagesDefense = {};
export let toolImagesDefense = {};
export let unitLevels = {};

export let waves = { left: [], front: [], right: [] };
export let totalUnits = { left: [], front: [], right: [], cy: [] };
export let totalTools = { left: [], front: [], right: [], Support: [] };
export let openWaves = {};

export let currentSide = 'front';
export let currentSideReport = 'front';
export let currentSideDefense = 'front';

export let commanderStats = {
  melee: 0,
  ranged: 0,
  universal: 0,
  courtyard: 0,
  wallReduction: 0,
  moatReduction: 0,
  gateReduction: 0,
  meadStrength: 0,
  horrorStrength: 0,
  holMelee: 0,
  holRanged: 0,
  holUniversal: 0,
  frontStrength: 0,
  flanksStrength: 0
};

export let castellanStats = {
  melee: 0,
  ranged: 0,
  courtyard: 0,
  wallUnitLimit: 100,
  cyUnitLimit: 100,
  wallProtection: 0,
  moatProtection: 0,
  gateProtection: 0,
};

export let attackGeneralAbilities = {
  waveStrengthBonus: false,
  periodicDebuff: false,
  conditionalMeleeBoost: false,
  courtyardStealBonus: false,
  courtyardLossBonus: false,
  oddEvenStrengthSwing: false,
  everySecondWaveStrength: false
};

export let defenseGeneralAbilities = {
  waveStrengthBonus: false,
  periodicDebuff: false,
  conditionalMeleeBoost: false,
  courtyardStealBonus: false,
  courtyardLossBonus: false,
  everySecondWaveStrength: false
};

export let attackBasics = {
  maxWaves: 4,
  maxUnitsCY: 2089,
  maxUnits: { front: 192, left: 64, right: 64 },
  maxTools: { front: 50, left: 40, right: 40 }
};

export const BASE_WAVE_MIN = 4;
export const BASE_WAVE_MAX = 25;
export const ADDITIONAL_WAVE_MAX = 3;

function sumSelectedEffects(selectedTools, effectsByType) {
  const totals = {};
  (selectedTools || []).forEach(tool => {
    if (!tool || tool.count <= 0) return;
    const effectData = effectsByType?.[tool.type];
    [effectData?.effect1, effectData?.effect2].forEach(effect => {
      if (!effect?.name) return;
      totals[effect.name] = (totals[effect.name] || 0) + effect.value * tool.count;
    });
  });
  return totals;
}

export function getSupportEffectTotals() {
  return sumSelectedEffects(waves.Support?.[0]?.tools, supportToolEffects);
}

export function getDefenseCourtyardEffectTotals() {
  const selectedTools = (defenseSlots.cy?.cyTools || []).map(tool => ({
    ...tool,
    type: tool?.type?.replace('DefenseTool', '')
  }));
  return sumSelectedEffects(selectedTools, toolEffectsDefense);
}

export function getAdditionalWaveCount() {
  const value = Math.floor(Number(getSupportEffectTotals().AdditionalWave) || 0);
  return Math.min(ADDITIONAL_WAVE_MAX, Math.max(0, value));
}

export function getBaseWaveCount() {
  const value = Math.floor(Number(attackBasics.maxWaves) || BASE_WAVE_MIN);
  return Math.min(BASE_WAVE_MAX, Math.max(BASE_WAVE_MIN, value));
}

export function getEffectiveWaveCount() {
  return getBaseWaveCount() + getAdditionalWaveCount();
}

export function getEffectiveWallUnitLimit() {
  const baseLimit = Math.max(0, Number(castellanStats.wallUnitLimit) || 0);
  const bonusPercent = Number(getDefenseCourtyardEffectTotals().WallLimit) || 0;
  return Math.floor(baseLimit * (1 + bonusPercent / 100));
}

export function enforceDefenseWallUnitLimit() {
  const entries = [];
  ['left', 'front', 'right'].forEach(side => {
    (defenseSlots[side]?.units || []).forEach(slot => {
      if (slot && slot.count > 0) entries.push(slot);
    });
  });

  const total = entries.reduce((sum, slot) => sum + slot.count, 0);
  const limit = getEffectiveWallUnitLimit();
  if (total <= limit) return 0;

  const scaled = entries.map((slot, index) => {
    const exact = slot.count * limit / total;
    return { slot, index, count: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let remaining = limit - scaled.reduce((sum, item) => sum + item.count, 0);

  [...scaled]
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .forEach(item => {
      if (remaining <= 0) return;
      item.count += 1;
      remaining -= 1;
    });

  scaled.forEach(({ slot, count }) => {
    slot.count = count;
    if (count === 0) slot.type = '';
  });

  return total - limit;
}

export const defenseSides = {
  front: { name: "Front", tools: { wall: 4, gate: 2, moat: 1 } },
  left: { name: "Left flank", tools: { wall: 5, moat: 1 } },
  right: { name: "Right flank", tools: { wall: 5, moat: 1 } },
  cy: { name: "Courtyard", tools: { courtyard: 3 } }
};

export const toolSlotRestrictions = {
  wall: ['tool1', 'tool2', 'tool3', 'tool8', 'tool10'],
  gate: ['tool4', 'tool6'],
  moat: ['tool5', 'tool7', 'tool9'],
  cy: ['tool11', 'tool12', 'tool13', 'tool14', 'tool15']
};

export let currentTotalUnits = { left: 0, front: 0, right: 0, cy: 0 };

export let defenseSlots = {
  front: { units: [], wallTools: [], gateTools: [], moatTools: [] },
  left: { units: [], wallTools: [], gateTools: [], moatTools: [] },
  right: { units: [], wallTools: [], gateTools: [], moatTools: [] },
  cy: { units: [], cyTools: [] }
};

export let copiedUnits = null;
export let copiedTools = null;

export let presets = {
  1: null, 2: null, 3: null, 4: null,
  5: null, 6: null, 7: null, 8: null
};

export let selectedPreset = null;
export let currentWaveIndex = 1;
export let notificationTimeout = null;

export let openAllWavesState = false;

export function setOpenAllWavesState(state) {
  openAllWavesState = state;
}

export function setCurrentSide(side) {
  currentSide = side;
}

export function setCurrentSideDefense(side) {
  currentSideDefense = side;
}

export function setCurrentSideReport(side) {
  currentSideReport = side;
}

export function setOpenWave(index, isOpen) {
  openWaves[index] = isOpen;
}

export function setUnitStats(newStats) {
  unitStats.length = 0;
  unitStats.push(...newStats);
}

export function setCurrentWaveIndex(index) {
  currentWaveIndex = index;
}

export function setSelectedPreset(preset) {
  selectedPreset = preset;
}

export function setPresets(newPresets) {
  presets = newPresets;
}

export function setNotificationTimeout(timeout) {
  notificationTimeout = timeout;
}
