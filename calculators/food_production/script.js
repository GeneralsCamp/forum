import { saveCalculatorData, loadCalculatorData } from "../../overviews/shared/GameSettings.mjs";
import { getLangVersion, loadLanguage } from "../../overviews/shared/DataService.mjs";
import { initCalculatorI18n } from "../shared/CalculatorI18n.mjs";

const { language, t, formatNumber } = await initCalculatorI18n();

let gameLang = {};
try {
    gameLang = await loadLanguage(language, await getLangVersion());
} catch (error) {
    console.warn("Food production in-game translations could not be loaded:", error);
}

function getGameText(key, fallback) {
    return gameLang[key] || fallback;
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
            <div class="col-12 col-xl-6 building-card-column" id="card-${building.id}" data-prodIndex="${index + 1}">
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
    let levels = [];

    if (buildingType === "greenhouse") {
        levels = [
            { value: 0, label: "None" },
            { value: 196, label: "Level 1" },
            { value: 204, label: "Level 2" },
            { value: 212, label: "Level 3" },
            { value: 220, label: "Level 4" },
            { value: 228, label: "Level 5" },
            { value: 236, label: "Level 6" },
            { value: 244, label: "Level 7" },
            { value: 252, label: "Level 8" },
            { value: 260, label: "Level 9" },
            { value: 267, label: "Level 10" },
            { value: 274, label: "Level 11" },
            { value: 281, label: "Level 12" },
            { value: 286, label: "Level 13" },
            { value: 291, label: "Level 14" },
            { value: 296, label: "Level 15" },
            { value: 301, label: "Level 16" },
            { value: 306, label: "Level 17" },
            { value: 311, label: "Level 18" },
            { value: 316, label: "Level 19" },
            { value: 320, label: "Level 20" },
            { value: 324, label: "Level 21" },
            { value: 328, label: "Level 22" },
            { value: 332, label: "Level 23" },
            { value: 336, label: "Level 24" },
            { value: 340, label: "Level 25" },
            { value: 344, label: "Level 26" },
            { value: 348, label: "Level 27" },
            { value: 352, label: "Level 28" },
            { value: 356, label: "Level 29" },
            { value: 360, label: "Level 30" },
            { value: 375, label: "Level 31" },
            { value: 390, label: "Level 32" },
            { value: 405, label: "Level 33" },
            { value: 420, label: "Level 34" },
            { value: 435, label: "Level 35" },
            { value: 450, label: "Level 36" },
            { value: 465, label: "Level 37" },
            { value: 490, label: "Level 38" },
            { value: 515, label: "Level 39" },
            { value: 540, label: "Level 40" },
        ];
    } else if (buildingType === "granary") {
        levels = [
            { value: 0, label: "None" },
            { value: 91, label: "Level 1" },
            { value: 94, label: "Level 2" },
            { value: 97, label: "Level 3" },
            { value: 100, label: "Level 4" },
            { value: 103, label: "Level 5" },
            { value: 106, label: "Level 6" },
            { value: 109, label: "Level 7" },
            { value: 112, label: "Level 8" },
            { value: 115, label: "Level 9" },
            { value: 118, label: "Level 10" },
            { value: 121, label: "Level 11" },
            { value: 124, label: "Level 12" },
            { value: 127, label: "Level 13" },
            { value: 130, label: "Level 14" },
            { value: 133, label: "Level 15" },
            { value: 136, label: "Level 16" },
            { value: 139, label: "Level 17" },
            { value: 142, label: "Level 18" },
            { value: 145, label: "Level 19" },
            { value: 148, label: "Level 20" },
            { value: 151, label: "Level 21" },
            { value: 154, label: "Level 22" },
            { value: 157, label: "Level 23" },
            { value: 160, label: "Level 24" },
            { value: 163, label: "Level 25" },
            { value: 166, label: "Level 26" },
            { value: 169, label: "Level 27" },
            { value: 172, label: "Level 28" },
            { value: 175, label: "Level 29" },
            { value: 178, label: "Level 30" }
        ];
    } else if (buildingType === "conservatory") {
        levels = [
            { value: 0, label: "None" },
            { value: 196, label: "Level 1" },
            { value: 204, label: "Level 2" },
            { value: 212, label: "Level 3" },
            { value: 220, label: "Level 4" },
            { value: 228, label: "Level 5" },
            { value: 236, label: "Level 6" },
            { value: 244, label: "Level 7" },
            { value: 252, label: "Level 8" },
            { value: 260, label: "Level 9" },
            { value: 267, label: "Level 10" },
            { value: 274, label: "Level 11" },
            { value: 281, label: "Level 12" },
            { value: 286, label: "Level 13" },
            { value: 291, label: "Level 14" },
            { value: 296, label: "Level 15" },
            { value: 301, label: "Level 16" },
            { value: 306, label: "Level 17" },
            { value: 311, label: "Level 18" },
            { value: 316, label: "Level 19" },
            { value: 320, label: "Level 20" },
            { value: 330, label: "Level 21" },
            { value: 340, label: "Level 22" },
            { value: 350, label: "Level 23" },
            { value: 360, label: "Level 24" },
            { value: 370, label: "Level 25" },
            { value: 380, label: "Level 26" },
            { value: 390, label: "Level 27" },
            { value: 400, label: "Level 28" },
            { value: 410, label: "Level 29" },
            { value: 420, label: "Level 30" },
            { value: 440, label: "Level 31" },
            { value: 460, label: "Level 32" },
            { value: 480, label: "Level 33" },
            { value: 500, label: "Level 34" },
            { value: 525, label: "Level 35" },
            { value: 550, label: "Level 36" },
            { value: 575, label: "Level 37" },
            { value: 600, label: "Level 38" },
            { value: 660, label: "Level 39" },
            { value: 720, label: "Level 40" }
        ];
    }
    return levels.map((level, index) => `<option value="${level.value}">${index === 0 ? getGameText("generals_abilities_desc_attack_1018", "None") : t("level", { value: index })}</option>`).join("");
}

function generatePrimaryOptions() {
    const options = [
        { value: 0, label: "No primary item" },
        { value: 108, label: "Base 15" },
        { value: 118, label: "Base 16" },
        { value: 128, label: "Base 17" },
        { value: 138, label: "Base 18" },
        { value: 148, label: "Base 19" },
        { value: 158, label: "Base 20" },
        { value: 168, label: "Base 21" },
        { value: 178, label: "Base 22" },
        { value: 188, label: "Base 23" },
        { value: 198, label: "Base 24" },
        { value: 209, label: "Base 25" },
        { value: 220, label: "Base 26" },
        { value: 231, label: "Base 27" },
        { value: 242, label: "Base 28" },
        { value: 253, label: "Base 29" },
        { value: 264, label: "Base 30" },
        { value: 275, label: "Base 31" },
        { value: 286, label: "Base 32" },
        { value: 297, label: "Base 33" },
        { value: 308, label: "Base 34" },
        { value: 319, label: "Base 35" },
        { value: 331, label: "Base 36" },
        { value: 343, label: "Base 37" },
        { value: 355, label: "Base 38" },
        { value: 367, label: "Base 39" },
        { value: 379, label: "Base 40" },
        { value: 391, label: "Base 41" },
        { value: 403, label: "Base 42" },
        { value: 415, label: "Base 43" },
        { value: 427, label: "Base 44" },
        { value: 439, label: "Base 45" },
    ];
    const basic = getGameText("toolType_basic", "Basic");
    const none = getGameText("generals_abilities_desc_attack_1018", "None");
    return options.map((option, index) => `<option value="${option.value}">${index === 0 ? none : `${basic} ${index + 14}`}</option>`).join("");
}

function generateRelicOptions() {
    const options = [
        { value: 0, label: "No relic item" },
        { value: 50, label: "Relic 1" },
        { value: 150, label: "Relic 2" },
        { value: 250, label: "Relic 3" },
        { value: 350, label: "Relic 4" },
        { value: 450, label: "Relic 5" },
        { value: 550, label: "Relic 6" },
        { value: 650, label: "Relic 7" },
        { value: 750, label: "Relic 8" },
        { value: 850, label: "Relic 9" },
        { value: 1000, label: "Relic 10" },
        { value: 1100, label: "Premium 1" },
        { value: 1200, label: "Premium 2" },
        { value: 1300, label: "Premium 3" },
        { value: 1400, label: "Premium 4" },
        { value: 1500, label: "Premium 5" },
        { value: 1600, label: "Premium 6" },
        { value: 1700, label: "Premium 7" },
        { value: 1800, label: "Premium 8" },
        { value: 1900, label: "Premium 9" },
        { value: 2000, label: "Premium 10" },
        { value: 2100, label: "Premium 11" },
        { value: 2200, label: "Premium 12" },
        { value: 2300, label: "Premium 13" },
        { value: 2400, label: "Premium 14" },
        { value: 2500, label: "Premium 15" },
        { value: 2600, label: "Premium 16" },
        { value: 2700, label: "Premium 17" },
        { value: 2800, label: "Premium 18" },
        { value: 2900, label: "Premium 19" },
        { value: 3000, label: "Premium 20" },
        { value: 3100, label: "Premium 21" },
        { value: 3200, label: "Premium 22" },
        { value: 3300, label: "Premium 23" },
        { value: 3400, label: "Premium 24" },
        { value: 3500, label: "Premium 25" },
        { value: 3600, label: "Premium 26" },
        { value: 3700, label: "Premium 27" },
        { value: 3800, label: "Premium 28" },
        { value: 3900, label: "Premium 29" },
        { value: 4000, label: "Premium 30" }
    ];
    return options.map((option, index) => {
        const relicName = getGameText("relicequip_dialog_category_relic", "Relic");
        const premiumName = getGameText("premium", "Premium");
        if (index === 0) return `<option value="${option.value}">${getGameText("generals_abilities_desc_attack_1018", "None")}</option>`;
        if (index <= 10) return `<option value="${option.value}">${relicName} ${index}</option>`;
        return `<option value="${option.value}">${premiumName} ${index - 10}</option>`;
    }).join("");
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
