import { currentSide, currentSideReport, setCurrentSide, setCurrentSideDefense, currentSideDefense, setCurrentSideReport } from '../data/variables.js';
import { switchDefenseSide } from './uiDefense.js';
import { switchSide } from './uiWaves.js';
import { switchReportSide } from './uiBattleReport.js';

export function addSwipeListener(element, { onSwipeLeft, onSwipeRight, threshold = 50, verticalTolerance = 30 }) {
  if (!element) return;

  let startX = 0;
  let startY = 0;

  function start(e) {
    if (!e.touches || e.touches.length === 0) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }

  function end(e) {
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const clientX = e.changedTouches[0].clientX;
    const clientY = e.changedTouches[0].clientY;

    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    if (Math.abs(deltaX) > threshold && Math.abs(deltaY) < verticalTolerance) {
      if (deltaX > 0) onSwipeRight?.();
      else onSwipeLeft?.();
    }
  }

  element.addEventListener('touchstart', start);
  element.addEventListener('touchend', end);
}

export function initWaveSwipe() {
  const waveContainer = document.querySelector('.scrollable-content');
  if (!waveContainer || waveContainer.dataset.swipeInit === 'true') return;
  waveContainer.dataset.swipeInit = 'true';

  addSwipeListener(waveContainer, {
    onSwipeLeft: () => {
      const next = getNextSide(currentSide);
      if (next) {
        setCurrentSide(next);
        switchSide(next);
      }
    },
    onSwipeRight: () => {
      const prev = getPreviousSide(currentSide);
      if (prev) {
        setCurrentSide(prev);
        switchSide(prev);
      }
    }
  });
}

function getNextSide(side) {
  switch (side) {
    case 'front': return 'left';
    case 'left': return 'right';
    case 'right': return 'front';
    default: return 'front';
  }
}

function getPreviousSide(side) {
  switch (side) {
    case 'front': return 'right';
    case 'right': return 'left';
    case 'left': return 'front';
    default: return 'front';
  }
}

export function initReportSwipe() {
  const reportContainer = document.getElementById('battle-modal');
  const reportSides = ['left', 'front', 'right', 'cy'];

  addSwipeListener(reportContainer, {
    onSwipeLeft: () => switchReport(1),
    onSwipeRight: () => switchReport(-1)
  });

  function switchReport(direction) {
    const currentIndex = reportSides.indexOf(currentSideReport);
    const newIndex = (currentIndex + direction + reportSides.length) % reportSides.length;
    setCurrentSideReport(reportSides[newIndex]);
    switchReportSide(reportSides[newIndex]);
  }
}

export function initPresetSwipe(containerId, changeWaveCallback) {
  const modal = document.getElementById(containerId);
  if (!modal) return;

  if (modal.dataset.swipeInit === 'true') return;
  modal.dataset.swipeInit = 'true';

  const swipeArea = modal.querySelector('.modal-body') || modal;

  addSwipeListener(swipeArea, {
    onSwipeLeft: () => changeWaveCallback(1),
    onSwipeRight: () => changeWaveCallback(-1)
  });
}

export function initDefenseSwipe() {
  const modalBody = document.querySelector('#defenseBasicsModal .modal-body');
  if (!modalBody || modalBody.dataset.swipeInit === 'true') return;
  modalBody.dataset.swipeInit = 'true';

  addSwipeListener(modalBody, {
    onSwipeLeft: () => {
      const next = getNextDefenseSide(currentSideDefense);
      if (next) {
        setCurrentSideDefense(next);
        switchDefenseSide(next);
      }
    },
    onSwipeRight: () => {
      const prev = getPreviousDefenseSide(currentSideDefense);
      if (prev) {
        setCurrentSideDefense(prev);
        switchDefenseSide(prev);
      }
    }
  });
}

function getNextDefenseSide(side) {
  switch (side) {
    case 'front': return 'right';
    case 'right': return 'cy';
    case 'cy': return 'left';
    case 'left': return 'front';
    default: return 'front';
  }
}

function getPreviousDefenseSide(side) {
  switch (side) {
    case 'front': return 'left';
    case 'left': return 'cy';
    case 'cy': return 'right';
    case 'right': return 'front';
    default: return 'front';
  }
}