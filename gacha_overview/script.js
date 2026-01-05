// --- PROXY AND GLOBAL VARIABLES ---
const myProxy = "https://my-proxy-8u49.onrender.com/";
const fallbackProxy = "https://corsproxy.io/?";

let lang = {};
let itemsData = null;
let gachaEvents = [];
let rewardsById = {};
let currenciesById = {};
let equipmentById = {};
let constructionById = {};
let decorationsById = {};
let unitsById = {};

// --- FETCH FUNCTIONS (WITH FALLBACK) ---
async function fetchWithFallback(url, timeout = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(myProxy + url, { signal: controller.signal });
        if (!response.ok) throw new Error("myProxy: bad response");
        return response;
    } catch (err) {
        console.warn("Proxy error:", err);

        const encodedUrl = encodeURIComponent(url);
        const fallbackResponse = await fetch(fallbackProxy + encodedUrl);
        if (!fallbackResponse.ok) throw new Error("fallbackProxy: bad response");
        return fallbackResponse;
    } finally {
        clearTimeout(timer);
    }
}

async function getItemVersion() {
    const url = "https://empire-html5.goodgamestudios.com/default/items/ItemsVersion.properties";
    const res = await fetchWithFallback(url);
    const text = await res.text();
    const match = text.match(/CastleItemXMLVersion=(\d+\.\d+)/);
    if (!match) throw new Error("Version: error");
    return match[1];
}

async function getLangVersion() {
    const url = "https://langserv.public.ggs-ep.com/12/fr/@metadata";
    const res = await fetchWithFallback(url);
    const json = await res.json();
    return json["@metadata"].versionNo;
}

async function getLanguageData(version) {
    const url = `https://langserv.public.ggs-ep.com/12@${version}/en/*`;
    const res = await fetchWithFallback(url);
    const data = await res.json();
    lang = lowercaseKeysRecursive(data);
}

async function getItems(version) {
    const url = `https://empire-html5.goodgamestudios.com/default/items/items_v${version}.json`;
    const res = await fetchWithFallback(url);
    return res.json();
}

function lowercaseKeysRecursive(input) {
    if (input === null || input === undefined) return input;
    if (Array.isArray(input)) return input.map(lowercaseKeysRecursive);
    if (typeof input === "object") {
        const out = {};
        Object.keys(input).forEach(key => {
            const lowerKey = key.toString().toLowerCase();
            out[lowerKey] = lowercaseKeysRecursive(input[key]);
        });
        return out;
    }
    return input;
}

// --- DATA HELPERS ---
function getArray(data, names) {
    for (const name of names) {
        if (Array.isArray(data[name])) return data[name];
    }
    return [];
}

function getProp(obj, names) {
    for (const name of names) {
        if (obj[name] !== undefined && obj[name] !== null) return obj[name];
    }
    return null;
}

function buildLookup(array, idKey) {
    const map = {};
    array.forEach(item => {
        if (!item) return;
        const id = item[idKey];
        if (id !== undefined && id !== null) {
            map[String(id)] = item;
        }
    });
    return map;
}

function buildDecorationLookup(items) {
    const map = {};
    items.forEach(item => {
        if (!item) return;
        const wodId = item.wodID;
        if (wodId !== undefined && wodId !== null) {
            map[String(wodId)] = item;
        }
    });
    return map;
}

function parseCsvIds(value) {
    if (!value) return [];
    return String(value)
        .split(",")
        .map(v => v.trim())
        .filter(Boolean);
}

function parseIdAmountToken(token) {
    const trimmed = String(token || "").trim();
    if (!trimmed) return [];
    const parts = trimmed.split("#");
    const primary = parts[0];
    const results = [];

    const [idPart, amountPart] = primary.split("+");
    const primaryId = Number(idPart);
    if (!Number.isNaN(primaryId)) {
        let amount = 1;
        if (amountPart) {
            const parsed = Number(amountPart);
            if (!Number.isNaN(parsed)) amount = parsed;
        }
        results.push({ id: primaryId, amount });
    }

    for (let i = 1; i < parts.length; i++) {
        const extraId = Number(parts[i]);
        if (!Number.isNaN(extraId)) {
            results.push({ id: extraId, amount: 1 });
        }
    }

    return results;
}

function parseUnitReward(value) {
    if (!value) return null;
    const [idPart, amountPart] = String(value).split("+");
    const unitId = Number(idPart);
    const amount = Number(amountPart);
    return {
        unitId: Number.isNaN(unitId) ? null : unitId,
        amount: Number.isNaN(amount) ? null : amount
    };
}

// --- NAME HELPERS ---
function getCIName(item) {
    if (!item) return null;
    const rawName = (item.name || "???").toLowerCase();
    const prefixes = ["appearance", "primary", "secondary"];
    const suffixes = ["", "_premium"];

    for (const prefix of prefixes) {
        for (const suffix of suffixes) {
            const key = `ci_${prefix}_${rawName}${suffix}`.toLowerCase();
            if (lang[key]) return lang[key];
        }
    }

    const keysToTry = [
        ...suffixes.map(s => `ci_${rawName}${s}`),
        rawName
    ];

    for (const key of keysToTry) {
        const lower = key.toLowerCase();
        if (lang[lower]) return lang[lower];
    }

    return item.name || null;
}

function getLangByPrefixes(rawName, prefixes) {
    if (!rawName) return null;
    const lowerName = rawName.toLowerCase();
    for (const prefix of prefixes) {
        const key = `${prefix}${lowerName}`.toLowerCase();
        if (lang[key]) return lang[key];
    }
    return null;
}

function getDecorationName(item) {
    if (!item) return null;
    const rawType = item.type || item.Type;
    const lowerType = rawType ? rawType.toLowerCase() : "";
    if (lowerType) {
        const key = `deco_${lowerType}_name`;
        if (lang[key]) return lang[key];
    }
    const rawName = item.name || item.Name;
    return getLangByPrefixes(rawName, ["decoration_name_", "deco_name_", "decoration_"]) || rawName || null;
}

function resolveRewardName(reward) {
    if (!reward) return null;

    if (reward.units) {
        const parsed = parseUnitReward(reward.units);
        if (parsed && parsed.unitId !== null) {
            const unit = unitsById[String(parsed.unitId)];
            const rawType = unit ? (unit.type || unit.name || unit.Name) : null;
            if (rawType) {
                const langKey = `${rawType}_name`.toLowerCase();
                if (lang[langKey]) return lang[langKey];
                return rawType;
            }
            return `Unit ${parsed.unitId}`;
        }
    }

    const addKey = Object.keys(reward).find(key => key.toLowerCase().startsWith("add"));
    if (addKey) {
        const rawName = addKey.slice(3);
        if (rawName) {
            const langKey = `currency_name_${rawName}`.toLowerCase();
            if (lang[langKey]) return lang[langKey];
        }
    }

    const currencyId = getProp(reward, ["currencyID", "currencyId", "currencyid"]);
    if (currencyId) {
        const currency = currenciesById[String(currencyId)];
        if (currency) {
            const rawName = currency.Name || currency.name;
            const langKey = rawName ? `currency_name_${rawName}`.toLowerCase() : null;
            if (langKey && lang[langKey]) return lang[langKey];
            if (rawName) return rawName;
        }
        return `Currency ${currencyId}`;
    }

    const constructionId = getProp(reward, ["constructionItemID", "constructionItemId", "constructionitemid"]);
    const constructionIds = getProp(reward, ["constructionItemIDs", "constructionItemIds", "constructionitemids"]);
    if (constructionId) {
        const item = constructionById[String(constructionId)];
        const name = getCIName(item);
        const baseName = name || "Construction item";
        return `${baseName} (${constructionId})`;
    }
    if (constructionIds) {
        const ids = parseCsvIds(constructionIds);
        const firstId = ids[0];
        const item = firstId ? constructionById[String(firstId)] : null;
        const name = getCIName(item);
        const baseName = name || "Construction item";
        return firstId ? `${baseName} (${firstId})` : null;
    }

    const equipmentId = getProp(reward, ["equipmentID", "equipmentId", "equipmentid"]);
    const equipmentIds = getProp(reward, ["equipmentIDs", "equipmentIds", "equipmentids"]);
    if (equipmentId) {
        const item = equipmentById[String(equipmentId)];
        const rawName = item ? (item.name || item.Name) : null;
        const langName = getLangByPrefixes(rawName, ["equip_name_", "equipment_name_", "equip_"]);
        if (langName) return langName;
        if (rawName) return rawName;
        return `Equipment ${equipmentId}`;
    }
    if (equipmentIds) {
        const ids = parseCsvIds(equipmentIds);
        const firstId = ids[0];
        const langKey = firstId ? `equipment_unique_${firstId}`.toLowerCase() : null;
        if (langKey && lang[langKey]) return lang[langKey];
        return firstId ? `Equipment ${firstId}` : null;
    }

    const decoId = getProp(reward, ["decoWODID", "decoWodID", "decowodid"]);
    if (decoId) {
        const item = decorationsById[String(decoId)];
        const decoName = getDecorationName(item);
        const finalName = decoName || "Decoration";
        return `${finalName} (${decoId})`;
    }

    return null;
}

function resolveRewardEntries(reward) {
    if (!reward || typeof reward !== "object") return [];
    const entries = [];

    if (reward.units) {
        const parsed = parseUnitReward(reward.units);
        if (parsed && parsed.unitId !== null) {
            const unit = unitsById[String(parsed.unitId)];
            const rawType = unit ? (unit.type || unit.name || unit.Name) : null;
            let name = rawType || `Unit ${parsed.unitId}`;
            if (rawType) {
                const langKey = `${rawType}_name`.toLowerCase();
                if (lang[langKey]) name = lang[langKey];
            }
            entries.push({ name, amount: parsed.amount !== null ? parsed.amount : 1 });
        }
    }

    const addKey = Object.keys(reward).find(key => key.toLowerCase().startsWith("add"));
    if (addKey) {
        const rawName = addKey.slice(3);
        if (rawName) {
            const langKey = `currency_name_${rawName}`.toLowerCase();
            const name = lang[langKey] || rawName;
            const val = Number(reward[addKey]);
            entries.push({ name, amount: Number.isNaN(val) ? 1 : val });
        }
    }

    const currencyId = getProp(reward, ["currencyID", "currencyId", "currencyid"]);
    if (currencyId) {
        const currency = currenciesById[String(currencyId)];
        const rawName = currency ? (currency.Name || currency.name) : null;
        const langKey = rawName ? `currency_name_${rawName}`.toLowerCase() : null;
        const name = (langKey && lang[langKey]) ? lang[langKey] : (rawName || `Currency ${currencyId}`);
        entries.push({ name, amount: 1 });
    }

    const constructionId = getProp(reward, ["constructionItemID", "constructionItemId", "constructionitemid"]);
    if (constructionId) {
        const item = constructionById[String(constructionId)];
        const baseName = getCIName(item) || "Construction item";
        entries.push({ name: `${baseName} (${constructionId})`, amount: 1 });
    }

    const constructionIds = getProp(reward, ["constructionItemIDs", "constructionItemIds", "constructionitemids"]);
    if (constructionIds) {
        const tokens = parseCsvIds(constructionIds);
        tokens.forEach(token => {
            const parsedItems = parseIdAmountToken(token);
            parsedItems.forEach(parsed => {
                const item = constructionById[String(parsed.id)];
                const baseName = getCIName(item) || "Construction item";
                entries.push({ name: `${baseName} (${parsed.id})`, amount: parsed.amount });
            });
        });
    }

    const equipmentId = getProp(reward, ["equipmentID", "equipmentId", "equipmentid"]);
    if (equipmentId) {
        const item = equipmentById[String(equipmentId)];
        const rawName = item ? (item.name || item.Name) : null;
        const langName = getLangByPrefixes(rawName, ["equip_name_", "equipment_name_", "equip_"]);
        entries.push({ name: langName || rawName || `Equipment ${equipmentId}`, amount: 1 });
    }

    const equipmentIds = getProp(reward, ["equipmentIDs", "equipmentIds", "equipmentids"]);
    if (equipmentIds) {
        const tokens = parseCsvIds(equipmentIds);
        tokens.forEach(token => {
            const parsedItems = parseIdAmountToken(token);
            parsedItems.forEach(parsed => {
                const langKey = `equipment_unique_${parsed.id}`.toLowerCase();
                const name = (lang[langKey]) ? lang[langKey] : `Equipment ${parsed.id}`;
                entries.push({ name, amount: parsed.amount });
            });
        });
    }

    const decoId = getProp(reward, ["decoWODID", "decoWodID", "decowodid"]);
    if (decoId) {
        const item = decorationsById[String(decoId)];
        const decoName = getDecorationName(item) || "Decoration";
        entries.push({ name: `${decoName} (${decoId})`, amount: 1 });
    }

    return entries;
}

function getRewardAmount(reward) {
    if (!reward || typeof reward !== "object") return 1;
    if (reward.units) {
        const parsed = parseUnitReward(reward.units);
        if (parsed && parsed.amount !== null) return parsed.amount;
    }
    for (const key of Object.keys(reward)) {
        if (key.toLowerCase().includes("add")) {
            const val = Number(reward[key]);
            return Number.isNaN(val) ? 1 : val;
        }
    }
    return 1;
}

function formatPercent(value) {
    if (!Number.isFinite(value)) return "0%";
    const rounded = Math.round(value * 100) / 100;
    return `${rounded.toFixed(rounded % 1 === 0 ? 0 : 2)}%`;
}

function formatNumber(value) {
    return Number(value).toLocaleString();
}

// --- UI RENDERING ---
function setLoadingProgress(step, totalSteps, text) {
    const status = document.getElementById("loadingStatus");
    const bar = document.getElementById("loadingProgress");
    const percentText = document.getElementById("loadingPercentText");

    if (!status || !bar || !percentText) return;

    const targetPercent = Math.round((step / totalSteps) * 100);
    status.textContent = text;

    let currentPercent = parseInt(bar.style.width, 10) || 0;
    const interval = setInterval(() => {
        if (currentPercent >= targetPercent) {
            clearInterval(interval);
            return;
        }
        currentPercent++;
        bar.style.width = currentPercent + "%";
        percentText.textContent = currentPercent + "%";
    }, 25);
}

function getEventLabel(event) {
    if (!event) return "Unknown event";
    const eventId = event.eventID;
    const titleKey = `event_title_${eventId}`.toLowerCase();
    const titleName = lang[titleKey];
    const eventType = event.eventType || event.EventType;
    const tooltipKey = eventType ? `tooltip_gachaName_${eventType}`.toLowerCase() : null;
    const tooltipName = tooltipKey ? lang[tooltipKey] : null;
    const name = titleName || tooltipName || event.comment1 || event.comment2 || "Event";
    return name;
}

function setupSelectors() {
    const eventSelect = document.getElementById("eventSelect");
    const setSelect = document.getElementById("setSelect");
    const levelSelect = document.getElementById("levelSelect");

    const events = getArray(itemsData, ["events"]);
    const gachaList = getArray(itemsData, ["gachaEvents", "gachaevents"]);
    gachaEvents = gachaList;

    const eventIds = new Set(gachaList.map(e => String(getProp(e, ["eventID", "eventId", "eventid"]))));
    const availableEvents = events.filter(e => eventIds.has(String(e.eventID)));

    availableEvents.sort((a, b) => getEventLabel(a).localeCompare(getEventLabel(b)));

    eventSelect.innerHTML = "";
    if (availableEvents.length === 0) {
        eventSelect.innerHTML = `<option value="" selected>No gacha events found</option>`;
        setSelect.innerHTML = `<option value="" selected>No sets</option>`;
        levelSelect.innerHTML = `<option value="" selected>No levels</option>`;
        renderRewards([]);
        return;
    }

    availableEvents.forEach(event => {
        const option = document.createElement("option");
        option.value = String(event.eventID);
        option.textContent = getEventLabel(event);
        eventSelect.appendChild(option);
    });

    eventSelect.addEventListener("change", () => {
        updateSetOptions();
        updateLevelOptions();
        renderRewardsForSelection();
    });

    setSelect.addEventListener("change", () => {
        updateLevelOptions();
        renderRewardsForSelection();
    });

    levelSelect.addEventListener("change", () => {
        renderRewardsForSelection();
    });

    eventSelect.value = String(availableEvents[0].eventID);
    updateSetOptions();
    updateLevelOptions();
    renderRewardsForSelection();
}

function updateSetOptions() {
    const eventSelect = document.getElementById("eventSelect");
    const setSelect = document.getElementById("setSelect");
    const eventId = eventSelect.value;

    const sets = gachaEvents
        .filter(e => String(getProp(e, ["eventID", "eventId", "eventid"])) === String(eventId))
        .map(e => String(getProp(e, ["rewardSetID", "rewardSetId", "rewardsetid"]) || ""))
        .filter(v => v !== "");

    const uniqueSets = Array.from(new Set(sets)).sort((a, b) => Number(a) - Number(b));

    setSelect.innerHTML = "";
    if (uniqueSets.length === 0) {
        setSelect.innerHTML = `<option value="" selected>No versions</option>`;
        setSelect.disabled = true;
        return;
    }

    const latestSet = uniqueSets[uniqueSets.length - 1];
    const hasMultiple = uniqueSets.length > 1;
    uniqueSets.forEach(setId => {
        const option = document.createElement("option");
        option.value = String(setId);
        if (!hasMultiple) {
            option.textContent = "Latest version";
        } else {
            const suffix = setId !== latestSet ? " (old)" : "";
            option.textContent = setId === latestSet ? "Latest version" : `Version ${setId}${suffix}`;
        }
        setSelect.appendChild(option);
    });

    setSelect.value = String(latestSet);
    setSelect.disabled = uniqueSets.length === 1;
}

function updateLevelOptions() {
    const eventSelect = document.getElementById("eventSelect");
    const setSelect = document.getElementById("setSelect");
    const levelSelect = document.getElementById("levelSelect");
    const eventId = eventSelect.value;
    const setId = setSelect.value;

    const levels = gachaEvents
        .filter(e => {
            const eventMatch = String(getProp(e, ["eventID", "eventId", "eventid"])) === String(eventId);
            const setMatch = String(getProp(e, ["rewardSetID", "rewardSetId", "rewardsetid"]) || "") === String(setId);
            return eventMatch && setMatch;
        })
        .map(e => Number(getProp(e, ["gachaLevel", "gachaLevelID", "gachalevel"])))
        .filter(n => !Number.isNaN(n));

    const uniqueLevels = Array.from(new Set(levels)).sort((a, b) => a - b);

    levelSelect.innerHTML = "";
    if (uniqueLevels.length === 0) {
        levelSelect.innerHTML = `<option value="" selected>No levels</option>`;
        return;
    }

    uniqueLevels.forEach(level => {
        const option = document.createElement("option");
        option.value = String(level);
        option.textContent = `Level ${level}`;
        levelSelect.appendChild(option);
    });

    const topOption = document.createElement("option");
    topOption.value = "top";
    topOption.textContent = "TOP rewards";
    levelSelect.appendChild(topOption);

    levelSelect.value = String(uniqueLevels[0]);
}

function renderRewardsForSelection() {
    const eventSelect = document.getElementById("eventSelect");
    const setSelect = document.getElementById("setSelect");
    const levelSelect = document.getElementById("levelSelect");
    const eventId = eventSelect.value;
    const setId = setSelect.value;
    const level = levelSelect.value;

    if (!eventId || !setId || !level) {
        renderRewards([]);
        return;
    }

    if (level === "top") {
        renderTopRewardsForSelection(eventId, setId);
        return;
    }

    const gachaEvent = gachaEvents.find(e => {
        const eventMatch = String(getProp(e, ["eventID", "eventId", "eventid"])) === String(eventId);
        const setMatch = String(getProp(e, ["rewardSetID", "rewardSetId", "rewardsetid"]) || "") === String(setId);
        const levelMatch = String(getProp(e, ["gachaLevel", "gachaLevelID", "gachalevel"])) === String(level);
        return eventMatch && setMatch && levelMatch;
    });

    if (!gachaEvent) {
        renderRewards([]);
        return;
    }

    const tombolaId = String(getProp(gachaEvent, ["lootBoxTombolaID", "lootBoxTombolaId", "lootboxtombolaid"]));
    const tombolas = getArray(itemsData, ["lootBoxTombolas", "lootboxtombolas"]);

    const rewardIds = [];
    const rewardShares = {};
    const rewardMeta = {};
    let totalShares = 0;
    tombolas.forEach(tombola => {
        const tombolaMatch = String(getProp(tombola, ["tombolaID", "tombolaId", "tombolaid"])) === tombolaId;
        if (!tombolaMatch) return;
        const ids = parseCsvIds(getProp(tombola, ["rewardIDs", "rewardIds", "rewardids"]));
        const rarity = Number(getProp(tombola, ["rewardCategory", "rewardcategory"]));
        const tombolaNumeric = Number(getProp(tombola, ["tombolaID", "tombolaId", "tombolaid"]));
        const shares = Number(getProp(tombola, ["shares", "share", "Share", "Shares"]));
        const shareValue = Number.isNaN(shares) ? 0 : shares;
        totalShares += shareValue;
        rewardIds.push(...ids);
        ids.forEach(id => {
            rewardShares[id] = (rewardShares[id] || 0) + shareValue;
            if (!rewardMeta[id]) {
                rewardMeta[id] = {
                    rarity: Number.isNaN(rarity) ? 0 : rarity,
                    tombolaId: Number.isNaN(tombolaNumeric) ? 0 : tombolaNumeric
                };
            }
        });
    });

    const rewards = [];
    const seen = new Set();
    const uniqueRewardIds = Array.from(new Set(rewardIds));
    uniqueRewardIds.sort((a, b) => {
        const metaA = rewardMeta[a] || { rarity: 0, tombolaId: 0 };
        const metaB = rewardMeta[b] || { rarity: 0, tombolaId: 0 };
        if (metaA.rarity !== metaB.rarity) return metaA.rarity - metaB.rarity;
        return metaA.tombolaId - metaB.tombolaId;
    });

    uniqueRewardIds.forEach(id => {
        const reward = rewardsById[String(id)];
        const name = resolveRewardName(reward) || `Reward ${id}`;
        const amount = getRewardAmount(reward);
        const percent = totalShares > 0 ? (rewardShares[id] / totalShares) * 100 : 0;
        const key = `${name}::${amount}::${percent}`;
        if (!seen.has(key)) {
            seen.add(key);
            rewards.push({ name, amount, chanceText: formatPercent(percent) });
        }
    });

    renderRewards(rewards);
}

function renderRewards(rewards) {
    const container = document.getElementById("rewardRows");
    container.innerHTML = "";

    if (!rewards || rewards.length === 0) {
        const emptyCol = document.createElement("div");
        emptyCol.className = "col-12";
        emptyCol.innerHTML = `
      <div class="box">
        <div class="box-content d-flex align-items-center px-2 py-1">
          <p class="mb-0">No rewards for this selection.</p>
        </div>
      </div>`;
        container.appendChild(emptyCol);
        return;
    }

    rewards.forEach(reward => {
        const col = document.createElement("div");
        col.className = "col-12 col-md-6 d-flex";
        const amountText = formatNumber(reward.amount);
        const chanceText = reward.chanceText || "";
        col.innerHTML = `
      <div class="box flex-fill">
        <div class="box-content">
          <h2 class="ci-title">${reward.name}</h2>
          <div class="card-table border-top">
            <div class="row g-0">
              <div class="col-6 card-cell border-end d-flex flex-column justify-content-center">
                <strong>Amount</strong>
                <div>${amountText}</div>
              </div>
              <div class="col-6 card-cell d-flex flex-column justify-content-center">
                <strong>Chance</strong>
                <div>${chanceText}</div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
        container.appendChild(col);
    });
}

function renderTopRewardsForSelection(eventId, setId) {
    const leagueEvents = getArray(itemsData, ["leaguetypeevents", "leagueTypeEvents", "leagueTypeevents"]);
    const matching = leagueEvents.filter(e => {
        const eventMatch = String(getProp(e, ["eventID", "eventId", "eventid"])) === String(eventId);
        const setMatch = String(getProp(e, ["rewardSetID", "rewardSetId", "rewardsetid"]) || "") === String(setId);
        return eventMatch && setMatch;
    });
    let entry = null;

    if (matching.length === 1) {
        entry = matching[0];
    } else if (matching.length > 1) {
        entry = matching[0];
    }

    if (!entry) {
        renderRewards([]);
        return;
    }

    const rewardIds = parseCsvIds(getProp(entry, ["rewardIDs", "rewardIds", "rewardids"]));
    const topValuesRaw = parseCsvIds(getProp(entry, ["topXValue", "topxvalue"]));
    const topValues = topValuesRaw.map(v => Number(v)).filter(v => !Number.isNaN(v));
    topValues.push(1);
    const tiers = Array.from(new Set(topValues)).sort((a, b) => a - b);

    const topRewardIds = rewardIds.slice(-tiers.length);
    const rewards = [];
    const seen = new Set();

    tiers.forEach((tier, index) => {
        const rewardId = topRewardIds[topRewardIds.length - 1 - index];
        const reward = rewardsById[String(rewardId)];
        const entries = resolveRewardEntries(reward);
        if (entries.length === 0) {
            const name = resolveRewardName(reward) || `Reward ${rewardId}`;
            const amount = getRewardAmount(reward);
            const key = `${name}::${amount}::${tier}`;
            if (!seen.has(key)) {
                seen.add(key);
                rewards.push({ name, amount, chanceText: `TOP${tier}` });
            }
            return;
        }
        entries.forEach(entry => {
            const key = `${entry.name}::${entry.amount}::${tier}`;
            if (!seen.has(key)) {
                seen.add(key);
                rewards.push({ name: entry.name, amount: entry.amount, chanceText: `TOP${tier}` });
            }
        });
    });

    renderRewards(rewards);
}

// --- INITIALIZATION ---
function handleResize() {
    const note = document.querySelector(".note");
    const pageTitle = document.querySelector(".page-title");
    const content = document.getElementById("content");

    if (note && pageTitle && content) {
        const totalHeightToSubtract = note.offsetHeight + pageTitle.offsetHeight + 18;
        const newHeight = window.innerHeight - totalHeightToSubtract;
        content.style.height = `${newHeight}px`;
    }
}

window.addEventListener("resize", handleResize);
window.addEventListener("DOMContentLoaded", handleResize);

async function init() {
    try {
        const totalSteps = 4;
        let step = 0;

        setLoadingProgress(++step, totalSteps, "Checking item version...");
        const itemVersion = await getItemVersion();
        console.log(`Item version: ${itemVersion}`);

        setLoadingProgress(++step, totalSteps, "Checking language version...");
        const langVersion = await getLangVersion();
        console.log(`Language version: ${langVersion}`);

        setLoadingProgress(++step, totalSteps, "Loading language data...");
        await getLanguageData(langVersion);

        setLoadingProgress(++step, totalSteps, "Loading items...");
        itemsData = await getItems(itemVersion);

        const rewards = getArray(itemsData, ["rewards"]);
        const currencies = getArray(itemsData, ["currencies"]);
        const equipment = getArray(itemsData, ["equipmentItems", "equipmentitems"]);
        const constructions = getArray(itemsData, ["constructionItems", "constructionitems"]);
        const decorations = getArray(itemsData, ["decorations", "decorationItems", "decorationitems"]);
        const units = getArray(itemsData, ["units", "Units"]);
        const buildings = getArray(itemsData, ["buildings", "Buildings"]);

        rewardsById = buildLookup(rewards, "rewardID");
        currenciesById = buildLookup(currencies, "currencyID");
        equipmentById = buildLookup(equipment, "equipmentID");
        constructionById = buildLookup(constructions, "constructionItemID");
        decorationsById = buildLookup(decorations, "decoWODID");
        unitsById = buildLookup(units, "wodID");
        if (buildings.length > 0) {
            const decoBuildings = buildings.filter(b => {
                const name = (b.name || "").toString().toLowerCase();
                const ground = (b.buildingGroundType || "").toString().toLowerCase();
                return name === "deco" || ground === "deco";
            });
            decorationsById = { ...buildDecorationLookup(decoBuildings), ...decorationsById };
        }

        setupSelectors();

        const loadingBox = document.getElementById("loadingBox");
        if (loadingBox) loadingBox.style.display = "none";

    } catch (err) {
        console.error("Error:", err);
        const loadingBox = document.getElementById("loadingBox");
        if (loadingBox) {
            loadingBox.innerHTML = `
        <h3>Something went wrong...</h3>
        <p>The page will automatically reload in <span id="retryCountdown">30</span> seconds!</p>
      `;

            let seconds = 30;
            const countdownEl = document.getElementById("retryCountdown");
            const interval = setInterval(() => {
                seconds--;
                if (countdownEl) countdownEl.textContent = seconds.toString();
                if (seconds <= 0) {
                    clearInterval(interval);
                    location.reload();
                }
            }, 1000);
        }
    }
}

init();
