import { initCustomModal } from "./ModalService.mjs";

export function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function getEffectEntries(effectString, effectDefinitions) {
    if (!effectString) return [];

    return effectString
        .split(",")
        .map(entry => entry.trim())
        .filter(Boolean)
        .map(entry => {
            const [id] = entry.split("&");
            return {
                id,
                entry,
                definition: effectDefinitions?.[id]
            };
        });
}

export function itemHasEffectID(effectString, effectID, effectDefinitions) {
    return getEffectEntries(effectString, effectDefinitions).some(({ id }) =>
        String(id) === String(effectID)
    );
}

export function getEffectValueByID(effectString, effectID, effectDefinitions) {
    const match = getEffectEntries(effectString, effectDefinitions).find(({ id }) =>
        String(id) === String(effectID)
    );

    if (!match) return 0;
    const [, valueRaw = "0"] = match.entry.split("&");
    const valuePart = valueRaw.includes("+") ? valueRaw.split("+").pop() : valueRaw;
    return Number(valuePart) || 0;
}

export function formatDurationCompact(seconds) {
    const total = Number(seconds || 0);
    if (!total) return "";
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0 && days === 0) parts.push(`${mins}m`);
    return parts.length > 0 ? parts.join(" ") : "0m";
}

export function getAllianceLayoutName({ layout, lang }) {
    const layoutId = layout?.allianceCoatLayoutID;
    const langKey = layoutId ? `alliancecoat_layout_name_${layoutId}`.toLowerCase() : "";
    const localized = langKey ? lang?.[langKey] : "";
    const comment = String(layout?.comment1 || "").trim();
    const base = localized || comment || `Alliance CoA ${layoutId || "?"}`;
    const duration = formatDurationCompact(layout?.maxDuration);
    return duration ? `${base} (${duration})` : base;
}

export function cleanEffectTitle(value) {
    const cleaned = String(value || "")
        .replace(/\{[0-9]+\}/g, "")
        .replace(/[+\-]?\s*\d+(?:[.,]\d+)?\s*%?/g, "")
        .replace(/^[+\-]\s*/g, "")
        .replace(/\s*%/g, "")
        .replace(/\s*:+\s*$/g, "")
        .replace(/\s+/g, " ")
        .trim();

    return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned;
}

export function createEffectItemsModal({
    modalId = "effectItemsModal",
    getEffectDefinitions,
    getEffectCapsMap,
    getPercentEffectIDs,
    getLang,
    parseEffectEntry,
    getLocalizedEffectTitle,
    getRows
}) {
    const modal = initCustomModal({
        modalId,
        closeAnimMs: 190
    });

    function getPrimaryEffectByID(effectString, effectID) {
        const match = getEffectEntries(effectString, getEffectDefinitions()).find(({ id }) =>
            String(id) === String(effectID)
        );

        if (!match) return "";
        return (parseEffectEntry(match.entry)[0] || "")
            .replace(/\s*<span class="max-bonus"[^>]*>\(Max:[\s\S]*?<\/span>/g, "");
    }

    function createRow({ kind, name, id, imageUrl, effectText }) {
        return `
    <div class="effect-items-row">
      <div class="effect-items-image">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name)}" loading="lazy">
      </div>
      <div class="effect-items-info">
        <div class="effect-items-topline">
          <span class="effect-items-kind">${escapeHtml(kind)}</span>
          <span class="effect-items-kind effect-items-id">ID: ${escapeHtml(id)}</span>
        </div>
        <div class="effect-items-name">${escapeHtml(name)}</div>
        <div class="effect-items-effect">${effectText}</div>
      </div>
    </div>`;
    }

    function open({ effectID, capID }) {
        if (!effectID || !capID) return;

        const title = document.getElementById(`${modalId}Title`);
        const body = document.getElementById(`${modalId}Body`);
        if (!title || !body) return;

        const cap = getEffectCapsMap()?.[capID];
        const capSuffix = getPercentEffectIDs().has(String(effectID)) ? "%" : "";
        const capText = cap?.maxTotalBonus ? `Max: ${Number(cap.maxTotalBonus).toLocaleString()}${capSuffix}` : "";
        title.textContent = cleanEffectTitle(getLocalizedEffectTitle(effectID, getLang()));

        const rows = getRows({
            effectID,
            itemHasEffectID: (effectString) =>
                itemHasEffectID(effectString, effectID, getEffectDefinitions()),
            getEffectValueByID: (effectString) =>
                getEffectValueByID(effectString, effectID, getEffectDefinitions()),
            getPrimaryEffectByID
        }).sort((a, b) => Number(b.sortValue || 0) - Number(a.sortValue || 0));

        body.innerHTML = rows.length
            ? `
      <div class="effect-items-summary">
        <span>Effect ID: ${escapeHtml(effectID)}</span>
        ${capText ? `<span>${escapeHtml(capText)}</span>` : ""}
      </div>
      <div class="effect-items-list">
        ${rows.map(createRow).join("")}
      </div>`
            : `<div class="effect-items-empty">No matching items.</div>`;

        modal.open();
    }

    function bind(root = document) {
        root.querySelectorAll(".max-bonus").forEach(span => {
            if (span.dataset.capBound === "1") return;
            span.dataset.capBound = "1";
            const openFromSpan = (event) => {
                event.preventDefault();
                event.stopPropagation();
                const capID = span.dataset.capid;
                const effectID = span.dataset.effectid;
                if (!capID) return;

                open({ effectID, capID });
            };

            span.addEventListener("click", openFromSpan);
            span.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    openFromSpan(event);
                }
            });
        });
    }

    return { bind, open };
}
