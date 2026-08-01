import { generateInputCard } from './modalGenerator.js';
import { attackBasics, commanderStats, castellanStats, BASE_WAVE_MIN, BASE_WAVE_MAX } from '../../data/variables.js';

export const modalsData = [
  {
    id: 'battleCatalogModal',
    title: 'Custom Setup',
    body: `
      <div class="battle-catalog-editor">
        <div class="catalog-filter-row">
          <select id="battle-catalog-side" class="report-view-select" aria-label="Army side">
            <option value="attack">Attack</option>
            <option value="defense">Defense</option>
          </select>
          <select id="battle-catalog-kind" class="report-view-select" aria-label="Catalog type">
            <option value="units">Troops</option>
            <option value="tools">Tools</option>
          </select>
        </div>
        <div class="catalog-custom-row">
          <input id="catalog-custom-id" inputmode="numeric" placeholder="WOD ID" aria-label="WOD ID">
          <button type="button" id="catalog-load-id" class="catalog-action">LOAD BY ID</button>
        </div>
        <div id="battle-catalog-list" class="catalog-entry-list"></div>
      </div>
    `,
    footer: `<button type="button" id="confirmBattleCatalog" class="btn btn-success btn-confirm">Confirm</button>`
  },
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
        <div class="preset-list" id="presetList">
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
    <button class="btn btn-clear" id="clearWaveBtn">
        <span>CLEAR</span>
    </button>
    <button class="btn btn-save" id="savePresetBtn">
        <span>SAVE</span>
    </button>
    <button class="btn btn-apply" id="applyPresetBtn">
        <span>APPLY</span>
    </button>
    <button class="btn btn-apply-all" id="applyPresetAllBtn">
        <span>APPLY TO ALL</span>
    </button>
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
                    <img src="../../img_base/battle_simulator/left-icon.webp" alt="L">
                </button>
                <button class="btn flanks-button-defense sides active" data-section="front">
                    <img src="../../img_base/battle_simulator/front-icon.webp" alt="F">
                </button>
                <button class="btn flanks-button-defense sides" data-section="right">
                    <img src="../../img_base/battle_simulator/right-icon.webp" alt="R">
                </button>
                <button class="btn flanks-button-defense sides" data-section="cy">
                    <img src="../../img_base/battle_simulator/cy-icon.webp" alt="CY">
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
                    <div class="unit-distribution-balance">
                        <div class="unit-distribution-strengths">
                            <div class="unit-distribution-strength">
                                <img src="../../img_base/battle_simulator/castellan-modal1.png" alt="Melee defense">
                                <span id="leftPercentage" class="selector-value">0%</span>
                            </div>
                            <div class="unit-distribution-strength">
                                <img src="../../img_base/battle_simulator/castellan-modal2.png" alt="Ranged defense">
                                <span id="rightPercentage" class="selector-value">0%</span>
                            </div>
                        </div>
                        <input type="range" id="defenseStrengthSlider" min="0" max="100" value="0" class="wave-editor-range" disabled />
                    </div>
                    <div class="unit-distribution-sides">
                        <div class="unit-distribution-side flank-side">
                            <span class="unit-distributon-modal-side">Left flank</span>
                            <div class="unit-distribution-side-value">
                                <img src="../../img_base/battle_simulator/wall-icon.png" alt="Left flank">
                                <span class="unit-distributon-modal-value" id="leftFlank">X%</span>
                            </div>
                        </div>
                        <div class="unit-distribution-side front-side">
                            <span class="unit-distributon-modal-side">Front</span>
                            <div class="unit-distribution-side-value">
                                <img src="../../img_base/battle_simulator/gate-icon.png" alt="Front">
                                <span class="unit-distributon-modal-value" id="front">X%</span>
                            </div>
                        </div>
                        <div class="unit-distribution-side flank-side">
                            <span class="unit-distributon-modal-side">Right flank</span>
                            <div class="unit-distribution-side-value">
                                <img src="../../img_base/battle_simulator/wall-icon.png" alt="Right flank">
                                <span class="unit-distributon-modal-value" id="rightFlank">X%</span>
                            </div>
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
  //Attack general modal
  {
    id: 'attackGeneralModal',
    title: 'Attack General',
    body: `
      <div class="general-loadout-root" data-general-mode="attack"></div>
    `,
    footer: `<button type="button" id="confirmAttackGeneral" class="btn btn-success btn-confirm">Confirm</button>`
  },
  //Defense general modal
  {
    id: 'defenseGeneralModal',
    title: 'Defense General',
    body: `
      <div class="general-loadout-root" data-general-mode="defense"></div>
    `,
    footer: `<button type="button" id="confirmDefenseGeneral" class="btn btn-success btn-confirm">Confirm</button>`
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
    title: 'Support tools',
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
      'Waves', '../../img_base/battle_simulator/attack-modal1.png', 'wave',
      'waves-slider', BASE_WAVE_MIN, BASE_WAVE_MAX, attackBasics.maxWaves,
      'waves-value', BASE_WAVE_MIN, BASE_WAVE_MAX, attackBasics.maxWaves
    )}
        ${generateInputCard(
      'Front unit limit', '../../img_base/battle_simulator/attack-modal2.png', 'front-unit-limit',
      'front-unit-slider', 192, 1600, attackBasics.maxUnits.front,
      'front-unit-value', 192, 1600, attackBasics.maxUnits.front
    )}
        ${generateInputCard(
      'Flank unit limit', '../../img_base/battle_simulator/attack-modal3.png', 'flank-unit-limit',
      'flank-unit-slider', 64, 800, attackBasics.maxUnits.left,
      'flank-unit-value', 64, 800, attackBasics.maxUnits.left
    )}
        ${generateInputCard(
      'Courtyard unit limit', '../../img_base/battle_simulator/attack-modal4.png', 'courtyard-unit-limit',
      'courtyard-unit-slider', 2089, 6000, attackBasics.maxUnitsCY,
      'courtyard-unit-value', 2089, 6000, attackBasics.maxUnitsCY
    )}
        ${generateInputCard(
      'Flank tool limit', '../../img_base/battle_simulator/attack-modal5.png', 'flank-tool-limit',
      'flank-tool-slider', 40, 50, attackBasics.maxTools.left,
      'flank-tool-value', 40, 50, attackBasics.maxTools.left
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
      'Melee strength (%)', '../../img_base/battle_simulator/melee-icon.png', 'melee-strength',
      'melee-strength-slider', 0, 1500, commanderStats.meleeStrength,
      'melee-strength-value', 0, 1500, commanderStats.meleeStrength
    )}
        ${generateInputCard(
      'Ranged strength (%)', '../../img_base/battle_simulator/ranged-icon.png', 'ranged-strength',
      'ranged-strength-slider', 0, 1500, commanderStats.rangedStrength,
      'ranged-strength-value', 0, 1500, commanderStats.rangedStrength
    )}
        ${generateInputCard(
      'Combat strength (%)', '../../img_base/battle_simulator/universal-icon.png', 'universal-strength',
      'universal-strength-slider', 0, 100, commanderStats.combatStrength,
      'universal-strength-value', 0, 100, commanderStats.combatStrength
    )}
        ${generateInputCard(
      'Courtyard strength (%)', '../../img_base/battle_simulator/cy-icon.png', 'courtyard-strength',
      'courtyard-strength-slider', 0, 1500, commanderStats.courtyardStrength,
      'courtyard-strength-value', 0, 1500, commanderStats.courtyardStrength
    )}
        ${generateInputCard(
      'Wall reduction (%)', '../../img_base/battle_simulator/commander-modal1.png', 'wall-reduction',
      'wall-reduction-slider', 0, 410, commanderStats.wallReduction,
      'wall-reduction-value', 0, 410, commanderStats.wallReduction
    )}
        ${generateInputCard(
      'Moat reduction (%)', '../../img_base/battle_simulator/commander-modal2.png', 'moat-reduction',
      'moat-reduction-slider', 0, 210, commanderStats.moatReduction,
      'moat-reduction-value', 0, 210, commanderStats.moatReduction
    )}
        ${generateInputCard(
      'Gate reduction (%)', '../../img_base/battle_simulator/commander-modal3.png', 'gate-reduction',
      'gate-reduction-slider', 0, 410, commanderStats.gateReduction,
      'gate-reduction-value', 0, 410, commanderStats.gateReduction
    )}
        ${generateInputCard(
      'Mead unit strength', '../../img_base/battle_simulator/commander-modal4.png', 'mead-unit-strength',
      'mead-unit-strength-slider', 0, 20, commanderStats.meadUnitStrength,
      'mead-unit-strength-value', 0, 30, commanderStats.meadUnitStrength
    )}
        ${generateInputCard(
      'Horror unit strength', '../../img_base/battle_simulator/commander-modal5.png', 'horror-unit-strength',
      'horror-unit-strength-slider', 0, 40, commanderStats.horrorUnitStrength,
      'horror-unit-strength-value', 0, 40, commanderStats.horrorUnitStrength
    )}
        ${generateInputCard(
      'HoL melee strength (%)', '../../img_base/battle_simulator/melee-icon.png', 'hol-melee-strength',
      'hol-melee-strength-slider', 0, 13, commanderStats.holMeleeStrength,
      'hol-melee-strength-value', 0, 13, commanderStats.holMeleeStrength
    )}
        ${generateInputCard(
      'HoL ranged strength (%)', '../../img_base/battle_simulator/ranged-icon.png', 'hol-ranged-strength',
      'hol-ranged-strength-slider', 0, 13, commanderStats.holRangedStrength,
      'hol-ranged-strength-value', 0, 13, commanderStats.holRangedStrength
    )}
        ${generateInputCard(
      'HoL combat strength (%)', '../../img_base/battle_simulator/universal-icon.png', 'hol-universal-strength',
      'hol-universal-strength-slider', 0, 12, commanderStats.holCombatStrength,
      'hol-universal-strength-value', 0, 12, commanderStats.holCombatStrength
    )}
        ${generateInputCard(
      'Strength in front (%)', '../../img_base/battle_simulator/front-strength.png', 'front-strength',
      'front-strength-slider', 0, 200, commanderStats.strengthInFront,
      'front-strength-value', 0, 200, commanderStats.strengthInFront
    )}
        ${generateInputCard(
      'Strength in flanks (%)', '../../img_base/battle_simulator/flanks-strength.png', 'flanks-strength',
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
      'Melee strength (%)', '../../img_base/battle_simulator/castellan-modal1.png', 'melee-strength',
      'defense-melee-strength-slider', 0, 500, castellanStats.melee,
      'defense-melee-strength-value', 0, 500, castellanStats.melee
    )}
      ${generateInputCard(
      'Ranged strength (%)', '../../img_base/battle_simulator/castellan-modal2.png', 'ranged-strength',
      'defense-ranged-strength-slider', 0, 500, castellanStats.ranged,
      'defense-ranged-strength-value', 0, 500, castellanStats.ranged
    )}
      ${generateInputCard(
      'Courtyard strength (%)', '../../img_base/battle_simulator/cy-icon.png', 'courtyard-strength',
      'defense-courtyard-strength-slider', 0, 600, castellanStats.courtyardStrength,
      'defense-courtyard-strength-value', 0, 600, castellanStats.courtyardStrength
    )}
      ${generateInputCard(
      'Wall unit limit', '../../img_base/battle_simulator/castellan-modal3.png', 'wall-unit-limit',
      'wall-unit-limit-slider', 100, 50000, castellanStats.wallUnitLimit,
      'wall-unit-limit-value', 100, 50000, castellanStats.wallUnitLimit
    )}
      ${generateInputCard(
      'Courtyard unit limit', '../../img_base/battle_simulator/attack-modal4.png', 'cy-unit-limit',
      'cy-unit-limit-slider', 100, 5000000, castellanStats.cyUnitLimit,
      'cy-unit-limit-value', 100, 5000000, castellanStats.cyUnitLimit
    )}
      ${generateInputCard(
      'Wall protection (%)', '../../img_base/battle_simulator/castellan-modal4.png', 'wall-protection',
      'defense-wall-protection-slider', 0, 500, castellanStats.wallProtection,
      'defense-wall-protection-value', 0, 500, castellanStats.wallProtection
    )}
      ${generateInputCard(
      'Moat protection (%)', '../../img_base/battle_simulator/castellan-modal5.png', 'moat-protection',
      'defense-moat-protection-slider', 0, 400, castellanStats.moatProtection,
      'defense-moat-protection-value', 0, 400, castellanStats.moatProtection
    )}
      ${generateInputCard(
      'Gate protection (%)', '../../img_base/battle_simulator/castellan-modal6.png', 'gate-protection',
      'defense-gate-protection-slider', 0, 500, castellanStats.gateProtection,
      'defense-gate-protection-value', 0, 500, castellanStats.gateProtection
    )}
  `,
    footer: `
      <button type="button" id="confirmCastellanStats" class="btn btn-success btn-confirm">
        Confirm
      </button>
  `
  }
];
