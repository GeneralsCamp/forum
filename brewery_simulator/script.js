const input = document.getElementById("productionInput");
const slider = document.getElementById("productionSlider");

const honeyProdLabel = document.getElementById("honeyProd");
const foodLabel = document.getElementById("food");
const honeyLabel = document.getElementById("honey");
const meadLabel = document.getElementById("mead");
const unitsHoldLabel = document.getElementById("unitsHold");

let workload = 0;

document.getElementById("productionInput").addEventListener("input", () => {
    let inputValue = parseInt(input.value);

    if (inputValue < 0) {
        inputValue = 0;
    } else if (inputValue > 100) {
        inputValue = 100;
    }

    input.value = inputValue;
    workload = inputValue / 100;
    calculate();
});

document.getElementById("po").addEventListener("input", () => {
    const po = parseInt(document.getElementById("po").value) || 0;
    document.getElementById("po").value = po;
});

const baseFood = [25000, 50000, 75000, 125000, 175000, 225000, 275000, 300000, 260000, 300000, 320000, 340000, 360000, 285000, 300000, 315000, 330000, 345000, 360000, 375000, 390000, 405000, 420000, 435000, 450000, 465000, 480000, 495000, 510000, 350000];
const baseHoney = [15000, 30000, 45000, 75000, 105000, 135000, 110000, 120000, 130000, 150000, 160000, 170000, 180000, 95000, 100000, 105000, 110000, 115000, 120000, 125000, 130000, 135000, 140000, 145000, 150000, 155000, 160000, 165000, 170000, 175000];
const baseMead = [5000, 10000, 15000, 25000, 35000, 45000, 55000, 60000, 65000, 75000, 80000, 85000, 90000, 95000, 100000, 105000, 110000, 115000, 120000, 125000, 130000, 135000, 140000, 145000, 150000, 155000, 160000, 165000, 170000, 175000];

function calculate() {
    const po = parseInt(document.getElementById("po").value) || 0;
    const PObonus = po >= 0
        ? (Math.sqrt(po) * 2 + 100) / 100
        : 100 / (100 + 2 * Math.sqrt(-po));

    const apiaryAmount = parseInt(document.getElementById("apiaryAmount").value) || 0;
    const apiaryLvl = parseInt(document.getElementById("apiaryLvl").value) || 0;
    const Aoverseer = parseFloat(document.getElementById("Aoverseer").value) || 0;
    const Aresearch = parseFloat(document.getElementById("Aresearch").value) || 0;
    const Agardens = parseFloat(document.getElementById("Agardens").value) || 0;
    const Acoat = parseFloat(document.getElementById("Acoat").value) || 0;
    const AbaseElem = parseInt(document.getElementById("AbaseElem").value) || 0;
    const ArelicElem = parseInt(document.getElementById("ArelicElem").value) || 0;
    const AstormsTitle = parseFloat(document.getElementById("AstormsTitle").value) || 0;
    const Acast = parseFloat(document.getElementById("Acast").value) || 0;
    const Deco = parseInt(document.getElementById("deco").value) || 0;

    const ApercentBonuses = Aoverseer + Aresearch + Agardens + Acoat + AstormsTitle + Acast;
    const BaseHoneyProd = (apiaryLvl + AbaseElem) * apiaryAmount;

    const finalHoney = (BaseHoneyProd * (PObonus * (1 + ApercentBonuses))) + (ArelicElem * apiaryAmount) + Deco;
    honeyProdLabel.textContent = `${Math.round(finalHoney).toLocaleString()} /hour`;

    const breweryLvl = parseInt(document.getElementById("breweryLvl").value) || 1;
    const overseer = parseFloat(document.getElementById("overseer").value) || 0;
    const research = parseFloat(document.getElementById("research").value) || 0;
    const barrel = parseFloat(document.getElementById("barrel").value) || 0;
    const coat = parseFloat(document.getElementById("coat").value) || 0;
    const baseElem = parseInt(document.getElementById("baseElem").value) || 0;
    const relicElem = parseInt(document.getElementById("relicElem").value) || 0;
    const stormsTitle = parseFloat(document.getElementById("stormsTitle").value) || 0;
    const cast = parseFloat(document.getElementById("cast").value) || 0;
    const decoMead = parseInt(document.getElementById("decoMead").value) || 0;

    const percentBonuses = overseer + research + barrel + coat + stormsTitle + cast;
    const baseMeadProd = baseMead[breweryLvl - 1] + baseElem;

    const finalMead = workload * (baseMeadProd * (PObonus * (1 + percentBonuses))) + relicElem + decoMead;

    foodLabel.textContent = Math.round(baseFood[breweryLvl - 1] * workload).toLocaleString();
    honeyLabel.textContent = Math.round(baseHoney[breweryLvl - 1] * workload).toLocaleString();
    meadLabel.textContent = Math.round(finalMead).toLocaleString();

    const dist = parseFloat(document.getElementById("dist").value) || 0;
    const consumption = 2 * (1 - dist);
    const unitsHold = finalMead / consumption;

    unitsHoldLabel.textContent = Math.round(unitsHold).toLocaleString();
}

function saveToCache() {
    document.querySelectorAll('input, select').forEach(input => {
        localStorage.setItem(input.id, input.value);
    });
}

function loadFromCache() {
    document.querySelectorAll('input, select').forEach(input => {
        const cachedValue = localStorage.getItem(input.id);
        if (cachedValue !== null) {
            input.value = cachedValue;
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadFromCache();
    calculate();

    document.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', () => {
            saveToCache();
            calculate();
        });
    });
});
