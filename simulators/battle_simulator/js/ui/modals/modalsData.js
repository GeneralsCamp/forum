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
        <div class="preset-modal-content">
          <div class="wave-navigation mb-2" id="waveNavigation">
              <button class="nav-btn" id="prevWaveBtn">&#9664;</button>
              <span id="currentWaveText">Wave 1 / X</span>
              <button class="nav-btn" id="nextWaveBtn">&#9654;</button>
          </div>
          <div class="preset-list" id="presetList">
            ${[...Array(20)].map(
      (_, i) => `
                <div class="preset-item" data-preset="${i + 1}">
                    <input type="radio" name="preset" id="preset${i + 1}">
                    <label for="preset${i + 1}">&nbspPreset ${i + 1}</label>
                </div>
            `
    ).join('')}
          </div>
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
        <div class="defense-side-bar">
            <div class="defense-side-buttons">
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
            <span id="current-defense-flank">Front</span>
          </div>
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
      'front-unit-slider', 192, 10000, attackBasics.maxUnits.front,
      'front-unit-value', false
    )}
        ${generateInputCard(
      'Flank unit limit', '../../img_base/battle_simulator/attack-modal3.png', 'flank-unit-limit',
      'flank-unit-slider', 64, 5000, attackBasics.maxUnits.left,
      'flank-unit-value', false
    )}
        ${generateInputCard(
      'Courtyard unit limit', '../../img_base/battle_simulator/attack-modal4.png', 'courtyard-unit-limit',
      'courtyard-unit-slider', 2089, 10000, attackBasics.maxUnitsCY,
      'courtyard-unit-value', false
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
      'melee-strength-slider', 0, 5000, commanderStats.melee,
      'melee-strength-value', false
    )}
        ${generateInputCard(
      'Ranged strength (%)', '../../img_base/battle_simulator/ranged-icon.png', 'ranged-strength',
      'ranged-strength-slider', 0, 5000, commanderStats.ranged,
      'ranged-strength-value', false
    )}
        ${generateInputCard(
      'Combat strength (%)', '../../img_base/battle_simulator/universal-icon.png', 'universal-strength',
      'universal-strength-slider', 0, 1000, commanderStats.universal,
      'universal-strength-value', false
    )}
        ${generateInputCard(
      'Strength in front (%)', '../../img_base/battle_simulator/front-strength.png', 'front-strength',
      'front-strength-slider', 0, 5000, commanderStats.frontStrength,
      'front-strength-value', false
    )}
        ${generateInputCard(
      'Strength in flanks (%)', '../../img_base/battle_simulator/flanks-strength.png', 'flanks-strength',
      'flanks-strength-slider', 0, 5000, commanderStats.flanksStrength,
      'flanks-strength-value', false
    )}
        ${generateInputCard(
      'Courtyard strength (%)', '../../img_base/battle_simulator/cy-icon.png', 'courtyard-strength',
      'courtyard-strength-slider', 0, 5000, commanderStats.courtyard,
      'courtyard-strength-value', false
    )}
        ${generateInputCard(
      'Wall reduction (%)', '../../img_base/battle_simulator/commander-modal1.png', 'wall-reduction',
      'wall-reduction-slider', 0, 2500, commanderStats.wallReduction,
      'wall-reduction-value', false
    )}
        ${generateInputCard(
      'Moat reduction (%)', '../../img_base/battle_simulator/commander-modal2.png', 'moat-reduction',
      'moat-reduction-slider', 0, 2500, commanderStats.moatReduction,
      'moat-reduction-value', false
    )}
        ${generateInputCard(
      'Gate reduction (%)', '../../img_base/battle_simulator/commander-modal3.png', 'gate-reduction',
      'gate-reduction-slider', 0, 2500, commanderStats.gateReduction,
      'gate-reduction-value', false
    )}
        ${generateInputCard(
      'Beef unit strength', '../../img_base/beefwastage.png', 'beef-unit-strength',
      'beef-unit-strength-slider', 0, 55, commanderStats.beefStrength,
      'beef-unit-strength-value'
    )}
        ${generateInputCard(
      'Mead unit strength', '../../img_base/main_page/mead-icon.webp', 'mead-unit-strength',
      'mead-unit-strength-slider', 0, 55, commanderStats.meadStrength,
      'mead-unit-strength-value'
    )}
        ${generateInputCard(
      'Horror unit strength', '../../img_base/battle_simulator/commander-modal5.png', 'horror-unit-strength',
      'horror-unit-strength-slider', 0, 40, commanderStats.horrorStrength,
      'horror-unit-strength-value'
    )}
        ${generateInputCard(
      'HoL melee strength (%)', '../../img_base/battle_simulator/melee-icon.png', 'hol-melee-strength',
      'hol-melee-strength-slider', 0, 13, commanderStats.holMelee,
      'hol-melee-strength-value'
    )}
        ${generateInputCard(
      'HoL ranged strength (%)', '../../img_base/battle_simulator/ranged-icon.png', 'hol-ranged-strength',
      'hol-ranged-strength-slider', 0, 13, commanderStats.holRanged,
      'hol-ranged-strength-value'
    )}
        ${generateInputCard(
      'HoL combat strength (%)', '../../img_base/battle_simulator/universal-icon.png', 'hol-universal-strength',
      'hol-universal-strength-slider', 0, 12, commanderStats.holUniversal,
      'hol-universal-strength-value'
    )}
        ${generateInputCard(
      'Valkyrie ranger support', '../../img_base/battle_simulator/unknown.png', 'final-assault-ranged-units',
      'final-assault-ranged-units-slider', 0, 1500, commanderStats.finalAssaultRangedUnits,
      'final-assault-ranged-units-value'
    )}
        ${generateInputCard(
      'Shield-maiden support', '../../img_base/battle_simulator/unknown.png', 'final-assault-shield-maidens',
      'final-assault-shield-maidens-slider', 0, 1050, commanderStats.finalAssaultShieldMaidens,
      'final-assault-shield-maidens-value'
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
      'defense-melee-strength-slider', 0, 10000, castellanStats.melee,
      'defense-melee-strength-value', false
    )}
      ${generateInputCard(
      'Ranged strength (%)', '../../img_base/battle_simulator/castellan-modal2.png', 'ranged-strength',
      'defense-ranged-strength-slider', 0, 10000, castellanStats.ranged,
      'defense-ranged-strength-value', false
    )}
      ${generateInputCard(
      'Combat strength (%)', '../../img_base/battle_simulator/combatStrengthDefense-icon.png', 'defense-universal-strength',
      'defense-universal-strength-slider', 0, 500, castellanStats.universal,
      'defense-universal-strength-value', false
    )}
      ${generateInputCard(
      'Strength in front (%)', '../../img_base/battle_simulator/front-strength.png', 'defense-front-strength',
      'defense-front-strength-slider', 0, 20000, castellanStats.frontStrength,
      'defense-front-strength-value', false
    )}
      ${generateInputCard(
      'Strength in flanks (%)', '../../img_base/battle_simulator/flanks-strength.png', 'defense-flanks-strength',
      'defense-flanks-strength-slider', 0, 20000, castellanStats.flanksStrength,
      'defense-flanks-strength-value', false
    )}
      ${generateInputCard(
      'Courtyard strength (%)', '../../img_base/battle_simulator/cy-icon.png', 'courtyard-strength',
      'defense-courtyard-strength-slider', 0, 10000, castellanStats.courtyard,
      'defense-courtyard-strength-value', false
    )}
      ${generateInputCard(
      'Wall unit limit', '../../img_base/battle_simulator/castellan-modal3.png', 'wall-unit-limit',
      'wall-unit-limit-slider', 100, 50000, castellanStats.wallUnitLimit,
      'wall-unit-limit-value', false
    )}
      ${generateInputCard(
      'Courtyard unit limit', '../../img_base/battle_simulator/attack-modal4.png', 'cy-unit-limit',
      'cy-unit-limit-slider', 100, 5000000, castellanStats.cyUnitLimit,
      'cy-unit-limit-value', false
    )}
      ${generateInputCard(
      'Wall protection (%)', '../../img_base/battle_simulator/castellan-modal4.png', 'wall-protection',
      'defense-wall-protection-slider', 0, 20000, castellanStats.wallProtection,
      'defense-wall-protection-value', false
    )}
      ${generateInputCard(
      'Moat protection (%)', '../../img_base/battle_simulator/castellan-modal5.png', 'moat-protection',
      'defense-moat-protection-slider', 0, 20000, castellanStats.moatProtection,
      'defense-moat-protection-value', false
    )}
      ${generateInputCard(
      'Gate protection (%)', '../../img_base/battle_simulator/castellan-modal6.png', 'gate-protection',
      'defense-gate-protection-slider', 0, 20000, castellanStats.gateProtection,
      'defense-gate-protection-value', false
    )}
      ${generateInputCard(
      'HoL melee strength (%)', '../../img_base/battle_simulator/castellan-modal1.png', 'defense-hol-melee-strength',
      'defense-hol-melee-strength-slider', 0, 13, castellanStats.holMelee,
      'defense-hol-melee-strength-value'
    )}
      ${generateInputCard(
      'HoL ranged strength (%)', '../../img_base/battle_simulator/castellan-modal2.png', 'defense-hol-ranged-strength',
      'defense-hol-ranged-strength-slider', 0, 13, castellanStats.holRanged,
      'defense-hol-ranged-strength-value'
    )}
      ${generateInputCard(
      'HoL combat strength (%)', '../../img_base/battle_simulator/combatStrengthDefense-icon.png', 'defense-hol-universal-strength',
      'defense-hol-universal-strength-slider', 0, 12, castellanStats.holUniversal,
      'defense-hol-universal-strength-value'
    )}
      ${generateInputCard(
      'Valkyrie sniper support', '../../img_base/battle_simulator/unknown.png', 'courtyard-valkyrie-support',
      'courtyard-valkyrie-support-slider', 0, 15000, castellanStats.courtyardValkyrieSupport,
      'courtyard-valkyrie-support-value'
    )}
  `,
    footer: `
      <button type="button" id="confirmCastellanStats" class="btn btn-success btn-confirm">
        Confirm
      </button>
  `
  }
];
