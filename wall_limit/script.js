//Calculate
function calculateDefenders() {
  var towers = parseInt(document.getElementById("towers").value);
  var level = parseInt(document.getElementById("level").value);

  var defenders = 0;

  if (towers >= 0 && towers <= 25 && level >= 0 && level <= 8) {
    var defendersTable = {
      0: 2,
      1: 10,
      2: 20,
      3: 30,
      4: 40,
      5: 50,
      6: 65,
      7: 80,
      8: 100
    };

    defenders = defendersTable[level] * towers;
  }

  var tempItems = parseFloat(document.getElementById("temp_items").value) || 0;
  var constantItems = parseFloat(document.getElementById("constant_items").value) || 0;
  var tools = parseFloat(document.getElementById("tools").value) || 0;
  var equipment = parseFloat(document.getElementById("equipment1").value) || 0;
  var hol = parseFloat(document.getElementById("hol").value) || 0;
  var generals = parseFloat(document.getElementById("generals").value) || 0;
  var deco = parseFloat(document.getElementById("deco").value) || 0;

  var totalPercentageBonus = tools + equipment + hol + generals + deco;
  var totalSoldiersBonus = constantItems + tempItems;

  var totalDefenders = defenders + totalSoldiersBonus;
  totalDefenders += (totalDefenders * totalPercentageBonus / 100);

  document.getElementById("total-percentage-bonus").innerHTML = totalPercentageBonus.toFixed(2) + " %";
  document.getElementById("total-soldiers-bonus").innerHTML = totalSoldiersBonus.toFixed(0) + " units";
  document.getElementById("total-defenders").innerHTML = totalDefenders.toFixed(0) + " units";
}

//Save & load from cache
function saveToLocalStorage() {
  localStorage.setItem("towers", document.getElementById("towers").value);
  localStorage.setItem("level", document.getElementById("level").value);
  localStorage.setItem("temp_items", document.getElementById("temp_items").value);
  localStorage.setItem("constant_items", document.getElementById("constant_items").value);
  localStorage.setItem("tools", document.getElementById("tools").value);
  localStorage.setItem("equipment1", document.getElementById("equipment1").value);
  localStorage.setItem("hol", document.getElementById("hol").value);
  localStorage.setItem("generals", document.getElementById("generals").value);
  localStorage.setItem("deco", document.getElementById("deco").value);
}

function loadFromLocalStorage() {
  if (localStorage.getItem("towers") !== null) {
    document.getElementById("towers").value = localStorage.getItem("towers");
    document.getElementById("level").value = localStorage.getItem("level");
    document.getElementById("temp_items").value = localStorage.getItem("temp_items");
    document.getElementById("constant_items").value = localStorage.getItem("constant_items");
    document.getElementById("tools").value = localStorage.getItem("tools");
    document.getElementById("equipment1").value = localStorage.getItem("equipment1");
    document.getElementById("hol").value = localStorage.getItem("hol");
    document.getElementById("generals").value = localStorage.getItem("generals");
    document.getElementById("deco").value = localStorage.getItem("deco");
  }
  calculateDefenders();
}

window.onload = loadFromLocalStorage;

document.querySelectorAll('input, select').forEach(input => {
  input.addEventListener('change', saveToLocalStorage);
});
