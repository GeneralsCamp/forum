/*** MAIN CALCULATION DATA ***/
const raidBossLevels = {
  1: { courtyardTroops: 50000, wallTroops: 3800, multiplier: 1 },
  2: { courtyardTroops: 75000, wallTroops: 5000, multiplier: 3 },
  3: { courtyardTroops: 150000, wallTroops: 14200, multiplier: 8 },
  4: { courtyardTroops: 300000, wallTroops: 36500, multiplier: 12 },
  5: { courtyardTroops: 350000, wallTroops: 43000, multiplier: 20 },
  6: { courtyardTroops: 400000, wallTroops: 49000, multiplier: 25 },
  7: { courtyardTroops: 450000, wallTroops: 54600, multiplier: 30 },
  8: { courtyardTroops: 500000, wallTroops: 57300, multiplier: 35 },
  9: { courtyardTroops: 600000, wallTroops: 65900, multiplier: 40 },
  10: { courtyardTroops: 700000, wallTroops: 90000, multiplier: 50 }
};

function getTroopsForSelectedArea(levelData, area) {
  if (area === "walls") return levelData.wallTroops;
  return levelData.courtyardTroops;
}

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

  document.getElementById("courtyardTroops").value = levelData.courtyardTroops;
  document.getElementById("wallTroops").value = levelData.wallTroops;

  updateTroopsVisibility(area);

  const troopsForArea =
    area === "walls"
      ? levelData.wallTroops
      : levelData.courtyardTroops;

  const levelMultiplier = levelData.multiplier;

  if (troopsForArea <= 0 || defeated <= 0) {
    document.getElementById("points").innerHTML = "0";
    return;
  }

  const ratio = Math.min(defeated / troopsForArea, 1);

  const points = Math.ceil(
    ratio * areaMultipliers[area] * levelMultiplier + Number.EPSILON
  );

  document.getElementById("points").innerHTML = points;
}


function updateTroopsVisibility(area) {
  const courtyardBox = document.getElementById("courtyardBox");
  const wallBox = document.getElementById("wallBox");

  if (area === "walls") {
    wallBox.style.display = "block";
    courtyardBox.style.display = "none";
  } else {
    courtyardBox.style.display = "block";
    wallBox.style.display = "none";
  }
}

/*** SAVE TO LOCAL STORAGE ***/
function saveToLocalStorage() {
  ["defeated", "area", "level"].forEach(id => {
    localStorage.setItem(id, document.getElementById(id).value);
  });
}

function loadFromLocalStorage() {
  ["defeated", "area", "level"].forEach(id => {
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
