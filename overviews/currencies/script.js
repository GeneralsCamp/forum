import { coreInit } from "../shared/CoreInit.mjs";
import { getInitialLanguage } from "../shared/LanguageService.mjs";
import { initAutoHeight } from "../shared/ResizeService.mjs";
import { getSharedLanguagePack } from "../shared/SharedTextService.mjs";

const searchInput = document.getElementById("searchInput");
const rowsElement = document.getElementById("currencyRows");
const tableWrap = document.getElementById("tableWrap");
const emptyState = document.getElementById("emptyState");
const searchButton = document.getElementById("searchButton");
const sortSelect = document.getElementById("sortSelect");
const currentLanguage = getInitialLanguage();

let currencies = [];
let appliedSearchText = "";
let ownLang = {};
let sharedLangPack = { filters: {}, ui: {} };

function normalizeKeys(input) {
  if (!input || typeof input !== "object") return input;
  if (Array.isArray(input)) return input.map(normalizeKeys);

  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key.toLowerCase(), normalizeKeys(value)])
  );
}

async function loadOwnLang() {
  try {
    const response = await fetch("./ownLang.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    ownLang = normalizeKeys(await response.json());
  } catch (error) {
    console.error("Error loading ownLang.json:", error);
    ownLang = {};
  }
}

function ui(key, fallback = "") {
  const normalizedKey = key.toLowerCase();
  return ownLang[currentLanguage]?.ui?.[normalizedKey]
    || ownLang.en?.ui?.[normalizedKey]
    || fallback;
}

function applyTranslations() {
  const filters = sharedLangPack.filters || {};
  const sharedUi = sharedLangPack.ui || {};
  const nameLabel = filters.search_name || "Name";
  const idLabel = filters.search_id || "ID";

  document.documentElement.lang = currentLanguage;
  document.documentElement.dir = currentLanguage === "ar" ? "rtl" : "ltr";

  document.querySelector('label[for="filterName"]').textContent = nameLabel;
  document.querySelector('label[for="filterID"]').textContent = idLabel;
  document.getElementById("headerName").textContent = nameLabel;
  document.getElementById("headerID").textContent = idLabel;
  document.getElementById("headerSoftCap").textContent = ui("soft_cap", "Soft cap");
  document.getElementById("headerHardCap").textContent = ui("hard_cap", "Hard cap");

  sortSelect.options[0].text = ui("sort_id_asc", "Sort by ID (ascending)");
  sortSelect.options[1].text = ui("sort_name_asc", "Sort by name (ascending)");
  sortSelect.setAttribute("aria-label", ui("sort_aria", "Sort currencies"));

  searchInput.setAttribute("aria-label", ui("search_aria", "Search currencies"));
  searchButton.setAttribute("aria-label", ui("search_aria", "Search currencies"));
  document.getElementById("searchFilterButton")
    .setAttribute("aria-label", ui("search_filters_aria", "Search filters"));
  document.getElementById("homeLink").setAttribute("aria-label", ui("home_aria", "Home"));

  emptyState.textContent = sharedUi.no_match_filters || "No match to the current filters.";
}

function normalizeAssetName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getCurrencyName(currency, lang) {
  const internalName = String(currency.Name ?? currency.name ?? "").trim();
  const assetName = String(currency.assetName ?? currency.assetname ?? "").trim();
  const baseName = internalName.replace(/\d+$/, "");
  const candidates = [internalName, assetName, baseName].filter(Boolean);
  const catalystLevel = internalName.match(/^DecoCatalyst(\d+)$/i)?.[1];

  const withLevel = (name) => {
    if (!catalystLevel) return name;
    const levelLabel = String(lang.level || "Level");
    return `${name} ${levelLabel} ${catalystLevel}`;
  };

  for (const candidate of candidates) {
    const translatedName = lang[`currency_name_${candidate}`.toLowerCase()];
    if (translatedName) return withLevel(String(translatedName));
  }

  return withLevel(assetName || baseName || internalName || "Unknown");
}

function renderRows() {
  const query = appliedSearchText.trim().toLocaleLowerCase();
  const selectedFilters = Array.from(document.querySelectorAll(".search-filter:checked"))
    .map((checkbox) => checkbox.value);

  const visibleCurrencies = currencies.filter((currency) => {
    if (!query || !selectedFilters.length) return true;
    return selectedFilters.some((filter) => currency.searchFields[filter]?.includes(query));
  });

  visibleCurrencies.sort((a, b) => {
    if (sortSelect.value === "nameAsc") {
      return a.displayName.localeCompare(b.displayName, currentLanguage);
    }
    return Number(a.id) - Number(b.id);
  });

  const fragment = document.createDocumentFragment();

  visibleCurrencies.forEach((currency) => {
    const row = document.createElement("tr");
    const idCell = document.createElement("td");
    const nameCell = document.createElement("td");
    const softCapCell = document.createElement("td");
    const hardCapCell = document.createElement("td");

    idCell.textContent = currency.id;
    const nameContent = document.createElement("div");
    nameContent.className = "currency-name";

    if (currency.imageUrl) {
      const image = document.createElement("img");
      image.className = "currency-icon";
      image.src = currency.imageUrl;
      image.alt = "";
      image.loading = "lazy";
      image.addEventListener("error", () => image.remove(), { once: true });
      nameContent.append(image);
    }

    const name = document.createElement("span");
    name.textContent = currency.displayName;
    nameContent.append(name);
    nameCell.append(nameContent);

    softCapCell.className = "currency-cap";
    softCapCell.textContent = currency.softCap;
    hardCapCell.className = "currency-cap";
    hardCapCell.textContent = currency.hardCap;

    row.append(idCell, nameCell, softCapCell, hardCapCell);
    fragment.append(row);
  });

  rowsElement.replaceChildren(fragment);
  emptyState.hidden = visibleCurrencies.length > 0;
}

function updateSearchState() {
  const selectedLabels = Array.from(document.querySelectorAll(".search-filter:checked"))
    .map((checkbox) => checkbox.closest(".form-check")?.querySelector("label")?.textContent?.trim())
    .filter(Boolean);

  const enabled = selectedLabels.length > 0;
  searchInput.disabled = !enabled;
  searchButton.disabled = !enabled;

  if (!enabled) {
    searchInput.value = "";
    appliedSearchText = "";
    searchInput.placeholder = sharedLangPack.filters?.search_disabled || "Unavailable to search!";
  } else {
    const prefix = sharedLangPack.filters?.search_placeholder_prefix || "Search by: ";
    searchInput.placeholder = `${prefix}${selectedLabels.join(", ")}`;
  }
}

function setupEventListeners() {
  const runSearch = () => {
    if (searchInput.disabled) return;
    appliedSearchText = searchInput.value || "";
    renderRows();
  };

  searchButton.addEventListener("click", runSearch);
  searchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    runSearch();
  });

  sortSelect.addEventListener("change", renderRows);

  document.querySelectorAll(".search-filter").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      updateSearchState();
      renderRows();
    });

    checkbox.closest(".form-check")?.addEventListener("click", (event) => {
      if (event.target !== checkbox && event.target.tagName.toLowerCase() !== "label") {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event("change"));
      }
      event.stopPropagation();
    });
  });

  updateSearchState();
}

async function init() {
  try {
    [sharedLangPack] = await Promise.all([
      getSharedLanguagePack(currentLanguage),
      loadOwnLang()
    ]);
    applyTranslations();

    await coreInit({
      langCode: currentLanguage,
      normalizeNameFn: normalizeAssetName,
      assets: {
        currencies: true
      },
      onReady: async ({ lang, data, imageMaps }) => {
        const currencyImages = imageMaps?.currencies || {};
        const capsByCurrencyId = new Map(
          (Array.isArray(data.currencyCaps) ? data.currencyCaps : []).map((cap) => [
            String(cap.currencyID ?? cap.currencyid ?? ""),
            cap
          ])
        );

        currencies = (Array.isArray(data.currencies) ? data.currencies : [])
          .map((currency) => {
            const id = String(currency.currencyID ?? currency.currencyid ?? "");
            const internalName = String(currency.Name ?? currency.name ?? "");
            const assetName = String(currency.assetName ?? currency.assetname ?? internalName);
            const displayName = getCurrencyName(currency, lang);
            const cap = capsByCurrencyId.get(id);
            const softCap = String(cap?.softCap ?? cap?.softcap ?? "–");
            const hardCap = String(cap?.hardCap ?? cap?.hardcap ?? "–");

            return {
              id,
              displayName,
              imageUrl: currencyImages[normalizeAssetName(assetName)] || "",
              softCap,
              hardCap,
              searchFields: {
                name: `${displayName} ${internalName} ${assetName}`.toLocaleLowerCase(),
                id: id.toLocaleLowerCase()
              }
            };
          })
          .filter((currency) => currency.id)
          .sort((a, b) => Number(a.id) - Number(b.id));

        tableWrap.hidden = false;
        setupEventListeners();
        renderRows();
      }
    });
  } catch (error) {
    console.error(error);
    tableWrap.hidden = false;
    rowsElement.replaceChildren();
    emptyState.hidden = false;
    emptyState.textContent = ui("load_error", "Could not load currencies.");
  }
}

initAutoHeight({
  contentSelector: "#tableWrap",
  subtractSelectors: [".note", ".page-title"],
  extraOffset: 4
});

init();
