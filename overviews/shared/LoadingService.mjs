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

        const target =
            Math.round((step / totalSteps) * 100);

        statusEl.textContent = text;

        let current =
            parseInt(barEl.style.width) || 0;

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

    return { set, hide };
}
