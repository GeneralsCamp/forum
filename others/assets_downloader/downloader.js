// --- Proxy and global variables ---
const myProxy = "https://my-proxy-8u49.onrender.com/";

let folderHandle;
let stopDownload = false;
let currentIndex = 0;

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
async function proxyFetch(url, options = {}) {
    return fetch(myProxy + url, options);
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

// --- Get special files ---
async function getItemFile() {
    const version = await getItemVersion();
    const fileName = `items-${version}.json`;

    try {
        const dirHandle = await folderHandle.getDirectoryHandle("items", { create: true });
        await dirHandle.getFileHandle(fileName);
        log(`Skipped (already exists): ${fileName}`);
        return;
    } catch { }

    const url = "https://empire-html5.goodgamestudios.com/default/items/items_v" + version + ".json";
    const blob = await fetchWithRetry(url);
    await saveFileInSubfolder("items", fileName, blob);
    log(`The latest items file has been downloaded, with version: ${version}`);
}

async function getLangFile(selectedLang) {
    const version = await getLangVersion();
    const langs = [
        "en", "ar", "pt", "es", "de", "nl", "sv", "bg", "fr", "zh_CN", "el", "cs",
        "da", "fi", "hu", "id", "it", "ja", "ko", "ru", "lt", "no", "pl", "ro",
        "sk", "tr", "zh_TW"
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

        const url = `https://langserv.public.ggs-ep.com/12@${version}/${lang}/`;
        try {
            const blob = await fetchWithRetry(url);
            await saveFileInSubfolder("lang", fileName, blob);
            log(`Downloaded language file: ${fileName}`);
        } catch {
            log(`Failed to download: ${fileName}`);
        }
    }
}

async function getDllFile() {
    const indexUrl = "https://empire-html5.goodgamestudios.com/default/index.html";
    const indexHtml = await proxyFetch(indexUrl).then(r => r.text());
    const dllMatch = indexHtml.match(/<link\s+id=["']dll["']\s+rel=["']preload["']\s+href=["']([^"']+)["']/i);
    if (!dllMatch) throw "DLL link not found.";

    const dllPath = dllMatch[1];

    const hashMatch = dllPath.match(/dll\/ggs\.dll\.([^.]+)\.js/i);
    const hash = hashMatch ? hashMatch[1] : Date.now();
    const fileName = `dll-${hash}.js`;

    try {
        const dirHandle = await folderHandle.getDirectoryHandle("dll", { create: true });
        await dirHandle.getFileHandle(fileName);
        log(`Skipped (already exists): ${fileName}`);
        return;
    } catch { }

    const dllUrl = "https://empire-html5.goodgamestudios.com/default/" + dllPath;
    const blob = await fetchWithRetry(dllUrl);
    await saveFileInSubfolder("dll", fileName, blob);
    log(`The latest DLL file has been downloaded, with version: ${hash}`);
}

// --- Get all asset URLs ---
async function getAllAssets(usePng) {
    const base = "https://empire-html5.goodgamestudios.com/default/assets/itemassets/";
    const indexUrl = "https://empire-html5.goodgamestudios.com/default/index.html";

    log("Connecting to the game server...");
    const indexRes = await proxyFetch(indexUrl);
    const indexHtml = await indexRes.text();

    const dllMatch = indexHtml.match(/<link\s+id=["']dll["']\s+rel=["']preload["']\s+href=["']([^"']+)["']/i);
    const dllUrl = `https://empire-html5.goodgamestudios.com/default/${dllMatch[1]}`;

    log("Searching for asset paths...");
    const dllRes = await proxyFetch(dllUrl);
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
async function downloadAssets(assets, usePng) {
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

// --- Fetch with retry ---
async function fetchWithRetry(url, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await proxyFetch(url);
            if (!res.ok) throw `HTTP ${res.status}`;
            return await res.blob();
        } catch (err) {
            if (attempt === retries) throw err;
        }
    }
}

// --- Get item/lang version helpers ---
async function getItemVersion() {
    const url = "https://empire-html5.goodgamestudios.com/default/items/ItemsVersion.properties";
    const text = await proxyFetch(url).then(r => r.text());
    const match = text.match(/CastleItemXMLVersion=(\d+\.\d+)/);
    if (!match) throw new Error("Version: error");
    return match[1];
}

async function getLangVersion() {
    const url = "https://langserv.public.ggs-ep.com/12/fr/@metadata";
    const json = await proxyFetch(url).then(r => r.json());
    return json["@metadata"].versionNo;
}

// --- Start / Continue download ---
document.getElementById("startDownload").addEventListener("click", async () => {
    if (!folderHandle) return;

    stopDownload = false;

    document.getElementById("stopDownload").disabled = false;
    document.getElementById("selectFolder").disabled = true;
    document.getElementById("startDownload").disabled = true;

    const selects = document.querySelectorAll("#optAssets, #optItems, #optLang, #optDll");
    selects.forEach(sel => sel.disabled = true);

    if (currentIndex === 0) log("=== Download process started ===");
    else log("=== Continuing download ===");

    const optAssets = document.getElementById("optAssets").value;
    const optItems = document.getElementById("optItems").value;
    const optLang = document.getElementById("optLang").value;
    const optDll = document.getElementById("optDll").value;

    if (optItems === "items") {
        await getItemFile();
    }

    if (optLang !== "no-lang") {
        await getLangFile(optLang);
    }

    if (optDll === "dll") {
        await getDllFile();
    }

    if (optAssets === "png" || optAssets === "webp") {
        const usePng = optAssets === "png";

        const assets = await getAllAssets(usePng);
        if (assets.length > 0) await downloadAssets(assets, usePng);
        if (currentIndex >= assets.length) currentIndex = 0;
    }
    updateStartButtonText();
    log("=== Download process finished ===");
    document.getElementById("stopDownload").disabled = true;
    document.getElementById("startDownload").disabled = false;
    document.getElementById("selectFolder").disabled = false;
    selects.forEach(sel => sel.disabled = false);
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

