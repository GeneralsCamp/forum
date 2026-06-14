import { loadGoogleAnalytics } from "../../overviews/shared/ConsentManager.mjs";
import {
    DATA_URLS,
    getLangVersion as getSharedLangVersion,
    loadLanguage
} from "../../overviews/shared/DataService.mjs";
import { fetchFreshWithFallback } from "../../overviews/shared/Fetcher.mjs";

// --- Proxy and global variables ---
const assetProxy = "https://my-proxy-8u49.onrender.com/";

let folderHandle;
let stopDownload = false;
let currentIndex = 0;
const SITE_CACHE_NAME = "gf-versioned-data";
const SITE_META_PREFIX = "gf-cache-meta:";

// --- Logging ---
function log(msg) {
    const logEl = document.getElementById("log");
    const timestamp = new Date().toLocaleTimeString();
    logEl.textContent += `[${timestamp}] ${msg}\n`;
    logEl.scrollTop = logEl.scrollHeight;
}

// --- Progress bar ---
function updateProgress(current, total) {
    const progressEl = document.getElementById("downloadProgress");
    const textEl = progressEl.querySelector(".progress-text");
    const percent = total ? Math.round((current / total) * 100) : 0;

    progressEl.style.width = percent + "%";
    textEl.textContent = `${current} / ${total}`;
}

// --- Proxy fetch wrapper ---
async function assetProxyFetch(url, options = {}) {
    return fetch(assetProxy + url, options);
}

// --- Update start button text ---
function updateStartButtonText() {
    const startBtn = document.getElementById("startDownload");
    startBtn.textContent = currentIndex > 0 ? "Continue Download" : "Start Download";
}

// --- Download file into subfolder ---
async function saveFileInSubfolder(subfolder, fileName, blob) {
    const dirHandle = await folderHandle.getDirectoryHandle(subfolder, { create: true });
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
}

function buildSiteCacheUrl(key) {
    return new URL(`/__gf_cache__/${encodeURIComponent(key)}`, window.location.origin).toString();
}

async function setSiteCachedJson(key, value) {
    if (!("caches" in window)) return;
    const cache = await caches.open(SITE_CACHE_NAME);
    await cache.put(
        buildSiteCacheUrl(key),
        new Response(JSON.stringify(value), {
            headers: {
                "Content-Type": "application/json"
            }
        })
    );
}

function setSiteCachedMeta(key, value) {
    try {
        localStorage.setItem(`${SITE_META_PREFIX}${key}`, JSON.stringify(value));
    } catch { }
}

async function fileExistsInSubfolder(subfolder, fileName) {
    try {
        const dirHandle = await folderHandle.getDirectoryHandle(subfolder, { create: true });
        await dirHandle.getFileHandle(fileName);
        return true;
    } catch {
        return false;
    }
}

// --- Get special files ---
async function getItemFile() {
    const version = await getEmpireItemVersion();
    const fileName = `items-${version}.json`;

    try {
        const dirHandle = await folderHandle.getDirectoryHandle("items", { create: true });
        await dirHandle.getFileHandle(fileName);
        log(`Skipped (already exists): ${fileName}`);
        return;
    } catch { }

    const items = await fetchJsonFromRaw(DATA_URLS.empireItems);
    await setSiteCachedJson(`items:empire:${version}`, items);
    const blob = jsonBlob(items);
    await saveFileInSubfolder("items", fileName, blob);
    log(`The latest items file has been downloaded from GitHub raw, with version: ${version}`);
}

async function getLangFile(selectedLang) {
    const version = await getSharedLangVersion();
    const langs = [
        "en", "ar", "es", "bg", "pt", "cs", "de", "da", "fi", "fr", "el", "hu",
        "it", "ja", "ko", "lt", "nl", "no", "pl", "ro", "ru", "sv", "sk", "tr"
    ];

    const targetLangs = selectedLang === "all" ? langs : [selectedLang];

    for (const lang of targetLangs) {
        const fileName = `lang-${lang}-${version}.json`;

        try {
            const dirHandle = await folderHandle.getDirectoryHandle("lang", { create: true });
            await dirHandle.getFileHandle(fileName);
            log(`Skipped (already exists): ${fileName}`);
            continue;
        } catch { }

        try {
            const langJson = await loadLanguage(lang, version);
            await setSiteCachedJson(`lang:empire:${lang}:${version}`, langJson);
            const blob = jsonBlob(langJson);
            await saveFileInSubfolder("lang", fileName, blob);
            log(`Downloaded language file: ${fileName}`);
        } catch {
            log(`Failed to download: ${fileName}`);
        }
    }
}

async function getDllFile() {
    const versionJson = await fetchJsonFromRaw(DATA_URLS.empireDllVersion);
    const hash = String(
        versionJson.version ||
        versionJson.hash ||
        versionJson.dllVersion ||
        versionJson.fileVersion ||
        versionJson.updatedAt ||
        "latest"
    );
    const fileName = `dll-${hash}.js`;

    try {
        const dirHandle = await folderHandle.getDirectoryHandle("dll", { create: true });
        await dirHandle.getFileHandle(fileName);
        log(`Skipped (already exists): ${fileName}`);
        return;
    } catch { }

    const blob = await fetchBlobFromRaw(DATA_URLS.empireDll);
    await saveFileInSubfolder("dll", fileName, blob);
    log(`The latest DLL file has been downloaded from GitHub raw, with version: ${hash}`);
}

async function getE4kExtraFiles() {
    const [appStoreJson, versionsJson, itemsJson] = await Promise.all([
        fetchJsonFromRaw(DATA_URLS.e4kAppStore),
        fetchJsonFromRaw(DATA_URLS.e4kVersions),
        fetchJsonFromRaw(DATA_URLS.e4kItems)
    ]);

    const appVersion = String(
        appStoreJson?.version ||
        appStoreJson?.appVersion ||
        appStoreJson?.loaderVersion ||
        appStoreJson?.results?.[0]?.version ||
        "unknown"
    );
    const itemVersion = String(
        versionsJson?.CastleItemXMLVersion ||
        versionsJson?.itemVersion ||
        versionsJson?.items?.version ||
        "latest"
    ).trim();

    if (!itemVersion) {
        throw new Error("E4K CastleItemXMLVersion was not found.");
    }

    const fileName = `items-e4k-${itemVersion}.json`;

    if (await fileExistsInSubfolder("e4k", fileName)) {
        log(`Skipped (already exists): ${fileName}`);
    } else {
        await saveFileInSubfolder("e4k", fileName, jsonBlob(itemsJson));
        log(`Downloaded E4K items from GitHub raw: ${fileName}`);
    }

    await setSiteCachedJson(`items:e4k:${itemVersion}`, itemsJson);
    setSiteCachedMeta("item-version:e4k", {
        version: itemVersion,
        appVersion,
        appStoreVersion: appVersion,
        itemVersion,
        versionsUrl: DATA_URLS.e4kVersions
    });
    log(`Prepared site cache for E4K items: ${itemVersion} (app ${appVersion})`);
}

// --- Get all asset URLs ---
async function getAllAssets(usePng) {
    const base = "https://empire-html5.goodgamestudios.com/default/assets/itemassets/";

    log("Loading DLL from GitHub raw data cache...");
    const dllRes = await fetchFreshWithFallback(DATA_URLS.empireDll, 30000);
    const dllText = await dllRes.text();

    const regex = /itemassets\/[^\s"'<>]+?--\d+/g;
    const matches = [...dllText.matchAll(regex)];
    const uniquePaths = [...new Set(matches.map(m => m[0]))];

    const extension = usePng ? "png" : "webp";

    const assets = uniquePaths
        .filter(p => !p.includes("_-1"))
        .map(p => {
            const relativePath = p.replace(/^itemassets\//, "");
            return { path: relativePath, url: `${base}${relativePath}.${extension}`, ext: extension };
        });

    log(`Found ${assets.length} assets to download (${extension}).`);
    return assets;
}

// --- Download assets into assets folder ---
async function saveAssetCopyInSubfolder(subfolder, asset, blob) {
    const pathParts = asset.path.split("/");
    let currentDir = await folderHandle.getDirectoryHandle(subfolder, { create: true });

    for (let j = 0; j < pathParts.length - 2; j++) {
        currentDir = await currentDir.getDirectoryHandle(pathParts[j], { create: true });
    }

    const fileName = pathParts[pathParts.length - 1] + "." + asset.ext;
    const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
}

async function downloadAssets(assets, usePng, duplicateNewToNews = false) {
    let completed = currentIndex;
    const errorLog = [];
    let currentConcurrency = 5;

    const assetsRootFolder = usePng ? "assets-png" : "assets-webp";

    while (currentIndex < assets.length && !stopDownload) {
        const chunk = assets.slice(currentIndex, currentIndex + currentConcurrency);
        let allSkipped = true;

        await Promise.all(chunk.map(async (asset) => {
            if (stopDownload) return;

            const pathParts = asset.path.split("/");
            let currentDir = await folderHandle.getDirectoryHandle(assetsRootFolder, { create: true });

            for (let j = 0; j < pathParts.length - 2; j++) {
                currentDir = await currentDir.getDirectoryHandle(pathParts[j], { create: true });
            }

            const fileName = pathParts[pathParts.length - 1] + "." + asset.ext;

            let fileExists = false;
            try { await currentDir.getFileHandle(fileName); fileExists = true; } catch { }

            if (fileExists) {

            } else {
                allSkipped = false;
                try {
                    const blob = await fetchWithRetry(asset.url);
                    const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();

                    if (duplicateNewToNews) {
                        await saveAssetCopyInSubfolder("News", asset, blob);
                    }

                    log(`Downloaded (${completed + 1}/${assets.length}): ${fileName}`);
                } catch (err) {
                    errorLog.push(asset.url);
                    log(`Failed after retries: ${asset.url}`);
                }
            }

            completed++;
            updateProgress(completed, assets.length);
        }));

        currentIndex += chunk.length;
        currentConcurrency = allSkipped ? 20 : 5;
    }

    if (errorLog.length > 0) {
        log("=== The following files failed to download: ===");
        errorLog.forEach(u => log(u));
    } else if (!stopDownload) {
        log("All new assets downloaded successfully.");
    }
}

// --- Fetch helpers ---
async function fetchWithRetry(url, retries = 2) {
    return fetchBlobWithRetry(url, retries);
}

async function fetchBlobWithRetry(url, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await assetProxyFetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.blob();
        } catch (err) {
            if (attempt === retries) throw err;
        }
    }
}

async function fetchBlobFromRaw(url) {
    const res = await fetchFreshWithFallback(url, 30000);
    return res.blob();
}

async function fetchJsonFromRaw(url) {
    const res = await fetchFreshWithFallback(url, 30000);
    return res.json();
}

async function fetchTextFromRaw(url) {
    const res = await fetchFreshWithFallback(url, 30000);
    return res.text();
}

async function getEmpireItemVersion() {
    try {
        const manifest = await fetchJsonFromRaw(DATA_URLS.manifest);
        const manifestVersion = String(
            manifest?.empire?.itemVersion ||
            manifest?.empire?.items?.version ||
            manifest?.versions?.empireItems ||
            ""
        ).trim();

        if (manifestVersion) return manifestVersion;
    } catch { }

    const text = await fetchTextFromRaw(DATA_URLS.empireItemVersion);
    const match = text.match(/CastleItemXMLVersion=(\d+(?:\.\d+)+)/);
    if (!match) throw new Error("Empire item version was not found.");
    return match[1];
}

function jsonBlob(value) {
    return new Blob([JSON.stringify(value, null, 2)], {
        type: "application/json;charset=utf-8"
    });
}

// --- Start / Continue download ---
document.getElementById("startDownload").addEventListener("click", async () => {
    if (!folderHandle) return;

    stopDownload = false;

    document.getElementById("stopDownload").disabled = false;
    document.getElementById("selectFolder").disabled = true;
    document.getElementById("startDownload").disabled = true;

    const selects = document.querySelectorAll("#optAssets, #optItems, #optLang, #optDll, #optE4k, #duplicateNewToNews");
    selects.forEach(sel => sel.disabled = true);

    if (currentIndex === 0) log("=== Download process started ===");
    else log("=== Continuing download ===");

    const optAssets = document.getElementById("optAssets").value;
    const optItems = document.getElementById("optItems").value;
    const optLang = document.getElementById("optLang").value;
    const optDll = document.getElementById("optDll").value;
    const optE4k = document.getElementById("optE4k").value;
    const duplicateNewToNews = document.getElementById("duplicateNewToNews").value === "news";

    try {
        if (duplicateNewToNews) {
            log("News duplicate is enabled. Newly downloaded assets will also be copied to the News folder.");
        }

        if (optItems === "items") {
            await getItemFile();
        }

        if (optLang !== "no-lang") {
            await getLangFile(optLang);
        }

        if (optDll === "dll") {
            await getDllFile();
        }

        if (optE4k === "e4k-extra") {
            try {
                await getE4kExtraFiles();
            } catch (err) {
                log(`E4K mobile extra files failed: ${err?.message || err}`);
            }
        }

        if (optAssets === "png" || optAssets === "webp") {
            const usePng = optAssets === "png";

            const assets = await getAllAssets(usePng);
            if (assets.length > 0) await downloadAssets(assets, usePng, duplicateNewToNews);
            if (currentIndex >= assets.length) currentIndex = 0;
        }

        log("=== Download process finished ===");
    } catch (err) {
        log(`Download process failed: ${err?.message || err}`);
    } finally {
        updateStartButtonText();
        document.getElementById("stopDownload").disabled = true;
        document.getElementById("startDownload").disabled = false;
        document.getElementById("selectFolder").disabled = false;
        selects.forEach(sel => sel.disabled = false);
    }
});

document.getElementById("stopDownload").addEventListener("click", () => {
    stopDownload = true;
    log("Download stopped by user.");
});

// --- Select folder ---
document.getElementById("selectFolder").addEventListener("click", async () => {
    try {
        folderHandle = await window.showDirectoryPicker();
        currentIndex = 0;
        log(`Target folder "${folderHandle.name}" selected. Click 'Start Download' to begin.`);
        document.getElementById("startDownload").disabled = false;
        updateStartButtonText();
    } catch (err) {
        log("Folder selection canceled or not supported by this browser.");
    }
});

// --- File System Access API check ---
document.addEventListener("DOMContentLoaded", () => {
    loadGoogleAnalytics("G-8TGZRNFGRR");

    if (!window.showDirectoryPicker) {
        log("ERROR: This downloader only works on desktop browsers.");
        document.getElementById("selectFolder").disabled = true;
        document.getElementById("startDownload").disabled = true;
        document.getElementById("stopDownload").disabled = true;
    } else {
        log("Please select a target folder to store the downloaded assets.");
        updateStartButtonText();
    }
});
