import { bindSlider, bindConfirmButton } from './modalUtils.js';
import { attackBasics, currentSide, units } from '../../data/variables.js';
import { switchSide } from '../uiWaves.js';
import { loadData } from '../../data/dataLoader.js';
import { renderUnitLevelControls, saveUnitLevelControls } from './unitLevelControls.js';
import { writeStoredJson } from '../../data/storage.js';

export function openBasicsModal() {
  const modalEl = document.getElementById('basicsModal');
  const modal = new bootstrap.Modal(modalEl);
  renderUnitLevelControls('attack-unit-level-controls', units);

  const sliders = [
    { sliderId: 'waves-slider', valueId: 'waves-value', value: attackBasics.maxWaves, min: 4, max: 30 },
    { sliderId: 'front-unit-slider', valueId: 'front-unit-value', value: attackBasics.maxUnits.front, min: 192, max: 1600 },
    { sliderId: 'flank-unit-slider', valueId: 'flank-unit-value', value: attackBasics.maxUnits.left, min: 64, max: 800 },
    { sliderId: 'courtyard-unit-slider', valueId: 'courtyard-unit-value', value: attackBasics.maxUnitsCY, min: 2089, max: 6000 },
    { sliderId: 'flank-tool-slider', valueId: 'flank-tool-value', value: attackBasics.maxTools.left, min: 40, max: 50 }
  ];

  sliders.forEach(s => bindSlider(s.sliderId, s.valueId, { value: s.value, min: s.min, max: s.max }));

  const confirmValues = [
    { sliderId: 'waves-slider', property: 'maxWaves', targetObject: attackBasics },
    { sliderId: 'front-unit-slider', property: 'maxUnits.front', targetObject: attackBasics },
    { sliderId: 'flank-unit-slider', property: 'maxUnits.left', targetObject: attackBasics },
    { sliderId: 'courtyard-unit-slider', property: 'maxUnitsCY', targetObject: attackBasics },
    { sliderId: 'flank-tool-slider', property: 'maxTools.left', targetObject: attackBasics }
  ];

  bindConfirmButton('confirmBasics', confirmValues, modal, () => {
    saveUnitLevelControls('attack-unit-level-controls');
    loadData().then(() => switchSide(currentSide));
    writeStoredJson('attackBasics', attackBasics);
  });

  modal.show();
}
