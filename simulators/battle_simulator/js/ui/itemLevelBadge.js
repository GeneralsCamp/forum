export function itemLevelBadge(item) {
  const level = Number(item?.level);
  if (!Number.isFinite(level) || level <= 0) return '';
  return `<span class="item-level-badge" aria-label="Level ${level}">${level}</span>`;
}

export function runtimeItem(type, items = []) {
  const index = Number(String(type || '').match(/(\d+)$/)?.[1]) - 1;
  return Number.isInteger(index) && index >= 0 ? items[index] : null;
}
