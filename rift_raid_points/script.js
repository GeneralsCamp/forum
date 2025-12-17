/*** MAIN CALCULATION FUNCTION ***/
const raidBossLevels = {
  1: { faced: 50000, multiplier: 1 },
  2: { faced: 75000, multiplier: 3 },
  3: { faced: 150000, multiplier: 8 },
  4: { faced: 300000, multiplier: 12 },
  5: { faced: 350000, multiplier: 20 },
  6: { faced: 400000, multiplier: 25 },
  7: { faced: 450000, multiplier: 30 },
  8: { faced: 500000, multiplier: 35 },
  9: { faced: 600000, multiplier: 40 },
  10: { faced: 700000, multiplier: 50 }
};

function calculateActivityPoints() {
  const defeated = Number(document.getElementById("defeated").value) || 0;
  const area = document.getElementById("area").value;
  const level = Number(document.getElementById("level").value) || 1;

  const areaMultipliers = {
    courtyard: 1000,
    walls: 100
  };

  const levelData = raidBossLevels[level];
  if (!levelData) {
    document.getElementById("points").innerHTML = "0";
    return;
  }

  const faced = levelData.faced;
  const levelMultiplier = levelData.multiplier;

  document.getElementById("faced").value = faced;

  if (faced <= 0 || defeated <= 0) {
    document.getElementById("points").innerHTML = "0";
    return;
  }

  const ratio = Math.min(defeated / faced, 1);

  const points = Math.ceil(
    ratio * areaMultipliers[area] * levelMultiplier + Number.EPSILON
  );

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
