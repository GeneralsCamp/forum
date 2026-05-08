import {
    getGameSource,
    getItemVersion,
    getLangVersion,
    loadLanguage,
    loadItems,
    logResolvedDataUrls
} from "./DataService.mjs";

import { buildEffectContext }
    from "./EffectService.mjs";

import { loadImageMaps }
    from "./ImageService.mjs";


export async function coreInit({
    loader,
    langCode = "en",
    normalizeNameFn,
    itemLabel = "items",

    assets = {},

    onReady
}) {
    loader?.hide();

    const [itemVersion, langVersion] = await Promise.all([
        getItemVersion(),
        getLangVersion()
    ]);
    const gameSource = getGameSource();

    await logResolvedDataUrls({ langCode, itemVersion, langVersion });

    const imageMapsPromise =
        Object.keys(assets).length > 0
            ? loadImageMaps({
                ...assets,
                normalizeNameFn
            })
            : Promise.resolve({});

    const [langRaw, json, imageMaps] = await Promise.all([
        loadLanguage(langCode, langVersion),
        loadItems(itemVersion),
        imageMapsPromise
    ]);

    const lang =
        lowercaseKeysRecursive(langRaw);

    const effectCtx =
        buildEffectContext(json, lang);


    await onReady({
        lang,
        data: json,
        imageMaps,

        effectCtx,

        versions: {
            itemVersion,
            langVersion,
            gameSource
        }
    });
}

function lowercaseKeysRecursive(input) {

    if (!input || typeof input !== "object")
        return input;

    if (Array.isArray(input))
        return input.map(lowercaseKeysRecursive);

    const o = {};

    for (const k in input) {

        o[k.toLowerCase()] =
            lowercaseKeysRecursive(input[k]);
    }

    return o;
}
