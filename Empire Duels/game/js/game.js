import { canPlayCardToLane, placeCard, calcLaneScore, calcTotalScore } from "./board.mjs";
import { getEffectById } from "./effects.mjs";
import { createFlow } from "./flow.mjs";
import { createModals } from "./modals.mjs";
import { createUi } from "./ui.mjs";

function loadMaxHand() {
    const raw = Number(localStorage.getItem("empire_duels_hand_size") || 8);
    return raw === 10 ? 10 : 8;
}

const MAX_HAND = loadMaxHand();
const START_HAND = MAX_HAND - 3;
const ROUNDS_TOTAL = 4;
const BGM_VOLUME = 0.025;

const el = {
    winsCount: document.getElementById("winsCount"),
    startBtn: document.getElementById("startBtn"),
    rulesBtn: document.getElementById("rulesBtn"),
    backToHomeBtn: document.getElementById("backToHomeBtn"),
    rematchBtn: document.getElementById("rematchBtn"),
    homeBtn: document.getElementById("homeBtn"),

    passBtn: document.getElementById("passBtn"),
    topStatus: document.getElementById("topStatus"),
    scoreStatus: document.getElementById("scoreStatus"),
    hand: document.getElementById("hand"),
    toastArea: document.getElementById("toastArea"),
    cardModal: document.getElementById("cardModal"),
    cardModalBackdrop: document.getElementById("cardModalBackdrop"),
    cardModalClose: document.getElementById("cardModalClose"),
    cardModalContent: document.getElementById("cardModalContent"),
    roundModal: document.getElementById("roundModal"),
    roundModalTitle: document.getElementById("roundModalTitle"),
    roundModalSub: document.getElementById("roundModalSub"),
    roundModalResult: document.getElementById("roundModalResult"),
    roundModalBigScore: document.getElementById("roundModalBigScore"),
    roundModalScore: document.getElementById("roundModalScore"),

    playerGeneralName: document.getElementById("playerGeneralName"),
    aiGeneralName: document.getElementById("aiGeneralName"),
    playerGeneralImg: document.getElementById("playerGeneralImg"),
    aiGeneralImg: document.getElementById("aiGeneralImg"),
    playerHP: document.getElementById("playerHP"),
    aiHP: document.getElementById("aiHP"),

    resultTitle: document.getElementById("resultTitle"),
    resultSub: document.getElementById("resultSub"),
    resultScore: document.getElementById("resultScore"),
    bgm: document.getElementById("bgm"),
};

const state = {
    data: null,
    currentPlayer: "player",
    roundNumber: 1,
    phase: "attack",
    roundsTotal: 4,
    playerGeneral: null,
    aiGeneral: null,
    isDragging: false,

    playerDeck: [],
    aiDeck: [],
    playerHand: [],
    aiHand: [],

    playerPassed: false,
    aiPassed: false,
    selectedHandIndex: null,
    dragHandIndex: null,
    isRoundModalOpen: false,
    lastAiPlayTargets: [],
    aiAnimTimer: null,
    lastPlayerPlayTargets: [],
    playerAnimTimer: null,

    rows: {
        player: {},
        ai: {},
    },

    scores: {
        playerRound: 0,
        aiRound: 0,
        playerTotal: 0,
        aiTotal: 0,
    },
    generalAbilityUsed: false,
};

const RARITY_LIMITS = {
    legendary: 1,
    epic: 2,
    rare: 3,
    common: 3,
};


function makeEmptyLane() {
    return { troops: [], tool: null };
}

function initLanes() {
    const lanes = ["ranged_1", "ranged_2", "melee_1", "melee_2"];
    state.rows.player = {};
    state.rows.ai = {};
    for (const laneKey of lanes) {
        state.rows.player[laneKey] = makeEmptyLane();
        state.rows.ai[laneKey] = makeEmptyLane();
    }
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function escapeHtml(str) {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function loadWins() {
    const raw = localStorage.getItem("empire_duels_wins");
    return Number(raw || 0);
}

function saveWins(value) {
    localStorage.setItem("empire_duels_wins", String(value));
}

function renderWins() {
    el.winsCount.textContent = String(loadWins());
}

function setGenerals() {
    const savedEnemyId = Number(localStorage.getItem("empire_duels_enemy_general_id") || 0);
    const enemies = state.data.generals.filter(g => g.type === "enemy");
    state.aiGeneral =
        enemies.find(g => g.id === savedEnemyId) ||
        enemies.find(g => g.name === "Wolfgard") ||
        enemies[0] ||
        state.data.generals.find(g => g.type === "enemy");

    const savedId = Number(localStorage.getItem("empire_duels_general_id") || 0);
    const friendly = state.data.generals.filter(g => g.type === "friendly");
    state.playerGeneral =
        friendly.find(g => g.id === savedId) ||
        friendly.find(g => g.name === "Horatio") ||
        friendly[0] ||
        state.data.generals[0];
}

function buildDeckWithRules() {
    const allCards = state.data.cards;
    const deckSize = Number(localStorage.getItem("empire_duels_deck_size") || 30) === 40 ? 40 : 30;
    const halfSize = Math.floor(deckSize / 2);

    const limitsByRarity = {
        legendary: 1,
        epic: 2,
        rare: 3,
        common: 3,
    };

    const deck = [];
    let attackCount = 0;
    let defenseCount = 0;

    const pool = [];
    for (const card of allCards) {
        if (card.is_special) continue;
        const rarity = String(card.rarity).toLowerCase();
        const limit = limitsByRarity[rarity] ?? 0;
        for (let i = 0; i < limit; i++) {
            pool.push(card);
        }
    }

    const shuffled = shuffle(pool);

    function canAdd(targetMode) {
        if (targetMode === "attack" && attackCount >= halfSize) return false;
        if (targetMode === "defense" && defenseCount >= halfSize) return false;
        return true;
    }

    for (const card of shuffled) {
        if (deck.length >= deckSize) break;

        const modes = [];

        if (card.modeType === "attack") modes.push("attack");
        else if (card.modeType === "defense") modes.push("defense");
        else modes.push("attack", "defense");

        for (const mode of modes) {
            if (!canAdd(mode)) continue;

            deck.push({ ...card });

            if (mode === "attack") attackCount++;
            if (mode === "defense") defenseCount++;

            break;
        }
    }

    if (deck.length !== deckSize || attackCount !== halfSize || defenseCount !== halfSize) {
        console.warn("Deck build failed", {
            size: deck.length,
            attackCount,
            defenseCount,
        });
    }

    return shuffle(deck);
}

function getCardArt(card) {
    if (card.image) return card.image;
    if (card.card_type === "tool") {
        return `images/tool_${card.slot_type}.svg`;
    }
    return `images/${card.slot_type}_${card.modeType}.svg`;
}

function activatePlayerGeneralAbility() {
    if (state.isRoundModalOpen) return;
    if (state.currentPlayer !== "player") {
        toast("Ability can only be used on your turn.");
        return;
    }
    if (state.generalAbilityUsed) {
        toast("General ability already used.");
        return;
    }
    const general = state.playerGeneral;
    if (!general) return;
    const eff = getEffectById(state.data.effects, general.effect_id);
    if (!eff || eff.trigger !== "active" || eff.kind !== "add_card_to_hand") return;

    const { card_id, amount = 1 } = eff.effect_params || {};
    const cardDef = state.data.cards.find(c => c.id === card_id);
    if (!cardDef) {
        toast("Card not found for ability.");
        return;
    }

    for (let i = 0; i < amount; i++) {
        if (state.playerHand.length >= MAX_HAND) break;
        state.playerHand.push({ ...cardDef });
    }
    state.generalAbilityUsed = true;
    toast(`Ability used: ${cardDef.name} added to hand.`);
    renderAllWithModal();
}
function onSlotClick(e) {
    if (state.isRoundModalOpen) return;
    if (state.currentPlayer !== "player") return;

    const owner = e.currentTarget.dataset.owner;
    const laneKey = e.currentTarget.dataset.lane;

    if (owner !== "player") {
        toast("You can only play on your side.");
        return;
    }

    if (state.selectedHandIndex === null) {
        toast("Select a card from your hand.");
        return;
    }

    const card = state.playerHand[state.selectedHandIndex];
    if (!card) return;

    if (!canPlayCardToLane(state, card, "player", laneKey)) {
        toast("This card can't be played here (phase / row / type).");
        return;
    }

    state.lastPlayerPlayTargets = [];
    if (card?.card_type === "tool") {
        state.lastPlayerPlayTargets.push({
            owner: "player",
            laneKey,
            slotType: "tool",
        });
    } else if (card) {
        const lane = state.rows.player?.[laneKey];
        const index = lane ? lane.troops.filter(Boolean).length : 0;
        state.lastPlayerPlayTargets.push({
            owner: "player",
            laneKey,
            slotType: "troop",
            index,
        });
        if (card.is_herd && laneKey.startsWith("melee_")) {
            const otherLaneKey = laneKey === "melee_1" ? "melee_2" : "melee_1";
            const otherLane = state.rows.player?.[otherLaneKey];
            const otherIndex = otherLane ? otherLane.troops.filter(Boolean).length : 0;
            state.lastPlayerPlayTargets.push({
                owner: "player",
                laneKey: otherLaneKey,
                slotType: "troop",
                index: otherIndex,
            });
        }
    }

    const ok = placeCard(state, card, "player", laneKey);
    if (!ok) {
        toast("Couldn't place the card (row might be full).");
        return;
    }
    state.playerHand.splice(state.selectedHandIndex, 1);
    state.selectedHandIndex = null;
    state.playerPassed = false;

    renderAllWithModal();
    if (state.playerAnimTimer) {
        clearTimeout(state.playerAnimTimer);
    }
    state.playerAnimTimer = setTimeout(() => {
        state.lastPlayerPlayTargets = [];
        state.playerAnimTimer = null;
    }, 220);
    endTurn();
}

function onSlotDragOver(e) {
    e.preventDefault();
}

function onSlotDrop(e) {
    if (state.isRoundModalOpen) return;
    e.preventDefault();
    if (state.currentPlayer !== "player") return;

    const owner = e.currentTarget.dataset.owner;
    const laneKey = e.currentTarget.dataset.lane;
    if (owner !== "player") return;

    const idx = state.dragHandIndex;
    if (idx === null || idx === undefined) return;

    const card = state.playerHand[idx];
    if (!card) return;

    if (!canPlayCardToLane(state, card, "player", laneKey)) {
        toast("This card can't be played here (phase / row / type).");
        return;
    }

    state.lastPlayerPlayTargets = [];
    if (card?.card_type === "tool") {
        state.lastPlayerPlayTargets.push({
            owner: "player",
            laneKey,
            slotType: "tool",
        });
    } else if (card) {
        const lane = state.rows.player?.[laneKey];
        const index = lane ? lane.troops.filter(Boolean).length : 0;
        state.lastPlayerPlayTargets.push({
            owner: "player",
            laneKey,
            slotType: "troop",
            index,
        });
        if (card.is_herd && laneKey.startsWith("melee_")) {
            const otherLaneKey = laneKey === "melee_1" ? "melee_2" : "melee_1";
            const otherLane = state.rows.player?.[otherLaneKey];
            const otherIndex = otherLane ? otherLane.troops.filter(Boolean).length : 0;
            state.lastPlayerPlayTargets.push({
                owner: "player",
                laneKey: otherLaneKey,
                slotType: "troop",
                index: otherIndex,
            });
        }
    }

    const ok = placeCard(state, card, "player", laneKey);
    if (!ok) {
        toast("Couldn't place the card (row might be full).");
        return;
    }
    state.playerHand.splice(idx, 1);
    state.dragHandIndex = null;
    state.isDragging = false;
    state.selectedHandIndex = null;
    state.playerPassed = false;

    renderAllWithModal();

    if (state.playerAnimTimer) {
        clearTimeout(state.playerAnimTimer);
    }
    state.playerAnimTimer = setTimeout(() => {
        state.lastPlayerPlayTargets = [];
        state.playerAnimTimer = null;
    }, 220);
    endTurn();
}

function onCardContextMenu(e) {
    e.preventDefault();
    const slot = e.currentTarget;
    const owner = slot?.dataset?.owner;
    const laneKey = slot?.dataset?.lane;
    const slotType = slot?.dataset?.slotType;
    if (owner && laneKey) {
        const lane = state.rows?.[owner]?.[laneKey];
        if (!lane) return;
        let card = null;
        if (slotType === "tool") {
            card = lane.tool;
        } else {
            const idx = Number(slot.dataset.index ?? -1);
            card = Number.isInteger(idx) && idx >= 0 ? lane.troops[idx] : null;
        }
        if (card) openCardModal(card, { owner, laneKey });
        return;
    }

    const id = Number(e.currentTarget.dataset.cardId);
    if (!id || !state.data?.cards) return;
    const card = state.data.cards.find(c => c.id === id);
    if (card) openCardModal(card);
}

const modals = createModals({
    state,
    el,
    helpers: { escapeHtml, getCardArt },
});

const { openCardModal, openGeneralModal, closeCardModal, showRoundModal } = modals;

const ui = createUi({
    state,
    el,
    constants: { MAX_HAND },
    handlers: { onSlotClick, onSlotDragOver, onSlotDrop, onCardContextMenu },
    helpers: { getCardArt },
});

const {
    toast,
    renderTop,
    renderDeckInfo,
    updatePassButton,
    renderBoard,
    renderHand,
    renderAll,
    renderTotals,
    renderGameHeader,
} = ui;

const renderHandWithModal = () => renderHand(openCardModal);
const renderAllWithModal = () => renderAll(openCardModal);

const flow = createFlow({
    state,
    constants: { MAX_HAND, START_HAND, ROUNDS_TOTAL },
    helpers: {
        shuffle,
        toast,
        renderAll: renderAllWithModal,
        renderTop,
        renderBoard,
        renderHand: renderHandWithModal,
        updatePassButton,
        calcTotalScore,
        calcLaneScore,
        canPlayCardToLane,
    placeCard,
    showRoundModal,
    setGenerals,
    renderGameHeader,
    makeEmptyLane,
    },
});

const {
    initGame,
    startRound,
    endTurn,
    checkAutoPass,
    playerPass,
    aiPass,
    aiAct,
    endRound,
    endMatch,
} = flow;

function registerDebugCommands() {
    window.edAddCardToHand = (id, owner = "player") => {
        if (!state.data?.cards) return false;
        const cardDef = state.data.cards.find(c => c.id === Number(id));
        if (!cardDef) {
            console.warn("Card not found:", id);
            return false;
        }
        const hand = owner === "ai" ? state.aiHand : state.playerHand;
        if (hand.length >= MAX_HAND) {
            console.warn("Hand is full.");
            return false;
        }
        hand.push({ ...cardDef });
        renderAllWithModal();
        return true;
    };
}

function bindEvents() {
    el.passBtn.addEventListener("click", () => {
        playerPass(false);
    });

    if (el.cardModalBackdrop) {
        el.cardModalBackdrop.addEventListener("click", closeCardModal);
    }
    if (el.cardModalClose) {
        el.cardModalClose.addEventListener("click", closeCardModal);
    }
    if (el.playerGeneralImg) {
        el.playerGeneralImg.addEventListener("click", () => {
            activatePlayerGeneralAbility();
        });
        el.playerGeneralImg.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            openGeneralModal(state.playerGeneral);
        });
    }
    if (el.aiGeneralImg) {
        el.aiGeneralImg.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            openGeneralModal(state.aiGeneral);
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeCardModal();
        }
    });

    document.addEventListener("contextmenu", (e) => {
        const target = e.target;
        const isCard =
            target?.closest?.(".hand-card") ||
            target?.closest?.(".mini-card") ||
            target?.closest?.(".slot[data-card-id]");

        if (!isCard) {
            e.preventDefault();
        }
    });
}

function startBgm() {
    if (!el.bgm) return;
    const applyVolume = () => {
        el.bgm.volume = BGM_VOLUME;
    };
    applyVolume();
    el.bgm.addEventListener("loadedmetadata", applyVolume, { once: true });
    el.bgm.addEventListener("play", applyVolume);
    if (el.bgm.paused) {
        el.bgm.play().catch(() => {
            // Autoplay may be blocked; will retry on next user gesture.
        });
    }
}

async function init() {
    try {
        const [cardsRes, generalsRes, effectsRes] = await Promise.all([
            fetch("../data/cards.json"),
            fetch("../data/generals.json"),
            fetch("../data/effects.json"),
        ]);

        const [cards, generals, effects] = await Promise.all([
            cardsRes.json(),
            generalsRes.json(),
            effectsRes.json(),
        ]);

        state.data = { cards, generals, effects };
        state.roundsTotal = 4;
    } catch (err) {
        console.error(err);
        alert("Failed to load card data.");
        return;
    }

    bindEvents();
    startBgm();
    registerDebugCommands();
    initGame(buildDeckWithRules, initLanes);
}

init();
