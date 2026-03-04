let sharedLangPromise = null;

function normalizeKeys(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(normalizeKeys);
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [String(k).toLowerCase(), normalizeKeys(v)])
  );
}

async function loadSharedLang() {
  if (!sharedLangPromise) {
    sharedLangPromise = fetch(new URL("./sharedOwnLang.json", import.meta.url))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((raw) => normalizeKeys(raw))
      .catch(() => ({}));
  }
  return sharedLangPromise;
}

function mergeGroup(base, extra) {
  return {
    ...(base || {}),
    ...(extra || {})
  };
}

export async function getSharedLanguagePack(language) {
  const dict = await loadSharedLang();
  const langCode = String(language || "en").toLowerCase();
  const baseCode = langCode.split("-")[0];

  const enPack = dict?.en || {};
  const basePack = dict?.[baseCode] || {};
  const fullPack = dict?.[langCode] || {};

  return {
    ...enPack,
    ...basePack,
    ...fullPack,
    filters: mergeGroup(mergeGroup(enPack.filters, basePack.filters), fullPack.filters),
    ui: mergeGroup(mergeGroup(enPack.ui, basePack.ui), fullPack.ui)
  };
}

export async function getSharedText(key, language, fallback = "") {
  const pack = await getSharedLanguagePack(language);
  const keyName = String(key || "").toLowerCase();

  return (
    pack?.ui?.[keyName] ||
    pack?.filters?.[keyName] ||
    pack?.[keyName] ||
    fallback
  );
}
