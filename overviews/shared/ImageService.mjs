import { fetchFreshWithFallback } from "./Fetcher.mjs";
import {
    getCachedText,
    setCachedText,
    setCachedMeta
} from "./VersionedCache.mjs";
import { DATA_URLS } from "./DataService.mjs";

const ASSET_ROOT =
    "https://empire-html5.goodgamestudios.com/default/assets/";
const BASE =
    `${ASSET_ROOT}itemassets/`;

// ---- DLL CACHE ----
let dllTextPromise = null;

async function getDllText() {

    if (!dllTextPromise) {

        dllTextPromise = (async () => {
            const versionRes =
                await fetchFreshWithFallback(DATA_URLS.empireDllVersion, 10000);
            const versionJson =
                await versionRes.json();
            const dllVersion =
                String(
                    versionJson.version ||
                    versionJson.hash ||
                    versionJson.dllVersion ||
                    versionJson.fileVersion ||
                    versionJson.updatedAt ||
                    "latest"
                );
            const dllUrl = DATA_URLS.empireDll;
            const cacheKey = `dll-text:${dllVersion}`;
            const cachedDllText = await getCachedText(cacheKey);
            const cacheState = cachedDllText ? "cached" : "network";

            console.log(`DLL version: ${dllVersion} (${cacheState})`);
            console.log(`DLL URL: ${dllUrl}`);
            console.log("");

            setCachedMeta("dll-meta:empire", {
                version: dllVersion,
                url: dllUrl
            });

            if (cachedDllText) {
                return cachedDllText;
            }

            const dllRes =
                await fetchFreshWithFallback(dllUrl);

            const dllText = await dllRes.text();
            await setCachedText(cacheKey, dllText);
            return dllText;
        })();
    }

    return dllTextPromise;
}

const parsedCache = {};

function parseDecorations(text, normalize) {

    const regex =
        /Building\/Deco\/[^\s"'`<>]+?--\d+/g;

    const map = {};

    for (const m of text.matchAll(regex)) {

        const file =
            m[0].split("/").pop();

        const clean =
            normalize(
                file
                    .split("--")[0]
                    .replace(/^Deco_Building_/, "")
            );

        map[clean] = {
            placedUrl: `${BASE}${m[0]}.webp`
        };
    }

    return map;
}

function parseConstructions(text, normalize) {

    const regexIcon =
        /ConstructionItems\/ConstructionItem_([^\s"'`<>]+?)--\d+/g;

    const regexPlaced =
        /Building\/[^\/]+\/([^\/]+)\/[^\/]+--\d+/g;

    const map = {};

    for (const m of text.matchAll(regexIcon)) {

        const name =
            normalize(m[1]);

        map[name] ??= {};
        map[name].iconUrl =
            `${BASE}${m[0]}.webp`;
    }

    for (const m of text.matchAll(regexPlaced)) {

        const raw =
            m[1].split("_Building_").pop();

        const name =
            normalize(raw);

        map[name] ??= {};
        map[name].placedUrl =
            `${BASE}${m[0]}.webp`;
    }

    return map;
}

function parseBuildings(text, normalize) {

    const regex =
        /Building\/[^\s"'`<>]+?--\d+/g;

    const map = {};

    function addCandidate(candidate, url) {
        const key = normalize(candidate);
        if (!key) return;
        map[key] ??= {};
        map[key].candidates ??= [];
        if (!map[key].candidates.some(entry => entry.url === url)) {
            map[key].candidates.push({ url, path: url.slice(BASE.length) });
        }
        map[key].placedUrl ??= url;
    }

    for (const m of text.matchAll(regex)) {

        const path = m[0];
        const url = `${BASE}${path}.webp`;
        const parts = path.split("/");
        const file =
            parts[parts.length - 1].split("--")[0];
        const parent =
            parts.length > 1 ? parts[parts.length - 2] : "";
        const baseName =
            file.includes("_Building_")
                ? file.split("_Building_")[0]
                : file;

        addCandidate(file, url);
        addCandidate(parent, url);
        addCandidate(baseName, url);
        addCandidate(file.replace(/^Deco_Building_/, ""), url);
    }

    return map;
}

function parseUnits(text, normalize) {

    const regex =
        /Units\/[^\/]+\/[^\/]+\/[^\/]+?--\d+/g;

    const map = {};

    for (const m of text.matchAll(regex)) {

        const file =
            m[0].split("/").pop();

        const key =
            normalize(file.split("--")[0]);

        map[key] =
            `${BASE}${m[0]}.webp`;
    }

    return map;
}

function parseCurrencies(text, normalize) {

    const regex =
        /Collectables\/(?:[^\/]+\/)?Collectable_Currency_[^\s"'`<>]+?--\d+/g;


    const map = {};

    for (const m of text.matchAll(regex)) {

        const file =
            m[0].split("/").pop();

        const clean =
            normalize(
                file
                    .split("--")[0]
                    .replace(/^Collectable_Currency_/, "")
            );

        map[clean] =
            `${BASE}${m[0]}.webp`;
    }

    return map;
}

function parseLooks(text, normalize) {

    const base =
        BASE;

    const map = {};

    function ensure(name) {
        map[name] ??= {
            mapObjects: {},
            movements: {}
        };
    }

    function addMatch(regex, keyName, folderBuilder) {

        for (const match of text.matchAll(regex)) {

            const fullMatch = match[0];
            const rawName = match[1];
            const normalized = normalize(rawName);

            if (
                normalized === "halloween" &&
                (keyName === "moveNormal" || keyName === "moveBoat")
            ) continue;

            const [fileName, suffix] =
                fullMatch.split("--");

            let fixedFileName = fileName;

            if (fileName === "Outpost_Mapobject_Special_Sand") {
                fixedFileName =
                    "Outpost_Mapobject_Special_Sand_8_2_0_Icon";
            }

            const path =
                folderBuilder(fixedFileName, suffix);

            const url =
                `${base}${path}.webp`;

            ensure(normalized);

            if (
                keyName === "castleUrl" ||
                keyName === "capitalUrl" ||
                keyName === "metroUrl" ||
                keyName === "outpostUrl"
            ) {
                map[normalized]
                    .mapObjects[keyName] = url;
            }
            else {
                map[normalized]
                    .movements[keyName] = url;
            }
        }

        if (regex.source.includes("Castle_Mapobject")) {

            const key =
                normalize("Underworld");

            ensure(key);

            map[key].mapObjects.castleUrl =
                `${BASE}Worldmap/WorldmapObjects/Castles/Underworld_Special/Castle_Mapobject_Special_Underworld_5/Castle_Mapobject_Special_Underworld_5--1573584429307.webp`;
        }
    }

    addMatch(
        /Castle_Mapobject_Special_([A-Za-z0-9]+)--\d+/g,
        "castleUrl",
        (file, suffix) =>
            `Worldmap/WorldmapObjects/Castles/${file}/${file}--${suffix}`
    );

    addMatch(
        /Outpost_Mapobject_Special_([A-Za-z0-9]+)--\d+/g,
        "outpostUrl",
        (file, suffix) =>
            `Worldmap/WorldmapObjects/Outposts/${file}/${file}--${suffix}`
    );

    addMatch(
        /Metropol_Mapobject_Special_([A-Za-z0-9]+)--\d+/g,
        "metroUrl",
        (file, suffix) =>
            `Worldmap/WorldmapObjects/Landmarks/${file}/${file}--${suffix}`
    );

    addMatch(
        /Capital_Mapobject_Special_([A-Za-z0-9]+)--\d+/g,
        "capitalUrl",
        (file, suffix) =>
            `Worldmap/WorldmapObjects/Landmarks/${file}/${file}--${suffix}`
    );

    addMatch(
        /Skin_Mapmovement_([A-Za-z0-9]+)_Common--\d+/g,
        "moveNormal",
        (file, suffix) =>
            `Worldmap/WorldmapObjects/Movements/Skins/${file}/${file}--${suffix}`
    );

    addMatch(
        /Skin_Mapmovement_([A-Za-z0-9]+)_Eiland--\d+/g,
        "moveBoat",
        (file, suffix) =>
            `Worldmap/WorldmapObjects/Movements/Skins/${file}/${file}--${suffix}`
    );

    return map;
}

function parseGenerals(text) {

    const base =
        ASSET_ROOT;

    const portraits = {};
    const abilities = {};

    const portraitRegex =
        /itemassets\/General\/Portrait\/GeneralPortrait_(\d+)\/GeneralPortrait_\1--\d+/g;
    const generalIconRegex =
        /itemassets\/Dialogs\/Generals\/GeneralIcons\/GeneralIcon_(\d+)\/GeneralIcon_\1--\d+/g;

    for (const m of text.matchAll(portraitRegex)) {

        const id = m[1];
        portraits[id] =
            `${base}${m[0]}.webp`;
    }

    for (const m of text.matchAll(generalIconRegex)) {

        const id = m[1];
        portraits[id] =
            `${base}${m[0]}.webp`;
    }

    const abilityRegex =
        /itemassets\/General\/Abilities\/GeneralsAbilityGroup_(\d+)\/GeneralsAbilityGroup_\1--\d+/g;

    for (const m of text.matchAll(abilityRegex)) {

        const id = m[1];
        abilities[id] =
            `${base}${m[0]}.webp`;
    }

    return {
        portraits,
        abilities
    };
}

function parseLootBoxes(text, normalize) {

    const regex =
        /Collectables\/(?:[^\/]+\/)?Collectable_(?!Currency_)[^\s"'`<>]+?--\d+/g;

    const map = {};

    for (const m of text.matchAll(regex)) {

        const file =
            m[0].split("/").pop();

        const clean =
            normalize(
                file
                    .split("--")[0]
                    .replace(/^Collectable_/, "")
            );

        map[clean] =
            `${BASE}${m[0]}.webp`;
    }

    return map;
}

function parseEquipmentUniques(text) {

    const equipmentRegex =
        /Equipment\/Uniques\/Item_Unique_(\d+)\/Item_Unique_\1--\d+/g;
    const heroRegex =
        /Equipment\/Heroes\/Hero_Unique_(\d+)\/Hero_Unique_\1--\d+/g;
    const uniqueHeroRegex =
        /Equipment\/Uniques\/Hero_Unique_(\d+)\/Hero_Unique_\1--\d+/g;

    const map = {};

    for (const m of text.matchAll(equipmentRegex)) {
        const id = String(m[1]);
        map[id] = `${BASE}${m[0]}.webp`;
    }

    for (const m of text.matchAll(heroRegex)) {
        const id = String(m[1]);
        map[id] = `${BASE}${m[0]}.webp`;
    }

    for (const m of text.matchAll(uniqueHeroRegex)) {
        const id = String(m[1]);
        map[id] = `${BASE}${m[0]}.webp`;
    }

    return map;
}

function parseUniqueGems(text) {

    const regex =
        /Equipment\/UniqueGems\/Item_Gem_Unique_(\d+)\/Item_Gem_Unique_\1--\d+/g;

    const map = {};

    for (const m of text.matchAll(regex)) {
        const id = String(m[1]);
        map[id] = `${BASE}${m[0]}.webp`;
    }

    return map;
}

function parseAllianceLayouts(text) {

    const regex =
        /Collectables\/allianceLayout\/Collectable_AllianceLayout_(\d+)\/Collectable_AllianceLayout_\1--\d+/g;

    const map = {};

    for (const m of text.matchAll(regex)) {
        const id = String(m[1]);
        map[id] = `${BASE}${m[0]}.webp`;
    }

    return map;
}

function parseLegendSkills(text) {

    const regex =
        /Dialogs\/legend\/SkillIcons\/LegendSkill_(\d+)\/LegendSkill_\1--\d+/g;

    const map = {};

    for (const m of text.matchAll(regex)) {
        const id = String(m[1]);
        map[id] = `${BASE}${m[0]}.webp`;
    }

    return map;
}

export async function loadImageMaps({
    decorations = false,
    constructions = false,
    units = false,
    currencies = false,
    looks = false,
    equipmentUniques = false,
    uniqueGems = false,
    generals = false,
    lootboxes = false,
    allianceLayouts = false,
    legendSkills = false,
    buildings = false,
    normalizeNameFn
}) {

    const text =
        await getDllText();

    const result = {};

    if (decorations) {

        parsedCache.decorations ??=
            parseDecorations(text, normalizeNameFn);

        result.decorations =
            parsedCache.decorations;
    }


    if (constructions) {

        parsedCache.constructions ??=
            parseConstructions(text, normalizeNameFn);

        result.constructions =
            parsedCache.constructions;
    }


    if (units) {

        parsedCache.units ??=
            parseUnits(text, normalizeNameFn);

        result.units =
            parsedCache.units;
    }


    if (currencies) {

        parsedCache.currencies ??=
            parseCurrencies(text, normalizeNameFn);

        result.currencies =
            parsedCache.currencies;
    }

    if (looks) {

        parsedCache.looks ??=
            parseLooks(text, normalizeNameFn);

        result.looks =
            parsedCache.looks;
    }

    if (equipmentUniques) {

        parsedCache.equipmentUniques ??=
            parseEquipmentUniques(text);

        result.equipmentUniques =
            parsedCache.equipmentUniques;
    }

    if (uniqueGems) {

        parsedCache.uniqueGems ??=
            parseUniqueGems(text);

        result.uniqueGems =
            parsedCache.uniqueGems;
    }

    if (generals) {

        parsedCache.generals ??=
            parseGenerals(text);

        result.generals =
            parsedCache.generals;
    }

    if (lootboxes) {

        parsedCache.lootboxes ??=
            parseLootBoxes(text, normalizeNameFn);

        result.lootboxes =
            parsedCache.lootboxes;
    }

    if (allianceLayouts) {

        parsedCache.allianceLayouts ??=
            parseAllianceLayouts(text);

        result.allianceLayouts =
            parsedCache.allianceLayouts;
    }

    if (legendSkills) {

        parsedCache.legendSkills ??=
            parseLegendSkills(text);

        result.legendSkills =
            parsedCache.legendSkills;
    }

    if (buildings) {

        parsedCache.buildings ??=
            parseBuildings(text, normalizeNameFn);

        result.buildings =
            parsedCache.buildings;
    }

    return result;
}
