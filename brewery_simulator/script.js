/*** BASE DATA ***/
const baseFood = [25000, 50000, 75000, 125000, 175000, 225000, 275000, 300000, 260000, 300000, 320000, 340000, 360000, 285000, 300000, 315000, 330000, 345000, 360000, 375000, 390000, 405000, 420000, 435000, 450000, 465000, 480000, 495000, 510000, 350000];
const baseHoney = [15000, 30000, 45000, 75000, 105000, 135000, 110000, 120000, 130000, 150000, 160000, 170000, 180000, 95000, 100000, 105000, 110000, 115000, 120000, 125000, 130000, 135000, 140000, 145000, 150000, 155000, 160000, 165000, 170000, 175000];
const baseMead = [5000, 10000, 15000, 25000, 35000, 45000, 55000, 60000, 65000, 75000, 80000, 85000, 90000, 95000, 100000, 105000, 110000, 115000, 120000, 125000, 130000, 135000, 140000, 145000, 150000, 155000, 160000, 165000, 170000, 175000];

/*** DOM ELEMENTS ***/
const input = document.getElementById("productionInput");
const honeyProdLabel = document.getElementById("honeyProd");
const foodLabel = document.getElementById("food");
const honeyLabel = document.getElementById("honey");
const meadLabel = document.getElementById("mead");
const unitsHoldLabel = document.getElementById("unitsHold");

let workload = 0;

/*** EVENT LISTENERS ***/
input.addEventListener("input", () => {
    let inputValue = parseInt(input.value) || 0;
    if (inputValue < 0) inputValue = 0;
    if (inputValue > 100) inputValue = 100;
    input.value = inputValue;
    workload = inputValue / 100;
    calculate();
});

document.getElementById("po").addEventListener("input", () => {
    const poInput = parseInt(document.getElementById("po").value) || 0;
    document.getElementById("po").value = poInput;
    calculate();
});

/*** MAIN CALCULATION FUNCTION ***/
function calculate() {
    /*** HONEY CALCULATION ***/
    const po = parseInt(document.getElementById("po").value) || 0;
    const PObonus = po >= 0 ? (Math.sqrt(po) * 2 + 100) / 100 : 100 / (100 + 2 * Math.sqrt(-po));

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
    const finalHoney = Math.floor(BaseHoneyProd * PObonus * (1 + ApercentBonuses) + ArelicElem * apiaryAmount + Deco);
    honeyProdLabel.textContent = finalHoney.toLocaleString();

    /*** MEAD CALCULATION ***/
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

    let finalMeadValue = Math.floor((workload * baseMeadProd * PObonus * (1 + percentBonuses) + relicElem + decoMead) * 10) / 10;

    if (finalMeadValue % 1 === 0) {
        meadLabel.textContent = finalMeadValue.toLocaleString();
    } else {
        meadLabel.textContent = finalMeadValue.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }

    foodLabel.textContent = Math.round(baseFood[breweryLvl - 1] * workload).toLocaleString();
    honeyLabel.textContent = Math.round(baseHoney[breweryLvl - 1] * workload).toLocaleString();

    /*** UNITS HOLD CALCULATION ***/
    const dist = parseFloat(document.getElementById("dist").value) || 0;
    const consumption = 2 * (1 - dist);
    const unitsHold = Math.floor(finalMead / consumption);
    unitsHoldLabel.textContent = unitsHold.toLocaleString();
}

/*** LOCAL STORAGE HANDLING ***/
function saveToCache() {
    document.querySelectorAll('input, select').forEach(el => localStorage.setItem(el.id, el.value));
}

function loadFromCache() {
    document.querySelectorAll('input, select').forEach(el => {
        const value = localStorage.getItem(el.id);
        if (value !== null) el.value = value;
    });
}

/*** INITIALIZATION ***/
document.addEventListener('DOMContentLoaded', () => {
    loadFromCache();
    workload = parseInt(input.value || 0) / 100;
    calculate();

    document.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('change', () => {
            saveToCache();
            calculate();
        });
    });
});
