import {
  openAllWavesState,
  openWaves,
  setOpenAllWavesState,
  getEffectiveWaveCount,
  totalUnits,
  totalTools,
  waves
} from './variables.js';
import { readStoredJson, writeStoredJson } from './storage.js';

const WALL_SIDES = ['left', 'front', 'right'];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function saveAttackState() {
  const state = {
    units: Object.fromEntries(
      WALL_SIDES.map(side => [side, clone(totalUnits[side] || [])])
    ),
    tools: Object.fromEntries(
      WALL_SIDES.map(side => [side, clone(totalTools[side] || [])])
    ),
    supportTools: clone(waves.Support?.[0]?.tools || totalTools.Support?.[0] || []),
    courtyardUnits: clone(waves.CY?.[0]?.slots || totalUnits.CY?.[0] || []),
    openWaves: clone(openWaves),
    openAllWaves: openAllWavesState
  };

  writeStoredJson('attackState', state);
}

export function loadAttackState() {
  const state = readStoredJson('attackState');
  if (!state) return;

  WALL_SIDES.forEach(side => {
    if (Array.isArray(state.units?.[side])) totalUnits[side] = clone(state.units[side]);
    if (Array.isArray(state.tools?.[side])) totalTools[side] = clone(state.tools[side]);
  });

  const waveCount = getEffectiveWaveCount();
  WALL_SIDES.forEach(side => {
    waves[side] = Array.from({ length: waveCount }, (_, waveIndex) => ({
      slots: clone(totalUnits[side]?.[waveIndex] || []),
      tools: clone(totalTools[side]?.[waveIndex] || [])
    }));
  });

  if (Array.isArray(state.supportTools)) {
    const supportTools = clone(state.supportTools);
    waves.Support = [{ tools: supportTools }];
    totalTools.Support = [supportTools];
  }

  if (Array.isArray(state.courtyardUnits)) {
    const courtyardUnits = clone(state.courtyardUnits);
    waves.CY = [{ slots: courtyardUnits }];
    totalUnits.CY = [courtyardUnits];
  }

  if (state.openWaves && typeof state.openWaves === 'object') {
    Object.keys(openWaves).forEach(key => delete openWaves[key]);
    Object.assign(openWaves, state.openWaves);
  }

  if (typeof state.openAllWaves === 'boolean') {
    setOpenAllWavesState(state.openAllWaves);
  }
}
