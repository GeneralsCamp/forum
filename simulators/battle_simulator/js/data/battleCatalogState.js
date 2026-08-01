import { BATTLE_CATALOG_PRESETS, cloneBattleCatalog } from './catalog.js';
import { readStoredJson, writeStoredJson } from './storage.js';

const STORAGE_KEY = 'battleCustomCatalog';
let currentCatalog = null;

export function getBattleCatalog() {
  if (!currentCatalog) {
    currentCatalog = cloneBattleCatalog(readStoredJson(STORAGE_KEY) || BATTLE_CATALOG_PRESETS.default);
  }
  return currentCatalog;
}

export function saveBattleCatalog(catalog) {
  currentCatalog = cloneBattleCatalog(catalog);
  writeStoredJson(STORAGE_KEY, currentCatalog);
  return currentCatalog;
}

export function updateCatalogUnitLevels(groupKey, updates) {
  const catalog = getBattleCatalog();
  updates.forEach(({ index, level }) => {
    if (catalog[groupKey]?.[index]) catalog[groupKey][index].level = Number(level);
  });
  saveBattleCatalog(catalog);
}
