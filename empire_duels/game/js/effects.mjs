export function getEffectById(effects, id) {
  return effects.find(e => e.id === id);
}

function getOwnerPhase(state, owner) {
  if (owner === "ai") return state.phase === "attack" ? "defense" : "attack";
  return state.phase;
}

function getCardPointsForEffect(state, card, owner) {
  if (card.card_type === "tool") return 0;
  const phase = getOwnerPhase(state, owner);
  if (phase === "attack") return Number(card.attack_points ?? 0);
  return Number(card.defense_points ?? 0);
}

function isSameSource(a, b) {
  if (!a || !b) return false;
  return (
    a.owner === b.owner &&
    a.laneKey === b.laneKey &&
    a.card?.id === b.card?.id &&
    a.effect?.id === b.effect?.id
  );
}

function getTopEnemyTroop(state, targetOwner, source) {
  const sources = getEffectSources(state);
  const lanes = ["ranged_1", "ranged_2", "melee_1", "melee_2"];
  let best = null;
  let bestScore = -Infinity;

  for (const laneKey of lanes) {
    const lane = state.rows[targetOwner]?.[laneKey];
    if (!lane) continue;
    for (const t of lane.troops) {
      if (!t) continue;
      const base = getCardPointsForEffect(state, t, targetOwner);
      let score = base + (t._bonus ?? 0);
      for (const src of sources) {
        if (isSameSource(src, source)) continue;
        if (src.effect?.kind === "board_enemy_top_card_flat") continue;
        score += getEffectDelta(src, t, targetOwner, laneKey, base, state);
      }
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
  }
  if (!best) return null;
  return { card: best, score: bestScore };
}

export function getEffectSources(state) {
  const sources = [];
  for (const owner of ["player", "ai"]) {
    const general = owner === "player" ? state.playerGeneral : state.aiGeneral;
    if (general && general.effect_id) {
      const eff = getEffectById(state.data.effects, general.effect_id);
      if (eff && eff.kind) {
        if ((!eff.trigger || eff.trigger === "constant") && (!eff.type || eff.type === getOwnerPhase(state, owner))) {
          sources.push({ owner, laneKey: null, card: general, effect: eff });
        }
      }
    }
    for (const laneKey of Object.keys(state.rows[owner])) {
      const lane = state.rows[owner][laneKey];
      for (const t of lane.troops) {
        if (!t || !t.effect_id) continue;
        const eff = getEffectById(state.data.effects, t.effect_id);
        if (!eff || !eff.kind) continue;
        if (eff.trigger && eff.trigger !== "constant") continue;
        if (eff.type && eff.type !== getOwnerPhase(state, owner)) continue;
        if (t.modeType && t.modeType !== "any" && t.modeType !== getOwnerPhase(state, owner)) continue;
        sources.push({ owner, laneKey, card: t, effect: eff });
      }
      const tool = lane.tool;
      if (tool && tool.effect_id) {
        const eff = getEffectById(state.data.effects, tool.effect_id);
        if (eff && eff.kind) {
          if (
            (!eff.trigger || eff.trigger === "constant") &&
            (!eff.type || eff.type === getOwnerPhase(state, owner)) &&
            (!tool.modeType || tool.modeType === "any" || tool.modeType === getOwnerPhase(state, owner))
          ) {
            sources.push({ owner, laneKey, card: tool, effect: eff });
          }
        }
      }
    }
  }
  return sources;
}

export function getEffectDelta(source, target, targetOwner, targetLaneKey, targetBase, state) {
  const eff = source.effect;
  const isAllied = source.owner === targetOwner;
  const sameLane = source.laneKey === targetLaneKey;
  let delta = 0;

  switch (eff.kind) {
    case "row_enemy_flat":
      if (sameLane && !isAllied) {
        delta = eff.effect_params?.amount ?? 0;
      }
      break;
    case "row_allied_tribe_bonus":
      if (sameLane && isAllied && target.tribe === eff.effect_params?.tribe && target.id !== source.card.id) {
        delta = eff.effect_params?.amount ?? 0;
      }
      break;
    case "board_allied_tribe_per_count":
      if (isAllied && target.tribe === eff.effect_params?.tribe) {
        const count = countTribe(state, targetOwner, eff.effect_params?.tribe);
        delta = count * (eff.effect_params?.amount ?? 0);
      }
      break;
    case "row_allied_points_leq":
      if (sameLane && isAllied && targetBase <= (eff.effect_params?.threshold ?? 0)) {
        delta = eff.effect_params?.amount ?? 0;
      }
      break;
    case "row_enemy_points_geq":
      if (sameLane && !isAllied && targetBase >= (eff.effect_params?.threshold ?? 0)) {
        delta = eff.effect_params?.amount ?? 0;
      }
      break;
    case "board_allied_card_mode":
      if (isAllied && target.card_type === "troop") {
        const mode = eff.effect_params?.mode;
        if (target.modeType !== "any" && target.modeType !== mode) break;
        const maxBase = eff.effect_params?.max_base;
        if (maxBase == null || targetBase <= maxBase) {
          delta = eff.effect_params?.amount ?? 0;
        }
      }
      break;
    case "board_enemy_top_card_flat":
      if (!isAllied && target.card_type === "troop") {
        const top = getTopEnemyTroop(state, targetOwner, source);
        if (top && top.card === target) {
          delta = eff.effect_params?.amount ?? 0;
        }
      }
      break;
    case "board_enemy_top_card_half":
      if (!isAllied && target.card_type === "troop") {
        const top = getTopEnemyTroop(state, targetOwner, source);
        if (top && top.card === target) {
          const reduction = Math.ceil(top.score / 2);
          delta = -reduction;
        }
      }
      break;
    case "row_allied_immunity_enemy_negative":
      delta = 0;
      break;
    default:
      delta = 0;
  }

  if (target.card_type === "tool" && delta !== 0) {
    return 0;
  }

  if (delta < 0 && source.owner !== targetOwner) {
    const cap = getRowImmunityCap(state, targetOwner, targetLaneKey);
    if (cap > 0) {
      return Math.min(0, delta + cap);
    }
  }

  return delta;
}

export function getCardDelta(card, owner, laneKey, state, getCardPoints) {
  const base = getCardPoints(card, owner);
  let delta = card._bonus ?? 0;
  const sources = getEffectSources(state);
  for (const src of sources) {
    delta += getEffectDelta(src, card, owner, laneKey, base, state);
  }
  return delta;
}

export function applyOnDeployEffects(card, owner, laneKey, state, getCardPoints) {
  if (!card?.effect_id) return;

  const eff = getEffectById(state.data.effects, card.effect_id);
  if (!eff) return;

  if (eff.trigger && eff.trigger !== "deploy") return;
  if (card.modeType && card.modeType !== "any" && card.modeType !== getOwnerPhase(state, owner)) {
    return;
  }
  const params = eff.effect_params || {};
  const amount = params.amount ?? 0;
  const addBonusSource = (target, bonusAmount) => {
    if (!bonusAmount) return;
    if (!target._bonus_sources) target._bonus_sources = [];
    target._bonus_sources.push({
      name: eff.name || "On deploy",
      amount: bonusAmount,
    });
  };

  if (eff.kind === "self_per_enemy_in_row_on_deploy") {
    const enemyOwner = owner === "player" ? "ai" : "player";
    const enemyLane = state.rows[enemyOwner][laneKey];
    const enemyCount = enemyLane?.troops?.filter(Boolean).length ?? 0;
    const bonus = enemyCount * amount;
    card._bonus = (card._bonus ?? 0) + bonus;
    addBonusSource(card, bonus);
    return;
  }

  if (eff.kind === "row_allied_points_leq") {
    const threshold = eff.effect_params?.threshold ?? 0;
    const lane = state.rows[owner][laneKey];

    for (const t of lane.troops) {
      if (!t) continue;
      if (t === card) continue;

      const base = getCardPoints(t, owner);
      if (base <= threshold) {
        t._bonus = (t._bonus ?? 0) + amount;
        addBonusSource(t, amount);
      }
    }
    return;
  }

  if (eff.kind === "row_enemy_flat") {
    const enemyOwner = owner === "player" ? "ai" : "player";
    const lane = state.rows[enemyOwner][laneKey];
    for (const t of lane.troops) {
      if (!t) continue;
      t._bonus = (t._bonus ?? 0) + amount;
      addBonusSource(t, amount);
    }
    return;
  }

  if (eff.kind === "row_enemy_points_geq") {
    const threshold = eff.effect_params?.threshold ?? 0;
    const enemyOwner = owner === "player" ? "ai" : "player";
    const lane = state.rows[enemyOwner][laneKey];
    for (const t of lane.troops) {
      if (!t) continue;
      const base = getCardPoints(t, enemyOwner);
      if (base >= threshold) {
        t._bonus = (t._bonus ?? 0) + amount;
        addBonusSource(t, amount);
      }
    }
    return;
  }

  if (eff.kind === "add_card_to_hand") {
    const hand = owner === "player" ? state.playerHand : state.aiHand;
    const { card_ids = [], amount: give = 1 } = eff.effect_params || {};

    if (!Array.isArray(card_ids) || card_ids.length === 0) return;

    for (let i = 0; i < give; i++) {
      const randomId = card_ids[Math.floor(Math.random() * card_ids.length)];
      const cardDef = state.data.cards.find(c => c.id === randomId);
      if (!cardDef) continue;

      hand.push({ ...cardDef });
    }
    return;
  }


}

export function countTribe(state, owner, tribe) {
  const troops = getAllTroops(state, owner);
  return troops.filter(t => t.tribe === tribe).length;
}

function getRowImmunityCap(state, targetOwner, targetLaneKey) {
  if (!targetLaneKey) return false;
  const lane = state.rows?.[targetOwner]?.[targetLaneKey];
  if (!lane) return false;

  const phase = getOwnerPhase(state, targetOwner);
  let cap = 0;

  const isActive = (card) => {
    if (!card || !card.effect_id) return false;
    const eff = getEffectById(state.data.effects, card.effect_id);
    if (!eff || eff.kind !== "row_allied_immunity_enemy_negative") return false;
    if (eff.trigger && eff.trigger !== "constant") return false;
    if (eff.type && eff.type !== phase) return false;
    if (card.modeType && card.modeType !== "any" && card.modeType !== phase) return false;
    cap = Math.max(cap, eff.effect_params?.cap ?? 1);
    return true;
  };

  for (const t of lane.troops) {
    isActive(t);
  }
  if (lane.tool) isActive(lane.tool);
  return cap;
}

export function getAllTroops(state, owner) {
  const lanes = Object.keys(state.rows[owner]);
  const troops = [];
  for (const laneKey of lanes) {
    const lane = state.rows[owner][laneKey];
    for (const t of lane.troops) {
      if (t) troops.push(t);
    }
  }
  return troops;
}
