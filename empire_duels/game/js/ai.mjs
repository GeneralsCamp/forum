const WEIGHTS = {
    gain: 1.0,              // nyers pontnövekedés súlya
    winLane: 5.0,           // sor megnyerése
    phaseBonus: 0.5,        // fázis-kompatibilitás
    overcrowdPenalty: 0.6,  // túl sok egység egy sorban
};

export function decideAiMove(state, helpers) {
    const { canPlayCardToLane, calcLaneScore } = helpers;

    const lanes = ["ranged_1", "ranged_2", "melee_1", "melee_2"];
    const phase = state.phase;

    if (state.playerPassed) {
        const aiTotal = lanes.reduce((sum, laneKey) => sum + calcLaneScore("ai", laneKey), 0);
        const playerTotal = lanes.reduce((sum, laneKey) => sum + calcLaneScore("player", laneKey), 0);
        if (aiTotal > playerTotal) {
            return { type: "pass" };
        }
    }

    let bestMove = null;
    let bestScore = -Infinity;

    for (let handIndex = 0; handIndex < state.aiHand.length; handIndex++) {
        const card = state.aiHand[handIndex];

        for (const laneKey of lanes) {
            if (!canPlayCardToLane(card, "ai", laneKey)) continue;

            const otherMeleeLaneKey = laneKey.startsWith("melee_")
                ? (laneKey === "melee_1" ? "melee_2" : "melee_1")
                : null;
            const herd = Boolean(card && card.is_herd);
            const affectedLanes = herd && otherMeleeLaneKey
                ? [laneKey, otherMeleeLaneKey]
                : [laneKey];

            const aiBefore = affectedLanes.reduce((sum, lk) => sum + calcLaneScore("ai", lk), 0);
            const playerBefore = affectedLanes.reduce((sum, lk) => sum + calcLaneScore("player", lk), 0);

            const lane = state.rows.ai[laneKey];
            let simulated = null;

            if (card.card_type === "troop") {
                if (herd && otherMeleeLaneKey) {
                    const otherLane = state.rows.ai[otherMeleeLaneKey];
                    lane.troops.push(card);
                    otherLane.troops.push(card);
                    simulated = "herd";
                } else {
                    lane.troops.push(card);
                    simulated = "troop";
                }
            }

            if (card.card_type === "tool") {
                if (lane.tool) continue;
                lane.tool = card;
                simulated = "tool";
            }

            const aiAfter = affectedLanes.reduce((sum, lk) => sum + calcLaneScore("ai", lk), 0);

            if (simulated === "troop") lane.troops.pop();
            if (simulated === "herd") {
                const otherLane = state.rows.ai[otherMeleeLaneKey];
                lane.troops.pop();
                otherLane.troops.pop();
            }
            if (simulated === "tool") lane.tool = null;

            const gain = aiAfter - aiBefore;
            let score = 0;

            score += gain * WEIGHTS.gain;

            if (aiBefore <= playerBefore && aiAfter > playerBefore) {
                score += WEIGHTS.winLane;
            }

            if (card.modeType === phase || card.slot_type === "any") {
                score += gain * WEIGHTS.phaseBonus;
            }

            if (card.card_type === "troop") {
                for (const lk of affectedLanes) {
                    const count = state.rows.ai[lk].troops.length;
                    score -= count * WEIGHTS.overcrowdPenalty;
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestMove = {
                    type: "play",
                    handIndex,
                    laneKey,
                };
            }
        }
    }

    if (bestMove) return bestMove;
    return { type: "pass" };
}
