import { fetchWithFallback } from "./Fetcher.mjs";
import { getSelectedGameSource } from "./GameSettings.mjs";

const APP_LOOKUP_URL =
    "https://itunes.apple.com/lookup?id=585661281";
const EMPIRE_ITEMS_VERSION_URL =
    "https://empire-html5.goodgamestudios.com/default/items/ItemsVersion.properties";
const EMPIRE_ITEMS_BASE_URL =
    "https://empire-html5.goodgamestudios.com/default/items";
const LANGUAGE_VERSION_URL =
    "https://langserv.public.ggs-ep.com/12/fr/@metadata";
const LANGUAGE_BASE_URL =
    "https://langserv.public.ggs-ep.com";

let e4kRemoteInfoPromise = null;

export function getGameSource() {
    return getSelectedGameSource();
}

export async function getItemVersion() {
    if (getGameSource() === "e4k") {
        const info = await getE4kRemoteInfo();
        return info.itemVersion;
    }

    const url =
        EMPIRE_ITEMS_VERSION_URL;

    const res = await fetchWithFallback(url);
    const text = await res.text();

    const match = text.match(/CastleItemXMLVersion=(\d+\.\d+)/);
    if (!match) throw new Error("Version not found");

    return match[1];
}

export async function getLangVersion() {
    const url =
        LANGUAGE_VERSION_URL;

    const res = await fetchWithFallback(url);
    const json = await res.json();

    return json["@metadata"].versionNo;
}

export async function loadLanguage(langCode, version) {
    const url =
        `${LANGUAGE_BASE_URL}/12@${version}/${langCode}/*`;

    const res = await fetchWithFallback(url);
    return res.json();
}

export async function loadItems(version) {
    if (getGameSource() === "e4k") {
        const info = await getE4kRemoteInfo();
        const normalizedVersion =
            String(version || info.itemVersion).replaceAll(".", "_");
        const url =
            `https://media.goodgamestudios.com/loader/empirefourkingdoms/${info.appVersion}/itemsXML/items_${normalizedVersion}.ggs`;

        const res = await fetchWithFallback(url, 30000, {
            strategy: "proxy-first",
            useCorsProxy: true
        });
        const zipBuffer = await res.arrayBuffer();
        const xmlText = await unpackE4kArchive(zipBuffer);
        return parseE4kXml(xmlText);
    }

    const url =
        `${EMPIRE_ITEMS_BASE_URL}/items_v${version}.json`;

    const res = await fetchWithFallback(url);
    return res.json();
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

    if (source === "e4k") {
        const info = await getE4kRemoteInfo();
        const resolvedItemVersion = itemVersion || info.itemVersion;
        const resolvedLangVersion = langVersion || await getLangVersion();
        return {
            source,
            appStoreUrl: APP_LOOKUP_URL,
            appVersion: info.appVersion,
            itemVersion: resolvedItemVersion,
            langVersion: resolvedLangVersion,
            versionsUrl: info.versionsUrl,
            itemsUrl: `https://media.goodgamestudios.com/loader/empirefourkingdoms/${info.appVersion}/itemsXML/items_${String(resolvedItemVersion).replaceAll(".", "_")}.ggs`,
            languageVersionUrl: LANGUAGE_VERSION_URL,
            languageUrl: `${LANGUAGE_BASE_URL}/12@${resolvedLangVersion}/${langCode}/*`
        };
    }

    const resolvedItemVersion = itemVersion || await getItemVersion();
    const resolvedLangVersion = langVersion || await getLangVersion();
    return {
        source,
        itemVersion: resolvedItemVersion,
        langVersion: resolvedLangVersion,
        itemVersionUrl: EMPIRE_ITEMS_VERSION_URL,
        itemsUrl: `${EMPIRE_ITEMS_BASE_URL}/items_v${resolvedItemVersion}.json`,
        languageVersionUrl: LANGUAGE_VERSION_URL,
        languageUrl: `${LANGUAGE_BASE_URL}/12@${resolvedLangVersion}/${langCode}/*`
    };
}

export async function logResolvedDataUrls({ langCode = "en", itemVersion, langVersion } = {}) {
    const gameSource = getGameSource();
    const shortGameSource = gameSource === "empire" ? "em" : gameSource;
    const resolvedUrls = await getResolvedUrls({ langCode, itemVersion, langVersion });

    console.log(`Game source: ${shortGameSource}`);
    console.log("");
    console.log(`Item version: ${resolvedUrls.itemVersion}`);
    console.log(`Item URL: ${resolvedUrls.itemsUrl}`);
    console.log("");
    console.log(`Language version: ${resolvedUrls.langVersion}`);
    console.log(`Language URL: ${resolvedUrls.languageUrl}`);
    console.log("");

    return resolvedUrls;
}

async function getE4kRemoteInfo() {
    if (!e4kRemoteInfoPromise) {
        e4kRemoteInfoPromise = (async () => {
            const appVersion = await getE4kAppVersion();
            const versionsUrl =
                `https://media.goodgamestudios.com/loader/empirefourkingdoms/${appVersion}/versions.json`;
            const res = await fetchWithFallback(versionsUrl, 15000, {
                strategy: "direct-first",
                useCorsProxy: true
            });
            const json = await res.json();
            const itemVersion = json?.CastleItemXMLVersion;

            if (!itemVersion) {
                throw new Error("CastleItemXMLVersion missing from E4K versions.json.");
            }

            return {
                appVersion,
                itemVersion,
                versionsUrl
            };
        })();
    }

    return e4kRemoteInfoPromise;
}

async function getE4kAppVersion() {
    const res = await fetchWithFallback(APP_LOOKUP_URL, 15000, {
        strategy: "direct-first",
        useCorsProxy: true
    });
    const json = await res.json();
    const version = json?.results?.[0]?.version;

    if (!version) {
        throw new Error("Could not resolve E4K app version from the Apple lookup API.");
    }

    const parts = String(version).split(".");
    if (parts.length < 2) {
        throw new Error(`Unexpected E4K version format: ${version}`);
    }

    const major = parts[0];
    const minor = parts[1];
    const patch = (parts[2] || "0").padStart(3, "0");

    return `${major}${minor}${patch}`;
}

async function ensureJsZipLoaded() {
    if (window.JSZip) {
        return window.JSZip;
    }

    await new Promise((resolve, reject) => {
        const existing =
            document.querySelector('script[data-jszip-loader="1"]');

        if (existing) {
            existing.addEventListener("load", () => resolve(), { once: true });
            existing.addEventListener("error", () => reject(new Error("JSZip failed to load.")), { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
        script.async = true;
        script.dataset.jszipLoader = "1";
        script.addEventListener("load", () => resolve(), { once: true });
        script.addEventListener("error", () => reject(new Error("JSZip failed to load.")), { once: true });
        document.head.appendChild(script);
    });

    if (!window.JSZip) {
        throw new Error("JSZip is not available after loading.");
    }

    return window.JSZip;
}

async function unpackE4kArchive(zipBuffer) {
    const JSZip = await ensureJsZipLoaded();
    const zip = await JSZip.loadAsync(zipBuffer);
    const firstFile =
        Object.values(zip.files).find((file) => !file.dir);

    if (!firstFile) {
        throw new Error("The E4K archive did not contain any files.");
    }

    return firstFile.async("text");
}

function parseE4kXml(xmlText) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "application/xml");
    const parseError = xml.querySelector("parsererror");

    if (parseError) {
        throw new Error("Could not parse the E4K XML payload.");
    }

    const root = xml.querySelector("root");
    if (!root) {
        throw new Error("The E4K XML root element is missing.");
    }

    const data = {};
    for (const child of Array.from(root.children)) {
        data[child.nodeName] = xmlElementToJsonShape(child);
    }

    return data;
}

function xmlElementToJsonShape(element) {
    const children = Array.from(element.children);

    if (children.length > 0) {
        const distinctNames =
            [...new Set(children.map((child) => child.nodeName))];

        if (distinctNames.length === 1) {
            return children.map(xmlElementToObject);
        }
    }

    return xmlElementToObject(element);
}

function xmlElementToObject(element) {
    const hasAttributes = element.attributes.length > 0;
    const children = Array.from(element.children);
    const hasChildElements = children.length > 0;
    const rawText = element.textContent?.trim() || "";
    const hasText = Boolean(rawText) && !hasChildElements;

    if (!hasAttributes && !hasChildElements) {
        return rawText;
    }

    const result = {};

    for (const attr of Array.from(element.attributes)) {
        result[attr.name] = attr.value;
    }

    const groups = new Map();
    for (const child of children) {
        if (!groups.has(child.nodeName)) {
            groups.set(child.nodeName, []);
        }
        groups.get(child.nodeName).push(child);
    }

    for (const [name, nodes] of groups.entries()) {
        result[name] =
            nodes.length === 1
                ? xmlElementToObject(nodes[0])
                : nodes.map(xmlElementToObject);
    }

    if (hasText) {
        result.value = rawText;
    }

    return result;
}
