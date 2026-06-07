import { DATA_BASE_URL, DATA_URLS } from "./DataService.mjs";
import { fetchFreshWithFallback } from "./Fetcher.mjs";

function normalizeSource(source) {
  const value = String(source || "empire").toLowerCase();
  if (value === "em") return "empire";
  return value === "e4k" ? "e4k" : "empire";
}

function getHistoryKey(source) {
  return normalizeSource(source) === "e4k" ? "e4kItems" : "empireItems";
}

function getHistoryVersion(entry, source) {
  return normalizeSource(source) === "e4k"
    ? String(entry?.itemVersion || entry?.version || "")
    : String(entry?.version || entry?.itemVersion || "");
}

function versionParts(version) {
  return String(version || "")
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map(part => (/^\d+$/.test(part) ? Number(part) : part.toLowerCase()));
}

function compareSortParts(aParts, bParts) {
  const length = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < length; i++) {
    const a = aParts[i] ?? 0;
    const b = bParts[i] ?? 0;
    if (a === b) continue;
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b), undefined, { numeric: true });
  }
  return 0;
}

function compareVersions(a, b) {
  return compareSortParts(versionParts(a), versionParts(b));
}

function buildRawDataUrl(file) {
  const value = String(file || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;

  let path = value.replace(/\\/g, "/");
  if (path.startsWith("/data/")) {
    path = path.slice("/data".length);
  } else if (path === "/data") {
    path = "";
  }

  if (!path.startsWith("/")) path = `/${path}`;
  return `${DATA_BASE_URL}${path}`;
}

async function loadVersionHistory() {
  const res = await fetchFreshWithFallback(DATA_URLS.versionHistory, 15000);
  return res.json();
}

async function getPreviousItemFiles(source, currentVersion) {
  const normalizedSource = normalizeSource(source);
  const history = await loadVersionHistory();
  const entries = history?.[getHistoryKey(normalizedSource)];
  if (!Array.isArray(entries)) return [];

  return entries
    .map(entry => {
      const itemVersion = getHistoryVersion(entry, normalizedSource);
      const url = buildRawDataUrl(entry?.file);
      return itemVersion && url
        ? {
          itemVersion,
          file: entry.file,
          name: String(entry.file).split("/").filter(Boolean).pop() || itemVersion,
          url
        }
        : null;
    })
    .filter(file => file && compareVersions(file.itemVersion, currentVersion) < 0)
    .sort((a, b) => compareVersions(b.itemVersion, a.itemVersion));
}

function getItemIdSet(items, getId) {
  return new Set(
    items
      .map(item => String(getId(item) || ""))
      .filter(Boolean)
  );
}

function parsePreviousPayload(text, file, logLabel) {
  const trimmed = String(text || "").trim();
  if (!trimmed || trimmed === "{}" || trimmed === "[]") {
    throw new Error(
      `Previous ${logLabel} file is empty or placeholder content: ${file.name}, preview=${JSON.stringify(trimmed)}`
    );
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    const preview = trimmed.slice(0, 120);
    throw new Error(
      `Previous ${logLabel} JSON parse failed: ${file.name}, preview=${JSON.stringify(preview)}`,
      { cause: error }
    );
  }
}

export async function findNewItemIdsFromPreviousVersions({
  currentVersion,
  currentItems,
  extractItems,
  getId,
  source = "empire",
  logLabel = "item"
}) {
  const normalizedSource = normalizeSource(source);
  const currentRows = Array.isArray(currentItems) ? currentItems : [];

  try {
    const previousFiles = await getPreviousItemFiles(normalizedSource, currentVersion);

    if (!previousFiles.length) return new Set();

    const currentIds = getItemIdSet(currentRows, getId);
    let selectedNewIds = new Set();
    let selectedComparisonFile = null;
    let validComparisonCount = 0;
    let unavailableComparisonCount = 0;

    for (const file of previousFiles) {
      try {
        const res = await fetchFreshWithFallback(file.url, 120000);
        const text = await res.text();
        const previousPayload = parsePreviousPayload(text, file, logLabel);
        const previousItems = extractItems(previousPayload);
        if (!Array.isArray(previousItems)) {
          console.warn(`Previous ${logLabel} extraction did not return an array: ${file.name}`);
          continue;
        }

        if (currentRows.length > 0 && previousItems.length === 0) {
          console.warn(`Previous ${logLabel} extraction returned no comparable items: ${file.name}`);
          continue;
        }

        const previousIds = getItemIdSet(previousItems, getId);
        const newIds = new Set(
          [...currentIds].filter(id => !previousIds.has(id))
        );
        validComparisonCount++;

        if (newIds.size > 0) {
          selectedNewIds = newIds;
          selectedComparisonFile = file;
          break;
        }
      } catch (error) {
        unavailableComparisonCount++;
        console.warn(`Previous ${logLabel} data unavailable: ${file.name}`, error);
      }
    }

    if (validComparisonCount === 0) return null;
    if (selectedNewIds.size === 0 && unavailableComparisonCount > 0) return null;
    if (selectedComparisonFile) {
      console.log(
        `New ${logLabel} diff: compared current ${normalizedSource} ${currentVersion} with ${selectedComparisonFile.itemVersion} (${selectedComparisonFile.name})`
      );
    }
    return selectedNewIds.size > 0 ? selectedNewIds : new Set();
  } catch (error) {
    console.warn(`New ${logLabel} comparison unavailable.`, error);
    return null;
  }
}
