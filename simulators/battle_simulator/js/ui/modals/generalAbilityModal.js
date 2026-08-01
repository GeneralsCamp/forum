import {
  commitGeneralLoadout,
  getGeneralAbilityCatalog,
  getGeneralLoadout
} from '../../data/generalAbilityCatalog.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generalById(catalog, id) {
  return catalog.generals.find(general => general.id === String(id || ''));
}

function relevantSlots(general, mode) {
  return general?.[`${mode}Slots`] || [];
}

function sideAvailable(ability, mode) {
  return mode === 'attack' ? ability?.attackAvailable : ability?.defenseAvailable;
}

function renderGeneralPicker(root, catalog, draft) {
  const selected = generalById(catalog, draft.generalId);
  const picker = root.querySelector('.general-picker');
  picker.innerHTML = `
    <button type="button" class="general-picker-toggle" aria-expanded="false">
      <img src="${escapeHtml(selected?.portrait || '../../img_base/battle_simulator/unknown.png')}" alt="">
      <strong>${escapeHtml(selected?.name || 'Select general')}</strong>
      <span class="general-picker-arrow" aria-hidden="true"></span>
    </button>
    <div class="general-picker-menu" hidden>
      <button type="button" class="general-picker-option${draft.generalId ? '' : ' selected'}" data-general-id="">
        <img src="../../img_base/battle_simulator/unknown.png" alt="">
        <span>No general</span>
      </button>
      ${catalog.generals.map(general => `
        <button type="button" class="general-picker-option${general.id === draft.generalId ? ' selected' : ''}" data-general-id="${escapeHtml(general.id)}">
          <img src="${escapeHtml(general.portrait)}" alt="">
          <span>${escapeHtml(general.name)}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function renderSlots(root, catalog, mode, draft, selectedSlotId) {
  const general = generalById(catalog, draft.generalId);
  const slots = relevantSlots(general, mode);
  const list = root.querySelector('.general-slot-list');
  list.innerHTML = slots.map(slot => {
    const ability = catalog.abilities[draft.slots[slot.slotId]];
    return `
      <button type="button" class="general-slot-card${slot.slotId === selectedSlotId ? ' selected' : ''}" data-slot-id="${escapeHtml(slot.slotId)}">
        <span class="general-slot-number">${slot.index}</span>
        <span class="general-slot-visual${ability ? '' : ' empty'}">
          ${ability
            ? `<img src="${escapeHtml(ability.icon)}" alt="">`
            : '<span class="general-slot-placeholder">+</span>'}
        </span>
      </button>
    `;
  }).join('');
}

function renderChoices(root, catalog, mode, draft, selectedSlotId) {
  const general = generalById(catalog, draft.generalId);
  const slot = relevantSlots(general, mode).find(item => item.slotId === selectedSlotId);
  const list = root.querySelector('.general-ability-choice-list');
  if (!slot) {
    list.innerHTML = '<div class="general-ability-empty">Select an ability slot.</div>';
    return;
  }

  const selectedGroupId = draft.slots[slot.slotId] || '';
  const abilities = slot.groupIds
    .map(groupId => catalog.abilities[groupId])
    .filter(ability => ability && sideAvailable(ability, mode));

  list.innerHTML = `
    <button type="button" class="general-ability-choice general-ability-clear${selectedGroupId ? '' : ' selected'}" data-ability-group="">
      <span class="general-ability-clear-icon">&minus;</span>
      <span><strong>Empty slot</strong><small>Remove the active ability from this slot.</small></span>
    </button>
    ${abilities.map(ability => {
      const disabled = !ability.supported;
      const description = mode === 'attack' ? ability.attackDescription : ability.defenseDescription;
      return `
        <button type="button" class="general-ability-choice${ability.groupId === selectedGroupId ? ' selected' : ''}${disabled ? ' disabled' : ''}"
          data-ability-group="${escapeHtml(ability.groupId)}" ${disabled ? 'disabled' : ''}>
          <span class="general-ability-choice-icon">
            <img src="${escapeHtml(ability.icon)}" alt="">
          </span>
          <span class="general-ability-choice-copy">
            <strong>${escapeHtml(ability.name)}</strong>
            <small>${escapeHtml(description || 'No description available.')}</small>
          </span>
        </button>
      `;
    }).join('')}
  `;
}

function renderEditor(root, catalog, mode, draft, selectedSlotId) {
  renderGeneralPicker(root, catalog, draft);
  renderSlots(root, catalog, mode, draft, selectedSlotId);
  renderChoices(root, catalog, mode, draft, selectedSlotId);
}

export function openGeneralAbilityModal(mode) {
  const modalId = mode === 'attack' ? 'attackGeneralModal' : 'defenseGeneralModal';
  const confirmId = mode === 'attack' ? 'confirmAttackGeneral' : 'confirmDefenseGeneral';
  const modalElement = document.getElementById(modalId);
  const root = modalElement?.querySelector('.general-loadout-root');
  if (!modalElement || !root) return;

  const catalog = getGeneralAbilityCatalog();
  const saved = getGeneralLoadout(mode);
  const draft = {
    generalId: saved.generalId || '',
    slots: { ...saved.slots }
  };
  let selectedSlotId = relevantSlots(generalById(catalog, draft.generalId), mode)[0]?.slotId || '';

  root.innerHTML = `
    <div class="general-picker"></div>
    <div class="general-loadout-editor">
      <div class="general-slot-list" aria-label="Ability slots"></div>
      <div class="general-ability-choice-list"></div>
    </div>
  `;

  const rerender = () => renderEditor(root, catalog, mode, draft, selectedSlotId);
  rerender();

  root.onclick = event => {
    const toggle = event.target.closest('.general-picker-toggle');
    if (toggle) {
      const menu = root.querySelector('.general-picker-menu');
      const opening = menu.hidden;
      menu.hidden = !opening;
      toggle.setAttribute('aria-expanded', String(opening));
      return;
    }

    const generalOption = event.target.closest('.general-picker-option');
    if (generalOption) {
      draft.generalId = generalOption.dataset.generalId;
      draft.slots = {};
      selectedSlotId = relevantSlots(generalById(catalog, draft.generalId), mode)[0]?.slotId || '';
      rerender();
      return;
    }

    const slot = event.target.closest('.general-slot-card');
    if (slot) {
      selectedSlotId = slot.dataset.slotId;
      renderSlots(root, catalog, mode, draft, selectedSlotId);
      renderChoices(root, catalog, mode, draft, selectedSlotId);
      return;
    }

    const choice = event.target.closest('.general-ability-choice:not(:disabled)');
    if (choice && selectedSlotId) {
      const groupId = choice.dataset.abilityGroup;
      if (groupId) draft.slots[selectedSlotId] = groupId;
      else delete draft.slots[selectedSlotId];
      renderSlots(root, catalog, mode, draft, selectedSlotId);
      renderChoices(root, catalog, mode, draft, selectedSlotId);
    }
  };

  document.getElementById(confirmId).onclick = () => {
    commitGeneralLoadout(mode, draft);
    bootstrap.Modal.getOrCreateInstance(modalElement).hide();
  };

  bootstrap.Modal.getOrCreateInstance(modalElement).show();
}
