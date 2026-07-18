import { getSelectedGameSource, setSelectedGameSource } from "../shared/GameSettings.mjs";
import { getInitialLanguage } from "../shared/LanguageService.mjs";

let ownLang = {};
const currentLanguage = getInitialLanguage();

async function loadOwnLang() {
    try {
        const response = await fetch("./ownLang.json");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        ownLang = await response.json();
    } catch (error) {
        console.error("Error loading ownLang.json:", error);
        ownLang = {};
    }
}

function ui(key, fallback) {
    const language = String(currentLanguage || "en").toLowerCase();
    const baseLanguage = language.split("-")[0];
    return ownLang?.[language]?.ui?.[key]
        || ownLang?.[baseLanguage]?.ui?.[key]
        || ownLang?.en?.ui?.[key]
        || fallback;
}

const eventSources = {
    empire: {
        label: "Empire (Computer)",
        url: "https://communityhub.goodgamestudios.com/newshubempire/"
    },
    e4k: {
        label: "Empire: Four Kingdoms (Phone)",
        url: "https://communityhub.goodgamestudios.com/newshube4k/"
    }
};

const viewOptions = [
    { value: "overview", label: "Normal view" },
    { value: "calendar", label: "Calendar view" }
];

const proxyUrl = "https://my-proxy-8u49.onrender.com/";
const placeholderImage = "";

const customEventImages = [
    { name: "LTPE", url: "../../img_base/event_icons/ltpe.webp", priority: 12, nickname: "" },
    { name: "Nomad Invasion", url: "../../img_base/event_icons/nomadinvasion.webp", priority: 1, nickname: "" },
    { name: "War of the Realms", url: "../../img_base/event_icons/waroftherealms.webp", priority: 4, nickname: "" },
    { name: "Bloodcrow Invasion", url: "../../img_base/event_icons/bloodcrow.webp", priority: 3, nickname: "" },
    { name: "Samurai Invasion", url: "../../img_base/event_icons/samuraiinvasion.webp", priority: 2, nickname: "" },
    { name: "Berimond", url: "../../img_base/event_icons/berimond.webp", priority: 7, nickname: "" },
    { name: "Beyond the Horizon", url: "../../img_base/event_icons/beyondthehorizon.webp", priority: 5, nickname: "" },
    { name: "Outer Realms", url: "../../img_base/event_icons/outerrealms.webp", priority: 6, nickname: "" },
    { name: "The Imperial Patronage", url: "../../img_base/event_icons/patronage.webp", priority: 9, nickname: "Imperial Patronage" },
    { name: "The Bladecoast", url: "../../img_base/event_icons/bladecoast.webp", priority: 10, nickname: "" },
    { name: "The Grand Tournament", url: "../../img_base/event_icons/grandtournament.webp", priority: 11, nickname: "Grand Tournament" },
    { name: "Rift Raid", url: "../../img_base/event_icons/riftraid.webp", priority: 8, nickname: "" }
];

const eventTitleAliases = {
    "berimond invasion": "Berimond",
    "berimond": "Berimond",
    "beyondthehorizon": "Beyond the Horizon",
    "bladecoast": "The Bladecoast",
    "bloodcrow": "Bloodcrow Invasion",
    "grand nobility contest": "LTPE",
    "grandtournament": "The Grand Tournament",
    "imperial patronage": "The Imperial Patronage",
    "ltpe": "LTPE",
    "nomadinvasion": "Nomad Invasion",
    "outerrealms": "Outer Realms",
    "patronage": "The Imperial Patronage",
    "riftraid": "Rift Raid",
    "samuraiinvasion": "Samurai Invasion",
    "grand tournament": "The Grand Tournament",
    "waroftherealms": "War of the Realms"
};

const eventCache = {
    empire: null,
    e4k: null
};

const gameIcons = {
    empire: "../../img_base/event_icons/logo-em.webp",
    e4k: "../../img_base/event_icons/logo-e4k.webp"
};
const scheduleFooterLines = [
    "Dates are shown in day/month format.",
    "The schedule is subject to change."
];

function lightenColor(hexColor, amount) {
    const hex = String(hexColor || "").replace("#", "").trim();
    if (hex.length !== 6) return hexColor;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const mix = value => Math.round(value + (255 - value) * amount);
    const out = [mix(r), mix(g), mix(b)]
        .map(val => val.toString(16).padStart(2, "0"))
        .join("");
    return `#${out}`;
}

const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
];

function renderScheduleHeader(container) {
    const gameKey = getSelectedGameKey();
    const label = eventSources[gameKey]?.label || gameKey;
    const iconUrl = gameIcons[gameKey] || "";

    const header = document.createElement("div");
    header.className = "schedule-header";

    if (iconUrl) {
        const img = document.createElement("img");
        img.className = "schedule-header-icon";
        img.src = iconUrl;
        img.alt = label;
        img.loading = "lazy";
        header.appendChild(img);
    }

    const title = document.createElement("div");
    title.className = "schedule-header-title";
    title.textContent = label;

    header.appendChild(title);

    container.appendChild(header);
}

function normalizeText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
}

function canonicalizeEventTitle(title) {
    const cleaned = normalizeText(title);
    const alias = eventTitleAliases[cleaned.toLowerCase()];
    return alias || cleaned;
}

function extractDateTokens(text) {
    const tokens = [];
    const regex = /(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)(?:\s*[-\u2013]\s*(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?))?/g;
    let match = null;

    while ((match = regex.exec(text)) !== null) {
        const start = match[1];
        const end = match[2];
        const token = end ? `${start}-${end}` : start;
        tokens.push(token.replace(/[.,;]+$/, ""));
    }

    return Array.from(new Set(tokens));
}

function extractDates(text, title) {
    const cleaned = normalizeText(text);
    const withoutTitle = title ? cleaned.replace(title, "").trim() : cleaned;
    const tokens = extractDateTokens(withoutTitle);
    if (tokens.length > 0) return tokens;

    if (!/\d/.test(withoutTitle)) return [];

    return withoutTitle
        .split(/,|\n/)
        .map(part => normalizeText(part))
        .filter(Boolean)
        .slice(0, 12);
}

function lineHasDateToken(line) {
    return /(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)/.test(line);
}

function extractDateGroups(rawText, title) {
    const lines = String(rawText || "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
    if (lines.length === 0) return null;

    const titleLower = String(title || "").toLowerCase();
    let removedTitle = false;
    const cleaned = [];
    lines.forEach(line => {
        const normalized = normalizeText(line).toLowerCase();
        if (!removedTitle && titleLower && normalized === titleLower) {
            removedTitle = true;
            return;
        }
        cleaned.push(line);
    });

    const groups = [];
    let currentLabel = "";
    let currentDates = [];
    let hasLabel = false;

    const flush = () => {
        if (currentLabel || currentDates.length > 0) {
            groups.push({ label: currentLabel, dates: currentDates });
        }
        currentLabel = "";
        currentDates = [];
    };

    cleaned.forEach(line => {
        if (lineHasDateToken(line)) {
            currentDates.push(line);
            return;
        }
        if (currentDates.length > 0 || currentLabel) {
            flush();
        }
        currentLabel = line;
        hasLabel = true;
    });

    flush();

    const filtered = groups.filter(group => group.dates && group.dates.length > 0);
    if (!hasLabel) return null;
    return filtered.length > 0 ? filtered : null;
}

function extractLinesFromNode(node) {
    if (!node) return [];
    if (node.tagName && node.tagName.toLowerCase() === "p") {
        const html = node.innerHTML.replace(/<br\s*\/?>/gi, "\n");
        const temp = node.ownerDocument
            ? node.ownerDocument.createElement("div")
            : document.createElement("div");
        temp.innerHTML = html;
        return String(temp.textContent || "")
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);
    }
    return String(node.textContent || "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
}


function parseDateToken(token) {
    const match = String(token || "").match(/(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?/);
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    let year = match[3] ? Number(match[3]) : null;
    if (!year) return null;
    if (year < 100) year += 2000;
    if (!day || !month) return null;
    return new Date(Date.UTC(year, month - 1, day));
}

function parseDateRange(text) {
    const tokens = String(text || "").match(/(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)/g) || [];
    if (tokens.length === 0) return null;
    const readYear = token => {
        const m = String(token || "").match(/\d{1,2}[./-]\d{1,2}[./-](\d{2,4})/);
        if (!m) return null;
        let y = Number(m[1]);
        if (!y) return null;
        if (y < 100) y += 2000;
        return y;
    };

    const parseWithFallbackYear = (token, fallbackYear) => {
        const m = String(token || "").match(/(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?/);
        if (!m) return null;
        const day = Number(m[1]);
        const month = Number(m[2]);
        let year = m[3] ? Number(m[3]) : fallbackYear;
        if (!year || !day || !month) return null;
        if (year < 100) year += 2000;
        return new Date(Date.UTC(year, month - 1, day));
    };

    const secondToken = tokens[1] || tokens[0];
    const currentYear = new Date().getFullYear();
    const fallbackYear =
        readYear(secondToken) ||
        readYear(tokens[0]) ||
        currentYear;

    const start = parseWithFallbackYear(tokens[0], fallbackYear);
    let end = parseWithFallbackYear(secondToken, fallbackYear);
    if (!start || !end) return null;
    if (end.getTime() < start.getTime()) {
        end = new Date(Date.UTC(end.getUTCFullYear() + 1, end.getUTCMonth(), end.getUTCDate()));
    }
    return { start, end };
}

function formatDateForDisplay(date) {
    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${day}/${month}`;
}

function formatDateRangeForDisplay(text) {
    const parsed = parseDateRange(text);
    if (!parsed) {
        return normalizeText(text)
            .replace(/\/\d{4}\b/g, "")
            .replace(/\b\d{4}\b/g, "")
            .replace(/\s*[-\u2013]\s*/g, "-")
            .replace(/\s{2,}/g, " ")
            .replace(/\s*([-/])\s*/g, "$1")
            .trim();
    }
    return `${formatDateForDisplay(parsed.start)}-${formatDateForDisplay(parsed.end)}`;
}

function normalizeUtcDate(date) {
    if (!date) return null;
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function rangesOverlap(a, b) {
    const aStart = normalizeUtcDate(a.start).getTime();
    const aEnd = normalizeUtcDate(a.end).getTime();
    const bStart = normalizeUtcDate(b.start).getTime();
    const bEnd = normalizeUtcDate(b.end).getTime();
    return bStart <= aEnd && bEnd >= aStart;
}

function getSortedEvents(events) {
    return [...events].sort((a, b) => {
        const aMatch = customEventImages.find(entry => entry.name.toLowerCase() === a.title.toLowerCase());
        const bMatch = customEventImages.find(entry => entry.name.toLowerCase() === b.title.toLowerCase());
        const aPriority = aMatch ? aMatch.priority : Number.POSITIVE_INFINITY;
        const bPriority = bMatch ? bMatch.priority : Number.POSITIVE_INFINITY;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.title.localeCompare(b.title);
    });
}

function getDisplayTitle(title) {
    const match = customEventImages.find(
        entry => entry.name.toLowerCase() === title.toLowerCase()
    );
    if (match && match.nickname) return match.nickname;
    return title;
}

function getContentRoot(doc) {
    const candidates = [
        doc.querySelector(".entry-content"),
        doc.querySelector("article"),
        doc.querySelector("main"),
        doc.body
    ].filter(Boolean);

    return candidates.find(node => {
        if (node.querySelector(".e-grid.e-con, .elementor-element.e-grid")) return true;
        return Array.from(node.querySelectorAll("p, h1, h2, h3"))
            .some(textNode => isKnownEventTitle(normalizeText(textNode.textContent || "")));
    }) || candidates[0] || doc.body;
}

function resolveImageUrl(src, baseUrl) {
    if (!src) return "";
    try {
        return new URL(src, baseUrl).href;
    } catch (err) {
        return src;
    }
}

function getImageSource(img) {
    if (!img) return "";
    return (
        img.getAttribute("data-orig-file") ||
        img.getAttribute("data-large-file") ||
        img.currentSrc ||
        img.getAttribute("src") ||
        ""
    );
}

function isKnownEventTitle(title) {
    const canonical = canonicalizeEventTitle(title).toLowerCase();
    return customEventImages.some(entry => entry.name.toLowerCase() === canonical);
}

function extractElementorEventCards(root, baseUrl) {
    const upcomingHeading = Array.from(root.querySelectorAll("h1, h2, h3, p"))
        .find(node => normalizeText(node.textContent || "").toLowerCase() === "upcoming events");

    const sourceContainers = upcomingHeading
        ? [
            upcomingHeading.closest(".elementor-element, .e-con")?.nextElementSibling,
            upcomingHeading.parentElement?.nextElementSibling
        ].filter(Boolean)
        : [];

    sourceContainers.push(
        ...Array.from(root.querySelectorAll(".e-grid.e-con, .elementor-element.e-grid"))
            .filter(container => container.querySelector(".e-con.e-child img, .e-con-full.e-con img"))
    );

    if (sourceContainers.length === 0) sourceContainers.push(root);

    const cards = sourceContainers.flatMap(container =>
        Array.from(container.querySelectorAll(".e-con.e-child, .e-con-full.e-con"))
    )
        .filter(card => card.querySelector("img"));
    const events = [];

    cards.forEach(card => {
        const img = card.querySelector("img");
        const textNodes = Array.from(card.querySelectorAll("p, h1, h2, h3"))
            .map(node => ({
                node,
                text: normalizeText(node.textContent || "")
            }))
            .filter(entry => entry.text);

        const titleEntry = textNodes.find(entry => isKnownEventTitle(entry.text));
        const imageTitle = normalizeText(img?.getAttribute("data-image-title") || img?.alt || "");
        const rawTitle = titleEntry?.text || imageTitle;
        const title = canonicalizeEventTitle(rawTitle);
        if (!isKnownEventTitle(title)) return;

        const dateNode = textNodes
            .filter(entry => entry.node !== titleEntry?.node)
            .find(entry => lineHasDateToken(entry.text));
        const dateLines = dateNode ? extractLinesFromNode(dateNode.node) : [];
        const dateGroups = dateNode ? extractDateGroups(dateLines.join("\n"), title) : null;
        const dates = dateGroups
            ? dateGroups.flatMap(group => group.dates)
            : dateLines.filter(lineHasDateToken);
        const imageUrl = resolveImageUrl(getImageSource(img), baseUrl);

        if (dates.length === 0 && !imageUrl) return;
        events.push({ title, dates, dateGroups, imageUrl });
    });

    const seen = new Set();
    return events.filter(event => {
        const groupsKey = (event.dateGroups || [])
            .map(group => `${group.label || ""}:${(group.dates || []).join("|")}`)
            .join("||");
        const key = `${event.title}::${groupsKey || event.dates.join(",")}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function extractEventFromBlock(block, baseUrl) {
    const img = block.querySelector("img");
    const heading = block.querySelector("h1, h2, h3, h4, strong, b");
    const title =
        normalizeText(heading ? heading.textContent : "") ||
        normalizeText(img ? img.alt : "") ||
        "";
    const text = normalizeText(block.textContent || "");
    const dates = extractDates(text, title);
    const imageUrl = resolveImageUrl(getImageSource(img), baseUrl);

    if (!title && dates.length === 0) return null;

    return {
        title: title || "Ismeretlen esemény",
        dates,
        imageUrl
    };
}

function extractEventFromImage(img, baseUrl) {
    const parent =
        img.closest("figure, .wp-block-image, .wp-block-media-text, p, div") || img.parentElement;
    if (!parent) return null;

    let text = normalizeText(parent.textContent || "");
    const next = parent.nextElementSibling;
    if (next && !next.querySelector("img")) {
        text = normalizeText(`${text} ${next.textContent || ""}`);
    }

    const prevHeading =
        parent.previousElementSibling &&
        parent.previousElementSibling.querySelector("h1, h2, h3, h4");
    let title =
        normalizeText(img.alt || "") ||
        normalizeText(prevHeading ? prevHeading.textContent : "");

    if (!title && text) {
        const firstChunk = text.split(/,|\n/).map(part => normalizeText(part))[0];
        if (firstChunk && !/\d/.test(firstChunk)) {
            title = firstChunk;
        }
    }

    const dates = extractDates(text, title);
    const imageUrl = resolveImageUrl(getImageSource(img), baseUrl);

    if (!title && dates.length === 0) return null;

    return {
        title: title || "Ismeretlen esemény",
        dates,
        imageUrl
    };
}

function extractEventsByHeadings(root, baseUrl) {
    const headingSelectors = "h2, h3";
    let headings = Array.from(root.querySelectorAll(headingSelectors));
    if (headings.length === 0) {
        headings = Array.from(root.querySelectorAll("h1"));
    }

    const events = [];
    headings.forEach(heading => {
        const title = normalizeText(heading.textContent || "");
        if (!title) return;
        const lower = title.toLowerCase();
        if (lower.includes("event plan") || lower.includes("eventplan")) return;
        if (lower.includes("current ltpe") || lower.includes("upcoming ltpe")) return;

        let imageUrl = "";
        const textParts = [title];
        let node = heading.nextElementSibling;

        while (node && !node.matches(headingSelectors)) {
            const img = node.querySelector && node.querySelector("img");
            if (!imageUrl && img) {
                imageUrl = resolveImageUrl(getImageSource(img), baseUrl);
            }
            if (node.textContent) {
                textParts.push(node.textContent);
            }
            node = node.nextElementSibling;
        }

        const combinedText = normalizeText(textParts.join(" "));
        const dates = extractDates(combinedText, title);
        if (dates.length === 0 && !imageUrl) return;

        events.push({
            title,
            dates,
            imageUrl
        });
    });

    return events;
}

function extractEventsFromGroups(root, baseUrl) {
    const groups = Array.from(root.querySelectorAll(".wp-block-group"));
    const events = [];
    const titleSelector = "p.has-x-large-font-size, p.has-large-font-size, h2, h3";

    groups.forEach(group => {
        const titles = Array.from(group.querySelectorAll(titleSelector))
            .filter(node => node.closest(".wp-block-group") === group);
        if (titles.length === 0) return;

        titles.forEach(titleNode => {
            const title = normalizeText(titleNode.textContent || "");
            if (!title) return;

            const lower = title.toLowerCase();
            if (lower.includes("event plan") || lower.includes("eventplan")) return;
            if (lower.includes("current ltpe") || lower.includes("upcoming ltpe")) return;

            const rawLines = [title];
            let imageUrl = "";
            let node = titleNode.nextElementSibling;

            while (node && !node.matches(titleSelector)) {
                if (node.classList && node.classList.contains("wp-block-group")) {
                    break;
                }
                if (!imageUrl) {
                    const img = node.querySelector && node.querySelector("img");
                    if (img) {
                        imageUrl = resolveImageUrl(getImageSource(img), baseUrl);
                    }
                }
                rawLines.push(...extractLinesFromNode(node));
                node = node.nextElementSibling;
            }

            const rawText = rawLines.join("\n");
            const dateGroups = extractDateGroups(rawText, title);
            const dates = dateGroups
                ? dateGroups.flatMap(group => group.dates)
                : extractDates(normalizeText(rawText), title);
            if (dates.length === 0 && !imageUrl) return;

            events.push({
                title,
                dates,
                dateGroups,
                imageUrl
            });
        });
    });

    return events;
}

function extractEventsFromCardGrid(root, baseUrl) {
    const cards = Array.from(root.querySelectorAll(".grid .card, .card"));
    if (cards.length === 0) return [];

    const events = [];

    cards.forEach(card => {
        const titleNode = card.querySelector(".card-title");
        const img = card.querySelector("img.event-icon, img");
        const title =
            normalizeText(titleNode ? titleNode.textContent : "") ||
            normalizeText(img ? img.alt : "");

        const imageUrl = resolveImageUrl(getImageSource(img), baseUrl);
        const dateGroups = [];

        let activeLabel = "";
        const children = Array.from(card.children);
        children.forEach(node => {
            if (node.classList?.contains("sub-label")) {
                activeLabel = normalizeText(node.textContent || "");
                return;
            }
            if (node.matches?.("ul.dates")) {
                const dates = Array.from(node.querySelectorAll("li"))
                    .map(li => normalizeText(li.textContent || ""))
                    .filter(Boolean);
                if (dates.length > 0) {
                    dateGroups.push({ label: activeLabel, dates });
                }
                activeLabel = "";
            }
        });

        const dates = dateGroups.flatMap(group => group.dates);
        if (!title && dates.length === 0) return;

        events.push({
            title: title || "Ismeretlen esemény",
            dates,
            dateGroups: dateGroups.length > 0 ? dateGroups : null,
            imageUrl
        });
    });

    const seen = new Set();
    return events.filter(event => {
        const groupsKey = (event.dateGroups || [])
            .map(group => `${group.label || ""}:${(group.dates || []).join("|")}`)
            .join("||");
        const key = `${event.title}::${groupsKey || event.dates.join(",")}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function extractEvents(doc, baseUrl) {
    const root = getContentRoot(doc);
    const elementorEvents = extractElementorEventCards(root, baseUrl);
    if (elementorEvents.length > 0) {
        return elementorEvents;
    }

    const cardGridEvents = extractEventsFromCardGrid(root, baseUrl);
    if (cardGridEvents.length > 0) {
        return cardGridEvents;
    }
    const groupEvents = extractEventsFromGroups(root, baseUrl);
    if (groupEvents.length > 0) {
        return groupEvents;
    }
    const headingEvents = extractEventsByHeadings(root, baseUrl);
    if (headingEvents.length > 0) {
        return headingEvents;
    }

    const blocks = Array.from(
        root.querySelectorAll(
            ".event-plan-item, .eventplan-item, .gge-event, [class*='eventplan'], [class*='event-plan']"
        )
    );

    let events = [];
    if (blocks.length > 0) {
        events = blocks
            .map(block => extractEventFromBlock(block, baseUrl))
            .filter(Boolean);
    } else {
        const images = Array.from(root.querySelectorAll("img"));
        events = images
            .map(img => extractEventFromImage(img, baseUrl))
            .filter(Boolean);
    }

    const seen = new Set();
    return events.filter(event => {
        const key = `${event.title}::${event.dates.join(",")}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

async function fetchWithFallback(url, timeout = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(proxyUrl + url, { signal: controller.signal });
        if (!response.ok) throw new Error(`${proxyUrl}: bad response`);
        return response;
    } finally {
        clearTimeout(timer);
    }
}

async function fetchEventPlanHtml(url) {
    const res = await fetchWithFallback(url);
    return res.text();
}

function ensureEventGrid() {
    let grid = document.getElementById("eventGrid");
    if (grid) return grid;

    const content = document.getElementById("content");
    if (!content) return null;

    grid = document.createElement("div");
    grid.id = "eventGrid";
    grid.className = "event-grid";

    content.appendChild(grid);
    return grid;
}

function updateEventColumnBorders(container) {
    if (!container) return;
    const columns = Math.max(
        1,
        getComputedStyle(container).gridTemplateColumns.trim().split(/\s+/).length
    );
    container.classList.remove(
        "event-grid-columns-1",
        "event-grid-columns-2",
        "event-grid-columns-3",
        "event-grid-columns-4"
    );
    container.classList.add(`event-grid-columns-${Math.min(columns, 4)}`);
    const cards = Array.from(container.querySelectorAll(":scope > .event-card"));
    cards.forEach((card, index) => {
        card.classList.toggle("event-card-last-column", (index + 1) % columns === 0);
    });
}

function renderEvents(events) {
    const container = ensureEventGrid();
    if (!container) return;
    container.innerHTML = "";
    container.style.visibility = "visible";
    removeDateFormatNote();
    renderScheduleHeader(container);

    if (!events || events.length === 0) {
        const empty = document.createElement("div");
        empty.className = "event-card";
        empty.textContent = "No events available.";
        container.appendChild(empty);
        return;
    }

    const sortedEvents = getSortedEvents(events);

    sortedEvents.forEach(event => {
        const card = document.createElement("div");
        card.className = "event-card";

        const img = document.createElement("img");
        const custom = customEventImages.find(entry =>
            entry.url && entry.name.toLowerCase() === event.title.toLowerCase()
        );
        img.className = "event-icon";
        img.alt = event.title;
        img.loading = "lazy";
        if (custom) {
            img.src = custom.url;
        } else if (event.imageUrl) {
            img.src = event.imageUrl;
        } else {
            img.src = placeholderImage;
            img.classList.add("event-icon-empty");
        }

        const meta = document.createElement("div");
        meta.className = "event-meta";

        const title = document.createElement("h3");
        title.className = "event-title";
        title.textContent = getDisplayTitle(event.title);

        if (event.dateGroups && event.dateGroups.length > 0) {
            const groupWrap = document.createElement("div");
            groupWrap.className = "event-date-groups";

            event.dateGroups.forEach(group => {
                if (group.label) {
                    const subtitle = document.createElement("div");
                    subtitle.className = "event-subtitle";
                    subtitle.textContent = group.label;
                    groupWrap.appendChild(subtitle);
                }
                const groupDates = document.createElement("p");
                groupDates.className = "event-dates event-dates-group";
                group.dates.forEach(date => {
                    const span = document.createElement("span");
                    span.textContent = formatDateRangeForDisplay(date);
                    groupDates.appendChild(span);
                });
                groupWrap.appendChild(groupDates);
            });

            meta.appendChild(title);
            meta.appendChild(groupWrap);
        } else {
            const dates = document.createElement("p");
            dates.className = "event-dates";

            if (event.dates.length > 0) {
                event.dates.forEach(date => {
                    const span = document.createElement("span");
                    span.textContent = formatDateRangeForDisplay(date);
                    dates.appendChild(span);
                });
            } else {
                dates.textContent = "No date data.";
            }

            meta.appendChild(title);
            meta.appendChild(dates);
        }

        card.appendChild(img);
        card.appendChild(meta);
        container.appendChild(card);
    });

    ensureDateFormatNote(container);
    updateEventColumnBorders(container);
}

function renderCalendar(events) {
    const container = ensureEventGrid();
    if (!container) return;
    container.innerHTML = "";
    container.style.visibility = "visible";
    removeDateFormatNote();

    if (!events || events.length === 0) {
        const empty = document.createElement("div");
        empty.className = "event-card";
        empty.textContent = "No events available.";
        container.appendChild(empty);
        return;
    }

    const sortedEvents = getSortedEvents(events);
    const rangesByEvent = sortedEvents.map(event => {
        let ranges = [];
        if (event.dateGroups && event.dateGroups.length > 0) {
            event.dateGroups.forEach(group => {
                const label = group.label || "";
                (group.dates || []).forEach(dateText => {
                    const parsed = parseDateRange(dateText);
                    if (parsed) {
                        ranges.push({ start: parsed.start, end: parsed.end, label });
                    }
                });
            });
        } else {
            ranges = (event.dates || [])
                .map(parseDateRange)
                .filter(Boolean)
                .map(range => ({ start: range.start, end: range.end, label: "" }));
        }
        return { title: event.title, ranges, imageUrl: event.imageUrl };
    });

    const altLightTitles = new Set(["outer realms", "beyond the horizon"]);
    rangesByEvent.forEach(entry => {
        if (!altLightTitles.has(entry.title.toLowerCase())) return;
        const sortedRanges = [...entry.ranges].sort((a, b) => {
            const aStart = normalizeUtcDate(a.start).getTime();
            const bStart = normalizeUtcDate(b.start).getTime();
            return aStart - bStart;
        });
        let prev = null;
        let alt = false;
        sortedRanges.forEach(range => {
            if (prev && rangesOverlap(prev, range)) {
                alt = !alt;
            } else {
                alt = false;
            }
            range.lightenAlt = alt;
            prev = range;
        });
    });

    const nonLtpeRanges = rangesByEvent
        .filter(entry => entry.title.toLowerCase() !== "ltpe")
        .flatMap(entry => entry.ranges);
    const minNonLtpeDate = nonLtpeRanges.length > 0
        ? new Date(Math.min(...nonLtpeRanges.map(range => normalizeUtcDate(range.start).getTime())))
        : null;
    const maxNonLtpeDate = nonLtpeRanges.length > 0
        ? new Date(Math.max(...nonLtpeRanges.map(range => normalizeUtcDate(range.end).getTime())))
        : null;

    if (minNonLtpeDate || maxNonLtpeDate) {
        rangesByEvent.forEach(entry => {
            if (entry.title.toLowerCase() !== "ltpe") return;
            entry.ranges = entry.ranges
                .map(range => {
                    const adjusted = { ...range };
                    if (
                        minNonLtpeDate &&
                        normalizeUtcDate(adjusted.start).getTime() < minNonLtpeDate.getTime()
                    ) {
                        adjusted.start = new Date(minNonLtpeDate.getTime());
                        adjusted.trimmedStart = true;
                    }
                    if (
                        maxNonLtpeDate &&
                        normalizeUtcDate(adjusted.end).getTime() > maxNonLtpeDate.getTime()
                    ) {
                        adjusted.end = new Date(maxNonLtpeDate.getTime());
                        adjusted.trimmedEnd = true;
                    }
                    if (normalizeUtcDate(adjusted.start).getTime() > normalizeUtcDate(adjusted.end).getTime()) {
                        return null;
                    }
                    return adjusted;
                })
                .filter(Boolean);
        });
    }

    const allRanges = rangesByEvent.flatMap(entry => entry.ranges);
    if (allRanges.length === 0) {
        const empty = document.createElement("div");
        empty.className = "event-card";
        empty.textContent = "No calendar data available.";
        container.appendChild(empty);
        return;
    }

    const minDate = new Date(Math.min(...allRanges.map(r => r.start.getTime())));
    const maxDate = new Date(Math.max(...allRanges.map(r => r.end.getTime())));

    const dates = [];
    const cursor = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), minDate.getUTCDate()));
    while (cursor.getTime() <= maxDate.getTime()) {
        dates.push(new Date(cursor.getTime()));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const berlinParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Berlin",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());

    const berlinYear = Number(berlinParts.find(p => p.type === "year")?.value);
    const berlinMonth = Number(berlinParts.find(p => p.type === "month")?.value);
    const berlinDay = Number(berlinParts.find(p => p.type === "day")?.value);

    const todayUtc = new Date(Date.UTC(berlinYear, berlinMonth - 1, berlinDay));

    const months = [];
    dates.forEach(date => {
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth();
        const last = months[months.length - 1];
        if (!last || last.month !== month || last.year !== year) {
            months.push({ year, month, count: 1 });
        } else {
            last.count += 1;
        }
    });

    const wrapper = document.createElement("div");
    wrapper.className = "calendar-scroll";

    const table = document.createElement("table");
    table.className = "calendar-table";

    const thead = document.createElement("thead");
    const monthRow = document.createElement("tr");
    monthRow.className = "calendar-month-row";
    const monthLabel = document.createElement("th");
    monthLabel.className = "calendar-title-cell";
    monthLabel.rowSpan = 2;
    const labelsOpenByDefault = window.matchMedia("(min-width: 992px)").matches;
    if (labelsOpenByDefault) {
        table.classList.add("calendar-event-labels-open");
    }
    const cornerToggle = document.createElement("button");
    cornerToggle.className = "calendar-corner-toggle";
    cornerToggle.type = "button";
    cornerToggle.setAttribute("aria-label", labelsOpenByDefault ? "Hide event names" : "Show event names");
    cornerToggle.setAttribute("aria-expanded", String(labelsOpenByDefault));
    cornerToggle.disabled = !window.matchMedia("(min-width: 577px)").matches;
    const cornerLogo = document.createElement("img");
    cornerLogo.className = "calendar-corner-logo";
    cornerLogo.src = "../../img_base/main_page/nav-logo.png";
    cornerLogo.alt = "";
    cornerLogo.setAttribute("aria-hidden", "true");
    cornerToggle.appendChild(cornerLogo);
    monthLabel.appendChild(cornerToggle);
    monthRow.appendChild(monthLabel);
    months.forEach(entry => {
        const th = document.createElement("th");
        th.colSpan = entry.count;

        if (entry.count > 3) {
            th.textContent = `${monthNames[entry.month]} ${entry.year}`;
        } else {
            th.textContent = "";
        }
        monthRow.appendChild(th);
    });

    thead.appendChild(monthRow);

    const dayRow = document.createElement("tr");
    dayRow.className = "calendar-day-row";
    dates.forEach((date, index) => {
        const th = document.createElement("th");
        th.textContent = String(date.getUTCDate());
        th.dataset.colIndex = String(index);
        if (index > 0 && date.getUTCDate() === 1) {
            th.classList.add("calendar-month-start");
        }
        if (date.getTime() === todayUtc.getTime()) {
            th.classList.add("calendar-today");
        }
        dayRow.appendChild(th);
    });
    thead.appendChild(dayRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const palette = [
        "#8f3f3f",
        "#8f5a32",
        "#746822",
        "#356b96",
        "#3f7d4c",
        "#664685",
        "#854065",
        "#357a7a",
        "#56782f",
        "#84652f",
        "#7f4c36",
        "#445b96"
    ];

    const getRangeColor = (entry, entryIndex, range, rangeIndex) => {
        const lowerTitle = entry.title.toLowerCase();
        let color = palette[entryIndex % palette.length];
        if (lowerTitle === "ltpe") {
            const base = "#445b96";
            color = rangeIndex === 1 ? lightenColor(base, 0.33) : base;
        }
        if (range?.lightenAlt) {
            color = lightenColor(color, 0.3);
        }
        if (lowerTitle === "berimond" && range?.label?.toLowerCase().includes("invasion")) {
            color = lightenColor(color, 0.33);
        }
        return color;
    };

    rangesByEvent.forEach((entry, idx) => {
        const tr = document.createElement("tr");
        const nameCell = document.createElement("th");
        nameCell.className = "calendar-event-name";
        const displayTitle = getDisplayTitle(entry.title);
        nameCell.setAttribute("aria-label", displayTitle);
        const nameWrap = document.createElement("div");
        nameWrap.className = "calendar-event-name-wrap";

        const custom = customEventImages.find(
            entryImage => entryImage.name.toLowerCase() === entry.title.toLowerCase()
        );
        const iconUrl = custom?.url || entry.imageUrl || "";
        if (iconUrl) {
            const icon = document.createElement("img");
            icon.className = "calendar-event-icon";
            icon.src = iconUrl;
            icon.alt = displayTitle;
            icon.loading = "lazy";
            nameWrap.appendChild(icon);
        }

        const titleSpan = document.createElement("span");
        titleSpan.className = "calendar-event-label";
        titleSpan.textContent = displayTitle;
        nameWrap.appendChild(titleSpan);

        nameCell.appendChild(nameWrap);
        tr.appendChild(nameCell);

        dates.forEach((date, index) => {
            const td = document.createElement("td");
            td.className = "calendar-cell";
            td.dataset.colIndex = String(index);
            if (index > 0 && date.getUTCDate() === 1) {
                td.classList.add("calendar-month-start");
            }
            if (date.getTime() === todayUtc.getTime()) {
                td.classList.add("calendar-today");
            }
            const dateTime = date.getTime();
            let active = false;
            let halfStart = false;
            let halfEnd = false;
            const matchingRanges = [];
            entry.ranges.forEach((range, rangeIndex) => {
                const startTime = normalizeUtcDate(range.start).getTime();
                const endTime = normalizeUtcDate(range.end).getTime();
                if (dateTime >= startTime && dateTime <= endTime) {
                    active = true;
                    const isStart = dateTime === startTime;
                    const isEnd = dateTime === endTime;
                    const trimmedStart = range.trimmedStart === true;
                    const trimmedEnd = range.trimmedEnd === true;
                    matchingRanges.push({
                        range,
                        rangeIndex,
                        isStart,
                        isEnd,
                        trimmedStart,
                        trimmedEnd
                    });
                    if (isStart && !trimmedStart) halfStart = true;
                    if (isEnd && !trimmedEnd) halfEnd = true;
                }
            });
            if (active) {
                td.classList.add("active");
                const startMatch = matchingRanges.find(match => match.isStart && !match.trimmedStart);
                const endMatch = matchingRanges.find(match => (
                    match.isEnd
                    && !match.trimmedEnd
                    && match.rangeIndex !== startMatch?.rangeIndex
                ));

                if (startMatch && endMatch) {
                    td.classList.add("calendar-color-transition");
                    td.style.setProperty(
                        "--event-left-color",
                        getRangeColor(entry, idx, endMatch.range, endMatch.rangeIndex)
                    );
                    td.style.setProperty(
                        "--event-right-color",
                        getRangeColor(entry, idx, startMatch.range, startMatch.rangeIndex)
                    );
                } else {
                    if (halfStart) td.classList.add("calendar-half-start");
                    if (halfEnd) td.classList.add("calendar-half-end");
                    const activeMatch = matchingRanges[matchingRanges.length - 1];
                    const color = getRangeColor(
                        entry,
                        idx,
                        activeMatch?.range,
                        activeMatch?.rangeIndex ?? -1
                    );
                    td.style.setProperty("--event-color", color);
                }
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrapper.appendChild(table);
    container.appendChild(wrapper);

    cornerToggle.addEventListener("click", () => {
        if (!window.matchMedia("(min-width: 577px)").matches) return;
        const isOpen = table.classList.toggle("calendar-event-labels-open");
        cornerToggle.setAttribute("aria-expanded", String(isOpen));
        cornerToggle.setAttribute("aria-label", isOpen ? "Hide event names" : "Show event names");
    });

    requestAnimationFrame(() => {
        normalizeCalendarBodyRowHeights(tbody);
    });

    const todayIndex = dates.findIndex(d => d.getTime() === todayUtc.getTime());
    if (todayIndex >= 0) {
        const todayCells = table.querySelectorAll(`[data-col-index="${todayIndex}"]`);
        todayCells.forEach(el => {
            el.classList.add("calendar-today-left-border");
            el.classList.add("calendar-today-right-border");
        });
    }

    table.addEventListener("click", event => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const colIndex = target.dataset.colIndex;
        if (colIndex === undefined) return;
        const selected = table.querySelectorAll(".calendar-selected");
        selected.forEach(el => el.classList.remove("calendar-selected"));
        const colCells = table.querySelectorAll(`[data-col-index="${colIndex}"]`);
        colCells.forEach(el => el.classList.add("calendar-selected"));
    });
}

function ensureDateFormatNote(container) {
    const footer = document.createElement("div");
    footer.className = "schedule-footer-bar";
    scheduleFooterLines.forEach(lineText => {
        const line = document.createElement("div");
        line.className = "schedule-footer-line";
        line.textContent = lineText;
        footer.appendChild(line);
    });
    container.appendChild(footer);
}

function removeDateFormatNote() {
    const existing = document.querySelector(".schedule-footer-bar");
    if (existing) existing.remove();
}

function normalizeCalendarBodyRowHeights(tbody) {
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll("tr"));
    if (rows.length === 0) return;
    let maxHeight = 0;
    rows.forEach(row => {
        const height = row.getBoundingClientRect().height;
        if (height > maxHeight) maxHeight = height;
    });
    if (maxHeight <= 0) return;
    rows.forEach(row => {
        row.style.height = `${maxHeight}px`;
        const cells = row.querySelectorAll("th, td");
        cells.forEach(cell => {
            cell.style.height = `${maxHeight}px`;
        });
    });
}

function getSelectedGameKey() {
    return getSelectedGameSource();
}

function syncGameChoiceOptionLabels(select) {
    const empireOption = select?.querySelector('option[value="empire"]');
    const e4kOption = select?.querySelector('option[value="e4k"]');
    const isMobile = window.matchMedia("(max-width: 700px)").matches;
    if (empireOption) empireOption.textContent = isMobile ? "EM (Browser)" : "Empire (Browser)";
    if (e4kOption) e4kOption.textContent = isMobile ? "E4K (Mobile)" : "Empire: Four Kingdoms (Mobile)";
}

function applyGameChoiceLanguage() {
    const title = document.getElementById("eventPlanGameChoiceTitle");
    const text = document.getElementById("eventPlanGameChoiceText");
    const select = document.getElementById("eventPlanGameChoiceSelect");
    const continueButton = document.getElementById("eventPlanGameChoiceContinue");
    const titleText = ui("game_choice_title", "Choose game");

    if (title) title.textContent = titleText;
    if (text) {
        text.textContent = ui(
            "game_choice_text",
            "EM (computer) and E4K (mobile) games may use different data. Choose your game."
        );
    }
    if (select) select.setAttribute("aria-label", titleText);
    if (continueButton) continueButton.textContent = ui("continue", "Continue");
}

function showInitialGameChoiceIfNeeded() {
    const seenKey = "gf_event_plan_game_choice_seen";
    if (localStorage.getItem(seenKey) === "1") return Promise.resolve();
    const modal = document.getElementById("eventPlanGameChoiceModal");
    const select = document.getElementById("eventPlanGameChoiceSelect");
    const continueButton = document.getElementById("eventPlanGameChoiceContinue");
    if (!modal || !select || !continueButton) {
        localStorage.setItem(seenKey, "1");
        return Promise.resolve();
    }
    applyGameChoiceLanguage();
    syncGameChoiceOptionLabels(select);
    select.value = getSelectedGameSource();
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("gf-modal-open");
    return new Promise(resolve => {
        const close = () => {
            localStorage.setItem(seenKey, "1");
            modal.classList.remove("open");
            modal.setAttribute("aria-hidden", "true");
            document.body.classList.remove("gf-modal-open");
            resolve();
        };
        select.addEventListener("change", () => {
            const previous = getSelectedGameSource();
            const next = setSelectedGameSource(select.value);
            if (next !== previous) {
                localStorage.setItem(seenKey, "1");
                window.location.reload();
                return;
            }
            close();
        }, { once: true });
        continueButton.addEventListener("click", close, { once: true });
        window.addEventListener("resize", () => syncGameChoiceOptionLabels(select));
    });
}

function getSelectedViewKey() {
    const viewSelect = document.getElementById("viewSelect");
    return viewSelect ? viewSelect.value : "overview";
}

function renderCurrentView() {
    const key = getSelectedGameKey();
    const events = eventCache[key] || [];
    const view = getSelectedViewKey();
    if (view === "calendar") {
        renderCalendar(events);
    } else {
        renderEvents(events);
    }
}

async function loadEvents(sourceKey) {
    const source = eventSources[sourceKey];
    if (!source) return;

    if (eventCache[sourceKey]) {
        renderCurrentView();
        return;
    }

    try {
        const html = await fetchEventPlanHtml(source.url);
        const doc = new DOMParser().parseFromString(html, "text/html");
        const events = extractEvents(doc, source.url);
        eventCache[sourceKey] = events;
        renderCurrentView();
    } catch (err) {
        console.error("Load error:", err);
    }
}

async function preloadAllEvents() {
    const selectedKey = getSelectedGameKey();
    const keys = [selectedKey].filter(key => !eventCache[key]);
    if (keys.length === 0) {
        return;
    }

    await Promise.all(keys.map(async key => {
        try {
            const html = await fetchEventPlanHtml(eventSources[key].url);
            const doc = new DOMParser().parseFromString(html, "text/html");
            eventCache[key] = extractEvents(doc, eventSources[key].url);
        } catch (err) {
            console.error("Preload error:", err);
            eventCache[key] = [];
        }
    }));
}

function setupSelectors() {
    const viewSelect = document.getElementById("viewSelect");

    if (viewSelect) {
        viewSelect.innerHTML = "";
        viewOptions.forEach(optionData => {
            const option = document.createElement("option");
            option.value = optionData.value;
            option.textContent = optionData.label;
            viewSelect.appendChild(option);
        });
        viewSelect.value = "overview";
        viewSelect.addEventListener("change", () => {
            renderCurrentView();
        });
    }
}

function handleResize() {
    const note = document.querySelector(".note");
    const pageTitle = document.querySelector(".page-title");
    const content = document.getElementById("content");

    if (note && content) {
        const totalHeightToSubtract = note.offsetHeight + (pageTitle?.offsetHeight || 0) + 18;
        const newHeight = window.innerHeight - totalHeightToSubtract;
        content.style.height = `${newHeight}px`;
    }

    updateEventColumnBorders(document.getElementById("eventGrid"));
}

window.addEventListener("resize", handleResize);
window.addEventListener("DOMContentLoaded", async () => {
    handleResize();
    setupSelectors();
    await loadOwnLang();
    await showInitialGameChoiceIfNeeded();
    await preloadAllEvents();
    renderCurrentView();
});
