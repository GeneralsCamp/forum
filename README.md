# Generals Forum

Generals Forum is a collection of practical tools for Goodgame Empire and Empire: Four Kingdoms players.

The site focuses on fast lookups and event planning: rewards, decorations, construction items, equipment sets, loot boxes, troops, tools, quests, and related calculators. It is built as a static frontend, so it can run on GitHub Pages or from a local dev server without a backend.

Website: https://generalscamp.github.io/forum/

## What is included

- Event and reward overviews
- Decoration and construction item browsers
- Equipment set and look item overviews
- Loot box, gacha, quest, troop, and tool data pages
- Simulators and calculators for common planning tasks
- Empire and E4K data source switching
- Local browser caching for large data files

## Data

Game data is loaded from the Generals Camp data cache:

https://github.com/GeneralsCamp/ggempire-data-cache

The frontend reads prepared JSON and cached DLL metadata from GitHub-hosted files. Large payloads are cached locally in the browser so normal page loads do not repeatedly download the same 20-30 MB data files.

Goodgame asset images are still loaded from the original asset CDN. Some composed asset metadata files may need a CORS proxy because the original asset JSON/JS files are not browser-readable directly.

## Project layout

```text
overviews/      Data-heavy overview pages
calculators/    Planning and calculation tools
simulators/     Interactive simulators
img_base/       Shared local images and icons
main.js         Home page behavior
styles.css      Home page styling
```

Shared frontend services live in `overviews/shared/`, including data loading, image mapping, cache handling, language selection, lazy rendering, and composed image hydration.

## Contact

YouTube: https://www.youtube.com/@GeneralsCamp
Email: generalscampofficial@gmail.com
