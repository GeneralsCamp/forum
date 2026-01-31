export const availableLanguages = [
  "en","de","fr","pl","hu","ro","es",
  "ru","el","nl","cs","ar","it","ja"
];

export function getInitialLanguage() {
  const saved = localStorage.getItem("selectedLanguage");
  if (saved && availableLanguages.includes(saved)) {
    return saved;
  }

  const browser = navigator.language?.split("-")[0];
  return availableLanguages.includes(browser)
    ? browser
    : "en";
}

export function initLanguageSelector({
  currentLanguage,
  lang,
  onSelect
}) {
  const btn = document.getElementById("languageButtonContainer");
  const modalEl = document.getElementById("languageModal");
  const list = document.getElementById("languageList");
  const title = document.getElementById("languageModalLabel");

  if (!btn || !modalEl || !list) return;

  const modal = new bootstrap.Modal(modalEl);

  title.textContent =
    lang?.dialog_alllanguages_desc || "All languages";

  list.innerHTML = "";

  availableLanguages.forEach(code => {
    const col = document.createElement("div");
    col.className = "col-12 col-md-6 mb-2";

    const b = document.createElement("button");
    b.className = "btn w-100 fw-bold";

    const langLabel =
      lang?.[`language_native_${code}`]
      || code.toUpperCase();

    b.textContent = langLabel;
    b.style.backgroundColor = "#f3e0c2";
    b.style.color = "#433120";

    if (code === currentLanguage) {
      b.disabled = true;
      b.style.opacity = "0.6";
    }

    b.onclick = () => {
      localStorage.setItem("selectedLanguage", code);
      onSelect(code);
      modal.hide();
    };

    col.appendChild(b);
    list.appendChild(col);
  });

  btn.onclick = (e) => {
    e.preventDefault();
    modal.show();
  };
}
