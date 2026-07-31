export function bindSlider(sliderId, valueId, { value = 0, min = 0, max = 100, prefix = '' } = {}) {
  const slider = document.getElementById(sliderId);
  const valueEl = document.getElementById(valueId);
  if (!slider || !valueEl) return;

  const formatCurrentValue = v => (v < 0 ? `-${Math.abs(v)}` : `${prefix}${v}`);
  const card = slider.closest('.modal-card-body');
  const minusButton = card?.querySelector(`.modal-slider-minus[data-slider-id="${sliderId}"]`);
  const plusButton = card?.querySelector(`.modal-slider-plus[data-slider-id="${sliderId}"]`);
  const setValue = nextValue => {
    const parsed = Number.parseInt(nextValue, 10);
    const safeValue = Number.isFinite(parsed) ? parsed : min;
    const clampedValue = Math.max(min, Math.min(max, safeValue));
    slider.value = clampedValue;
    valueEl.textContent = `${formatCurrentValue(clampedValue)} / ${max}`;
    if (minusButton) minusButton.disabled = clampedValue <= min;
    if (plusButton) plusButton.disabled = clampedValue >= max;
  };

  slider.min = min;
  slider.max = max;
  setValue(value);

  slider.oninput = () => setValue(slider.value);

  if (minusButton) minusButton.onclick = () => setValue(Number(slider.value) - 1);
  if (plusButton) plusButton.onclick = () => setValue(Number(slider.value) + 1);
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
