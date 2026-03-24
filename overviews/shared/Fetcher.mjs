const PROXY_URLS = [
  "https://cors-anywhere-qelm.onrender.com/",
  "https://my-proxy-8u49.onrender.com/"
];

export async function fetchWithFallback(url, timeout = 8000, options = {}) {
  const {
    strategy = "proxy-first",
    useCorsProxy = false
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const attemptUrls = buildAttemptUrls(url, strategy, useCorsProxy);
    let lastError = null;

    for (const attemptUrl of attemptUrls) {
      try {
        const res = await fetch(attemptUrl, {
          signal: controller.signal
        });

        if (!res.ok) {
          throw new Error(`Fetch failed: ${res.status}`);
        }

        return res;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Fetch failed");
  } finally {
    clearTimeout(timer);
  }
}

function buildAttemptUrls(url, strategy, useCorsProxy) {
  const directUrl = url;
  const proxyUrls = PROXY_URLS.map((proxyBase) => proxyBase + url);
  const urls = [];

  if (strategy === "direct-only") {
    urls.push(directUrl);
  } else if (strategy === "cors-proxy-first") {
    urls.push(...proxyUrls);
    urls.push(directUrl);
  } else if (strategy === "direct-first") {
    urls.push(directUrl, ...proxyUrls);
  } else {
    urls.push(...proxyUrls, directUrl);
  }

  return [...new Set(urls)];
}
