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
      title.className = "card-title text-center";
      title.textContent = `Level of "${unit.name}"`;

      const row = document.createElement("div");
      row.className = "d-flex align-items-center";

      const imageWrap = document.createElement("div");
      imageWrap.className = "me-2";

      const image = document.createElement("img");
      image.src = unit.image;
      image.alt = unit.name;
      image.className = "modal-image";
      imageWrap.appendChild(image);

      const controls = document.createElement("div");
      controls.className = "flex-grow-1";

      const inputRow = document.createElement("div");
      inputRow.className = "d-flex align-items-center";

      const slider = document.createElement("input");
      slider.type = "range";
      slider.id = `${controlId}-slider`;
      slider.min = String(levels[0]);
      slider.max = String(levels.at(-1));
      slider.value = String(unit.level);
      slider.className = "form-range";
      slider.dataset.unitLevelKey = unit.levelKey;

      const value = document.createElement("input");
      value.type = "number";
      value.id = `${controlId}-value`;
      value.min = slider.min;
      value.max = slider.max;
      value.value = slider.value;
      value.className = "form-control w-25";
      value.style.marginLeft = "10px";

      const closestLevel = (requested) => levels.reduce((closest, level) =>
        Math.abs(level - requested) < Math.abs(closest - requested) ? level : closest
      );
      const update = (requested) => {
        const selected = closestLevel(Number(requested));
        slider.value = String(selected);
        value.value = String(selected);
      };

      slider.addEventListener("input", () => update(slider.value));
      value.addEventListener("input", () => update(value.value));

      inputRow.append(slider, value);
      controls.appendChild(inputRow);
      row.append(imageWrap, controls);
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
