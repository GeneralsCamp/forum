export const HOME_SETTINGS_KEY = "gf_home_settings";
export const FAVORITES_KEY = "gf_favorites";
const DEFAULT_GAME_SOURCE = "empire";
const VALID_GAME_SOURCES = new Set(["empire", "e4k"]);

export function getStorageKey(name) {
    return `gf_${name}`;
}

export function saveCalculatorData(name, data) {
    localStorage.setItem(getStorageKey(`calc_${name}`), JSON.stringify(data));
}

export function loadCalculatorData(name) {
    try {
        const raw = localStorage.getItem(getStorageKey(`calc_${name}`));
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

export function isE4kSelected() {
  return getSelectedGameSource() === "e4k";
}
