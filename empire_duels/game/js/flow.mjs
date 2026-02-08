import { decideAiMove } from "./ai.mjs";

export function createFlow({ state, constants, helpers }) {
  const { MAX_HAND, START_HAND } = constants;
  const {
    shuffle,
    toast,
    renderAll,
    renderTop,
    renderBoard,
    renderHand,
    updatePassButton,
    calcTotalScore,
    calcLaneScore,
    canPlayCardToLane,
    placeCard,
    showRoundModal,
    setGenerals,
    renderGameHeader,
    makeEmptyLane,
    playSfx,
    playCardPlaceSfx,
    onCardPlayed,
  } = helpers;

  function drawCard(owner) {
    const deck = owner === "player" ? state.playerDeck : state.aiDeck;
    const hand = owner === "player" ? state.playerHand : state.aiHand;

    if (hand.length >= MAX_HAND) return false;
    if (deck.length <= 0) return false;

    hand.push(deck.shift());
    return true;
  }

  function ensureToolInStartingHand(owner) {
    const hand = owner === "player" ? state.playerHand : state.aiHand;
    const deck = owner === "player" ? state.playerDeck : state.aiDeck;
    if (hand.some(c => c.card_type === "tool")) return;
    const toolIndex = deck.findIndex(c => c.card_type === "tool");
    if (toolIndex === -1) return;
    const swapped = hand.pop();
    const toolCard = deck.splice(toolIndex, 1)[0];
    hand.push(toolCard);
    if (swapped) deck.unshift(swapped);
  }

  function capToolsInHand(owner, maxTools = 2) {
    const hand = owner === "player" ? state.playerHand : state.aiHand;
    const deck = owner === "player" ? state.playerDeck : state.aiDeck;
    let toolIndexes = hand
      .map((c, i) => (c.card_type === "tool" ? i : -1))
      .filter(i => i !== -1);

    while (toolIndexes.length > maxTools) {
      const idx = toolIndexes.pop();
      const replacementIndex = deck.findIndex(c => c.card_type !== "tool");
      if (replacementIndex === -1) break;
      const swapped = hand[idx];
      const replacement = deck.splice(replacementIndex, 1)[0];
      hand[idx] = replacement;
      deck.unshift(swapped);
      toolIndexes = hand
        .map((c, i) => (c.card_type === "tool" ? i : -1))
        .filter(i => i !== -1);
    }
  }

  function initGame(buildDeckWithRules, initLanes) {
    setGenerals();
    state.playerDeck = buildDeckWithRules(state.playerGeneral);
    state.aiDeck = buildDeckWithRules(state.aiGeneral);

    state.playerHand = [];
    state.aiHand = [];
    state.selectedHandIndex = null;

    state.scores.playerTotal = 0;
    state.scores.aiTotal = 0;
    state.generalAbilityUsed = false;

    initLanes();

    for (let i = 0; i < START_HAND; i++) {
      drawCard("player");
      drawCard("ai");
    }
    ensureToolInStartingHand("player");
    ensureToolInStartingHand("ai");
    capToolsInHand("player", 2);
    capToolsInHand("ai", 2);

    state.roundNumber = 1;

    startRound();
  }

  function startRound() {
    state.playerPassed = false;
    state.aiPassed = false;

    state.phase = state.roundNumber % 2 === 1 ? "defense" : "attack";
    renderGameHeader();
    playSfx?.("round-start");

    state.currentPlayer = state.phase === "attack" ? "player" : "ai";

    drawCard("player");
    drawCard("ai");
    if (state.roundNumber === 1) {
      capToolsInHand("player", 2);
      capToolsInHand("ai", 2);
    }

    renderAll();

    showRoundModal().then(() => {
      if (state.currentPlayer === "ai") {
        setTimeout(aiAct, getAiDelay());
      }
      checkAutoPass();
    });
  }

  function checkAutoPass() {
    const lanes = ["ranged_1", "ranged_2", "melee_1", "melee_2"];
    const hasPlayable = (owner) => {
      const hand = owner === "player" ? state.playerHand : state.aiHand;
      if (hand.length === 0) return false;
      return hand.some(card =>
        lanes.some(laneKey => canPlayCardToLane(state, card, owner, laneKey))
      );
    };
    if (state.currentPlayer === "player" && !hasPlayable("player")) {
      playerPass(true);
    }
    if (state.currentPlayer === "ai" && !hasPlayable("ai")) {
      aiPass(true);
    }
  }

  function endTurn() {
    if (state.isRoundModalOpen) return;

    state.isDragging = false;
    state.dragHandIndex = null;
    state.selectedHandIndex = null;

    state.currentPlayer = state.currentPlayer === "player" ? "ai" : "player";

    renderTop();
    updatePassButton();
    renderHand();
    renderBoard();

    if (state.playerPassed && state.aiPassed) {
      endRound();
      return;
    }

    if (state.currentPlayer === "ai") {
      setTimeout(aiAct, getAiDelay());
    } else {
      checkAutoPass();
    }
  }

  function getAiDelay() {
    return 800 + Math.floor(Math.random() * 1200);
  }

  function playerPass(isAuto = false) {
    if (state.currentPlayer !== "player") return;
    state.playerPassed = true;

    const drew = drawCard("player");
    if (drew) {
      playSfx?.("pick-card");
    }
    if (isAuto) {
      toast("Auto PASS (no cards).");
    } else {
      toast(drew ? "PASS → drew 1 card." : "PASS → couldn't draw (full hand or empty deck).");
    }

    renderAll();
    endTurn();
  }

  function aiPass(isAuto = false) {
    if (state.currentPlayer !== "ai") return;
    state.aiPassed = true;
    drawCard("ai");
    toast(isAuto ? "Enemy: Auto PASS (no cards)." : "Enemy: PASS.");
    renderAll();
    endTurn();
  }

  function aiAct() {
    if (state.currentPlayer !== "ai") return;

    const decision = decideAiMove(state, {
      canPlayCardToLane: (card, owner, laneKey) => canPlayCardToLane(state, card, owner, laneKey),
      calcLaneScore: (owner, laneKey) => calcLaneScore(state, owner, laneKey),
      shuffle
    });

    if (decision.type === "pass") {
      aiPass(false);
      return;
    }

    if (decision.type === "play") {
      const { handIndex, laneKey } = decision;
      const card = state.aiHand[handIndex];

      state.lastAiPlayTargets = [];
      if (card?.card_type === "tool") {
        state.lastAiPlayTargets.push({
          owner: "ai",
          laneKey,
          slotType: "tool",
        });
      } else if (card) {
        const lane = state.rows.ai?.[laneKey];
        const index = lane ? lane.troops.filter(Boolean).length : 0;
        state.lastAiPlayTargets.push({
          owner: "ai",
          laneKey,
          slotType: "troop",
          index,
        });
        if (card.is_herd && laneKey.startsWith("melee_")) {
          const otherLaneKey = laneKey === "melee_1" ? "melee_2" : "melee_1";
          const otherLane = state.rows.ai?.[otherLaneKey];
          const otherIndex = otherLane ? otherLane.troops.filter(Boolean).length : 0;
          state.lastAiPlayTargets.push({
            owner: "ai",
            laneKey: otherLaneKey,
            slotType: "troop",
            index: otherIndex,
          });
        }
      }

      const ok = placeCard(state, card, "ai", laneKey);
      if (ok) {
        playCardPlaceSfx?.(card, laneKey);
        state.aiHand.splice(handIndex, 1);
        state.aiPassed = false;
        toast(`Enemy played: ${card.name}`);
        renderAll();
        endTurn();
        if (state.aiAnimTimer) {
          clearTimeout(state.aiAnimTimer);
        }
        state.aiAnimTimer = setTimeout(() => {
          state.lastAiPlayTargets = [];
          state.aiAnimTimer = null;
        }, 300);
        return;
      }
      state.lastAiPlayTargets = [];
    }

    aiPass(false);
  }

  function clearBoard() {
    const cards = document.querySelectorAll(".board-area .mini-card");
    cards.forEach(card => card.classList.add("card-clear-out"));

    setTimeout(() => {
      for (const owner of ["player", "ai"]) {
        for (const laneKey of Object.keys(state.rows[owner])) {
          const lane = state.rows[owner][laneKey];
          for (const t of lane.troops) {
            if (t && t._bonus != null) t._bonus = 0;
          }
          if (lane.tool && lane.tool._bonus != null) lane.tool._bonus = 0;
          state.rows[owner][laneKey] = makeEmptyLane();
        }
      }
      renderAll();
    }, 350);
  }

  function endRound() {
    const playerScore = calcTotalScore(state, "player");
    const aiScore = calcTotalScore(state, "ai");

    state.scores.playerRound = playerScore;
    state.scores.aiRound = aiScore;

    if (playerScore > aiScore) state.scores.playerTotal += 1;
    else if (aiScore > playerScore) state.scores.aiTotal += 1;
    else state.scores.aiTotal += 1;

    if (state.scores.playerTotal >= 3 || state.scores.aiTotal >= 3) {
      endMatch();
      return;
    }

    const lowHandThreshold = MAX_HAND / 2;
    const drawForOwner = (owner) => {
      const hand = owner === "player" ? state.playerHand : state.aiHand;
      const draws = hand.length < lowHandThreshold ? 2 : 1;
      for (let i = 0; i < draws; i++) {
        drawCard(owner);
      }
    };

    drawForOwner("player");
    drawForOwner("ai");
    clearBoard();

    if (state.roundNumber >= state.roundsTotal) {
      endMatch();
      return;
    }

    state.roundNumber += 1;
    state.selectedHandIndex = null;
    setTimeout(startRound, 700);
  }
  function endMatch() {
    const playerTotal = state.scores.playerTotal;
    const aiTotal = state.scores.aiTotal;
    const victory = playerTotal > aiTotal;
    const draw = playerTotal === aiTotal;
    const outcome = draw ? "draw" : (victory ? "victory" : "defeat");

    localStorage.setItem(
      "lastMatchResult",
      JSON.stringify({
        outcome,
        victory,
        playerScore: playerTotal,
        aiScore: aiTotal,
        rounds: state.roundsTotal
      })
    );

    if (victory) {
      const wins = Number(localStorage.getItem("empire_duels_wins") || 0) + 1;
      localStorage.setItem("empire_duels_wins", String(wins));
    }

    window.location.href = "result.html";
  }

  return {
    initGame,
    startRound,
    endTurn,
    checkAutoPass,
    playerPass,
    aiPass,
    aiAct,
    endRound,
    endMatch,
  };
}



