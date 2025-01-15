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


function createCustomBuilding() {
    const widthInput = document.getElementById('widthInput');
    const heightInput = document.getElementById('heightInput');
    const colorInput = document.getElementById('colorInput');
    const nameInput = document.getElementById('nameInput');

    const width = parseInt(widthInput.value) * 14.4;
    const height = parseInt(heightInput.value) * 14.4;
    const color = colorInput.value.split(' ').join(',');
    let name = nameInput.value.trim() || "noName";

    if (buildingCount >= 200) {
        alert('A maximum of 200 buildings are allowed at one time.');
        return;
    }

    const newBuilding = document.createElement('div');
    newBuilding.className = 'building custom';
    newBuilding.style.width = width + 'px';
    newBuilding.style.height = height + 'px';
    newBuilding.style.backgroundColor = `rgb(${color})`;
    newBuilding.style.position = 'absolute';

    if (!activeOptimize) {
        const gridWidth = container.clientWidth;
        const gridHeight = container.clientHeight;

        const leftPosition = (gridWidth - width) / 2;
        const topPosition = (gridHeight - height) / 2;

        newBuilding.style.left = leftPosition + 'px';
        newBuilding.style.top = topPosition + 'px';
    } else {
        const existingBuildings = document.querySelectorAll('.building.custom');
        if (existingBuildings.length > 0) {
            const lastBuilding = existingBuildings[existingBuildings.length - 1];
            const lastBuildingRect = lastBuilding.getBoundingClientRect();
            newBuilding.style.left = (lastBuildingRect.left + lastBuildingRect.width + 10) + 'px';
            newBuilding.style.top = lastBuilding.style.top;
        } else {
            newBuilding.style.left = '0px';
            newBuilding.style.top = '0px';
        }
    }

    const nameLayer = document.createElement('div');
    nameLayer.style.pointerEvents = 'none';
    nameLayer.innerHTML = `<div style="text-align: center;">${name}</div>`;
    newBuilding.appendChild(nameLayer);

    container.appendChild(newBuilding);
    buildingCount++;

    document.addEventListener('mousemove', moveBuilding);
    document.addEventListener('mouseup', stopMovingBuilding);

    const buildingInfo = document.createElement('div');
    buildingInfo.className = 'row building-info';
    buildingInfo.innerHTML = `
        <div class="col">${name}</div>
        <div class="col">${width / 14.4}x${height / 14.4}</div>
        <div class="col"><div class="color-square" style="background-color: rgb(${color});"></div></div>
        <div class="col"><button class="btn btn-dark remove-building-btn" onclick="removeBuildingFromList(this)">Delete</button></div>
    `;
    buildingList.appendChild(buildingInfo);

    buildingData.push({ name: name, color: color, width: width, height: height, element: newBuilding, infoElement: buildingInfo });

    if (activeOptimize) {
        optimizeBuildings();
    }
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
    const gridExpandToggle = document.getElementById('grid-expand-toggle');

    function toggleGridExpansion() {
        body.classList.toggle('gridExpand');
        const currentMode = body.classList.contains('gridExpand');
        localStorage.setItem('gridExpand', currentMode.toString());

        if (currentMode) {
            gridExpandToggle.classList.add('expanded');
            gridExpandToggle.textContent = 'ON';
        } else {
            gridExpandToggle.classList.remove('expanded');
            gridExpandToggle.textContent = 'OFF';
        }
    }

    gridExpandToggle.addEventListener('click', toggleGridExpansion);

    const isExpand = localStorage.getItem('gridExpand') === 'true';
    if (isExpand) {
        toggleGridExpansion();
    } else {
        gridExpandToggle.textContent = 'OFF';
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
    activeOptimize = !activeOptimize;
    const optimizeBtn = document.getElementById('optimizeBtn');

    if (activeOptimize) {
        optimizeBtn.textContent = 'ON';
        optimizeBuildings();
    } else {
        optimizeBtn.textContent = 'OFF';
    }

    saveOptimizeStateToCache();
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
        const optimizeBtn = document.getElementById('optimizeBtn');
        optimizeBtn.textContent = activeOptimize ? 'ON' : 'OFF';

        if (activeOptimize) {
            optimizeBuildings();
        }
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



function hexToRgb(hex) {
    hex = hex.replace('#', '');

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return [r, g, b];
}
function swapWidthAndHeight() {
    const widthInput = document.getElementById('widthInput');
    const heightInput = document.getElementById('heightInput');
    const widthValue = widthInput.value;
    const heightValue = heightInput.value;

    widthInput.value = heightValue;
    heightInput.value = widthValue;

    document.getElementById('widthValue').textContent = heightValue;
    document.getElementById('heightValue').textContent = widthValue;
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
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const icon = document.getElementById('fullscreenBtn');

    if (!document.fullscreenElement) {
        requestFullscreen();
        fullscreenBtn.textContent = 'ON';
    } else {
        exitFullscreen();
        fullscreenBtn.textContent = 'OFF';
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

/*
document.addEventListener('DOMContentLoaded', () => {
    const modal = new bootstrap.Modal(document.getElementById('fullscreenModal'));
    modal.show();
});
*/


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
    buildingInfo.className = 'row building-info';

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
    slotItem.className = 'row slot-item';
    slotItem.innerHTML = `
        <div class="col castle-name">${slotName}</div>
        <div class="col"><button class="btn btn-dark load-btn" onclick="loadFromSlot(this)">Load</button></div>
        <div class="col"><button class="btn btn-dark delete-btn" onclick="deleteSlot(this)">Delete</button></div>
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




const predefinedBuildings = [
    // 5x5 buildings
    {
        name: "Stone works",
        width: 5,
        height: 5,
        color: "128 128 128", // Gray
        image: "images/stoneWorks.webp",
        description: "Size: 5x5"
    },
    {
        name: "Forest lodge",
        width: 5,
        height: 5,
        color: "34 85 34", // Dark forest green
        image: "images/forestLodge.webp",
        description: "Size: 5x5"
    },
    {
        name: "Granary",
        width: 5,
        height: 5,
        color: "204 153 0", // Dark golden yellow
        image: "images/granary.webp",
        description: "Size: 5x5"
    },
    {
        name: "Relic apiary",
        width: 5,
        height: 5,
        color: "204 179 0", // Dark honey yellow
        image: "images/relicApiary.png",
        description: "Size: 5x5"
    },
    {
        name: "Relic mead distillery",
        width: 5,
        height: 5,
        color: "102 51 0", // Dark brown
        image: "images/relicMeadDistillery.png",
        description: "Size: 5x5"
    },
    {
        name: "Relic honey gardens",
        width: 5,
        height: 5,
        color: "204 179 102", // Soft amber
        image: "images/relicHoneyGardens.png",
        description: "Size: 5x5"
    },
    {
        name: "Relic barrel workshop",
        width: 5,
        height: 5,
        color: "102 51 0", // Dark wood brown
        image: "images/relicBarrelWorkshop.png",
        description: "Size: 5x5"
    },
    {
        name: "Hunting lodge",
        width: 5,
        height: 5,
        color: "139 69 19", // Saddle brown
        image: "images/huntingLodge.webp",
        description: "Size: 5x5"
    },
    {
        name: "Refinery",
        width: 5,
        height: 5,
        color: "112 112 112", // Medium gray
        image: "images/refinery.png",
        description: "Size: 5x5"
    },
    {
        name: "Construction yard",
        width: 5,
        height: 5,
        color: "204 102 0", // Construction orange
        image: "images/constructionYard.png",
        description: "Size: 5x5"
    },
    {
        name: "Relic brewery",
        width: 5,
        height: 5,
        color: "204 102 51", // Warm amber
        image: "images/relicBrewery.png",
        description: "Size: 5x5"
    },
    {
        name: "Toolsmith",
        width: 5,
        height: 5,
        color: "169 169 169", // Light gray
        image: "images/toolsmith.png",
        description: "Size: 5x5"
    },
    {
        name: "Imperial Council Hall",
        width: 5,
        height: 5,
        color: "204 153 0", // Golden yellow
        image: "images/imperialCouncilHall.webp",
        description: "Size: 5x5"
    },
    {
        name: "Reinforced Vault",
        width: 5,
        height: 5,
        color: "112 112 112", // Medium gray
        image: "images/reinforcedVault.webp",
        description: "Size: 5x5"
    },
    {
        name: "Decoration",
        width: 5,
        height: 5,
        color: "200 200 200", // Soft gray
        image: "images/decoration5x5.png",
        description: "Size: 5x5"
    },
    {
        name: "Stronghold",
        width: 5,
        height: 5,
        color: "178 34 34", // Firebrick red
        image: "images/stronghold.png",
        description: "Size: 5x5"
    },
    {
        name: "Forge",
        width: 5,
        height: 5,
        color: "139 0 0", // Dark red
        image: "images/forge.png",
        description: "Size: 5x5"
    },
    {
        name: "University",
        width: 5,
        height: 5,
        color: "0 0 139", // Dark blue
        image: "images/university.png",
        description: "Size: 5x5"
    },
    {
        name: "Armory",
        width: 5,
        height: 5,
        color: "0 0 102", // Dark navy blue
        image: "images/armory.png",
        description: "Size: 5x5"
    },
    {
        name: "Military hospital",
        width: 5,
        height: 5,
        color: "204 85 68", // Rusty red
        image: "images/militaryHospital.png",
        description: "Size: 5x5"
    },
    {
        name: "Stables",
        width: 5,
        height: 5,
        color: "139 69 19", // Saddle brown
        image: "images/stables.png",
        description: "Size: 5x5"
    },
    {
        name: "Watchtower",
        width: 5,
        height: 5,
        color: "169 169 169", // Steel gray
        image: "images/watchtower.png",
        description: "Size: 5x5"
    },
    {
        name: "Relicus",
        width: 5,
        height: 5,
        color: "204 204 0", // Dark yellow
        image: "images/relicus.webp",
        description: "Size: 5x5"
    },

    // 5x10 buildings
    {
        name: "Decoration",
        width: 5,
        height: 10,
        color: "200 200 200", // Soft gray
        image: "images/decoration5x10.png",
        description: "Size: 5x10"
    },
    {
        name: "Relic woodcutter",
        width: 5,
        height: 10,
        color: "34 85 34", // Dark forest green
        image: "images/relicWoodcutter.png",
        description: "Size: 5x10"
    },
    {
        name: "Relic quarry",
        width: 5,
        height: 10,
        color: "102 51 0", // Earth brown
        image: "images/relicQuarry.png",
        description: "Size: 5x10"
    },
    {
        name: "Relic cattle farm",
        width: 5,
        height: 10,
        color: "204 179 102", // Soft amber
        image: "images/relicCattleFarm.webp",
        description: "Size: 5x10"
    },
    {
        name: "Storehouse",
        width: 5,
        height: 10,
        color: "128 128 128", // Gray
        image: "images/storehouse.png",
        description: "Size: 5x10"
    },
    {
        name: "Relic greenhouse",
        width: 5,
        height: 10,
        color: "34 139 34", // Dark green
        image: "images/relicGreenhouse.png",
        description: "Size: 5x10"
    },
    {
        name: "Relic conservatory",
        width: 5,
        height: 10,
        color: "102 255 102", // Light green
        image: "images/relicConservatory.png",
        description: "Size: 5x10"
    },
    {
        name: "Drill ground",
        width: 5,
        height: 10,
        color: "204 85 0", // Dark orange
        image: "images/drillGround.png",
        description: "Size: 5x10"
    },
    {
        name: "Hall of legends",
        width: 5,
        height: 10,
        color: "204 153 0", // Golden yellow
        image: "images/hol.webp",
        description: "Size: 5x10"
    },

    // Other sizes
    {
        name: "Stonemason",
        width: 9,
        height: 6,
        color: "112 112 112", // Medium gray
        image: "images/stonemason.png",
        description: "Size: 9x6"
    },
    {
        name: "Marketplace",
        width: 9,
        height: 6,
        color: "204 85 68", // Rusty red
        image: "images/marketplace.png",
        description: "Size: 9x6"
    },
    {
        name: "Sawmill",
        width: 9,
        height: 6,
        color: "102 51 0", // Wood brown
        image: "images/sawmill.png",
        description: "Size: 9x6"
    },
    {
        name: "Bakery",
        width: 9,
        height: 6,
        color: "255 204 153", // Light cream
        image: "images/bakery.png",
        description: "Size: 9x6"
    },
    {
        name: "Flour mill",
        width: 9,
        height: 6,
        color: "245 245 220", // Soft beige
        image: "images/flourMill.png",
        description: "Size: 9x6"
    },
    {
        name: "Dragon hoard",
        width: 10,
        height: 8,
        color: "204 0 0", // Dark red
        image: "images/dragonHoard.webp",
        description: "Size: 10x8"
    },
    {
        name: "Dragon breath forge",
        width: 10,
        height: 8,
        color: "204 85 0", // Fiery orange
        image: "images/dragonBreathForge.webp",
        description: "Size: 10x8"
    },
    {
        name: "Defense workshop",
        width: 10,
        height: 8,
        color: "169 169 169", // Workshop gray
        image: "images/defenseWorkshop.png",
        description: "Size: 10x8"
    },
    {
        name: "Offense workshop",
        width: 10,
        height: 8,
        color: "204 0 204", // Purple
        image: "images/offenseWorkshop.png",
        description: "Size: 10x8"
    },
    {
        name: "Guardhouse",
        width: 6,
        height: 6,
        color: "0 0 102", // Dark blue
        image: "images/guardhouse.png",
        description: "Size: 6x6"
    },
    {
        name: "Tavern",
        width: 6,
        height: 6,
        color: "204 102 0", // Tavern orange
        image: "images/tavern.png",
        description: "Size: 6x6"
    },
    {
        name: "Estate",
        width: 8,
        height: 8,
        color: "0 0 204", // Luxurious blue
        image: "images/estate.png",
        description: "Size: 8x8"
    },
    {
        name: "District",
        width: 10,
        height: 10,
        color: "128 128 128", // Urban gray
        image: "images/district.png",
        description: "Size: 10x10"
    },
    {
        name: "The Keep",
        width: 12,
        height: 12,
        color: "178 34 34", // Strong red
        image: "images/theKeep.png",
        description: "Size: 12x12"
    },
    {
        name: "RT",
        width: 3,
        height: 4,
        color: "200 200 200", // Soft gray
        image: "images/rt.png",
        description: "Size: 3x4"
    },
    {
        name: "Deco",
        width: 3,
        height: 3,
        color: "200 200 200", // Soft gray
        image: "images/deco3x3.png",
        description: "Size: 3x3"
    },
    {
        name: "Deco",
        width: 2,
        height: 2,
        color: "200 200 200", // Soft gray
        image: "images/deco2x2.webp",
        description: "Size: 2x2"
    },
    {
        name: "Deco",
        width: 4,
        height: 3,
        color: "200 200 200", // Soft gray
        image: "images/deco3x4.png",
        description: "Size: 3x4"
    },
    {
        name: "Decoration",
        width: 10,
        height: 20,
        color: "200 200 200", // Soft gray
        image: "images/decoration10x20.webp",
        description: "Size: 10x20"
    },
    {
        name: "Decoration",
        width: 20,
        height: 20,
        color: "200 200 200", // Soft gray
        image: "images/decoration20x20.webp",
        description: "Size: 20x20"
    },
    {
        name: "Encampment",
        width: 6,
        height: 6,
        color: "0 0 102", // Dark blue
        image: "images/encampment.png",
        description: "Size: 6x6"
    },
    {
        name: "Loot warehouse",
        width: 10,
        height: 8,
        color: "128 128 128", // Medium gray
        image: "images/lootWarehouse.png",
        description: "Size: 10x8"
    },
    {
        name: "Barracks",
        width: 6,
        height: 6,
        color: "128 128 128", // Military gray
        image: "images/barracks.png",
        description: "Size: 6x6"
    }
];



function populateBuildingsModal() {
    const buildingsGrid = document.getElementById("buildingsGrid");
    buildingsGrid.innerHTML = "";

    const filters = Array.from(document.querySelectorAll(".filter-checkbox"))
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value);

    predefinedBuildings.forEach((building) => {
        const size = `${building.width}x${building.height}`;
        if (
            (filters.includes(size)) ||
            (filters.includes("other") && size !== "5x5" && size !== "5x10")
        ) {
            const buildingCol = document.createElement("div");
            buildingCol.className = "col-md-6 col-sm-12 mb-4";

            buildingCol.innerHTML = `
            <div class="box">
                <div class="box-icon">
                    ${building.image ?
                    `<img src="${building.image}" alt="${building.name}" class="building-icon">` :
                    `<i class="bi bi-house"></i>`
                }
                </div>
                <div class="box-content bugfix1">
                    <h2>${building.name}</h2>
                    <hr>
                    <p>${building.description || "No description available."}</p>
                </div>
            </div>
        `;


            buildingCol.querySelector('.box').addEventListener('click', () => {
                createCustomBuildingFromPredefined(building);
            });

            buildingsGrid.appendChild(buildingCol);
        }
    });
}

document.querySelectorAll(".filter-checkbox").forEach(checkbox => {
    checkbox.addEventListener("change", populateBuildingsModal);
});


function swapBuildingDimensionsOnCreate(building) {
    const { width, height, color, name } = building;


    const swappedWidth = height;
    const swappedHeight = width;

    const newBuilding = document.createElement('div');
    newBuilding.className = 'building custom';
    newBuilding.style.width = `${swappedWidth * 14.4}px`;
    newBuilding.style.height = `${swappedHeight * 14.4}px`;
    newBuilding.style.backgroundColor = `rgb(${color})`;
    newBuilding.style.position = 'absolute';

    if (!activeOptimize) {
        const gridWidth = container.clientWidth;
        const gridHeight = container.clientHeight;

        const leftPosition = (gridWidth - swappedWidth * 14.4) / 2;
        const topPosition = (gridHeight - swappedHeight * 14.4) / 2;

        newBuilding.style.left = `${leftPosition}px`;
        newBuilding.style.top = `${topPosition}px`;
    } else {
        const existingBuildings = document.querySelectorAll('.building.custom');
        if (existingBuildings.length > 0) {
            const lastBuilding = existingBuildings[existingBuildings.length - 1];
            const lastBuildingRect = lastBuilding.getBoundingClientRect();
            newBuilding.style.left = `${lastBuildingRect.left + lastBuildingRect.width + 10}px`;
            newBuilding.style.top = lastBuilding.style.top;
        } else {
            newBuilding.style.left = '0px';
            newBuilding.style.top = '0px';
        }
    }

    const nameLayer = document.createElement('div');
    nameLayer.style.pointerEvents = 'none';
    nameLayer.innerHTML = `<div style="text-align: center;">${name}</div>`;
    newBuilding.appendChild(nameLayer);

    container.appendChild(newBuilding);
    buildingCount++;

    const buildingInfo = document.createElement('div');
    buildingInfo.className = 'row building-info';
    buildingInfo.innerHTML = `
        <div class="col">${name}</div>
        <div class="col">${swappedWidth}x${swappedHeight}</div>
        <div class="col"><div class="color-square" style="background-color: rgb(${color});"></div></div>
        <div class="col"><button class="btn btn-dark remove-building-btn" onclick="removeBuildingFromList(this)">Delete</button></div>
    `;
    buildingList.appendChild(buildingInfo);

    buildingData.push({ name, color, width: swappedWidth * 14.4, height: swappedHeight * 14.4, element: newBuilding, infoElement: buildingInfo });

    if (activeOptimize) {
        optimizeBuildings();
    }
}

function createCustomBuildingFromPredefined(building) {
    const { width, height, color, name } = building;

    if (buildingCount >= 200) {
        alert('A maximum of 200 buildings are allowed at one time.');
        return;
    }

    if (isSwappedDimensions) {
        swapBuildingDimensionsOnCreate(building);
    } else {
        const newBuilding = document.createElement('div');
        newBuilding.className = 'building custom';
        newBuilding.style.width = `${width * 14.4}px`;
        newBuilding.style.height = `${height * 14.4}px`;
        newBuilding.style.backgroundColor = `rgb(${color})`;
        newBuilding.style.position = 'absolute';

        if (!activeOptimize) {
            const gridWidth = container.clientWidth;
            const gridHeight = container.clientHeight;

            const leftPosition = (gridWidth - width * 14.4) / 2;
            const topPosition = (gridHeight - height * 14.4) / 2;

            newBuilding.style.left = `${leftPosition}px`;
            newBuilding.style.top = `${topPosition}px`;
        } else {
            const existingBuildings = document.querySelectorAll('.building.custom');
            if (existingBuildings.length > 0) {
                const lastBuilding = existingBuildings[existingBuildings.length - 1];
                const lastBuildingRect = lastBuilding.getBoundingClientRect();
                newBuilding.style.left = `${lastBuildingRect.left + lastBuildingRect.width + 10}px`;
                newBuilding.style.top = lastBuilding.style.top;
            } else {
                newBuilding.style.left = '0px';
                newBuilding.style.top = '0px';
            }
        }

        const nameLayer = document.createElement('div');
        nameLayer.style.pointerEvents = 'none';
        nameLayer.innerHTML = `<div style="text-align: center;">${name}</div>`;
        newBuilding.appendChild(nameLayer);

        container.appendChild(newBuilding);
        buildingCount++;

        const buildingInfo = document.createElement('div');
        buildingInfo.className = 'row building-info';
        buildingInfo.innerHTML = `
            <div class="col">${name}</div>
            <div class="col">${width}x${height}</div>
            <div class="col"><div class="color-square" style="background-color: rgb(${color});"></div></div>
            <div class="col"><button class="btn btn-dark remove-building-btn" onclick="removeBuildingFromList(this)">Delete</button></div>
        `;
        buildingList.appendChild(buildingInfo);

        buildingData.push({ name, color, width: width * 14.4, height: height * 14.4, element: newBuilding, infoElement: buildingInfo });

        if (activeOptimize) {
            optimizeBuildings();
        }
    }
}

let isSwappedDimensions = false;

document.getElementById("swapButton").addEventListener("click", () => {
    isSwappedDimensions = !isSwappedDimensions;

});

document.addEventListener("DOMContentLoaded", populateBuildingsModal);

function filterBuildingsBySearch() {
    const searchQuery = document.getElementById("buildingSearch").value.toLowerCase();
    const buildingsGrid = document.getElementById("buildingsGrid");

    buildingsGrid.innerHTML = "";

    const filters = Array.from(document.querySelectorAll(".filter-checkbox"))
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value);

    predefinedBuildings.forEach(building => {
        const size = `${building.width}x${building.height}`;
        const matchesSearch = building.name.toLowerCase().includes(searchQuery);

        if (matchesSearch && (filters.includes(size) || (filters.includes("other") && size !== "5x5" && size !== "5x10"))) {
            const buildingCol = document.createElement("div");
            buildingCol.className = "col-md-6 col-sm-12 mb-4";

            buildingCol.innerHTML = `
                <div class="box">
                    <div class="box-icon">
                        ${building.image ?
                        `<img src="${building.image}" alt="${building.name}" class="building-icon">` :
                        `<i class="bi bi-house"></i>`}
                    </div>
                    <div class="box-content bugfix1">
                        <h2>${building.name}</h2>
                        <hr>
                        <p>${building.description || "No description available."}</p>
                    </div>
                </div>
            `;

            buildingCol.querySelector('.box').addEventListener('click', () => {
                createCustomBuildingFromPredefined(building);
            });

            buildingsGrid.appendChild(buildingCol);
        }
    });
}

document.getElementById("buildingSearch").addEventListener("input", filterBuildingsBySearch);
