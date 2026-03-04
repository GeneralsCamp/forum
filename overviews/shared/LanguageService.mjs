export const availableLanguages = [
"en","ar","es","bg","pt","cs","de","da",
"fi","fr","el","hu","it","ja","ko","lt",
"nl","no","pl","ro","ru","sv","sk", "tr"
];

function ensureLanguageButton() {
  let btn = document.getElementById("languageButtonContainer");
  if (btn) return btn;

  const topButtons = document.getElementById("topButtonsContainer");
  if (!topButtons) return null;

  btn = document.createElement("a");
  btn.href = "#";
  btn.id = "languageButtonContainer";
  btn.className = "home-icon-link";
  btn.innerHTML = `
    <div class="home-icon" title="Change language">
      <i class="bi bi-globe"></i>
    </div>
  `;

  topButtons.prepend(btn);
  return btn;
}

function ensureLanguageModal() {
  let modalEl = document.getElementById("languageModal");
  if (modalEl) return modalEl;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div class="modal fade" id="languageModal" tabindex="-1" aria-labelledby="languageModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title text-center w-100" id="languageModalLabel"></h5>
          </div>
          <div class="modal-body">
            <div id="languageList" class="row"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  modalEl = wrapper.firstElementChild;
  document.body.appendChild(modalEl);
  return modalEl;
}

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
  const btn = ensureLanguageButton();
  const modalEl = ensureLanguageModal();
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
