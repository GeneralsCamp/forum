import { loadData } from './data/dataLoader.js';
import { generateWaves, switchSide, openAllWaves } from './ui/uiWaves.js';
import { attackBasics, commanderStats, castellanStats } from './data/variables.js';
import { openCommanderStatsModal } from './ui/modals/commanderStatsModal.js';
import { openBasicsModal } from './ui/modals/attackBasicsModal.js';
import { openDefenseBasicsModal } from './ui/modals/defenseBasicsModal.js';
import { openCastellanStatsModal } from './ui/modals/castellanStatsModal.js';
import { openWaveCopyModal } from './ui/wavePresets.js';
import { battleSimulation } from './ui/uiBattleReport.js';

window.addEventListener('load', () => {
  const savedCommanderStats = localStorage.getItem('commanderStats');
  const savedCastellanStats = localStorage.getItem('castellanStats');
  const savedAttackBasics = localStorage.getItem('attackBasics');

  if (savedCommanderStats) Object.assign(commanderStats, JSON.parse(savedCommanderStats));
  if (savedCastellanStats) Object.assign(castellanStats, JSON.parse(savedCastellanStats));
  if (savedAttackBasics) Object.assign(attackBasics, JSON.parse(savedAttackBasics));

  ['meadRangeLevel', 'meadMeleeLevel', 'beefRangeLevel', 'beefMeleeLevel', 'beefVeteranRangeLevel', 'beefVeteranMeleeLevel']
    .forEach(level => attackBasics[level] = attackBasics[level] || 10);

  document.querySelectorAll('.flanks-button.sides').forEach(button =>
    button.addEventListener('click', () => switchSide(button.dataset.section))
  );

  switchSide('front');

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

  document.querySelector('.openAllWaves-button')?.addEventListener('click', openAllWaves);
  document.querySelector('.flanks-button.red-button')?.addEventListener('click', battleSimulation);
  document.querySelector('.preset-button')?.addEventListener('click', openWaveCopyModal);

  loadData().then(() => {
    generateWaves('front', attackBasics.maxWaves);
  });
});
