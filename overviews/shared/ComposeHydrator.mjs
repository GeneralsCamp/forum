import { composeAssetToDataUrl } from "./AssetComposer.mjs";

export async function hydrateComposedImages({
  root = document,
  selector = 'img[data-compose-asset="1"]:not([data-compose-ready])',
  cache,
  workerCount = 4,
  onApplied
} = {}) {
  const images = root.querySelectorAll(selector);
  if (!images.length) return;

  const localCache = cache || new Map();
  const queue = Array.from(images);
  const workers = Math.max(1, Math.min(workerCount, queue.length));

  const runWorker = async () => {
    while (queue.length > 0) {
      const img = queue.shift();
      if (!img) return;

      img.dataset.composeReady = "1";

      const imageUrl = img.dataset.imageUrl;
      const jsonUrl = img.dataset.jsonUrl;
      const jsUrl = img.dataset.jsUrl;
      if (!imageUrl || !jsonUrl || !jsUrl) continue;

      const cacheKey = `${imageUrl}|${jsonUrl}|${jsUrl}`;
      if (localCache.has(cacheKey)) {
        const cached = localCache.get(cacheKey);
        if (cached) {
          img.src = cached;
          if (typeof onApplied === "function") onApplied(img, cached, imageUrl);
        }
        continue;
      }

      try {
        const composedDataUrl = await composeAssetToDataUrl({ imageUrl, jsonUrl, jsUrl });
        localCache.set(cacheKey, composedDataUrl);
        img.src = composedDataUrl;
        if (typeof onApplied === "function") onApplied(img, composedDataUrl, imageUrl);
      } catch {
        localCache.set(cacheKey, null);
      }
    }
  };

  await Promise.all(Array.from({ length: workers }, () => runWorker()));
}