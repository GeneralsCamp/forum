import { initConsentManager } from "./ConsentManager.mjs";
import { initKoFiWidget } from "./KoFiWidget.mjs";

const topButtonsContainer = document.getElementById("topButtonsContainer");
if (topButtonsContainer && topButtonsContainer.parentElement !== document.body) {
  document.body.appendChild(topButtonsContainer);
}

initConsentManager({
  measurementId: "G-8TGZRNFGRR",
  storageKey: "gf_analytics_state",
  defaultState: "enabled"
});

initKoFiWidget();
