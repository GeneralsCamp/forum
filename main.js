const categories = {
    overviews: [
        { name: "Decorations Overview", desc: "This page loads the in-game decorations automatically!", icon: "decorations.webp", link: "./decorations/index.html", disabled: false },
        { name: "CI's & TCI's Overview", desc: "This page loads the in-game CI's & TCI's automatically!", icon: "ci-icon.webp", link: "./building_items/index.html", disabled: false },
        { name: "Look-items Overview", desc: "This page loads the in-game look items automatically!", icon: "look-items.webp", link: "./look_items/index.html", disabled: false },
        { name: "Gacha Overview", desc: "This page loads the in-game gacha rewards automatically!", icon: "gacha-icon.webp", link: "./gacha_overview/index.html", disabled: false },
        { name: "Generals Overview", desc: "This page loads the in-game generals automatically!", icon: "generals-icon.webp", link: "./generals_overview/index.html", disabled: false },
        { name: "Event plan Overview", desc: "This page loads the event plans automatically!", icon: "event-plan-icon.webp", link: "./eventplan/index.html", disabled: false },
        { name: "Lootbox Overview", desc: "This page loads the in-game lootboxes key chances automatically!", icon: "lootbox-icon.webp", link: "./loot_box/index.html", disabled: false }
    ],

    calculators: [
        { name: "Food Production Calculator", desc: "Calculate your in-game food production easily.", icon: "food-production-icon.webp", link: "./food_calculator/index.html", disabled: false },
        { name: "Mead Production Calculator", desc: "Calculate your mead production easily.", icon: "mead-icon.webp", link: "./brewery_simulator/index.html", disabled: false },
        { name: "Wall Limit Calculator", desc: "Calculate your wall unit limit with absolute accuracy.", icon: "wall-icon.webp", link: "./wall_limit/index.html", disabled: false },
        { name: "Collector Event Calculator", desc: "Calculate that how many points you need to reach your goal.", icon: "collector-icon.webp", link: "./collector_calculator/index.html", disabled: false },
        { name: "Detection Time Calculator", desc: "Calculate the exact land time, and detection time of an attack.", icon: "detection-icon.webp", link: "./travel_speed/index.html", disabled: false },
        { name: "Rift Raid Point Calculator", desc: "Calculate Activity Points based on defeated/faced troops, area, and boss level.", icon: "rift-raid-points-icon.webp", link: "./rift_raid_points/index.html", disabled: false }
    ],

    simulators: [
        { name: "Castle Layout Simulator", desc: "Design and manage your layouts manually or automatically.", icon: "layout-icon.webp", link: "./layout_editor/index.html", disabled: false },
        { name: "Hall of Legends Simulator", desc: "Try point allocations without spending rubies.", icon: "hall-of-legends-simulator-icon.webp", link: "./hol_simulator/index.html", disabled: false },
        //{ name: "Imperial Patronage Simulator", desc: "Try to upgrade the decorations without any in-game resources.", icon: "patronage-icon.webp", link: "#", disabled: true },
        //{ name: "Battle Simulator", desc: "Try to attack or defend without any in-game losses.", icon: "battle-simulator-icon.webp", link: "#", disabled: true }
    ]
};

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

document.addEventListener("DOMContentLoaded", () => {
    renderCategory(categories.overviews, "overviews");
    renderCategory(categories.calculators, "calculators");
    renderCategory(categories.simulators, "simulators");
});