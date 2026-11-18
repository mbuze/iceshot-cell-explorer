# Protrusions and neighbours

[Open the notebook](https://mbuze.github.io/iceshot-cell-explorer/protrusions/) or [just the interactive simulation](https://mbuze.github.io/iceshot-cell-explorer/public/protrusions/).

A gold cell makes repeated protrusion attempts in a 9 × 6 patch. The left side has just that cell. On the right, choose which of ten background types to include, how much area the mixture fills, and how strongly it returns towards its starting sites. Open **Edit a cell type** to change individual shape preferences and resistance coefficients. **New attempts** changes the pigment cell's random sequence. **Reshuffle neighbours** changes only the tissue seed. Edits recompute both views when needed.

## Opening pair

The native ICeShOT runs used seed 38, 153 saved frames and a 168 × 112 grid. The right-hand field contained 33 neighbours of five types at 64.8% occupied area. Up to five tips were simultaneously visible in the open field and four among neighbours. Of 24 completed attempts, the body reached an earlier tip during four in the open field and two among the neighbours. The rest retracted before the body arrived by the criterion below. In **attempt 7**, both visibly extend an arm. The open-space body reaches the earlier tip at step 48. The arm retracts on both sides at step 51. Use the attempt menu and step slider to inspect it.

## What the rules mean

- The seed supplies the same starting times, relative directions, bends, attempted lengths and lifetimes to both views. The target for each new arm is set relative to the body's location when the attempt starts. That target is held in place while the body moves. The chamber limits the target and keeps the body inside.
- The protrusion extends and retracts by an age-dependent length envelope. ICeShOT allocates the gold cell a fixed area by competing with other cells and with empty space. The gold cell's cost is the minimum of a quadratic core and two connected line segments for each active arm. Each segment offers a cost of 0.48 plus 19.5 times squared distance from the segment. Background types use quadratic cores and optional curved one-sided arms from the mixer.
- A tip marker is an allocated pixel belonging to that particular arm's lowest-cost region. A qualifying tip is at least 0.55 units from the body. The display tracks the body site, the centre of its preferred core. Starting 22% of the way into each attempt, the body follows the average of the vectors towards the qualifying tips. Its site also relaxes slightly towards its area centroid. Other cells can move, and a separately adjustable spring draws them towards their starting sites.
- **Followed** means the body site came within 0.32 model units of a previous furthest qualifying tip of that attempt, before it expired. **Retracted before arrival** means an arm formed and expired without meeting that criterion. A short-lived arm may move the body some distance. A body can reach a shared target with contributions from multiple arms. Time steps and coefficients are in model units. The follow rule is a modelling choice for exploring shape and movement.
- The solver retries with shorter arms when a proposed allocation fragments the gold cell, noticeably fragments a neighbour, or misses an area target. It can also shorten the shapes of neighbours in difficult packings. Read the captions for affected steps. Reach was shortened in 108 of the 153 crowded opening frames and in none of the open frames. The crowded morphology and movement reflect this numerical guard as well as the allocation and follow rules. Playback draws the actual solver grid so fine connections do not change with screen resolution.

## Reproduce or edit a run

The displayed opening runs were generated with the vendored ICeShOT CPU solver, using its L-BFGS dual optimiser and Laguerre allocation. The browser uses the same moving-cell rules, grid, area targets and costs, with the JavaScript dual optimiser from the mixer. Counts can differ between numerical solvers. The solver source remains attributed to [Antoine Diez and Jean Feydy](https://github.com/antoinediez/ICeShOT).

With Node.js and the scientific Python environment in the [README](README.md), run:

```sh
node model/protrusions.mjs open /tmp/protrusions-open.json
node model/protrusions.mjs mixed /tmp/protrusions-mixed.json
```

Set `ICESHOT_PYTHON` to choose a Python executable. Append a path to the JSON downloaded with **Save run settings** to compute that version. `marimo run protrusions.py` opens the native notebook. A static server can also serve `notebook/protrusions.html` and the interactive figure from this repository.
