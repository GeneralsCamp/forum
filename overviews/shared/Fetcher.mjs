const MY_PROXY = "https://my-proxy-8u49.onrender.com/";
const FALLBACK_PROXY = "https://corsproxy.io/?";

export async function fetchWithFallback(url, timeout = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch(MY_PROXY + url, {
            signal: controller.signal
        });

        if (!res.ok) throw new Error("Proxy failed");
        return res;

    } catch {
        const encoded = encodeURIComponent(url);
        const fallback = await fetch(FALLBACK_PROXY + encoded);

        if (!fallback.ok) {
            throw new Error("Fallback proxy failed");
        }

        return fallback;

    } finally {
        clearTimeout(timer);
    }
}
