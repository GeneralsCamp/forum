export function handleAutoHeight({
    contentSelector = "#content",
    subtractSelectors = [".note", ".page-title"],
    extraOffset = 0
} = {}) {

    const content = document.querySelector(contentSelector);
    if (!content) return;

    let subtract = extraOffset;

    subtractSelectors.forEach(sel => {
        const el = document.querySelector(sel);
        if (el) subtract += el.offsetHeight;
    });

    const newHeight = window.innerHeight - subtract;
    content.style.height = `${newHeight}px`;
}

export function initAutoHeight(options) {
    const handler = () => handleAutoHeight(options);

    window.addEventListener("resize", handler);
    window.addEventListener("DOMContentLoaded", handler);
}
