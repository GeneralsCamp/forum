const MY_PROXY = "https://my-proxy-8u49.onrender.com/";

export async function fetchWithFallback(url, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(MY_PROXY + url, {
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