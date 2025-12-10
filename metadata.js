const PAGE_META = {
    "index.html": {
        title: "Generals Forum – Tools, Calculators & Simulators",
        description: "All tools, calculators and simulators for Empire players in one place.",
        image: "./img_base/share-banner.webp"
    },

    "decorations/index.html": {
        title: "Decorations Overview – Generals Forum",
        description: "Automatic decorations data with stats and details.",
        image: "../img_base/share-banner.webp"
    },

    "building_items/index.html": {
        title: "CI's & TCI's Overview – Generals Forum",
        description: "Complete construction items and powerful TCI stats.",
        image: "../img_base/share-banner.webp"
    },

    "look_items/index.html": {
        title: "Look-items Overview – Generals Forum",
        description: "All look-items displayed with automatic data loading.",
        image: "../img_base/share-banner.webp"
    },

    "generals/index.html": {
        title: "Generals Overview – Generals Forum",
        description: "General stats and details will be added soon.",
        image: "../img_base/share-banner.webp"
    },

    "food_calculator/index.html": {
        title: "Food Production Calculator – Generals Forum",
        description: "Calculate food output with bonuses, buildings & effects.",
        image: "../img_base/share-banner.webp"
    },

    "mead_calculator/index.html": {
        title: "Mead Production Calculator – Generals Forum",
        description: "Calculate mead production automatically.",
        image: "../img_base/share-banner.webp"
    },

    "layout_editor/index.html": {
        title: "Castle Layout Simulator – Generals Forum",
        description: "Design and auto-generate castle layouts.",
        image: "../img_base/share-banner.webp"
    },

    "hol_simulator/index.html": {
        title: "Hall of Legends Simulator – Generals Forum",
        description: "Simulate HoL point distributions without spending rubies.",
        image: "../img_base/share-banner.webp"
    },

    "battle_simulator/index.html": {
        title: "Battle Simulator – Generals Forum",
        description: "Plan attacks and defenses safely.",
        image: "../img_base/share-banner.webp"
    }
};

(function () {
    const path = window.location.pathname.split("/").slice(-2).join("/");
    const meta = PAGE_META[path] || PAGE_META["index.html"];

    document.title = meta.title;

    document.querySelector('meta[name="title"]').setAttribute("content", meta.title);
    document.querySelector('meta[name="description"]').setAttribute("content", meta.description);

    document.querySelector('meta[property="og:title"]').setAttribute("content", meta.title);
    document.querySelector('meta[property="og:description"]').setAttribute("content", meta.description);
    document.querySelector('meta[property="og:image"]').setAttribute("content", meta.image);
})();
