export function buildEffectContext(data, lang = {}) {

    const effectDefinitions = {};
    const effectCapsMap = {};
    const percentEffectIDs = new Set();

    if (Array.isArray(data.effects)) {
        data.effects.forEach(e => {
            effectDefinitions[e.effectID] = e;
        });
    }

    if (Array.isArray(data.effectCaps)) {
        data.effectCaps.forEach(c => {
            effectCapsMap[c.capID] = c;
        });
    }

    Object.values(effectDefinitions).forEach(effect => {

        const base = effect.name.toLowerCase();

        const possibleKeys = [
            `equip_effect_description_${base}`,
            `ci_effect_${base}`,
            `effect_name_${base}`,
            `effect_desc_${base}`
        ];

        let isPercent = /boost/i.test(effect.name || "");

        for (const key of possibleKeys) {
            if (lang[key]?.includes("%")) {
                isPercent = true;
                break;
            }

            if (lang[`${key}_tt`]?.includes("%")) {
                isPercent = true;
                break;
            }
        }

        if (isPercent && !/unboosted/i.test(effect.name || "")) {
            percentEffectIDs.add(effect.effectID);
        }
    });

    return {
        effectDefinitions,
        effectCapsMap,
        percentEffectIDs
    };
}
