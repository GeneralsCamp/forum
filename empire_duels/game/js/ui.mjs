import {
  laneKeyToMeta,
  getCardPoints,
  getCardDisplayDelta,
  calcLaneScore,
  calcTotalScore,
  canPlayCardToLane,
  getOwnerPhase,
} from "./board.mjs";
import { getConstantDelta } from "./effects.mjs";

export function createUi({ state, el, constants, handlers, helpers }) {
  const { MAX_HAND } = constants;
  const { onSlotClick, onSlotDragOver, onSlotDrop, onCardContextMenu, onCardSelected } = handlers;
  const { getCardArt, playSfx } = helpers;
  let lastHoverAt = 0;

  function maybePlayConstantSfx(card, constDelta) {
    if (!card) return;
    const prev = card._last_const_delta;
    card._last_const_delta = constDelta;
    if (constDelta > 0 && (prev == null || prev <= 0)) {
      playSfx?.("buff");
    } else if (constDelta < 0 && (prev == null || prev >= 0)) {
      playSfx?.("debuff");
    }
  }

  function toast(msg) {
    const MAX_TOASTS = 3;
    const TOAST_SHOW_MS = 2600;
    const TOAST_FADE_MS = 600;

    const existing = el.toastArea.querySelectorAll(".toast-msg");
    if (existing.length >= MAX_TOASTS) {
      existing[0].remove();
    }

    const elToast = document.createElement("div");
    elToast.className = "toast-msg";
    elToast.textContent = msg;
    el.toastArea.appendChild(elToast);
    setTimeout(() => {
      elToast.style.opacity = "0";
      elToast.style.transition = `opacity ${TOAST_FADE_MS}ms ease`;
      setTimeout(() => elToast.remove(), TOAST_FADE_MS + 50);
    }, TOAST_SHOW_MS);
  }

  function renderTop() {
    const turnText = state.currentPlayer === "player" ? "YOUR TURN" : "ENEMY TURN";
    el.topStatus.textContent =
      `Round: ${state.roundNumber}/${state.roundsTotal} - ${turnText}`;
  }

  function renderDeckInfo() {
    const totalDeck = Number(localStorage.getItem("empire_duels_deck_size") || 30);
    el.scoreStatus.textContent =
      `Points: ${state.scores.playerTotal} - ${state.scores.aiTotal}`;

    const playerDeckCount = document.getElementById("playerDeckCount");
    const playerHandCount = document.getElementById("playerHandCount");
    const aiDeckCount = document.getElementById("aiDeckCount");
    const aiHandCount = document.getElementById("aiHandCount");

    if (playerDeckCount) playerDeckCount.textContent = String(state.playerDeck.length);
    if (playerHandCount) playerHandCount.textContent = `${state.playerHand.length}/${MAX_HAND}`;
    if (aiDeckCount) aiDeckCount.textContent = String(state.aiDeck.length);
    if (aiHandCount) aiHandCount.textContent = `${state.aiHand.length}/${MAX_HAND}`;
  }

  function updatePassButton() {
    el.passBtn.disabled = (state.currentPlayer !== "player");
  }

  function renderMiniCard(card, owner = null, laneKey = null) {
    const elCard = document.createElement("div");
    const rarityClass = `rarity-${String(card.rarity || "").toLowerCase()}`;
    const modeClass = `mode-${String(card.modeType || "any").toLowerCase()}`;
    elCard.className = `mini-card ${rarityClass} ${modeClass}`.trim();
    elCard.dataset.cardId = String(card.id);

    const rangeIcon =
      card.slot_type === "any" ? "&#9733;" :
        (card.slot_type === "ranged" ? "🏹" : "⚔");

    const artUrl = getCardArt(card);
    const basePts = getCardPoints(state, card, owner || "player");

    let pts = basePts;
    let statClass = "";

    if (owner && laneKey) {
      const delta = getCardDisplayDelta(state, card, owner, laneKey);
      pts = Math.max(0, basePts + delta);

      if (delta > 0) statClass = "stat-chip--buff";
      else if (delta < 0) statClass = "stat-chip--debuff";

      const constDelta = getConstantDelta(card, owner, laneKey, state, basePts);
      maybePlayConstantSfx(card, constDelta);
    } else {
      pts = Math.max(0, pts);
    }

    const statText = card.card_type === "tool" ? "🛠" : String(pts);

    const modeText =
      card.modeType === "defense" ? "DEFENSE" :
        (card.modeType === "attack" ? "ATTACK" : "ANY");

    elCard.innerHTML = `
        <div class="card-art" style="background-image: url('${artUrl}')"></div>
        <div class="card-overlay">
            <span class="icon-chip">${rangeIcon}</span>
            <span class="stat-chip ${statClass}">${statText}</span>
        </div>
        <div class="card-mode-text mini-mode-text">${modeText}</div>
    `;

    return elCard;
  }

  function renderBoard() {
    const lanes = ["ranged_1", "ranged_2", "melee_1", "melee_2"];
    const selectedCard = (state.currentPlayer === "player" && state.selectedHandIndex !== null)
      ? state.playerHand[state.selectedHandIndex]
      : null;
    const dragCard = (state.currentPlayer === "player" && state.dragHandIndex !== null)
      ? state.playerHand[state.dragHandIndex]
      : null;
    const activeCard = dragCard || selectedCard;
    const aiTargets = Array.isArray(state.lastAiPlayTargets) ? state.lastAiPlayTargets : [];
    const playerTargets = Array.isArray(state.lastPlayerPlayTargets) ? state.lastPlayerPlayTargets : [];
    const makeTargetKey = (t) =>
      `${t.owner}|${t.laneKey}|${t.slotType}|${t.index ?? "tool"}`;

    for (const owner of ["player", "ai"]) {
      for (const laneKey of lanes) {
        const container = document.getElementById(`slots_${owner}_${laneKey}`);
        container.innerHTML = "";

        const laneState = state.rows[owner][laneKey];

        for (let i = 0; i < 6; i++) {
          const slot = document.createElement("div");
          slot.className = "slot";
          slot.dataset.owner = owner;
          slot.dataset.lane = laneKey;
          slot.dataset.slotType = "troop";
          slot.dataset.index = String(i);

          const { slot_type } = laneKeyToMeta(laneKey);
          const hintIconSrc = slot_type === "ranged" ? "images/ranged_slot_icon.png" : "images/melee_slot_icon.png";
          const card = laneState.troops[i] ?? null;
          if (!card) {
            slot.innerHTML = `<div class="hint"><img src="${hintIconSrc}" alt=""></div>`;
            if (
              activeCard &&
              activeCard.card_type === "troop" &&
              canPlayCardToLane(state, activeCard, owner, laneKey)
            ) {
              slot.classList.add("highlight");
            }
            slot.addEventListener("click", onSlotClick);
            slot.addEventListener("dragover", onSlotDragOver);
            slot.addEventListener("drop", onSlotDrop);
          } else {
            slot.classList.add("filled");
            const miniCard = renderMiniCard(card, owner, laneKey);
            const targetKey = makeTargetKey({
              owner,
              laneKey,
              slotType: "troop",
              index: i,
            });
            if (aiTargets.some(t => makeTargetKey(t) === targetKey)) {
              miniCard.classList.add("card-slide-in-player");
            }
            if (playerTargets.some(t => makeTargetKey(t) === targetKey)) {
              miniCard.classList.add("card-slide-in-player");
            }
            slot.appendChild(miniCard);
            slot.dataset.cardId = String(card.id);
            slot.addEventListener("contextmenu", onCardContextMenu);
          }
          container.appendChild(slot);
        }

        const toolSlot = document.createElement("div");
        toolSlot.className = "slot tool-slot";
        toolSlot.dataset.owner = owner;
        toolSlot.dataset.lane = laneKey;
        toolSlot.dataset.slotType = "tool";

        if (!laneState.tool) {
          toolSlot.innerHTML = `<div class="hint"><img src="images/tool_slot_icon.png" alt=""></div>`;
          if (
            activeCard &&
            activeCard.card_type === "tool" &&
            canPlayCardToLane(state, activeCard, owner, laneKey)
          ) {
            toolSlot.classList.add("highlight");
          }
          toolSlot.addEventListener("click", onSlotClick);
          toolSlot.addEventListener("dragover", onSlotDragOver);
          toolSlot.addEventListener("drop", onSlotDrop);
        } else {
          toolSlot.classList.add("filled");
          const miniCard = renderMiniCard(laneState.tool, owner, laneKey);
          const targetKey = makeTargetKey({
            owner,
            laneKey,
            slotType: "tool",
          });
          if (aiTargets.some(t => makeTargetKey(t) === targetKey)) {
            miniCard.classList.add("card-slide-in-player");
          }
          if (playerTargets.some(t => makeTargetKey(t) === targetKey)) {
            miniCard.classList.add("card-slide-in-player");
          }
          toolSlot.appendChild(miniCard);
          toolSlot.dataset.cardId = String(laneState.tool.id);
          toolSlot.addEventListener("contextmenu", onCardContextMenu);
        }

        container.appendChild(toolSlot);

        const score = calcLaneScore(state, owner, laneKey);
        document.getElementById(`score_${owner}_${laneKey}`).textContent = score;
      }
    }
  }

  function renderHand(openCardModal) {
    el.hand.innerHTML = "";
    const cards = state.playerHand;
    const draggingIndex = state.isDragging ? state.dragHandIndex : null;
    const selectedCard = state.selectedHandIndex !== null ? state.playerHand[state.selectedHandIndex] : null;
    const lanes = ["ranged_1", "ranged_2", "melee_1", "melee_2"];

    const phase = state.phase;
    const modePriority = (card) => {
      if (card.modeType === phase) return 0;
      if (card.modeType === "any") return 2;
      return 1;
    };

    cards.sort((a, b) => {
      const modeDiff = modePriority(a) - modePriority(b);
      if (modeDiff !== 0) return modeDiff;
      const aPts = getCardPoints(state, a, "player");
      const bPts = getCardPoints(state, b, "player");
      if (aPts !== bPts) return bPts - aPts;
      return (a.id || 0) - (b.id || 0);
    });

    if (selectedCard) {
      state.selectedHandIndex = state.playerHand.indexOf(selectedCard);
    }

    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      if (i === draggingIndex) {
        const placeholder = document.createElement("div");
        placeholder.className = "hand-card placeholder";
        el.hand.appendChild(placeholder);
        continue;
      }
      const cardEl = document.createElement("div");
      const rarityClass = `rarity-${String(c.rarity || "").toLowerCase()}`;
      const modeClass = `mode-${String(c.modeType || "any").toLowerCase()}`;
      cardEl.className = `hand-card ${rarityClass} ${modeClass}`;
      if (state.selectedHandIndex === i) cardEl.classList.add("selected");
      const isPlayable = state.currentPlayer === "player"
        && lanes.some(laneKey => canPlayCardToLane(state, c, "player", laneKey));
      if (!isPlayable) cardEl.classList.add("disabled");
      cardEl.draggable = (state.currentPlayer === "player" && isPlayable);

      cardEl.dataset.index = String(i);
      cardEl.dataset.cardId = String(c.id);

      const rangeIcon =
        c.slot_type === "any" ? "&#9733;" :
          (c.slot_type === "ranged" ? "🏹" : "⚔");
      const modeLabel =
        c.modeType === "defense" ? "D" :
          (c.modeType === "attack" ? "A" : "ANY");
      const modeText =
        c.modeType === "defense" ? "DEFENSE" :
          (c.modeType === "attack" ? "ATTACK" : "ANY");

      const artUrl = getCardArt(c);
      const pts = getCardPoints(state, c, "player");
      const statText = c.card_type === "tool" ? "🛠" : String(pts);

      cardEl.innerHTML = `
      <div class="card-art" style="background-image: url('${artUrl}')"></div>
      <div class="card-overlay">
        <span class="icon-chip">${rangeIcon}</span>
        <span class="stat-chip">${statText}</span>
      </div>
      <div class="card-mode-text">${modeText}</div>
      <div class="glow"></div>
    `;

      cardEl.addEventListener("click", () => {
        if (state.currentPlayer !== "player") {
          toast("Enemy turn. You can't play cards now.");
          return;
        }
        if (!isPlayable) {
          toast("This card can't be played this round.");
          return;
        }
        const wasSelected = state.selectedHandIndex === i;
        state.selectedHandIndex = wasSelected ? null : i;
        if (!wasSelected && onCardSelected) onCardSelected(c);
        renderHand(openCardModal);
        renderBoard();
      });

      cardEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        openCardModal(c);
      });

      cardEl.addEventListener("mouseenter", () => {
        const now = Date.now();
        if (now - lastHoverAt < 80) return;
        lastHoverAt = now;
        playSfx?.("click");
      });

      cardEl.addEventListener("dragstart", (e) => {
        if (state.currentPlayer !== "player") return;
        if (!isPlayable) return;

        state.dragHandIndex = i;
        state.selectedHandIndex = null;
        state.isDragging = true;

        e.dataTransfer?.setData("text/plain", String(i));
        e.dataTransfer.effectAllowed = "move";

        requestAnimationFrame(() => {
          renderHand(openCardModal);
          renderBoard();
        });
      });

      cardEl.addEventListener("dragend", () => {
        state.dragHandIndex = null;
        state.isDragging = false;

        renderHand(openCardModal);
        renderBoard();
      });

      el.hand.appendChild(cardEl);
    }

    if (cards.length === 0) {
      const empty = document.createElement("div");
      empty.className = "small-note text-center";
      empty.textContent = "No cards in hand. Auto PASS.";
      el.hand.appendChild(empty);
    }
  }

  function renderAll(openCardModal) {
    renderTop();
    renderBoard();
    renderHand(openCardModal);
    renderDeckInfo();
    updatePassButton();
    renderTotals();
  }

  function renderTotals() {
    const playerTotalPoints = calcTotalScore(state, "player");
    const aiTotalPoints = calcTotalScore(state, "ai");
    el.playerHP.textContent = String(playerTotalPoints);
    el.aiHP.textContent = String(aiTotalPoints);
  }

  function renderGameHeader() {
    el.playerGeneralName.textContent = state.playerGeneral?.name || "Player";
    el.aiGeneralName.textContent = state.aiGeneral?.name || "Enemy";
    const playerRole = getOwnerPhase(state, "player") === "attack" ? "ATTACKER" : "DEFENDER";
    const aiRole = getOwnerPhase(state, "ai") === "attack" ? "ATTACKER" : "DEFENDER";
    const playerRoleEl = document.getElementById("playerRole");
    const aiRoleEl = document.getElementById("aiRole");
    if (playerRoleEl) playerRoleEl.textContent = `Player - ${playerRole}`;
    if (aiRoleEl) aiRoleEl.textContent = `Enemy AI - ${aiRole}`;
    if (el.playerGeneralImg) {
      el.playerGeneralImg.src = state.playerGeneral?.image || "images/generals/placeholder.png";
    }
    if (el.aiGeneralImg) {
      el.aiGeneralImg.src = state.aiGeneral?.image || "images/generals/placeholder.png";
    }
  }

  return {
    toast,
    renderTop,
    renderDeckInfo,
    updatePassButton,
    renderBoard,
    renderHand,
    renderAll,
    renderTotals,
    renderGameHeader,
  };
}

