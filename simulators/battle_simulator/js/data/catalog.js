// Add another in-game WOD ID to the appropriate list to expose it in the simulator.
// Leveled soldier and tool families automatically get a level selector from their in-game records.
export const ATTACK_UNIT_IDS = [
  216, // Valkyrie ranger
  215, // Shield-maiden
  10,  // Veteran deathly horror
  9,   // Veteran demon horror
  715, // Deathly horror
  714, // Demon horror
  523, // Glasswing Archer
  534, // Flamebreath Berserker
  556, // Scaleshard Marksman
  545  // Scalebound Guardian
];

export const DEFENSE_UNIT_IDS = [
  238, // Valkyrie sniper lvl.10
  493, // Valkyrie sniper lvl.11
  227, // Protector of the north lvl.10
  489, // Protector of the north lvl.11
  12,  // Veteran composite bowman
  11   // Veteran flame bearer
];

export const ATTACK_TOOL_IDS = [
  649, // Breaching tower
  650, // Boulders
  648, // Heavy ram
  651, // Shield wall
  266, // Glory tower
  298, // Siege mortar
  287, // Hwacha
  276  // Hookshot cannon
];

export const SUPPORT_TOOL_IDS = [
  390, // Hand cannon
  400, // Assault flame thrower
  403, // War wagon
  368, // Shrapnel bomb
  379  // Organ cannon
];

export const DEFENSE_TOOL_IDS = [
  105, // Quicklime bomb
  624, // Arrow slit
  627, // Murder hole
  622, // Portcullis
  625, // Fire moat
  314, // Thunder crash bomb
  325, // Trebuchet
  335, // Field cannon
  346, // Water mine
  357, // Spike board
  450, // Wooden hoarding
  440, // Fire trap
  460, // Mobile cauldron
  471, // Explosive arrows
  430  // Spear trap
];

export const BATTLE_CATALOG_GROUPS = [
  { key: 'attackUnits', label: 'Attack soldiers', kind: 'attackUnit' },
  { key: 'defenseUnits', label: 'Defense soldiers', kind: 'defenseUnit' },
  { key: 'attackTools', label: 'Attack tools', kind: 'attackTool' },
  { key: 'defenseTools', label: 'Defense tools', kind: 'defenseTool' }
];

const entries = ids => ids.map(wodID => ({ wodID: String(wodID) }));

export const BATTLE_CATALOG_PRESETS = {
  default: {
    name: 'Default simulator set',
    attackUnits: entries(ATTACK_UNIT_IDS),
    defenseUnits: entries(DEFENSE_UNIT_IDS),
    attackTools: entries([...ATTACK_TOOL_IDS, ...SUPPORT_TOOL_IDS]),
    defenseTools: entries(DEFENSE_TOOL_IDS)
  }
};

export function cloneBattleCatalog(catalog = BATTLE_CATALOG_PRESETS.default) {
  const normalizedCatalog = {
    ...catalog,
    attackTools: [
      ...(catalog.attackTools || []),
      ...(catalog.supportTools || [])
    ]
  };
  return Object.fromEntries(BATTLE_CATALOG_GROUPS.map(({ key }) => [
    key,
    (normalizedCatalog[key] || []).map(entry => ({ ...entry, wodID: String(entry.wodID) }))
  ]));
}
