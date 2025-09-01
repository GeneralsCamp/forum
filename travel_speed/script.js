const BASIC_FIELD_TRAVEL_TIME = 600;
const MAX_LEVEL_FOR_LOW_LEVEL_TRAVEL_BOOST = 25;

function calculateLowLevelBoost(level, specialCondition) {
    if (specialCondition || level > MAX_LEVEL_FOR_LOW_LEVEL_TRAVEL_BOOST) return 0;
    return (100 * Math.max(0, -0.1667 * level + 4.167)) / 100;
}

function getTravelTimeAsFloat(speed, distance, additionalSpeedBoostPercentage, specialCondition) {
    const speedBoost = additionalSpeedBoostPercentage / 100.0;
    const baseSpeed = ((speed / 10.0) / BASIC_FIELD_TRAVEL_TIME) * (1 + speedBoost);
    return specialCondition ? 0 : distance / baseSpeed;
}

function hmsFromSeconds(sec) {
    const s = Math.trunc(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function render() {
    const distance = parseFloat(document.getElementById('distance').value);
    const speed = parseFloat(document.getElementById('speed').value);
    const specialCond = parseInt(document.getElementById('specialCond').value) || 0;
    const playerLevel = parseInt(document.getElementById('playerLevel').value) || 950;

    const commander = parseFloat(document.getElementById('commander').value) || 0;
    const glory = parseFloat(document.getElementById('glory').value) || 0;
    const vip = parseFloat(document.getElementById('vip').value) || 0;
    const global = parseFloat(document.getElementById('global').value) || 0;
    const hol = parseFloat(document.getElementById('hol').value) || 0;
    const war = parseFloat(document.getElementById('war').value) || 0;

    const horseInput = parseFloat(document.getElementById('horse').value) || 0;
    const horseMultiplier = Math.max(0.05, Math.min(1, 1 - horseInput / 100));

    const totalBonus = commander + glory + vip + global + hol + war;

    const lowLevelBoost = calculateLowLevelBoost(playerLevel, specialCond);
    const rawTime = getTravelTimeAsFloat(speed, distance, totalBonus, specialCond);
    const adjustedTime = rawTime / (1 + lowLevelBoost) * horseMultiplier;

    document.getElementById('time').textContent = hmsFromSeconds(adjustedTime);
    document.getElementById('total-percentage-bonus').textContent = totalBonus.toFixed(2) + "%";
}

document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', render));
render();