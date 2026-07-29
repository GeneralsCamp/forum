import {
  loadSimulatorData,
  saveSimulatorData
} from '../../../../overviews/shared/GameSettings.mjs';

const SIMULATOR_NAME = 'battle';

function getStore() {
  const stored = loadSimulatorData(SIMULATOR_NAME);
  return stored && typeof stored === 'object' && !Array.isArray(stored)
    ? stored
    : {};
}

export function readStoredJson(key, fallback = null) {
  const store = getStore();
  return key in store ? store[key] : fallback;
}

export function writeStoredJson(key, value) {
  const store = getStore();
  store[key] = value;
  saveSimulatorData(SIMULATOR_NAME, store);
}
