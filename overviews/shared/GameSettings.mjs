const HOME_SETTINGS_KEY = "gf_home_settings_v1";
const DEFAULT_GAME_SOURCE = "empire";
const VALID_GAME_SOURCES = new Set(["empire", "e4k"]);

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

