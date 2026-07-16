export const HOME_SETTINGS_KEY = "gf_home_settings";
const DEFAULT_GAME_SOURCE = "empire";
const VALID_GAME_SOURCES = new Set(["empire", "e4k"]);

export function getStorageKey(name) {
    return `gf_${name}`;
}

export const saveCalculatorData = (name, data) => saveData("calculator", name, data);
export const loadCalculatorData = (name) => loadData("calculator", name);

export const saveOverviewData = (name, data) => saveData("overview", name, data);
export const loadOverviewData = (name) => loadData("overview", name);

export const saveSimulatorData = (name, data) => saveData("simulator", name, data);
export const loadSimulatorData = (name) => loadData("simulator", name);

function saveData(type, name, data) {
    localStorage.setItem(getStorageKey(`${type}_${name}`), JSON.stringify(data));
}

function loadData(type, name) {
    try {
        const raw = localStorage.getItem(getStorageKey(`${type}_${name}`));
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

export function getDefaultGameSource() {
  return DEFAULT_GAME_SOURCE;
}

export function getSelectedGameSource() {
  try {
    const raw = localStorage.getItem(HOME_SETTINGS_KEY);
    const parsed = JSON.parse(raw || "{}");
    const value = String(parsed?.selectedGame || DEFAULT_GAME_SOURCE).toLowerCase();
    return VALID_GAME_SOURCES.has(value) ? value : DEFAULT_GAME_SOURCE;
  } catch {
    return DEFAULT_GAME_SOURCE;
  }
}

export function setSelectedGameSource(source) {
  const value = String(source || "").toLowerCase();
  if (!VALID_GAME_SOURCES.has(value)) return getSelectedGameSource();
  try {
    const raw = localStorage.getItem(HOME_SETTINGS_KEY);
    const parsed = JSON.parse(raw || "{}");
    localStorage.setItem(HOME_SETTINGS_KEY, JSON.stringify({
      ...parsed,
      selectedGame: value
    }));
  } catch {
    localStorage.setItem(HOME_SETTINGS_KEY, JSON.stringify({ selectedGame: value }));
  }
  return value;
}

export function isE4kSelected() {
  return getSelectedGameSource() === "e4k";
}
