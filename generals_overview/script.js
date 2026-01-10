// ================== CONFIG ==================
const myProxy = "https://my-proxy-8u49.onrender.com/";
const fallbackProxy = "https://corsproxy.io/?";

let lang = {};
let itemsData = null;

// lookups
let generalsById = {};
let skillsByGeneral = {};
let raritiesById = {};
let abilitiesByGroupId = {};

// images
let dllTextCache = "";
let generalPortraitMap = {};
let abilityIconMap = {};

const skillTypeMap = {
    CourtyardSize: "defense",
    ReinforcementWave: "attack",
    UnitAmountWall: "defense",
    defenseBoostYard: "defense",
    DefenseBoostFlank: "defense",
    DefenseBoostFront: "defense",
    AttackBoostFlank: "attack",
    AttackBoostFront: "attack",
    additionalWaves: "attack",
    UnitAmountFlank: "attack",
    UnitAmountFront: "attack",
    BonusPowerYard: "attack",
};

const fallbackIconMap = {
    attack: "./img/attack-icon.webp",
    defense: "./img/defense-icon.webp",
};

// ================== FETCH ==================
async function fetchWithFallback(url, timeout = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch(myProxy + url, { signal: controller.signal });
        if (!res.ok) throw new Error("proxy fail");
        return res;
    } catch {
        const res = await fetch(fallbackProxy + encodeURIComponent(url));
        if (!res.ok) throw new Error("fallback fail");
        return res;
    } finally {
        clearTimeout(timer);
    }
}

async function getItemVersion() {
    const url =
        "https://empire-html5.goodgamestudios.com/default/items/ItemsVersion.properties";
    const txt = await (await fetchWithFallback(url)).text();
    return txt.match(/CastleItemXMLVersion=(\d+\.\d+)/)[1];
}

async function getLangVersion() {
    const url = "https://langserv.public.ggs-ep.com/12/en/@metadata";
    return (await (await fetchWithFallback(url)).json())["@metadata"].versionNo;
}

async function getLanguageData(version) {
    const url = `https://langserv.public.ggs-ep.com/12@${version}/en/*`;
    lang = lowercaseKeysRecursive(await (await fetchWithFallback(url)).json());
}

async function getItems(version) {
    const url = `https://empire-html5.goodgamestudios.com/default/items/items_v${version}.json`;
    return (await fetchWithFallback(url)).json();
}

// ================== HELPERS ==================
function lowercaseKeysRecursive(o) {
    if (Array.isArray(o)) return o.map(lowercaseKeysRecursive);
    if (o && typeof o === "object") {
        const r = {};
        Object.keys(o).forEach(k => (r[k.toLowerCase()] = lowercaseKeysRecursive(o[k])));
        return r;
    }
    return o;
}

function buildLookup(arr, key) {
    const map = {};
    arr.forEach(e => {
        if (e?.[key] != null) map[String(e[key])] = e;
    });
    return map;
}

function resolveAbilityGroupId(skill) {
    const raw = String(skill.skillgroupid || "");
    if (raw.length <= 4) return raw;
    return raw.slice(-4);
}

function resolveGeneralPortraitId(general) {
    return String(general.generalid || "");
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function formatNumber(value) {
    if (value === "-" || value === "" || value == null) return "-";
    return Number(value).toLocaleString("hu-HU");
}

function buildGroupedSkills(generalId) {
    const skills = skillsByGeneral[generalId] || [];
    const grouped = {};

    skills.forEach(skill => {
        const tier = Number(skill.tier);
        const rawGroupId = String(skill.skillgroupid || "");

        // ability csak akkor, ha kicsi (3/3)
        const isAbilityLike = skills
            .filter(s => s.skillgroupid === skill.skillgroupid)
            .length <= 3;

        const groupId = isAbilityLike
            ? resolveAbilityGroupId(skill)
            : rawGroupId;


        if (!grouped[tier]) grouped[tier] = {};
        if (!grouped[tier][groupId]) {
            grouped[tier][groupId] = {
                groupId,
                tier,
                currentLevel: 0,
                maxLevel: 0,
                sampleSkill: skill
            };
        }

        grouped[tier][groupId].maxLevel++;
        grouped[tier][groupId].currentLevel = Math.max(
            grouped[tier][groupId].currentLevel,
            Number(skill.level)
        );
    });

    return grouped;
}

function getBaseSkillName(skillName) {
    if (!skillName) return "";

    return skillName
        .replace(/Legendary|Epic|Rare|Common/gi, "")
        .replace(/\d+$/, "")
        .trim();
}

function resolveSkillIcon(skill) {
    const groupId = resolveAbilityGroupId(skill);

    if (abilityIconMap[groupId]) {
        return abilityIconMap[groupId];
    }

    const baseName = getBaseSkillName(skill.name);
    const type = skillTypeMap[baseName];

    if (type && fallbackIconMap[type]) {
        return fallbackIconMap[type];
    }

    return "./img/unknown-icon.webp";
}

function getAbilityTypeFromGroup(groupId) {
    const ability = abilitiesByGroupId[String(groupId)];
    if (!ability) return "unknown";

    const hasAttack =
        ability.abilityattackeffectid &&
        ability.abilityattackeffectid !== "0";

    const hasDefense =
        ability.abilitydefenseeffectid &&
        ability.abilitydefenseeffectid !== "0";

    if (hasAttack && hasDefense) return "both";
    if (hasAttack) return "attack";
    if (hasDefense) return "defense";
    return "unknown";
}


// ================== DLL ==================
async function getDllText() {
    if (dllTextCache) return dllTextCache;

    const indexUrl = "https://empire-html5.goodgamestudios.com/default/index.html";
    const indexRes = await fetchWithFallback(indexUrl);
    const indexHtml = await indexRes.text();

    const dllMatch = indexHtml.match(
        /<link[^>]+id=["']dll["'][^>]+href=["']([^"']+)["']/i
    );
    if (!dllMatch) {
        throw new Error("DLL: not found in index.html");
    }

    const dllRelativeUrl = dllMatch[1];
    const dllUrl = `https://empire-html5.goodgamestudios.com/default/${dllRelativeUrl}`;

    console.log("");
    console.log(`DLL version: ${dllRelativeUrl}`);
    console.log(`DLL URL: %c${dllUrl}`, "color:blue; text-decoration:underline;");
    console.log("");

    const dllRes = await fetchWithFallback(dllUrl);
    dllTextCache = await dllRes.text();
    return dllTextCache;
}

async function loadGeneralPortraits() {
    const base =
        "https://empire-html5.goodgamestudios.com/default/assets/";
    const text = await getDllText();

    const regex =
        /itemassets\/General\/Portrait\/GeneralPortrait_(\d+)\/GeneralPortrait_\1--\d+/g;

    generalPortraitMap = {};

    for (const m of text.matchAll(regex)) {
        const id = m[1];
        const path = m[0];
        generalPortraitMap[id] = `${base}${path}.webp`;
    }
}

async function loadAbilityIcons() {
    const base =
        "https://empire-html5.goodgamestudios.com/default/assets/";
    const text = await getDllText();

    const regex =
        /itemassets\/General\/Abilities\/GeneralsAbilityGroup_(\d+)\/GeneralsAbilityGroup_\1--\d+/g;

    abilityIconMap = {};

    for (const m of text.matchAll(regex)) {
        const id = m[1];
        const path = m[0];
        abilityIconMap[id] = `${base}${path}.webp`;
    }
}

function resolveGeneralName(g) {
    return (
        lang[`generals_characters_${g.generalid}_name`] ||
        g.generalname ||
        "Unknown"
    );
}

function getRarityName(id) {
    return lang[`generals_rarity_${id}`] || "Unknown";
}

function setupSelectors() {
    const select = document.getElementById("generalSelect");
    select.innerHTML = "";

    Object.values(generalsById)
        .sort((a, b) => {
            const rarityA = Number(a.generalrarityid) || 0;
            const rarityB = Number(b.generalrarityid) || 0;

            if (rarityA !== rarityB) {
                return rarityB - rarityA;
            }

            return resolveGeneralName(a).localeCompare(resolveGeneralName(b));
        })

        .forEach(g => {
            const opt = document.createElement("option");
            opt.value = g.generalid;
            opt.textContent = `${resolveGeneralName(g)} (${getRarityName(g.generalrarityid)})`;
            select.appendChild(opt);
        });

    select.addEventListener("change", () =>
        renderGeneral(select.value)
    );

    select.value = select.options[0].value;
    renderGeneral(select.value);
}

function setupViewSwitcher() {
    const viewSelect = document.getElementById("viewSelect");
    viewSelect.addEventListener("change", () => {
        document
            .querySelectorAll(".view-section")
            .forEach(v => v.classList.add("d-none"));

        const map = {
            skills: "viewSkills",
            costs: "viewCosts"
        };

        document.getElementById(map[viewSelect.value]).classList.remove("d-none");
    });
}

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

// ================== RENDER ==================
function renderGeneral(id) {
    const g = generalsById[id];
    if (!g) return;

    setText("generalRarity", getRarityName(g.generalrarityid));
    setText("generalMaxLevel", g.maxlevel);
    setText("generalMaxStars", g.maxstarlevel);

    const portraitId = resolveGeneralPortraitId(g);
    const portraitSrc = generalPortraitMap[portraitId] || "";

    const treePortraitEl = document.getElementById("skillTreeGeneralPortrait");
    if (treePortraitEl) {
        treePortraitEl.src = portraitSrc;
        treePortraitEl.alt = portraitSrc ? "" : "IMG";
    }


    const iconWrapper = document.querySelector(".general-icon");
    if (iconWrapper) {
        iconWrapper.classList.remove(
            "rarity-common",
            "rarity-rare",
            "rarity-epic",
            "rarity-legendary"
        );

        const rarityMap = {
            "1": "rarity-common",
            "2": "rarity-rare",
            "3": "rarity-epic",
            "4": "rarity-legendary"
        };

        const rarityClass = rarityMap[g.generalrarityid];
        if (rarityClass) {
            iconWrapper.classList.add(rarityClass);
        }
    }

    renderCosts(g);
    renderSkillTreeGrouped(g.generalid);
}

function renderSkillTreeGrouped(generalId) {
    const container = document.getElementById("skillTreeGrouped");
    if (!container) return;

    container.innerHTML = "";

    const grouped = buildGroupedSkills(generalId);
    const tiers = Object.keys(grouped)
        .map(Number)
        .sort((a, b) => a - b);

    tiers.forEach(tier => {
        const row = document.createElement("div");
        row.className = "skill-tier-row";

        const tierLabel = document.createElement("div");
        tierLabel.className = "skill-tier-label";
        tierLabel.textContent = tier;
        row.appendChild(tierLabel);

        const content = document.createElement("div");
        content.className = "skill-tier-content";

        Object.values(grouped[tier])
            .sort((a, b) => {
                const aIsAbility = a.maxLevel <= 3;
                const bIsAbility = b.maxLevel <= 3;

                if (aIsAbility !== bIsAbility) {
                    return aIsAbility ? -1 : 1;
                }

                return Number(b.groupId) - Number(a.groupId);
            })
            .forEach(group => {


                const isAbilityLike = group.maxLevel <= 3;

                const iconUrl = isAbilityLike
                    ? resolveSkillIcon(group.sampleSkill)
                    : fallbackIconMap[
                    skillTypeMap[
                    getBaseSkillName(group.sampleSkill.name)
                    ]
                    ] || "./img/unknown-icon.webp";

                const groupDiv = document.createElement("div");
                groupDiv.className = "skill-group";

                if (isAbilityLike) {
                    groupDiv.title = `Ability Group ID: ${group.groupId}`;

                    const abilityType = getAbilityTypeFromGroup(group.groupId);
                    groupDiv.classList.add(abilityType);
                }

                if (group.currentLevel >= group.maxLevel) {
                    groupDiv.classList.add("maxed");
                }

                const img = document.createElement("img");
                img.src = iconUrl;
                img.alt = iconUrl ? "" : "IMG";
                groupDiv.appendChild(img);

                const badge = document.createElement("div");
                badge.className = "skill-group-level";
                badge.textContent = `${group.currentLevel}/${group.maxLevel}`;
                groupDiv.appendChild(badge);

                content.appendChild(groupDiv);
            });


        row.appendChild(content);
        container.appendChild(row);
    });
}

function renderCosts(general) {
    const tbody = document.getElementById("costTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    const rarity = raritiesById[general.generalrarityid];
    if (!rarity) return;

    const maxLevel = Number(general.maxlevel);

    const unlockCost = Number(rarity.unlockcosts);
    const upgradeCosts = rarity.upgradecosts
        ? rarity.upgradecosts.split(",").map(Number)
        : [];

    const xp = rarity.xprequirements
        ? rarity.xprequirements.split(",").map(Number)
        : [];

    let upgradeIndex = 0;
    let totalShard = 0;
    let totalXp = 0;

    for (let level = 1; level <= maxLevel; level++) {
        const tr = document.createElement("tr");

        const blockIndex = Math.floor((level - 1) / 10);
        if (blockIndex % 2 === 1) {
            tr.classList.add("cost-row-alt");
        }

        const tdLevel = document.createElement("td");
        tdLevel.textContent = level;
        tr.appendChild(tdLevel);

        let shardValue = "-";
        let shardUsed = false;

        if (level === 1) {
            shardValue = unlockCost;
            shardUsed = true;
        }
        else if ((level - 1) % 10 === 0 || level === maxLevel) {
            shardValue = upgradeCosts[upgradeIndex] ?? "-";
            shardUsed = !isNaN(shardValue);
            upgradeIndex++;
        }

        const tdShard = document.createElement("td");
        tdShard.textContent = formatNumber(shardValue);
        tr.appendChild(tdShard);

        if (shardUsed && !isNaN(shardValue)) {
            totalShard += shardValue;
        }

        let xpValue = "-";

        if (xp[level - 1] != null) {
            if (level === 1) {
                xpValue = xp[0];
            } else if (xp[level - 2] != null) {
                xpValue = xp[level - 1] - xp[level - 2];
            }
        }

        const tdXp = document.createElement("td");
        tdXp.textContent = formatNumber(xpValue);
        tr.appendChild(tdXp);

        if (!isNaN(xpValue)) {
            totalXp += xpValue;
        }

        tbody.appendChild(tr);
    }

    /* ===== TOTAL / SUMMARY ROW ===== */
    const trTotal = document.createElement("tr");
    trTotal.classList.add("cost-total-row");

    const tdLabel = document.createElement("td");
    tdLabel.textContent = "Total";
    trTotal.appendChild(tdLabel);

    const tdShardTotal = document.createElement("td");
    tdShardTotal.textContent = formatNumber(totalShard);
    trTotal.appendChild(tdShardTotal);

    const tdXpTotal = document.createElement("td");
    tdXpTotal.textContent = formatNumber(totalXp);
    trTotal.appendChild(tdXpTotal);

    tbody.appendChild(trTotal);
}

function handleResize() {
    const note = document.querySelector(".note");
    const pageTitle = document.querySelector(".page-title");
    const content = document.getElementById("content");

    if (!note || !pageTitle || !content) return;

    const totalHeightToSubtract =
        note.offsetHeight +
        pageTitle.offsetHeight + 18;

    const newHeight = window.innerHeight - totalHeightToSubtract;
    content.style.height = `${newHeight}px`;
}

window.addEventListener("resize", handleResize);
window.addEventListener("DOMContentLoaded", handleResize);

// ================== INIT ==================
async function init() {
    try {
        const totalSteps = 6;
        let step = 0;

        setLoadingProgress(++step, totalSteps, "Checking item version...");
        const itemVersion = await getItemVersion();
        const itemUrl = `https://empire-html5.goodgamestudios.com/default/items/items_v${itemVersion}.json`;
        console.log(`Item version: ${itemVersion}`);
        console.log(`Item URL: %c${itemUrl}`, "color:blue; text-decoration:underline;");
        console.log("");

        setLoadingProgress(++step, totalSteps, "Checking language version...");
        const langVersion = await getLangVersion();
        const langUrl = `https://langserv.public.ggs-ep.com/12@${langVersion}/en/*`;
        console.log(`Language version: ${langVersion}`);
        console.log(`Language URL: %c${langUrl}`, "color:blue; text-decoration:underline;");

        setLoadingProgress(++step, totalSteps, "Loading language data...");
        await getLanguageData(langVersion);

        setLoadingProgress(++step, totalSteps, "Loading items...");
        itemsData = lowercaseKeysRecursive(await getItems(itemVersion));

        /* ===== BUILD LOOKUPS ===== */
        setLoadingProgress(++step, totalSteps, "Processing generals...");
        generalsById = buildLookup(
            (itemsData.generals || []).filter(g => g.isnpcgeneral !== "1"),
            "generalid"
        );

        raritiesById = buildLookup(
            itemsData.generalrarities || [],
            "generalrarityid"
        );

        skillsByGeneral = {};
        (itemsData.generalskills || []).forEach(s => {
            if (!skillsByGeneral[s.generalid]) {
                skillsByGeneral[s.generalid] = [];
            }
            skillsByGeneral[s.generalid].push(s);
        });

        (itemsData.generalabilities || []).forEach(a => {
            abilitiesByGroupId[String(a.abilitygroupid)] = a;
        });

        setLoadingProgress(++step, totalSteps, "Loading images...");
        await loadGeneralPortraits();
        await loadAbilityIcons();

        const noteRow = document.querySelector(".note");
        if (noteRow) {
            const iconWrapper = noteRow.querySelector(".col-md-1 .general-icon");
            if (iconWrapper && !iconWrapper.querySelector("#skillTreeGeneralPortrait")) {
                const img = document.createElement("img");
                img.id = "skillTreeGeneralPortrait";
                img.src = "";
                img.alt = "IMG";
                iconWrapper.appendChild(img);
            }
        }

        setupSelectors();
        setupViewSwitcher();

        const loadingBox = document.getElementById("loadingBox");
        if (loadingBox) loadingBox.style.display = "none";

    } catch (err) {
        console.error("Error during init:", err);

        const loadingBox = document.getElementById("loadingBox");
        if (loadingBox) {
            loadingBox.innerHTML = `
        <h3>Something went wrong…</h3>
        <p>The page will automatically reload in
           <span id="retryCountdown">30</span> seconds.
        </p>
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