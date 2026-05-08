function ensureLoadingElements({
  boxId = "loadingBox"
} = {}) {
  let box = document.getElementById(boxId);
  if (box) return box;

  const host = document.getElementById("content") || document.body;

  box = document.createElement("div");
  box.id = boxId;
  box.className = "loading-message";
  box.style.display = "none";

  host.appendChild(box);
  return box;
}

export function createLoader() {
  function setLoadingState(isActive) {
    if (!document?.body) return;
    document.body.classList.toggle("gf-loading-active", !!isActive);
  }

  function set() {}

  function hide(boxSelector = "#loadingBox") {
    const box = document.querySelector(boxSelector);
    if (box) box.style.display = "none";
    setLoadingState(false);
  }

  function error(message = "Something went wrong...", seconds = 30) {
    const box = ensureLoadingElements();
    if (!box) return;
    setLoadingState(true);
    box.style.display = "flex";

    box.innerHTML = `
      <h3>${message}</h3>
      <p class="mb-1">The data cache or network may be unavailable.</p>
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
