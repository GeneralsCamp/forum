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

export let waves = { left: [], front: [], right: [] };
export let totalUnits = { left: [], front: [], right: [], cy: [] };
export let totalTools = { left: [], front: [], right: [], Support: [] };
export let openWaves = {};

export let currentSide = 'front';

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
  melee: 100,
  ranged: 100,
  courtyard: 0,
  wallUnitLimit: 100,
  cyUnitLimit: 100,
  wallProtection: 0,
  moatProtection: 0,
  gateProtection: 0
};

export let attackBasics = {
  maxWaves: 4,
  maxUnitsCY: 2089,
  maxUnits: { front: 192, left: 64, right: 64 },
  maxTools: { front: 50, left: 40, right: 40 },
  meadRangeLevel: 10,
  meadMeleeLevel: 10,
  beefRangeLevel: 10,
  beefMeleeLevel: 10,
  beefVeteranRangeLevel: 10,
  beefVeteranMeleeLevel: 10
};

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

export let currentSideReport = 'front';

export let openAllWavesState = false;

export function setOpenAllWavesState(state) {
  openAllWavesState = state;
}

export function setCurrentSide(side) {
  currentSide = side;
}

export function setOpenWave(index, isOpen) {
  openWaves[index] = isOpen;
}

export function setUnitStats(newStats) {
  unitStats.length = 0;
  unitStats.push(...newStats);
}