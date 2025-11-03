import { waves, defenseSlots, unitImages, unitImagesDefense } from '../data/variables.js';

export function battleSimulation() {
  const battleReportModal = new bootstrap.Modal(document.getElementById('battleReportModal'));
  battleReportModal.show();
  switchReportSide('front');
}

function switchReportSide(side) {
  document.querySelectorAll('.flanks-button-report').forEach(button => {
    button.classList.remove('active');
  });

  populateBattleReportModal(side);

  const activeButton = document.querySelector(`.flanks-button-report[data-section="${side}"]`);
  activeButton.classList.add('active');
}

function populateBattleReportModal(side) {
  const attackerContainer = document.querySelector('.report-attackers .row');
  attackerContainer.innerHTML = '';

  const defenderContainer = document.querySelector('.report-defenders .row');
  defenderContainer.innerHTML = '';

  const waveSummaryContainer = document.getElementById('wave-summary-container');
  waveSummaryContainer.innerHTML = '';

  let totalAttackers = 0;
  let totalDefenders = 0;

  ['front', 'left', 'right'].forEach(sideKey => {
    if (waves[sideKey]) {
      waves[sideKey].forEach(wave => {
        wave.slots.forEach(slot => {
          if (slot && slot.count > 0) totalAttackers += slot.count;
        });
      });
    }
  });

  if (waves['CY']) {
    waves['CY'][0].slots.forEach(slot => {
      if (slot && slot.count > 0) totalAttackers += slot.count;
    });
  }

  ['front', 'left', 'right', 'cy'].forEach(sideKey => {
    if (defenseSlots[sideKey]?.units) {
      defenseSlots[sideKey].units.forEach(unit => {
        if (unit && unit.count > 0) totalDefenders += unit.count;
      });
    }
  });

  const attackerCountElement = document.querySelector('.report-troops-sum .col-6:nth-child(1)');
  const defenderCountElement = document.querySelector('.report-troops-sum .col-6:nth-child(2)');

  if (attackerCountElement) attackerCountElement.textContent = `${totalAttackers}`;
  if (defenderCountElement) defenderCountElement.textContent = `${totalDefenders}`;

  const attackers = (side === 'cy' && waves['CY'])
    ? waves['CY'][0].slots
    : (waves[side] || []).flatMap(wave => wave.slots);

  const attackerSummary = attackers.reduce((acc, unit) => {
    if (unit && unit.count > 0 && unit.type) acc[unit.type] = (acc[unit.type] || 0) + unit.count;
    return acc;
  }, {});

  const defenderSummary = defenseSlots[side]?.units?.reduce((acc, unit) => {
    if (unit && unit.count > 0) {
      const key = unit.type || unit.id;
      acc[key] = (acc[key] || 0) + unit.count;
    }
    return acc;
  }, {}) || {};

  Object.entries(attackerSummary).forEach(([key, count]) => {
    const unitImage = unitImages[key] || 'default-attack-icon.png';
    const attackerHTML = `
      <div class="unit-slot">
        <div class="unit-icon-container">
          <img src="./img/${unitImage}" class="unit-icon" alt="${key}">
          <div class="unit-count">${count}</div>
        </div>
      </div>
    `;
    attackerContainer.insertAdjacentHTML('beforeend', attackerHTML);
  });

  Object.entries(defenderSummary).forEach(([key, count]) => {
    const unitImage = unitImagesDefense[key] || 'default-defense-icon.png';
    const defenderHTML = `
      <div class="unit-slot">
        <div class="unit-icon-container">
          <img src="./img/${unitImage}" class="unit-icon" alt="${key}">
          <div class="unit-count">${count}</div>
        </div>
      </div>
    `;
    defenderContainer.insertAdjacentHTML('beforeend', defenderHTML);
  });

  if (!waves[side] || waves[side].length === 0) return;

  waves[side].forEach((wave, index) => {
    const hasUnits = wave.slots.some(slot => slot.count > 0);
    if (hasUnits) {
      const waveHTML = `
        <div class="player-flank text-center">
          <span>WAVE ${index + 1}</span>
        </div>
        <div class="card-body margin-bug-fix report-wave">
          <div class="row">
            <div class="col bugfix report-attackers" style="border-right: 1px solid rgb(180, 140, 100);">
              <div class="row">
                ${wave.slots
                  .map(slot => {
                    if (slot && slot.count > 0) {
                      const unitImage = unitImages[slot.type] || 'default-attack-icon.png';
                      return `
                        <div class="unit-slot">
                          <div class="unit-icon-container">
                            <img src="./img/${unitImage}" class="unit-icon" alt="${slot.type}">
                            <div class="unit-count">${slot.count}</div>
                          </div>
                        </div>
                      `;
                    }
                    return '';
                  })
                  .join('')}
              </div>
            </div>
            <div class="col bugfix report-defenders">
              <div class="row"></div>
            </div>
          </div>
        </div>
      `;
      waveSummaryContainer.insertAdjacentHTML('beforeend', waveHTML);
    }
  });
}

document.querySelectorAll('.flanks-button-report.sides')?.forEach(button => {
  button.addEventListener('click', () => switchReportSide(button.dataset.section));
});
