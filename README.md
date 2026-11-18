# Cell simulations with ICeShOT

[**Ten-type cell mixer**](https://mbuze.github.io/iceshot-cell-explorer/squeeze/) follows a mixture through a squeeze-and-release cycle. The separate [cell reach experiment](https://mbuze.github.io/iceshot-cell-explorer/public/press/) compares branched cells with a round control. [Model, solver checks and reproduction](PRESS.md).

[**Protrusions and neighbours**](https://mbuze.github.io/iceshot-cell-explorer/protrusions/) plays matched attempts in open space and in a mixture of other cells. [Model and measurements](PROTRUSIONS.md).

## One cell crossing a tissue

[Open the marimo notebook](https://mbuze.github.io/iceshot-cell-explorer/) · [Open just the interactive figure](https://mbuze.github.io/iceshot-cell-explorer/public/figure.html)

Follow any cell as a gold cell crosses 48 neighbours. The selected cell has a cream outline and a track from its starting centre. Clicking the open ring rewinds to the first frame. You can toggle the starting borders, all host tracks and full-sheet view. The tracking menu is a keyboard-accessible alternative to clicking the sheet. Within a tissue, switching shape or motion preserves the tracked cell and frame.

## The experiment

For each tissue we computed a rounded gold cell and two amplitudes each for spindle and branched shapes. Each of the five settings was run twice with an identical initial allocation. In one run the gold cell's anchor travels 3.5 nominal widths. In its control, the anchor stays fixed and the same shape-change schedule plays out. The surrounding cells relax in both. Comparing displacements in those two runs separates the effect of prescribed travel from background relaxation and reshaping. A nominal width is the square root of mean area over all 49 cells.

- **Even-sized mosaic.** Jittered sites and moderately varying target areas.
- **Aligned, elongated cells.** Staggered rows with a shared horizontal elongation preference. The background quadratic cost weights the squared horizontal and vertical offsets by 1/2.8 and 2.8.
- **Mixed cell sizes.** More initial positional jitter and a broader distribution of target areas.

The gold cell's target area is 2.15 times the mean host area. The host sites take a 0.52 step towards their new centroids plus a 0.003 restoring step towards their initial sites after each solve. Borders and displacement emerge from the allocated territories and relaxation rule. The model prescribes the gold cell’s path and supplies no estimate of tissue forces. These settings were chosen to make rearrangements easy to inspect.

## What the selected numbers mean

In the mixed-size rounded run, background cell 9 finished 1.20 widths from its starting centre, versus 0.03 in the matched stationary control. At the final frame the crossing tissue had lost 19 original host–host contacts and gained 17. The held control lost 4 and gained 8. These counts compare contact sets with frame zero. A pair counts when its interface spans at least four raster edges. The viewer initially selects the host with the largest excursion in the chosen crossing run. This illustrates the largest movements in this one patch. Click another host to see how the response varies.

## When one cell occupies two patches

In the crossing run with mixed cell sizes and full branching, select background cell 17 at frame 13. Its two patches contain 236 and 210 of the original grid pixels. They remain separate even when pixels touching only at corners count as connected. Both patches have the same cell identity and contribute to its area centroid. This is a limitation for interpreting the track as the motion of a single body. The retry in this example checks the gold cell only.

## Reproduce

Native notebook: install marimo 0.23.5 and run `marimo run explorer.py`. For the exported presentation, serve this directory with `python -m http.server`; the notebook downloads its browser Python runtime on first use. The linked standalone figure uses the same files and controls. The browser replays precalculated runs.

To repeat all 30 CPU solves on Linux (Python 3.12, a C++ compiler and OpenMP):

```sh
python -m pip install -r model/requirements.txt
for tissue in mosaic aligned mixed; do
    OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python model/build.py --tissue "$tissue"
done
```

Seed 17, 168 × 168 raster, 22 settling steps and 49 recorded frames. The solver retries with a shorter reach when the gold cell would split. Each compressed JSON file contains smoothed outlines, centroids from the original raster, contact counts, area errors, accepted strengths and elapsed solve time. All ten runs within each tissue share the same first frame. The largest individual area error across the experiment was 7.82%.

The geometry uses the [ICeShOT L-BFGS solver and Laguerre allocation by Antoine Diez and Jean Feydy](https://github.com/antoinediez/ICeShOT). The upstream MIT licence is in model/vendor/LICENCE.txt. The separate [migration film](public/migration.mp4) uses protrusion-driven movement inspired by [Li, Mort and colleagues (2011)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3464460/).

Re-export after changing the notebook using `marimo export html-wasm explorer.py -o notebook --mode run --no-show-code --force`. Pages serves the root of the gh-pages branch.
