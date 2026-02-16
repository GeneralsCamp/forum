import { fetchWithFallback } from "./Fetcher.mjs";

const textCache = new Map();
const blobCache = new Map();
const imageCache = new Map();
const composedCache = new Map();

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

function drawNode(ctx, node) {
  if (!node) return;

  const x = Number(node.x || 0);
  const y = Number(node.y || 0);
  const sx = Number(node.scaleX == null ? 1 : node.scaleX);
  const sy = Number(node.scaleY == null ? 1 : node.scaleY);
  const rot = Number(node.rotation || 0) * Math.PI / 180;
  const skewX = Number(node.skewX || 0) * Math.PI / 180;
  const skewY = Number(node.skewY || 0) * Math.PI / 180;

  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (skewX || skewY) ctx.transform(1, Math.tan(skewY), Math.tan(skewX), 1, 0, 0);
  ctx.scale(sx, sy);

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

  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  const translate = [1, 0, 0, 1, x, y];
  const rotate = [cos, sin, -sin, cos, 0, 0];
  const skew = [1, Math.tan(skewY), Math.tan(skewX), 1, 0, 0];
  const scale = [sx, 0, 0, sy, 0, 0];

  return multiplyMatrix(multiplyMatrix(multiplyMatrix(translate, rotate), skew), scale);
}

function expandBounds(bounds, x, y) {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
}

function measureNodeBounds(node, parentMatrix, bounds) {
  if (!node) return;
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
      const res = await fetchWithFallback(url);
      return res.text();
    })());
  }
  return textCache.get(url);
}

async function fetchBlob(url) {
  if (!blobCache.has(url)) {
    blobCache.set(url, (async () => {
      const res = await fetchWithFallback(url);
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

  const rootClassMatch = jsCode.match(/t\.([A-Za-z0-9_]+)\s*=\s*s;/);
  const rootClassName = rootClassMatch?.[1] || assetId;

  return { assetId, rootClassName };
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
  padding = 0
}) {
  const cacheKey = `${jsonUrl}|${jsUrl}|${imageUrl}|${maxWidth}|${maxHeight}|${padding}`;
  if (composedCache.has(cacheKey)) return composedCache.get(cacheKey);

  const task = (async () => {
    const [jsonText, atlasImage] = await Promise.all([
      fetchText(jsonUrl),
      loadImage(imageUrl)
    ]);

    const atlasJson = parseJsonSafely(jsonText);
    if (isSingleFrameAtlas(atlasJson)) {
      return imageUrl;
    }

    const jsCode = await fetchText(jsUrl);
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
