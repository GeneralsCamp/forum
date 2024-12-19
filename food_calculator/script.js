window.addEventListener('DOMContentLoaded', (event) => {
    LocationModify();
    Calculate();
});

selectLocation = document.getElementById("location")

selectMain = document.getElementById("vip-main")
selectOP = document.getElementById("vip-op")
selectKingdom = document.getElementById("vip-kingdom")

selectHuntGreen = document.getElementById("hunt-green")
selectHuntKingdom = document.getElementById("hunt-kingdom")

selectVillages = document.getElementById("villages")

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

function Calculate() {
    CalculateBonuses();
    const buildings = ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8"];
    buildings.forEach(updateBuilding);
}


function CalculateBonuses() {
    selectLocation = document.getElementById("location")

    selectMain = document.getElementById("vip-main")
    selectOP = document.getElementById("vip-op")
    selectKingdom = document.getElementById("vip-kingdom")

    selectHuntGreen = document.getElementById("hunt-green")
    selectHuntKingdom = document.getElementById("hunt-kingdom")

    selectVillages = document.getElementById("villages")

    selectedLocation = selectLocation.value;
    selectBeri = document.getElementById("beri");

    po = document.getElementById("po").value;
    if (po > 0) {
        PObonus = Math.sqrt(parseInt(po)) * 2 + 100;
        PObonus = PObonus / 100;
    }
    else {
        PObonus = (100 / (100 + 2 * Math.sqrt(-po)))
    }
    coat = document.getElementById("coat").value;
    if (selectedLocation == "kingdom") {
        hunt = document.getElementById("hunt-kingdom").value;
    }
    else {
        hunt = document.getElementById("hunt-green").value;
    }
    mill = document.getElementById("mill").value;
    deco2 = 0;
    deco2 = document.getElementById("deco2").value / 100;

    if (selectBeri.value == "kingdoms") {
        beriKingdoms = 0.20;
        beriGreen = 0;
    }
    else if (selectBeri.value == "both") {
        beriKingdoms = 0.20;
        beriGreen = 0.20;
    }
    else {
        beriGreen = 0;
        beriKingdoms = 0;
    }
    overseer = document.getElementById("overseer").value;
    if (selectedLocation == "main") {
        vip = document.getElementById("vip-main").value;
    }
    else if (selectedLocation == "op6" || selectedLocation == "op8") {
        vip = document.getElementById("vip-op").value;
    }
    else if (selectedLocation == "kingdom") {
        vip = document.getElementById("vip-kingdom").value;
    }
    if (selectedLocation == "kingdom") {
        villages = document.getElementById("villages").value;
        villages = villages / 100;
    }
    res1 = 0;
    res1 = document.getElementById("res1").value

    res2 = document.getElementById("res2").value;
    sub = document.getElementById("sub").value;

    cast = 0;
    var castInput = document.getElementById("cast").value;
    if (castInput === "" || isNaN(castInput)) {
        cast = 0;
    } else {
        cast = parseInt(castInput);
    }

    decobonus = 0;
    var decoInput = document.getElementById("deco1").value;
    if (decoInput === "" || isNaN(decoInput)) {
        decobonus = 0;
    } else {
        decobonus = parseInt(decoInput);
    }

    tcibonus = 0;
    var tciInput = document.getElementById("foodTCI").value;
    if (tciInput === "" || isNaN(tciInput)) {
        tcibonus = 0;
    } else {
        tcibonus = parseInt(tciInput);
    }

    if (selectedLocation == "main" || selectedLocation == "op6" || selectedLocation == "op8") {
        percentBonus = (parseFloat(PObonus)) * (1 + beriGreen) * (parseFloat(coat) + parseFloat(mill) + parseFloat(deco2) + parseFloat(overseer) + parseFloat(vip) + parseFloat(res2) + parseFloat(sub) + parseFloat(hunt));
        constBonus = parseFloat(cast) + parseFloat(res1) + parseFloat(decobonus) + parseFloat(tcibonus);
    }
    else if (selectedLocation == "kingdom") {
        percentBonus = (parseFloat(PObonus)) * (parseFloat(coat) + parseFloat(mill) + parseFloat(deco2) + parseFloat(overseer) + parseFloat(vip) + parseFloat(res2) + parseFloat(sub) + parseFloat(hunt) + parseFloat(beriKingdoms) + parseFloat(villages));
        constBonus = parseFloat(cast) + parseFloat(res1) + parseFloat(decobonus) + parseFloat(tcibonus);
    }

    document.getElementById("percentBonus").innerHTML = Math.round(percentBonus * 100) + "%";
    document.getElementById("constBonus").innerHTML = constBonus + "&nbsp;/hour";

}

//Generate buildings
function generateBuildingCards() {
    const buildingsData = [
        { id: "b1", name: "Conservatory", type: "conservatory", imgSrc: "./img/conservatory.webp" },
        { id: "b2", name: "Conservatory", type: "conservatory", imgSrc: "./img/conservatory.webp" },
        { id: "b3", name: "Greenhouse", type: "greenhouse", imgSrc: "./img/greenhouse.webp" },
        { id: "b4", name: "Greenhouse", type: "greenhouse", imgSrc: "./img/greenhouse.webp" },
        { id: "b5", name: "Granary", type: "granary", imgSrc: "./img/granary.webp" },
        { id: "b6", name: "Granary", type: "granary", imgSrc: "./img/granary.webp" },
        { id: "b7", name: "Granary", type: "granary", imgSrc: "./img/granary.webp" },
        { id: "b8", name: "Granary", type: "granary", imgSrc: "./img/granary.webp" },
    ];

    const container = document.getElementById("buildings-container");
    container.innerHTML = "";

    buildingsData.forEach((building) => {
        const buildingCard = `
            <div class="col-md-6 col-sm-12 col-lg-6">
                <div class="box">
                    <div class="box-icon">
                        <img src="${building.imgSrc}" class="img-fluid">
                    </div>
                    <div class="box-content">
                        <h2>
                        ${building.name} |
                        <select class="fixSelector" name="${building.id}lvl" id="${building.id}lvl" onchange="updateBuilding('${building.id}')">
                            ${generateLevelOptions(building.type)}
                        </select>
                        </h2>
                        <hr>
                        <p>Productivity: <span id="${building.id}prod">-</span></p>
                        <p>Production: <span id="${building.id}lbl">-</span></p>
                        <select class="fixSelector" name="${building.id}elem" id="${building.id}elem" onchange="updateBuilding('${building.id}')">
                            ${generatePrimaryOptions()}
                        </select>
                        <select class="fixSelector" name="${building.id}relicElem" id="${building.id}relicElem" onchange="updateBuilding('${building.id}')">
                            ${generateRelicOptions()}
                        </select>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += buildingCard;
    });

    buildingsData.forEach((building) => updateBuilding(building.id));
}


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

    return levels.map(level => `<option value="${level.value}">${level.label}</option>`).join("");
}


function generatePrimaryOptions() {
    const options = [
        { value: 0, label: "None" },
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

    return options.map(option => `<option value="${option.value}">${option.label}</option>`).join("");
}

function generateRelicOptions() {
    const options = [
        { value: 0, label: "None" },
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
    
    return options.map(option => `<option value="${option.value}">${option.label}</option>`).join("");
}

function calculateProduction(level, primaryItem, relicItem, productivity) {
    const baseProduction = level + primaryItem;

    const bonusProduction = baseProduction * percentBonus;

    const totalProduction = ((bonusProduction) * productivity) + relicItem;


    return Math.round(totalProduction);
}

function updateBuilding(buildingId) {
    const levelElement = document.getElementById(`${buildingId}lvl`);
    const primaryItemElement = document.getElementById(`${buildingId}elem`);
    const relicItemElement = document.getElementById(`${buildingId}relicElem`);

    const level = levelElement ? parseInt(levelElement.value) || 0 : 0;
    const primaryItem = primaryItemElement ? parseInt(primaryItemElement.value) || 0 : 0;
    const relicItem = relicItemElement ? parseInt(relicItemElement.value) || 0 : 0;

    let work;
    const selectLocation = document.getElementById('location');

    if (selectLocation.value == "main") {
        work = [0, 1, 1, 1, 0.75, 0.56, 0.42, 0.31, 0.23, 0.17, 0.13, 0.10];
    } else if (selectLocation.value == "op6") {
        work = [0, 1, 1, 1, 1, 1, 1, 0.75, 0.56, 0.42, 0.31, 0.23];
    } else if (selectLocation.value == "op8") {
        work = [0, 1, 1, 1, 1, 1, 1, 1, 1, 0.75, 0.56, 0.42];
    } else if (selectLocation.value == "kingdom") {
        work = [0, 1, 1, 0.75, 0.56, 0.42, 0.31, 0.23, 0.17, 0.13, 0.10, 0.07];
    }

    const buildingIndex = parseInt(buildingId.replace(/[^\d]/g, ''));
    const productivity = work[buildingIndex] || 0;

    const production = calculateProduction(level, primaryItem, relicItem, productivity);

    const productionElement = document.getElementById(`${buildingId}prod`);
    if (productionElement) {
        productionElement.textContent = `${(productivity * 100).toFixed(0)}%`;
    }

    const labelElement = document.getElementById(`${buildingId}lbl`);
    if (labelElement) {
        labelElement.textContent = `${production.toLocaleString()}/h`;
    }


    document.getElementById(`${buildingId}lbl`).innerText = production;

    let totalProduction = 0;
    const buildingIds = ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8"];
    buildingIds.forEach(id => {
        const buildingProd = parseInt(document.getElementById(`${id}lbl`).innerText);
        if (!isNaN(buildingProd)) {
            totalProduction += buildingProd;
        }
    });

    cast = 0;
    var castInput = document.getElementById("cast").value;
    if (castInput === "" || isNaN(castInput)) {
        cast = 0;
    } else {
        cast = parseInt(castInput);
    }

    decobonus = 0;
    var decoInput = document.getElementById("deco1").value;
    if (decoInput === "" || isNaN(decoInput)) {
        decobonus = 0;
    } else {
        decobonus = parseInt(decoInput);
    }

    tcibonus = 0;
    var tciInput = document.getElementById("foodTCI").value;
    if (tciInput === "" || isNaN(tciInput)) {
        tcibonus = 0;
    } else {
        tcibonus = parseInt(tciInput);
    }

    let totalProductionWithBonuses = totalProduction + cast + decobonus + tcibonus;

    document.getElementById("finalProduction").innerText = "TOTAL PRODUCTION: " + totalProductionWithBonuses + " /hour";
}

generateBuildingCards();
