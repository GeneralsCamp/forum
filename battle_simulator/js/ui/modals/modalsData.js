import { generateInputCard } from './modalGenerator.js';
import { attackBasics, commanderStats, castellanStats } from '../../data/variables.js';

export const modalsData = [
  //Presets modal
  {
    id: 'waveCopyModal',
    title: 'Presets',
    body: `
        <div class="wave-navigation mb-2" id="waveNavigation">
            <button class="nav-btn" id="prevWaveBtn">&#9664;</button>
            <span id="currentWaveText">Wave 1 / X</span>
            <button class="nav-btn" id="nextWaveBtn">&#9654;</button>
        </div>
        <div class="preset-list" id="presetList" ontouchstart="startTouchPresets(event)" ontouchend="endTouchPresets(event)">
            ${[...Array(8)].map(
      (_, i) => `
                <div class="preset-item" data-preset="${i + 1}">
                    <input type="radio" name="preset" id="preset${i + 1}">
                    <label for="preset${i + 1}">&nbspPreset ${i + 1}</label>
                </div>
            `
    ).join('')}
        </div>
    `,
    footer: `
<div class="row presets-footer">
    <div class="col-6">
        <button class="btn btn-apply" id="applyPresetBtn">
            <img src="./img/icon_applyOne.webp" alt="Apply" class="icon" />
        </button>
        <p>Apply preset to wave</p>
    </div>
    <div class="col-6">
        <button class="btn btn-apply-all" id="applyPresetAllBtn">
            <img src="./img/icon_applyAll.webp" alt="Apply to All" class="icon" />
        </button>
        <p>Apply preset to all waves</p>
    </div>
    <div class="col-6">
        <button class="btn btn-save" id="savePresetBtn">
            <img src="./img/icon_save.webp" alt="Save" class="icon" />
        </button>
        <p>Save selected wave to preset</p>
    </div>
</div>
  `
  },
  //Defense basics modal
  {
    id: 'defenseBasicsModal',
    title: 'Defense Basics',
    body: `
        <div class="player-flanks d-flex justify-content-between align-items-center">
            <div class="row flanks ms-1">
                <button class="btn flanks-button-defense sides" data-section="left">
                    <img src="./img/left-icon.webp" alt="L">
                </button>
                <button class="btn flanks-button-defense sides active" data-section="front">
                    <img src="./img/front-icon.webp" alt="F">
                </button>
                <button class="btn flanks-button-defense sides" data-section="right">
                    <img src="./img/right-icon.webp" alt="R">
                </button>
                <button class="btn flanks-button-defense sides" data-section="cy">
                    <img src="./img/cy-icon.webp" alt="CY">
                </button>
            </div>
        </div>
        <div class="player-flank d-flex">
            <span id="current-defense-flank">Castle wall: Front</span>
        </div>
        <div class="col-12">
            <div class="card w-100">
                <div class="modal-card-body mt-1">
                    <h6 class="card-title text-center">Defense troops</h6>
                    <div class="d-flex align-items-center">
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between defense-modal-fix mt-2 mb-2 ms-2 me-2 unit-slot-container"></div>
                        </div>
                    </div>
                    <div class="text-center">
                        <span id="troopCombatBonuses"></span>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-12">
            <div class="card w-100">
                <div class="modal-card-body mt-1">
                    <h6 class="card-title text-center">Defense tools</h6>
                    <div class="d-flex align-items-center">
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between defense-modal-fix mt-2 mb-2 ms-2 me-2" id="toolsSlots"></div>
                        </div>
                    </div>
                    <div class="text-center">
                        <span id="toolBonuses"></span>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-12">
            <div class="card w-100">
                <div class="modal-card-body mt-1 unit-distributon-modal">
                    <h6 class="card-title text-center">Unit distribution</h6>
                    <div class="row d-flex align-items-center justify-content-center">
                        <div class="d-flex justify-content-center mb-1 mt-2">
                            <img src="./img/castellan-modal1.png" alt="Tools" style="width: 20px; height: 20px; vertical-align: middle;">
                            <span id="leftPercentage" class="selector-value">0%</span>
                            <input type="range" id="defenseStrengthSlider" min="0" max="100" value="0" class="form-range" disabled />
                            <img src="./img/castellan-modal2.png" alt="Tools" style="width: 20px; height: 20px; vertical-align: middle;">
                            <span id="rightPercentage" class="selector-value">0%</span>
                        </div>
                        <div class="col-4 d-flex flex-column align-items-center justify-content-center text-center">
                            <div class="d-flex align-items-center justify-content-center">
                                <img src="./img/wall-icon.png" alt="Tools" style="width: 22px; height: auto;">
                                <span class="unit-distributon-modal-value" id="leftFlank">X%</span>
                            </div>
                            <hr class="yellow-line">
                            <span class="unit-distributon-modal-side">Left flank</span>
                        </div>
                        <div class="col-4 d-flex flex-column align-items-center justify-content-center text-center">
                            <div class="d-flex align-items-center justify-content-center">
                                <img src="./img/gate-icon.png" alt="Tools" style="width: 22px; height: auto; vertical-align: middle;">
                                <span class="unit-distributon-modal-value" id="front">X%</span>
                            </div>
                            <hr class="red-line">
                            <span class="unit-distributon-modal-side">Front</span>
                        </div>
                        <div class="col-4 d-flex flex-column align-items-center justify-content-center text-center">
                            <div class="d-flex align-items-center justify-content-center">
                                <img src="./img/wall-icon.png" alt="Tools" style="width: 22px; height: auto;">
                                <span class="unit-distributon-modal-value" id="rightFlank">X%</span>
                            </div>
                            <hr class="yellow-line">
                            <span class="unit-distributon-modal-side">Right flank</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    footer: ''
  },
  //Defense tools modal
  {
    id: 'toolModalDefense',
    title: 'Defense Tools',
    body: `<div class="modal-body p-0"></div>`,
    footer: `
        <button type="button" id="confirmDefenseTools" class="btn btn-success btn-confirm">
          Confirm
        </button>
    `
  },
  //Defense troops modal
  {
    id: 'unitModalDefense',
    title: 'Defense Soldiers',
    body: `<div class="modal-body p-0"></div>`,
    footer: `
        <button type="button" id="confirmDefenseUnits" class="btn btn-success btn-confirm">
          Confirm
        </button>
    `
  },
  //Attacker troops modal
  {
    id: 'unitModal',
    title: 'Soldiers',
    body: `<div class="modal-body p-0"></div>`,
    footer: `
        <button type="button" id="confirmUnits" class="btn btn-success btn-confirm">
          Confirm
        </button>
    `
  },
  //Attacker tools modal
  {
    id: 'toolModal',
    title: 'Tools',
    body: `<div class="modal-body p-0 tool-modal-body"></div>`,
    footer: `
        <button type="button" id="confirmTools" class="btn btn-success btn-confirm">
          Confirm
        </button>
    `
  },
  //Attacker support tool modal
  {

    id: 'supportToolModal',
    title: 'Tools',
    body: `<div class="modal-body p-0 support-tool-modal-body"></div>`,
    footer: `
        <button type="button" id="confirmSupportTools" class="btn btn-success btn-confirm">
          Confirm
        </button>
    `
  },
  //Attacker basics modal
  {
    id: 'basicsModal',
    title: 'Attack Basics',
    body: `
        ${generateInputCard(
      'Waves', './img/attack-modal1.png', 'wave',
      'waves-slider', 4, 23, attackBasics.maxWaves,
      'waves-value', 4, 23, attackBasics.maxWaves
    )}
        ${generateInputCard(
      'Front unit limit', './img/attack-modal2.png', 'front-unit-limit',
      'front-unit-slider', 192, 1600, attackBasics.maxUnits.front,
      'front-unit-value', 192, 1600, attackBasics.maxUnits.front
    )}
        ${generateInputCard(
      'Flank unit limit', './img/attack-modal3.png', 'flank-unit-limit',
      'flank-unit-slider', 64, 800, attackBasics.maxUnits.left,
      'flank-unit-value', 64, 800, attackBasics.maxUnits.left
    )}
        ${generateInputCard(
      'Courtyard unit limit', './img/attack-modal4.png', 'courtyard-unit-limit',
      'courtyard-unit-slider', 2089, 6000, attackBasics.maxUnitsCY,
      'courtyard-unit-value', 2089, 6000, attackBasics.maxUnitsCY
    )}
        ${generateInputCard(
      'Flank tool limit', './img/attack-modal5.png', 'flank-tool-limit',
      'flank-tool-slider', 40, 50, attackBasics.maxTools.left,
      'flank-tool-value', 40, 50, attackBasics.maxTools.left
    )}
        ${generateInputCard(
      'Level of "Valkyre ranger"', './img/attack-modal6.png', 'valkyre-ranger-lv',
      'mead-range-level-slider', 0, 10, attackBasics.meadRangeLevel,
      'mead-range-level-value', 0, 10, attackBasics.meadRangeLevel
    )}
        ${generateInputCard(
      'Level of "Shield-maiden"', './img/attack-modal7.png', 'shield-maiden-lv',
      'mead-melee-level-slider', 0, 10, attackBasics.meadMeleeLevel,
      'mead-melee-level-value', 0, 10, attackBasics.meadMeleeLevel
    )}
        ${generateInputCard(
      'Level of "Glasswing Archer"', './img/attack-modal8.png', 'glasswing-archer-lv',
      'beef-range-level-slider', 0, 10, attackBasics.beefRangeLevel,
      'beef-range-level-value', 0, 10, attackBasics.beefRangeLevel
    )}
        ${generateInputCard(
      'Level of "Flamebreath Berserker"', './img/attack-modal9.png', 'flamebreath-berserker-lv',
      'beef-melee-level-slider', 0, 10, attackBasics.beefMeleeLevel,
      'beef-melee-level-value', 0, 10, attackBasics.beefMeleeLevel
    )}
        ${generateInputCard(
      'Level of "Scaleshard Marksman"', './img/attack-modal10.png', 'scaleshard-marksman-lv',
      'beef-veteran-range-level-slider', 0, 10, attackBasics.beefVeteranRangeLevel,
      'beef-veteran-range-level-value', 0, 10, attackBasics.beefVeteranRangeLevel
    )}
        ${generateInputCard(
      'Level of "Scalesbound Guardian"', './img/attack-modal11.png', 'scalesbound-guardian-lv',
      'beef-veteran-melee-level-slider', 0, 10, attackBasics.beefVeteranMeleeLevel,
      'beef-veteran-melee-level-value', 0, 10, attackBasics.beefVeteranMeleeLevel
    )}
    `,
    footer: `
        <button type="button" id="confirmBasics" class="btn btn-success btn-confirm">
          Confirm
        </button>
    `
  },
  //Commander stats modal
  {
    id: 'commanderStatsModal',
    title: 'Attack Stats',
    body: `
        ${generateInputCard(
      'Melee strength (%)', './img/melee-icon.png', 'melee-strength',
      'melee-strength-slider', 0, 1500, commanderStats.meleeStrength,
      'melee-strength-value', 0, 1500, commanderStats.meleeStrength
    )}
        ${generateInputCard(
      'Ranged strength (%)', './img/ranged-icon.png', 'ranged-strength',
      'ranged-strength-slider', 0, 1500, commanderStats.rangedStrength,
      'ranged-strength-value', 0, 1500, commanderStats.rangedStrength
    )}
        ${generateInputCard(
      'Combat strength (%)', './img/universal-icon.png', 'universal-strength',
      'universal-strength-slider', 0, 100, commanderStats.combatStrength,
      'universal-strength-value', 0, 100, commanderStats.combatStrength
    )}
        ${generateInputCard(
      'Courtyard strength (%)', './img/cy-icon.png', 'courtyard-strength',
      'courtyard-strength-slider', 0, 1500, commanderStats.courtyardStrength,
      'courtyard-strength-value', 0, 1500, commanderStats.courtyardStrength
    )}
        ${generateInputCard(
      'Wall reduction (%)', './img/commander-modal1.png', 'wall-reduction',
      'wall-reduction-slider', 0, 310, commanderStats.wallReduction,
      'wall-reduction-value', 0, 310, commanderStats.wallReduction
    )}
        ${generateInputCard(
      'Moat reduction (%)', './img/commander-modal2.png', 'moat-reduction',
      'moat-reduction-slider', 0, 210, commanderStats.moatReduction,
      'moat-reduction-value', 0, 210, commanderStats.moatReduction
    )}
        ${generateInputCard(
      'Gate reduction (%)', './img/commander-modal3.png', 'gate-reduction',
      'gate-reduction-slider', 0, 310, commanderStats.gateReduction,
      'gate-reduction-value', 0, 310, commanderStats.gateReduction
    )}
        ${generateInputCard(
      'Mead unit strength', './img/commander-modal4.png', 'mead-unit-strength',
      'mead-unit-strength-slider', 0, 20, commanderStats.meadUnitStrength,
      'mead-unit-strength-value', 0, 30, commanderStats.meadUnitStrength
    )}
        ${generateInputCard(
      'Horror unit strength', './img/commander-modal5.png', 'horror-unit-strength',
      'horror-unit-strength-slider', 0, 40, commanderStats.horrorUnitStrength,
      'horror-unit-strength-value', 0, 40, commanderStats.horrorUnitStrength
    )}
        ${generateInputCard(
      'HoL melee strength (%)', './img/melee-icon.png', 'hol-melee-strength',
      'hol-melee-strength-slider', 0, 13, commanderStats.holMeleeStrength,
      'hol-melee-strength-value', 0, 13, commanderStats.holMeleeStrength
    )}
        ${generateInputCard(
      'HoL ranged strength (%)', './img/ranged-icon.png', 'hol-ranged-strength',
      'hol-ranged-strength-slider', 0, 13, commanderStats.holRangedStrength,
      'hol-ranged-strength-value', 0, 13, commanderStats.holRangedStrength
    )}
        ${generateInputCard(
      'HoL combat strength (%)', './img/universal-icon.png', 'hol-universal-strength',
      'hol-universal-strength-slider', 0, 12, commanderStats.holCombatStrength,
      'hol-universal-strength-value', 0, 12, commanderStats.holCombatStrength
    )}
        ${generateInputCard(
      'Strength in front (%)', './img/front-strength.png', 'front-strength',
      'front-strength-slider', 0, 200, commanderStats.strengthInFront,
      'front-strength-value', 0, 200, commanderStats.strengthInFront
    )}
        ${generateInputCard(
      'Strength in flanks (%)', './img/flanks-strength.png', 'flanks-strength',
      'flanks-strength-slider', 0, 200, commanderStats.strengthInFlanks,
      'flanks-strength-value', 0, 200, commanderStats.strengthInFlanks
    )}
    `,
    footer: `
        <button type="button" id="confirmCommanderStats" class="btn btn-success btn-confirm">
          Confirm
        </button>
    `
  },
  //Castellan stats modal
  {
    id: 'castellanStatsModal',
    title: 'Defense Stats',
    body: `
      ${generateInputCard(
      'Melee strength (%)', './img/castellan-modal1.png', 'melee-strength',
      'defense-melee-strength-slider', 100, 500, castellanStats.meleeStrength,
      'defense-melee-strength-value', 0, 500, castellanStats.meleeStrength
    )}
      ${generateInputCard(
      'Ranged strength (%)', './img/castellan-modal2.png', 'ranged-strength',
      'defense-ranged-strength-slider', 100, 500, castellanStats.rangedStrength,
      'defense-ranged-strength-value', 0, 500, castellanStats.rangedStrength
    )}
      ${generateInputCard(
      'Courtyard strength (%)', './img/cy-icon.png', 'courtyard-strength',
      'defense-courtyard-strength-slider', 0, 600, castellanStats.courtyardStrength,
      'defense-courtyard-strength-value', 0, 600, castellanStats.courtyardStrength
    )}
      ${generateInputCard(
      'Wall unit limit', './img/castellan-modal3.png', 'wall-unit-limit',
      'wall-unit-limit-slider', 100, 30000, castellanStats.wallUnitLimit,
      'wall-unit-limit-value', 100, 30000, castellanStats.wallUnitLimit
    )}
      ${generateInputCard(
      'Courtyard unit limit', './img/attack-modal4.png', 'cy-unit-limit',
      'cy-unit-limit-slider', 10000, 999999, castellanStats.cyUnitLimit,
      'cy-unit-limit-value', 10000, 999999, castellanStats.cyUnitLimit
    )}
      ${generateInputCard(
      'Wall protection (%)', './img/castellan-modal4.png', 'wall-protection',
      'defense-wall-protection-slider', 0, 480, castellanStats.wallProtection,
      'defense-wall-protection-value', 0, 480, castellanStats.wallProtection
    )}
      ${generateInputCard(
      'Moat protection (%)', './img/castellan-modal5.png', 'moat-protection',
      'defense-moat-protection-slider', 0, 260, castellanStats.moatProtection,
      'defense-moat-protection-value', 0, 260, castellanStats.moatProtection
    )}
      ${generateInputCard(
      'Gate protection (%)', './img/castellan-modal6.png', 'gate-protection',
      'defense-gate-protection-slider', 0, 480, castellanStats.gateProtection,
      'defense-gate-protection-value', 0, 480, castellanStats.gateProtection
    )}
  `,
    footer: `
      <button type="button" id="confirmCastellanStats" class="btn btn-success btn-confirm">
        Confirm
      </button>
  `
  }
];