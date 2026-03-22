import {
    getGameSource,
    getItemVersion,
    getLangVersion,
    loadLanguage,
    loadItems,
    getResolvedUrls
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

    const totalSteps = 5;
    let step = 0;

    const set = (t) =>
        loader?.set(++step, totalSteps, t);

    set("Checking item version...");
    const itemVersion = await getItemVersion();
    const gameSource = getGameSource();
    const resolvedUrls =
        await getResolvedUrls({ langCode, itemVersion });
    const shortGameSource =
        gameSource === "empire" ? "em" : gameSource;

    console.log(`Game source: ${shortGameSource}`);
    console.log("");
    console.log(`Item version: ${itemVersion}`);
    console.log(`Item URL: ${resolvedUrls.itemsUrl}`);
    console.log("");

    set("Checking language version...");
    const langVersion = await getLangVersion();
    const resolvedLangUrls =
        await getResolvedUrls({ langCode, itemVersion, langVersion });

    console.log(`Language version: ${langVersion}`);
    console.log(`Language URL: ${resolvedLangUrls.languageUrl}`);
    console.log("");

    set("Loading language...");
    const langRaw =
        await loadLanguage(langCode, langVersion);

    const lang =
        lowercaseKeysRecursive(langRaw);

    set("Loading items...");
    const json =
        await loadItems(itemVersion);


    const effectCtx =
        buildEffectContext(json, lang);

    let imageMaps = {};

    if (Object.keys(assets).length > 0) {

        set("Loading images...");

        imageMaps =
            await loadImageMaps({
                ...assets,
                normalizeNameFn
            });
    }

    loader?.set(totalSteps, totalSteps,
        "Rendering...");


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

    loader?.hide();
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