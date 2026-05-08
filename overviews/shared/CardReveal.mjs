export function revealCard(card, delay = 50) {
  if (!card) return card;

  card.classList.add("card-hidden");
  window.setTimeout(() => {
    card.classList.add("card-visible");
  }, delay);

  return card;
}

export function revealCards(cards, delay = 50) {
  Array.from(cards || []).forEach((card, index) => {
    revealCard(card, delay + index * 20);
  });
}
