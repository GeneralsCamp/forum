import { getEffectById, getEffectSources, getEffectDelta } from "./effects.mjs";
import { getCardPoints } from "./board.mjs";

export function createModals({ state, el, helpers }) {
  const { escapeHtml, getCardArt } = helpers;

  function openCardModal(card, context = {}) {
    if (!el.cardModal || !el.cardModalContent) return;
    const { owner = null, laneKey = null } = context;
    const eff = getEffectById(state.data.effects, card.effect_id);
    const effectName = eff?.name || "";
    const effectDesc = eff?.description || "";
    const artUrl = getCardArt(card);
    const effectSection = eff
      ? `
      <div class="card-modal__section">
        <div class="card-modal__section-title">Effect</div>
        <div class="card-modal__effect-name">${escapeHtml(effectName)}</div>
        <div class="card-modal__effect-desc">${escapeHtml(effectDesc)}</div>
      </div>
    `
      : "";

    let activeEffectsSection = "";
    if (owner && laneKey) {
      const base = getCardPoints(state, card, owner);
      const sources = getEffectSources(state);
      const chipMap = new Map();
      const addChip = (key, name, delta) => {
        if (!delta) return;
        const existing = chipMap.get(key);
        if (existing) {
          existing.amount += delta;
          return;
        }
        chipMap.set(key, { name, amount: delta });
      };
      for (const src of sources) {
        const delta = getEffectDelta(src, card, owner, laneKey, base, state);
        if (!delta) continue;
        const name = src.effect?.name || "Effect";
        const key = src.effect?.id != null ? `effect:${src.effect.id}` : `effect:${name}`;
        addChip(key, name, delta);
      }
      if (Array.isArray(card._bonus_sources)) {
        for (const src of card._bonus_sources) {
          const bonus = Number(src.amount) || 0;
          if (!bonus) continue;
          const name = src.name || "On deploy";
          const key = src.effect_id != null ? `bonus:${src.effect_id}` : `bonus:${name}`;
          addChip(key, name, bonus);
        }
      } else if (card._bonus) {
        const bonus = Number(card._bonus) || 0;
        if (bonus !== 0) {
          addChip("bonus:On deploy", "On deploy", bonus);
        }
      }
      const chips = [];
      for (const entry of chipMap.values()) {
        const total = Number(entry.amount) || 0;
        if (!total) continue;
        const sign = total > 0 ? "+" : "-";
        const amount = Math.abs(total);
        const cls = total > 0 ? "buff" : "debuff";
        chips.push(`<span class="card-modal__effect-chip ${cls}">${sign}${amount} ${escapeHtml(entry.name)}</span>`);
      }
      activeEffectsSection = chips.length > 0
        ? `<div class="card-modal__effect-list">${chips.join("")}</div>`
        : `<div class="card-modal__muted">None</div>`;
    }

    el.cardModalContent.innerHTML = `
        <div class="card-modal__art">
            <div class="card-art" style="background-image: url('${artUrl}')"></div>
        </div>
        <div>
            <div class="card-modal__title">${escapeHtml(card.name)}</div>
            <div class="card-modal__meta">
            <span class="card-modal__badge">Type: ${escapeHtml(card.card_type)}</span>
            <span class="card-modal__badge">Slot: ${escapeHtml(card.slot_type)}</span>
            <span class="card-modal__badge">Rarity: ${escapeHtml(card.rarity)}</span>
            <span class="card-modal__badge">Tribe: ${escapeHtml(card.tribe || "none")}</span>
            ${card.is_herd ? `<span class="card-modal__badge">HERD</span>` : ""}
            </div>
            <div class="card-modal__section">
            <div class="card-modal__section-title">Points</div>
            <div class="card-modal__kv-inline">ATTACK: ${card.attack_points}</div>
            <div class="card-modal__kv-inline">DEFENSE: ${card.defense_points}</div>
            </div>
            ${activeEffectsSection ? `<div class="card-modal__section"><div class="card-modal__section-title">Active Buffs & Debuffs</div>${activeEffectsSection}</div>` : ""}
            ${effectSection}
        </div>
        `;

    el.cardModal.hidden = false;
    requestAnimationFrame(() => {
      el.cardModal.classList.add("is-open");
    });
  }

  function closeCardModal() {
    if (!el.cardModal) return;
    el.cardModal.classList.remove("is-open");
    setTimeout(() => {
      el.cardModal.hidden = true;
    }, 260);
  }

  function openGeneralModal(general) {
    if (!general || !el.cardModal || !el.cardModalContent) return;
    const eff = getEffectById(state.data.effects, general.effect_id);
    const effectName = eff?.name || "";
    const effectDesc = eff?.description || "";
    const artUrl = general.image || "images/generals/placeholder.png";
    const effectSection = eff
      ? `
      <div class="card-modal__section">
        <div class="card-modal__section-title">Effect</div>
        <div class="card-modal__effect-name">${escapeHtml(effectName)}</div>
        <div class="card-modal__effect-desc">${escapeHtml(effectDesc)}</div>
      </div>
    `
      : "";

    el.cardModalContent.innerHTML = `
        <div class="card-modal__art">
            <div class="card-art" style="background-image: url('${artUrl}')"></div>
        </div>
        <div>
            <div class="card-modal__title">${escapeHtml(general.name)}</div>
            <div class="card-modal__meta">
            <span class="card-modal__badge">Type: General</span>
            <span class="card-modal__badge">Side: ${escapeHtml(general.type || "unknown")}</span>
            <span class="card-modal__badge">Rarity: ${escapeHtml(general.rarity || "unknown")}</span>
            <span class="card-modal__badge">Passive</span>
            </div>
            ${effectSection}
        </div>
        `;

    el.cardModal.hidden = false;
    requestAnimationFrame(() => {
      el.cardModal.classList.add("is-open");
    });
  }

  function showRoundModal() {
    const roundText = `ROUND ${state.roundNumber} RESULT`;
    const matchText = `Match: ${state.scores.playerTotal} - ${state.scores.aiTotal}`;
    const playerRound = state.scores.playerRound ?? 0;
    const aiRound = state.scores.aiRound ?? 0;
    const bigScoreText = `${playerRound} - ${aiRound}`;
    let resultText = "ROUND START";
    const nextRound = state.roundNumber + 1;
    const nextPhase = state.roundNumber % 2 === 1 ? "attack" : "defense";
    const nextSubText = nextRound <= state.roundsTotal
      ? `NEXT ROUND: ${nextRound} • ${nextPhase.toUpperCase()}`
      : "MATCH POINT REACHED";
    const isFirstStart = state.roundNumber === 1 &&
      state.scores.playerTotal === 0 &&
      state.scores.aiTotal === 0 &&
      playerRound === 0 &&
      aiRound === 0;

    if (!(state.roundNumber === 1 && playerRound === 0 && aiRound === 0)) {
      if (playerRound > aiRound) resultText = "ROUND WON";
      else if (playerRound < aiRound) resultText = "ROUND LOST";
      else resultText = "ROUND DRAW";
    }

    if (isFirstStart) {
      if (el.roundModalTitle) el.roundModalTitle.textContent = "GAME STARTED";
      if (el.roundModalSub) el.roundModalSub.textContent = `MODE: ${state.phase.toUpperCase()}`;
      if (el.roundModalResult) el.roundModalResult.textContent = "ROUND 1";
      if (el.roundModalBigScore) el.roundModalBigScore.textContent = "";
      if (el.roundModalScore) el.roundModalScore.textContent = "";
    } else {
      if (el.roundModalTitle) el.roundModalTitle.textContent = roundText;
      if (el.roundModalSub) el.roundModalSub.textContent = nextSubText;
      if (el.roundModalResult) el.roundModalResult.textContent = resultText;
      if (el.roundModalBigScore) el.roundModalBigScore.textContent = bigScoreText;
      if (el.roundModalScore) el.roundModalScore.textContent = matchText;
    }

    if (!el.roundModal) return Promise.resolve();

    state.isRoundModalOpen = true;
    el.roundModal.hidden = false;
    requestAnimationFrame(() => {
      el.roundModal.classList.add("is-open");
    });

    const displayMs = isFirstStart ? 1500 : 6000;
    return new Promise((resolve) => {
      let canSkip = false;
      let finished = false;

      const finalize = () => {
        if (finished) return;
        finished = true;
        el.roundModal.classList.remove("is-open");
        setTimeout(() => {
          el.roundModal.hidden = true;
          state.isRoundModalOpen = false;
          el.roundModal.removeEventListener("click", trySkip);
          document.removeEventListener("keydown", onKeyDown);
          resolve();
        }, 260);
      };

      const trySkip = () => {
        if (!canSkip) return;
        finalize();
      };

      const onKeyDown = (e) => {
        if (!canSkip) return;
        if (e.key === "Escape" || e.key === " " || e.key === "Enter") {
          finalize();
        }
      };

      el.roundModal.addEventListener("click", trySkip);
      document.addEventListener("keydown", onKeyDown);

      setTimeout(() => {
        canSkip = true;
      }, 2000);

      setTimeout(() => {
        finalize();
      }, displayMs);
    });
  }

  return {
    openCardModal,
    openGeneralModal,
    closeCardModal,
    showRoundModal,
  };
}
