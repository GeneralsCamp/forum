import { loadData } from './data/dataLoader.js';
import { generateWaves, switchSide, openAllWaves } from './ui/uiWaves.js';
import { attackBasics, commanderStats, castellanStats, currentSide, attackGeneralAbilities, defenseGeneralAbilities, unitLevels, getEffectiveWaveCount, getBaseWaveCount } from './data/variables.js';
import { openCommanderStatsModal } from './ui/modals/commanderStatsModal.js';
import { openBasicsModal } from './ui/modals/attackBasicsModal.js';
import { openDefenseBasicsModal } from './ui/modals/defenseBasicsModal.js';
import { openCastellanStatsModal } from './ui/modals/castellanStatsModal.js';
import { openWaveCopyModal } from './ui/wavePresets.js';
import { battleSimulation } from './ui/uiBattleReport.js';
import { openAttackGeneralModal } from './ui/modals/attackGeneralModal.js';
import { openDefenseGeneralModal } from './ui/modals/defenseGeneralModal.js';
import { readStoredJson } from './data/storage.js';
import { openBattleCatalogModal } from './ui/modals/battleCatalogModal.js';

const OPEN_BETA_ACKNOWLEDGEMENT_KEY = 'battleSimulatorOpenBetaAcknowledged';

function showOpenBetaModal() {
  if (localStorage.getItem(OPEN_BETA_ACKNOWLEDGEMENT_KEY) === 'true') return;
  const modalElement = document.getElementById('openBetaModal');
  const confirmButton = document.getElementById('confirmOpenBeta');
  if (!modalElement || !confirmButton) return;
  const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
  confirmButton.onclick = () => {
    localStorage.setItem(OPEN_BETA_ACKNOWLEDGEMENT_KEY, 'true');
    modal.hide();
  };
  modal.show();
}

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function syncFullscreenButton() {
  document.querySelector('.fullscreen-button')?.classList.toggle('active', Boolean(getFullscreenElement()));
}

async function toggleFullscreen() {
  try {
    if (getFullscreenElement()) {
      const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
      await exitFullscreen?.call(document);
    } else {
      const page = document.documentElement;
      const requestFullscreen = page.requestFullscreen || page.webkitRequestFullscreen;
      await requestFullscreen?.call(page);
    }
  } catch (_) {
    syncFullscreenButton();
  }
}

window.addEventListener('load', () => {
  showOpenBetaModal();
  const savedCommanderStats = readStoredJson('commanderStats');
  const savedCastellanStats = readStoredJson('castellanStats');
  const savedAttackBasics = readStoredJson('attackBasics');
  const savedAttackGeneralAbilities = readStoredJson('attackGeneralAbilities');
  const savedDefenseGeneralAbilities = readStoredJson('defenseGeneralAbilities');
  const savedUnitLevels = readStoredJson('battleUnitLevels');

  if (savedCommanderStats) Object.assign(commanderStats, savedCommanderStats);
  if (savedCastellanStats) Object.assign(castellanStats, savedCastellanStats);
  if (savedAttackBasics) Object.assign(attackBasics, savedAttackBasics);
  attackBasics.maxWaves = getBaseWaveCount();
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

  document.querySelectorAll('.general-bg1').forEach(btn =>
    btn.addEventListener('click', openAttackGeneralModal)
  );
  document.querySelectorAll('.general-bg2').forEach(btn =>
    btn.addEventListener('click', openDefenseGeneralModal)
  );

  document.querySelectorAll('.flanks-button.sides').forEach(btn => btn.addEventListener('click', () => switchSide(btn.dataset.section)));
  document.querySelector('.fullscreen-button')?.addEventListener('click', toggleFullscreen);
  document.querySelector('.openAllWaves-button')?.addEventListener('click', openAllWaves);
  document.querySelector('.flanks-button.red-button')?.addEventListener('click', battleSimulation);
  document.querySelector('.preset-button')?.addEventListener('click', openWaveCopyModal);
  document.querySelector('.catalog-button')?.addEventListener('click', openBattleCatalogModal);

  loadData().then(() => {

    generateWaves('front', getEffectiveWaveCount());
    switchSide(currentSide);
  });
});

document.addEventListener('fullscreenchange', syncFullscreenButton);
document.addEventListener('webkitfullscreenchange', syncFullscreenButton);
