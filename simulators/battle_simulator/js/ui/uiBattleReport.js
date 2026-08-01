import {
  waves,
  defenseSlots,
  unitImages,
  unitImagesDefense,
  currentSideReport,
  units,
  defense_units,
  tools,
  defense_tools,
  supportTools,
  toolImages,
  toolImagesDefense,
  supportToolImages,
  toolEffects,
  toolEffectsDefense,
  supportToolEffects,
  commanderStats,
  castellanStats,
  attackGeneralAbilities,
  defenseGeneralAbilities,
  getDefenseCourtyardEffectTotals,
  setCurrentSideReport
} from '../data/variables.js';
import { initPresetSwipe } from './swipe.js';
import { imageUrl } from '../data/imagePaths.js';
import { getGeneralAbilityCatalog, getGeneralLoadout } from '../data/generalAbilityCatalog.js';

const SIDE_KEYS = ['left', 'front', 'right', 'cy'];
const SIDE_LABELS = {
  left: 'Left flank',
  front: 'Front',
  right: 'Right flank',
  cy: 'Courtyard'
};
const ABILITY_GROUP_BY_FLAG = {
  powerSurge: '1001',
  giantSlayer: '1003',
  hordebreaker: '1007',
  endlessPractice: '1010',
  wayOfTheSword: '1011',
  ironWill: '1012',
  toolFoulUp: '1013',
  heartOfAWarrior: '1014',
  toweringShield: '1015',
  calmBeforeTheStorm: '1019',
  ayala: '1021',
  ambush: '1022',
  longbows: '1023',
  reinforcedArrows: '1025',
  wayOfPerfection: '1029',
  vengeance: '1030',
  wingsWhirlwind: '1033',
  tailwhip: '1034',
  dragonscaleArmor: '1035',
  exalted: '1038',
  lastingWounds: '1039'
};

let currentReportView = 'summary';

export function battleSimulation() {
  const battleReportModal = new bootstrap.Modal(document.getElementById('battleReportModal'));
  currentReportView = 'summary';
  battleReportModal.show();
  switchReportSide(currentSideReport);

  initPresetSwipe('battleReportModal', direction => {
    const sides = ['left', 'front', 'right', 'cy'];
    const current = document.querySelector('.flanks-button-report.active')?.dataset.section || 'front';
    const currentIndex = sides.indexOf(current);
    const newIndex = (currentIndex + direction + sides.length) % sides.length;
    switchReportSide(sides[newIndex]);
  });
}

export function switchReportSide(side) {
  document.querySelectorAll('.flanks-button-report').forEach(button => {
    button.classList.remove('active');
  });

  setCurrentSideReport(side);
  populateBattleReportModal(side);

  const activeButton = document.querySelector(`.flanks-button-report[data-section="${side}"]`);
  activeButton?.classList.add('active');
}

function toUnitKey(type) {
  return type || '';
}

function sumCounts(units = []) {
  return units.reduce((acc, unit) => acc + (unit.count || 0), 0);
}

function totalPlannedWallAttackers() {
  return ['left', 'front', 'right'].reduce((total, side) => total +
    (waves[side] || []).reduce((waveTotal, wave) => waveTotal +
      (wave?.slots || []).reduce((slotTotal, slot) => slotTotal + (slot?.count || 0), 0), 0), 0);
}

function totalWallDefenders() {
  return ['left', 'front', 'right'].reduce((total, side) => total +
    (defenseSlots[side]?.units || []).reduce((slotTotal, slot) => slotTotal + (slot?.count || 0), 0), 0);
}

function isAbilitySuppressedByAyala(owner, side, waveIndex, phase = 'wave') {
  if (side === 'cy') return false;
  const enemyHasAyala = owner === 'attack'
    ? defenseGeneralAbilities.ayala
    : attackGeneralAbilities.ayala;
  return enemyHasAyala && (phase === 'preCombat' || waveIndex <= 2);
}

function isAttackAbilityActive(flag, side, waveIndex, phase = 'wave') {
  return Boolean(attackGeneralAbilities[flag]) &&
    !isAbilitySuppressedByAyala('attack', side, waveIndex, phase);
}

function isDefenseAbilityActive(flag, side, waveIndex, phase = 'wave') {
  return Boolean(defenseGeneralAbilities[flag]) &&
    !isAbilitySuppressedByAyala('defense', side, waveIndex, phase);
}

function attackWallAbilityScale(side, waveIndex, phase = 'wave') {
  return isDefenseAbilityActive('ironWill', side, waveIndex, phase) ? 0.8 : 1;
}

function defenseWallAbilityScale(side, waveIndex, phase = 'wave') {
  return isAttackAbilityActive('ironWill', side, waveIndex, phase) ? 0.8 : 1;
}

function attackGeneralDebuffScale(side, waveIndex, { phase = 'wave' } = {}) {
  return attackWallAbilityScale(side, waveIndex, phase);
}

function defenseGeneralDebuffScale(side, waveIndex, { phase = 'wave' } = {}) {
  return defenseWallAbilityScale(side, waveIndex, phase);
}

function matchesPreviousAttackWave(wave, previousWaveResult) {
  const previousWave = previousWaveResult?.sourceWave;
  if (!previousWave) return false;
  const currentSlots = wave?.slots || [];
  const previousSlots = previousWave?.slots || [];
  const unitSlotCount = Math.max(currentSlots.length, previousSlots.length);
  const unitCountsMatch = Array.from({ length: unitSlotCount }, (_, index) =>
    (currentSlots[index]?.count || 0) === (previousSlots[index]?.count || 0)
  ).every(Boolean);

  const currentTools = wave?.tools || [];
  const previousTools = previousWave?.tools || [];
  const toolSlotCount = Math.max(currentTools.length, previousTools.length);
  const toolsMatch = Array.from({ length: toolSlotCount }, (_, index) =>
    (currentTools[index]?.count || 0) === (previousTools[index]?.count || 0) &&
    (currentTools[index]?.type || '') === (previousTools[index]?.type || '')
  ).every(Boolean);

  return unitCountsMatch && toolsMatch;
}

function pureDefenseUnitType(defenseUnits) {
  const activeUnits = defenseUnits.filter(unit => unit.count > 0);
  const exactUnitTypes = new Set(activeUnits.map(unit => toUnitKey(unit.type)));
  return exactUnitTypes.size === 1 ? activeUnits[0].type2 : '';
}

function applyPercentageKills(units = [], predicate, rate = 0) {
  const losses = new Map();
  units.forEach(unit => {
    if (!unit || unit.count <= 0 || !predicate(unit)) return;
    const loss = unit.count * rate;
    unit.count -= loss;
    const key = toUnitKey(unit.type);
    losses.set(key, (losses.get(key) || 0) + loss);
  });
  return losses;
}

function getPreviousAttackerLossStrength(previousWaveResult) {
  const result = { ranged: 0, melee: 0 };
  if (!previousWaveResult) return result;

  (previousWaveResult.attackerUnits || []).forEach(unit => {
    const loss = previousWaveResult.attackerLosses?.get(toUnitKey(unit.type)) || 0;
    if (unit.type2 === 'ranged') {
      result.ranged += loss * (unit.rangedCombatStrength || 0);
    } else {
      result.melee += loss * (unit.meleeCombatStrength || 0);
    }
  });
  return result;
}

function getPreviousDefenderLossStrength(previousWaveResult) {
  const result = { ranged: 0, melee: 0 };
  if (!previousWaveResult) return result;

  (previousWaveResult.defenderUnitStats || []).forEach(unit => {
    const loss = previousWaveResult.defenderLosses?.get(toUnitKey(unit.type)) || 0;
    result.ranged += loss * (unit.rangedDefenseStrength || 0);
    result.melee += loss * (unit.meleeDefenseStrength || 0);
  });
  return result;
}

function formatNumber(value) {
  const numberValue = Number(value) || 0;
  return numberValue.toLocaleString();
}

function sumMapValues(map = new Map()) {
  let total = 0;
  map.forEach(value => {
    total += value || 0;
  });
  return total;
}

function distributeLossesByUnit(units = [], totalLoss = 0) {
  const losses = new Map();
  const totalCount = sumCounts(units);
  if (totalLoss <= 0 || totalCount <= 0) {
    units.forEach(unit => losses.set(toUnitKey(unit.type), 0));
    return losses;
  }

  const safeLoss = Math.min(totalLoss, totalCount);
  const provisional = units.map(unit => {
    const exact = (unit.count / totalCount) * safeLoss;
    const floor = Math.floor(exact);
    return {
      type: toUnitKey(unit.type),
      count: unit.count,
      floor,
      remainder: exact - floor
    };
  });

  let assigned = provisional.reduce((acc, item) => acc + item.floor, 0);
  let remaining = safeLoss - assigned;
  provisional.sort((a, b) => b.remainder - a.remainder);

  provisional.forEach(item => {
    let loss = item.floor;
    if (remaining > 0) {
      loss += 1;
      remaining -= 1;
    }
    loss = Math.min(loss, item.count);
    losses.set(item.type, loss);
  });

  return losses;
}

export function applyStrongestKills(units = [], killCount = 0, strengthGetter) {
  if (!killCount || killCount <= 0) return new Map();
  const losses = new Map();
  const ranked = units
    .filter(unit => unit && unit.count > 0)
    .map(unit => ({ unit, strength: strengthGetter(unit) || 0 }))
    .sort((a, b) => b.strength - a.strength);

  let remaining = killCount;
  for (const entry of ranked) {
    if (remaining <= 0) break;
    const take = Math.min(entry.unit.count, remaining);
    entry.unit.count -= take;
    if (take > 0) {
      const key = toUnitKey(entry.unit.type);
      losses.set(key, (losses.get(key) || 0) + take);
    }
    remaining -= take;
  }

  return losses;
}

function sumAttackToolEffects(tools = []) {
  const totals = {
    rangedStrength: 0,
    meleeStrength: 0,
    wall: 0,
    moat: 0,
    gate: 0,
    shield: 0
  };

  tools.forEach(tool => {
    if (!tool || tool.count <= 0) return;
    const effectData = toolEffects?.[tool.type];
    if (!effectData) return;

    [effectData.effect1, effectData.effect2].forEach(effect => {
      if (!effect?.name) return;
      const keyByEffectName = {
        Wall: 'wall',
        Moat: 'moat',
        Gate: 'gate',
        Shield: 'shield',
        RangedStrength: 'rangedStrength',
        MeleeStrength: 'meleeStrength'
      };
      const key = keyByEffectName[effect.name];
      if (key) totals[key] += effect.value * tool.count;
    });
  });

  return totals;
}

function sumSupportToolEffects(tools = []) {
  const totals = {
    yardStrength: 0,
    combatStrength: 0,
    killAnyTroopsYard: 0,
    killMeleeTroopsYard: 0,
    killRangedTroopsYard: 0,
    additionalWave: 0
  };

  tools.forEach(tool => {
    if (!tool || tool.count <= 0) return;
    const effectData = supportToolEffects?.[tool.type];
    if (!effectData) return;

    const applyEffect = effect => {
      if (!effect?.name) return;
      const value = effect.value * tool.count;
      if (effect.name === 'YardStrength') totals.yardStrength += value;
      if (effect.name === 'CombatStrength') totals.combatStrength += value;
      if (effect.name === 'KillAnyTroopsYard') totals.killAnyTroopsYard += value;
      if (effect.name === 'KillMeleeTroopsYard') totals.killMeleeTroopsYard += value;
      if (effect.name === 'KillRangedTroopsYard') totals.killRangedTroopsYard += value;
      if (effect.name === 'AdditionalWave') totals.additionalWave += value;
    };

    applyEffect(effectData.effect1);
    applyEffect(effectData.effect2);
  });

  return totals;
}

function buildSummaryList(countMap, lossMap, includeZeroWithLoss = false) {
  const list = [];
  countMap.forEach((count, type) => {
    list.push({
      type,
      count,
      loss: lossMap?.get(type) || 0
    });
  });
  return list.filter(item => item.count > 0 || (includeZeroWithLoss && item.loss > 0));
}

function buildSummaryFromLossMap(lossMap = new Map()) {
  const list = [];
  lossMap.forEach((loss, type) => {
    if (loss > 0) {
      list.push({ type, count: loss, loss });
    }
  });
  return list;
}

function mapFromUnits(units = []) {
  const map = new Map();
  units.forEach(unit => {
    if (!unit || unit.count <= 0) return;
    map.set(toUnitKey(unit.type), (map.get(toUnitKey(unit.type)) || 0) + unit.count);
  });
  return map;
}

function renderUnitSummaryHTML(unitsSummary, imageMap, isDefense = false) {
  return unitsSummary.map(({ type, count, loss }) => {
    const unitImage = imageMap[type] || 'unknown.png';
    return `
      <div class="unit-slot report-unit">
        <img src="${imageUrl(unitImage)}" class="unit-icon" alt="${type}">
        <div class="unit-info">
          <div class="unit-count">${formatNumber(count)}</div>
          ${loss > 0 ? `<div class="unit-loss">-${formatNumber(loss)}</div>` : `<div class="unit-loss">-</div>`}
        </div>
      </div>
    `;
  }).join('');
}

function distributeLossesAcrossSlots(slots = [], lossMap = new Map()) {
  const slotLosses = new Map();
  const grouped = {};

  slots.forEach(slot => {
    if (!slot || slot.count <= 0 || !slot.type) return;
    if (!grouped[slot.type]) grouped[slot.type] = [];
    grouped[slot.type].push({ key: slot.id, count: slot.count });
  });

  Object.entries(grouped).forEach(([type, groupSlots]) => {
    const totalLoss = lossMap.get(type) || 0;
    if (totalLoss <= 0) return;
    const losses = distributeLossesByUnit(groupSlots.map(s => ({ type: s.key, count: s.count })), totalLoss);
    groupSlots.forEach(slot => {
      slotLosses.set(slot.key, losses.get(slot.key) || 0);
    });
  });

  return slotLosses;
}

function computeAttackBonusesPercent(side, toolTotals, waveIndex) {
  let ranged = (commanderStats.ranged || 0) + (commanderStats.holRanged || 0) + (commanderStats.universal || 0) + (commanderStats.holUniversal || 0);
  let melee = (commanderStats.melee || 0) + (commanderStats.holMelee || 0) + (commanderStats.universal || 0) + (commanderStats.holUniversal || 0);

  if (side === 'front') {
    ranged += commanderStats.frontStrength || 0;
    melee += commanderStats.frontStrength || 0;
  } else if (side === 'left' || side === 'right') {
    ranged += commanderStats.flanksStrength || 0;
    melee += commanderStats.flanksStrength || 0;
  } else if (side === 'cy') {
    ranged += commanderStats.courtyard || 0;
    melee += commanderStats.courtyard || 0;
  }

  const supportTotals = sumSupportToolEffects(waves['Support']?.[0]?.tools || []);
  ranged += supportTotals.combatStrength || 0;
  melee += supportTotals.combatStrength || 0;
  if (side === 'cy') {
    ranged += supportTotals.yardStrength || 0;
    melee += supportTotals.yardStrength || 0;
  }

  ranged += toolTotals.rangedStrength || 0;
  melee += toolTotals.meleeStrength || 0;

  if (side !== 'cy' && isAttackAbilityActive('endlessPractice', side, waveIndex) && waveIndex) {
    const waveBonus = waveIndex * 4 * attackWallAbilityScale(side, waveIndex);
    ranged += waveBonus;
    melee += waveBonus;
  }
  if (side !== 'cy' && isAttackAbilityActive('powerSurge', side, waveIndex) && waveIndex % 2 === 0) {
    const bonus = 10 * attackWallAbilityScale(side, waveIndex);
    ranged += bonus;
    melee += bonus;
  }
  if (side !== 'cy' && isAttackAbilityActive('calmBeforeTheStorm', side, waveIndex)) {
    const waveBonus = (waveIndex % 2 === 1 ? -50 : 60) * attackWallAbilityScale(side, waveIndex);
    ranged += waveBonus;
    melee += waveBonus;
  }

  return {
    rangedMult: 1 + ranged / 100,
    meleeMult: 1 + melee / 100
  };
}

function computeDefenseBonuses(side, defenseToolScale = 1) {
  if (side === 'cy') {
    return { wall: 0, moat: 0, gate: 0 };
  }

  const bonuses = {
    wall: castellanStats.wallProtection || 0,
    moat: castellanStats.moatProtection || 0,
    gate: castellanStats.gateProtection || 0
  };

  ['wallTools', 'moatTools', 'gateTools'].forEach(slotType => {
    const tools = defenseSlots[side]?.[slotType] || [];
    tools.forEach(tool => {
      if (!tool || tool.count <= 0) return;
      const toolId = tool.type?.replace('DefenseTool', '');
      const effectData = toolEffectsDefense?.[toolId];
      if (!effectData) return;

      const applyEffect = effect => {
        if (!effect?.name) return;
        const value = effect.value * tool.count * defenseToolScale;
        if (effect.name === 'Wall') bonuses.wall += value;
        if (effect.name === 'Moat') bonuses.moat += value;
        if (effect.name === 'Gate') bonuses.gate += value;
      };

      applyEffect(effectData.effect1);
      applyEffect(effectData.effect2);
    });
  });

  return bonuses;
}

export function combineDefenseProtectionMultipliers(moatBonus, wallBonus, gateBonus) {
  return (1 + Math.max(moatBonus, 0) / 100)
    * (1 + Math.max(wallBonus, 0) / 100)
    * (1 + Math.max(gateBonus, 0) / 100);
}

export function getCourtyardEntryMultiplier(enteredWallSides) {
  const enteredCount = enteredWallSides.filter(Boolean).length;
  if (enteredCount === 3) return 1.3;
  if (enteredCount === 1) return 0.7;
  return 1;
}

function computeDefenseStrengthBonuses(side, waveIndex, defenseToolScale = 1) {
  let ranged = 100 + (castellanStats.ranged || 0);
  let melee = 100 + (castellanStats.melee || 0);
  const courtyardToolTotals = getDefenseCourtyardEffectTotals();
  const combatStrengthBonus = courtyardToolTotals.CombatStrength || 0;

  if (side === 'cy') {
    const courtyardStrength = (castellanStats.courtyard || 0) + (courtyardToolTotals.Courtyard || 0);
    ranged += courtyardStrength;
    melee += courtyardStrength;
  }

  ['wallTools', 'moatTools', 'gateTools'].forEach(slotType => {
    const tools = defenseSlots[side]?.[slotType] || [];
    tools.forEach(tool => {
      if (!tool || tool.count <= 0) return;
      const toolId = tool.type?.replace('DefenseTool', '');
      const effectData = toolEffectsDefense?.[toolId];
      if (!effectData) return;

      const applyEffect = effect => {
        if (!effect?.name) return;
        const value = effect.value * tool.count * defenseToolScale;
        if (effect.name === 'MeleeStrength') melee += value;
        if (effect.name === 'RangedStrength') ranged += value;
      };

      applyEffect(effectData.effect1);
      applyEffect(effectData.effect2);
    });
  });

  ranged += combatStrengthBonus;
  melee += combatStrengthBonus;

  if (side !== 'cy' && isDefenseAbilityActive('endlessPractice', side, waveIndex) && waveIndex) {
    const waveBonus = waveIndex * 4 * defenseWallAbilityScale(side, waveIndex);
    ranged += waveBonus;
    melee += waveBonus;
  }
  if (side !== 'cy' && isDefenseAbilityActive('powerSurge', side, waveIndex) && waveIndex % 2 === 0) {
    const bonus = 10 * defenseWallAbilityScale(side, waveIndex);
    ranged += bonus;
    melee += bonus;
  }

  return { ranged, melee };
}

function buildDefenseUnits(side) {
  const slots = defenseSlots[side]?.units || [];
  const map = new Map();
  slots.forEach(slot => {
    if (!slot || slot.count <= 0 || !slot.type) return;
    const unitId = slot.type.replace('DefenseUnit', 'unit');
    const unit = defense_units.find(u => u.id === unitId);
    if (!unit) return;
    const existing = map.get(slot.type);
    if (existing) {
      existing.count += slot.count;
    } else {
      map.set(slot.type, {
        type: slot.type,
        count: slot.count,
        type2: unit.type2,
        rangedDefenseStrength: unit.rangedDefenseStrength || 0,
        meleeDefenseStrength: unit.meleeDefenseStrength || 0
      });
    }
  });
  return Array.from(map.values());
}

function computeDefenseTotals(defenseUnits = []) {
  const totals = {
    rangedCount: 0,
    meleeCount: 0,
    rangedRangedBase: 0,
    rangedMeleeBase: 0,
    meleeRangedBase: 0,
    meleeMeleeBase: 0
  };

  defenseUnits.forEach(unit => {
    if (unit.type2 === 'ranged') {
      totals.rangedCount += unit.count;
      totals.rangedRangedBase += unit.count * unit.rangedDefenseStrength;
      totals.rangedMeleeBase += unit.count * unit.meleeDefenseStrength;
    } else {
      totals.meleeCount += unit.count;
      totals.meleeRangedBase += unit.count * unit.rangedDefenseStrength;
      totals.meleeMeleeBase += unit.count * unit.meleeDefenseStrength;
    }
  });

  return totals;
}

function buildAttackUnits(slots = []) {
  const unitMap = new Map((units || []).map(u => [`Unit${u.id.replace(/\D/g, '')}`, u]));
  const map = new Map();
  slots.forEach(slot => {
    if (!slot || slot.count <= 0 || !slot.type) return;
    const unit = unitMap.get(slot.type);
    if (!unit) return;
    const existing = map.get(slot.type);
    if (existing) {
      existing.count += slot.count;
    } else {
      map.set(slot.type, {
        type: slot.type,
        count: slot.count,
        type2: unit.type2,
        strengthGroup: unit.strengthGroup,
        rangedCombatStrength: unit.rangedCombatStrength || 0,
        meleeCombatStrength: unit.meleeCombatStrength || 0
      });
    }
  });
  return Array.from(map.values());
}

function computeAttackTotals(attackUnits = []) {
  let rangedBase = 0;
  let meleeBase = 0;

  attackUnits.forEach(unit => {
    let ranged = unit.count * unit.rangedCombatStrength;
    let melee = unit.count * unit.meleeCombatStrength;

    const groupStrength = unit.strengthGroup === 'mead'
      ? commanderStats.meadStrength
      : unit.strengthGroup === 'horror'
        ? commanderStats.horrorStrength
        : 0;
    if (unit.rangedCombatStrength > unit.meleeCombatStrength) {
      ranged += unit.count * (groupStrength || 0);
    } else {
      melee += unit.count * (groupStrength || 0);
    }

    rangedBase += ranged;
    meleeBase += melee;
  });

  return { rangedBase, meleeBase };
}

function computeWaveBattle(
  side,
  wave,
  defenseUnits,
  attackTotalMultiplier = 1,
  waveIndex = 1,
  defenseTotalMultiplier = 1,
  attackStrengthBonusPercent = 0,
  previousWaveResult = null
) {
  const attackerUnitsBeforeAbilities = buildAttackUnits(wave?.slots || []);
  const attackUnits = attackerUnitsBeforeAbilities.map(unit => ({ ...unit }));
  const appliedAbilities = { attack: new Set(), defense: new Set() };
  const appliedAbilityValues = { attack: {}, defense: {} };
  const abilityPhaseHasBattle = sumCounts(attackerUnitsBeforeAbilities) > 0 && sumCounts(defenseUnits) > 0;
  const markAttackAbility = (flag, values = []) => {
    const groupId = ABILITY_GROUP_BY_FLAG[flag];
    if (!abilityPhaseHasBattle || !groupId) return;
    appliedAbilities.attack.add(groupId);
    appliedAbilityValues.attack[groupId] = Array.isArray(values) ? values : [values];
  };
  const markDefenseAbility = (flag, values = []) => {
    const groupId = ABILITY_GROUP_BY_FLAG[flag];
    if (!abilityPhaseHasBattle || !groupId) return;
    appliedAbilities.defense.add(groupId);
    appliedAbilityValues.defense[groupId] = Array.isArray(values) ? values : [values];
  };
  const defenderBefore = new Map();
  const defenderUnitStats = defenseUnits.map(unit => ({ ...unit }));
  defenseUnits.forEach(unit => {
    defenderBefore.set(toUnitKey(unit.type), unit.count);
  });

  let preCombatAttackerLosses = new Map();
  let preCombatDefenderLosses = new Map();
  if (side !== 'cy' && waveIndex === 1 &&
      isAttackAbilityActive('ambush', side, waveIndex, 'preCombat') &&
      totalPlannedWallAttackers() > totalWallDefenders()) {
    preCombatDefenderLosses = applyPercentageKills(
      defenseUnits,
      () => true,
      0.07 * attackGeneralDebuffScale(side, waveIndex, { phase: 'preCombat' })
    );
    markAttackAbility('ambush', sumMapValues(preCombatDefenderLosses));
  }
  if (side !== 'cy' && isDefenseAbilityActive('ambush', side, waveIndex, 'preCombat')) {
    preCombatAttackerLosses = applyPercentageKills(
      attackUnits,
      () => true,
      0.07 * defenseGeneralDebuffScale(side, waveIndex, { phase: 'preCombat' })
    );
    markDefenseAbility('ambush', sumMapValues(preCombatAttackerLosses));
  }

  if (side !== 'cy' && waveIndex % 3 === 0) {
    if (isAttackAbilityActive('tailwhip', side, waveIndex, 'preCombat') &&
        totalPlannedWallAttackers() > totalWallDefenders()) {
      markAttackAbility('tailwhip', 2.5 * attackGeneralDebuffScale(side, waveIndex, { phase: 'preCombat' }));
      const tailwhipLosses = applyPercentageKills(
        defenseUnits,
        unit => unit.type2 === 'melee',
        0.025 * attackGeneralDebuffScale(side, waveIndex, { phase: 'preCombat' })
      );
      preCombatDefenderLosses = mergeLossMaps(preCombatDefenderLosses, tailwhipLosses);
    }
    if (isDefenseAbilityActive('tailwhip', side, waveIndex, 'preCombat')) {
      markDefenseAbility('tailwhip', 32 * defenseGeneralDebuffScale(side, waveIndex, { phase: 'preCombat' }));
      const tailwhipLosses = applyPercentageKills(
        attackUnits,
        unit => unit.type2 === 'melee',
        0.32 * defenseGeneralDebuffScale(side, waveIndex, { phase: 'preCombat' })
      );
      preCombatAttackerLosses = mergeLossMaps(preCombatAttackerLosses, tailwhipLosses);
    }
  }

  const hadCombat = sumCounts(attackUnits) > 0 && sumCounts(defenseUnits) > 0;

  const attackTotals = computeAttackTotals(attackUnits);
  const toolTotals = sumAttackToolEffects(wave?.tools || []);
  if (side !== 'cy' && waveIndex % 3 === 0 && isDefenseAbilityActive('toolFoulUp', side, waveIndex)) {
    markDefenseAbility('toolFoulUp', 30 * defenseWallAbilityScale(side, waveIndex));
    const toolEffectScale = 1 - 0.3 * defenseWallAbilityScale(side, waveIndex);
    Object.keys(toolTotals).forEach(key => {
      if (key !== 'shield') toolTotals[key] *= toolEffectScale;
    });
  }
  const attackBonus = computeAttackBonusesPercent(side, toolTotals, waveIndex);
  if (side !== 'cy' && isAttackAbilityActive('endlessPractice', side, waveIndex) && waveIndex) {
    markAttackAbility('endlessPractice', waveIndex * 4 * attackWallAbilityScale(side, waveIndex));
  }
  if (side !== 'cy' && isAttackAbilityActive('powerSurge', side, waveIndex) && waveIndex % 2 === 0) {
    markAttackAbility('powerSurge', 10 * attackWallAbilityScale(side, waveIndex));
  }
  if (side !== 'cy' && isAttackAbilityActive('calmBeforeTheStorm', side, waveIndex)) {
    markAttackAbility(
      'calmBeforeTheStorm',
      (waveIndex % 2 === 1 ? -50 : 60) * attackWallAbilityScale(side, waveIndex)
    );
  }
  attackBonus.rangedMult += attackStrengthBonusPercent / 100;
  attackBonus.meleeMult += attackStrengthBonusPercent / 100;

  const moatReduction = (commanderStats.moatReduction || 0) + Math.max(0, -toolTotals.moat);
  const wallReduction = (commanderStats.wallReduction || 0) + Math.max(0, -toolTotals.wall);
  const gateReduction = (commanderStats.gateReduction || 0) + Math.max(0, -toolTotals.gate);
  const reinforcedShieldScale = side !== 'cy' && waveIndex % 2 === 0 &&
    isDefenseAbilityActive('reinforcedArrows', side, waveIndex)
    ? 1 - 0.4 * defenseWallAbilityScale(side, waveIndex)
    : 1;
  if (reinforcedShieldScale !== 1 && Math.max(0, -toolTotals.shield) > 0) {
    markDefenseAbility('reinforcedArrows', 40 * defenseWallAbilityScale(side, waveIndex));
  }
  const shieldPercent = Math.max(0, -toolTotals.shield) * reinforcedShieldScale;

  const defenseToolScale = side !== 'cy' && waveIndex % 3 === 0 &&
    isAttackAbilityActive('toolFoulUp', side, waveIndex)
    ? 1 - 0.3 * attackWallAbilityScale(side, waveIndex)
    : 1;
  if (defenseToolScale !== 1) {
    markAttackAbility('toolFoulUp', 30 * attackWallAbilityScale(side, waveIndex));
  }
  const defenseBonuses = computeDefenseBonuses(side, defenseToolScale);
  const gateBonus = side === 'front' ? defenseBonuses.gate : 0;
  const defenseBonusMult = combineDefenseProtectionMultipliers(
    defenseBonuses.moat - moatReduction,
    defenseBonuses.wall - wallReduction,
    gateBonus - gateReduction
  );

  const defenseStrength = computeDefenseStrengthBonuses(side, waveIndex, defenseToolScale);
  if (side !== 'cy' && isDefenseAbilityActive('endlessPractice', side, waveIndex) && waveIndex) {
    markDefenseAbility('endlessPractice', waveIndex * 4 * defenseWallAbilityScale(side, waveIndex));
  }
  if (side !== 'cy' && isDefenseAbilityActive('powerSurge', side, waveIndex) && waveIndex % 2 === 0) {
    markDefenseAbility('powerSurge', 10 * defenseWallAbilityScale(side, waveIndex));
  }

  if (side !== 'cy' && waveIndex % 3 === 0) {
    if (isAttackAbilityActive('hordebreaker', side, waveIndex)) {
      const bonusPercent = Math.ceil(sumCounts(defenseUnits) / 100) * attackWallAbilityScale(side, waveIndex);
      markAttackAbility('hordebreaker', bonusPercent);
      attackBonus.rangedMult += bonusPercent / 100;
      attackBonus.meleeMult += bonusPercent / 100;
    }
    if (isDefenseAbilityActive('hordebreaker', side, waveIndex)) {
      const bonusPercent = Math.floor(sumCounts(attackUnits) / 100) * defenseWallAbilityScale(side, waveIndex);
      markDefenseAbility('hordebreaker', bonusPercent);
      defenseStrength.ranged += bonusPercent;
      defenseStrength.melee += bonusPercent;
    }
  }

  if (side !== 'cy' && waveIndex % 2 === 0) {
    const hasRangedAttackers = attackUnits.some(unit => unit.type2 === 'ranged' && unit.count > 0);
    if (hasRangedAttackers && isAttackAbilityActive('longbows', side, waveIndex)) {
      const scale = attackWallAbilityScale(side, waveIndex);
      const minimumPercent = 100 + 50 * scale;
      const bonusPercent = 15 * scale;
      attackBonus.rangedMult = Math.max(attackBonus.rangedMult, minimumPercent / 100)
        * (1 + bonusPercent / 100);
      markAttackAbility('longbows', [minimumPercent, bonusPercent]);
    }

    const hasRangedDefenders = defenseUnits.some(unit => unit.type2 === 'ranged' && unit.count > 0);
    if (hasRangedDefenders && isDefenseAbilityActive('longbows', side, waveIndex)) {
      const scale = defenseWallAbilityScale(side, waveIndex);
      const minimumPercent = 100 + 40 * scale;
      const bonusPercent = 14 * scale;
      const rangedAfterShields = Math.max(defenseStrength.ranged - shieldPercent, 0);
      const stabilizedRanged = Math.max(rangedAfterShields, minimumPercent)
        * (1 + bonusPercent / 100);
      defenseStrength.ranged = stabilizedRanged + shieldPercent;
      markDefenseAbility('longbows', [minimumPercent, bonusPercent]);
    }
  }

  const lastingWoundsActive = waveIndex >= 4 && waveIndex % 3 !== 0;
  if (isAttackAbilityActive('lastingWounds', side, waveIndex) && lastingWoundsActive) {
    markAttackAbility('lastingWounds', 25 * attackGeneralDebuffScale(side, waveIndex));
    defenseStrength.ranged -= 25 * attackGeneralDebuffScale(side, waveIndex, { ranged: true });
    defenseStrength.melee -= 25 * attackGeneralDebuffScale(side, waveIndex);
  }
  if (isDefenseAbilityActive('lastingWounds', side, waveIndex) && lastingWoundsActive) {
    markDefenseAbility('lastingWounds', 25 * defenseGeneralDebuffScale(side, waveIndex));
    attackBonus.rangedMult -= 0.25 * defenseGeneralDebuffScale(side, waveIndex, { ranged: true });
    attackBonus.meleeMult -= 0.25 * defenseGeneralDebuffScale(side, waveIndex);
  }

  if (waveIndex % 2 === 0) {
    if (isAttackAbilityActive('wingsWhirlwind', side, waveIndex)) {
      const value = 21 * attackWallAbilityScale(side, waveIndex);
      markAttackAbility('wingsWhirlwind', [value, value]);
      attackBonus.rangedMult += 0.21 * attackWallAbilityScale(side, waveIndex);
      defenseStrength.ranged -= 21 * attackGeneralDebuffScale(side, waveIndex, { ranged: true });
    }
    if (isDefenseAbilityActive('wingsWhirlwind', side, waveIndex)) {
      const value = 21 * defenseWallAbilityScale(side, waveIndex);
      markDefenseAbility('wingsWhirlwind', [value, value]);
      defenseStrength.ranged += 21 * defenseWallAbilityScale(side, waveIndex);
      attackBonus.rangedMult -= 0.21 * defenseGeneralDebuffScale(side, waveIndex, { ranged: true });
    }
  }

  if (side !== 'cy') {
    if (isAttackAbilityActive('wayOfPerfection', side, waveIndex) &&
        waveIndex > 1 &&
        matchesPreviousAttackWave(wave, previousWaveResult)) {
      const bonus = 0.5 * attackWallAbilityScale(side, waveIndex);
      markAttackAbility('wayOfPerfection', bonus * 100);
      attackBonus.rangedMult += bonus;
      attackBonus.meleeMult += bonus;
    }
    if (isDefenseAbilityActive('wayOfPerfection', side, waveIndex)) {
      const bonus = 50 * defenseWallAbilityScale(side, waveIndex);
      const defenseType = pureDefenseUnitType(defenseUnits);
      if (defenseType === 'ranged') {
        markDefenseAbility('wayOfPerfection', bonus);
        defenseStrength.ranged += bonus;
      }
      if (defenseType === 'melee') {
        markDefenseAbility('wayOfPerfection', bonus);
        defenseStrength.melee += bonus;
      }
    }
  }

  if (side !== 'cy' && waveIndex % 2 === 0) {
    if (isAttackAbilityActive('dragonscaleArmor', side, waveIndex)) {
      const scale = attackGeneralDebuffScale(side, waveIndex);
      markAttackAbility('dragonscaleArmor', [25 * scale, 50 * scale]);
      defenseStrength.melee -= 25 * attackGeneralDebuffScale(side, waveIndex);
      defenseStrength.ranged -= 50 * attackGeneralDebuffScale(side, waveIndex);
    }
    if (isDefenseAbilityActive('dragonscaleArmor', side, waveIndex)) {
      const scale = defenseGeneralDebuffScale(side, waveIndex);
      markDefenseAbility('dragonscaleArmor', [25 * scale, 50 * scale]);
      attackBonus.meleeMult -= 0.25 * defenseGeneralDebuffScale(side, waveIndex);
      attackBonus.rangedMult -= 0.5 * defenseGeneralDebuffScale(side, waveIndex);
    }
  }

  const defenseRangedPercent = Math.max(defenseStrength.ranged - shieldPercent, 0);
  const defenseMeleePercent = defenseStrength.melee;
  const defenseRangedMult = defenseRangedPercent / 100;
  let defenseMeleeMult = defenseMeleePercent / 100;

  const defenseTotals = computeDefenseTotals(defenseUnits);

  const defenseBaseRanged = defenseTotals.meleeRangedBase + defenseTotals.rangedRangedBase;
  const defenseBaseMelee = defenseTotals.meleeMeleeBase + defenseTotals.rangedMeleeBase;
  const attackBaseRanged = attackTotals.rangedBase;
  const attackBaseMelee = attackTotals.meleeBase;

  if (isAttackAbilityActive('wayOfTheSword', side, waveIndex) && side !== 'cy' && defenseBaseMelee > defenseBaseRanged) {
    markAttackAbility('wayOfTheSword', 100 * attackWallAbilityScale(side, waveIndex));
    attackBonus.meleeMult += attackWallAbilityScale(side, waveIndex);
  }
  if (isDefenseAbilityActive('wayOfTheSword', side, waveIndex) && side !== 'cy' && attackBaseMelee > attackBaseRanged) {
    markDefenseAbility('wayOfTheSword', 100 * defenseWallAbilityScale(side, waveIndex));
    defenseMeleeMult += defenseWallAbilityScale(side, waveIndex);
  }

  let totalAttackRanged = attackTotals.rangedBase * attackBonus.rangedMult * attackTotalMultiplier;
  let totalAttackMelee = attackTotals.meleeBase * attackBonus.meleeMult * attackTotalMultiplier;

  let totalDefenseRanged = (
    defenseTotals.meleeRangedBase * defenseMeleeMult +
    defenseTotals.rangedRangedBase * defenseRangedMult
  ) * defenseBonusMult;

  let totalDefenseMelee = (
    defenseTotals.meleeMeleeBase * defenseMeleeMult +
    defenseTotals.rangedMeleeBase * defenseRangedMult
  ) * defenseBonusMult;

  let heartAttackRangedBonus = 0;
  let heartAttackMeleeBonus = 0;
  let heartDefenseRangedBonus = 0;
  let heartDefenseMeleeBonus = 0;
  if (side !== 'cy' && waveIndex % 2 === 0 && previousWaveResult) {
    if (isAttackAbilityActive('heartOfAWarrior', side, waveIndex)) {
      const previousLossStrength = getPreviousAttackerLossStrength(previousWaveResult);
      const effectScale = attackWallAbilityScale(side, waveIndex);
      heartAttackRangedBonus = previousLossStrength.ranged * 0.4 * effectScale;
      heartAttackMeleeBonus = previousLossStrength.melee * 0.4 * effectScale;
      markAttackAbility('heartOfAWarrior', heartAttackRangedBonus + heartAttackMeleeBonus);
      totalAttackRanged += heartAttackRangedBonus;
      totalAttackMelee += heartAttackMeleeBonus;
    }
    if (isDefenseAbilityActive('heartOfAWarrior', side, waveIndex)) {
      const previousLossStrength = getPreviousDefenderLossStrength(previousWaveResult);
      const effectScale = defenseWallAbilityScale(side, waveIndex);
      heartDefenseRangedBonus = previousLossStrength.ranged * 0.62 * effectScale;
      heartDefenseMeleeBonus = previousLossStrength.melee * 0.62 * effectScale;
      markDefenseAbility('heartOfAWarrior', heartDefenseRangedBonus + heartDefenseMeleeBonus);
      totalDefenseRanged += heartDefenseRangedBonus;
      totalDefenseMelee += heartDefenseMeleeBonus;
    }
  }

  if (side === 'cy' && (attackGeneralAbilities.giantSlayer || defenseGeneralAbilities.giantSlayer)) {
    const attackRangedBeforeBonus = totalAttackRanged;
    const attackMeleeBeforeBonus = totalAttackMelee;
    const defenseRangedBeforeBonus = totalDefenseRanged;
    const defenseMeleeBeforeBonus = totalDefenseMelee;

    if (attackGeneralAbilities.giantSlayer) {
      const rangedBonus = Math.min(defenseRangedBeforeBonus, attackRangedBeforeBonus * 3) * 0.09;
      const meleeBonus = Math.min(defenseMeleeBeforeBonus, attackMeleeBeforeBonus * 3) * 0.09;
      markAttackAbility('giantSlayer', rangedBonus + meleeBonus);
      totalAttackRanged += rangedBonus;
      totalAttackMelee += meleeBonus;
    }
    if (defenseGeneralAbilities.giantSlayer) {
      const rangedBonus = Math.min(attackRangedBeforeBonus, defenseRangedBeforeBonus * 3) * 0.09;
      const meleeBonus = Math.min(attackMeleeBeforeBonus, defenseMeleeBeforeBonus * 3) * 0.09;
      markDefenseAbility('giantSlayer', rangedBonus + meleeBonus);
      totalDefenseRanged += rangedBonus;
      totalDefenseMelee += meleeBonus;
    }
  }

  if (defenseTotalMultiplier !== 1) {
    totalDefenseRanged *= defenseTotalMultiplier;
    totalDefenseMelee *= defenseTotalMultiplier;
  }

  let defenseRangedForAttackerCasualties = totalDefenseRanged;
  let defenseMeleeForAttackerCasualties = totalDefenseMelee;
  let attackRangedForDefenderCasualties = totalAttackRanged;
  let attackMeleeForDefenderCasualties = totalAttackMelee;

  if (side !== 'cy' && waveIndex % 3 === 0) {
    if (isAttackAbilityActive('toweringShield', side, waveIndex)) {
      const reduction = 14 * attackGeneralDebuffScale(side, waveIndex, { ranged: true });
      markAttackAbility('toweringShield', reduction);
      const reducedDefenseRangedMult = Math.max((defenseRangedPercent - reduction) / 100, 0);
      defenseRangedForAttackerCasualties = (
        defenseTotals.meleeRangedBase * defenseMeleeMult +
        defenseTotals.rangedRangedBase * reducedDefenseRangedMult
      ) * defenseBonusMult + heartDefenseRangedBonus;
      defenseMeleeForAttackerCasualties = (
        defenseTotals.meleeMeleeBase * defenseMeleeMult +
        defenseTotals.rangedMeleeBase * reducedDefenseRangedMult
      ) * defenseBonusMult + heartDefenseMeleeBonus;
    }
    if (isDefenseAbilityActive('toweringShield', side, waveIndex)) {
      const reduction = 0.14 * defenseGeneralDebuffScale(side, waveIndex, { ranged: true });
      markDefenseAbility('toweringShield', reduction * 100);
      const reducedAttackRangedMult = Math.max(attackBonus.rangedMult - reduction, 0);
      attackRangedForDefenderCasualties =
        attackTotals.rangedBase * reducedAttackRangedMult * attackTotalMultiplier +
        heartAttackRangedBonus;
    }
  }

  const finalTotalAttack = totalAttackRanged + totalAttackMelee;
  const finalTotalDefense = totalDefenseRanged + totalDefenseMelee;

  const attackerTotalCount = sumCounts(attackUnits);
  const defenderTotalCount = defenseTotals.rangedCount + defenseTotals.meleeCount;

  const hasAttackRanged = totalAttackRanged > 0;
  const hasAttackMelee = totalAttackMelee > 0;
  const attackTotalStrength = totalAttackRanged + totalAttackMelee;

  const attackRangedShare = attackTotalStrength > 0 ? totalAttackRanged / attackTotalStrength : 0;
  const attackMeleeShare = attackTotalStrength > 0 ? totalAttackMelee / attackTotalStrength : 0;

  const normalScaledDefenseRanged = hasAttackRanged
    ? totalDefenseRanged * (hasAttackMelee ? attackRangedShare : 1)
    : 0;
  const normalScaledDefenseMelee = hasAttackMelee
    ? totalDefenseMelee * (hasAttackRanged ? attackMeleeShare : 1)
    : 0;
  const scaledDefenseRanged = hasAttackRanged
    ? defenseRangedForAttackerCasualties * (hasAttackMelee ? attackRangedShare : 1)
    : 0;
  const scaledDefenseMelee = hasAttackMelee
    ? defenseMeleeForAttackerCasualties * (hasAttackRanged ? attackMeleeShare : 1)
    : 0;

  const rangedKillRatio = hasAttackRanged
    ? (totalAttackRanged > scaledDefenseRanged ? Math.pow(scaledDefenseRanged / totalAttackRanged, 1.5) : 1)
    : 0;
  const meleeKillRatio = hasAttackMelee
    ? (totalAttackMelee > scaledDefenseMelee ? Math.pow(scaledDefenseMelee / totalAttackMelee, 1.5) : 1)
    : 0;

  const attackRangedCount = attackUnits.reduce((acc, u) => acc + (u.type2 === 'ranged' ? u.count : 0), 0);
  const attackMeleeCount = attackUnits.reduce((acc, u) => acc + (u.type2 === 'melee' ? u.count : 0), 0);

  const defenderRangedCount = defenseTotals.rangedCount;
  const defenderMeleeCount = defenseTotals.meleeCount;

  const rangedLoss = Math.min(Math.ceil(attackRangedCount * rangedKillRatio), attackRangedCount);
  const meleeLoss = Math.min(Math.ceil(attackMeleeCount * meleeKillRatio), attackMeleeCount);

  const defenderAttackForRatio = hasAttackRanged && !hasAttackMelee
    ? attackRangedForDefenderCasualties
    : !hasAttackRanged && hasAttackMelee
      ? attackMeleeForDefenderCasualties
      : attackRangedForDefenderCasualties + attackMeleeForDefenderCasualties;
  const defenderDefenseForRatio = hasAttackRanged && !hasAttackMelee
    ? totalDefenseRanged
    : !hasAttackRanged && hasAttackMelee
      ? totalDefenseMelee
      : (normalScaledDefenseRanged + normalScaledDefenseMelee);
  const defendersKilledRatio = defenderAttackForRatio <= 0
    ? 0
    : defenderAttackForRatio < defenderDefenseForRatio
      ? Math.pow(defenderAttackForRatio / defenderDefenseForRatio, 1.5)
      : 1;

  const attackerTotalLoss = Math.min(rangedLoss + meleeLoss, attackerTotalCount);
  const defenderTotalLoss = attackerTotalCount <= 0
    ? 0
    : Math.min(Math.ceil(defenderTotalCount * defendersKilledRatio), defenderTotalCount);

  const defenderCountTotal = defenderRangedCount + defenderMeleeCount;
  const defenderRangedShare = defenderCountTotal > 0 ? defenderRangedCount / defenderCountTotal : 0;
  const defenderMeleeShare = defenderCountTotal > 0 ? defenderMeleeCount / defenderCountTotal : 0;
  let defenderRangedLoss = Math.round(defenderTotalLoss * defenderRangedShare);
  defenderRangedLoss = Math.min(defenderRangedLoss, defenderRangedCount);
  let defenderMeleeLoss = Math.min(defenderTotalLoss - defenderRangedLoss, defenderMeleeCount);
  const defenderMissing = defenderTotalLoss - (defenderRangedLoss + defenderMeleeLoss);
  if (defenderMissing > 0) {
    const rangedCapacity = defenderRangedCount - defenderRangedLoss;
    const extraRanged = Math.min(defenderMissing, Math.max(0, rangedCapacity));
    defenderRangedLoss += extraRanged;
    defenderMeleeLoss += Math.max(0, defenderMissing - extraRanged);
  }

  const combatAttackerLosses = new Map();
  const rangedLosses = distributeLossesByUnit(attackUnits.filter(u => u.type2 === 'ranged'), rangedLoss);
  const meleeLosses = distributeLossesByUnit(attackUnits.filter(u => u.type2 === 'melee'), meleeLoss);
  attackUnits.forEach(unit => {
    const key = toUnitKey(unit.type);
    combatAttackerLosses.set(key, (rangedLosses.get(key) || 0) + (meleeLosses.get(key) || 0));
  });

  const combatDefenderLosses = new Map();
  const rangedDefenderLosses = distributeLossesByUnit(defenseUnits.filter(u => u.type2 === 'ranged'), defenderRangedLoss);
  const meleeDefenderLosses = distributeLossesByUnit(defenseUnits.filter(u => u.type2 === 'melee'), defenderMeleeLoss);
  defenseUnits.forEach(unit => {
    const key = toUnitKey(unit.type);
    combatDefenderLosses.set(key, (rangedDefenderLosses.get(key) || 0) + (meleeDefenderLosses.get(key) || 0));
  });

  defenseUnits.forEach(unit => {
    const loss = combatDefenderLosses.get(toUnitKey(unit.type)) || 0;
    unit.count = Math.max(0, unit.count - loss);
  });

  const attackerLosses = mergeLossMaps(preCombatAttackerLosses, combatAttackerLosses);
  const defenderLosses = mergeLossMaps(preCombatDefenderLosses, combatDefenderLosses);

  const defenderRemaining = new Map();
  defenseUnits.forEach(unit => {
    defenderRemaining.set(toUnitKey(unit.type), unit.count);
  });

  if (side !== 'cy') {
    if (isAttackAbilityActive('ironWill', side, waveIndex)) markAttackAbility('ironWill', 20);
    if (isDefenseAbilityActive('ironWill', side, waveIndex)) markDefenseAbility('ironWill', 20);
    if (attackGeneralAbilities.ayala && waveIndex <= 2) {
      markAttackAbility('ayala', 'pre-combat and waves 1-2');
    }
    if (defenseGeneralAbilities.ayala && waveIndex <= 2) {
      markDefenseAbility('ayala', 'pre-combat and waves 1-2');
    }
  }

  return {
    sourceWave: wave,
    attackerUnits: attackerUnitsBeforeAbilities,
    defenderUnits: defenseUnits,
    defenderUnitStats,
    defenderBefore,
    attackerLosses,
    defenderLosses,
    attackerTotalLoss: sumMapValues(attackerLosses),
    defenderTotalLoss: sumMapValues(defenderLosses),
    hadCombat,
    defenderRemaining,
    appliedAbilities: {
      attack: [...appliedAbilities.attack].filter(Boolean),
      defense: [...appliedAbilities.defense].filter(Boolean)
    },
    appliedAbilityValues
  };
}

function simulateSide(side) {
  const results = { waves: [], totals: { attackerLosses: new Map(), defenderLosses: new Map() } };
  const defenseUnits = buildDefenseUnits(side);
  const waveList = waves[side] || [];

  const attackerSurvivors = new Map();
  let previousWaveResult = null;

  waveList.forEach((wave, index) => {
    const waveResult = computeWaveBattle(side, wave, defenseUnits, 1, index + 1, 1, 0, previousWaveResult);
    results.waves.push(waveResult);
    previousWaveResult = waveResult;

    waveResult.attackerUnits.forEach(unit => {
      const loss = waveResult.attackerLosses.get(toUnitKey(unit.type)) || 0;
      const survivors = Math.max(0, unit.count - loss);
      attackerSurvivors.set(
        toUnitKey(unit.type),
        (attackerSurvivors.get(toUnitKey(unit.type)) || 0) + survivors
      );
    });

    waveResult.attackerLosses.forEach((loss, type) => {
      results.totals.attackerLosses.set(type, (results.totals.attackerLosses.get(type) || 0) + loss);
    });
    waveResult.defenderLosses.forEach((loss, type) => {
      results.totals.defenderLosses.set(type, (results.totals.defenderLosses.get(type) || 0) + loss);
    });
  });

  const defenderSurvivors = new Map();
  defenseUnits.forEach(unit => {
    defenderSurvivors.set(toUnitKey(unit.type), unit.count);
  });

  return {
    ...results,
    attackerSurvivors,
    defenderSurvivors
  };
}

function mergeUnitMaps(...maps) {
  const merged = new Map();
  maps.forEach(map => {
    map.forEach((count, type) => {
      merged.set(type, (merged.get(type) || 0) + count);
    });
  });
  return merged;
}

function mergeLossMaps(...maps) {
  const merged = new Map();
  maps.forEach(map => {
    map?.forEach((count, type) => {
      merged.set(type, (merged.get(type) || 0) + count);
    });
  });
  return merged;
}

function mapToUnits(map, isDefense) {
  const unitMap = new Map((isDefense ? defense_units : units).map(u => [`${isDefense ? 'DefenseUnit' : 'Unit'}${u.id.replace(/\D/g, '')}`, u]));
  const result = [];
  map.forEach((count, type) => {
    if (count <= 0) return;
    const unit = unitMap.get(type);
    if (!unit) return;
    result.push({
      type,
      count,
      type2: unit.type2,
      rangedDefenseStrength: unit.rangedDefenseStrength || 0,
      meleeDefenseStrength: unit.meleeDefenseStrength || 0,
      rangedCombatStrength: unit.rangedCombatStrength || 0,
      meleeCombatStrength: unit.meleeCombatStrength || 0,
      strengthGroup: unit.strengthGroup
    });
  });
  return result;
}

function mapToSlots(map, prefix) {
  let i = 0;
  const slots = [];
  map.forEach((count, type) => {
    if (count <= 0) return;
    slots.push({
      id: `${prefix}-${i + 1}`,
      type,
      count
    });
    i += 1;
  });
  return slots;
}

function computeBattleResults(side) {
  if (side !== 'cy') {
    return simulateSide(side);
  }

  const wallSides = ['left', 'front', 'right'];
  const wallResults = wallSides.map(simulateSide);
  const enteredWallSides = wallResults.map(result =>
    sumMapValues(result.attackerSurvivors) > 0
  );
  const attackerWinsCount = enteredWallSides.filter(Boolean).length;

  if (attackerWinsCount === 0) {
    return {
      waves: [],
      totals: {
        attackerLosses: new Map(),
        defenderLosses: new Map()
      },
      attackerSurvivors: new Map(),
      defenderSurvivors: new Map(),
      combinedAttackers: new Map(),
      combinedDefenders: new Map(),
      attackerWinsCount,
      courtyardEntryMultiplier: 1
    };
  }
  const wallAttackerSurvivors = mergeUnitMaps(...wallResults.map(r => r.attackerSurvivors));
  const wallDefenderSurvivors = mergeUnitMaps(...wallResults.map(r => r.defenderSurvivors));

  const cyAttackersBase = buildAttackUnits(waves['CY']?.[0]?.slots || []);
  const cyDefendersBase = buildDefenseUnits('cy');

  const cyAttackersMap = new Map();
  cyAttackersBase.forEach(unit => cyAttackersMap.set(toUnitKey(unit.type), unit.count));
  const cyDefendersMap = new Map();
  cyDefendersBase.forEach(unit => cyDefendersMap.set(toUnitKey(unit.type), unit.count));

  const combinedAttackers = mergeUnitMaps(cyAttackersMap, wallAttackerSurvivors);
  const combinedDefenders = mergeUnitMaps(cyDefendersMap, wallDefenderSurvivors);

  const defenseUnits = mapToUnits(combinedDefenders, true);
  const attackUnitsForBattle = mapToUnits(combinedAttackers, false);
  const attackersEnteredCY = Array.from(combinedAttackers.values()).reduce((sum, count) => sum + count, 0) > 0;
  const courtyardBattleStarted = attackersEnteredCY && sumCounts(defenseUnits) > 0;

  let attackTotalMultiplier = getCourtyardEntryMultiplier(enteredWallSides);

  let attackStrengthBonusPercent = 0;
  let defenseStrengthBonusPercent = 0;
  const wallAttackLosses = wallResults.reduce((acc, result) => acc + sumMapValues(result.totals?.attackerLosses), 0);
  const wallDefenseLosses = wallResults.reduce((acc, result) => acc + sumMapValues(result.totals?.defenderLosses), 0);
  const attackVengeanceBonus = attackGeneralAbilities.vengeance
    ? Math.min(Math.floor(wallAttackLosses / 100) * 0.7, 30)
    : 0;
  const defenseVengeanceBonus = defenseGeneralAbilities.vengeance
    ? Math.min(Math.floor(wallDefenseLosses / 100) * 0.7, 30)
    : 0;
  const attackExaltedBonus = attackGeneralAbilities.exalted
    ? Math.min(wallDefenseLosses * 0.002, 15)
    : 0;
  const defenseExaltedBonus = defenseGeneralAbilities.exalted
    ? Math.min(Math.floor(wallAttackLosses / 100) * 0.25, 15)
    : 0;

  attackStrengthBonusPercent += attackVengeanceBonus + attackExaltedBonus;
  defenseStrengthBonusPercent += defenseVengeanceBonus + defenseExaltedBonus;
  const defenseTotalMultiplier = 1 + defenseStrengthBonusPercent / 100;

  const supportTotals = sumSupportToolEffects(waves['Support']?.[0]?.tools || []);
  const supportKills = new Map();
  const addSupportKills = (lossMap = new Map()) => {
    lossMap.forEach((loss, type) => {
      supportKills.set(type, (supportKills.get(type) || 0) + loss);
    });
  };
  if (courtyardBattleStarted && (supportTotals.killAnyTroopsYard || supportTotals.killMeleeTroopsYard || supportTotals.killRangedTroopsYard)) {
    if (supportTotals.killRangedTroopsYard > 0) {
      const losses = applyStrongestKills(
        defenseUnits.filter(unit => unit.type2 === 'ranged'),
        supportTotals.killRangedTroopsYard,
        unit => unit.rangedDefenseStrength
      );
      addSupportKills(losses);
    }

    if (supportTotals.killMeleeTroopsYard > 0) {
      const losses = applyStrongestKills(
        defenseUnits.filter(unit => unit.type2 === 'melee'),
        supportTotals.killMeleeTroopsYard,
        unit => unit.meleeDefenseStrength
      );
      addSupportKills(losses);
    }

    if (supportTotals.killAnyTroopsYard > 0) {
      const losses = applyStrongestKills(
        defenseUnits,
        supportTotals.killAnyTroopsYard,
        unit => Math.max(unit.rangedDefenseStrength || 0, unit.meleeDefenseStrength || 0)
      );
      addSupportKills(losses);
    }
  }

  const defenseCyKills = new Map();
  const addDefenseKills = (lossMap = new Map()) => {
    lossMap.forEach((loss, type) => {
      defenseCyKills.set(type, (defenseCyKills.get(type) || 0) + loss);
    });
  };
  if (courtyardBattleStarted) {
    const killTotals = {
      melee: 0,
      ranged: 0,
      any: 0
    };
    const cyTools = defenseSlots.cy?.cyTools || [];
    cyTools.forEach(tool => {
      if (!tool || tool.count <= 0) return;
      const toolId = tool.type?.replace('DefenseTool', '');
      const effectData = toolEffectsDefense?.[toolId];
      if (!effectData) return;

      const applyEffect = effect => {
        if (!effect?.name) return;
        const value = effect.value * tool.count;
        if (effect.name === 'KillMeleeTroopsYard') killTotals.melee += value;
        if (effect.name === 'KillRangedTroopsYard') killTotals.ranged += value;
        if (effect.name === 'KillAnyDefenseTroopsYard') killTotals.any += value;
      };

      applyEffect(effectData.effect1);
      applyEffect(effectData.effect2);
    });

    addDefenseKills(applyStrongestKills(
      attackUnitsForBattle.filter(unit => unit.type2 === 'ranged'),
      killTotals.ranged,
      unit => unit.rangedCombatStrength
    ));
    addDefenseKills(applyStrongestKills(
      attackUnitsForBattle.filter(unit => unit.type2 === 'melee'),
      killTotals.melee,
      unit => unit.meleeCombatStrength
    ));
    addDefenseKills(applyStrongestKills(
      attackUnitsForBattle,
      killTotals.any,
      unit => Math.max(unit.rangedCombatStrength || 0, unit.meleeCombatStrength || 0)
    ));
  }

  const attackersMapForBattle = mapFromUnits(attackUnitsForBattle);
  const syntheticWave = { slots: mapToSlots(attackersMapForBattle, 'cy-attack'), tools: [] };
  const waveResult = computeWaveBattle(
    'cy',
    syntheticWave,
    defenseUnits,
    attackTotalMultiplier,
    1,
    defenseTotalMultiplier,
    attackStrengthBonusPercent
  );
  if (attackVengeanceBonus > 0) {
    waveResult.appliedAbilities.attack.push(ABILITY_GROUP_BY_FLAG.vengeance);
    waveResult.appliedAbilityValues.attack[ABILITY_GROUP_BY_FLAG.vengeance] = [attackVengeanceBonus];
  }
  if (defenseVengeanceBonus > 0) {
    waveResult.appliedAbilities.defense.push(ABILITY_GROUP_BY_FLAG.vengeance);
    waveResult.appliedAbilityValues.defense[ABILITY_GROUP_BY_FLAG.vengeance] = [defenseVengeanceBonus];
  }
  if (attackExaltedBonus > 0) {
    waveResult.appliedAbilities.attack.push(ABILITY_GROUP_BY_FLAG.exalted);
    waveResult.appliedAbilityValues.attack[ABILITY_GROUP_BY_FLAG.exalted] = [attackExaltedBonus];
  }
  if (defenseExaltedBonus > 0) {
    waveResult.appliedAbilities.defense.push(ABILITY_GROUP_BY_FLAG.exalted);
    waveResult.appliedAbilityValues.defense[ABILITY_GROUP_BY_FLAG.exalted] = [defenseExaltedBonus];
  }

  return {
    waves: [waveResult],
    totals: {
      attackerLosses: mergeLossMaps(waveResult.attackerLosses, defenseCyKills),
      defenderLosses: mergeLossMaps(waveResult.defenderLosses, supportKills)
    },
    attackerSurvivors: new Map(),
    defenderSurvivors: new Map(),
    combinedAttackers,
    combinedDefenders,
    attackerWinsCount,
    courtyardEntryMultiplier: attackTotalMultiplier,
    courtyardBattleStarted,
    supportKills
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function slotsToCountMap(slots = []) {
  const counts = new Map();
  slots.forEach(slot => {
    if (!slot?.type || slot.count <= 0) return;
    counts.set(slot.type, (counts.get(slot.type) || 0) + slot.count);
  });
  return counts;
}

function aggregateTools(toolSlots = []) {
  const counts = new Map();
  toolSlots.forEach(tool => {
    if (!tool?.type || tool.count <= 0) return;
    const current = counts.get(tool.type) || { count: 0, consumedCount: 0 };
    current.count += tool.count;
    if (tool.consumed !== false) current.consumedCount += tool.count;
    counts.set(tool.type, current);
  });
  return [...counts].map(([type, values]) => ({ type, ...values }));
}

function defenseToolsForSide(side) {
  if (side === 'cy') return defenseSlots.cy?.cyTools || [];
  const slots = defenseSlots[side] || {};
  return [
    ...(slots.wallTools || []),
    ...(slots.gateTools || []),
    ...(slots.moatTools || [])
  ];
}

function toolDetails(type, owner, courtyardSupport = false) {
  const numericIndex = Math.max(0, Number(String(type).match(/\d+/)?.[0] || 1) - 1);
  if (courtyardSupport) {
    return {
      name: supportTools[numericIndex]?.name || type,
      image: supportToolImages[type] || supportTools[numericIndex]?.image
    };
  }
  if (owner === 'defense') {
    return {
      name: defense_tools[numericIndex]?.name || type,
      image: toolImagesDefense[type] || defense_tools[numericIndex]?.image
    };
  }
  return {
    name: tools[numericIndex]?.name || type,
    image: toolImages[type] || tools[numericIndex]?.image
  };
}

function renderToolSummaryHTML(toolSummary, owner, courtyardSupport = false) {
  if (!toolSummary.length) return '<div class="report-empty">No tools used</div>';
  return toolSummary.map(({ type, count, consumedCount }) => {
    const details = toolDetails(type, owner, courtyardSupport);
    return `
      <div class="report-item report-tool-item" title="${escapeHtml(details.name)}">
        <img src="${imageUrl(details.image)}" alt="${escapeHtml(details.name)}">
        <span class="report-item-values">
          <strong>${formatNumber(count)}</strong>
          <small>${consumedCount > 0 ? `-${formatNumber(consumedCount)}` : '-'}</small>
        </span>
      </div>
    `;
  }).join('');
}

function getAppliedAbilityIds(battleResults, owner, view) {
  const waveResults = view === 'summary'
    ? battleResults.waves || []
    : [battleResults.waves?.[Number(view.replace('wave-', '')) - 1]].filter(Boolean);
  const ids = new Set();
  waveResults.forEach(result => {
    (result?.appliedAbilities?.[owner] || []).forEach(groupId => ids.add(String(groupId)));
  });
  return ids;
}

function abilityReportData(owner, appliedIds) {
  const catalog = getGeneralAbilityCatalog();
  const loadout = getGeneralLoadout(owner);
  const abilities = Object.values(loadout.slots || {})
    .map(groupId => catalog.abilities[String(groupId)])
    .filter(ability => ability && appliedIds.has(ability.groupId));
  return abilities;
}

function toolCatalogEntry(type, owner, courtyardSupport = false) {
  const numericIndex = Math.max(0, Number(String(type).match(/\d+/)?.[0] || 1) - 1);
  if (courtyardSupport) return supportTools[numericIndex];
  return owner === 'defense' ? defense_tools[numericIndex] : tools[numericIndex];
}

function consumesWithoutCombat(tool, owner, courtyardSupport = false) {
  if (!tool?.type || tool.count <= 0) return false;
  const entry = toolCatalogEntry(tool.type, owner, courtyardSupport);
  if (Number(entry?.deleteToolAfterBattle) > 0) return true;
  return owner === 'defense' && String(entry?.wodID) === '450';
}

function toolsWithConsumption(toolSlots, owner, hadBattle, courtyardSupport = false) {
  return (toolSlots || []).map(tool => ({
    ...tool,
    consumed: hadBattle || consumesWithoutCombat(tool, owner, courtyardSupport)
  }));
}

function reportWaveResults(battleResults, side, view) {
  if (side === 'cy') return [battleResults.waves?.[0]].filter(Boolean);
  if (view === 'summary') return battleResults.waves || [];
  return [battleResults.waves?.[Number(view.replace('wave-', '')) - 1]].filter(Boolean);
}

function reportAbilityValues(battleResults, owner, side, view, groupId) {
  const result = reportWaveResults(battleResults, side, view)
    .find(waveResult => waveResult?.appliedAbilityValues?.[owner]?.[groupId]);
  return result?.appliedAbilityValues?.[owner]?.[groupId] || [];
}

function formatAbilityValue(value, groupId) {
  if (typeof value === 'string') return value;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return String(value ?? '');
  if (['1003', '1014', '1022'].includes(groupId)) {
    return Math.round(numericValue).toLocaleString();
  }
  return (Math.round(numericValue * 100) / 100).toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
}

function reportAbilityDescription(ability, owner, side, view, battleResults) {
  const keyPrefix = owner === 'attack' ? 'attack' : 'defense';
  const genericDescription = ability[`${keyPrefix}ShortDescription`] || '';
  if (view === 'summary' && side !== 'cy') return genericDescription;
  if (ability.groupId === '1021') return genericDescription;

  const template = ability[`${keyPrefix}ShortValueTemplate`] || genericDescription;
  const calculatedValues = reportAbilityValues(
    battleResults,
    owner,
    side,
    view,
    ability.groupId
  );
  const fallbackValues = ability[`${keyPrefix}EffectValues`] || [];
  return template.replace(/\{(\d+)\}/g, (token, index) => {
    const value = calculatedValues[Number(index)] ?? fallbackValues[Number(index)];
    return value == null ? token : formatAbilityValue(value, ability.groupId);
  });
}

function renderAbilitiesHTML(owner, appliedIds, side, view, battleResults) {
  const abilities = abilityReportData(owner, appliedIds);
  return `
    ${abilities.length
      ? abilities.map(ability => `
          <div class="report-ability-item">
            <img src="${escapeHtml(ability.icon)}" alt="">
            <span>
              <strong>${escapeHtml(ability.name)}</strong>
              <small>${escapeHtml(reportAbilityDescription(ability, owner, side, view, battleResults))}</small>
            </span>
          </div>
        `).join('')
      : '<div class="report-empty">No abilities were used</div>'}
  `;
}

function renderReportSection(title, content, className = '') {
  return `
    <section class="report-section ${className}">
      <h6>${title}</h6>
      <div class="report-item-grid">${content}</div>
    </section>
  `;
}

function renderReportColumn(
  owner,
  unitsSummary,
  toolSummary,
  appliedIds,
  side,
  view,
  battleResults,
  courtyardSupport = false
) {
  const imageMap = owner === 'attack' ? unitImages : unitImagesDefense;
  const unitContent = unitsSummary.length
    ? renderUnitSummaryHTML(unitsSummary, imageMap, owner === 'defense')
    : '<div class="report-empty">No units used</div>';
  return `
    <div class="report-detail-column report-detail-${owner}">
      ${renderReportSection('UNITS', unitContent, 'report-units-section')}
      ${renderReportSection('TOOLS', renderToolSummaryHTML(toolSummary, owner, courtyardSupport), 'report-tools-section')}
      ${renderReportSection(
        "GENERAL'S ABILITIES",
        renderAbilitiesHTML(owner, appliedIds, side, view, battleResults),
        'report-abilities-section'
      )}
    </div>
  `;
}

function reportUnits(side, battleResults, view) {
  if (view !== 'summary' && side !== 'cy') {
    const waveIndex = Number(view.replace('wave-', '')) - 1;
    const waveResult = battleResults.waves?.[waveIndex];
    if (!waveResult) return { attack: [], defense: [] };
    const attackCounts = mapFromUnits(waveResult.attackerUnits || []);
    return {
      attack: buildSummaryList(attackCounts, waveResult.attackerLosses || new Map()),
      defense: buildSummaryList(
        waveResult.defenderBefore || new Map(),
        waveResult.defenderLosses || new Map(),
        true
      )
    };
  }

  if (side === 'cy') {
    return {
      attack: buildSummaryList(
        battleResults.combinedAttackers || new Map(),
        battleResults.totals?.attackerLosses || new Map()
      ),
      defense: buildSummaryList(
        battleResults.combinedDefenders || new Map(),
        battleResults.totals?.defenderLosses || new Map()
      )
    };
  }

  const attackCounts = slotsToCountMap((waves[side] || []).flatMap(wave => wave.slots || []));
  const defenseCounts = slotsToCountMap(defenseSlots[side]?.units || []);
  return {
    attack: buildSummaryList(attackCounts, battleResults.totals?.attackerLosses || new Map()),
    defense: buildSummaryList(defenseCounts, battleResults.totals?.defenderLosses || new Map())
  };
}

function reportTools(side, view, battleResults) {
  if (side === 'cy') {
    const hadBattle = Boolean(battleResults.courtyardBattleStarted);
    return {
      attack: aggregateTools(toolsWithConsumption(waves.Support?.[0]?.tools || [], 'attack', hadBattle, true)),
      defense: aggregateTools(toolsWithConsumption(defenseToolsForSide(side), 'defense', hadBattle)),
      courtyardSupport: true
    };
  }
  const waveIndexes = view === 'summary'
    ? (waves[side] || []).map((_, index) => index)
    : [Number(view.replace('wave-', '')) - 1];
  const selectedAttackTools = waveIndexes.flatMap(index => toolsWithConsumption(
    waves[side]?.[index]?.tools || [],
    'attack',
    Boolean(battleResults.waves?.[index]?.hadCombat)
  ));
  const defenseHadBattle = waveIndexes.some(index => battleResults.waves?.[index]?.hadCombat);
  return {
    attack: aggregateTools(selectedAttackTools),
    defense: aggregateTools(toolsWithConsumption(defenseToolsForSide(side), 'defense', defenseHadBattle)),
    courtyardSupport: false
  };
}

function setReportViewOptions(side) {
  const select = document.getElementById('report-view-select');
  if (!select) return;
  const options = ['<option value="summary">Summary</option>'];
  if (side !== 'cy') {
    (waves[side] || []).forEach((wave, index) => {
      options.push(`<option value="wave-${index + 1}">Wave ${index + 1}</option>`);
    });
  }
  select.innerHTML = options.join('');
  if (![...select.options].some(option => option.value === currentReportView)) {
    currentReportView = 'summary';
  }
  select.value = currentReportView;
}

function totalLabel(summary) {
  const total = summary.reduce((sum, item) => sum + item.count, 0);
  const losses = summary.reduce((sum, item) => sum + item.loss, 0);
  return losses > 0
    ? `${formatNumber(total)} (-${formatNumber(losses)})`
    : formatNumber(total);
}

function populateBattleReportModal(side) {
  setReportViewOptions(side);
  const battleResults = computeBattleResults(side);
  const unitsByOwner = reportUnits(side, battleResults, currentReportView);
  const toolsByOwner = reportTools(side, currentReportView, battleResults);
  const attackAbilities = getAppliedAbilityIds(battleResults, 'attack', currentReportView);
  const defenseAbilities = getAppliedAbilityIds(battleResults, 'defense', currentReportView);
  const sideLabel = document.getElementById('report-side-label');
  const columns = document.getElementById('report-detail-columns');
  const context = document.getElementById('report-context-note');
  const attackerTotal = document.getElementById('report-attacker-total');
  const defenderTotal = document.getElementById('report-defender-total');

  if (sideLabel) sideLabel.textContent = SIDE_LABELS[side].toUpperCase();
  if (attackerTotal) attackerTotal.textContent = totalLabel(unitsByOwner.attack);
  if (defenderTotal) defenderTotal.textContent = totalLabel(unitsByOwner.defense);

  if (context) {
    if (side === 'cy') {
      const wins = battleResults.attackerWinsCount ?? 0;
      const multiplier = battleResults.courtyardEntryMultiplier ?? 1;
      context.textContent = wins === 0
        ? 'NO COURTYARD BATTLE'
        : `${multiplier === 1.3 ? '+30%' : multiplier === 0.7 ? '-30%' : '0%'} ATTACKER STRENGTH`;
      context.hidden = false;
    } else {
      context.textContent = '';
      context.hidden = true;
    }
  }

  if (columns) {
    columns.innerHTML = `
      ${renderReportColumn(
        'attack',
        unitsByOwner.attack,
        toolsByOwner.attack,
        attackAbilities,
        side,
        currentReportView,
        battleResults,
        toolsByOwner.courtyardSupport
      )}
      ${renderReportColumn(
        'defense',
        unitsByOwner.defense,
        toolsByOwner.defense,
        defenseAbilities,
        side,
        currentReportView,
        battleResults
      )}
    `;
  }
}

document.querySelectorAll('.flanks-button-report.sides')?.forEach(button => {
  button.addEventListener('click', () => switchReportSide(button.dataset.section));
});

document.getElementById('report-view-select')?.addEventListener('change', event => {
  currentReportView = event.target.value;
  const activeSide = document.querySelector('.flanks-button-report.active')?.dataset.section || currentSideReport;
  populateBattleReportModal(activeSide);
});
