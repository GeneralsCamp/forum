export function createLoader({
  statusSelector = "#loadingStatus",
  barSelector = "#loadingProgress",
  percentSelector = "#loadingPercentText",
  animationMs = 25
} = {}) {

  const statusEl = document.querySelector(statusSelector);
  const barEl = document.querySelector(barSelector);
  const percentEl = document.querySelector(percentSelector);

  function set(step, totalSteps, text) {
    if (!statusEl || !barEl || !percentEl) return;

    const target = Math.round((step / totalSteps) * 100);
    statusEl.textContent = text;

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
  }

  function error(message = "Something went wrong...", seconds = 30) {
    const box = document.querySelector("#loadingBox");
    if (!box) return;

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
