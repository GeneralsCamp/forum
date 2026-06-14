import { saveCalculatorData, loadCalculatorData } from "../../overviews/shared/GameSettings.mjs";

const CALC_NAME = "wall_limit";

/*** MAIN CALCULATION FUNCTION ***/
function calculateDefenders() {
  const towers = parseInt(document.getElementById("towers").value) || 0;
  const level = parseInt(document.getElementById("level").value) || 0;

  let defenders = 0;

  if (towers >= 0 && towers <= 25 && level >= 0 && level <= 9) {
    const defendersTable = {
      0: 2,
      1: 10,
      2: 20,
      3: 30,
      4: 40,
      5: 50,
      6: 65,
      7: 80,
      8: 100,
      9: 105
    };

    defenders = defendersTable[level] * towers;
  }

  const tempItems   = parseFloat(document.getElementById("temp_items").value)   || 0;
  const constantItems = parseFloat(document.getElementById("constant_items").value) || 0;
  const tools       = parseFloat(document.getElementById("tools").value)       || 0;
  const equipment   = parseFloat(document.getElementById("equipment1").value)  || 0;
  const hol         = parseFloat(document.getElementById("hol").value)         || 0;
  const generals    = parseFloat(document.getElementById("generals").value)    || 0;
  const deco        = parseFloat(document.getElementById("deco").value)        || 0;

  const totalPercentageBonus = tools + equipment + hol + generals + deco;
  const totalSoldiersBonus = constantItems + tempItems;

  let totalDefenders = defenders + totalSoldiersBonus;

  totalDefenders += (totalDefenders * totalPercentageBonus / 100);

  document.getElementById("total-percentage-bonus").innerHTML = totalPercentageBonus.toFixed(2) + " %";
  document.getElementById("total-soldiers-bonus").innerHTML = totalSoldiersBonus.toFixed(0) + " units";
  document.getElementById("total-defenders").innerHTML = totalDefenders.toFixed(0) + " units";
}

/*** SAVE TO LOCAL STORAGE ***/
function saveToLocalStorage() {
  const data = {};
  document.querySelectorAll('input, select').forEach(input => {
    data[input.id] = input.value;
  });
  saveCalculatorData(CALC_NAME, data);
}

function loadFromLocalStorage() {
  const data = loadCalculatorData(CALC_NAME);
  if (data) {
    Object.entries(data).forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (input) input.value = value;
    });
  }

  calculateDefenders();
}

window.calculateDefenders = calculateDefenders;

document.addEventListener('DOMContentLoaded', loadFromLocalStorage);

document.querySelectorAll('input, select').forEach(input => {
  input.addEventListener('change', () => {
    saveToLocalStorage();
    calculateDefenders();
  });
});
