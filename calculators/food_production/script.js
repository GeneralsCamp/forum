import { saveCalculatorData, loadCalculatorData } from "../../overviews/shared/GameSettings.mjs";
import {
    getItemVersion,
    getLangVersion,
    loadItems,
    loadLanguage
} from "../../overviews/shared/DataService.mjs";
import { initCalculatorI18n } from "../shared/CalculatorI18n.mjs";

const { language, t, formatNumber } = await initCalculatorI18n();

let gameLang = {};
let itemsData = {};

const [languageResult, itemsResult] = await Promise.allSettled([
    getLangVersion().then((version) => loadLanguage(language, version)),
    getItemVersion().then((version) => loadItems(version))
]);

if (languageResult.status === "fulfilled") {
    gameLang = languageResult.value;
} else {
    console.warn("Food production in-game translations could not be loaded:", languageResult.reason);
}

if (itemsResult.status === "fulfilled") {
    itemsData = itemsResult.value;
} else {
    console.warn("Food production item data could not be loaded:", itemsResult.reason);
}

function getGameText(key, fallback) {
    return gameLang[key] || fallback;
}

function getNumericRows(section, predicate, valueKey) {
    const rows = Array.isArray(itemsData?.[section]) ? itemsData[section] : [];
    const byLevel = new Map();

    rows.filter(predicate).forEach((row) => {
        const level = Number.parseInt(row.level, 10);
        const value = Number.parseInt(row[valueKey], 10);
        if (Number.isFinite(level) && level > 0 && Number.isFinite(value)) {
            byLevel.set(level, { level, value });
        }
    });

    return [...byLevel.values()].sort((a, b) => a.level - b.level);
}

function getBuildingLevels(buildingType) {
    const buildingNames = {
        conservatory: "RelicFarmGreen",
        greenhouse: "RelicFarm",
        granary: "LegendFarm"
    };
    const name = buildingNames[buildingType];
    if (!name) return [];

    return getNumericRows(
        "buildings",
        (row) => row.name === name && row.Foodproduction !== undefined,
        "Foodproduction"
    );
}

function getConstructionItemLevels(groupID, minimumLevel = 1) {
    return getNumericRows(
        "constructionItems",
        (row) => String(row.constructionItemGroupID) === String(groupID)
            && Number.parseInt(row.level, 10) >= minimumLevel,
        groupID === 8 ? "Foodproduction" : "unboostedFoodProduction"
    );
}

function applyGameTranslations() {
    document.querySelectorAll("[data-game-lang]").forEach((element) => {
        element.textContent = getGameText(element.dataset.gameLang, element.textContent.trim());
    });

    document.querySelectorAll("select option").forEach((option) => {
        const text = option.textContent.trim();
        const levelMatch = /^Level\s+(\d+)$/.exec(text);
        if (levelMatch) {
            option.textContent = t("level", { value: levelMatch[1] });
        } else if (text === "None") {
            option.textContent = getGameText("generals_abilities_desc_attack_1018", "None");
        } else if (text === "Inactive") {
            option.textContent = getGameText("status_inactive", "Inactive");
        } else if (text === "Disabled") {
            option.textContent = getGameText("dialog_shapeshifter_hardcoreMode_state_disabled", "Disabled");
        } else if (text === "No") {
            option.textContent = getGameText("commons_no", "No");
        } else if (text === "Yes") {
            option.textContent = getGameText("commons_yes", "Yes");
        } else if (text === "Lower") {
            option.textContent = t("lower_title");
        }
    });
}

const CALC_NAME = "food_production";

// --- GLOBAL DOM REFERENCES ---
const selectLocation = document.getElementById("location")

const selectMain = document.getElementById("vip-main")
const selectOP = document.getElementById("vip-op")
const selectKingdom = document.getElementById("vip-kingdom")

const selectHuntGreen = document.getElementById("hunt-green")
const selectHuntKingdom = document.getElementById("hunt-kingdom")

const selectVillages = document.getElementById("villages")

let percentBonus = 0;
let constBonus = 0;

// --- LOCATION HANDLING ---
function LocationModify() {
    if (selectLocation.value == "main") {
        selectMain.style.display = "inline-block";
        selectOP.style.display = "none";
        selectKingdom.style.display = "none";

        selectHuntGreen.style.display = "inline-block";
        selectHuntKingdom.style.display = "none";

        selectVillages.disabled = true;
    }
    else if (selectLocation.value == "op6" || selectLocation.value == "op8") {
        selectMain.style.display = "none";
        selectOP.style.display = "inline-block";
        selectKingdom.style.display = "none";

        selectHuntGreen.style.display = "inline-block";
        selectHuntKingdom.style.display = "none";

        selectVillages.disabled = true;
    }
    else if (selectLocation.value == "kingdom") {
        selectMain.style.display = "none";
        selectOP.style.display = "none";
        selectKingdom.style.display = "inline-block";

        selectHuntGreen.style.display = "none";
        selectHuntKingdom.style.display = "inline-block";

        selectVillages.disabled = false;
    }
}

// --- MAIN CALCULATOR WRAPPER ---
function Calculate() {
    CalculateBonuses();
    updateBuildings();
}

// --- BONUS CALCULATION ---
function CalculateBonuses() {
    const selectedLocation = selectLocation.value;
    const selectBeri = document.getElementById("beri");

    // --- Public Order Bonus ---
    const po = document.getElementById("po").value;
    let PObonus = 1;
    if (po > 0) {
        PObonus = 1 + 0.02 * Math.sqrt(po);
    }
    else if (po < 0) {
        PObonus = 1 / (1 + 0.02 * Math.sqrt(- po));
    }

    // --- Input Values ---
    const coat = document.getElementById("coat").value;
    let hunt = 0;
    if (selectedLocation == "kingdom") {
        hunt = document.getElementById("hunt-kingdom").value;
    }
    else {
        hunt = document.getElementById("hunt-green").value;
    }
    const mill = document.getElementById("mill").value;
    const deco2 = document.getElementById("deco2").value / 100;

    // --- Beri Bonuses ---
    let beriKingdoms = 0;
    let beriGreen = 0;
    if (selectBeri.value == "weaponmaster") {
        beriKingdoms = 0.20;
        beriGreen = 0.40;
    }
    else if (selectBeri.value == "deathclaw") {
        beriKingdoms = 0.20;
        beriGreen = 0.20;
    }
    else if (selectBeri.value == "widowmaker") {
        beriKingdoms = 0.20;
        beriGreen = 0;
    }

    // --- VIP Bonuses ---
    const overseer = document.getElementById("overseer").value;
    let vip = 0;
    if (selectedLocation == "main") {
        vip = document.getElementById("vip-main").value;
    }
    else if (selectedLocation == "op6" || selectedLocation == "op8") {
        vip = document.getElementById("vip-op").value;
    }
    else if (selectedLocation == "kingdom") {
        vip = document.getElementById("vip-kingdom").value;
    }

    // --- Villages (Kingdom only) ---
    let villages = 0;
    if (selectedLocation == "kingdom") {
        villages = document.getElementById("villages").value;
        villages = villages / 100;
    }

    // --- Static Bonuses ---
    const res1 = document.getElementById("res1").value;
    const res2 = document.getElementById("res2").value;
    const sub = document.getElementById("sub").value;

    // --- Castles ---
    const castInput = document.getElementById("cast").value;
    const cast = (castInput === "" || isNaN(castInput)) ? 0 : parseInt(castInput);

    // --- Decoration Bonus ---
    const decoInput = document.getElementById("deco1").value;
    const decobonus = (decoInput === "" || isNaN(decoInput)) ? 0 : parseInt(decoInput);

    // --- TCI Bonus ---
    const tciInput = document.getElementById("foodTCI").value;
    const tcibonus = (tciInput === "" || isNaN(tciInput)) ? 0 : parseInt(tciInput);

    // --- Final Percent & Constant Bonus ---
    if (selectedLocation == "main" || selectedLocation == "op6" || selectedLocation == "op8") {
        percentBonus = parseFloat(PObonus) * (1 + parseFloat(hunt)) * (1 + parseFloat(beriGreen) + parseFloat(coat) + parseFloat(mill) + parseFloat(deco2) + parseFloat(overseer) + parseFloat(vip) + parseFloat(res2) + parseFloat(sub));
        constBonus = parseFloat(cast) + parseFloat(res1) + parseFloat(decobonus) + parseFloat(tcibonus);
    }
    else if (selectedLocation == "kingdom") {
        percentBonus = (parseFloat(PObonus)) * (1 + parseFloat(coat) + parseFloat(mill) + parseFloat(deco2) + parseFloat(overseer) + parseFloat(vip) + parseFloat(res2) + parseFloat(sub) + parseFloat(hunt) + parseFloat(beriKingdoms) + parseFloat(villages));
        constBonus = parseFloat(cast) + parseFloat(res1) + parseFloat(decobonus) + parseFloat(tcibonus);
    }

    // --- Output ---
    document.getElementById("percentBonus").textContent = `${formatNumber(Math.round(percentBonus * 100))}%`;
    document.getElementById("constBonus").textContent = `${formatNumber(constBonus)} /h`;
}

// --- BUILDING GENERATION ---
function generateBuildingCards() {
    const buildingsData = [
        { id: "b1", name: getGameText("RelicFarmGreen_name", "Relic conservatory"), type: "conservatory", imgSrc: "https://empire-html5.goodgamestudios.com/default/assets/itemassets/Building/RelicFarm/RelicFarmGreen_Building_Level3/RelicFarmGreen_Building_Level3--1573728046260.webp" },
        { id: "b2", name: getGameText("RelicFarmGreen_name", "Relic conservatory"), type: "conservatory", imgSrc: "https://empire-html5.goodgamestudios.com/default/assets/itemassets/Building/RelicFarm/RelicFarmGreen_Building_Level3/RelicFarmGreen_Building_Level3--1573728046260.webp" },
        { id: "b3", name: getGameText("RelicFarm_name", "Relic greenhouse"), type: "greenhouse", imgSrc: "https://empire-html5.goodgamestudios.com/default/assets/itemassets/Building/RelicFarm/RelicFarm_Building_Level3/RelicFarm_Building_Level3--1573584429307.webp" },
        { id: "b4", name: getGameText("RelicFarm_name", "Relic greenhouse"), type: "greenhouse", imgSrc: "https://empire-html5.goodgamestudios.com/default/assets/itemassets/Building/RelicFarm/RelicFarm_Building_Level3/RelicFarm_Building_Level3--1573584429307.webp" },
        ...Array.from({ length: 8 }, (_, index) => ({ id: `b${index + 5}`, name: getGameText("legendFarm_name", "Granary"), type: "granary", imgSrc: "https://empire-html5.goodgamestudios.com/default/assets/itemassets/Building/LegendFarm/LegendFarm_Building_Level9/LegendFarm_Building_Level9--1573584429307.webp" })),
    ];

    const container = document.getElementById("buildings-container");
    container.innerHTML = "";

    buildingsData.forEach((building, index) => {
        const buildingCard = `
            <div class="col-12 col-md-6 building-card-column" id="card-${building.id}" data-prodIndex="${index + 1}">
                <div class="box" data-index="${index}">
                    <div class="box-icon">
                        <img src="${building.imgSrc}" class="img-fluid" alt="">
                    </div>
                    <div class="box-content">
                        <h2>
                            <span class="building-name">${building.name}</span>
                            <select class="fixSelector levelSelector" name="${building.id}lvl" id="${building.id}lvl" onchange="updateBuilding('${building.id}')">
                                ${generateLevelOptions(building.type)}
                            </select>
                        </h2>
                        <div class="box-text">
                            <p class="building-productivity">${getGameText("dialog_listOverview_tabResourceProductivity_tt", "Productivity")}: <span id="${building.id}prod">-</span></p>
                            <p class="building-production">${getGameText("dialog_researchTower_blueprintsCategory4_title", "Production")}: <span id="${building.id}lbl">-</span></p>
                            <div class="building-control building-primary-item">
                                <select class="fixSelector" name="${building.id}elem" id="${building.id}elem" onchange="updateBuilding('${building.id}')">
                                    ${generatePrimaryOptions()}
                                </select>
                            </div>
                            <div class="building-control building-relic-item">
                                <select class="fixSelector" name="${building.id}relicElem" id="${building.id}relicElem" onchange="updateBuilding('${building.id}')">
                                    ${generateRelicOptions()}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += buildingCard;
    });
    buildingsData.forEach((building) => updateBuilding(building.id));
}

// --- OPTION GENERATORS ---
function generateLevelOptions(buildingType) {
    const itemLevels = getBuildingLevels(buildingType);
    return [
        `<option value="0">${getGameText("generals_abilities_desc_attack_1018", "None")}</option>`,
        ...itemLevels.map(({ level, value }) => `<option value="${value}">${t("level", { value: level })}</option>`)
    ].join("");
}

function generatePrimaryOptions() {
    const itemLevels = getConstructionItemLevels(8, 15);
    const basic = getGameText("toolType_basic", "Basic");
    const none = getGameText("generals_abilities_desc_attack_1018", "None");
    return [
        `<option value="0">${none}</option>`,
        ...itemLevels.map(({ level, value }) => `<option value="${value}">${basic} ${level}</option>`)
    ].join("");
}

function generateRelicOptions() {
    const relicLevels = getConstructionItemLevels(36);
    const premiumLevels = getConstructionItemLevels(37);
    const none = getGameText("generals_abilities_desc_attack_1018", "None");
    const relicName = getGameText("relicequip_dialog_category_relic", "Relic");
    const premiumName = getGameText("premium", "Premium");
    return [
        `<option value="0">${none}</option>`,
        ...relicLevels.map(({ level, value }) => `<option value="${value}">${relicName} ${level}</option>`),
        ...premiumLevels.map(({ level, value }) => `<option value="${value}">${premiumName} ${level}</option>`)
    ].join("");
}

// --- PRODUCTION CALCULATIONS ---
const BUILDING_IDS = ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "b9", "b10", "b11", "b12"];

function calculateProduction(level, primaryItem, relicItem, productivity) {
    const baseProduction = level + primaryItem;
    const bonusProduction = baseProduction * percentBonus;
    const totalProduction = ((bonusProduction) * productivity) + relicItem;

    return Math.round(totalProduction);
}

function calculateNetProduction(level, primaryItem, relicItem) {
    return ((level + primaryItem) * percentBonus) + relicItem;
}

function getBuildingValues(buildingId) {
    const levelElement = document.getElementById(`${buildingId}lvl`);
    const primaryItemElement = document.getElementById(`${buildingId}elem`);
    const relicItemElement = document.getElementById(`${buildingId}relicElem`);

    return {
        id: buildingId,
        level: levelElement ? parseInt(levelElement.value) || 0 : 0,
        primaryItem: primaryItemElement ? parseInt(primaryItemElement.value) || 0 : 0,
        relicItem: relicItemElement ? parseInt(relicItemElement.value) || 0 : 0,
    };
}

function getWorkArray(location, maxBuildings = 13) {
    let production_slots = 0;

    if (location === "main") {
        production_slots = 3;
    } else if (location === "op6") {
        production_slots = 6;
    } else if (location === "op8") {
        production_slots = 8;
    } else if (location === "kingdom") {
        production_slots = 2;
    }

    let work = [0];
    for (let i = 1; i <= maxBuildings; i++) {
        if (i <= production_slots) {
            work.push(1);
        } else {
            work.push(+(0.75 ** (i - production_slots)).toFixed(2));
        }
    }
    return work;
}

function updateBuildings() {
    const selectLocation = document.getElementById('location');
    const work = getWorkArray(selectLocation.value);

    const buildings = BUILDING_IDS.map((buildingId, originalIndex) => {
        const values = getBuildingValues(buildingId);
        return {
            ...values,
            originalIndex,
            netProduction: calculateNetProduction(values.level, values.primaryItem, values.relicItem),
        };
    });

    const rankedBuildings = [...buildings].sort((a, b) => {
        if (b.netProduction !== a.netProduction) {
            return b.netProduction - a.netProduction;
        }
        return a.originalIndex - b.originalIndex;
    });

    const productivityByBuilding = {};
    rankedBuildings.forEach((building, index) => {
        productivityByBuilding[building.id] = work[index + 1] || 0;
    });

    const totalProduction = buildings.reduce((total, building) => {
        const productivity = productivityByBuilding[building.id] || 0;
        const production = calculateProduction(building.level, building.primaryItem, building.relicItem, productivity);

        const productionElement = document.getElementById(`${building.id}prod`);
        if (productionElement) {
            productionElement.textContent = `${(productivity * 100).toFixed(0)}%`;
        }

        const labelElement = document.getElementById(`${building.id}lbl`);
        if (labelElement) {
            labelElement.textContent = `${formatNumber(production)}/h`;
        }

        return total + production;
    }, 0);

    let cast = 0;
    var castInput = document.getElementById("cast").value;
    if (!(castInput === "" || isNaN(castInput))) {
        cast = parseInt(castInput);
    }

    let decobonus = 0;
    var decoInput = document.getElementById("deco1").value;
    if (!(decoInput === "" || isNaN(decoInput))) {
        decobonus = parseInt(decoInput);
    }

    let tcibonus = 0;
    var tciInput = document.getElementById("foodTCI").value;
    if (!(tciInput === "" || isNaN(tciInput))) {
        tcibonus = parseInt(tciInput);
    }

    let res1 = document.getElementById("res1").value;
    if (!(res1 === "" || isNaN(res1))) {
        res1 = parseInt(res1);
    }

    let totalProductionWithBonuses = totalProduction + cast + decobonus + tcibonus + res1;

    document.getElementById("finalProduction").textContent = `${formatNumber(totalProductionWithBonuses)} /h`;
}

export function updateBuilding() {
    updateBuildings();
}

window.LocationModify = LocationModify;
window.Calculate = Calculate;
window.updateBuilding = updateBuilding;

// --- CACHE HANDLING ---
function saveToCache() {
    const data = {};
    document.querySelectorAll('input, select').forEach(input => {
        data[input.id] = input.value;
    });
    saveCalculatorData(CALC_NAME, data);
}

function loadFromCache() {
    const data = loadCalculatorData(CALC_NAME);
    if (!data) return;
    Object.entries(data).forEach(([id, value]) => {
        const input = document.getElementById(id);
        if (input) input.value = value;
    });
}

function initializeCalculator() {
    applyGameTranslations();
    generateBuildingCards();
    loadFromCache();
    LocationModify();
    Calculate();
    document.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', saveToCache);
    });
}

// --- INITIALIZATION ---
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeCalculator, { once: true });
} else {
    initializeCalculator();
}
