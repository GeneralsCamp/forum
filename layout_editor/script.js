let buildingCount = 0;
let buildingData = [];

const container = document.querySelector('.container');
const grid = document.getElementById('grid');
const buildingList = document.getElementById('buildingList');
let isBuildingMoving = false;
let startX, startY, currentBuilding;

function snapToGrid(building) {
    const gridWidth = 14.4;
    const gridHeight = 14.4;
    const nearestX = Math.round(building.offsetLeft / gridWidth) * gridWidth;
    const nearestY = Math.round(building.offsetTop / gridHeight) * gridHeight;
    building.style.left = `${nearestX}px`;
    building.style.top = `${nearestY}px`;
}

function checkBuildingsCollision(currentBuilding) {
    const buildings = document.querySelectorAll('.building');
    buildings.forEach(building => {
        if (building !== currentBuilding && isCollidingWithMargin(currentBuilding, building)) {
            resolveCollision(currentBuilding, building);
        }
    });
}

function isCollidingWithMargin(item1, item2) {
    const rect1 = item1.getBoundingClientRect();
    const rect2 = item2.getBoundingClientRect();
    const margin = 2;

    return !(rect1.right - margin < rect2.left + margin ||
        rect1.left + margin > rect2.right - margin ||
        rect1.bottom - margin < rect2.top + margin ||
        rect1.top + margin > rect2.bottom - margin);
}

function resolveCollision(item1, item2) {
    const rect1 = item1.getBoundingClientRect();
    const rect2 = item2.getBoundingClientRect();
    const deltaX = rect1.left - rect2.left;
    const deltaY = rect1.top - rect2.top;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0) {
            item1.style.left = rect2.right - container.getBoundingClientRect().left + 'px';
        } else {
            item1.style.left = rect2.left - rect1.width - container.getBoundingClientRect().left + 'px';
        }
    } else {
        if (deltaY > 0) {
            item1.style.top = rect2.bottom - container.getBoundingClientRect().top + 'px';
        } else {
            item1.style.top = rect2.top - rect1.height - container.getBoundingClientRect().top + 'px';
        }
    }
    snapToGrid(item1);
}

function isColliding(item1, item2) {
    const rect1 = item1.getBoundingClientRect();
    const rect2 = item2.getBoundingClientRect();
    return !(rect1.right < rect2.left ||
        rect1.left > rect2.right ||
        rect1.bottom < rect2.top ||
        rect1.top > rect2.bottom);
}

function validateAndCreateBuilding() {
    const width = getWidthInputValue();
    const height = getHeightInputValue();
    if (isValidDimension(width) && isValidDimension(height)) {
        createAndOptimizeBuilding(width, height);
    } else {
        showAlert('Width and height must be greater than 2!');
    }
}

function getWidthInputValue() {
    return parseInt(document.getElementById('widthInput').value);
}

function getHeightInputValue() {
    return parseInt(document.getElementById('heightInput').value);
}

function isValidDimension(value) {
    return value >= 2;
}

function createAndOptimizeBuilding(width, height) {
    createCustomBuilding(width, height);
    if (activeOptimize) {
        optimizeBuildings();
    }
}

function showAlert(message) {
    alert(message);
}

function removeBuildingFromList(button) {
    const buildingInfo = button.parentNode.parentNode;
    const index = buildingData.findIndex(data => data.infoElement === buildingInfo);
    if (index !== -1) {
        const removedBuilding = buildingData[index];
        removedBuilding.element.remove();
        removedBuilding.infoElement.remove();
        buildingData.splice(index, 1);
        buildingCount--;
    }
}

function removeBuilding(e) {
    e.preventDefault();
    const targetBuilding = e.target.closest('.building');
    const buildingName = targetBuilding.querySelector('div').textContent.trim();
    if (targetBuilding && !targetBuilding.classList.contains('predefined')) {
        const removedBuilding = buildingData.find(data => data.element === targetBuilding);
        if (removedBuilding) {
            removedBuilding.infoElement.remove();
            const index = buildingData.indexOf(removedBuilding);
            if (index > -1) {
                buildingData.splice(index, 1);
                buildingCount--;
            }
        }
        targetBuilding.remove();
    }
}

function clearAllBuildings() {
    const buildings = document.querySelectorAll('.building');
    buildings.forEach(building => building.remove());
    buildingData.forEach(data => {
        if (data.infoElement) {
            data.infoElement.remove();
        }
    });
    buildingData = [];
    buildingCount = 0;
}

function checkIfInGrid(building) {
    const rect = container.getBoundingClientRect();
    if (
        building.offsetLeft < 0 ||
        building.offsetTop < 0 ||
        building.offsetLeft + building.offsetWidth > rect.width ||
        building.offsetTop + building.offsetHeight > rect.height
    ) {
        building.style.left = rect.width / 2 - building.offsetWidth / 2 + 'px';
        building.style.top = rect.height / 2 - building.offsetHeight / 2 + 'px';
    }
}

const gridContainer = document.getElementById('grid');

gridContainer.innerHTML = '';

const gridSize = 70;
for (let i = 0; i < gridSize * gridSize; i++) {
    const cell = document.createElement('div');
    cell.classList.add('cell');
    gridContainer.appendChild(cell);
}

function takeScreenshot() {
    html2canvas(document.querySelector('.container')).then(canvas => {
        const dataUrl = canvas.toDataURL();

        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'gge-castle-layout-editor.png';

        link.click();
    });
}

function startMovingBuilding(e) {
    if (e.type === 'mousedown' || e.type === 'touchstart') {
        isBuildingMoving = true;
        const rect = container.getBoundingClientRect();
        startX = (e.type === 'mousedown') ? e.clientX - rect.left - e.target.offsetLeft : e.touches[0].clientX - rect.left - e.target.offsetLeft;
        startY = (e.type === 'mousedown') ? e.clientY - rect.top - e.target.offsetTop : e.touches[0].clientY - rect.top - e.target.offsetTop;
        currentBuilding = e.target;
    }
}

function moveBuilding(e) {
    if (isBuildingMoving) {
        const rect = container.getBoundingClientRect();
        let newX, newY;

        if (e.type === 'mousemove') {
            newX = e.clientX - rect.left - startX;
            newY = e.clientY - rect.top - startY;
        } else if (e.type === 'touchmove') {
            newX = e.touches[0].clientX - rect.left - startX;
            newY = e.touches[0].clientY - rect.top - startY;
        }

        if (newX < 0) newX = 0;
        if (newY < 0) newY = 0;
        if (newX > rect.width - currentBuilding.offsetWidth) newX = rect.width - currentBuilding.offsetWidth;
        if (newY > rect.height - currentBuilding.offsetHeight) newY = rect.height - currentBuilding.offsetHeight;

        currentBuilding.style.left = newX + 'px';
        currentBuilding.style.top = newY + 'px';
        snapToGrid(currentBuilding);
        checkBuildingsCollision(currentBuilding);
        checkIfInGrid(currentBuilding);
    }
}

function stopMovingBuilding() {
    if (isBuildingMoving) {
        isBuildingMoving = false;
        snapToGrid(currentBuilding);
        checkBuildingsCollision(currentBuilding);
        checkIfInGrid(currentBuilding);
    }
}

document.addEventListener('touchstart', startMovingBuilding);
document.addEventListener('touchmove', moveBuilding);
document.addEventListener('touchend', stopMovingBuilding);

document.addEventListener('mousedown', startMovingBuilding);
document.addEventListener('mousemove', moveBuilding);
document.addEventListener('mouseup', stopMovingBuilding);

const gridExpandToggle = document.getElementById('grid-expand-toggle');
const body = document.body;
const isExpand = localStorage.getItem('gridExpand') === 'true';

//Expansion
document.addEventListener('DOMContentLoaded', (event) => {
    const body = document.body;
    const gridExpandSwitch = document.getElementById('gridExpandSwitch');

    function toggleGridExpansion() {
        body.classList.toggle('gridExpand');
        const currentMode = body.classList.contains('gridExpand');
        localStorage.setItem('gridExpand', currentMode.toString());

        gridExpandSwitch.checked = currentMode;
    }

    gridExpandSwitch.addEventListener('change', toggleGridExpansion);

    const isExpand = localStorage.getItem('gridExpand') === 'true';
    if (isExpand) {
        toggleGridExpansion();
    } else {
        gridExpandSwitch.checked = false;
    }
});


if (isExpand) {
    toggleGridExpansion();
}

function setPresetSize() {
    const presetSizes = document.getElementById('presetSizes');
    const selectedSize = presetSizes.value;
    const [width, height] = selectedSize.split('x').map(Number);

    document.getElementById('widthInput').value = width;
    document.getElementById('heightInput').value = height;
    document.getElementById('widthValue').textContent = width;
    document.getElementById('heightValue').textContent = height;

    updateSliderValue('widthInput');
    updateSliderValue('heightInput');
}


function setColor(red, green, blue) {
    document.getElementById('colorInput').value = `${red} ${green} ${blue}`;

    const colorButtons = document.querySelectorAll('.colorButton');
    colorButtons.forEach(button => button.classList.remove('clicked'));

    event.target.classList.add('clicked');
}

function calculateEmptySpace(grid, startX, startY, width, height) {
    let emptySpace = 0;
    for (let y = startY - 1; y <= startY + height; y++) {
        for (let x = startX - 1; x <= startX + width; x++) {
            if (x < 0 || y < 0 || x >= grid[0].length || y >= grid.length || grid[y][x] === 0) {
                emptySpace++;
            }
        }
    }
    return emptySpace;
}

function placeBuilding(grid, startX, startY, width, height) {
    for (let y = startY; y < startY + height; y++) {
        for (let x = startX; x < startX + width; x++) {
            grid[y][x] = 1;
        }
    }
}

let activeOptimize = true;

function toggleOptimization() {
    const optimizeSwitch = document.getElementById('optimizeSwitch');
    activeOptimize = optimizeSwitch.checked;
    localStorage.setItem('optimizeState', JSON.stringify(activeOptimize));

    if (activeOptimize) {
        optimizeBuildings();
    } else {
        resetOptimization();
    }
}

function saveOptimizeStateToCache() {
    localStorage.setItem('optimizeState', JSON.stringify(activeOptimize));
}

document.addEventListener('DOMContentLoaded', () => {
    loadOptimizeStateFromCache();
});

function loadOptimizeStateFromCache() {
    const cachedOptimizeState = localStorage.getItem('optimizeState');
    if (cachedOptimizeState !== null) {
        activeOptimize = JSON.parse(cachedOptimizeState);
        const optimizeSwitch = document.getElementById('optimizeSwitch');
        optimizeSwitch.checked = activeOptimize;

        if (activeOptimize) {
            optimizeBuildings();
        }
    } else {
        activeOptimize = false;
    }
}

function optimizeBuildings() {
    const sortedBuildings = buildingData.slice().sort((a, b) => b.width * b.height - a.width * a.height);
    const rect = container.getBoundingClientRect();
    const cellWidth = 14.4;
    const cellHeight = 14.4;
    const gridWidth = Math.floor(rect.width / cellWidth);
    const gridHeight = Math.floor(rect.height / cellHeight);
    const grid = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(0));

    sortedBuildings.forEach(building => {
        const widthCells = Math.floor(building.width / cellWidth);
        const heightCells = Math.floor(building.height / cellHeight);
        let placed = false;

        for (let y = 0; y <= gridHeight - heightCells && !placed; y++) {
            for (let x = 0; x <= gridWidth - widthCells && !placed; x++) {
                if (canPlaceBuilding(grid, x, y, widthCells, heightCells)) {
                    placeBuilding(grid, x, y, widthCells, heightCells);
                    building.element.style.left = `${x * cellWidth}px`;
                    building.element.style.top = `${y * cellHeight}px`;
                    placed = true;
                }
            }
        }

        if (!placed) {
            alert(`Not enough space for building: ${building.name}`);
            removeBuilding(building.element);
        }
    });
}

function canPlaceBuilding(grid, startX, startY, widthCells, heightCells) {
    for (let y = startY; y < startY + heightCells; y++) {
        for (let x = startX; x < startX + widthCells; x++) {
            if (grid[y][x] !== 0) return false;
        }
    }
    return true;
}

function placeBuilding(grid, startX, startY, widthCells, heightCells) {
    for (let y = startY; y < startY + heightCells; y++) {
        for (let x = startX; x < startX + widthCells; x++) {
            grid[y][x] = 1;
        }
    }
}

function updateName() {
    const presetSizes = document.getElementById("presetSizes");
    const nameInput = document.getElementById("nameInput");
    const selectedOption = presetSizes.options[presetSizes.selectedIndex];
    const selectedName = selectedOption.text;
    nameInput.value = selectedName;
}

function setPresetSizeAndUpdateName() {
    updateName();
    setPresetSize();
}

function sendHelp() {
    window.open('https://youtu.be/FstQ9Cq4mZs', '_blank');
}

//FIX REMOVE BUILDING - RIGHT CLICK
document.addEventListener('DOMContentLoaded', function () {
    container.addEventListener('contextmenu', function (event) {
        event.preventDefault();
        removeBuilding(event);
    });
});

//Fullscreen
function requestFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.mozRequestFullScreen) { // Firefox
        elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) { // Chrome, Safari and Opera
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { // IE/Edge
        elem.msRequestFullscreen();
    }
}

function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.mozCancelFullScreen) { // Firefox
        document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) { // Chrome, Safari and Opera
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { // IE/Edge
        document.msExitFullscreen();
    }
}

function toggleFullscreen() {
    const fullscreenSwitch = document.getElementById('fullscreenSwitch');

    if (!document.fullscreenElement) {
        requestFullscreen();
        fullscreenSwitch.checked = true;
    } else {
        exitFullscreen();
        fullscreenSwitch.checked = false;
    }
}

function enterFullscreen() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('fullscreenModal'));
    modal.hide();
    requestFullscreen();
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const icon = fullscreenBtn.querySelector('.bi');
    icon.classList.remove('bi-fullscreen');
    icon.classList.add('bi-fullscreen-exit');
}

//Save function
function createCustomBuildingFromCache(data) {
    const newBuilding = document.createElement('div');
    newBuilding.className = 'building custom';
    newBuilding.style.width = `${data.width}px`;
    newBuilding.style.height = `${data.height}px`;
    newBuilding.style.backgroundColor = `rgb(${data.color})`;
    newBuilding.style.position = 'absolute';
    newBuilding.style.left = data.left;
    newBuilding.style.top = data.top;

    const nameLayer = document.createElement('div');
    nameLayer.style.pointerEvents = 'none';
    nameLayer.innerHTML = `<div style="text-align: center;">${data.name}</div>`;
    newBuilding.appendChild(nameLayer);

    container.appendChild(newBuilding);

    const buildingInfo = document.createElement('div');
    buildingInfo.className = 'row building-info player-flank';

    buildingInfo.innerHTML = `
        <div class="col">${data.name}</div>
        <div class="col">${(data.width / 14.4)}x${(data.height / 14.4)}</div>
        <div class="col"><div class="color-square" style="background-color: rgb(${data.color});"></div></div>
        <div class="col"><button class="btn btn-dark remove-building-btn" onclick="removeBuildingFromList(this)">Delete</button></div>
    `;

    buildingList.appendChild(buildingInfo);

    buildingData.push({ name: data.name, color: data.color, width: data.width, height: data.height, element: newBuilding, infoElement: buildingInfo });
    buildingCount++;
}


function saveToSlot() {
    const slotNameInput = document.getElementById('slot-1-name');
    const slotName = slotNameInput.value.trim();

    if (!slotName) {
        alert('Please enter a name for the slot.');
        return;
    }
    const buildingDataToSave = buildingData.map(data => {
        return {
            name: data.name,
            color: data.color,
            width: data.width,
            height: data.height,
            left: data.element.style.left,
            top: data.element.style.top
        };
    });

    let cachedBuildingData = JSON.parse(localStorage.getItem('buildingData') || '[]');

    let slotExists = false;
    cachedBuildingData.forEach(slot => {
        if (slot.name === slotName) {
            slot.buildings = buildingDataToSave;
            slotExists = true;
        }
    });

    if (!slotExists) {
        cachedBuildingData.push({
            name: slotName,
            buildings: buildingDataToSave
        });
    }

    localStorage.setItem('buildingData', JSON.stringify(cachedBuildingData));

    updateSaveSlotsUI(slotName);

    slotNameInput.value = '';
}
function loadFromSlot(loadBtn) {
    const slotName = loadBtn.parentElement.parentElement.querySelector('.castle-name').textContent;

    const cachedBuildingData = JSON.parse(localStorage.getItem('buildingData') || '[]');
    const slotData = cachedBuildingData.find(slot => slot.name === slotName);

    if (!slotData || !slotData.buildings) {
        alert('No buildings saved in this slot.');
        return;
    }

    clearAllBuildings();

    slotData.buildings.forEach(data => {
        createCustomBuildingFromCache(data);
    });
}

function deleteSlot(deleteBtn) {
    const slotName = deleteBtn.parentElement.parentElement.querySelector('.castle-name').textContent;

    let cachedBuildingData = JSON.parse(localStorage.getItem('buildingData') || '[]');
    cachedBuildingData = cachedBuildingData.filter(slot => slot.name !== slotName);

    localStorage.setItem('buildingData', JSON.stringify(cachedBuildingData));

    deleteBtn.parentElement.parentElement.remove();
}

function updateSaveSlotsUI(slotName) {
    const slotsList = document.getElementById('slotsList');

    const slotItem = document.createElement('div');
    slotItem.className = 'row slot-item player-flank';
    slotItem.innerHTML = `
        <div class="col castle-name">${slotName}</div>
        <div class="col"><button class="btn load-btn" onclick="loadFromSlot(this)">Load</button></div>
        <div class="col"><button class="btn delete-btn" onclick="deleteSlot(this)">Delete</button></div>
    `;

    slotsList.appendChild(slotItem);
}

function loadSavedSlotsUI() {
    const cachedBuildingData = JSON.parse(localStorage.getItem('buildingData') || '[]');
    const slotsList = document.getElementById('slotsList');

    cachedBuildingData.forEach(slot => {
        updateSaveSlotsUI(slot.name);
    });
}

window.addEventListener('DOMContentLoaded', () => {
    loadSavedSlotsUI();
});




//Modal1
function storageModal() {
    const storageModal = new bootstrap.Modal(document.getElementById('storageModal'));
    storageModal.show();
}
//Modal2
function settingsModal() {
    const settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
    settingsModal.show();
}
//Modal3
function savesModal() {
    const savesModal = new bootstrap.Modal(document.getElementById('savesModal'));
    savesModal.show();
}
//Modal4
function buildingsModal() {
    generateBuildingsModal();
    const buildingsModal = new bootstrap.Modal(document.getElementById('buildingsModal'));
    buildingsModal.show();
}

const buildings = [
    {
        name: "Kastély",
        width: 100,
        height: 100,
        color: "red",
        image: "./img/building1.png",
    },
    {
        name: "Torony",
        width: 50,
        height: 150,
        color: "blue",
        image: "./img/building2.png",
    },
    {
        name: "Kastély",
        width: 100,
        height: 100,
        color: "red",
        image: "./img/building1.png",
    },
    {
        name: "Torony",
        width: 50,
        height: 150,
        color: "blue",
        image: "./img/building2.png",
    },
];

function generateBuildingsModal() {
    const container = document.getElementById('buildingsContainer');
    container.innerHTML = ''; // Tisztítjuk a tartalmat.

    buildings.forEach((building, index) => {
        const buildingDiv = document.createElement('div');
        buildingDiv.className = 'col-md-6 col-sm-12';

        buildingDiv.innerHTML = `
            <div class="box">
                <div class="box-icon">
                    <img src="${building.image}" class="img-fluid">
                </div>
                <div class="box-content">
                    <h2>${building.name}</h2>
                    <hr>
                    <button class="btn btn-primary" onclick="placeBuilding(${index})">Elhelyezés</button>
                </div>
            </div>
        `;

        container.appendChild(buildingDiv);
    });
}
function placeBuilding(index) {
    const building = buildings[index];

    const newBuilding = document.createElement('div');
    newBuilding.className = 'building custom';
    newBuilding.style.width = `${building.width}px`;
    newBuilding.style.height = `${building.height}px`;
    newBuilding.style.backgroundColor = building.color;
    newBuilding.style.position = 'absolute';
    newBuilding.style.left = '0px';
    newBuilding.style.top = '0px';

    // Az épület nevének megjelenítése
    const nameDiv = document.createElement('div');
    nameDiv.style.pointerEvents = 'none';
    nameDiv.textContent = building.name;
    newBuilding.appendChild(nameDiv);

    grid.appendChild(newBuilding);
    snapToGrid(newBuilding);
    buildingData.push({ ...building, element: newBuilding });
}
