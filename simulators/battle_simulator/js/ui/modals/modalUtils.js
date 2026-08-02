export function bindSlider(sliderId, valueId, {
  value = 0,
  min = 0,
  max = 100,
  prefix = '',
  step = 1,
  allowDecimal = false
} = {}) {
  const slider = document.getElementById(sliderId);
  const valueEl = document.getElementById(valueId);
  if (!slider || !valueEl) return;

  const formatNumber = v => (Number.isInteger(v) ? `${v}` : v.toFixed(1));
  const formatCurrentValue = v => (v < 0
    ? `-${formatNumber(Math.abs(v))}`
    : `${prefix}${formatNumber(v)}`);
  const card = slider.closest('.modal-card-body');
  const minusButton = card?.querySelector(`.modal-slider-minus[data-slider-id="${sliderId}"]`);
  const plusButton = card?.querySelector(`.modal-slider-plus[data-slider-id="${sliderId}"]`);
  const setValue = nextValue => {
    const numericValue = Number(String(nextValue).trim());
    const parsed = allowDecimal
      ? Math.round(numericValue * 10) / 10
      : Math.trunc(numericValue);
    const safeValue = Number.isFinite(parsed) ? parsed : min;
    const clampedValue = Math.max(min, Math.min(max, safeValue));
    slider.value = clampedValue;
    valueEl.textContent = formatCurrentValue(clampedValue);
    if (minusButton) minusButton.disabled = clampedValue <= min;
    if (plusButton) plusButton.disabled = clampedValue >= max;
  };

  slider.min = min;
  slider.max = max;
  if (allowDecimal) slider.step = 'any';
  valueEl.inputMode = allowDecimal ? 'decimal' : 'numeric';
  setValue(value);

  slider.oninput = () => setValue(allowDecimal ? Math.round(Number(slider.value)) : slider.value);

  valueEl.onfocus = () => {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(valueEl);
    selection.removeAllRanges();
    selection.addRange(range);
  };
  valueEl.onkeydown = event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      valueEl.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      valueEl.textContent = formatCurrentValue(Number(slider.value));
      valueEl.blur();
    }
  };
  valueEl.onblur = () => setValue(valueEl.textContent);

  if (minusButton) minusButton.onclick = () => setValue(Number(slider.value) - step);
  if (plusButton) plusButton.onclick = () => setValue(Number(slider.value) + step);
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
          const value = Number(slider.value);

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
