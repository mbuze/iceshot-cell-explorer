# Protrusions and neighbours

[Open the notebook](https://mbuze.github.io/iceshot-cell-explorer/protrusions/) or [just the interactive simulation](https://mbuze.github.io/iceshot-cell-explorer/public/protrusions/).

A gold cell makes repeated protrusion attempts in a 9 × 6 patch. The left side has just that cell. On the right, choose which of ten background types to include, how much area the mixture fills, and how strongly it returns towards its starting sites. Open **Edit a cell type** to change individual shape preferences and resistance coefficients. **New attempts** changes the pigment cell's random sequence. **Reshuffle neighbours** changes only the tissue seed. Edits recompute both views when needed.

## Opening pair

The native ICeShOT runs used seed 38, 65 saved frames and a 96 × 64 grid. The right-hand field contained 33 neighbours of five types at 64.8% occupied area. Up to four tips were simultaneously visible in each field. Of 18 completed attempts, the body reached an earlier tip during three in the open field and two among the neighbours. Fifteen arms retracted before arrival in the open field. Thirteen did so in the crowded field, and three attempts there produced no distinct arm. In **attempt 6**, both visibly extend an arm. The open-space body reaches its earlier tip at step 24. The arms expire on both sides at step 29.

The fast preview uses fewer time steps, a coarser grid and fewer dual iterations than the original playground. The times and events above refer to this preview. A tissue-only edit reuses the displayed open-space run. Taking occupied area to zero reuses the identical run for both fields.

## What the rules mean

- The seed supplies the same starting times, relative directions, bends, attempted lengths and lifetimes to both views. The target for each new arm is set relative to the body's location when the attempt starts. That target is held in place while the body moves. The chamber limits the target and keeps the body inside.
- The protrusion extends and retracts by an age-dependent length envelope. ICeShOT allocates the gold cell a fixed area by competing with other cells and with empty space. The gold cell's cost is the minimum of a quadratic core and two connected line segments for each active arm. Each segment offers a cost of 1.45 times the sum of 0.16 and 6.5 times the squared distance from the segment. Background types use quadratic cores and optional curved one-sided arms from the mixer.
- A tip marker is an allocated pixel belonging to that particular arm's lowest-cost region. A qualifying tip is at least 0.55 units from the body. The display tracks the body site, the centre of its preferred core. Starting 22% of the way into each attempt, the body follows the average of the vectors towards the qualifying tips. Its site also relaxes slightly towards its area centroid. Other cells can move, and a separately adjustable spring draws them towards their starting sites.
- **Followed** means the body site came within 0.32 model units of a previous furthest qualifying tip of that attempt, before it expired. **Retracted before arrival** means an arm formed and expired without meeting that criterion. A short-lived arm may move the body some distance. A body can reach a shared target with contributions from multiple arms. Time steps and coefficients are in model units. The follow rule is a modelling choice for exploring shape and movement.
- The solver keeps the chosen costs for each neighbour at every step. A problematic allocation can trigger two retries with reduced gold reach. An eight-neighbour grid check tracks continuity. The captions flag shortened reach and any neighbour with over 5.5% of its area in other components. Reach was shortened in 43 of the 65 crowded opening frames and in none of the open frames. Playback uses the actual solver grid.

## Reproduce or edit a run

The displayed opening runs were generated with the vendored ICeShOT CPU solver, using its L-BFGS dual optimiser and Laguerre allocation. The browser uses the same moving-cell rules, grid, area targets and costs, with the JavaScript dual optimiser from the mixer. Counts can differ between numerical solvers. The solver source remains attributed to [Antoine Diez and Jean Feydy](https://github.com/antoinediez/ICeShOT).

With Node.js and the scientific Python environment in the [README](README.md), run:

```sh
node model/protrusions.mjs open /tmp/protrusions-open.json
node model/protrusions.mjs mixed /tmp/protrusions-mixed.json
```

Set `ICESHOT_PYTHON` to choose a Python executable. Append a path to the JSON downloaded with **Save run settings** to compute that version. `marimo run protrusions.py` opens the native notebook. A static server can also serve `notebook/protrusions.html` and the interactive figure from this repository.
