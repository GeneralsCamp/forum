import { fetchWithFallback }
    from "./Fetcher.mjs";

export async function getCurrentVersionInfo() {

    const url =
        "https://empire-html5.goodgamestudios.com/default/items/ItemsVersion.properties";

    const res = await fetchWithFallback(url);
    const text = await res.text();

    const match =
        text.match(/CastleItemXMLVersion=(\d+\.\d+)/);

    if (!match)
        return { version: "unknown", date: "unknown" };

    const version = match[1];

    const jsonUrl =
        `https://empire-html5.goodgamestudios.com/default/items/items_v${version}.json`;

    const jsonRes = await fetchWithFallback(jsonUrl);
    const json = await jsonRes.json();

    return {
        version,
        date: json.versionInfo?.date?.["@value"] ?? "unknown"
    };
}

export async function findNewIDs({
    currentItems,
    extractItemsFn,
    idField = "constructionItemID"
}) {

    const info = await getCurrentVersionInfo();
    const currentVersion = info.version;

    const [majorStr] = currentVersion.split(".");
    let major = parseInt(majorStr, 10);

    while (major > 0) {

        for (let minor = 5; minor >= 1; minor--) {

            const candidate =
                `${major - 1}.${String(minor).padStart(2,"0")}`;

            const url =
                `https://empire-html5.goodgamestudios.com/default/items/items_v${candidate}.json`;

            try {
                const res =
                    await fetchWithFallback(url);

                if (!res.ok) continue;

                const json =
                    await res.json();

                const oldItems =
                    extractItemsFn(json);

                const oldIDs =
                    new Set(oldItems.map(i => i[idField]));

                const newIDs =
                    new Set(currentItems.map(i => i[idField]));

                const added =
                    [...newIDs]
                    .filter(id => !oldIDs.has(id));

                if (added.length)
                    return new Set(added);

            } catch {}
        }

        major--;
    }

    return new Set();
}
