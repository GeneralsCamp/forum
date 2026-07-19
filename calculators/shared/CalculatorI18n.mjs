import { getInitialLanguage } from "../../overviews/shared/LanguageService.mjs";

function interpolate(template, values = {}) {
  return String(template ?? "").replace(/\{(\w+)\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match
  ));
}

export async function initCalculatorI18n({ url = "./ownLang.json" } = {}) {
  const language = String(getInitialLanguage() || "en").toLowerCase();
  const baseLanguage = language.split("-")[0];
  let translations = {};

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    translations = await response.json();
  } catch (error) {
    console.error(`Calculator translations could not be loaded from ${url}:`, error);
  }

  const selected = translations?.[language]?.ui
    || translations?.[baseLanguage]?.ui
    || translations?.en?.ui
    || {};
  const english = translations?.en?.ui || {};

  const t = (key, values = {}, fallback = "") => interpolate(
    selected[key] ?? english[key] ?? fallback ?? key,
    values
  );

  document.documentElement.lang = baseLanguage || "en";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const values = element.dataset.i18nValue === undefined
      ? {}
      : { value: element.dataset.i18nValue };
    const suffix = element.dataset.i18nSuffix || "";
    element.textContent = `${t(element.dataset.i18n, values, element.textContent.trim())}${suffix}`;
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(
      element.dataset.i18nPlaceholder,
      {},
      element.getAttribute("placeholder") || ""
    );
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(
      element.dataset.i18nAriaLabel,
      {},
      element.getAttribute("aria-label") || ""
    ));
  });

  return {
    language,
    t,
    formatNumber(value, options) {
      return new Intl.NumberFormat(language, options).format(value);
    }
  };
}
