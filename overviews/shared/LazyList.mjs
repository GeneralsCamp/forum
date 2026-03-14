export function createLazyList({
  containerSelector,
  contentSelector = "#content",
  initialBatchSize = 40,
  batchSize = 30,
  revealBuffer = 12,
  emptyHtml = "",
  onRenderBatch,
  onAfterBatch
} = {}) {
  const container =
    typeof containerSelector === "string"
      ? document.querySelector(containerSelector)
      : containerSelector;

  if (!container) {
    throw new Error("LazyList: container not found.");
  }
  if (typeof onRenderBatch !== "function") {
    throw new Error("LazyList: onRenderBatch is required.");
  }

  let items = [];
  let renderCount = 0;
  let observer = null;
  let sentinel = null;
  let isLoadingBatch = false;
  let scrollRoot = null;
  let scrollTarget = null;

  const onScroll = () => {
    renderUntilSentinelOut();
  };

  function resolveEmptyHtml(customEmpty) {
    if (typeof customEmpty === "function") return customEmpty();
    if (typeof customEmpty === "string" && customEmpty) return customEmpty;
    if (typeof emptyHtml === "function") return emptyHtml();
    return emptyHtml || "";
  }

  function ensureSentinel() {
    if (!sentinel) {
      sentinel = document.createElement("div");
      sentinel.id = "cards-sentinel";
      sentinel.className = "col-12";
    }
    container.appendChild(sentinel);
  }

  function setupObserver() {
    if (!sentinel) return;
    if (observer) observer.disconnect();

    scrollRoot = contentSelector
      ? document.querySelector(contentSelector)
      : null;

    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        renderUntilSentinelOut();
      }
    }, { root: scrollRoot, rootMargin: "200px" });

    observer.observe(sentinel);

    const nextScrollTarget = scrollRoot || window;
    if (scrollTarget !== nextScrollTarget) {
      if (scrollTarget) {
        scrollTarget.removeEventListener("scroll", onScroll);
      }
      scrollTarget = nextScrollTarget;
      scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    }
  }

  function isSentinelInView() {
    if (!sentinel) return false;
    const rect = sentinel.getBoundingClientRect();
    if (scrollRoot) {
      const rootRect = scrollRoot.getBoundingClientRect();
      return rect.top <= rootRect.bottom + 200;
    }
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    return rect.top <= viewportHeight + 200;
  }

  function renderUntilSentinelOut() {
    if (!isSentinelInView()) return;
    renderNextBatch();
    if (renderCount < items.length && isSentinelInView()) {
      requestAnimationFrame(renderUntilSentinelOut);
    }
  }

  function renderNextBatch() {
    if (isLoadingBatch) return;
    if (renderCount >= items.length) return;

    isLoadingBatch = true;
    const nextCount = Math.min(items.length, renderCount + batchSize);
    const batch = items.slice(renderCount, nextCount);
    renderCount = nextCount;

    onRenderBatch(batch, { container, sentinel });
    if (typeof onAfterBatch === "function") onAfterBatch({ container, sentinel });

    isLoadingBatch = false;

    if (renderCount >= items.length && observer) {
      observer.disconnect();
    }
  }

  function reset(nextItems, { revealIndex = null, emptyHtml: customEmpty } = {}) {
    container.innerHTML = "";
    items = Array.isArray(nextItems) ? nextItems : [];
    renderCount = 0;

    if (!items.length) {
      container.innerHTML = resolveEmptyHtml(customEmpty);
      if (observer) observer.disconnect();
      return;
    }

    const baseCount = Math.min(initialBatchSize, items.length);
    if (revealIndex !== null && revealIndex >= 0) {
      renderCount = Math.min(
        items.length,
        Math.max(baseCount, revealIndex + revealBuffer)
      );
    } else {
      renderCount = baseCount;
    }

    ensureSentinel();
    onRenderBatch(items.slice(0, renderCount), { container, sentinel });
    if (typeof onAfterBatch === "function") onAfterBatch({ container, sentinel });
    setupObserver();
    renderUntilSentinelOut();
    if (renderCount >= items.length && observer) {
      observer.disconnect();
    }
  }

  return {
    reset
  };
}