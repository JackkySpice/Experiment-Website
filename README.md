# Colliding Blocks Compute π

Perfectly elastic collisions between two blocks and a wall approximate digits of π when the large mass is a power of 100.

## One‑click Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/JackkySpice/Experiment-Website)

This repo is a static site (no build step). The Render blueprint in `render.yaml` sets up a Static Site that serves the app from the repo root.

## Local Development

- Open `index.html` in a browser, or use any static server.
- Change masses in the controls and click Start.

## How the Simulation Works

- Two blocks on a frictionless track: a large block near an immovable wall on the left and a smaller block to the right moving left.
- All collisions are perfectly elastic. We count both block–block and block–wall collisions.
- The simulation stops when both blocks are moving right and can no longer collide.
- For masses `m_small = 1` kg and `m_large = 100` kg → total collisions = 31. If `m_large = 10,000` kg → 314.

## Files

- `index.html` – Structure and controls
- `styles.css` – Styling
- `script.js` – Event-driven physics and animation
- `render.yaml` – Render Static Site blueprint
