export function bindSlider(sliderId, valueId, { value = 0, min = 0, max = 100, prefix = '+' } = {}) {
  const slider = document.getElementById(sliderId);
  const valueEl = document.getElementById(valueId);
  if (!slider || !valueEl) return;

  const formatValue = v => (v < 0 ? `-${Math.abs(v)}` : `${prefix}${v}`);

  slider.value = value;
  valueEl.value = value;
  valueEl.textContent = formatValue(value);

  slider.addEventListener('input', () => {
    valueEl.value = slider.value;
    valueEl.textContent = formatValue(slider.value);
  });

  valueEl.addEventListener('input', () => {
    let newValue = parseInt(valueEl.value);
    if (newValue > max) newValue = max;
    if (newValue < min) newValue = min;
    slider.value = newValue;
    valueEl.value = newValue;
    valueEl.textContent = formatValue(newValue);
  });
}

export function bindConfirmButton(buttonId, confirmValues, modal, onConfirm) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  btn.onclick = () => {
    confirmValues.forEach(({ sliderId, property, targetObject }) => {
      const slider = document.getElementById(sliderId);
      if (!slider) return;

      const keys = property.split('.');
      let target = targetObject;

      keys.forEach((key, idx) => {
        if (idx === keys.length - 1) {
          const value = parseInt(slider.value);

          if (key === 'left' && target['right'] !== undefined) {
            target['left'] = value;
            target['right'] = value;
          } else {
            target[key] = value;
          }
        } else {
          if (!target[key]) target[key] = {};
          target = target[key];
        }
      });
    });

    if (onConfirm) onConfirm();
    modal.hide();
  };
}
