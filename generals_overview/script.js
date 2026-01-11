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
let abilityEffectsById = {};

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
    additionalWavesSiege: "attack",
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

        const levelCount = skills
            .filter(s => s.skillgroupid === skill.skillgroupid)
            .length;

        const isAbilityLike = levelCount > 1 && levelCount <= 3;

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

function createSkillOverview(viewContainer, skillTreeEl) {
    const overview = document.createElement("div");
    overview.id = "skillOverview";
    overview.className = "skill-overview empty";

    const generalIcon = document.createElement("div");
    generalIcon.className = "general-icon";
    generalIcon.id = "overviewGeneralIcon";

    const content = document.createElement("div");
    content.className = "skill-overview-content";
    content.id = "skillOverviewContent";

    overview.appendChild(generalIcon);
    overview.appendChild(content);

    viewContainer.insertBefore(overview, skillTreeEl);
}

function resolveSkillDisplayName(skill) {
    if (!skill?.name) return "Unknown";

    const base = getBaseSkillName(skill.name);
    const plainKey = `generals_skill_name_${base}`.toLowerCase();
    if (lang[plainKey]) {
        return lang[plainKey];
    }

    const rarityMatch = skill.name.match(/Legendary|Epic|Rare|Common/i);
    if (rarityMatch) {
        const rarity = rarityMatch[0];
        const key = `generals_skill_name_${base}${rarity}`.toLowerCase();
        if (lang[key]) {
            return lang[key];
        }
    }

    return base || "Unknown";
}

function getAbilitySlotIndex(general, abilityGroupId) {
    if (!general) return null;

    const attackSlots = (general.attackslots || "").split(",").map(s => s.trim());
    const defenseSlots = (general.defenseslots || "").split(",").map(s => s.trim());

    const allSlots = [...attackSlots, ...defenseSlots];

    for (let i = 0; i < allSlots.length; i++) {
        const slotId = allSlots[i];
        const abilityIds = abilitiesByGroupId
            ? null
            : null;
    }

    const slots = itemsData.generalslots || [];

    for (let i = 0; i < allSlots.length; i++) {
        const slotId = allSlots[i];
        const slot = slots.find(s => s.slotid === slotId);
        if (!slot) continue;

        const groups = slot.abilitygroupids.split(",").map(g => g.trim());
        if (groups.includes(String(abilityGroupId))) {
            return i + 1;
        }
    }

    return null;
}

function createSkillDetailPanels(container) {
    const row = document.createElement("div");
    row.className = "skill-details-row";
    row.id = "skillDetailsRow";

    const attack = document.createElement("div");
    attack.className = "skill-detail-panel";
    attack.id = "attackDetailPanel";
    attack.innerHTML = `<div class="skill-detail-title">Attack</div>`;

    const defense = document.createElement("div");
    defense.className = "skill-detail-panel";
    defense.id = "defenseDetailPanel";
    defense.innerHTML = `<div class="skill-detail-title">Defense</div>`;

    row.appendChild(attack);
    row.appendChild(defense);

    container.appendChild(row);
}

function resolveAbilityDescription(groupId, skill, ability, type) {
    const key = `generals_abilities_desc_${type}_${groupId}`;
    let text = lang[key.toLowerCase()];
    if (!text) return "";

    if (groupId === "1021") {
        const placeholderKey =
            "generals_abilities_desc_upgrade_placeholder_1021";

        const placeholderText = lang[placeholderKey.toLowerCase()];
        const wave = ability?.triggerperwave || "1";

        if (placeholderText) {
            const injected = placeholderText.replace("{0}", wave);
            text = text.replace("{0}", ` ${injected}`);
        } else {
            text = text.replace("{0}", "");
        }

        return text.trim();
    }

    const values = resolveAbilityEffectValues(skill, ability, type);

    if (groupId === "1023") {
        const v0 = values[0] ?? "0";
        text = text.replace("{0}", v0);
        text = text.replace("{1}", "10");
        text = text.replace("{2}", ability.triggerperwave || "1");
        return text.trim();
    }

    values.forEach((v, i) => {
        text = text.replace(`{${i}}`, v);
    });

    if (groupId === "1033" && values.length >= 1) {
        text = text.replace("{1}", values[0]);
    }

    if (groupId === "1035" && values.length >= 1) {
        const base = Number(values[0]);
        if (!isNaN(base)) {
            text = text.replace("{1}", base * 2);
        }
    }

    text = text.replace(/\{0\}/g, "");
    text = text.replace(/\{1\}/g, ability.triggerperwave || "1");
    text = text.replace(/\{2\}/g, ability.triggerperwave || "1");

    return text.trim();
}

function resolveSkillDescription(skill) {
    if (!skill?.effects) return "";

    const [, value] = skill.effects.split("&");
    const baseName = getBaseSkillName(skill.name);
    if (!baseName) return "";

    let text = lang[`generals_skill_desc_${baseName}`.toLowerCase()];

    if (!text) {
        const rarities = ["Legendary", "Epic", "Rare", "Common"];
        for (const r of rarities) {
            const k = `generals_skill_desc_${baseName}${r}`.toLowerCase();
            if (lang[k]) {
                text = lang[k];
                break;
            }
        }
    }

    if (!text) return "";

    const replacedText = text.replace("{0}", value);

    const valueNum = Number(value);
    if (isNaN(valueNum)) return replacedText;

    const maxLevel = skillsByGeneral[skill.generalid]
        .filter(s => s.skillgroupid === skill.skillgroupid)
        .length;

    if (maxLevel <= 1) return replacedText;

    const maxBonus = valueNum * maxLevel;

    if (replacedText.includes("%")) {
        return `${replacedText} (max.: ${maxBonus}%)`;
    }

    return `${replacedText} (max.: ${maxBonus})`;
}

function resolveAbilityEffectValues(skill, ability, type) {
    if (!ability) return [];

    const effectId =
        type === "attack"
            ? ability.abilityattackeffectid
            : ability.abilitydefenseeffectid;

    if (!effectId || effectId === "0") return [];

    const effect = abilityEffectsById[String(effectId)];
    if (!effect?.effects) return [];

    return effect.effects
        .split(",")
        .map(e => e.split("&")[1]);
}

function resolveAbilityTriggerText(ability) {
    if (!ability) return "";

    const trigger = (itemsData.generalabilitytriggers || [])
        .find(t => t.abilitytriggerid === ability.abilitytriggerid);

    if (!trigger?.name) return "";

    return lang[trigger.name.toLowerCase()] || "";
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

    renderCosts(g);
    renderSkillTreeGrouped(g.generalid);
}

function renderSkillTreeGrouped(generalId) {
    const container = document.getElementById("skillTreeGrouped");
    if (!container) return;

    if (!document.getElementById("skillDetailsRow")) {
        createSkillDetailPanels(container.parentElement);
    }

    const viewSkills = container.parentElement;

    if (!document.getElementById("skillOverview")) {
        createSkillOverview(viewSkills, container);
    }

    const general = generalsById[generalId];
    const portraitId = resolveGeneralPortraitId(general);
    const portraitSrc = generalPortraitMap[portraitId] || "";

    const overviewIconWrapper = document.getElementById("overviewGeneralIcon");
    if (overviewIconWrapper) {
        overviewIconWrapper.innerHTML = "";

        const img = document.createElement("img");
        img.src = portraitSrc;
        img.alt = "";

        overviewIconWrapper.appendChild(img);

        overviewIconWrapper.classList.remove(
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

        const rarityClass = rarityMap[general.generalrarityid];
        if (rarityClass) {
            overviewIconWrapper.classList.add(rarityClass);
        }
    }

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


                const isAbilityLike = group.maxLevel > 1 && group.maxLevel <= 3;

                const iconUrl = isAbilityLike
                    ? resolveSkillIcon(group.sampleSkill)
                    : fallbackIconMap[
                    skillTypeMap[
                    getBaseSkillName(group.sampleSkill.name)
                    ]
                    ] || "./img/unknown-icon.webp";

                const groupDiv = document.createElement("div");
                groupDiv.className = "skill-group";
                const cost = group.sampleSkill.costskillpoints;

                if (cost) {
                    groupDiv.title = `Skill points cost: ${cost}`
                }

                groupDiv.addEventListener("click", () => {
                    container.querySelectorAll(".skill-group.selected")
                        .forEach(el => el.classList.remove("selected"));

                    groupDiv.classList.add("selected");

                    const attackPanel = document.getElementById("attackDetailPanel");
                    const defensePanel = document.getElementById("defenseDetailPanel");

                    attackPanel.innerHTML = `<div class="skill-detail-title">Attack</div>`;
                    defensePanel.innerHTML = `<div class="skill-detail-title">Defense</div>`;

                    const overview = document.getElementById("skillOverview");
                    if (!overview) return;

                    overview.classList.remove("empty");
                    const content = document.getElementById("skillOverviewContent");
                    content.innerHTML = "";
                    overview.classList.remove("empty");

                    const iconWrapper = document.createElement("div");
                    iconWrapper.className = "skill-group";

                    if (isAbilityLike) {
                        const abilityType = getAbilityTypeFromGroup(group.groupId);
                        iconWrapper.classList.add(abilityType);
                    }

                    const iconImg = document.createElement("img");
                    iconImg.src = iconUrl;
                    iconImg.alt = "";

                    iconWrapper.appendChild(iconImg);

                    const info = document.createElement("div");
                    info.className = "skill-overview-info";

                    const name = document.createElement("div");

                    let displayName =
                        lang[`generals_abilities_name_${group.groupId}`] ||
                        resolveSkillDisplayName(group.sampleSkill) ||
                        "Unknown";

                    let slotIndex = null;

                    if (isAbilityLike) {
                        const general = generalsById[generalId];
                        slotIndex = getAbilitySlotIndex(general, group.groupId);
                    }

                    name.textContent = displayName;

                    const type = document.createElement("div");
                    const abilityTypeText = isAbilityLike
                        ? getAbilityTypeFromGroup(group.groupId)
                        : "skill";
                    if (!isAbilityLike) {
                        const skillType =
                            skillTypeMap[getBaseSkillName(group.sampleSkill.name)];

                        if (skillType === "attack") {
                            const desc = resolveSkillDescription(group.sampleSkill, "attack");
                            if (desc) {
                                attackPanel.innerHTML += `<div>${desc}</div>`;
                            }
                        }

                        if (skillType === "defense") {
                            const desc = resolveSkillDescription(group.sampleSkill, "defense");
                            if (desc) {
                                defensePanel.innerHTML += `<div>${desc}</div>`;
                            }
                        }
                    }

                    if (isAbilityLike) {
                        const ability = abilitiesByGroupId[group.groupId];
                        if (!ability) return;

                        if (ability.abilityattackeffectid && ability.abilityattackeffectid !== "0") {
                            const desc = resolveAbilityDescription(
                                group.groupId,
                                group.sampleSkill,
                                ability,
                                "attack"
                            );
                            if (desc) {
                                attackPanel.innerHTML += `<div>${desc}</div>`;
                            }
                        }

                        if (ability.abilitydefenseeffectid && ability.abilitydefenseeffectid !== "0") {
                            const desc = resolveAbilityDescription(
                                group.groupId,
                                group.sampleSkill,
                                ability,
                                "defense"
                            );
                            if (desc) {
                                defensePanel.innerHTML += `<div>${desc}</div>`;
                            }
                        }
                    }

                    if (slotIndex != null) {
                        type.textContent = `Slot: ${slotIndex}`;
                        type.className = "skill-overview-type";
                    } else {
                        type.textContent = "";
                    }

                    info.appendChild(name);
                    info.appendChild(type);

                    content.appendChild(iconWrapper);
                    content.appendChild(info);
                });

                if (isAbilityLike) {
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

        const firstTierRow = container.querySelector(".skill-tier-row");
        if (!firstTierRow) return;

        const firstAbility = firstTierRow.querySelector(
            ".skill-group.attack, .skill-group.defense, .skill-group.both"
        );

        if (firstAbility) {
            firstAbility.click();
        }
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

        abilityEffectsById = buildLookup(
            itemsData.generalabilityeffects || [],
            "abilityeffectid"
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