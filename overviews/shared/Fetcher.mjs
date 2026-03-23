const MY_PROXY = "https://my-proxy-8u49.onrender.com/";
const CORS_PROXY = "https://corsproxy.io/?";

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
  const proxyUrl = MY_PROXY + url;
  const corsProxyUrl = CORS_PROXY + encodeURIComponent(url);
  const urls = [];

  if (strategy === "direct-only") {
    urls.push(directUrl);
  } else if (strategy === "cors-proxy-first") {
    urls.push(proxyUrl);
    if (useCorsProxy) {
      urls.push(corsProxyUrl);
    }
    urls.push(directUrl);
  } else if (strategy === "direct-first") {
    urls.push(directUrl, proxyUrl);
  } else {
    urls.push(proxyUrl, directUrl);
  }

  if (useCorsProxy && strategy !== "cors-proxy-first") {
    urls.push(corsProxyUrl);
  }

  return [...new Set(urls)];
}
