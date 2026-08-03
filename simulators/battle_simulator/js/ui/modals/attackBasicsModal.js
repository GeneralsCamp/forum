import { bindSlider, bindConfirmButton } from './modalUtils.js';
import { attackBasics, currentSide, BASE_WAVE_MIN, BASE_WAVE_MAX } from '../../data/variables.js';
import { switchSide } from '../uiWaves.js';
import { writeStoredJson } from '../../data/storage.js';

export function openBasicsModal() {
  const modalEl = document.getElementById('basicsModal');
  const modal = new bootstrap.Modal(modalEl);
  const sliders = [
    { sliderId: 'waves-slider', valueId: 'waves-value', value: attackBasics.maxWaves, min: BASE_WAVE_MIN, max: BASE_WAVE_MAX },
    { sliderId: 'front-unit-slider', valueId: 'front-unit-value', value: attackBasics.maxUnits.front, min: 192, max: 10000 },
    { sliderId: 'flank-unit-slider', valueId: 'flank-unit-value', value: attackBasics.maxUnits.left, min: 64, max: 5000 },
    { sliderId: 'courtyard-unit-slider', valueId: 'courtyard-unit-value', value: attackBasics.maxUnitsCY, min: 2089, max: 10000 },
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
    switchSide(currentSide);
    writeStoredJson('attackBasics', attackBasics);
  });

  modal.show();
}
