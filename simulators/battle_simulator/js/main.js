import { loadData } from './data/dataLoader.js';
import { generateWaves, switchSide, openAllWaves } from './ui/uiWaves.js';
import { attackBasics, commanderStats, castellanStats, currentSide, attackGeneralAbilities, defenseGeneralAbilities, unitLevels } from './data/variables.js';
import { openCommanderStatsModal } from './ui/modals/commanderStatsModal.js';
import { openBasicsModal } from './ui/modals/attackBasicsModal.js';
import { openDefenseBasicsModal } from './ui/modals/defenseBasicsModal.js';
import { openCastellanStatsModal } from './ui/modals/castellanStatsModal.js';
import { openWaveCopyModal } from './ui/wavePresets.js';
import { battleSimulation } from './ui/uiBattleReport.js';
import { openAttackGeneralModal } from './ui/modals/attackGeneralModal.js';
import { openDefenseGeneralModal } from './ui/modals/defenseGeneralModal.js';
import { readStoredJson } from './data/storage.js';

window.addEventListener('load', () => {
  const savedCommanderStats = readStoredJson('commanderStats');
  const savedCastellanStats = readStoredJson('castellanStats');
  const savedAttackBasics = readStoredJson('attackBasics');
  const savedAttackGeneralAbilities = readStoredJson('attackGeneralAbilities');
  const savedDefenseGeneralAbilities = readStoredJson('defenseGeneralAbilities');
  const savedUnitLevels = readStoredJson('battleUnitLevels');

  if (savedCommanderStats) Object.assign(commanderStats, savedCommanderStats);
  if (savedCastellanStats) Object.assign(castellanStats, savedCastellanStats);
  if (savedAttackBasics) Object.assign(attackBasics, savedAttackBasics);
  if (savedAttackGeneralAbilities) Object.assign(attackGeneralAbilities, savedAttackGeneralAbilities);
  if (savedDefenseGeneralAbilities) Object.assign(defenseGeneralAbilities, savedDefenseGeneralAbilities);
  if (savedUnitLevels) Object.assign(unitLevels, savedUnitLevels);

  document.querySelectorAll('.card-header button').forEach(button =>
    button.addEventListener('click', e => {
      const cardHeader = e.target.closest('.card-header');
      const isCollapsed = e.target.classList.contains('collapsed');
      cardHeader.classList.toggle('collapsed', !isCollapsed);
    })
  );

  [
    { selector: '.commander', fn: openCommanderStatsModal },
    { selector: '.attack-basics', fn: openBasicsModal },
    { selector: '.defense-basics', fn: openDefenseBasicsModal },
    { selector: '.castellan', fn: openCastellanStatsModal }
  ].forEach(({ selector, fn }) => {
    document.querySelectorAll(selector).forEach(btn =>
      btn.addEventListener('click', fn)
    );
  });

  document.querySelectorAll('.general-bg1, .general-img').forEach(btn =>
    btn.addEventListener('click', openAttackGeneralModal)
  );
  document.querySelectorAll('.general-bg2, .enemy-img').forEach(btn =>
    btn.addEventListener('click', openDefenseGeneralModal)
  );

  document.querySelectorAll('.flanks-button.sides').forEach(btn => btn.addEventListener('click', () => switchSide(btn.dataset.section)));
  document.querySelector('.openAllWaves-button')?.addEventListener('click', openAllWaves);
  document.querySelector('.flanks-button.red-button')?.addEventListener('click', battleSimulation);
  document.querySelector('.preset-button')?.addEventListener('click', openWaveCopyModal);

  loadData().then(() => {

    generateWaves('front', attackBasics.maxWaves);
    switchSide(currentSide);
  });
});
