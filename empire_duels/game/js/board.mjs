import {
  getEffectById,
  getEffectSources,
  getEffectDelta,
  getCardDelta,
  applyOnDeployEffects,
} from "./effects.mjs";

export function laneKeyToMeta(laneKey) {
  const slot_type = laneKey.startsWith("ranged") ? "ranged" : "melee";
  return { slot_type };
}

function isHerdCard(card) {
  return Boolean(card && card.is_herd);
}

function getOtherMeleeLaneKey(laneKey) {
  if (!laneKey.startsWith("melee_")) return null;
  return laneKey === "melee_1" ? "melee_2" : "melee_1";
}

export function getOwnerPhase(state, owner) {
  if (owner === "ai") return state.phase === "attack" ? "defense" : "attack";
  return state.phase;
}

export function getCardPoints(state, card, owner) {
  if (card.card_type === "tool") return 0;
  const phase = getOwnerPhase(state, owner);
  if (phase === "attack") return Number(card.attack_points ?? 0);
  return Number(card.defense_points ?? 0);
}

export function getCardDisplayDelta(state, card, owner, laneKey) {
  let delta = getCardDelta(card, owner, laneKey, state, (c, o) => getCardPoints(state, c, o));
  const lane = state.rows[owner]?.[laneKey];
  if (!lane || !lane.tool) return delta;
  const toolEffect = getEffectById(state.data.effects, lane.tool.effect_id);
  if (!toolEffect) return delta;
  if (toolEffect.kind === "lane_bonus_per_unit") {
    delta += toolEffect.effect_params?.amount ?? 0;
  }
  if (toolEffect.kind === "lane_bonus_flat") {
    delta += toolEffect.effect_params?.amount ?? 0;
  }
  return delta;
}

export function calcLaneScore(state, owner, laneKey) {
  const lane = state.rows[owner][laneKey];
  let sum = 0;
  const sources = getEffectSources(state);

  for (const t of lane.troops) {
    if (!t) continue;

    const base = getCardPoints(state, t, owner);
    let cardScore = base + (t._bonus ?? 0);

    for (const src of sources) {
      cardScore += getEffectDelta(src, t, owner, laneKey, base, state);
    }

    cardScore = Math.max(0, cardScore);

    sum += cardScore;
  }

  if (lane.tool) {
    const toolEffect = getEffectById(state.data.effects, lane.tool.effect_id);
    if (toolEffect) {
      if (toolEffect.kind === "lane_bonus_per_unit") {
        const count = lane.troops.filter(Boolean).length;
        sum += count * (toolEffect.effect_params?.amount ?? 0);
      }
      if (toolEffect.kind === "lane_bonus_flat") {
        sum += toolEffect.effect_params?.amount ?? 0;
      }
    }
  }

  return sum;
}

export function calcTotalScore(state, owner) {
  const lanes = ["ranged_1", "ranged_2", "melee_1", "melee_2"];
  return lanes.reduce((acc, laneKey) => acc + calcLaneScore(state, owner, laneKey), 0);
}

export function canPlayCardToLane(state, card, owner, laneKey) {
  const { slot_type } = laneKeyToMeta(laneKey);
  if (card.slot_type !== slot_type && card.slot_type !== "any") return false;
  if (owner !== state.currentPlayer) return false;
  const ownerPhase = getOwnerPhase(state, owner);
  if (card.card_type === "tool" && card.modeType && card.modeType !== "any" && card.modeType !== ownerPhase) {
    return false;
  }

  const lane = state.rows[owner][laneKey];
  if (card.card_type === "troop") {
    if (isHerdCard(card)) {
      if (slot_type !== "melee") return false;
      const otherLaneKey = getOtherMeleeLaneKey(laneKey);
      if (!otherLaneKey) return false;
      const otherLane = state.rows[owner][otherLaneKey];
      if (!otherLane) return false;
      const hereHasSpace = lane.troops.filter(Boolean).length < 6;
      const thereHasSpace = otherLane.troops.filter(Boolean).length < 6;
      return hereHasSpace && thereHasSpace;
    }
    return lane.troops.filter(Boolean).length < 6;
  }

  if (card.card_type === "tool") {
    return !lane.tool;
  }

  return false;
}

export function placeCard(state, card, owner, laneKey) {
  const ownerPhase = getOwnerPhase(state, owner);
  if (card.card_type === "tool" && card.modeType && card.modeType !== "any" && card.modeType !== ownerPhase) {
    return false;
  }
  const lane = state.rows[owner][laneKey];

  if (card.card_type === "troop") {
    if (isHerdCard(card)) {
      const otherLaneKey = getOtherMeleeLaneKey(laneKey);
      if (!otherLaneKey) return false;
      const otherLane = state.rows[owner][otherLaneKey];
      if (!otherLane) return false;
      if (lane.troops.filter(Boolean).length >= 6) return false;
      if (otherLane.troops.filter(Boolean).length >= 6) return false;

      const first = { ...card, _bonus: card._bonus ?? 0 };
      const second = { ...card, _bonus: card._bonus ?? 0 };

      lane.troops.push(first);
      applyOnDeployEffects(first, owner, laneKey, state, (c, o) => getCardPoints(state, c, o));

      otherLane.troops.push(second);
      applyOnDeployEffects(second, owner, otherLaneKey, state, (c, o) => getCardPoints(state, c, o));
      return true;
    }
    if (lane.troops.filter(Boolean).length >= 6) return false;
    if (card._bonus == null) card._bonus = 0;
    lane.troops.push(card);
    applyOnDeployEffects(card, owner, laneKey, state, (c, o) => getCardPoints(state, c, o));
    return true;
  }

  if (card.card_type === "tool") {
    if (lane.tool) return false;
    if (card._bonus == null) card._bonus = 0;
    lane.tool = card;
    applyOnDeployEffects(card, owner, laneKey, state, (c, o) => getCardPoints(state, c, o));
    return true;
  }

  return false;
}
