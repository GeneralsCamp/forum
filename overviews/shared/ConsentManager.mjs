const DEFAULT_STORAGE_KEY = "gf_analytics_state_v1";

function loadGoogleAnalytics(measurementId) {
    if (!measurementId || window.__gfGaLoaded) return;
    window.__gfGaLoaded = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", measurementId, { anonymize_ip: true });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
}

function hideBanner(banner) {
    if (!banner) return;
    banner.hidden = true;
}

function ensureConsentBanner({ bannerId, enableButtonId, rejectButtonId }) {
    let banner = document.getElementById(bannerId);
    if (banner) return banner;

    banner = document.createElement("div");
    banner.id = bannerId;
    banner.className = "consent-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-live", "polite");
    banner.setAttribute("aria-label", "Privacy notice");
    banner.hidden = true;
    banner.innerHTML = `
        <div class="consent-text">
            We use anonymous analytics to improve the site.
        </div>
        <div class="consent-actions">
            <button id="${rejectButtonId}" type="button" class="consent-btn consent-btn-secondary">Reject</button>
            <button id="${enableButtonId}" type="button" class="consent-btn consent-btn-primary">Accept</button>
        </div>
    `;
    document.body.appendChild(banner);
    return banner;
}

export function initConsentManager({
    measurementId,
    storageKey = DEFAULT_STORAGE_KEY,
    defaultState = "enabled",
    bannerId = "consentBanner",
    enableButtonId = "consentAccept",
    rejectButtonId = "consentReject"
} = {}) {
    const banner = ensureConsentBanner({ bannerId, enableButtonId, rejectButtonId });
    const enableButton = document.getElementById(enableButtonId);
    const rejectButton = document.getElementById(rejectButtonId);
    if (!banner || !enableButton || !rejectButton) return;

    const storedState = localStorage.getItem(storageKey) || defaultState;

    if (storedState === "disabled") {
        hideBanner(banner);
        return;
    }

    loadGoogleAnalytics(measurementId);

    if (storedState === "enabled_by_user") {
        hideBanner(banner);
        return;
    }

    banner.hidden = false;

    enableButton.addEventListener("click", () => {
        localStorage.setItem(storageKey, "enabled_by_user");
        hideBanner(banner);
    });

    rejectButton.addEventListener("click", () => {
        localStorage.setItem(storageKey, "disabled");
        hideBanner(banner);
    });
}
