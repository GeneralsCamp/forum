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
    "414": { name: "Troop recruitment cost decrease", percent: true },
    "415": { name: "Tool production speed", percent: true },
    "360": { name: "Honey production", percent: false },
    "379": { name: "Honey storage capacity", percent: false },
    "361": { name: "Food production", percent: false },
    "380": { name: "Food storage capacity", percent: false },
    "381": { name: "Market barrow speed (own castles)", percent: true },
    "362": { name: "Mead production", percent: false }, //bad
    "383": { name: "XP earned in attacks", percent: true },
    "384": { name: "XP earned by building", percent: true },
    "371": { name: "Defense courtyard unit limit", percent: false },
    "385": { name: "Defense alliance courtyard unit limit", percent: false },
    "501": { name: "Unknown effect", percent: true },
    "705": { name: "Unknown effect", percent: true },
    "382": { name: "Market barrow capacity ", percent: true }
  };

  const formatter = new Intl.NumberFormat(navigator.language);

  return effectsStr.split(",").map(eff => {
    const [id, valRaw] = eff.split("&");
    const val = Number(valRaw);
    const entry = effectMap[id];

    if (entry) {
      const formatted = formatter.format(val);
      return `${entry.name}: ${formatted}${entry.percent ? "%" : ""}`;
    } else {
      return `Effect ID ${id} (info coming soon)`;
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
    ? `<div class="row"><div class="col-12"><strong>Effects:</strong><ul>${effects.map(e => `<li>${e}</li>`).join("")}</ul></div></div>`
    : "";

  const sourceHTML = sources.length > 0
    ? `<div class="row"><div class="col-12"><strong>Developer comments:</strong><ul>${sources.map(s => `<li>${s}</li>`).join("")}</ul></div></div>`
    : `<div class="row"><div class="col-12"><strong>Developer comments:</strong> -</div></div>`;

  return `
    <div class="col-lg-4 col-md-6 col-12 d-flex">
      <div class="card w-100 h-100">
        <div class="card-header text-center bg-secondary text-light">
          <h4>${name}</h4> <p>(ID: ${id})</p>
        </div>
        <div class="card-body d-flex flex-column">
          <div class="row">
            <div class="col-12"><strong>Public order:</strong> ${formatNumber(po)} (${poPerTile} PO/tile)</div>
          </div>

          <div class="row">
            <div class="col-12"><strong>Size:</strong> ${size}</div>
          </div>

          <div class="row">
            <div class="col-12"><strong>Might points:</strong> ${formatNumber(might)}</div>
          </div>

          <div class="row">
            <div class="col-12"><strong>Fusion:</strong> ${fusion}</div>
          </div>

          <div class="row">
            <div class="col-12"><strong>Sale price:</strong> ${formatNumber(sellPrice)} coins</div>
          </div>
          ${sourceHTML}
          ${effectsHTML}
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

  const items = sizes.map(size => `
    <div class="col-6 mb-1">
      <div class="form-check">
        <input class="form-check-input" type="checkbox" value="${size}" id="size-${size}" checked>
        <label class="form-check-label" for="size-${size}">${size}</label>
      </div>
    </div>
  `).join("");

  filterBox.innerHTML = `<div class="row">${items}</div>`;

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
