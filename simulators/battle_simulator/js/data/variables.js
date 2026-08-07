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
  beefStrength: 0,
  meadStrength: 0,
  horrorStrength: 0,
  holMelee: 0,
  holRanged: 0,
  holUniversal: 0,
  frontStrength: 0,
  flanksStrength: 0,
  finalAssaultRangedUnits: 0,
  finalAssaultShieldMaidens: 0
};

export let castellanStats = {
  melee: 0,
  ranged: 0,
  universal: 0,
  courtyard: 0,
  wallUnitLimit: 100,
  cyUnitLimit: 100,
  wallProtection: 0,
  moatProtection: 0,
  gateProtection: 0,
  frontStrength: 0,
  flanksStrength: 0,
  holMelee: 0,
  holRanged: 0,
  holUniversal: 0,
  courtyardValkyrieSupport: 0,
};

export let attackGeneralAbilities = {
  endlessPractice: false,
  lastingWounds: false,
  wayOfTheSword: false,
  riseToTheTask: false,
  giantSlayer: false,
  vengeance: false,
  calmBeforeTheStorm: false,
  aspectOfTheDragon: false,
  powerSurge: false,
  hordebreaker: false,
  ironWill: false,
  toolFoulUp: false,
  heartOfAWarrior: false,
  toweringShield: false,
  longbows: false,
  ayala: false,
  ambush: false,
  reinforcedArrows: false,
  yourCut: false,
  wayOfPerfection: false,
  tailwhip: false,
  dragonscaleArmor: false,
  wingsWhirlwind: false,
  exalted: false
};

export let defenseGeneralAbilities = {
  endlessPractice: false,
  lastingWounds: false,
  wayOfTheSword: false,
  riseToTheTask: false,
  giantSlayer: false,
  vengeance: false,
  aspectOfTheDragon: false,
  powerSurge: false,
  hordebreaker: false,
  ironWill: false,
  toolFoulUp: false,
  heartOfAWarrior: false,
  toweringShield: false,
  heroicDefense: false,
  longbows: false,
  ayala: false,
  ambush: false,
  reinforcedArrows: false,
  yourCut: false,
  wayOfPerfection: false,
  tailwhip: false,
  dragonscaleArmor: false,
  wingsWhirlwind: false,
  exalted: false
};

export let attackBasics = {
  maxWaves: 4,
  maxUnitsCY: 2089,
  maxUnits: { front: 192, left: 64, right: 64 },
  maxTools: { front: 50, left: 40, right: 40 }
};

export const BASE_WAVE_MIN = 4;
export const BASE_WAVE_MAX = 50;
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
  5: null, 6: null, 7: null, 8: null,
  9: null, 10: null, 11: null, 12: null,
  13: null, 14: null, 15: null, 16: null,
  17: null, 18: null, 19: null, 20: null
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
