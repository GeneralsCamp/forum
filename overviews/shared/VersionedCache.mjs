const CACHE_NAME = "gf-versioned-data-v1";
const memoryCache = new Map();

function canUseCacheApi() {
    return typeof window !== "undefined" && "caches" in window;
}

function buildCacheUrl(key) {
    return new URL(
        `/__gf_cache__/${encodeURIComponent(key)}`,
        window.location.origin
    ).toString();
}

async function getCacheStore() {
    if (!canUseCacheApi()) return null;
    return caches.open(CACHE_NAME);
}

export async function getCachedJson(key) {
    if (memoryCache.has(key)) {
        return memoryCache.get(key);
    }

    const cache = await getCacheStore();
    if (!cache) return null;

    const match = await cache.match(buildCacheUrl(key));
    if (!match) return null;

    const json = await match.json();
    memoryCache.set(key, json);
    return json;
}

export async function setCachedJson(key, value) {
    memoryCache.set(key, value);

    const cache = await getCacheStore();
    if (!cache) return;

    await cache.put(
        buildCacheUrl(key),
        new Response(JSON.stringify(value), {
            headers: {
                "Content-Type": "application/json"
            }
        })
    );
}

export async function getCachedText(key) {
    if (memoryCache.has(key)) {
        return memoryCache.get(key);
    }

    const cache = await getCacheStore();
    if (!cache) return null;

    const match = await cache.match(buildCacheUrl(key));
    if (!match) return null;

    const text = await match.text();
    memoryCache.set(key, text);
    return text;
}

export async function setCachedText(key, value) {
    memoryCache.set(key, value);

    const cache = await getCacheStore();
    if (!cache) return;

    await cache.put(
        buildCacheUrl(key),
        new Response(value, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8"
            }
        })
    );
}
