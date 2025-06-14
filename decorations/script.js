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
  const decorations = buildings.filter(b =>
    b.name?.toLowerCase() === "deco" &&
    getPO(b) > 0 &&
    !(
      (b.comment1 && b.comment1.toLowerCase().includes("test")) ||
      (b.comment2 && b.comment2.toLowerCase().includes("test"))
    )
  );

  console.log(`Found ${decorations.length} decorations`);
  return decorations;
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

  if (item.initialFusionLevel !== undefined && item.initialFusionLevel !== null) {
    const level = parseInt(item.initialFusionLevel);
    if (!isNaN(level)) {
      return 100 + level * 5;
    }
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
    "62": { name: "Ranged strength in attack", percent: true },
    "370": { name: "Courtyard strength in defense", percent: true },
    "386": { name: "Courtyard strength in attack", percent: true },
    "387": { name: "Wall amount in defense", percent: true },
    "413": { name: "Troop recruitment speed", percent: true },
    "414": { name: "Troop recruitment cost decrease", percent: true },
    "415": { name: "Tool production speed", percent: true },
    "360": { name: "Honey production", percent: false },
    "379": { name: "Honey storage capacity", percent: false },
    "361": { name: "Food production", percent: false },
    "380": { name: "Food storage capacity", percent: false },
    "381": { name: "Market barrow speed between your castles", percent: true },
    "382": { name: "Market barrow capacity", percent: true },
    "362": { name: "Mead production", percent: false },
    "405": { name: "Mead production", percent: false },
    "408": { name: "Mead production", percent: true },
    "406": { name: "Mead storage capacity", percent: false },
    "383": { name: "XP earned in attacks", percent: true },
    "384": { name: "XP earned by building", percent: true },
    "82": { name: "XP earned in attacks", percent: true },
    "83": { name: "XP earned by building", percent: true },
    "90": { name: "Market barrow capacity", percent: false },
    "371": { name: "Defense courtyard unit limit", percent: false },
    "385": { name: "Defense alliance courtyard unit limit", percent: false },
    "388": { name: "Wood production bonus (Great Empire)", percent: true },
    "389": { name: "Stone production bonus (Great Empire)", percent: true },
    "390": { name: "Iron production bonus (Great Empire)", percent: true },
    "391": { name: "Wood production bonus (Everwinter Glacier)", percent: true },
    "392": { name: "Stone production bonus (Everwinter Glacier)", percent: true },
    "393": { name: "Charcoal production bonus (Everwinter Glacier)", percent: true },
    "409": { name: "Food production boost (Everwinter Glacier)", percent: true },
    "394": { name: "Wood production bonus (Burning Sands)", percent: true },
    "395": { name: "Stone production bonus (Burning Sands)", percent: true },
    "396": { name: "Oil production bonus (Burning Sands)", percent: true },
    "416": { name: "Food production boost (Burning Sands)", percent: true },
    "397": { name: "Wood production bonus (Fire Peaks)", percent: true },
    "398": { name: "Stone production bonus (Fire Peaks)", percent: true },
    "399": { name: "Glass production bonus (Fire Peaks)", percent: true },
    "417": { name: "Food production boost (Fire Peaks)", percent: true },
    "369": { name: "Front unit limit when attacking", percent: true },
    "368": { name: "Flank unit limit when attacking", percent: true },
    "410": { name: "Courtyard strength in attack", percent: true },
    "411": { name: "Melee strength in attack", percent: true },
    "412": { name: "Ranged strength in attack", percent: true },
    "423": { name: "Ranged strength in attack", percent: true },
    "424": { name: "Melee strength in attack", percent: true },
    "407": { name: "Food production", percent: false },
    "378": { name: "Beef production", percent: false }
    //705 1%
    //501 15%
    //612 Green 3%
    //611 Green 3%
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

  const sellPriceRaw = item.sellC1 || "0";
  let sellPriceDisplay;

  if (Number(sellPriceRaw) === 0 && item.sellSoldierBiscuit) {
    sellPriceDisplay = `${formatNumber(item.sellSoldierBiscuit)} biscuits`;
  } else {
    sellPriceDisplay = `${formatNumber(sellPriceRaw)} coins`;
  }

  const sources = [item.comment1, item.comment2].filter(Boolean);
  const id = item.wodID || "???";

  const effects = parseEffects(item.areaSpecificEffects || "");
  const effectsHTML = effects.length > 0
    ? `<p><strong>Effects:</strong><br>${effects.map(e => `- ${e}`).join("<br>")}</p>`
    : `<p><strong>No effects!</strong></p>`;

  const sourceHTML = sources.length > 0
    ? `<p><strong>Developer comments:</strong><br>${sources.map(s => `- ${s}`).join("<br>")}</p>`
    : `<p><strong>No developer comments!</strong></p>`;

return `
  <div class="col-md-6 col-sm-12 d-flex flex-column">
    <a href="#" class="box flex-fill">
      <div class="box-content">
        <h2>${name} (wodID: ${id})</h2>
        <hr>
        <p><strong>Public order:</strong> ${formatNumber(po)} (${poPerTile} PO/tile)</p>
        <hr>
        <p><strong>Size:</strong> ${size}</p>
        <hr>
        <p><strong>Might points:</strong> ${formatNumber(might)}</p>
        <hr>
        <p><strong>Fusion:</strong> ${fusion}</p>
        <hr>
        <p><strong>Sale price:</strong> ${sellPriceDisplay}</p>
        <hr>
        ${sourceHTML}
        <hr>
        ${effectsHTML}
      </div>
    </a>
  </div>
`;


}

function renderDecorations(decos) {
  const container = document.getElementById("cards");
  container.innerHTML = decos.map(createCard).join("");
}

function getAvailableSizes(items) {
  const sizes = new Set();
  items.forEach(item => {
    const size = getSize(item);
    if (size) sizes.add(size);
  });

  return [...sizes].sort((a, b) => {
    const [aW, aH] = a.split('x').map(Number);
    const [bW, bH] = b.split('x').map(Number);
    const aArea = aW * aH;
    const bArea = bW * bH;
    return bArea - aArea;
  });
}

function renderSizeFilters(allDecorations) {
  const sizeFiltersContainer = document.getElementById("sizeFilters");
  sizeFiltersContainer.innerHTML = "";

  const sizes = getAvailableSizes(allDecorations);
  sizes.forEach(size => {
    const li = document.createElement("li");

    const div = document.createElement("div");
    div.className = "form-check";

    const checkbox = document.createElement("input");
    checkbox.className = "form-check-input";
    checkbox.type = "checkbox";
    checkbox.value = size;
    checkbox.id = `size-${size}`;
    checkbox.checked = true;

    checkbox.addEventListener("change", () => {
      updateSelectedSizes();
      applyFiltersAndSorting();
    });

    const label = document.createElement("label");
    label.className = "form-check-label";
    label.htmlFor = `size-${size}`;
    label.textContent = size;

    div.appendChild(checkbox);
    div.appendChild(label);
    li.appendChild(div);
    sizeFiltersContainer.appendChild(li);
  });

  updateSelectedSizes();
}

function updateSelectedSizes() {
  const checkboxes = document.querySelectorAll("#sizeFilters input[type='checkbox']");
  selectedSizes.clear();
  checkboxes.forEach(cb => {
    if (cb.checked) {
      selectedSizes.add(cb.value);
    }
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
    const wodID = (item.wodID || "").toString().toLowerCase();
    const size = getSize(item);
    return (name.includes(search) || wodID.includes(search)) && selectedSizes.has(size);
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
