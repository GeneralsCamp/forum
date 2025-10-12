const BASIC_FIELD_TRAVEL_TIME = 600;
const MAX_LEVEL_FOR_LOW_LEVEL_TRAVEL_BOOST = 25;
const LOW_DISTANCE_BOOST_FIELDS = 100;
const HORSE_BOOST_FIELDS = 10;

const horseBonusTable = {
    1: { Horse: 6, Warhorse: 10, Courser: 16 },
    2: { Horse: 10, Warhorse: 16, Courser: 27 },
    3: { Horse: 13, Warhorse: 22, Courser: 35 }
};

function getHorseBoostPercent(stableLevel, horseType) {
    if (horseType === "none" || stableLevel === 0) return 0;
    const table = horseBonusTable[stableLevel];
    return table && table[horseType] ? table[horseType] : 0;
}

function calculateLowLevelBoost(level) {
    if (level > MAX_LEVEL_FOR_LOW_LEVEL_TRAVEL_BOOST) return 0;
    return (100 * Math.max(0, -0.1667 * level + 4.167)) / 100;
}

function hmsFromSeconds(sec) {
    const s = Math.trunc(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function getTravelTime(unitSpeed, distance, horseBoost, percentageBoost, totalDistance) {
    const unitSpeedInFieldsPerSecond = unitSpeed / 10 / (10 * 60);
    const boostPercentAsFactor = percentageBoost / 100;
    let boostedUnitSpeed = unitSpeedInFieldsPerSecond * (1 + boostPercentAsFactor);

    let scaledHorseBoost = 1;
    if (horseBoost > 0) {
        if (distance < 100) {
            scaledHorseBoost += (horseBoost / 100.0 / 10) *
                60 * (Math.log(totalDistance / 2 + 1) / Math.log(8));
        } else {
            scaledHorseBoost += (horseBoost / 100.0 / 10) * (totalDistance - 10);
            distance -= 10;
        }
    }

    boostedUnitSpeed *= scaledHorseBoost;
    const travelTimeInSeconds = distance / boostedUnitSpeed;
    return Math.floor(travelTimeInSeconds);
}

function parseMmSs(str) {
    const p = str.trim().split(':').map(s => s.trim());
    if (p.length !== 2) return NaN;
    const mm = Number(p[0]), ss = Number(p[1]);
    if (!Number.isFinite(mm) || !Number.isFinite(ss) || mm < 0 || ss < 0) return NaN;
    return mm * 60 + ss;
}

function calculateTroopDetection(rawTimeWithoutHorse, adjustedTime, distance) {
    const units = Number(document.getElementById('attackerUnits').value);
    const earlyDetection = Number(document.getElementById('earlyDetection').value) || 0;
    const laterDetection = Number(document.getElementById('laterDetection').value) || 0;
    const sightBonus = Number(document.getElementById('sightBonus').value) || 0;

    if (!Number.isFinite(units) || units <= 0 ||
        !Number.isFinite(distance) || distance <= 0 ||
        !Number.isFinite(rawTimeWithoutHorse) || rawTimeWithoutHorse <= 0) {
        document.getElementById('detectionTime').innerText = "00:00:00";
        return;
    }

    console.clear();
    console.log("Raw time (sec):", rawTimeWithoutHorse);
    console.log("Adjusted time (sec):", adjustedTime);

    let baseSightRadius = 0.6 * Math.pow(units, 0.4);
    let sightRadiusWithBonus = baseSightRadius * (1 + sightBonus / 100);
    let sightRadius = Math.max(6, sightRadiusWithBonus);
    console.log("Sight radius:", sightRadius);

    let detectTimeSec = (sightRadius / distance) * rawTimeWithoutHorse;
    console.log("Detect time before boosts:", detectTimeSec);

    let totalDetectionPercent = Math.max((1 + laterDetection / 100) / (1 + earlyDetection / 100), 0.1);
    console.log("Later detection:", laterDetection);
    console.log("Early detection:", earlyDetection);
    console.log("Total detection percent:", totalDetectionPercent);

    detectTimeSec *= totalDetectionPercent;
    console.log("Detect time after boosts:", detectTimeSec);

    detectTimeSec = Math.min(detectTimeSec, adjustedTime);
    console.log("After applying maximum:", detectTimeSec);

    //document.getElementById('detectionTime').textContent = hmsFromSeconds(detectTimeSec);
}

function render() {
    const distance = parseFloat(document.getElementById('distance').value);
    const speed = parseFloat(document.getElementById('speed').value);
    const playerLevel = parseInt(document.getElementById('playerLevel').value) || 1;

    const commander = parseFloat(document.getElementById('commander')?.value) || 0;
    const glory = parseFloat(document.getElementById('glory')?.value) || 0;
    const vip = parseFloat(document.getElementById('vip')?.value) || 0;
    const global = parseFloat(document.getElementById('global')?.value) || 0;
    const hol = parseFloat(document.getElementById('hol')?.value) || 0;
    const war = parseFloat(document.getElementById('war')?.value) || 0;

    const stableLevel = parseInt(document.getElementById('stableLevel').value);
    const horseType = document.getElementById('horseType').value;

    const horseBoostPercent = getHorseBoostPercent(stableLevel, horseType);
    const totalBonus = commander + glory + vip + global + hol + war;
    const lowLevelBoost = calculateLowLevelBoost(playerLevel);

    const rawTimeWithoutHorse = getTravelTime(speed, distance, 0, totalBonus, distance);

    const rawTimeWithHorse = getTravelTime(speed, distance, horseBoostPercent, totalBonus, distance);

    const adjustedTime = rawTimeWithHorse / (1 + lowLevelBoost);

    document.getElementById('arrivalTime').textContent = hmsFromSeconds(adjustedTime);

    calculateTroopDetection(rawTimeWithoutHorse, adjustedTime, distance);
    updateHorseTypeState();
    saveInputs();
}

function updateHorseTypeState() {
    const stableLevel = parseInt(document.getElementById('stableLevel').value) || 0;
    const horseSelect = document.getElementById('horseType');
    if (!horseSelect) return;

    if (stableLevel === 0) {
        horseSelect.value = "none";
        horseSelect.disabled = true;
    } else {
        horseSelect.disabled = false;
    }
}

function saveInputs() {
    const inputs = document.querySelectorAll('input, select');
    const data = {};
    inputs.forEach(el => {
        data[el.id] = el.value;
    });
    localStorage.setItem("travelCalcData", JSON.stringify(data));
}

function loadInputs() {
    const saved = localStorage.getItem("travelCalcData");
    if (!saved) return;
    const data = JSON.parse(saved);
    for (const [id, value] of Object.entries(data)) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }
}

document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', render));

loadInputs();
render();