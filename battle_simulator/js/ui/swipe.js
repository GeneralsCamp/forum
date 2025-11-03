//NOT USED YET
import { currentSide, currentSideReport, setCurrentSide } from '../data/variables.js';
import { switchDefenseSide } from './uiDefense.js';

let startX = 0;
let startY = 0;

export function addSwipeListener(element, { onSwipeLeft, onSwipeRight, threshold = 50, verticalTolerance = 30 }) {
  if (!element) return;

  let startX = 0;
  let startY = 0;

  function start(e) {
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
  }

  function end(e) {
    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    if (Math.abs(deltaX) > threshold && Math.abs(deltaY) < verticalTolerance) {
      if (deltaX > 0) onSwipeRight?.();
      else onSwipeLeft?.();
    }
  }

  element.addEventListener('touchstart', start);
  element.addEventListener('touchend', end);
  element.addEventListener('mousedown', start);
  element.addEventListener('mouseup', end);
}


export function initWaveSwipe() {
  const waveContainer = document.getElementById('wave-container');
  addSwipeListener(waveContainer, {
    onSwipeLeft: switchToNextWave,
    onSwipeRight: switchToPreviousWave
  });
}

const sides = ['left', 'front', 'right'];

function switchToPreviousWave() {
  const currentIndex = sides.indexOf(currentSide);
  const newIndex = (currentIndex - 1 + sides.length) % sides.length;
  setCurrentSide(sides[newIndex]);
  switchDefenseSide(sides[newIndex]);
}

function switchToNextWave() {
  const currentIndex = sides.indexOf(currentSide);
  const newIndex = (currentIndex + 1) % sides.length;
  setCurrentSide(sides[newIndex]);
  switchDefenseSide(sides[newIndex]);
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
    currentSideReport = reportSides[newIndex];
    switchReportSide(reportSides[newIndex]);
  }
}

export function initPresetSwipe(containerId, changeWaveCallback) {
  const container = document.getElementById(containerId);
  addSwipeListener(container, {
    onSwipeLeft: () => changeWaveCallback(1),
    onSwipeRight: () => changeWaveCallback(-1)
  });
}
