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
    const url = "https://empire-html5.goodgamestudios.com/default/items/items_v" + await getItemVersion() + ".json";
    const blob = await fetchWithRetry(url);
    await saveFileInSubfolder("items", "items.json", blob);
    log("Downloaded latest items file.");
}

async function getLangFile() {
    const url = "https://langserv.public.ggs-ep.com/12@" + await getLangVersion() + "/en/*";
    const blob = await fetchWithRetry(url);
    await saveFileInSubfolder("lang", "lang.json", blob);
    log("Downloaded latest lang file.");
}

async function getDllFile() {
    const indexUrl = "https://empire-html5.goodgamestudios.com/default/index.html";
    const indexHtml = await proxyFetch(indexUrl).then(r => r.text());
    const dllMatch = indexHtml.match(/<link\s+id=["']dll["']\s+rel=["']preload["']\s+href=["']([^"']+)["']/i);
    if (!dllMatch) throw "DLL link not found.";
    const dllUrl = "https://empire-html5.goodgamestudios.com/default/" + dllMatch[1];
    const blob = await fetchWithRetry(dllUrl);
    await saveFileInSubfolder("dll", "dll.js", blob);
    log("Downloaded latest DLL file.");
}

// --- Get all asset URLs ---
async function getAllAssets() {
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

    const assets = uniquePaths
        .filter(p => !p.includes("_-1"))
        .map(p => {
            const relativePath = p.replace(/^itemassets\//, "");
            return { path: relativePath, url: `${base}${relativePath}.webp` };
        });

    log(`Found ${assets.length} assets to download.`);
    return assets;
}

// --- Download assets into assets folder ---
async function downloadAssets(assets) {
    let completed = currentIndex; 
    const errorLog = [];
    let currentConcurrency = 5;

    while (currentIndex < assets.length && !stopDownload) {
        const chunk = assets.slice(currentIndex, currentIndex + currentConcurrency);
        let allSkipped = true;

        await Promise.all(chunk.map(async (asset) => {
            if (stopDownload) return;

            const pathParts = asset.path.split("/");
            let currentDir = await folderHandle.getDirectoryHandle("assets", { create: true });

            for (let j = 0; j < pathParts.length - 2; j++) {
                currentDir = await currentDir.getDirectoryHandle(pathParts[j], { create: true });
            }

            const fileName = pathParts[pathParts.length - 1] + ".webp";

            let fileExists = false;
            try { await currentDir.getFileHandle(fileName); fileExists = true; } catch { }

            if (fileExists) {
                log(`Skipped (already exists): ${fileName}`);
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

    if (currentIndex === 0) log("=== Download process started ===");
    else log("=== Continuing download ===");

    const optAssets = document.getElementById("optAssets").checked;
    const optItems = document.getElementById("optItems").checked;
    const optLang  = document.getElementById("optLang").checked;
    const optDll   = document.getElementById("optDll").checked;

    if (optItems) await getItemFile();
    if (optLang)  await getLangFile();
    if (optDll)   await getDllFile();

    if (optAssets) {
        const assets = await getAllAssets();
        if (assets.length > 0) await downloadAssets(assets);
        if (currentIndex >= assets.length) currentIndex = 0;
    }

    updateStartButtonText();
    log("=== Download process finished ===");

    document.getElementById("stopDownload").disabled = true;
    document.getElementById("startDownload").disabled = false;
    document.getElementById("selectFolder").disabled = false;
});


// --- Stop download ---
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

