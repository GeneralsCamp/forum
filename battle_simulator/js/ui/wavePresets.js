import { totalUnits, totalTools, attackBasics, currentSide } from '../data/variables.js';
import { switchSide, generateWaves } from '../ui/uiWaves.js';

let currentWaveIndex = 1;
let selectedPreset = null;
let presets = {};
let notificationTimeout = null;

export function openWaveCopyModal() {
    const modalEl = document.getElementById('waveCopyModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    document.getElementById('currentWaveText').textContent = `Wave ${currentWaveIndex} / ${attackBasics.maxWaves}`;

    const presetItems = modalEl.querySelectorAll('.preset-item');
    presetItems.forEach((item, i) => {
        item.onclick = () => selectPreset(i + 1);
    });

    const applyBtn = modalEl.querySelector('#applyPresetBtn');
    applyBtn.onclick = applyPreset;

    const applyAllBtn = modalEl.querySelector('#applyPresetAllBtn');
    applyAllBtn.onclick = applyPresetToAll;

    const saveBtn = modalEl.querySelector('#savePresetBtn');
    saveBtn.onclick = saveToPreset;

    const prevWaveBtn = modalEl.querySelector('#prevWaveBtn');
    const nextWaveBtn = modalEl.querySelector('#nextWaveBtn');

    prevWaveBtn.onclick = () => changeWave(-1);
    nextWaveBtn.onclick = () => changeWave(1);
}

export function changeWave(direction) {
    currentWaveIndex += direction;

    if (currentWaveIndex > attackBasics.maxWaves) currentWaveIndex = 1;
    if (currentWaveIndex < 1) currentWaveIndex = attackBasics.maxWaves;

    document.getElementById('currentWaveText').textContent = `Wave ${currentWaveIndex} / ${attackBasics.maxWaves}`;
}

export function selectPreset(presetNumber) {
    selectedPreset = presetNumber;
    const presetItems = document.querySelectorAll('.preset-item');
    presetItems.forEach(item => item.classList.remove('selected-preset'));

    const selectedRadioButton = document.getElementById('preset' + presetNumber);
    selectedRadioButton.checked = true;
    selectedRadioButton.parentNode.classList.add('selected-preset');
}

export function saveToPreset() {
    if (selectedPreset === null) {
        displayNotification("Please select a preset to save to.");
        return;
    }

    presets[selectedPreset] = {
        units: {
            left: JSON.parse(JSON.stringify(totalUnits.left[currentWaveIndex - 1] || [])),
            front: JSON.parse(JSON.stringify(totalUnits.front[currentWaveIndex - 1] || [])),
            right: JSON.parse(JSON.stringify(totalUnits.right[currentWaveIndex - 1] || [])),
        },
        tools: {
            left: JSON.parse(JSON.stringify(totalTools.left[currentWaveIndex - 1] || [])),
            front: JSON.parse(JSON.stringify(totalTools.front[currentWaveIndex - 1] || [])),
            right: JSON.parse(JSON.stringify(totalTools.right[currentWaveIndex - 1] || [])),
        }
    };

    localStorage.setItem('presets', JSON.stringify(presets));
    displayNotification(`Saved current wave to preset ${selectedPreset}`);
}

export function loadPresets() {
    const storedPresets = localStorage.getItem('presets');
    if (storedPresets) presets = JSON.parse(storedPresets);
}

export function applyPreset() {
    if (selectedPreset === null || !presets[selectedPreset]) {
        displayNotification("Please select a valid preset to apply.");
        return;
    }

    const previousSide = currentSide;

    ['left', 'front', 'right'].forEach(side => {
        totalUnits[side][currentWaveIndex - 1] = JSON.parse(JSON.stringify(presets[selectedPreset].units[side]));
        totalTools[side][currentWaveIndex - 1] = JSON.parse(JSON.stringify(presets[selectedPreset].tools[side]));
    });

    ['front', 'left', 'right'].forEach(side => switchSide(side));
    switchSide(previousSide);

    generateWaves(currentSide, attackBasics.maxWaves);
    displayNotification(`Applied Preset ${selectedPreset} to Wave ${currentWaveIndex}`);
}

export function applyPresetToAll() {
    if (selectedPreset === null || !presets[selectedPreset]) {
        displayNotification("Please select a valid preset to apply.");
        return;
    }

    const previousSide = currentSide;

    for (let i = 0; i < attackBasics.maxWaves; i++) {
        ['left', 'front', 'right'].forEach(side => {
            totalUnits[side][i] = JSON.parse(JSON.stringify(presets[selectedPreset].units[side]));
            totalTools[side][i] = JSON.parse(JSON.stringify(presets[selectedPreset].tools[side]));
        });
    }

    ['front', 'left', 'right'].forEach(side => switchSide(side));
    switchSide(previousSide);

    generateWaves(currentSide, attackBasics.maxWaves);
    displayNotification(`Applied Preset ${selectedPreset} to all waves`);
}

export function displayNotification(message) {
    const notificationMessage = document.getElementById('notificationMessage');
    notificationMessage.textContent = message;

    const notificationBar = document.getElementById('notificationBar');

    if (notificationTimeout) clearTimeout(notificationTimeout);

    notificationBar.classList.add('show');

    notificationTimeout = setTimeout(() => {
        notificationBar.classList.remove('show');
    }, 2000);
}
