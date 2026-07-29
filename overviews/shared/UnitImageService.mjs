export function getUnitTypeAliases(rawType, gameSource = "empire") {
  const type = String(rawType || "").trim();
  const typeLc = type.toLowerCase();
  const aliases = [type];

  if (/^nomadcoinboost(?:wood|stone)$/i.test(type)) {
    aliases.push("NomadCoinBoost", "NomadCoinBoostStone");
  }

  if (typeLc.startsWith("aliensamuraianti")) {
    const suffix = type.slice("AlienSamuraiAnti".length);
    if (suffix) {
      aliases.push(`AlienInvasionAnti${suffix}`);
      if (suffix.toLowerCase() === "shield") {
        aliases.push("AlienInvasionAntiShields");
      }
    }
  }

  if (gameSource === "e4k" && typeLc === "skeletalhunter") {
    aliases.push("Skeletalarcher");
  }

  // E4K uses different type names for these reused Empire assets.
  if (gameSource === "e4k" && typeLc === "sceatsuppattkilldefenders") {
    aliases.push("SceatSuppAttAttackPower");
  }
  if (gameSource === "e4k" && typeLc === "sceatsuppattackwaves") {
    aliases.push("SceatSuppAttWaves");
  }

  return [...new Set(aliases.filter(Boolean))];
}

function isGenericUnitAssetName(rawName, normalizeNameFn) {
  const name = normalizeNameFn(rawName);
  return name === "eventtool" || name === "eventunit" || name === "unit";
}

export function resolveUnitImageUrl({
  unit,
  unitImageUrlMap,
  unitImageEntries = Object.entries(unitImageUrlMap || {}),
  gameSource = "empire",
  normalizeNameFn
}) {
  const rawName = unit?.name || unit?.Name || "";
  const rawType = unit?.type || unit?.Type || "";
  if (!rawName || !rawType || typeof normalizeNameFn !== "function") return null;

  const nameNorm = normalizeNameFn(rawName);
  const typeAliases = getUnitTypeAliases(rawType, gameSource);
  const typeNorms = typeAliases.map(normalizeNameFn);
  const exactKeys = [
    ...typeAliases.flatMap((type) => [
      normalizeNameFn(`${rawName}_unit_${type}`),
      normalizeNameFn(`${type}_unit_${rawName}`),
      normalizeNameFn(type)
    ]),
    normalizeNameFn(rawName)
  ];

  for (const key of exactKeys) {
    if (unitImageUrlMap?.[key]) return unitImageUrlMap[key];
  }

  const strictMatch = unitImageEntries.find(([key]) =>
    typeNorms.some((typeNorm) => key.includes(typeNorm))
    && key.includes(nameNorm)
    && key.includes("unit")
  );
  if (strictMatch) return strictMatch[1];

  const typeMatch = unitImageEntries.find(([key]) =>
    typeNorms.some((typeNorm) => key.includes(typeNorm)) && key.includes("unit")
  );
  if (typeMatch) return typeMatch[1];

  if (!isGenericUnitAssetName(rawName, normalizeNameFn)) {
    const nameMatch = unitImageEntries.find(([key]) =>
      key.includes(nameNorm) && key.includes("unit")
    );
    if (nameMatch) return nameMatch[1];
  }

  return null;
}
