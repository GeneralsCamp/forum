const proxy = "https://corsproxy.io/?";
let lang = {};
let selectedSizes = new Set();
let currentSort = "po";
let allDecorations = [];

async function getItemVersion() {
  const url = proxy + encodeURIComponent("https://empire-html5.goodgamestudios.com/default/items/ItemsVersion.properties");
  const res = await fetch(url);
  const text = await res.text();
  const match = text.match(/CastleItemXMLVersion=(\d+\.\d+)/);
  if (!match) throw new Error("Version: error");
  return match[1];
}

async function getLangVersion() {
  const url = proxy + encodeURIComponent("https://empire-html5.goodgamestudios.com/config/languages/version.json");
  const res = await fetch(url);
  const json = await res.json();
  return json.languages["en"];
}

async function getLanguageData(version) {
  const url = proxy + encodeURIComponent(`https://langserv.public.ggs-ep.com/12@${version}/en/*`);
  const res = await fetch(url);
  const data = await res.json();
  lang = data;
}

async function getItems(version) {
  const url = proxy + encodeURIComponent(`https://empire-html5.goodgamestudios.com/default/items/items_v${version}.json`);
  const res = await fetch(url);
  const data = await res.json();
  return data;
}

function extractDecorations(buildings) {
  return buildings.filter(b =>
    b.buildingGroundType === "DECO" &&
    getPO(b) > 0 &&
    !(
      (b.comment1 && b.comment1.toLowerCase().includes("test")) ||
      (b.comment2 && b.comment2.toLowerCase().includes("test"))
    )
  );
}

function getName(item) {
  const key = `deco_${item.type}_name`;
  return lang[key] || item.type || "???";
}

function getSize(item) {
  return `${item.width}x${item.height}`;
}

function getPO(item) {
  if (item.decoPoints !== undefined && item.decoPoints !== null) {
    return parseInt(item.decoPoints);
  }
  return 0;
}

function getFusionStatus(item) {
  const isSource = item.isFusionSource === "1";
  const isTarget = item.isFusionTarget === "1";

  if (isSource && isTarget) return "target & source";
  if (isSource) return "source";
  if (isTarget) return "target";
  return "-";
}

function parseEffects(effectsStr) {
  if (!effectsStr) return [];

  const effectMap = {
    "61": { name: "Melee strength in attack", percent: true },
    "62": { name: "Range strength in attack", percent: true },
    "370": { name: "Courtyard strength in defense", percent: true },
    "387": { name: "Wall amount in defense", percent: true },
    "413": { name: "Troop recruitment speed", percent: true },
    "414": { name: "Troop recruitment cost decrease", percent: true }
  };

  return effectsStr.split(",").map(eff => {
    const [id, valRaw] = eff.split("&");
    const val = Number(valRaw);
    const entry = effectMap[id];
    if (entry) {
      return `${entry.name}: ${val}${entry.percent ? "%" : ""}`;
    } else {
      return `Effect ID ${id}: To be updated soon!`;
    }
  });
}

function formatNumber(num) {
  return Number(num).toLocaleString(undefined);
}

function createCard(item) {
  const name = getName(item);
  const size = getSize(item);
  const width = parseInt(item.width);
  const height = parseInt(item.height);
  const area = width * height;
  const po = getPO(item);
  const poPerTile = area > 0 ? (po / area).toFixed(2) : "N/A";
  const might = item.mightValue || "0";

  const isFusionSource = item.isFusionSource === "1";
  const isFusionTarget = item.isFusionTarget === "1";
  const fusion = isFusionSource && isFusionTarget ? "Source & Target" :
    isFusionSource ? "Source" :
      isFusionTarget ? "Target" : "-";

  const sellPrice = item.sellC1 || "0";
  const sources = [item.comment1, item.comment2].filter(Boolean);
  const id = item.wodID || "???";

  const effects = parseEffects(item.areaSpecificEffects || "");
  const effectsHTML = effects.length > 0
    ? `<p><strong>Effects:</strong><ul>${effects.map(e => `<li>${e}</li>`).join("")}</ul></p>`
    : "";

  const sourceHTML = sources.length > 0
    ? `<p><strong>Comment:</strong><ul>${sources.map(s => `<li>${s}</li>`).join("")}</ul></p>`
    : `<p><strong>Comment:</strong> -</p>`;

  return `
    <div class="col-md-3 col-12 deco-card" data-name="${name.toLowerCase()}" data-size="${size}" data-po="${po}" data-pot="${poPerTile}">
      <div class="card mb-3">
        <div class="card-body">
          <h5 class="card-title text-center">${name} <br> (ID: ${id})</h5>
          <div class="row">
            <div class="col-12">
              <p><strong>Public order:</strong> ${formatNumber(po)} (${poPerTile} PO/tile)</p>
              <p><strong>Size:</strong> ${size}</p>
              <p><strong>Might point:</strong> ${formatNumber(might)}</p>
              <p><strong>Fusion:</strong> ${fusion}</p>
              <p><strong>Sale price:</strong> ${formatNumber(sellPrice)} coins</p>
              ${sourceHTML}
              ${effectsHTML}
            </div>
          </div>
        </div>
      </div>
    </div>
    `;
}

function renderDecorations(decos) {
  const container = document.getElementById("cards");
  container.innerHTML = decos.map(createCard).join("");
}

function renderSizeFilters(decos) {
  const sizes = [...new Set(decos.map(d => getSize(d)))].sort();
  const filterBox = document.getElementById("sizeFilters");
  filterBox.innerHTML = sizes.map(size => `
    <li>
      <div class="form-check">
        <input class="form-check-input" type="checkbox" value="${size}" id="size-${size}" checked>
        <label class="form-check-label" for="size-${size}">${size}</label>
      </div>
    </li>
  `).join("");

  selectedSizes = new Set(sizes);

  filterBox.querySelectorAll("input").forEach(cb => {
    cb.addEventListener("change", () => {
      if (cb.checked) selectedSizes.add(cb.value);
      else selectedSizes.delete(cb.value);
      applyFiltersAndSorting();
    });
  });
}

function setupEventListeners() {
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", applyFiltersAndSorting);

  const sortSelect = document.getElementById("sortSelect");
  sortSelect.addEventListener("change", () => {
    currentSort = sortSelect.value === "pot" ? "pot" : "po";
    applyFiltersAndSorting();
  });
}

function applyFiltersAndSorting() {
  const search = document.getElementById("searchInput").value.toLowerCase();

  const filtered = allDecorations.filter(item => {
    const name = getName(item).toLowerCase();
    const size = getSize(item);
    return name.includes(search) && selectedSizes.has(size);
  });

  filtered.sort((a, b) => {
    const va = currentSort === "po" ? getPO(a) : getPO(a) / (a.width * a.height);
    const vb = currentSort === "po" ? getPO(b) : getPO(b) / (b.width * b.height);
    return vb - va;
  });

  renderDecorations(filtered);
}

async function init() {
  try {
    const itemVersion = await getItemVersion();
    const langVersion = await getLangVersion();
    console.log("Item version:", itemVersion, "| Language version:", langVersion);

    await getLanguageData(langVersion);
    const json = await getItems(itemVersion);
    allDecorations = extractDecorations(json.buildings);

    renderSizeFilters(allDecorations);
    setupEventListeners();
    renderDecorations(allDecorations);
    applyFiltersAndSorting();
  } catch (err) {
    console.error("Hiba:", err);
    document.getElementById("cards").innerHTML = "<p class='text-danger'>An error occurred while loading data.</p>";
  }
}

init();
