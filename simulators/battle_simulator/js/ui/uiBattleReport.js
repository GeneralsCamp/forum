import {
  waves,
  defenseSlots,
  unitImages,
  unitImagesDefense,
  currentSideReport,
  units,
  defense_units,
  toolEffects,
  toolEffectsDefense,
  supportToolEffects,
  commanderStats,
  castellanStats,
  attackGeneralAbilities,
  defenseGeneralAbilities
} from '../data/variables.js';
import { initPresetSwipe } from './swipe.js';

const SIDE_KEYS = ['left', 'front', 'right', 'cy'];
let activeLogSide = null;

export function battleSimulation() {
  const battleReportModal = new bootstrap.Modal(document.getElementById('battleReportModal'));
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

  populateBattleReportModal(side);

  const activeButton = document.querySelector(`.flanks-button-report[data-section="${side}"]`);
  activeButton.classList.add('active');
}

function getSupportCombatBonus() {
  const supportWave = waves['Support']?.[0]?.tools || [];
  const hasTool3 = supportWave.some(tool => tool?.type === 'Tool3' && tool?.count > 0);
  return hasTool3 ? 5 : 0;
}

function toUnitKey(type) {
  return type || '';
}

function sumCounts(units = []) {
  return units.reduce((acc, unit) => acc + (unit.count || 0), 0);
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

function applyStrongestKills(units = [], killCount = 0, strengthGetter) {
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

    if (effectData.effect1?.name) {
      const name = effectData.effect1.name;
      const value = effectData.effect1.value * tool.count;
      if (name === 'Wall') totals.wall += value;
      if (name === 'Moat') totals.moat += value;
      if (name === 'Gate') totals.gate += value;
      if (name === 'Shield') totals.shield += value;
    }

    if (effectData.effect2?.name) {
      const name = effectData.effect2.name;
      const value = effectData.effect2.value * tool.count;
      if (name === 'RangedStrength') totals.rangedStrength += value;
      if (name === 'MeleeStrength') totals.meleeStrength += value;
    }
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
    const unitImage = imageMap[type] || (isDefense ? 'default-defense-icon.png' : 'default-attack-icon.png');
    return `
      <div class="unit-slot report-unit">
        <img src="../../../../img_base/battle_simulator/${unitImage}" class="unit-icon" alt="${type}">
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

  if (attackGeneralAbilities.waveStrengthBonus && waveIndex) {
    const waveBonus = waveIndex * 4;
    ranged += waveBonus;
    melee += waveBonus;
  }

  return {
    rangedMult: 1 + ranged / 100,
    meleeMult: 1 + melee / 100
  };
}

function computeDefenseBonuses(side) {
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
        const value = effect.value * tool.count;
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

function computeDefenseStrengthBonuses(side, waveIndex) {
  let ranged = 100 + (castellanStats.ranged || 0);
  let melee = 100 + (castellanStats.melee || 0);

  let combatStrengthBonus = 0;
  (defenseSlots.cy?.cyTools || []).forEach(tool => {
    if (!tool || tool.count <= 0) return;
    const toolId = tool.type?.replace('DefenseTool', '');
    const effectData = toolEffectsDefense?.[toolId];
    if (!effectData) return;
    if (effectData.effect2?.name === 'CombatStrength') {
      combatStrengthBonus += tool.count * effectData.effect2.value;
    }
  });

  ['wallTools', 'moatTools', 'gateTools'].forEach(slotType => {
    const tools = defenseSlots[side]?.[slotType] || [];
    tools.forEach(tool => {
      if (!tool || tool.count <= 0) return;
      const toolId = tool.type?.replace('DefenseTool', '');
      const effectData = toolEffectsDefense?.[toolId];
      if (!effectData) return;

      const applyEffect = effect => {
        if (!effect?.name) return;
        const value = effect.value * tool.count;
        if (effect.name === 'MeleeStrength') melee += value;
        if (effect.name === 'RangedStrength') ranged += value;
      };

      applyEffect(effectData.effect1);
      applyEffect(effectData.effect2);
    });
  });

  ranged += combatStrengthBonus;
  melee += combatStrengthBonus;

  if (defenseGeneralAbilities.waveStrengthBonus && waveIndex) {
    const waveBonus = waveIndex * 4;
    ranged += waveBonus;
    melee += waveBonus;
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
  const unitMap = new Map((units || []).map(u => [`Unit${u.id.slice(-1)}`, u]));
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

    if (unit.type === 'Unit1') ranged += unit.count * (commanderStats.meadStrength || 0);
    if (unit.type === 'Unit2') melee += unit.count * (commanderStats.meadStrength || 0);
    if (unit.type === 'Unit3' || unit.type === 'Unit5') ranged += unit.count * (commanderStats.horrorStrength || 0);
    if (unit.type === 'Unit4' || unit.type === 'Unit6') melee += unit.count * (commanderStats.horrorStrength || 0);

    rangedBase += ranged;
    meleeBase += melee;
  });

  return { rangedBase, meleeBase };
}

function computeWaveBattle(side, wave, defenseUnits, attackTotalMultiplier = 1, waveIndex = 1, defenseTotalMultiplier = 1) {
  const attackUnits = buildAttackUnits(wave?.slots || []);
  const attackTotals = computeAttackTotals(attackUnits);
  const toolTotals = sumAttackToolEffects(wave?.tools || []);
  const attackBonus = computeAttackBonusesPercent(side, toolTotals, waveIndex);

  const moatReduction = (commanderStats.moatReduction || 0) + Math.max(0, -toolTotals.moat);
  const wallReduction = (commanderStats.wallReduction || 0) + Math.max(0, -toolTotals.wall);
  const gateReduction = (commanderStats.gateReduction || 0) + Math.max(0, -toolTotals.gate);
  const shieldPercent = Math.max(0, -toolTotals.shield);

  const defenseBonuses = computeDefenseBonuses(side);
  const gateBonus = side === 'front' ? defenseBonuses.gate : 0;
  const defenseBonusMult = 1 + (
    Math.max(defenseBonuses.moat - moatReduction, 0) +
    Math.max(defenseBonuses.wall - wallReduction, 0) +
    Math.max(gateBonus - gateReduction, 0)
  ) / 100;

  const defenseStrength = computeDefenseStrengthBonuses(side, waveIndex);
  const defenseRangedPercent = Math.max(defenseStrength.ranged - shieldPercent, 0);
  const defenseMeleePercent = defenseStrength.melee;
  const defenseRangedMult = defenseRangedPercent / 100;
  let defenseMeleeMult = defenseMeleePercent / 100;

  const defenseTotals = computeDefenseTotals(defenseUnits);
  const defenderBefore = new Map();
  defenseUnits.forEach(unit => {
    defenderBefore.set(toUnitKey(unit.type), unit.count);
  });

  const defenseBaseRanged = defenseTotals.meleeRangedBase + defenseTotals.rangedRangedBase;
  const defenseBaseMelee = defenseTotals.meleeMeleeBase + defenseTotals.rangedMeleeBase;
  const attackBaseRanged = attackTotals.rangedBase;
  const attackBaseMelee = attackTotals.meleeBase;

  if (attackGeneralAbilities.conditionalMeleeBoost && side !== 'cy' && defenseBaseMelee > defenseBaseRanged) {
    attackBonus.meleeMult += 1;
  }
  if (defenseGeneralAbilities.conditionalMeleeBoost && side !== 'cy' && attackBaseMelee > attackBaseRanged) {
    defenseMeleeMult += 1;
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

  if (defenseTotalMultiplier !== 1) {
    totalDefenseRanged *= defenseTotalMultiplier;
    totalDefenseMelee *= defenseTotalMultiplier;
  }

  if (attackGeneralAbilities.periodicDebuff && waveIndex >= 4 && waveIndex % 3 !== 0) {
    totalDefenseRanged *= 0.75;
    totalDefenseMelee *= 0.75;
  }
  if (defenseGeneralAbilities.periodicDebuff && waveIndex >= 4 && waveIndex % 3 !== 0) {
    totalAttackRanged *= 0.75;
    totalAttackMelee *= 0.75;
  }

  if (attackGeneralAbilities.oddEvenStrengthSwing) {
    const swingMult = waveIndex % 2 === 1 ? 0.5 : 1.6;
    totalAttackRanged *= swingMult;
    totalAttackMelee *= swingMult;
  }

  if (attackGeneralAbilities.everySecondWaveStrength && waveIndex % 2 === 0) {
    totalAttackRanged *= 1.1;
    totalAttackMelee *= 1.1;
  }

  if (defenseGeneralAbilities.everySecondWaveStrength && waveIndex % 2 === 0) {
    totalDefenseRanged *= 1.1;
    totalDefenseMelee *= 1.1;
  }

  const totalAttack = totalAttackRanged + totalAttackMelee;
  let totalDefense = totalDefenseRanged + totalDefenseMelee;

  let baseAttackStrength = 0;
  let baseDefenseStrength = 0;
  let attackCourtyardStealBonus = 0;
  let defenseCourtyardStealBonus = 0;

  if (side === 'cy' && (attackGeneralAbilities.courtyardStealBonus || defenseGeneralAbilities.courtyardStealBonus)) {
    baseAttackStrength = attackTotals.rangedBase + attackTotals.meleeBase;
    baseDefenseStrength = defenseTotals.meleeRangedBase + defenseTotals.rangedRangedBase + defenseTotals.meleeMeleeBase + defenseTotals.rangedMeleeBase;

    if (attackGeneralAbilities.courtyardStealBonus) {
      attackCourtyardStealBonus = Math.min(totalDefense * 0.09, baseAttackStrength * 3);
      totalAttackRanged += attackCourtyardStealBonus * (baseAttackStrength > 0 ? totalAttackRanged / (totalAttackRanged + totalAttackMelee) : 0);
      totalAttackMelee += attackCourtyardStealBonus * (baseAttackStrength > 0 ? totalAttackMelee / (totalAttackRanged + totalAttackMelee) : 0);
    }
    if (defenseGeneralAbilities.courtyardStealBonus) {
      defenseCourtyardStealBonus = Math.min(totalAttack * 0.09, baseDefenseStrength * 3);
      totalDefense += defenseCourtyardStealBonus;
    }
  }

  const finalTotalAttack = totalAttackRanged + totalAttackMelee;
  const finalTotalDefense = totalDefense;

  const attackerTotalCount = sumCounts(attackUnits);
  const defenderTotalCount = defenseTotals.rangedCount + defenseTotals.meleeCount;

  const hasAttackRanged = totalAttackRanged > 0;
  const hasAttackMelee = totalAttackMelee > 0;
  const attackTotalStrength = totalAttackRanged + totalAttackMelee;

  const attackRangedShare = attackTotalStrength > 0 ? totalAttackRanged / attackTotalStrength : 0;
  const attackMeleeShare = attackTotalStrength > 0 ? totalAttackMelee / attackTotalStrength : 0;

  const scaledDefenseRanged = hasAttackRanged
    ? totalDefenseRanged * (hasAttackMelee ? attackRangedShare : 1)
    : 0;
  const scaledDefenseMelee = hasAttackMelee
    ? totalDefenseMelee * (hasAttackRanged ? attackMeleeShare : 1)
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
    ? totalAttackRanged
    : !hasAttackRanged && hasAttackMelee
      ? totalAttackMelee
      : attackTotalStrength;
  const defenderDefenseForRatio = hasAttackRanged && !hasAttackMelee
    ? totalDefenseRanged
    : !hasAttackRanged && hasAttackMelee
      ? totalDefenseMelee
      : (scaledDefenseRanged + scaledDefenseMelee);
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

  const attackerLosses = new Map();
  const rangedLosses = distributeLossesByUnit(attackUnits.filter(u => u.type2 === 'ranged'), rangedLoss);
  const meleeLosses = distributeLossesByUnit(attackUnits.filter(u => u.type2 === 'melee'), meleeLoss);
  attackUnits.forEach(unit => {
    const key = toUnitKey(unit.type);
    attackerLosses.set(key, (rangedLosses.get(key) || 0) + (meleeLosses.get(key) || 0));
  });

  const defenderLosses = new Map();
  const rangedDefenderLosses = distributeLossesByUnit(defenseUnits.filter(u => u.type2 === 'ranged'), defenderRangedLoss);
  const meleeDefenderLosses = distributeLossesByUnit(defenseUnits.filter(u => u.type2 === 'melee'), defenderMeleeLoss);
  defenseUnits.forEach(unit => {
    const key = toUnitKey(unit.type);
    defenderLosses.set(key, (rangedDefenderLosses.get(key) || 0) + (meleeDefenderLosses.get(key) || 0));
  });

  if (attackerTotalCount > 0 && side === activeLogSide) {
    const attackRangedCount = attackUnits.reduce((acc, u) => acc + (u.type2 === 'ranged' ? u.count : 0), 0);
    const attackMeleeCount = attackUnits.reduce((acc, u) => acc + (u.type2 === 'melee' ? u.count : 0), 0);
    const defenseRangedCount = defenseTotals.rangedCount;
    const defenseMeleeCount = defenseTotals.meleeCount;

    const attackRangedPerUnit = attackRangedCount > 0 ? attackTotals.rangedBase / attackRangedCount : 0;
    const attackMeleePerUnit = attackMeleeCount > 0 ? attackTotals.meleeBase / attackMeleeCount : 0;
    const defenseRangedPerUnit = defenseRangedCount > 0 ? defenseBaseRanged / defenseRangedCount : 0;
    const defenseMeleePerUnit = defenseMeleeCount > 0 ? defenseBaseMelee / defenseMeleeCount : 0;

    console.log(`[Battle Debug] ${side.toUpperCase()} Wave ${waveIndex}`);
    console.log(`Attack units (ranged): ${attackRangedCount}`);
    console.log(`Attack units (melee): ${attackMeleeCount}`);
    console.log(`Ranged base strength (per unit): ${attackRangedPerUnit}`);
    console.log(`Melee base strength (per unit): ${attackMeleePerUnit}`);
    console.log(`Ranged base strength (total): ${attackTotals.rangedBase}`);
    console.log(`Melee base strength (total): ${attackTotals.meleeBase}`);
    console.log(`Ranged strength bonus: ${Math.round((attackBonus.rangedMult - 1) * 100)}%`);
    console.log(`Melee strength bonus: ${Math.round((attackBonus.meleeMult - 1) * 100)}%`);
    console.log(`Ranged total strength: ${totalAttackRanged}`);
    console.log(`Melee total strength: ${totalAttackMelee}`);
    const attackerKilledPercent = attackerTotalCount > 0 ? (attackerTotalLoss / attackerTotalCount) * 100 : 0;
    const defenderKilledPercent = defenderTotalCount > 0 ? (defenderTotalLoss / defenderTotalCount) * 100 : 0;
    console.log(`How many attackers killed: ${attackerKilledPercent.toFixed(2)}%`);
    console.log(`Moat reduction: ${moatReduction}`);
    console.log(`Wall reduction: ${wallReduction}`);
    console.log(`Gate reduction: ${gateReduction}`);
    console.log(`Shields: ${shieldPercent}%`);
    console.log(`Defense units (ranged): ${defenseRangedCount}`);
    console.log(`Defense units (melee): ${defenseMeleeCount}`);
    console.log(`Ranged base strength (def, per unit): ${defenseRangedPerUnit}`);
    console.log(`Melee base strength (def, per unit): ${defenseMeleePerUnit}`);
    console.log(`Ranged base strength (def, total): ${defenseBaseRanged}`);
    console.log(`Melee base strength (def, total): ${defenseBaseMelee}`);
    console.log(`Ranged strength before shield: ${defenseStrength.ranged}%`);
    console.log(`Ranged strength bonus: ${defenseRangedPercent}%`);
    console.log(`Melee strength bonus: ${defenseStrength.melee}%`);
    console.log(`Melee total ranged strength: ${defenseTotals.meleeRangedBase * defenseMeleeMult * defenseBonusMult}`);
    console.log(`Ranged total ranged strength: ${defenseTotals.rangedRangedBase * defenseRangedMult * defenseBonusMult}`);
    console.log(`Melee total melee strength: ${defenseTotals.meleeMeleeBase * defenseMeleeMult * defenseBonusMult}`);
    console.log(`Ranged total melee strength: ${defenseTotals.rangedMeleeBase * defenseRangedMult * defenseBonusMult}`);
    console.log(`How many defenders killed: ${defenderKilledPercent.toFixed(2)}%`);
    console.log(`Moat bonus: ${defenseBonuses.moat}`);
    console.log(`Wall bonus: ${defenseBonuses.wall}`);
    console.log(`Gate bonus: ${gateBonus}`);
    console.log(`Defense bonus: ${Math.round((defenseBonusMult - 1) * 100)}%`);

    console.log(`[Abilities] Attack wave strength: ${attackGeneralAbilities.waveStrengthBonus ? `+${waveIndex * 4}%` : 'off'}`);
    console.log(`[Abilities] Defense wave strength: ${defenseGeneralAbilities.waveStrengthBonus ? `+${waveIndex * 4}%` : 'off'}`);
    console.log(`[Abilities] Attack periodic debuff: ${attackGeneralAbilities.periodicDebuff && waveIndex >= 4 && waveIndex % 3 !== 0 ? '-25% defense (active)' : 'off'}`);
    console.log(`[Abilities] Defense periodic debuff: ${defenseGeneralAbilities.periodicDebuff && waveIndex >= 4 && waveIndex % 3 !== 0 ? '-25% attack (active)' : 'off'}`);
    console.log(`[Abilities] Attack conditional melee: ${attackGeneralAbilities.conditionalMeleeBoost && side !== 'cy' && defenseBaseMelee > defenseBaseRanged ? '+100% melee (active)' : 'off'}`);
    console.log(`[Abilities] Defense conditional melee: ${defenseGeneralAbilities.conditionalMeleeBoost && side !== 'cy' && attackBaseMelee > attackBaseRanged ? '+100% melee (active)' : 'off'}`);
    console.log(`[Abilities] Attack odd/even swing: ${attackGeneralAbilities.oddEvenStrengthSwing ? (waveIndex % 2 === 1 ? '-50% (odd wave)' : '+60% (even wave)') : 'off'}`);
    console.log(`[Abilities] Attack every 2nd wave: ${attackGeneralAbilities.everySecondWaveStrength && waveIndex % 2 === 0 ? '+10% (active)' : 'off'}`);
    console.log(`[Abilities] Defense every 2nd wave: ${defenseGeneralAbilities.everySecondWaveStrength && waveIndex % 2 === 0 ? '+10% (active)' : 'off'}`);

    if (side === 'cy') {
      const attackTotalPercent = Math.round((attackTotalMultiplier - 1) * 100);
      const defenseTotalPercent = Math.round((defenseTotalMultiplier - 1) * 100);
      if (attackTotalPercent !== 0) console.log(`[Abilities] Courtyard attack total: ${attackTotalPercent > 0 ? '+' : ''}${attackTotalPercent}%`);
      if (defenseTotalPercent !== 0) console.log(`[Abilities] Courtyard defense total: ${defenseTotalPercent > 0 ? '+' : ''}${defenseTotalPercent}%`);
      if (attackGeneralAbilities.courtyardStealBonus) {
        const pct = baseAttackStrength > 0 ? (attackCourtyardStealBonus / baseAttackStrength) * 100 : 0;
        console.log(`[Abilities] Courtyard steal (attack): +${attackCourtyardStealBonus.toFixed(2)} (${pct.toFixed(2)}%)`);
      }
      if (defenseGeneralAbilities.courtyardStealBonus) {
        const pct = baseDefenseStrength > 0 ? (defenseCourtyardStealBonus / baseDefenseStrength) * 100 : 0;
        console.log(`[Abilities] Courtyard steal (defense): +${defenseCourtyardStealBonus.toFixed(2)} (${pct.toFixed(2)}%)`);
      }
    }

    console.log('');
  }

  defenseUnits.forEach(unit => {
    const loss = defenderLosses.get(toUnitKey(unit.type)) || 0;
    unit.count = Math.max(0, unit.count - loss);
  });

  const defenderRemaining = new Map();
  defenseUnits.forEach(unit => {
    defenderRemaining.set(toUnitKey(unit.type), unit.count);
  });

  return {
    attackerUnits: attackUnits,
    defenderUnits: defenseUnits,
    defenderBefore,
    attackerLosses,
    defenderLosses,
    attackerTotalLoss,
    defenderTotalLoss,
    defenderRemaining
  };
}

function simulateSide(side) {
  const results = { waves: [], totals: { attackerLosses: new Map(), defenderLosses: new Map() } };
  const defenseUnits = buildDefenseUnits(side);
  const waveList = waves[side] || [];

  const attackerSurvivors = new Map();

  waveList.forEach((wave, index) => {
    const waveResult = computeWaveBattle(side, wave, defenseUnits, 1, index + 1);
    results.waves.push(waveResult);

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
  const unitMap = new Map((isDefense ? defense_units : units).map(u => [`${isDefense ? 'DefenseUnit' : 'Unit'}${u.id.slice(-1)}`, u]));
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
      meleeCombatStrength: unit.meleeCombatStrength || 0
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
  const attackerWinsCount = wallResults.reduce((acc, result, index) => {
    const sideKey = wallSides[index];
    const attackersSent = (waves[sideKey] || [])
      .flatMap(wave => wave.slots || [])
      .reduce((sum, slot) => sum + (slot?.count || 0), 0);
    const defendersLeft = Array.from(result.defenderSurvivors.values()).reduce((a, v) => a + v, 0);
    const attackersWon = attackersSent > 0 && defendersLeft === 0;
    return acc + (attackersWon ? 1 : 0);
  }, 0);

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
      attackerWinsCount
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

  let attackTotalMultiplier = 1;
  if (attackerWinsCount === 3) attackTotalMultiplier = 1.3;
  else if (attackerWinsCount === 1) attackTotalMultiplier = 0.7;

  let defenseTotalMultiplier = 1;
  if (attackGeneralAbilities.courtyardLossBonus || defenseGeneralAbilities.courtyardLossBonus) {
    const wallAttackLosses = wallResults.reduce((acc, result) => acc + sumMapValues(result.totals?.attackerLosses), 0);
    const wallDefenseLosses = wallResults.reduce((acc, result) => acc + sumMapValues(result.totals?.defenderLosses), 0);

    if (attackGeneralAbilities.courtyardLossBonus) {
      const bonusPercent = Math.min(Math.floor(wallAttackLosses / 100) * 0.7, 30);
      attackTotalMultiplier *= 1 + bonusPercent / 100;
    }
    if (defenseGeneralAbilities.courtyardLossBonus) {
      const bonusPercent = Math.min(Math.floor(wallDefenseLosses / 100) * 0.7, 30);
      defenseTotalMultiplier *= 1 + bonusPercent / 100;
    }
  }

  const supportTotals = sumSupportToolEffects(waves['Support']?.[0]?.tools || []);
  const supportKills = new Map();
  const addSupportKills = (lossMap = new Map()) => {
    lossMap.forEach((loss, type) => {
      supportKills.set(type, (supportKills.get(type) || 0) + loss);
    });
  };
  if (attackersEnteredCY && (supportTotals.killAnyTroopsYard || supportTotals.killMeleeTroopsYard || supportTotals.killRangedTroopsYard)) {
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
  if (attackersEnteredCY) {
    const cyTools = defenseSlots.cy?.cyTools || [];
    cyTools.forEach(tool => {
      if (!tool || tool.count <= 0) return;
      const toolId = tool.type?.replace('DefenseTool', '');
      const effectData = toolEffectsDefense?.[toolId];
      if (!effectData) return;

      const applyEffect = effect => {
        if (!effect?.name) return;
        const value = effect.value * tool.count;
        if (effect.name === 'KillMeleeTroopsYard') {
          const losses = applyStrongestKills(
            attackUnitsForBattle.filter(unit => unit.type2 === 'melee'),
            value,
            unit => unit.meleeCombatStrength
          );
          addDefenseKills(losses);
        }
        if (effect.name === 'KillRangedTroopsYard') {
          const losses = applyStrongestKills(
            attackUnitsForBattle.filter(unit => unit.type2 === 'ranged'),
            value,
            unit => unit.rangedCombatStrength
          );
          addDefenseKills(losses);
        }
        if (effect.name === 'KillAnyDefenseTroopsYard') {
          const losses = applyStrongestKills(
            attackUnitsForBattle,
            value,
            unit => Math.max(unit.rangedCombatStrength || 0, unit.meleeCombatStrength || 0)
          );
          addDefenseKills(losses);
        }
      };

      applyEffect(effectData.effect1);
      applyEffect(effectData.effect2);
    });
  }

  const attackersMapForBattle = mapFromUnits(attackUnitsForBattle);
  const syntheticWave = { slots: mapToSlots(attackersMapForBattle, 'cy-attack'), tools: [] };
  const waveResult = computeWaveBattle('cy', syntheticWave, defenseUnits, attackTotalMultiplier, 1, defenseTotalMultiplier);

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
    supportKills
  };
}

function populateBattleReportModal(side) {
  activeLogSide = side;
  const attackerContainer = document.querySelector('.report-attackers .row');
  attackerContainer.innerHTML = '';

  const defenderContainer = document.querySelector('.report-defenders .row');
  defenderContainer.innerHTML = '';

  const waveSummaryContainer = document.getElementById('wave-summary-container');
  waveSummaryContainer.innerHTML = '';

  let totalAttackers = 0;
  let totalDefenders = 0;

  ['front', 'left', 'right'].forEach(sideKey => {
    if (waves[sideKey]) {
      waves[sideKey].forEach(wave => {
        wave.slots.forEach(slot => {
          if (slot && slot.count > 0) totalAttackers += slot.count;
        });
      });
    }
  });

  if (waves['CY']) {
    waves['CY'][0].slots.forEach(slot => {
      if (slot && slot.count > 0) totalAttackers += slot.count;
    });
  }

  ['front', 'left', 'right', 'cy'].forEach(sideKey => {
    if (defenseSlots[sideKey]?.units) {
      defenseSlots[sideKey].units.forEach(unit => {
        if (unit && unit.count > 0) totalDefenders += unit.count;
      });
    }
  });

  const attackerCountElement = document.querySelector('.report-troops-sum .col-6:nth-child(1)');
  const defenderCountElement = document.querySelector('.report-troops-sum .col-6:nth-child(2)');

  if (attackerCountElement) attackerCountElement.textContent = `${formatNumber(totalAttackers)}`;
  if (defenderCountElement) defenderCountElement.textContent = `${formatNumber(totalDefenders)}`;

  const battleResults = computeBattleResults(side);

  const attackerCounts = new Map();
  const defenderCounts = new Map();

  if (side === 'cy') {
    (battleResults.combinedAttackers || new Map()).forEach((count, type) => attackerCounts.set(type, count));
    (battleResults.combinedDefenders || new Map()).forEach((count, type) => defenderCounts.set(type, count));
  } else {
    (waves[side] || []).flatMap(wave => wave.slots || []).forEach(slot => {
      if (!slot || slot.count <= 0 || !slot.type) return;
      attackerCounts.set(slot.type, (attackerCounts.get(slot.type) || 0) + slot.count);
    });
    (defenseSlots[side]?.units || []).forEach(slot => {
      if (!slot || slot.count <= 0 || !slot.type) return;
      defenderCounts.set(slot.type, (defenderCounts.get(slot.type) || 0) + slot.count);
    });
  }

  const attackerSummaryList = buildSummaryList(attackerCounts, battleResults.totals?.attackerLosses || new Map());
  const defenderSummaryList = buildSummaryList(defenderCounts, battleResults.totals?.defenderLosses || new Map());

  attackerContainer.insertAdjacentHTML('beforeend', renderUnitSummaryHTML(attackerSummaryList, unitImages, false));
  defenderContainer.insertAdjacentHTML('beforeend', renderUnitSummaryHTML(defenderSummaryList, unitImagesDefense, true));

  const totalAttackerCount = attackerSummaryList.reduce((acc, item) => acc + item.count, 0);
  const totalAttackerLoss = attackerSummaryList.reduce((acc, item) => acc + item.loss, 0);
  const totalDefenderCount = defenderSummaryList.reduce((acc, item) => acc + item.count, 0);
  const totalDefenderLoss = defenderSummaryList.reduce((acc, item) => acc + item.loss, 0);

  if (attackerCountElement) {
    attackerCountElement.textContent = totalAttackerLoss > 0
      ? `${formatNumber(totalAttackerCount)} (-${formatNumber(totalAttackerLoss)})`
      : `${formatNumber(totalAttackerCount)}`;
  }
  if (defenderCountElement) {
    defenderCountElement.textContent = totalDefenderLoss > 0
      ? `${formatNumber(totalDefenderCount)} (-${formatNumber(totalDefenderLoss)})`
      : `${formatNumber(totalDefenderCount)}`;
  }

  if (side === 'cy') {
    const wins = battleResults.attackerWinsCount ?? 0;
    const bonusLabel = wins === 3
      ? '+30% courtyard attacker strength'
      : wins === 2
        ? '0% courtyard attacker strength'
        : wins === 1
          ? '-30% courtyard attacker strength'
          : 'No courtyard battle';
    const bonusRow = `
      <div class="player-flank text-center">
        <span>${bonusLabel}</span>
      </div>
    `;
    waveSummaryContainer.insertAdjacentHTML('beforeend', bonusRow);
    return;
  }

  const waveList = waves[side] || [];
  if (waveList.length === 0) return;

  waveList.forEach((wave, index) => {
    const waveResult = battleResults.waves[index];
    const hasUnits = wave.slots.some(slot => slot.count > 0);
    if (hasUnits) {
      const slotLosses = waveResult ? distributeLossesAcrossSlots(wave.slots, waveResult.attackerLosses) : new Map();
      const defenderSummaryList = waveResult
        ? buildSummaryList(waveResult.defenderBefore || new Map(), waveResult.defenderLosses || new Map(), true)
        : [];
      const waveHTML = `
        <div class="player-flank text-center">
          <span>WAVE ${index + 1}</span>
        </div>
        <div class="card-body margin-bug-fix report-wave">
          <div class="row">
            <div class="col bugfix report-attackers" style="border-right: 1px solid rgb(180, 140, 100);">
              <div class="row">
                ${wave.slots
                  .map(slot => {
                    if (slot && slot.count > 0) {
                      const unitImage = unitImages[slot.type] || 'default-attack-icon.png';
                      const loss = slotLosses.get(slot.id) || 0;
                      return `
                        <div class="unit-slot report-unit">
                          <img src="../../../../img_base/battle_simulator/${unitImage}" class="unit-icon" alt="${slot.type}">
                          <div class="unit-info">
                            <div class="unit-count">${formatNumber(slot.count)}</div>
                            ${loss > 0 ? `<div class="unit-loss">-${formatNumber(loss)}</div>` : `<div class="unit-loss">-</div>`}
                          </div>
                        </div>
                      `;
                    }
                    return '';
                  })
                  .join('')}
              </div>
            </div>
            <div class="col bugfix report-defenders">
              <div class="row">
                ${renderUnitSummaryHTML(defenderSummaryList, unitImagesDefense, true)}
              </div>
            </div>
          </div>
        </div>
      `;
      waveSummaryContainer.insertAdjacentHTML('beforeend', waveHTML);
    }
  });
}

document.querySelectorAll('.flanks-button-report.sides')?.forEach(button => {
  button.addEventListener('click', () => switchReportSide(button.dataset.section));
});
