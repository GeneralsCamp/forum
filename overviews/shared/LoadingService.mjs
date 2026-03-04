function ensureLoadingElements({
  boxId = "loadingBox",
  statusId = "loadingStatus",
  progressId = "loadingProgress",
  percentId = "loadingPercentText"
} = {}) {
  let box = document.getElementById(boxId);
  if (box) return box;

  const host = document.getElementById("content") || document.body;

  box = document.createElement("div");
  box.id = boxId;
  box.className = "loading-message";
  box.innerHTML = `
    <h3 id="${statusId}">Initializing...</h3>
    <div class="progress">
      <div id="${progressId}" class="progress-bar"></div>
      <span id="${percentId}" class="progress-text">0%</span>
    </div>
  `;

  host.appendChild(box);
  return box;
}

export function createLoader({
  statusSelector = "#loadingStatus",
  barSelector = "#loadingProgress",
  percentSelector = "#loadingPercentText",
  animationMs = 25
} = {}) {
  ensureLoadingElements();

  const statusEl = document.querySelector(statusSelector);
  const barEl = document.querySelector(barSelector);
  const percentEl = document.querySelector(percentSelector);

  function toggleFilterControlsDisabled(isDisabled) {
    const controls = document.querySelectorAll(
      ".note input, .note select, .note button, .note textarea"
    );

    controls.forEach((el) => {
      if ("disabled" in el) {
        el.disabled = !!isDisabled;
      }
      el.setAttribute("aria-disabled", isDisabled ? "true" : "false");
    });
  }

  function setLoadingState(isActive) {
    if (!document?.body) return;
    document.body.classList.toggle("gf-loading-active", !!isActive);
    toggleFilterControlsDisabled(!!isActive);
  }

  function set(step, totalSteps, text) {
    if (!statusEl || !barEl || !percentEl) return;

    const target = Math.round((step / totalSteps) * 100);
    statusEl.textContent = text;
    setLoadingState(target < 100);

    let current = parseInt(barEl.style.width) || 0;

    const interval = setInterval(() => {
      if (current >= target) {
        clearInterval(interval);
        return;
      }
      current++;
      barEl.style.width = current + "%";
      percentEl.textContent = current + "%";
    }, animationMs);
  }

  function hide(boxSelector = "#loadingBox") {
    const box = document.querySelector(boxSelector);
    if (box) box.style.display = "none";
    setLoadingState(false);
  }

  function error(message = "Something went wrong...", seconds = 30) {
    const box = document.querySelector("#loadingBox");
    if (!box) return;
    setLoadingState(true);

    box.innerHTML = `
      <h3>${message}</h3>
      <p class="mb-1">The proxy server may be unavailable.</p>
      <p class="mb-1">Please wait a moment (max. 3 min).</p>
      <p>Reload in <span id="retryCountdown">${seconds}</span> seconds</p>
    `;

    let remaining = seconds;
    const span = box.querySelector("#retryCountdown");

    const interval = setInterval(() => {
      remaining--;
      if (span) span.textContent = remaining;
      if (remaining <= 0) {
        clearInterval(interval);
        location.reload();
      }
    }, 1000);
  }

  return { set, hide, error };
}