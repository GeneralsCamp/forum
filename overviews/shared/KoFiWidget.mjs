const KOFI_CONFIG = Object.freeze({
  pageId: "generalscamp",
  buttonText: "Support me",
  buttonBackground: "#d9534f",
  buttonTextColor: "#fff",
  minimumSideGutter: 180
});

const WIDGET_SCRIPT_URL = "https://storage.ko-fi.com/cdn/scripts/overlay-widget.js";
const WIDGET_ROOT_ID = "gf-kofi-widget";

let widgetDrawn = false;
let scriptPromise = null;

function getPageContainer() {
  return document.querySelector("body > .container") || document.querySelector(".container");
}

function hasEnoughSideSpace() {
  const container = getPageContainer();
  if (!container) return false;
  return container.getBoundingClientRect().left >= KOFI_CONFIG.minimumSideGutter;
}

function getWidgetRoot() {
  let root = document.getElementById(WIDGET_ROOT_ID);
  if (root) return root;

  root = document.createElement("div");
  root.id = WIDGET_ROOT_ID;
  root.hidden = true;
  document.body.appendChild(root);
  return root;
}

function loadWidgetScript() {
  if (window.kofiWidgetOverlay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = WIDGET_SCRIPT_URL;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Ko-fi widget failed to load."));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

async function drawWidget(root) {
  if (widgetDrawn) return;
  await loadWidgetScript();
  if (!window.kofiWidgetOverlay) return;

  window.kofiWidgetOverlay.draw(KOFI_CONFIG.pageId, {
    type: "floating-chat",
    "floating-chat.donateButton.text": KOFI_CONFIG.buttonText,
    "floating-chat.donateButton.background-color": KOFI_CONFIG.buttonBackground,
    "floating-chat.donateButton.text-color": KOFI_CONFIG.buttonTextColor
  }, root.id);

  widgetDrawn = true;
}

async function syncWidgetVisibility() {
  const root = getWidgetRoot();
  const shouldShow = hasEnoughSideSpace();

  root.hidden = !shouldShow;
  if (!shouldShow) return;

  try {
    await drawWidget(root);
  } catch (error) {
    root.hidden = true;
    console.warn(error);
  }
}

export function initKoFiWidget() {
  void syncWidgetVisibility();

  let resizeFrame = 0;
  window.addEventListener("resize", () => {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => void syncWidgetVisibility());
  });
}
