import { modalsData } from './modalsData.js';

let modalCleanupInitialized = false;

function initializeModalCleanup() {
  if (modalCleanupInitialized) return;
  modalCleanupInitialized = true;

  document.addEventListener('hidden.bs.modal', () => {
    if (document.querySelector('.modal.show')) return;
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
  });
}

export function createModal(id, title, bodyContent, footerButtons) {
  const existing = document.getElementById(id);
  if (existing) {
    existing.remove();
  }
  const modal = document.createElement('div');
  modal.className = 'modal fade';
  modal.id = id;
  modal.tabIndex = -1;
  modal.setAttribute('aria-labelledby', `${id}Label`);
  modal.setAttribute('aria-hidden', 'true');
  modal.setAttribute('data-bs-backdrop', 'static');
  modal.setAttribute('data-bs-keyboard', 'false');
  const footerContent = String(footerButtons || '').trim();
  const confirmAction = footerContent.includes('btn-confirm') ? footerContent : '';
  const bodyActions = footerContent && !confirmAction
    ? `<div class="modal-inline-actions">${footerContent}</div>`
    : '';
  modal.innerHTML = `
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="${id}Label">${title}</h5>
          <div class="modal-header-actions">
            ${confirmAction}
            <button type="button" class="modal-header-action modal-header-close" data-bs-dismiss="modal" aria-label="Close">&times;</button>
          </div>
        </div>
        <div class="modal-body p-0">
          ${bodyContent}
          ${bodyActions}
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

export function generateInputCard(title, imageSrc, altText, sliderId, min, max, value, valueId) {
  value = value || 0;
  return `
    <div class="col-12">
      <div class="modal-card-body mt-1">
        <h6 class="card-title wave-editor-name">${title}</h6>
        <div class="d-flex align-items-stretch">
          <img src="${imageSrc}" alt="${altText}" class="modal-image" />
          <div class="modal-input-main">
            <div class="wave-editor-controls">
              <button type="button" class="wave-editor-step modal-slider-minus" data-slider-id="${sliderId}" aria-label="Decrease">&minus;</button>
              <div class="wave-editor-value-wrap">
                <strong id="${valueId}" class="wave-editor-value">${value} / ${max}</strong>
                <input type="range" id="${sliderId}" min="${min}" max="${max}" value="${value}" class="wave-editor-range">
              </div>
              <button type="button" class="wave-editor-step modal-slider-plus" data-slider-id="${sliderId}" aria-label="Increase">+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function generateAllModals() {
  modalsData.forEach(modal => createModal(modal.id, modal.title, modal.body, modal.footer));
  initializeModalCleanup();
}
