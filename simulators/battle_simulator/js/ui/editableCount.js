const MAX_NUMERIC_DIGITS = 12;

function sanitizedNumberText(text, allowDecimal, maxDigits) {
  let result = '';
  let hasDecimalPoint = false;
  let digitCount = 0;
  for (const character of String(text)) {
    if (/\d/.test(character) && digitCount < maxDigits) {
      result += character;
      digitCount += 1;
    } else if (allowDecimal && character === '.' && !hasDecimalPoint) {
      result += character;
      hasDecimalPoint = true;
    }
  }
  return result;
}

function moveCaretToEnd(element) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function restrictNumericEntry(element, allowDecimal = false, maxDigits = MAX_NUMERIC_DIGITS) {
  if (!element || element.dataset.numericEntryBound === 'true') return;
  element.dataset.numericEntryBound = 'true';

  element.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
    if (/\d/.test(event.key)) {
      const selectedText = window.getSelection()?.toString() || '';
      const retainedDigits = (element.textContent.match(/\d/g) || []).length
        - (selectedText.match(/\d/g) || []).length;
      if (retainedDigits < maxDigits) return;
    }
    if (allowDecimal && event.key === '.') return;
    event.preventDefault();
  });

  element.addEventListener('paste', event => {
    event.preventDefault();
    const pasted = sanitizedNumberText(
      event.clipboardData?.getData('text') || '',
      allowDecimal,
      maxDigits
    );
    if (!pasted) return;
    document.execCommand('insertText', false, pasted);
  });

  element.addEventListener('input', () => {
    const sanitized = sanitizedNumberText(element.textContent, allowDecimal, maxDigits);
    if (element.textContent === sanitized) return;
    element.textContent = sanitized;
    moveCaretToEnd(element);
  });
}

export function bindEditableCounts(container, getIndex, setValue) {
  if (!container) return;
  container.querySelectorAll('.wave-editor-current-value').forEach(element => {
    restrictNumericEntry(element, false);
  });

  container.addEventListener('focusin', event => {
    const valueElement = event.target.closest('.wave-editor-current-value');
    if (!valueElement) return;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(valueElement);
    selection.removeAllRanges();
    selection.addRange(range);
  });

  container.addEventListener('keydown', event => {
    const valueElement = event.target.closest('.wave-editor-current-value');
    if (!valueElement) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      valueElement.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      const row = valueElement.closest('.wave-editor-row');
      valueElement.textContent = row?.querySelector('.wave-editor-range')?.value || '0';
      valueElement.blur();
    }
  });

  container.addEventListener('focusout', event => {
    const valueElement = event.target.closest('.wave-editor-current-value');
    if (!valueElement) return;
    const row = valueElement.closest('.wave-editor-row');
    if (!row) return;
    const numericValue = Number(String(valueElement.textContent).trim().replace(',', '.'));
    setValue(getIndex(row), Number.isFinite(numericValue) ? Math.trunc(numericValue) : 0);
  });
}

export function renderEditableCount(row, value, maximum) {
  const valueElement = row.querySelector('.wave-editor-current-value');
  const maximumElement = row.querySelector('.wave-editor-maximum');
  if (valueElement) valueElement.textContent = value;
  if (maximumElement) maximumElement.textContent = maximum;
}
