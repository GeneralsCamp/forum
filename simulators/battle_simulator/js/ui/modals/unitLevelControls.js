import { unitLevels } from "../../data/variables.js";
import { writeStoredJson } from "../../data/storage.js";

export function renderUnitLevelControls(containerId, units) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.replaceChildren();

  units
    .filter((unit) => unit.availableLevels?.length > 1)
    .forEach((unit, index) => {
      const levels = [...unit.availableLevels].sort((a, b) => a - b);
      const controlId = `${containerId}-${index}`;
      const card = document.createElement("div");
      card.className = "col-12";

      const body = document.createElement("div");
      body.className = "modal-card-body mt-1";

      const title = document.createElement("h6");
      title.className = "card-title wave-editor-name";
      title.textContent = `Level of "${unit.name}"`;

      const row = document.createElement("div");
      row.className = "d-flex align-items-stretch";

      const image = document.createElement("img");
      image.src = unit.image;
      image.alt = unit.name;
      image.className = "modal-image";

      const controls = document.createElement("div");
      controls.className = "modal-input-main";

      const inputRow = document.createElement("div");
      inputRow.className = "wave-editor-controls";

      const minusButton = document.createElement("button");
      minusButton.type = "button";
      minusButton.className = "wave-editor-step";
      minusButton.setAttribute("aria-label", "Decrease");
      minusButton.textContent = "−";

      const valueWrap = document.createElement("div");
      valueWrap.className = "wave-editor-value-wrap";

      const value = document.createElement("strong");
      value.id = `${controlId}-value`;
      value.className = "wave-editor-value";
      value.textContent = `${unit.level} / ${levels.at(-1)}`;

      const slider = document.createElement("input");
      slider.type = "range";
      slider.id = `${controlId}-slider`;
      slider.min = String(levels[0]);
      slider.max = String(levels.at(-1));
      slider.value = String(unit.level);
      slider.className = "wave-editor-range";
      slider.dataset.unitLevelKey = unit.levelKey;

      const plusButton = document.createElement("button");
      plusButton.type = "button";
      plusButton.className = "wave-editor-step";
      plusButton.setAttribute("aria-label", "Increase");
      plusButton.textContent = "+";

      const closestLevel = (requested) => levels.reduce((closest, level) =>
        Math.abs(level - requested) < Math.abs(closest - requested) ? level : closest
      );
      const update = (requested) => {
        const selected = closestLevel(Number(requested));
        slider.value = String(selected);
        value.textContent = `${selected} / ${levels.at(-1)}`;
        const selectedIndex = levels.indexOf(selected);
        minusButton.disabled = selectedIndex <= 0;
        plusButton.disabled = selectedIndex >= levels.length - 1;
      };

      slider.addEventListener("input", () => update(slider.value));
      minusButton.onclick = () => {
        const currentIndex = levels.indexOf(Number(slider.value));
        update(levels[Math.max(0, currentIndex - 1)]);
      };
      plusButton.onclick = () => {
        const currentIndex = levels.indexOf(Number(slider.value));
        update(levels[Math.min(levels.length - 1, currentIndex + 1)]);
      };
      update(unit.level);

      valueWrap.append(value, slider);
      inputRow.append(minusButton, valueWrap, plusButton);
      controls.appendChild(inputRow);
      row.append(image, controls);
      body.append(title, row);
      card.appendChild(body);
      container.appendChild(card);
    });
}

export function saveUnitLevelControls(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.querySelectorAll("[data-unit-level-key]").forEach((select) => {
    unitLevels[select.dataset.unitLevelKey] = Number(select.value);
  });
  writeStoredJson("battleUnitLevels", unitLevels);
}
