export async function fetchWithFallback(url, timeout = 8000, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.status}`);
    }

    return res;
  } finally {
    clearTimeout(timer);
  }
}

export function withCacheBust(url) {
  const baseUrl = typeof window !== "undefined"
    ? window.location.href
    : "http://localhost/";
  const parsedUrl = new URL(url, baseUrl);
  parsedUrl.searchParams.set("_gf_ts", String(Date.now()));
  return parsedUrl.toString();
}

export async function fetchFreshWithFallback(url, timeout = 8000, options = {}) {
  return fetchWithFallback(withCacheBust(url), timeout, {
    ...options,
    cache: "no-store"
  });
}
