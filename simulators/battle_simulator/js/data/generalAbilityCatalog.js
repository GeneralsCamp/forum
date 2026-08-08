import { attackGeneralAbilities, defenseGeneralAbilities } from './variables.js';
import { readStoredJson, writeStoredJson } from './storage.js';

const SUPPORTED_ABILITY_FLAGS = {
  '1001': 'powerSurge',
  '1002': 'riseToTheTask',
  '1003': 'giantSlayer',
  '1005': 'intimidate',
  '1007': 'hordebreaker',
  '1010': 'endlessPractice',
  '1011': 'wayOfTheSword',
  '1012': 'ironWill',
  '1013': 'toolFoulUp',
  '1014': 'heartOfAWarrior',
  '1015': 'toweringShield',
  '1018': 'heroicDefense',
  '1019': 'calmBeforeTheStorm',
  '1020': 'aspectOfTheDragon',
  '1021': 'ayala',
  '1022': 'ambush',
  '1023': 'longbows',
  '1025': 'reinforcedArrows',
  '1027': 'yourCut',
  '1029': 'wayOfPerfection',
  '1030': 'vengeance',
  '1033': 'wingsWhirlwind',
  '1034': 'tailwhip',
  '1035': 'dragonscaleArmor',
  '1038': 'exalted',
  '1039': 'lastingWounds'
};

const SKIPPED_ABILITY_GROUPS = new Set([
  '1016', // Wall Amount
  '1026', // Battlefield Plunder
  '1028'  // Hidden Treasures
]);

const EMPTY_CATALOG = { generals: [], abilities: {} };
let catalog = EMPTY_CATALOG;
const savedLoadouts = {
  attack: { generalId: '', slots: {} },
  defense: { generalId: '', slots: {} }
};
const savedGeneralLoadouts = {
  attack: {},
  defense: {}
};

function stringValue(value) {
  return value == null ? '' : String(value);
}

function splitIds(value) {
  return stringValue(value).split(',').map(id => id.trim()).filter(Boolean);
}

function buildLookup(items, key) {
  return Object.fromEntries((items || [])
    .filter(item => item?.[key] != null)
    .map(item => [stringValue(item[key]), item]));
}

function getEffectValues(effect) {
  return splitIds(effect?.effects).map(entry => entry.split('&')[1] || '0');
}

function replaceToken(text, index, value) {
  return text.replace(new RegExp(`\\{${index}\\}`, 'g'), value);
}

function resolveDescription(groupId, ability, side, effectById, lang) {
  let text = lang?.[`generals_abilities_desc_${side}_${groupId}`] || '';
  if (!text || text === 'None') return text;

  const effectId = side === 'attack'
    ? ability.abilityAttackEffectID
    : ability.abilityDefenseEffectID;
  const values = getEffectValues(effectById[stringValue(effectId)]);
  const trigger = stringValue(ability.triggerPerWave || '1');

  if (groupId === '1021') {
    const placeholder = lang?.generals_abilities_desc_upgrade_placeholder_1021;
    const lastSuppressedWave = values[0] || '0';
    return text.replace(
      '{0}',
      placeholder && Number(lastSuppressedWave) > 0
        ? ` ${placeholder.replace('{0}', lastSuppressedWave)}`
        : ''
    ).trim();
  }
  if (groupId === '1023') {
    const minimum = values[0] || '0';
    const bonus = Number.isFinite(Number(minimum)) ? String(Number(minimum) / 10) : '0';
    return replaceToken(replaceToken(replaceToken(text, 0, minimum), 1, bonus), 2, trigger).trim();
  }
  if (groupId === '1028') {
    const value = values[0] || '0';
    return replaceToken(replaceToken(replaceToken(text, 0, value), 1, side === 'attack' ? value : ''), 2, trigger).trim();
  }
  if (groupId === '1033') {
    const value = values[0] || '0';
    return replaceToken(replaceToken(replaceToken(text, 0, value), 1, value), 2, trigger).trim();
  }
  if (groupId === '1035') {
    const value = values[0] || '0';
    const doubled = Number.isFinite(Number(value)) ? String(Number(value) * 2) : value;
    return replaceToken(replaceToken(replaceToken(text, 0, value), 1, doubled), 2, trigger).trim();
  }

  values.forEach((value, index) => {
    text = replaceToken(text, index, value);
  });
  text = text.replace(/\{0\}/g, '');
  text = text.replace(/\{1\}/g, trigger);
  text = text.replace(/\{2\}/g, trigger);
  return text.trim();
}

function resolveShortDescription(groupId, side, values, lang) {
  let text = lang?.[`generals_abilities_desc_short_${side}_${groupId}`] || '';
  if (groupId === '1021') {
    const placeholder = lang?.generals_abilities_desc_upgrade_placeholder_1021 || '';
    const suffix = placeholder
      ? ` ${replaceToken(placeholder, 0, values[0] || '0')}`
      : '';
    text = replaceToken(text, 0, suffix);
  }
  return text.replace(/\{\d+\}/g, '').trim();
}

function buildAbilities(data, lang, abilityImages) {
  const effectById = buildLookup(data?.generalAbilityEffects, 'abilityEffectID');
  const grouped = {};

  (data?.generalAbilities || []).forEach(ability => {
    const groupId = stringValue(ability.abilityGroupID);
    if (!groupId) return;
    if (!grouped[groupId]) grouped[groupId] = [];
    grouped[groupId].push(ability);
  });

  return Object.fromEntries(Object.entries(grouped).map(([groupId, levels]) => {
    const ability = [...levels].sort((a, b) => Number(b.level || 0) - Number(a.level || 0))[0];
    const attackAvailable = groupId !== '1025' &&
      !!stringValue(ability.abilityAttackEffectID) &&
      stringValue(ability.abilityAttackEffectID) !== '0';
    const defenseAvailable = !!stringValue(ability.abilityDefenseEffectID) && stringValue(ability.abilityDefenseEffectID) !== '0';
    const attackEffectValues = attackAvailable
      ? getEffectValues(effectById[stringValue(ability.abilityAttackEffectID)])
      : [];
    const defenseEffectValues = defenseAvailable
      ? getEffectValues(effectById[stringValue(ability.abilityDefenseEffectID)])
      : [];

    return [groupId, {
      groupId,
      level: Number(ability.level || 3),
      name: lang?.[`generals_abilities_name_${groupId}`] || ability.name || `Ability #${groupId}`,
      icon: abilityImages?.[groupId] || '../../img_base/unknown-icon.webp',
      attackAvailable,
      defenseAvailable,
      attackDescription: attackAvailable ? resolveDescription(groupId, ability, 'attack', effectById, lang) : '',
      defenseDescription: defenseAvailable ? resolveDescription(groupId, ability, 'defense', effectById, lang) : '',
      attackShortDescription: attackAvailable ? resolveShortDescription(groupId, 'attack', attackEffectValues, lang) : '',
      defenseShortDescription: defenseAvailable ? resolveShortDescription(groupId, 'defense', defenseEffectValues, lang) : '',
      attackShortValueTemplate: attackAvailable ? lang?.[`generals_abilities_desc_short_value_attack_${groupId}`] || '' : '',
      defenseShortValueTemplate: defenseAvailable ? lang?.[`generals_abilities_desc_short_value_defense_${groupId}`] || '' : '',
      attackEffectValues,
      defenseEffectValues,
      supported: Object.hasOwn(SUPPORTED_ABILITY_FLAGS, groupId),
      developmentStatus: Object.hasOwn(SUPPORTED_ABILITY_FLAGS, groupId)
        ? 'supported'
        : SKIPPED_ABILITY_GROUPS.has(groupId) ? 'skipped' : 'in-progress'
    }];
  }));
}

function buildSlots(general, side, slotById) {
  const property = side === 'attack' ? 'attackSlots' : 'defenseSlots';
  return splitIds(general[property]).map((slotId, index) => ({
    slotId,
    index: index + 1,
    groupIds: splitIds(slotById[slotId]?.abilityGroupIDs)
  }));
}

function normalizeLoadout(side, loadout) {
  const generalId = stringValue(loadout?.generalId);
  const general = catalog.generals.find(item => item.id === generalId);
  if (!general) return { generalId: '', slots: {} };

  const validSlots = new Map(general[`${side}Slots`].map(slot => [slot.slotId, slot]));
  const slots = {};
  Object.entries(loadout?.slots || {}).forEach(([slotId, groupIdValue]) => {
    const groupId = stringValue(groupIdValue);
    const slot = validSlots.get(slotId);
    const ability = catalog.abilities[groupId];
    const sideAvailable = side === 'attack' ? ability?.attackAvailable : ability?.defenseAvailable;
    if (slot?.groupIds.includes(groupId) && ability?.supported && sideAvailable) {
      slots[slotId] = groupId;
    }
  });
  return { generalId, slots };
}

function setAbilityFlags(side, loadout) {
  const target = side === 'attack' ? attackGeneralAbilities : defenseGeneralAbilities;
  Object.values(SUPPORTED_ABILITY_FLAGS).forEach(flag => {
    if (Object.hasOwn(target, flag)) target[flag] = false;
  });
  Object.values(loadout.slots).forEach(groupId => {
    const flag = SUPPORTED_ABILITY_FLAGS[groupId];
    if (flag && Object.hasOwn(target, flag)) target[flag] = true;
  });
}

export function initializeGeneralAbilityCatalog({ data, lang, imageMaps }) {
  const slotById = buildLookup(data?.generalSlots, 'slotID');
  const abilities = buildAbilities(data, lang, imageMaps?.abilities || {});
  const generals = (data?.generals || [])
    .filter(general => stringValue(
      general.isNpcGeneral ?? general.isNPCGeneral ?? general.isnpcgeneral
    ) !== '1')
    .map(general => ({
      id: stringValue(general.generalID),
      rarityId: Number(general.generalRarityID ?? general.generalRarityId ?? general.generalrarityid) || 0,
      name: lang?.[`generals_characters_${general.generalID}_name`] || general.generalName || `General #${general.generalID}`,
      portrait: imageMaps?.fullPortraits?.[stringValue(general.generalID)] || '../../img_base/battle_simulator/unknown.png',
      attackSlots: buildSlots(general, 'attack', slotById),
      defenseSlots: buildSlots(general, 'defense', slotById)
    }))
    .sort((a, b) => b.rarityId - a.rarityId || a.name.localeCompare(b.name));

  catalog = { generals, abilities };
  ['attack', 'defense'].forEach(side => {
    const stored = readStoredJson(`${side}GeneralLoadout`, null);
    const storedGeneralLoadouts = readStoredJson(`${side}GeneralLoadouts`, {});
    savedGeneralLoadouts[side] = {};
    Object.entries(storedGeneralLoadouts || {}).forEach(([generalId, loadout]) => {
      const normalized = normalizeLoadout(side, {
        generalId,
        slots: loadout?.slots || loadout
      });
      if (normalized.generalId) savedGeneralLoadouts[side][normalized.generalId] = normalized;
    });
    savedLoadouts[side] = normalizeLoadout(side, stored);
    if (savedLoadouts[side].generalId) {
      savedGeneralLoadouts[side][savedLoadouts[side].generalId] = savedLoadouts[side];
    }
    if (stored) setAbilityFlags(side, savedLoadouts[side]);
  });
  syncGeneralPortraits();
}

export function getGeneralAbilityCatalog() {
  return catalog;
}

export function getGeneralLoadout(side, generalId) {
  const source = generalId === undefined
    ? savedLoadouts[side]
    : savedGeneralLoadouts[side]?.[stringValue(generalId)];
  return {
    generalId: source?.generalId || stringValue(generalId),
    slots: { ...(source?.slots || {}) }
  };
}

export function commitGeneralLoadout(side, loadout, generalLoadouts = {}) {
  Object.entries(generalLoadouts).forEach(([generalId, slots]) => {
    const remembered = normalizeLoadout(side, {
      generalId,
      slots: slots?.slots || slots
    });
    if (remembered.generalId) savedGeneralLoadouts[side][remembered.generalId] = remembered;
  });
  const normalized = normalizeLoadout(side, loadout);
  savedLoadouts[side] = normalized;
  if (normalized.generalId) savedGeneralLoadouts[side][normalized.generalId] = normalized;
  setAbilityFlags(side, normalized);
  writeStoredJson(`${side}GeneralLoadout`, normalized);
  writeStoredJson(`${side}GeneralLoadouts`, savedGeneralLoadouts[side]);
  writeStoredJson(`${side}GeneralAbilities`, side === 'attack' ? attackGeneralAbilities : defenseGeneralAbilities);
  syncGeneralPortraits();
}

export function syncGeneralPortraits() {
  const configs = [
    ['attack', '.general-img'],
    ['defense', '.enemy-img']
  ];
  configs.forEach(([side, selector]) => {
    const image = document.querySelector(selector);
    if (!image) return;
    const general = catalog.generals.find(item => item.id === savedLoadouts[side]?.generalId);
    image.src = general?.portrait || '../../img_base/battle_simulator/unknown.png';
    image.alt = general?.name || (side === 'attack' ? 'Attack general' : 'Defense general');
    image.closest('.general-bg1, .general-bg2')?.setAttribute('title', general?.name || 'Select general');
  });
}
