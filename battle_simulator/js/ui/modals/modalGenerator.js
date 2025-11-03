import { modalsData } from './modalsData.js';

export function createModal(id, title, bodyContent, footerButtons) {
  const modal = document.createElement('div');
  modal.className = 'modal fade';
  modal.id = id;
  modal.tabIndex = -1;
  modal.setAttribute('aria-labelledby', `${id}Label`);
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header d-flex justify-content-center">
          <h5 class="modal-title" id="${id}Label">${title}</h5>
        </div>
        <div class="modal-body p-0">
          ${bodyContent}
        </div>
        <div class="modal-footer d-flex justify-content-center">
          ${footerButtons}
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

export function generateInputCard(title, imageSrc, altText, sliderId, min, max, value, valueId, inputMin, inputMax, inputValue) {
  value = value || 0;
  return `
    <div class="col-12">
      <div class="modal-card-body mt-1">
        <h6 class="card-title text-center">${title}</h6>
        <div class="d-flex align-items-center">
          <div class="me-2">
            <img src="${imageSrc}" alt="${altText}" class="modal-image" />
          </div>
          <div class="flex-grow-1">
            <div class="d-flex align-items-center">
              <input type="range" id="${sliderId}" min="${min}" max="${max}" value="${value}" class="form-range">
              <input type="number" id="${valueId}" value="${inputValue || 0}" min="${inputMin}" max="${inputMax}" class="form-control w-25" style="margin-left: 10px;" />
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function generateAllModals() {
  modalsData.forEach(modal => createModal(modal.id, modal.title, modal.body, modal.footer));
}
