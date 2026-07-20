import { fetchWithFallback } from "./Fetcher.mjs";

const textCache = new Map();
const blobCache = new Map();
const imageCache = new Map();
const composedCache = new Map();
const RENDER_PROXY_URLS = [
  "https://my-proxy-8u49.onrender.com/"
];
const GOODGAME_ITEM_ASSET_ROOT =
  "https://empire-html5.goodgamestudios.com/default/assets/itemassets/";

function isGoodgameItemAsset(url) {
  return String(url || "").startsWith(GOODGAME_ITEM_ASSET_ROOT);
}

function isComposableAssetFile(url) {
  return /\.(json|js|webp|png)$/i.test(String(url || "").split("?")[0]);
}

function buildComposerFetchUrls(url) {
  if (!isGoodgameItemAsset(url) || !isComposableAssetFile(url)) {
    return [url];
  }

  return [
    ...RENDER_PROXY_URLS.map(proxyUrl => `${proxyUrl}${url}`)
  ];
}

async function fetchComposerAsset(url, timeout = 20000) {
  let lastError = null;

  for (const fetchUrl of buildComposerFetchUrls(url)) {
    try {
      return await fetchWithFallback(fetchUrl, timeout);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`Fetch failed: ${url}`);
}

function createSpriteSheet(atlasImage, atlasJson) {
  const frames = Array.isArray(atlasJson?.frames) ? atlasJson.frames : [];
  const animations = atlasJson?.animations || {};
  return {
    getAnimation(name) {
      return animations[name] || { frames: [] };
    },
    getFrame(index) {
      const frame = frames[index];
      if (!frame) return null;
      return {
        image: atlasImage,
        rect: { x: frame[0], y: frame[1], width: frame[2], height: frame[3] }
      };
    }
  };
}

function buildCreateJsStubs() {
  function Bitmap(image) {
    this.image = image || null;
    this.sourceRect = null;
    this.children = [];
    this.x = 0;
    this.y = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.rotation = 0;
    this.skewX = 0;
    this.skewY = 0;
    this.regX = 0;
    this.regY = 0;
  }
  Bitmap.prototype.setBounds = function () { };

  function Container() {
    this.children = [];
    this.x = 0;
    this.y = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.rotation = 0;
    this.skewX = 0;
    this.skewY = 0;
    this.regX = 0;
    this.regY = 0;
  }
  Container.prototype.addChild = function (...kids) {
    this.children.push(...kids.filter(Boolean));
    return kids[0] || null;
  };

  function MovieClip() {
    this.children = [];
    this.x = 0;
    this.y = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.rotation = 0;
    this.skewX = 0;
    this.skewY = 0;
    this.regX = 0;
    this.regY = 0;
  }
  MovieClip.prototype.addChild = function (...kids) {
    this.children.push(...kids.filter(Boolean));
    return kids[0] || null;
  };

  function LoadQueue() {
    this._assets = Object.create(null);
  }
  LoadQueue.prototype.getResult = function (id) {
    return this._assets[id];
  };
  LoadQueue.prototype.setResult = function (id, val) {
    this._assets[id] = val;
  };

  return { Bitmap, Container, MovieClip, LoadQueue };
}

function isBrokenStateLayer(node) {
  const name = String(node?.name || "");
  const className = String(node?.constructor?.__fname || "");
  return /^mc[_-]?broken$/i.test(name) || /^mc[_-]?broken/i.test(className);
}

function drawNode(ctx, node) {
  if (!node || isBrokenStateLayer(node)) return;

  ctx.save();
  const matrix = getNodeMatrix(node);
  ctx.transform(...matrix);

  if (node.sourceRect && node.image) {
    const r = node.sourceRect;
    ctx.drawImage(node.image, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
  }

  if (Array.isArray(node.children)) {
    node.children.forEach(child => drawNode(ctx, child));
  }

  ctx.restore();
}

function createIdentityMatrix() {
  return [1, 0, 0, 1, 0, 0];
}

function multiplyMatrix(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5]
  ];
}

function transformPoint(m, x, y) {
  return {
    x: m[0] * x + m[2] * y + m[4],
    y: m[1] * x + m[3] * y + m[5]
  };
}

function getNodeMatrix(node) {
  const x = Number(node?.x || 0);
  const y = Number(node?.y || 0);
  const sx = Number(node?.scaleX == null ? 1 : node.scaleX);
  const sy = Number(node?.scaleY == null ? 1 : node.scaleY);
  const rot = Number(node?.rotation || 0) * Math.PI / 180;
  const skewX = Number(node?.skewX || 0) * Math.PI / 180;
  const skewY = Number(node?.skewY || 0) * Math.PI / 180;
  const regX = Number(node?.regX || 0);
  const regY = Number(node?.regY || 0);

  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const rotationAndScale = [
    cos * sx,
    sin * sx,
    -sin * sy,
    cos * sy,
    0,
    0
  ];

  // EaselJS appendTransform semantics are important here: exported assets
  // commonly encode a horizontal flip as skewY=180. A tan-based canvas skew
  // turns that into an identity transform and leaves overlays on the wrong side.
  let matrix = (skewX || skewY)
    ? multiplyMatrix([
      Math.cos(skewY),
      Math.sin(skewY),
      -Math.sin(skewX),
      Math.cos(skewX),
      x,
      y
    ], rotationAndScale)
    : [
      rotationAndScale[0],
      rotationAndScale[1],
      rotationAndScale[2],
      rotationAndScale[3],
      x,
      y
    ];

  if (regX || regY) {
    matrix = matrix.slice();
    matrix[4] -= regX * matrix[0] + regY * matrix[2];
    matrix[5] -= regX * matrix[1] + regY * matrix[3];
  }

  return matrix;
}

function expandBounds(bounds, x, y) {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
}

function measureNodeBounds(node, parentMatrix, bounds) {
  if (!node || isBrokenStateLayer(node)) return;
  const matrix = multiplyMatrix(parentMatrix, getNodeMatrix(node));

  if (node.sourceRect && node.image) {
    const w = Number(node.sourceRect.width || 0);
    const h = Number(node.sourceRect.height || 0);
    const p1 = transformPoint(matrix, 0, 0);
    const p2 = transformPoint(matrix, w, 0);
    const p3 = transformPoint(matrix, w, h);
    const p4 = transformPoint(matrix, 0, h);
    expandBounds(bounds, p1.x, p1.y);
    expandBounds(bounds, p2.x, p2.y);
    expandBounds(bounds, p3.x, p3.y);
    expandBounds(bounds, p4.x, p4.y);
  }

  if (Array.isArray(node.children)) {
    node.children.forEach((child) => measureNodeBounds(child, matrix, bounds));
  }
}

async function fetchText(url) {
  if (!textCache.has(url)) {
    textCache.set(url, (async () => {
      const res = await fetchComposerAsset(url);
      return res.text();
    })());
  }
  return textCache.get(url);
}

async function fetchBlob(url) {
  if (!blobCache.has(url)) {
    blobCache.set(url, (async () => {
      const res = await fetchComposerAsset(url, 30000);
      return res.blob();
    })());
  }
  return blobCache.get(url);
}

async function loadImage(url) {
  if (!imageCache.has(url)) {
    imageCache.set(url, (async () => {
      const blob = await fetchBlob(url);
      const objectUrl = URL.createObjectURL(blob);
      try {
        const image = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Image decode failed: ${url}`));
          img.src = objectUrl;
        });
        return image;
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    })());
  }
  return imageCache.get(url);
}

function parseJsonSafely(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error("Invalid JSON payload");
  }
}

function isSingleFrameAtlas(atlasJson) {
  const frames = Array.isArray(atlasJson?.frames) ? atlasJson.frames : [];
  if (frames.length !== 1) return false;

  const frame = frames[0];
  if (!Array.isArray(frame) || frame.length < 4) return false;

  const sourceW = Number(atlasJson?.sourceSize?.w || 0);
  const sourceH = Number(atlasJson?.sourceSize?.h || 0);
  const frameW = Number(frame[2] || 0);
  const frameH = Number(frame[3] || 0);
  if (sourceW > 0 && sourceH > 0 && (sourceW !== frameW || sourceH !== frameH)) {
    return false;
  }

  const animations = atlasJson?.animations || {};
  const animationValues = Object.values(animations);
  if (animationValues.length === 0) return true;

  return animationValues.every((anim) => {
    const indices = Array.isArray(anim?.frames) ? anim.frames : [];
    if (indices.length === 0) return true;
    return indices.every((idx) => Number(idx) === 0);
  });
}

function parseAssetMeta(jsCode) {
  const assetIdMatch = jsCode.match(/getResult\("([^"]+)"\)/);
  const assetId = assetIdMatch?.[1];
  if (!assetId) throw new Error("Asset id not found in JS");

  // The generated library namespace and its exported root constructor use the
  // asset id. Minified local variable names are unstable, so matching a
  // particular assignment such as `t.Name = s` can accidentally select BMP_0.
  return { assetId, rootClassName: assetId };
}

function instantiateRoot(jsCode, assetId, rootClassName, atlasImage, atlasJson) {
  const stubs = buildCreateJsStubs();
  const queue = new stubs.LoadQueue();
  queue.setResult(assetId, createSpriteSheet(atlasImage, atlasJson));

  const fakeWindow = { AssetLoader: queue };
  const fakeCreateJs = {
    Bitmap: stubs.Bitmap,
    Container: stubs.Container,
    MovieClip: stubs.MovieClip,
    LoadQueue: stubs.LoadQueue
  };

  const runAssetCode = new Function(
    "window",
    "createjs",
    `${jsCode}; return (typeof Library !== "undefined" ? Library : null);`
  );

  const lib = runAssetCode(fakeWindow, fakeCreateJs);
  if (!lib) throw new Error("Library namespace not available");

  const rootNs = lib[rootClassName];
  const RootCtor = rootNs?.[rootClassName];
  if (!RootCtor) throw new Error(`Root class not found: ${rootClassName}`);

  return new RootCtor();
}

export function deriveCompanionUrls(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  const base = imageUrl.replace(/\.(webp|png)$/i, "");
  return {
    imageUrl,
    jsonUrl: `${base}.json`,
    jsUrl: `${base}.js`
  };
}

export async function composeAssetToDataUrl({
  jsonUrl,
  jsUrl,
  imageUrl,
  maxWidth = null,
  maxHeight = null,
  padding = 0,
  localizeSingleFrame = false
}) {
  const cacheKey = `${jsonUrl}|${jsUrl}|${imageUrl}|${maxWidth}|${maxHeight}|${padding}|${localizeSingleFrame}`;
  if (composedCache.has(cacheKey)) return composedCache.get(cacheKey);

  const task = (async () => {
    const jsonText = await fetchText(jsonUrl);
    const atlasJson = parseJsonSafely(jsonText);
    if (isSingleFrameAtlas(atlasJson)) {
      if (!localizeSingleFrame) return imageUrl;
      const singleImage = await loadImage(imageUrl);
      const naturalWidth = Math.max(1, singleImage.naturalWidth || singleImage.width || 1);
      const naturalHeight = Math.max(1, singleImage.naturalHeight || singleImage.height || 1);
      const fitWidth = Number.isFinite(maxWidth) && Number(maxWidth) > 0
        ? Math.max(1, Number(maxWidth) - padding)
        : Number.POSITIVE_INFINITY;
      const fitHeight = Number.isFinite(maxHeight) && Number(maxHeight) > 0
        ? Math.max(1, Number(maxHeight) - padding)
        : Number.POSITIVE_INFINITY;
      const scale = Math.min(1, fitWidth / naturalWidth, fitHeight / naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(naturalWidth * scale + padding));
      canvas.height = Math.max(1, Math.round(naturalHeight * scale + padding));
      const context = canvas.getContext("2d");
      context.drawImage(
        singleImage,
        padding / 2,
        padding / 2,
        naturalWidth * scale,
        naturalHeight * scale
      );
      return canvas.toDataURL("image/png");
    }

    const [jsCode, atlasImage] = await Promise.all([
      fetchText(jsUrl),
      loadImage(imageUrl)
    ]);
    const { assetId, rootClassName } = parseAssetMeta(jsCode);
    const root = instantiateRoot(jsCode, assetId, rootClassName, atlasImage, atlasJson);

    const measured = {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    };
    measureNodeBounds(root, createIdentityMatrix(), measured);

    const hasMeasuredBounds = Number.isFinite(measured.minX) && Number.isFinite(measured.maxX);
    const fallbackW = Number(atlasJson?.sourceSize?.w || 600);
    const fallbackH = Number(atlasJson?.sourceSize?.h || 400);
    const rawW = hasMeasuredBounds ? (measured.maxX - measured.minX) : fallbackW;
    const rawH = hasMeasuredBounds ? (measured.maxY - measured.minY) : fallbackH;

    const hasMaxW = Number.isFinite(maxWidth) && Number(maxWidth) > 0;
    const hasMaxH = Number.isFinite(maxHeight) && Number(maxHeight) > 0;
    const fitW = hasMaxW ? Math.max(1, Number(maxWidth) - padding) : Number.POSITIVE_INFINITY;
    const fitH = hasMaxH ? Math.max(1, Number(maxHeight) - padding) : Number.POSITIVE_INFINITY;
    const scale = Math.min(1, Math.min(fitW / Math.max(1, rawW), fitH / Math.max(1, rawH)));

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(rawW * scale + padding));
    canvas.height = Math.max(1, Math.round(rawH * scale + padding));

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    const offsetX = hasMeasuredBounds ? -measured.minX : -fallbackW / 2;
    const offsetY = hasMeasuredBounds ? -measured.minY : -fallbackH / 2;
    ctx.translate(padding / 2, padding / 2);
    ctx.scale(scale, scale);
    ctx.translate(offsetX, offsetY);
    drawNode(ctx, root);
    ctx.restore();

    return canvas.toDataURL("image/png");
  })();

  composedCache.set(cacheKey, task);
  try {
    return await task;
  } catch (err) {
    composedCache.delete(cacheKey);
    throw err;
  }
}
