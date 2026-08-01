import { BATTLE_CATALOG_GROUPS, cloneBattleCatalog } from '../../data/catalog.js';
import { getBattleCatalog, saveBattleCatalog } from '../../data/battleCatalogState.js';
import { loadData, resolveCatalogItem, resolveCatalogPreview } from '../../data/dataLoader.js';
import { saveAttackState } from '../../data/attackState.js';
import { saveDefenseState } from '../../data/defenseState.js';
import { getEffectiveWaveCount, currentSide, currentSideDefense } from '../../data/variables.js';
import { generateWaves, switchSide } from '../uiWaves.js';
import { switchDefenseSide } from '../uiDefense.js';
import { imageUrl } from '../../data/imagePaths.js';

let draftCatalog = null;
let activeGroupKey = 'attackUnits';

const groupInfo = key => BATTLE_CATALOG_GROUPS.find(group => group.key === key);
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));
const removeIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v3H4V5h4l1-2Zm-2 6h10l-1 12H8L7 9Z"></path></svg>';

function levelControlHtml(levelsInput, selectedLevel, index = '') {
  const levels = [...levelsInput].map(Number).sort((a, b) => a - b);
  const selectedIndex = Math.max(0, levels.findIndex(level => level === Number(selectedLevel)));
  const adjustable = levels.length > 1;
  const indexAttribute = index === '' ? '' : ` data-catalog-level-index="${index}"`;
  return `<div class="wave-editor-controls catalog-level-control" data-level-values="${levels.join(',')}"${indexAttribute}>
    <button type="button" class="wave-editor-step catalog-level-minus" aria-label="Previous level" ${adjustable ? '' : 'disabled'}>&minus;</button>
    <div class="wave-editor-value-wrap">
      <strong class="wave-editor-value catalog-level-value">${levels.length ? `Level ${levels[selectedIndex]}` : 'No level'}</strong>
      <input class="wave-editor-range catalog-level-range" type="range" min="0" max="${Math.max(1, levels.length - 1)}" value="${selectedIndex}" ${adjustable ? '' : 'disabled'}>
    </div>
    <button type="button" class="wave-editor-step catalog-level-plus" aria-label="Next level" ${adjustable ? '' : 'disabled'}>+</button>
  </div>`;
}

function bindLevelControls(root, onChange) {
  root.querySelectorAll('.catalog-level-control').forEach(control => {
    const levels = String(control.dataset.levelValues || '').split(',').filter(Boolean).map(Number);
    const range = control.querySelector('.catalog-level-range');
    const value = control.querySelector('.catalog-level-value');
    const minus = control.querySelector('.catalog-level-minus');
    const plus = control.querySelector('.catalog-level-plus');
    if (!range || levels.length < 2) return;
    const update = nextIndex => {
      const index = Math.max(0, Math.min(levels.length - 1, Number(nextIndex)));
      range.value = String(index);
      value.textContent = `Level ${levels[index]}`;
      minus.disabled = index === 0;
      plus.disabled = index === levels.length - 1;
      onChange?.(control, levels[index]);
    };
    minus.onclick = () => update(Number(range.value) - 1);
    plus.onclick = () => update(Number(range.value) + 1);
    range.oninput = () => update(range.value);
    update(range.value);
  });
}

async function describeEntry(group, entry, index) {
  try {
    const preview = await resolveCatalogPreview(group.kind, entry.wodID, entry.level);
    return { entry, index, preview, error: '' };
  } catch (error) {
    return { entry, index, preview: null, error: error.message };
  }
}

async function renderCatalogEntries() {
  const list = document.getElementById('battle-catalog-list');
  if (!list || !draftCatalog) return;
  const group = groupInfo(activeGroupKey);
  const entries = draftCatalog[activeGroupKey] || [];
  list.innerHTML = '<div class="catalog-loading">Loading...</div>';
  const rows = await Promise.all(entries.map((entry, index) => describeEntry(group, entry, index)));
  list.innerHTML = rows.length ? rows.map(({ entry, index, preview }) => {
    if (!preview) return `<div class="catalog-entry invalid" data-catalog-index="${index}">
      <h6 class="card-title wave-editor-name">Unknown item</h6>
      <div class="catalog-entry-editor">
        <div class="catalog-entry-error">Item could not be loaded.</div>
        <button type="button" class="catalog-remove catalog-remove-invalid" aria-label="Remove">${removeIcon}</button>
      </div>
    </div>`;
    const levels = preview.availableLevels || [];
    return `<div class="catalog-entry" data-catalog-index="${index}">
      <h6 class="card-title wave-editor-name">${escapeHtml(preview.name)}</h6>
      <div class="catalog-entry-editor d-flex align-items-stretch">
        <div class="catalog-entry-image-wrap">
          <img src="${escapeHtml(imageUrl(preview.image))}" alt="" class="modal-image">
          <button type="button" class="catalog-remove" aria-label="Remove">${removeIcon}</button>
        </div>
        <div class="modal-input-main">${levelControlHtml(levels, preview.level, index)}</div>
      </div>
    </div>`;
  }).join('') : '<div class="catalog-empty">No entries in this group.</div>';

  list.querySelectorAll('.catalog-remove').forEach(button => {
    button.onclick = () => {
      draftCatalog[activeGroupKey].splice(Number(button.closest('[data-catalog-index]').dataset.catalogIndex), 1);
      renderCatalogEntries();
    };
  });
  bindLevelControls(list, (control, level) => {
    const entry = draftCatalog[activeGroupKey][Number(control.dataset.catalogLevelIndex)];
    if (entry) entry.level = level;
  });
}

async function loadCustomId() {
  const input = document.getElementById('catalog-custom-id');
  const sideSelect = document.getElementById('battle-catalog-side');
  const kindSelect = document.getElementById('battle-catalog-kind');
  const wodID = input.value.trim();
  if (!wodID) return;
  input.setCustomValidity('');
  try {
    const { groupKey, preview } = await resolveCatalogItem(wodID);
    activeGroupKey = groupKey;
    sideSelect.value = groupKey.startsWith('defense') ? 'defense' : 'attack';
    kindSelect.value = groupKey.endsWith('Tools') ? 'tools' : 'units';
    const entry = { wodID };
    if (preview.level != null) entry.level = preview.level;
    const entries = draftCatalog[activeGroupKey] || [];
    const duplicateIndex = entries.findIndex(existing =>
      String(existing.wodID) === String(entry.wodID)
      && Number(existing.level ?? preview.level) === Number(entry.level ?? preview.level)
    );
    if (duplicateIndex >= 0) entries.unshift(...entries.splice(duplicateIndex, 1));
    else entries.unshift(entry);
    input.value = '';
    await renderCatalogEntries();
    const list = document.getElementById('battle-catalog-list');
    if (list) list.scrollTop = 0;
  } catch (error) {
    input.setCustomValidity(error.message);
    input.reportValidity();
  }
}

function catalogGroupKey(side, kind) {
  if (side === 'defense') return kind === 'tools' ? 'defenseTools' : 'defenseUnits';
  return kind === 'tools' ? 'attackTools' : 'attackUnits';
}

export function openBattleCatalogModal() {
  const modalEl = document.getElementById('battleCatalogModal');
  if (!modalEl) return;
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  draftCatalog = cloneBattleCatalog(getBattleCatalog());

  const sideSelect = document.getElementById('battle-catalog-side');
  const kindSelect = document.getElementById('battle-catalog-kind');
  sideSelect.value = activeGroupKey.startsWith('defense') ? 'defense' : 'attack';
  kindSelect.value = activeGroupKey.endsWith('Tools') ? 'tools' : 'units';
  const updateGroup = () => {
    activeGroupKey = catalogGroupKey(sideSelect.value, kindSelect.value);
    renderCatalogEntries();
  };
  sideSelect.onchange = updateGroup;
  kindSelect.onchange = updateGroup;

  document.getElementById('catalog-load-id').onclick = loadCustomId;
  document.getElementById('catalog-custom-id').onkeydown = event => {
    if (event.key === 'Enter') { event.preventDefault(); loadCustomId(); }
  };
  document.getElementById('confirmBattleCatalog').onclick = async () => {
    saveBattleCatalog(draftCatalog);
    const hidden = new Promise(resolve =>
      modalEl.addEventListener('hidden.bs.modal', resolve, { once: true })
    );
    modal.hide();
    await hidden;
    await loadData({ preserveCurrentState: true });
    generateWaves(currentSide, getEffectiveWaveCount());
    switchSide(currentSide);
    switchDefenseSide(currentSideDefense);
    saveAttackState();
    saveDefenseState();
  };
  renderCatalogEntries();
  modal.show();
}
