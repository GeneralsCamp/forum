/*** MAIN CALCULATION FUNCTION ***/
function calculateActivityPoints() {
  const defeated = parseFloat(document.getElementById("defeated").value) || 0;
  const faced    = parseFloat(document.getElementById("faced").value) || 0;
  const area     = document.getElementById("area").value;
  const level    = parseInt(document.getElementById("level").value) || 1;

  const areaMultipliers = {
    courtyard: 1000,
    walls: 100
  };

  const levelMultipliers = {
    1: 1,
    2: 3,
    3: 8,
    4: 12,
    5: 20,
    6: 25,
    7: 30,
    8: 35,
    9: 40,
    10: 50
  };

  if (faced <= 0) {
    document.getElementById("points").innerHTML = "0";
    return;
  }

  let ratio = defeated / faced;
  ratio = Math.min(ratio, 1);

  const multiplier = areaMultipliers[area] * levelMultipliers[level];
  const points = Math.floor(ratio * multiplier);

  document.getElementById("points").innerHTML = points;
}

/*** SAVE TO LOCAL STORAGE ***/
function saveToLocalStorage() {
  ["defeated", "faced", "area", "level"].forEach(id => {
    localStorage.setItem(id, document.getElementById(id).value);
  });
}

function loadFromLocalStorage() {
  ["defeated", "faced", "area", "level"].forEach(id => {
    if (localStorage.getItem(id) !== null) {
      document.getElementById(id).value = localStorage.getItem(id);
    }
  });

  calculateActivityPoints();
}

window.onload = loadFromLocalStorage;

document.querySelectorAll('input, select').forEach(el => {
  el.addEventListener('change', () => {
    saveToLocalStorage();
    calculateActivityPoints();
  });
});
