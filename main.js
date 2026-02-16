const categories = {
    overviews: [
        { name: "Decorations Overview", desc: "This page loads the in-game decorations automatically!", icon: "decorations.webp", link: "./overviews/decorations/index.html", disabled: false },
        { name: "CI's & TCI's Overview", desc: "This page loads the in-game CI's & TCI's automatically!", icon: "ci-icon.webp", link: "./overviews/building_items/index.html", disabled: false },
        { name: "Look-items Overview", desc: "This page loads the in-game look items automatically!", icon: "look-items.webp", link: "./overviews/look_items/index.html", disabled: false },
        { name: "Gacha Overview", desc: "This page loads the in-game gacha rewards automatically!", icon: "gacha-icon.webp", link: "./overviews/gacha_overview/index.html", disabled: false },
        { name: "Event Rewards Overview", desc: "This page loads in-game event rewards with a vary of filters!", icon: "event-rewards-icon.webp", link: "./overviews/event_rewards_overview/index.html", disabled: false },
        { name: "Generals Overview", desc: "This page loads the in-game generals automatically!", icon: "generals-icon.webp", link: "./overviews/generals_overview/index.html", disabled: false },
        { name: "Lootbox Overview", desc: "This page loads the in-game lootboxes key chances automatically!", icon: "lootbox-icon.webp", link: "./overviews/loot_box/index.html", disabled: false },
        { name: "Event plan Overview", desc: "This page loads the event plans automatically!", icon: "event-plan-icon.webp", link: "./overviews/event_plan/index.html", disabled: false },
    ],

    calculators: [
        { name: "Food Production Calculator", desc: "Calculate your in-game food production easily.", icon: "food-production-icon.webp", link: "./calculators/food_production/index.html", disabled: false },
        { name: "Mead Production Calculator", desc: "Calculate your mead production easily.", icon: "mead-icon.webp", link: "./calculators/mead_production/index.html", disabled: false },
        { name: "Wall Limit Calculator", desc: "Calculate your wall unit limit with absolute accuracy.", icon: "wall-icon.webp", link: "./calculators/wall_limit/index.html", disabled: false },
        { name: "Collector Event Calculator", desc: "Calculate that how many points you need to reach your goal.", icon: "collector-icon.webp", link: "./calculators/collector_event/index.html", disabled: false },
        { name: "Detection Time Calculator", desc: "Calculate the exact land time, and detection time of an attack.", icon: "detection-icon.webp", link: "./calculators/travel_speed/index.html", disabled: false },
        { name: "Rift Raid Point Calculator", desc: "Calculate Activity Points based on defeated/faced troops, area, and boss level.", icon: "rift-raid-points-icon.webp", link: "./calculators/rift_raid_points/index.html", disabled: false }
    ],

    simulators: [
        { name: "Castle Layout Simulator", desc: "Design and manage your layouts manually or automatically.", icon: "layout-icon.webp", link: "./simulators/layout_editor/index.html", disabled: false },
        { name: "Hall of Legends Simulator", desc: "Try point allocations without spending rubies.", icon: "hall-of-legends-simulator-icon.webp", link: "./simulators/hol_simulator/index.html", disabled: false },
    ]
};

const nowWorkingOn = [
    {
        title: "Units & Tools Overview",
        text: "New webpage for reviewing units and tools.",
        status: "Active"
    },
    {
        title: "PvP guide video",
        text: "Detailed PvP guide video covering both defense and attack.",
        status: "Active"
    },
    {
        title: "New Fungal Rift Raid event video",
        text: "Showcasing additional details of the new event with in-game footage.",
        status: "Planned"
    },
    {
        title: "Battle Simulator",
        text: "Paused until current overviews are stabilized.",
        status: "Paused"
    },
    {
        title: "Attack speed & Detection Calculator",
        text: "Fixing the currently incorrect detection time calculation.",
        status: "Paused"
    }
];

function renderCategory(list, targetId) {
    const container = document.querySelector(`#${targetId} .category-grid`);

    list.forEach(item => {
        const box = document.createElement("a");
        box.classList.add("category-box");

        if (!item.disabled) {
            box.href = item.link;
        } else {
            box.classList.add("disabled");
        }

        box.innerHTML = `
            <div class="category-icon">
                <img src="./img_base/${item.icon}">
            </div>
            <div class="category-content">
                <h3>${item.name}</h3>
                <p>${item.desc}</p>
            </div>
        `;

        container.appendChild(box);
    });
}

function renderNowPanel(list) {
    const container = document.querySelector("#nowPanel .now-grid");
    if (!container) return;

    const getStatusClass = (status) => {
        const v = String(status || "").toLowerCase();
        if (v.includes("active") || v.includes("progress") || v.includes("megy")) return "status-active";
        if (v.includes("pause") || v.includes("szunet")) return "status-paused";
        if (v.includes("plan")) return "status-planned";
        if (v.includes("done") || v.includes("kesz")) return "status-done";
        return "status-default";
    };

    container.innerHTML = list.map(item => `
        <article class="now-card">
            <div class="now-card-head">
                <h3>${item.title}</h3>
                <span class="now-badge ${getStatusClass(item.status)}">${item.status}</span>
            </div>
            <p>${item.text}</p>
        </article>
    `).join("");
}

async function renderLatestVideos() {
    const container = document.querySelector("#latestVideos .video-grid");
    if (!container) return;

    const proxy = "https://my-proxy-8u49.onrender.com/";
    const channelVideosUrl = "https://www.youtube.com/@GeneralsCamp/videos";

    try {
        const res = await fetch(proxy + channelVideosUrl, {
            headers: { "x-requested-with": "XMLHttpRequest" }
        });
        if (!res.ok) throw new Error(`Failed to load channel page (${res.status})`);

        const html = await res.text();
        const pairs = [];
        const regex = /"videoId":"([A-Za-z0-9_-]{11})","thumbnail":[\s\S]{0,1400}?"title":\{"runs":\[\{"text":"([^"]+)"/g;
        let match = null;
        while ((match = regex.exec(html)) !== null) {
            const id = match[1];
            const title = (match[2] || "").replace(/\\u0026/g, "&");
            if (!id || !title) continue;
            pairs.push({ id, title });
            if (pairs.length >= 80) break;
        }

        const filtered = [];
        const seenIds = new Set();
        pairs.forEach((item) => {
            if (seenIds.has(item.id)) return;
            seenIds.add(item.id);
            if (!/goodgame empire/i.test(item.title)) return;
            filtered.push(item);
        });

        const latestTen = filtered.slice(0, 10);
        if (!latestTen.length) throw new Error('No "Goodgame Empire" videos found');

        container.innerHTML = latestTen.map(({ id, title }) => `
            <a class="video-card video-link" href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener">
                <div class="video-frame-wrap">
                    <img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="${title}" loading="lazy">
                    <span class="video-play-icon"><i class="bi bi-play-fill"></i></span>
                </div>
            </a>
        `).join("");
    } catch (err) {
        container.innerHTML = `
            <div class="video-loading">
                Could not load videos right now.
            </div>
        `;
        console.error(err);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    renderCategory(categories.overviews, "overviews");
    renderCategory(categories.calculators, "calculators");
    renderCategory(categories.simulators, "simulators");
    renderNowPanel(nowWorkingOn);
    renderLatestVideos();
});
