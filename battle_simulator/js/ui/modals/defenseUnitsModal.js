import { defense_units, defenseSlots, castellanStats } from '../../data/variables.js';
import { calculateTroopDefenseStrength, createDefenseUnitIcon } from '../uiDefense.js';
import { saveDefenseState } from '../../data/defenseState.js';

export function initializeDefenseUnits(defense_units) {
  const unitModalBody = document.querySelector('#unitModalDefense .modal-body');
  unitModalBody.innerHTML = '';

  defense_units.forEach((unit, index) => {
    const effects = [];
    if (unit.meleeDefenseStrength > 0) {
      effects.push(`<img src="./img/castellan-modal1.png" alt="" class="combat-icon" /><span class="me-2">+${unit.meleeDefenseStrength}</span>`);
    }
    if (unit.rangedDefenseStrength > 0) {
      effects.push(`<img src="./img/castellan-modal2.png" alt="" class="combat-icon" /><span class="me-2">+${unit.rangedDefenseStrength}</span>`);
    }

    const unitCard = `
      <div class="col-12">
        <div class="card w-100">
          <div class="modal-card-body mt-1">
            <h6 class="card-title text-center">${unit.name}</h6>
            <div class="d-flex align-items-center">
              <div class="me-2">
                <img src="./img/icon_defense_unit${index + 1}.webp" alt="${unit.id}" class="unit-image" />
              </div>
              <div class="flex-grow-1">
                <div class="d-flex align-items-center">
                  <input type="range" id="defense_unit${index + 1}" min="0" max="7" value="0" class="form-range me-2" />
                  <span id="defense_unit${index + 1}-value" class="selector-value">0</span>
                </div>
                <div class="mt-2">${effects.join('')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    unitModalBody.insertAdjacentHTML('beforeend', unitCard);

    const unitRange = document.getElementById(`defense_unit${index + 1}`);
    const unitValue = document.getElementById(`defense_unit${index + 1}-value`);
    unitRange.addEventListener('input', function () {
      unitValue.textContent = this.value;
    });
  });
}

export function openDefenseUnitsModal(side, slotNumber) {
  const modal = new bootstrap.Modal(document.getElementById('unitModalDefense'));
  const slotElement = document.getElementById(`unit-slot-${side}-${slotNumber}`);

  const wallMaxUnits = castellanStats.wallUnitLimit;
  const cyMaxUnits = castellanStats.cyUnitLimit;
  const isCourtyard = side === 'cy';

  const totalUnitsInDefense = Object.keys(defenseSlots).reduce((total, key) => {
    if (key !== 'cy') {
      return total + defenseSlots[key].units.reduce((acc, slot) => acc + (slot?.count || 0), 0);
    }
    return total;
  }, 0);

  const totalUnitsInCourtyard = (defenseSlots.cy?.units || []).reduce(
    (acc, slot) => acc + (slot?.count || 0),
    0
  );

  const currentSlotData = defenseSlots[side].units[slotNumber - 1] || { type: '', count: 0 };
  const currentSlotUnitCount = currentSlotData.count;
  initializeDefenseUnits(defense_units, currentSlotData);
  const availableUnits = isCourtyard
    ? cyMaxUnits - totalUnitsInCourtyard + currentSlotUnitCount
    : wallMaxUnits - totalUnitsInDefense + currentSlotUnitCount;

  defense_units.forEach((unit, index) => {
    const count = currentSlotData.type === `DefenseUnit${unit.id.charAt(unit.id.length - 1)}`
      ? currentSlotData.count
      : 0;

    const unitRange = document.getElementById(`defense_unit${index + 1}`);
    const unitValue = document.getElementById(`defense_unit${index + 1}-value`);

    if (unitRange && unitValue) {
      unitRange.value = count;
      unitRange.max = availableUnits;
      unitValue.textContent = count;

      unitRange.addEventListener('input', function () {
        unitValue.textContent = this.value;
        defense_units.forEach((otherUnit, otherIndex) => {
          if (otherIndex !== index) {
            const otherRange = document.getElementById(`defense_unit${otherIndex + 1}`);
            const otherValue = document.getElementById(`defense_unit${otherIndex + 1}-value`);
            if (otherRange && otherValue) {
              otherRange.value = 0;
              otherValue.textContent = 0;
            }
          }
        });
      });
    }
  });

  document.getElementById('confirmDefenseUnits').onclick = function () {
    let totalUnitsInSlot = 0;
    let selectedUnitType = '';
 
    defense_units.forEach((unit, index) => {
      const unitRange = document.getElementById(`defense_unit${index + 1}`);
      const unitCount = parseInt(unitRange?.value || 0);
      if (unitCount > 0) {
        totalUnitsInSlot += unitCount;
        selectedUnitType = `DefenseUnit${unit.id.charAt(unit.id.length - 1)}`;
      }
    });

    defenseSlots[side].units[slotNumber - 1] = {
      type: selectedUnitType,
      count: totalUnitsInSlot
    };

    slotElement.innerHTML = totalUnitsInSlot > 0
      ? createDefenseUnitIcon({ type: selectedUnitType, count: totalUnitsInSlot })
      : '+';

    calculateTroopDefenseStrength(side);
    saveDefenseState();
    modal.hide();
  };

  modal.show();
}
