import { initAutoHeight } from "../shared/ResizeService.mjs";
import { createLoader } from "../shared/LoadingService.mjs";
import { coreInit } from "../shared/CoreInit.mjs";
import { initLanguageSelector, getInitialLanguage } from "../shared/LanguageService.mjs";

// --- GLOBAL VARIABLES ---
let lang = {};
let itemsData = null;
const loader = createLoader();
let currentLanguage = getInitialLanguage();
let ownLang = {};
let UI_LANG = {};

let generalsById = {};
let skillsByGeneral = {};
let raritiesById = {};
let abilitiesByGroupId = {};
let abilityEffectsById = {};

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

// --- FETCH FUNCTIONS --
async function loadOwnLang() {
    try {
        const res = await fetch("./ownLang.json");
        const rawLang = await res.json();

        function normalizeKeys(obj) {
            if (obj && typeof obj === "object" && !Array.isArray(obj)) {
                return Object.fromEntries(
                    Object.entries(obj).map(([k, v]) =>
                        [k.toLowerCase(), normalizeKeys(v)]
                    )
                );
            }
            if (Array.isArray(obj)) return obj.map(normalizeKeys);
            return obj;
        }

        ownLang = normalizeKeys(rawLang);

    } catch (err) {
        console.error("ownLang load error:", err);
        ownLang = {};
    }
}

function applyOwnLang() {

    const L = ownLang[currentLanguage?.toLowerCase()] || {};
    const ui = L.ui || {};

    UI_LANG = {
        attack: ui.attack ?? "Attack",
        defense: ui.defense ?? "Defense",
        slot: ui.slot ?? "Slot",
        skill_points: ui.skill_points ?? "Skill points cost",

        total: ui.total ?? "Total",
        level: ui.level ?? "Level",
        shards: ui.shards ?? "Shards",
        xp: ui.xp ?? "XP",

        select_general: ui.select_general ?? "Select general",
        view_skills: ui.view_skills ?? "Skills",
        view_costs: ui.view_costs ?? "Upgrade costs",

        unknown: ui.unknown ?? "Unknown",
        no_generals: ui.no_generals ?? "No generals available"
    };

    document.querySelector('#viewSelect option[value="skills"]').textContent =
        UI_LANG.view_skills;

    document.querySelector('#viewSelect option[value="costs"]').textContent =
        UI_LANG.view_costs;
    document.querySelector(".col-level").textContent = UI_LANG.level;
    document.querySelector(".col-shards").textContent = UI_LANG.shards;
    document.querySelector(".col-xp").textContent = UI_LANG.xp;
}

// --- HELPERS ---
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

function normalizeName(str) {
    return String(str || "").toLowerCase();
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
    return Number(value).toLocaleString(currentLanguage);
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
    if (!ability) return UI_LANG.unknown;

    const hasAttack =
        ability.abilityattackeffectid &&
        ability.abilityattackeffectid !== "0";

    const hasDefense =
        ability.abilitydefenseeffectid &&
        ability.abilitydefenseeffectid !== "0";

    if (hasAttack && hasDefense) return "both";
    if (hasAttack) return "attack";
    if (hasDefense) return "defense";
    return UI_LANG.unknown;
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
    if (!skill?.name) return UI_LANG.unknown;

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

    return base || UI_LANG.unknown;
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
    attack.innerHTML = `<div class="skill-detail-title">${UI_LANG.attack}</div>`;

    const defense = document.createElement("div");
    defense.className = "skill-detail-panel";
    defense.id = "defenseDetailPanel";
    defense.innerHTML = `<div class="skill-detail-title">${UI_LANG.defense}</div>`;

    row.appendChild(attack);
    row.appendChild(defense);

    container.appendChild(row);
}

const SPECIAL_ABILITY_HANDLERS = {
    "1021": ({ text, ability, lang }) => {
        const placeholderKey =
            "generals_abilities_desc_upgrade_placeholder_1021";
        const placeholderText = lang[placeholderKey.toLowerCase()];
        const wave = ability?.triggerperwave || "1";

        if (placeholderText) {
            const injected = placeholderText.replace("{0}", wave);
            return text.replace("{0}", ` ${injected}`).trim();
        }
        return text.replace("{0}", "").trim();
    },

    "1023": ({ text, values, ability }) => {
        const v0 = values[0] ?? "0";
        return text
            .replace("{0}", v0)
            .replace("{1}", "10")
            .replace("{2}", ability.triggerperwave || "1")
            .trim();
    },

    "1033": ({ text, values }) => {
        if (values.length >= 1) {
            return text.replace("{1}", values[0]).trim();
        }
        return text;
    },

    "1035": ({ text, values }) => {
        const base = Number(values[0]);
        if (!isNaN(base)) {
            return text.replace("{1}", base * 2).trim();
        }
        return text;
    },

    "1028": ({ text, values, type, ability }) => {
        const v0 = values[0] ?? "0";

        if (type === "attack") {
            text = text.replace("{0}", v0).replace("{1}", v0);
        } else {
            text = text.replace("{0}", v0).replace("{1}", "");
        }

        return text
            .replace("{2}", ability.triggerperwave || "1")
            .trim();
    }
};

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

    if (groupId === "1028") {
        const v0 = values[0] ?? "0";

        if (type === "attack") {
            text = text.replace("{0}", v0);
            text = text.replace("{1}", v0);
        } else if (type === "defense") {
            text = text.replace("{0}", v0);
            text = text.replace("{1}", "");
        }

        text = text.replace("{2}", ability.triggerperwave || "1");
        return text.trim();
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

function resolveGeneralName(g) {
    return (
        lang[`generals_characters_${g.generalid}_name`] ||
        g.generalname ||
        UI_LANG.unknown
    );
}

function getRarityName(id) {
    return lang[`generals_rarity_${id}`] || UI_LANG.unknown;
}

function setupSelectors() {

    const select = document.getElementById("generalSelect");

    if (!select) {
        console.error("setupSelectors: #generalSelect not found in DOM");
        return;
    }

    select.innerHTML = "";

    const generals = Object.values(generalsById);

    if (!generals.length) {
        console.error("setupSelectors: No generals loaded", itemsData?.generals);
        select.innerHTML = `<option>${UI_LANG.no_generals}</option>`;
        return;
    }

    generals
        .sort((a, b) => {
            const rarityA = Number(a.generalrarityid) || 0;
            const rarityB = Number(b.generalrarityid) || 0;

            if (rarityA !== rarityB) {
                return rarityB - rarityA;
            }

            return resolveGeneralName(a)
                .localeCompare(resolveGeneralName(b));
        })
        .forEach(g => {
            const opt = document.createElement("option");
            opt.value = g.generalid;
            opt.textContent =
                `${resolveGeneralName(g)} (${getRarityName(g.generalrarityid)})`;

            select.appendChild(opt);
        });

    if (!select.dataset.bound) {
        select.addEventListener("change", () => {
            if (select.value) {
                renderGeneral(select.value);
            }
        });

        select.dataset.bound = "true";
    }

    if (select.options.length > 0) {
        select.selectedIndex = 0;
        renderGeneral(select.value);
    }
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

// --- CARD CREATION (HTML RENDERING) ---
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
                    groupDiv.title = `${UI_LANG.skill_points}: ${cost}`;
                }

                groupDiv.addEventListener("click", () => {
                    container.querySelectorAll(".skill-group.selected")
                        .forEach(el => el.classList.remove("selected"));

                    groupDiv.classList.add("selected");

                    const attackPanel = document.getElementById("attackDetailPanel");
                    const defensePanel = document.getElementById("defenseDetailPanel");

                    attackPanel.innerHTML = `<div class="skill-detail-title">${UI_LANG.attack}</div>`;
                    defensePanel.innerHTML = `<div class="skill-detail-title">${UI_LANG.defense}</div>`;

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
                        UI_LANG.unknown;

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
                        type.textContent = `${UI_LANG.slot}: ${slotIndex}`;
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

    const trTotal = document.createElement("tr");
    trTotal.classList.add("cost-total-row");

    const tdLabel = document.createElement("td");
    tdLabel.textContent = UI_LANG.total;
    trTotal.appendChild(tdLabel);

    const tdShardTotal = document.createElement("td");
    tdShardTotal.textContent = formatNumber(totalShard);
    trTotal.appendChild(tdShardTotal);

    const tdXpTotal = document.createElement("td");
    tdXpTotal.textContent = formatNumber(totalXp);
    trTotal.appendChild(tdXpTotal);

    tbody.appendChild(trTotal);
}

// --- INITIALIZATION AND EVENT SETUP ---
initAutoHeight({
    contentSelector: "#content",
    subtractSelectors: [".note", ".page-title"],
    extraOffset: 18
});

async function init() {

    await coreInit({
        loader,
        itemLabel: "generals",
        langCode: currentLanguage,
        normalizeNameFn: normalizeName,

        assets: {
            generals: true
        },

        onReady: async ({
            lang: L,
            data,
            imageMaps
        }) => {

            lang = L;
            itemsData = lowercaseKeysRecursive(data);

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

            generalPortraitMap = imageMaps.generals?.portraits ?? {};

            abilityIconMap = imageMaps.generals?.abilities ?? {};

            initLanguageSelector({
                currentLanguage,
                lang,
                onSelect: () => location.reload()
            });

            await loadOwnLang();
            applyOwnLang();

            setupSelectors();
            setupViewSwitcher();
        }
    });
}

init();