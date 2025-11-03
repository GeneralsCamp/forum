import { currentSide } from '../../data/variables.js';
import { switchDefenseSide } from '../uiDefense.js';

export function openDefenseBasicsModal() {
  const myModal = new bootstrap.Modal(document.getElementById('defenseBasicsModal'));
  myModal.show();
  switchDefenseSide(currentSide);
}
