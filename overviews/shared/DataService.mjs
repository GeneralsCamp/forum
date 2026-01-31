import { fetchWithFallback } from "./Fetcher.mjs";

export async function getItemVersion() {
    const url =
        "https://empire-html5.goodgamestudios.com/default/items/ItemsVersion.properties";

    const res = await fetchWithFallback(url);
    const text = await res.text();

    const match = text.match(/CastleItemXMLVersion=(\d+\.\d+)/);
    if (!match) throw new Error("Version not found");

    return match[1];
}

export async function getLangVersion() {
    const url =
        "https://langserv.public.ggs-ep.com/12/fr/@metadata";

    const res = await fetchWithFallback(url);
    const json = await res.json();

    return json["@metadata"].versionNo;
}

export async function loadLanguage(langCode, version) {
    const url =
        `https://langserv.public.ggs-ep.com/12@${version}/${langCode}/*`;

    const res = await fetchWithFallback(url);
    return res.json();
}

export async function loadItems(version) {
    const url =
        `https://empire-html5.goodgamestudios.com/default/items/items_v${version}.json`;

    const res = await fetchWithFallback(url);
    return res.json();
}


export async function getCurrentVersionInfo() {
    const version = await getItemVersion();

    const url =
        `https://empire-html5.goodgamestudios.com/default/items/items_v${version}.json`;

    const res = await fetchWithFallback(url);
    const json = await res.json();

    return {
        version,
        date: json.versionInfo?.date?.["@value"] ?? "unknown"
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
        items
    };
}