/*** GLOBAL VARIABLES ***/
let buildingCount = 0;
let buildingData = [];
let predefinedBuildings = [];
let isSwappedDimensions = false;
let activeOptimize = true;
let isBuildingMoving = false;
let startX, startY, currentBuilding;

/*** DATA FETCHING ***/
function loadPredefinedBuildings() {
    fetch("buildings.json")
        .then(response => response.json())
        .then(data => {
            predefinedBuildings = data;
            populateBuildingsModal();
        })
        .catch(error => console.error("Error loading buildings:", error));
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

/*** GRID FUNCTIONS ***/
function snapToGrid(building) {
    const gridWidth = 14.4;
    const gridHeight = 14.4;
    const nearestX = Math.round(building.offsetLeft / gridWidth) * gridWidth;
    const nearestY = Math.round(building.offsetTop / gridHeight) * gridHeight;
    building.style.left = `${nearestX}px`;
    building.style.top = `${nearestY}px`;
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

function initializeGrid() {
    const gridContainer = document.getElementById('grid');
    gridContainer.innerHTML = '';

    const gridSize = 70;
    
    for (let i = 0; i < gridSize * gridSize; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        gridContainer.appendChild(cell);
    }
}

/*** COLLISION HANDLING ***/
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

/*** BUILDING VALIDATION & CREATION ***/
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

function formatBuildingName(name) {
    return name.split(' ').join('<br>');
}

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
    nameLayer.innerHTML = `<div style="word-wrap: break-word;">${formatBuildingName(data.name)}</div>`;
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
        nameLayer.innerHTML = `<div style="word-wrap: break-word;">${formatBuildingName(name)}</div>`;
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

/*** BUILDING MANIPULATION ***/
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
    let targetBuilding;
    if (e instanceof Event) {
        e.preventDefault();
        targetBuilding = e.target.closest('.building');
    } 
    else if (e instanceof HTMLElement) {
        targetBuilding = e;
    } 
    if (!targetBuilding) return;
    
    if (!targetBuilding.classList.contains('predefined')) {
        const removedBuilding = buildingData.find(data => data.element === targetBuilding);
        if (removedBuilding) {
            removedBuilding.infoElement?.remove();
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

/*** DRAG & DROP FUNCTIONALITY ***/
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

/*** BUILDING OPTIMIZATION ***/
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

function loadOptimizeStateFromCache() {
    const cachedOptimizeState = localStorage.getItem('optimizeState');

    if (cachedOptimizeState !== null) {
        activeOptimize = JSON.parse(cachedOptimizeState);
        const optimizeBtn = document.getElementById('optimizeBtn');
        
        if (optimizeBtn) {
            optimizeBtn.textContent = activeOptimize ? 'ON' : 'OFF';
        }

        if (activeOptimize) {
            optimizeBuildings();
        }
    }
}

function saveOptimizeStateToCache() {
    localStorage.setItem('optimizeState', JSON.stringify(activeOptimize));
}

/*** UI & INTERACTIVITY ***/
function showAlert(message) {
    alert(message);
}

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

/*** SEARCH & FILTER ***/
function populateBuildingsModal() {
    const buildingsGrid = document.getElementById("buildingsGrid");
    buildingsGrid.innerHTML = "";

    // Mentett szűrők és keresési lekérdezés visszatöltése
    const searchQuery = document.getElementById("buildingSearch").value.toLowerCase();
    const activeFilters = Array.from(document.querySelectorAll(".filter-checkbox"))
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value);

    predefinedBuildings.forEach((building) => {
        const size = `${building.width}x${building.height}`;
        if (
            (activeFilters.includes(size)) ||
            (activeFilters.includes("other") && size !== "5x5" && size !== "5x10")
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

            // Alkalmazzuk a keresési szűrőt
            if (building.name.toLowerCase().includes(searchQuery)) {
                buildingsGrid.appendChild(buildingCol);
            }
        }
    });
}

function filterBuildingsBySearch() {
    populateBuildingsModal();

    const searchQuery = document.getElementById("buildingSearch").value.toLowerCase();
    const buildings = document.querySelectorAll("#buildingsGrid .col-md-6");

    buildings.forEach(building => {
        const name = building.querySelector("h2").textContent.toLowerCase();
        if (name.includes(searchQuery)) {
            building.style.display = "block";
        } else {
            building.style.display = "none";
        }
    });
}

/*** FULLSCREEN FUNCTIONS ***/
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

/*** EVENT LISTENERS ***/
document.addEventListener('DOMContentLoaded', function () {
    /*** DEFINING NECESSARY VARIABLES ***/
    window.container = document.querySelector('.container');
    window.grid = document.getElementById('grid');
    window.buildingList = document.getElementById('buildingList');
    window.body = document.body;
    window.gridExpandToggle = document.getElementById('grid-expand-toggle');

    /*** INITIALIZE GRID AND BUILDINGS ***/
    initializeGrid();
    loadPredefinedBuildings();
    loadSavedSlotsUI();

    /*** EVENT LISTENERS ***/
    document.getElementById('grid-expand-toggle').addEventListener('click', toggleGridExpansion);
    document.getElementById('optimizeBtn').addEventListener('click', toggleOptimization);
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
    document.getElementById('swapButton').addEventListener('click', () => {
        isSwappedDimensions = !isSwappedDimensions;
    });

    /*** SEARCH & FILTER LISTENERS ***/
    document.getElementById("buildingSearch").addEventListener("input", filterBuildingsBySearch);
    document.querySelectorAll(".filter-checkbox").forEach(checkbox => {
        checkbox.addEventListener("change", filterBuildingsBySearch);
    });

    /*** LOAD OPTIMIZATION STATE ***/
    loadOptimizeStateFromCache();

    /*** RIGHT-CLICK EVENT FOR REMOVING BUILDINGS ***/
    if (container) {
        container.addEventListener('contextmenu', function (event) {
            event.preventDefault();
            removeBuilding(event);
        });
    } else {
        console.error("Error: '.container' element not found!");
    }

    /*** TOUCH & MOUSE EVENTS FOR MOVING BUILDINGS ***/
    document.addEventListener('touchstart', startMovingBuilding);
    document.addEventListener('touchmove', moveBuilding);
    document.addEventListener('touchend', stopMovingBuilding);
    
    document.addEventListener('mousedown', startMovingBuilding);
    document.addEventListener('mousemove', moveBuilding);
    document.addEventListener('mouseup', stopMovingBuilding);

    /*** MODAL EVENT TO POPULATE BUILDINGS ***/
    document.getElementById("buildingsModal").addEventListener("show.bs.modal", populateBuildingsModal);

    /*** LOAD EXPANSION STATE ***/
    const savedGridState = localStorage.getItem('gridExpand') === 'true';
    if (savedGridState) {
        body.classList.add('gridExpand');
        gridExpandToggle.classList.add('expanded');
        gridExpandToggle.textContent = 'ON';
    } else {
        body.classList.remove('gridExpand');
        gridExpandToggle.classList.remove('expanded');
        gridExpandToggle.textContent = 'OFF';
    }
});


/*** DEVELOPER FUNCTIONS ***/
function share() {
    const layoutData = buildingData.map(data => ({
        name: data.name,
        color: data.color,
        width: data.width,
        height: data.height,
        left: data.element.style.left,
        top: data.element.style.top
    }));

    const jsonString = JSON.stringify(layoutData);
    const encodedData = btoa(jsonString);
    const shareLink = `${window.location.origin}${window.location.pathname}?layout=${encodedData}`;

    const tempInput = document.createElement("textarea");
    tempInput.value = shareLink;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);

    alert("Shareable link copied to clipboard!");
}

function loadSharedLayout() {
    const urlParams = new URLSearchParams(window.location.search);
    const layoutData = urlParams.get("layout");
    if (layoutData) {
        try {
            const decodedData = JSON.parse(atob(layoutData));
            clearAllBuildings();
            decodedData.forEach(createCustomBuildingFromCache);
            alert("Shared layout loaded!");
        } catch (err) {
            console.error("Error:", err);
        }
    }
}

document.addEventListener('DOMContentLoaded', loadSharedLayout);
