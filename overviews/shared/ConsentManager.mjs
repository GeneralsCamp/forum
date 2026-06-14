export function loadGoogleAnalytics(measurementId) {
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

export function initConsentManager(config) {
    const id = (typeof config === "string") ? config : config?.measurementId;
    if (id) loadGoogleAnalytics(id);
}