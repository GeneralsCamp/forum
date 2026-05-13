import { fetchFreshWithFallback } from "./Fetcher.mjs";
import { getSelectedGameSource } from "./GameSettings.mjs";
import {
    getCachedJson,
    setCachedJson,
    getCachedMeta,
    setCachedMeta
} from "./VersionedCache.mjs";

export const DATA_BASE_URL =
    "https://raw.githubusercontent.com/GeneralsCamp/ggempire-data-cache/main/public/data";

export const DATA_URLS = {
    manifest: `${DATA_BASE_URL}/manifest.json`,
    versionHistory: `${DATA_BASE_URL}/version-history.json`,
    empireItemVersion: `${DATA_BASE_URL}/empire/ItemsVersion.properties`,
    empireItems: `${DATA_BASE_URL}/empire/items_latest.json`,
    empireDllVersion: `${DATA_BASE_URL}/empire/dll/version.json`,
    empireDll: `${DATA_BASE_URL}/empire/dll/ggs.dll.latest.js`,
    e4kAppStore: `${DATA_BASE_URL}/e4k/appstore.json`,
    e4kVersions: `${DATA_BASE_URL}/e4k/versions.json`,
    e4kItems: `${DATA_BASE_URL}/e4k/items_latest.json`,
    langMetadata: `${DATA_BASE_URL}/lang/metadata.json`,
    lang: (langCode) => `${DATA_BASE_URL}/lang/${langCode}.json`
};

let manifestPromise = null;
let versionHistoryPromise = null;
let e4kRemoteInfoPromise = null;

export function getGameSource() {
    return getSelectedGameSource();
}

export async function getDataManifest() {
    if (!manifestPromise) {
        manifestPromise = loadJsonWithMetaFallback(
            DATA_URLS.manifest,
            "data-manifest",
            10000
        );
    }

    return manifestPromise;
}

export async function getVersionHistory() {
    if (!versionHistoryPromise) {
        versionHistoryPromise = loadJsonWithMetaFallback(
            DATA_URLS.versionHistory,
            "version-history",
            10000
        );
    }

    return versionHistoryPromise;
}

export async function getItemVersion() {
    if (getGameSource() === "e4k") {
        const info = await getE4kRemoteInfo();
        return info.itemVersion;
    }

    try {
        const manifest = await getDataManifest();
        const manifestVersion =
            pickString(manifest, [
                ["empire", "items", "version"],
                ["empire", "itemVersion"],
                ["empire", "CastleItemXMLVersion"],
                ["versions", "empireItems"],
                ["items", "empire", "version"]
            ]);

        if (manifestVersion) {
            setCachedMeta("item-version:empire", { version: manifestVersion });
            return manifestVersion;
        }
    } catch {}

    try {
        const res = await fetchFreshWithFallback(DATA_URLS.empireItemVersion);
        const text = await res.text();
        const match = text.match(/CastleItemXMLVersion=(\d+(?:\.\d+)+)/);
        if (!match) throw new Error("Version not found");

        const version = match[1];
        setCachedMeta("item-version:empire", { version });
        return version;
    } catch (error) {
        const fallback = getCachedMeta("item-version:empire")?.version;
        if (fallback) {
            console.warn(`Item version fallback to cached value: ${fallback}`);
            return fallback;
        }
        throw error;
    }
}

export async function getLangVersion() {
    try {
        const manifest = await getDataManifest();
        const manifestVersion =
            pickString(manifest, [
                ["lang", "version"],
                ["language", "version"],
                ["versions", "lang"],
                ["versions", "language"]
            ]);

        if (manifestVersion) {
            setCachedMeta("lang-version", { version: manifestVersion });
            return manifestVersion;
        }
    } catch {}

    try {
        const res = await fetchFreshWithFallback(DATA_URLS.langMetadata);
        const json = await res.json();
        const version =
            pickString(json, [
                ["@metadata", "versionNo"],
                ["metadata", "versionNo"],
                ["versionNo"],
                ["version"]
            ]);

        if (!version) {
            throw new Error("Language version not found.");
        }

        setCachedMeta("lang-version", { version });
        return version;
    } catch (error) {
        const fallback = getCachedMeta("lang-version")?.version;
        if (fallback) {
            console.warn(`Language version fallback to cached value: ${fallback}`);
            return fallback;
        }
        throw error;
    }
}

export async function loadLanguage(langCode, version) {
    const resolvedVersion = String(version || await getLangVersion());
    const cacheKey = `lang:${getGameSource()}:${langCode}:${resolvedVersion}`;
    const cached = await getCachedJson(cacheKey);
    if (cached) return cached;

    const res = await fetchFreshWithFallback(DATA_URLS.lang(langCode), 30000);
    const json = await res.json();
    await setCachedJson(cacheKey, json);
    return json;
}

export async function loadItems(version) {
    const source = getGameSource();
    const resolvedVersion = String(
        version || (source === "e4k"
            ? (await getE4kRemoteInfo()).itemVersion
            : await getItemVersion())
    );
    const cacheKey = `items:${source}:${resolvedVersion}`;
    const cached = await getCachedJson(cacheKey);
    if (cached) {
        const normalizedCached = normalizeItemsPayload(cached);
        if (normalizedCached !== cached) {
            await setCachedJson(cacheKey, normalizedCached);
        }
        return normalizedCached;
    }

    const url = source === "e4k"
        ? DATA_URLS.e4kItems
        : DATA_URLS.empireItems;
    const res = await fetchFreshWithFallback(url, 60000);
    const json = normalizeItemsPayload(await res.json());
    await setCachedJson(cacheKey, json);
    return json;
}

export async function getCurrentVersionInfo() {
    const version = await getItemVersion();
    const json = await loadItems(version);

    return {
        version,
        date: json.versionInfo?.date?.["@value"] ?? "unknown",
        source: getGameSource()
    };
}

export async function loadCoreData(langCode = "en") {
    const itemVersion = await getItemVersion();
    const langVersion = await getLangVersion();

    const [lang, items] = await Promise.all([
        loadLanguage(langCode, langVersion),
        loadItems(itemVersion)
    ]);

    return {
        itemVersion,
        langVersion,
        lang,
        items,
        source: getGameSource()
    };
}

export async function getResolvedUrls({ langCode = "en", itemVersion, langVersion } = {}) {
    const source = getGameSource();
    const resolvedItemVersion = itemVersion || await getItemVersion();
    const resolvedLangVersion = langVersion || await getLangVersion();

    if (source === "e4k") {
        const info = await getE4kRemoteInfo();
        return {
            source,
            appStoreUrl: DATA_URLS.e4kAppStore,
            appVersion: info.appVersion,
            itemVersion: resolvedItemVersion,
            langVersion: resolvedLangVersion,
            versionsUrl: DATA_URLS.e4kVersions,
            itemsUrl: DATA_URLS.e4kItems,
            languageVersionUrl: DATA_URLS.langMetadata,
            languageUrl: DATA_URLS.lang(langCode)
        };
    }

    return {
        source,
        itemVersion: resolvedItemVersion,
        langVersion: resolvedLangVersion,
        itemVersionUrl: DATA_URLS.empireItemVersion,
        itemsUrl: DATA_URLS.empireItems,
        languageVersionUrl: DATA_URLS.langMetadata,
        languageUrl: DATA_URLS.lang(langCode)
    };
}

export async function getVersionedResourceState({ langCode = "en", itemVersion, langVersion } = {}) {
    const source = getGameSource();
    const resolvedItemVersion = itemVersion || await getItemVersion();
    const resolvedLangVersion = langVersion || await getLangVersion();

    const [cachedItems, cachedLang] = await Promise.all([
        getCachedJson(`items:${source}:${resolvedItemVersion}`),
        getCachedJson(`lang:${source}:${langCode}:${resolvedLangVersion}`)
    ]);

    return {
        itemCacheState: cachedItems ? "cached" : "network",
        langCacheState: cachedLang ? "cached" : "network"
    };
}

export async function logResolvedDataUrls({ langCode = "en", itemVersion, langVersion } = {}) {
    const gameSource = getGameSource();
    const shortGameSource = gameSource === "empire" ? "em" : gameSource;
    const resolvedUrls = await getResolvedUrls({ langCode, itemVersion, langVersion });
    const cacheState = await getVersionedResourceState({ langCode, itemVersion, langVersion });

    console.log(`Game source: ${shortGameSource}`);
    console.log("");
    console.log(`Item version: ${resolvedUrls.itemVersion} (${cacheState.itemCacheState})`);
    console.log(`Item URL: ${resolvedUrls.itemsUrl}`);
    console.log("");
    console.log(`Language version: ${resolvedUrls.langVersion} (${cacheState.langCacheState})`);
    console.log(`Language URL: ${resolvedUrls.languageUrl}`);
    console.log("");

    return resolvedUrls;
}

async function getE4kRemoteInfo() {
    if (!e4kRemoteInfoPromise) {
        e4kRemoteInfoPromise = (async () => {
            const manifest = await getDataManifest().catch(() => null);
            const appStore = await loadJsonWithMetaFallback(
                DATA_URLS.e4kAppStore,
                "e4k-appstore",
                10000
            ).catch(() => null);
            const versions = await loadJsonWithMetaFallback(
                DATA_URLS.e4kVersions,
                "e4k-versions",
                10000
            );

            const appVersion =
                pickString(manifest, [
                    ["e4k", "appVersion"],
                    ["e4k", "loaderVersion"],
                    ["versions", "e4kApp"]
                ]) ||
                pickString(appStore, [
                    ["version"],
                    ["appVersion"],
                    ["loaderVersion"],
                    ["results", 0, "version"]
                ]) ||
                "unknown";

            const itemVersion =
                pickString(manifest, [
                    ["e4k", "items", "version"],
                    ["e4k", "itemVersion"],
                    ["e4k", "CastleItemXMLVersion"],
                    ["versions", "e4kItems"],
                    ["items", "e4k", "version"]
                ]) ||
                pickString(versions, [
                    ["CastleItemXMLVersion"],
                    ["itemVersion"],
                    ["items", "version"]
                ]);

            if (!itemVersion) {
                throw new Error("CastleItemXMLVersion missing from E4K cache metadata.");
            }

            setCachedMeta("item-version:e4k", { version: itemVersion });

            return {
                appVersion,
                appStoreVersion: appVersion,
                itemVersion,
                versionsUrl: DATA_URLS.e4kVersions
            };
        })();
    }

    return e4kRemoteInfoPromise;
}

async function loadJsonWithMetaFallback(url, metaKey, timeout) {
    try {
        const res = await fetchFreshWithFallback(url, timeout);
        const json = await res.json();
        setCachedMeta(metaKey, json);
        return json;
    } catch (error) {
        const fallback = getCachedMeta(metaKey);
        if (fallback) {
            console.warn(`${metaKey} fallback to cached value.`);
            return fallback;
        }
        throw error;
    }
}

function pickString(source, paths) {
    for (const path of paths) {
        const value = readPath(source, path);
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            return String(value).trim();
        }
    }

    return "";
}

function readPath(source, path) {
    let value = source;
    for (const key of path) {
        if (value == null) return undefined;
        value = value[key];
    }
    return value;
}

function normalizeItemsPayload(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return payload;
    }

    const normalized = { ...payload };

    for (const [key, value] of Object.entries(normalized)) {
        if (Array.isArray(value) || !value || typeof value !== "object") {
            continue;
        }

        const collection = extractCollection(value, key);
        if (collection) {
            normalized[key] = collection;
        }
    }

    return normalized;
}

function extractCollection(value, key) {
    const singular = key.endsWith("ies")
        ? `${key.slice(0, -3)}y`
        : key.endsWith("s")
            ? key.slice(0, -1)
            : key;
    const candidates = [
        key,
        singular,
        key.toLowerCase(),
        singular.toLowerCase(),
        capitalize(key),
        capitalize(singular),
        "items",
        "item",
        "Items",
        "Item",
        "rows",
        "row",
        "Rows",
        "Row",
        "entries",
        "entry",
        "Entries",
        "Entry"
    ];

    for (const candidate of candidates) {
        if (Array.isArray(value[candidate])) {
            return value[candidate];
        }
    }

    const values = Object.values(value);
    if (values.length > 0 && values.every(entry =>
        entry && typeof entry === "object" && !Array.isArray(entry)
    )) {
        return values;
    }

    return null;
}

function capitalize(value) {
    return value
        ? value.charAt(0).toUpperCase() + value.slice(1)
        : value;
}
