const eventSources = {
    empire: {
        label: "Empire (Computer)",
        url: "https://communityhub.goodgamestudios.com/empire/event-plan/"
    },
    e4k: {
        label: "Empire: Four Kingdoms (Phone)",
        url: "https://communityhub.goodgamestudios.com/e4k/event-plan/"
    }
};

const viewOptions = [
    { value: "overview", label: "Normal view" },
    { value: "calendar", label: "Calendar view" }
];

const myProxy = "https://my-proxy-8u49.onrender.com/";
const fallbackProxy = "https://corsproxy.io/?";
const placeholderImage = "";

const customEventImages = [
    { name: "LTPE", url: "./img/ltpe.webp", priority: 12, nickname: "" },
    { name: "Nomad Invasion", url: "./img/nomadinvasion.webp", priority: 1, nickname: "" },
    { name: "War of the Realms", url: "./img/waroftherealms.webp", priority: 4, nickname: "" },
    { name: "Bloodcrow Invasion", url: "./img/bloodcrow.webp", priority: 3, nickname: "" },
    { name: "Samurai Invasion", url: "./img/samuraiinvasion.webp", priority: 2, nickname: "" },
    { name: "Berimond", url: "./img/berimond.webp", priority: 7, nickname: "" },
    { name: "Beyond the Horizon", url: "./img/beyondthehorizon.webp", priority: 5, nickname: "" },
    { name: "Outer Realms", url: "./img/outerrealms.webp", priority: 6, nickname: "" },
    { name: "The Imperial Patronage", url: "./img/patronage.webp", priority: 9, nickname: "Imperial Patronage" },
    { name: "The Bladecoast", url: "./img/bladecoast.webp", priority: 10, nickname: "" },
    { name: "The Grand Tournament", url: "./img/grandtournament.webp", priority: 11, nickname: "Grand Tournament" },
    { name: "Rift Raid", url: "./img/riftraid.webp", priority: 8, nickname: "" }
];

const eventCache = {
    empire: null,
    e4k: null
};

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

function normalizeText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
}

function extractDateTokens(text) {
    const tokens = [];
    const regex = /(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)(?:\s*[-–]\s*(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?))?/g;
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
    const start = parseDateToken(tokens[0]);
    const end = parseDateToken(tokens[1] || tokens[0]);
    if (!start || !end) return null;
    return { start, end };
}
function normalizeUtcDate(date) {
    if (!date) return null;
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
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
    return (
        doc.querySelector(".entry-content") ||
        doc.querySelector("article") ||
        doc.querySelector("main") ||
        doc.body
    );
}

function resolveImageUrl(src, baseUrl) {
    if (!src) return "";
    try {
        return new URL(src, baseUrl).href;
    } catch (err) {
        return src;
    }
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
    const imageUrl = resolveImageUrl(img ? img.getAttribute("src") : "", baseUrl);

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
    const imageUrl = resolveImageUrl(img.getAttribute("src"), baseUrl);

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
                imageUrl = resolveImageUrl(img.getAttribute("src"), baseUrl);
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
                        imageUrl = resolveImageUrl(img.getAttribute("src"), baseUrl);
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

function extractEvents(doc, baseUrl) {
    const root = getContentRoot(doc);
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
        const response = await fetch(myProxy + url, { signal: controller.signal });
        if (!response.ok) throw new Error("myProxy: bad response");
        return response;
    } catch (err) {
        console.warn("Proxy error:", err);

        const encodedUrl = encodeURIComponent(url);
        const fallbackResponse = await fetch(fallbackProxy + encodedUrl);
        if (!fallbackResponse.ok) throw new Error("fallbackProxy: bad response");
        return fallbackResponse;
    } finally {
        clearTimeout(timer);
    }
}

async function fetchEventPlanHtml(url) {
    const res = await fetchWithFallback(url);
    return res.text();
}

function setLoadingState(message, show = true) {
    const loadingBox = document.getElementById("loadingBox");
    const loadingStatus = document.getElementById("loadingStatus");
    const loadingProgress = document.getElementById("loadingProgress");
    const loadingPercentText = document.getElementById("loadingPercentText");
    const eventGrid = document.getElementById("eventGrid");

    if (!loadingBox) return;
    loadingBox.style.display = show ? "flex" : "none";
    if (loadingStatus && message) loadingStatus.textContent = message;
    if (loadingProgress) loadingProgress.style.width = show ? "0%" : "0%";
    if (loadingPercentText) loadingPercentText.textContent = show ? "0%" : "";
    if (eventGrid) eventGrid.style.visibility = show ? "hidden" : "visible";
}

function setLoadingProgress(percent, message) {
    const loadingStatus = document.getElementById("loadingStatus");
    const loadingProgress = document.getElementById("loadingProgress");
    const loadingPercentText = document.getElementById("loadingPercentText");
    const safePercent = Math.max(0, Math.min(100, Math.round(percent)));

    if (loadingStatus && message) loadingStatus.textContent = message;
    if (loadingProgress) loadingProgress.style.width = `${safePercent}%`;
    if (loadingPercentText) loadingPercentText.textContent = `${safePercent}%`;
}

function ensureEventGrid() {
    let grid = document.getElementById("eventGrid");
    if (grid) return grid;

    const content = document.getElementById("content");
    if (!content) return null;

    grid = document.createElement("div");
    grid.id = "eventGrid";
    grid.className = "event-grid";

    const loadingBox = document.getElementById("loadingBox");
    if (loadingBox) {
        content.insertBefore(grid, loadingBox);
    } else {
        content.appendChild(grid);
    }
    return grid;
}

function renderEvents(events) {
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
                    span.textContent = date;
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
                    span.textContent = date;
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
        return { title: event.title, ranges };
    });

    const nonLtpeRanges = rangesByEvent
        .filter(entry => entry.title.toLowerCase() !== "ltpe")
        .flatMap(entry => entry.ranges);
    const minNonLtpeDate = nonLtpeRanges.length > 0
        ? new Date(Math.min(...nonLtpeRanges.map(range => normalizeUtcDate(range.start).getTime())))
        : null;

    if (minNonLtpeDate) {
        rangesByEvent.forEach(entry => {
            if (entry.title.toLowerCase() !== "ltpe") return;
            entry.ranges = entry.ranges
                .map(range => {
                    if (normalizeUtcDate(range.start).getTime() < minNonLtpeDate.getTime()) {
                        const adjusted = { ...range };
                        adjusted.start = new Date(minNonLtpeDate.getTime());
                        adjusted.trimmedStart = true;
                        if (normalizeUtcDate(adjusted.start).getTime() > normalizeUtcDate(adjusted.end).getTime()) {
                            return null;
                        }
                        return adjusted;
                    }
                    return range;
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

    const todayLocal = new Date();
    const todayUtc = new Date(Date.UTC(
        todayLocal.getFullYear(),
        todayLocal.getMonth(),
        todayLocal.getDate()
    ));

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
    monthLabel.textContent = "Event";
    monthRow.appendChild(monthLabel);
    months.forEach(entry => {
        const th = document.createElement("th");
        th.colSpan = entry.count;
        th.textContent = `${monthNames[entry.month]} ${entry.year}`;
        monthRow.appendChild(th);
    });
    thead.appendChild(monthRow);

    const dayRow = document.createElement("tr");
    dayRow.className = "calendar-day-row";
    const emptyTh = document.createElement("th");
    emptyTh.className = "calendar-title-cell";
    emptyTh.textContent = "";
    dayRow.appendChild(emptyTh);
    dates.forEach((date, index) => {
        const th = document.createElement("th");
        th.textContent = String(date.getUTCDate());
        th.dataset.colIndex = String(index);
        if (date.getTime() === todayUtc.getTime()) {
            th.classList.add("calendar-today");
        }
        dayRow.appendChild(th);
    });
    thead.appendChild(dayRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const palette = [
        "#d96f6f",
        "#d9a56f",
        "#d6c36b",
        "#6fa8d9",
        "#7cc08a",
        "#b48ad9",
        "#d984b5",
        "#8bd1d1",
        "#9bc36f",
        "#d9b06f",
        "#c98a6f",
        "#6f8ad9"
    ];

    rangesByEvent.forEach((entry, idx) => {
        const tr = document.createElement("tr");
        const nameCell = document.createElement("th");
        nameCell.className = "calendar-event-name";
        nameCell.textContent = getDisplayTitle(entry.title);
        tr.appendChild(nameCell);

        dates.forEach((date, index) => {
            const td = document.createElement("td");
            td.className = "calendar-cell";
            td.dataset.colIndex = String(index);
            if (date.getTime() === todayUtc.getTime()) {
                td.classList.add("calendar-today");
            }
            const dateTime = date.getTime();
            let active = false;
            let edge = false;
            let activeRangeIndex = -1;
            let invasionActive = false;
            entry.ranges.forEach((range, rangeIndex) => {
                const startTime = normalizeUtcDate(range.start).getTime();
                const endTime = normalizeUtcDate(range.end).getTime();
                if (dateTime >= startTime && dateTime <= endTime) {
                    active = true;
                    if (activeRangeIndex === -1) activeRangeIndex = rangeIndex;
                    if (range.label && range.label.toLowerCase().includes("invasion")) {
                        invasionActive = true;
                    }
                    const isStart = dateTime === startTime;
                    const isEnd = dateTime === endTime;
                    const trimmedStart = range.trimmedStart === true;
                    if ((isStart && !trimmedStart) || isEnd) {
                        edge = true;
                    }
                }
            });
            if (active) {
                td.classList.add("active");
                let color = palette[idx % palette.length];
                if (entry.title.toLowerCase() === "ltpe" && activeRangeIndex >= 0) {
                    const base = "#6f8ad9";
                    color = activeRangeIndex === 1 ? lightenColor(base, 0.33) : base;
                }
                if (entry.title.toLowerCase() === "berimond" && invasionActive) {
                    color = lightenColor(color, 0.33);
                }
                td.style.setProperty("--event-color", color);
                td.textContent = edge ? "0,5" : "1";
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrapper.appendChild(table);
    container.appendChild(wrapper);

    requestAnimationFrame(() => {
        normalizeCalendarBodyRowHeights(tbody);
    });

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
    const note = document.createElement("div");
    note.className = "date-format-note";
    note.textContent = "Note: Dates are shown in day/month/year format.";
    container.appendChild(note);
}

function removeDateFormatNote() {
    const existing = document.querySelector(".date-format-note");
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
    const gameSelect = document.getElementById("gameSelect");
    return gameSelect ? gameSelect.value : "empire";
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

function getGameKeyFromHash() {
    const hash = window.location.hash.replace("#", "").toLowerCase();
    if (hash === "e4k") return "e4k";
    if (hash === "em" || hash === "empire") return "empire";
    return null;
}

function updateHashForGame(key) {
    if (key === "e4k") {
        window.location.hash = "e4k";
    } else if (key === "empire") {
        window.location.hash = "em";
    }
}

function setupDownloadButton() {
    const button = document.getElementById("downloadButton");
    if (!button) return;

    button.addEventListener("click", async () => {
        const view = getSelectedViewKey();
        if (view !== "overview") {
            alert("Download is only available in Normal view.");
            return;
        }

        const gameKey = getSelectedGameKey();
        if (!eventCache[gameKey]) {
            alert("Event plan is still loading.");
            return;
        }

        const grid = ensureEventGrid();
        if (!grid) return;

        button.disabled = true;
        try {
            const snapshot = grid.cloneNode(true);
            snapshot.style.width = "1320px";
            snapshot.style.maxWidth = "1320px";
            snapshot.style.margin = "0";
            snapshot.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
            snapshot.style.padding = "12px 14px 18px";
            snapshot.style.visibility = "visible";
            snapshot.classList.add("snapshot-multiline");

            const sandbox = document.createElement("div");
            sandbox.style.position = "fixed";
            sandbox.style.left = "-9999px";
            sandbox.style.top = "0";
            sandbox.style.width = "1320px";
            sandbox.style.backgroundColor = "#f3e6c8";
            sandbox.appendChild(snapshot);
            document.body.appendChild(sandbox);

            const targetWidth = snapshot.scrollWidth;
            const targetHeight = snapshot.scrollHeight;

            const canvas = await html2canvas(snapshot, {
                backgroundColor: "#f3e6c8",
                useCORS: true,
                scale: 2,
                width: targetWidth,
                height: targetHeight,
                windowWidth: targetWidth,
                windowHeight: targetHeight
            });
            const link = document.createElement("a");
            const dateStamp = new Date().toISOString().slice(0, 10);
            const gameLabel = eventSources[gameKey]?.label || gameKey;
            link.download = `${gameLabel.replace(/[^a-z0-9]+/gi, "_")}_event_plan_${dateStamp}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            document.body.removeChild(sandbox);
        } catch (err) {
            console.error("Download error:", err);
            alert("Download failed.");
        } finally {
            button.disabled = false;
        }
    });
}

async function loadEvents(sourceKey) {
    const source = eventSources[sourceKey];
    if (!source) return;

    if (eventCache[sourceKey]) {
        setLoadingState("", false);
        renderCurrentView();
        return;
    }

    setLoadingState(`Loading: ${source.label}...`, true);
    setLoadingProgress(0, `Loading: ${source.label}...`);

    try {
        const html = await fetchEventPlanHtml(source.url);
        const doc = new DOMParser().parseFromString(html, "text/html");
        const events = extractEvents(doc, source.url);
        eventCache[sourceKey] = events;
        renderCurrentView();
        setLoadingProgress(100, `Loaded: ${source.label}`);
        setLoadingState("", false);
    } catch (err) {
        console.error("Load error:", err);
        setLoadingProgress(100, "Failed to load event plan data.");
        setLoadingState("Failed to load event plan data.", true);
    }
}

async function preloadAllEvents() {
    setLoadingState("Loading event plans...", true);
    setLoadingProgress(0, "Loading event plans...");
    const keys = Object.keys(eventSources);
    const total = keys.length;
    let completed = 0;
    for (const key of keys) {
        if (eventCache[key]) continue;
        try {
            const html = await fetchEventPlanHtml(eventSources[key].url);
            const doc = new DOMParser().parseFromString(html, "text/html");
            eventCache[key] = extractEvents(doc, eventSources[key].url);
        } catch (err) {
            console.error("Preload error:", err);
            eventCache[key] = [];
        } finally {
            completed += 1;
            setLoadingProgress((completed / total) * 100, "Loading event plans...");
        }
    }
    setLoadingProgress(100, "Loading complete");
    setLoadingState("", false);
}

function setupSelectors() {
    const gameSelect = document.getElementById("gameSelect");
    const viewSelect = document.getElementById("viewSelect");

    if (gameSelect) {
        gameSelect.innerHTML = "";
        Object.entries(eventSources).forEach(([key, info]) => {
            const option = document.createElement("option");
            option.value = key;
            option.textContent = info.label;
            gameSelect.appendChild(option);
        });
        const hashKey = getGameKeyFromHash();
        gameSelect.value = hashKey || "empire";
        gameSelect.addEventListener("change", () => {
            updateHashForGame(gameSelect.value);
            loadEvents(gameSelect.value);
        });
    }

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

    if (note && pageTitle && content) {
        const totalHeightToSubtract = note.offsetHeight + pageTitle.offsetHeight + 18;
        const newHeight = window.innerHeight - totalHeightToSubtract;
        content.style.height = `${newHeight}px`;
    }
}

window.addEventListener("resize", handleResize);
window.addEventListener("DOMContentLoaded", () => {
    handleResize();
    setupSelectors();
    setupDownloadButton();
    preloadAllEvents().then(() => {
        const hashKey = getGameKeyFromHash();
        if (hashKey) {
            const gameSelect = document.getElementById("gameSelect");
            if (gameSelect) gameSelect.value = hashKey;
        }
        renderCurrentView();
    });
});