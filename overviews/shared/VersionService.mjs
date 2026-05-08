import {
    getCurrentVersionInfo as getSharedCurrentVersionInfo,
    getGameSource,
    getVersionHistory
}
    from "./DataService.mjs";

export async function getCurrentVersionInfo() {
    return getSharedCurrentVersionInfo();
}

export async function findNewIDs({
    currentItems,
    extractItemsFn,
    idField = "constructionItemID"
}) {
    if (getGameSource() === "e4k")
        return new Set();

    const info = await getCurrentVersionInfo();
    const currentVersion = info.version;
    const history = await getVersionHistory().catch(() => null);
    const historyIds = findAddedIdsInHistory(history, currentVersion, idField);

    if (historyIds.size > 0)
        return historyIds;

    return new Set();
}

function findAddedIdsInHistory(history, currentVersion, idField) {
    const rows =
        Array.isArray(history)
            ? history
            : Array.isArray(history?.versions)
                ? history.versions
                : Array.isArray(history?.empire)
                    ? history.empire
                    : [];

    const match = rows.find(row =>
        String(row?.version || row?.itemVersion || "") === String(currentVersion)
    );

    const added =
        match?.added ||
        match?.new ||
        match?.newIds ||
        match?.itemsAdded ||
        match?.[idField];

    if (!added) return new Set();
    if (Array.isArray(added)) {
        return new Set(added.map(item =>
            typeof item === "object" ? item[idField] : item
        ).filter(id => id != null));
    }

    return new Set();
}
