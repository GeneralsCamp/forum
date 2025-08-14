const myProxy = "https://my-proxy-8u49.onrender.com/";

let folderHandle;
let stopDownload = false;

// --- Logging ---
function log(msg) {
    const logEl = document.getElementById("log");
    const timestamp = new Date().toLocaleTimeString();
    logEl.textContent += `[${timestamp}] ${msg}\n`;
    logEl.scrollTop = logEl.scrollHeight;
}

// --- Progress bar ---F
function updateProgress(current, total) {
    const progressEl = document.getElementById("downloadProgress");
    const percent = total ? Math.round((current / total) * 100) : 0;
    progressEl.style.width = percent + "%";
    progressEl.textContent = `${current} / ${total}`;
}

// --- Proxy fetch wrapper ---
async function proxyFetch(url, options = {}) {
    return fetch(myProxy + url, options);
}

// --- Select folder ---
document.getElementById("selectFolder").addEventListener("click", async () => {
    try {
        folderHandle = await window.showDirectoryPicker();
        log(`Target folder "${folderHandle.name}" selected. Click 'Start Download' to begin.`);
        document.getElementById("startDownload").disabled = false;
    } catch (err) {
        log("Folder selection canceled or not supported by this browser.");
    }
});

// --- Stop download ---
document.getElementById("stopDownload").addEventListener("click", () => {
    stopDownload = true;
    log("Download stopped by user.");
});

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

// --- Get all assets ---
async function getAllAssets() {
    const base = "https://empire-html5.goodgamestudios.com/default/assets/itemassets/";
    const indexUrl = "https://empire-html5.goodgamestudios.com/default/index.html";

    try {
        log("Connecting to the game server...");
        const indexRes = await proxyFetch(indexUrl);
        const indexHtml = await indexRes.text();

        const dllMatch = indexHtml.match(/<link\s+id=["']dll["']\s+rel=["']preload["']\s+href=["']([^"']+)["']/i);
        if (!dllMatch) throw "DLL link not found.";
        const dllRelativeUrl = dllMatch[1];
        const dllUrl = `https://empire-html5.goodgamestudios.com/default/${dllRelativeUrl}`;

        log(`DLL file identified: ${dllUrl}`);
        log("Downloading DLL file...");
        const dllRes = await proxyFetch(dllUrl);
        const dllText = await dllRes.text();

        log("Searching for asset paths...");
        const regex = /itemassets\/[^\s"'<>]+?--\d+/g;
        const matches = [...dllText.matchAll(regex)];
        const uniquePaths = [...new Set(matches.map(m => m[0]))];

        const assets = uniquePaths.map(p => {
            const relativePath = p.replace(/^itemassets\//, "");
            return { path: relativePath, url: `${base}${relativePath}.webp` };
        });

        log(`Found ${assets.length} assets to download.`);
        return assets;
    } catch (err) {
        log("ERROR: " + err);
        return [];
    }
}

// --- Start download ---
document.getElementById("startDownload").addEventListener("click", async () => {
    if (!folderHandle) return;

    stopDownload = false;
    document.getElementById("stopDownload").disabled = false;
    document.getElementById("startDownload").disabled = true;

    log("=== Download process started ===");
    log("Do not close the page until the process is finished.");
    log("Gathering asset list...");

    const assets = await getAllAssets();
    if (assets.length === 0) {
        log("No assets found for download.");
        document.getElementById("stopDownload").disabled = true;
        document.getElementById("startDownload").disabled = false;
        return;
    }

    const errorLog = [];

    for (const [i, asset] of assets.entries()) {
        if (stopDownload) break;

        const pathParts = asset.path.split("/");
        let currentDir = folderHandle;
        for (let j = 0; j < pathParts.length - 2; j++) {
            currentDir = await currentDir.getDirectoryHandle(pathParts[j], { create: true });
        }

        const fileName = pathParts[pathParts.length - 1] + ".webp";

        let fileExists = false;
        try { await currentDir.getFileHandle(fileName); fileExists = true; } catch { }

        if (fileExists) {
            log(`Skipped (already exists): ${fileName}`);
            updateProgress(i + 1, assets.length);
            continue;
        }

        try {
            const blob = await fetchWithRetry(asset.url);
            const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            log(`Downloaded (${i + 1}/${assets.length}): ${fileName}`);
        } catch (err) {
            errorLog.push(asset.url);
            log(`Failed after retries: ${asset.url}`);
        }

        updateProgress(i + 1, assets.length);
    }

    if (errorLog.length > 0) {
        log("=== The following files failed to download: ===");
        errorLog.forEach(u => log(u));
    } else if (!stopDownload) {
        log("All new assets downloaded successfully.");
    }

    log("=== Download process finished ===");
    document.getElementById("stopDownload").disabled = true;
    document.getElementById("startDownload").disabled = false;
});

// --- Check if File System Access API is supported ---
document.addEventListener("DOMContentLoaded", () => {
    if (!window.showDirectoryPicker) {
        log("ERROR: This downloader only works on desktop browsers.");
        document.getElementById("selectFolder").disabled = true;
        document.getElementById("startDownload").disabled = true;
        document.getElementById("stopDownload").disabled = true;
    } else {
        log("Please select an empty target folder to store the downloaded assets.");
    }
});
