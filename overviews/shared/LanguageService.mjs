export const availableLanguages = [
"en","ar","es","bg","pt","cs","de","da",
"fi","fr","el","hu","it","ja","ko","lt",
"nl","no","pl","ro","ru","sv","sk", "tr"
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
  void currentLanguage;
  void lang;
  void onSelect;
}
