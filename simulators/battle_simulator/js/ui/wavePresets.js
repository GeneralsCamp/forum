import { totalUnits, totalTools, attackBasics, currentSide, currentWaveIndex, selectedPreset, presets, notificationTimeout } from '../data/variables.js';
import { switchSide, generateWaves } from '../ui/uiWaves.js';
import { setCurrentWaveIndex, setSelectedPreset, setPresets, setNotificationTimeout } from '../data/variables.js';
import { initPresetSwipe } from './swipe.js';

export function openWaveCopyModal() {
    const modalEl = document.getElementById('waveCopyModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    document.getElementById('currentWaveText').textContent = `Wave ${currentWaveIndex} / ${attackBasics.maxWaves}`;

    const presetItems = modalEl.querySelectorAll('.preset-item');
    presetItems.forEach((item, i) => {
        item.onclick = () => selectPreset(i + 1);
    });

    modalEl.querySelector('#applyPresetBtn').onclick = applyPreset;
    modalEl.querySelector('#applyPresetAllBtn').onclick = applyPresetToAll;
    modalEl.querySelector('#savePresetBtn').onclick = saveToPreset;

    modalEl.querySelector('#prevWaveBtn').onclick = () => changeWave(-1);
    modalEl.querySelector('#nextWaveBtn').onclick = () => changeWave(1);
    initPresetSwipe('waveCopyModal', changeWave);
}

export function changeWave(direction) {
    let newIndex = currentWaveIndex + direction;

    if (newIndex > attackBasics.maxWaves) newIndex = 1;
    if (newIndex < 1) newIndex = attackBasics.maxWaves;

    setCurrentWaveIndex(newIndex);
    document.getElementById('currentWaveText').textContent = `Wave ${newIndex} / ${attackBasics.maxWaves}`;
}

export function selectPreset(presetNumber) {
    setSelectedPreset(presetNumber);

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

    const newPresets = { ...presets };
    newPresets[selectedPreset] = {
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

    setPresets(newPresets);
    localStorage.setItem('variables.presets', JSON.stringify(newPresets));

    displayNotification(`Saved current wave to preset ${selectedPreset}`);
}

export function loadPresets() {
    const storedPresets = localStorage.getItem('variables.presets');
    if (storedPresets) {
        setPresets(JSON.parse(storedPresets));
    }
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

    const timeout = setTimeout(() => {
        notificationBar.classList.remove('show');
    }, 2000);

    setNotificationTimeout(timeout);
}
