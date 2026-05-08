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
