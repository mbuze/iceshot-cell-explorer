# One cell moving through skin

[Open the comparison](https://mbuze.github.io/iceshot-cell-explorer/) · [Open the interactive marimo notebook](https://mbuze.github.io/iceshot-cell-explorer/notebook/)

One gold pigment cell follows a prescribed path through 48 surrounding cells. Compare a rounded, spindle-shaped or branched preference while keeping the starting tissue, path and target areas fixed. The ring and dot track one neighbour's initial and current area centroid. Distance is in units of the square root of the average target cell area.

The controls replay five ICeShOT runs. The zero-strength run is shared across shapes. The two other amplitudes are 50% and 100% of the chosen elongation or branch reach. All runs extend the shape early and partially retract it late. A rounded preference has no elongation parameter. One seed (17) and an imposed path make this a demonstration of geometry. Biological inference would require measured shapes, tracks and replicates.

The migration film below the comparison uses an earlier model in which protrusions guide the body. It was inspired by the live imaging of melanoblasts in [Li, Mort and colleagues (2011)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3464460/). The geometry uses the L-BFGS solver and Laguerre allocation from [ICeShOT, by Antoine Diez and Jean Feydy](https://github.com/antoinediez/ICeShOT). The upstream MIT licence is in model/vendor/LICENCE.txt.

## Run

Serve the folder with `python -m http.server` and open the printed address. The comparison page uses plain browser controls. The notebook uses marimo and downloads its browser Python runtime on first use. For the native notebook, install marimo 0.23.5 and run `marimo run explorer.py` from this directory.

To repeat the calculations on Linux with Python 3.12 and a C++ compiler with OpenMP:

```sh
python -m pip install -r model/requirements.txt
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python model/build.py
```

The 196 × 196 raster has 61 recorded frames after 10 settling steps. Each host site relaxes towards its new centroid with a weak spring to its original position. The gold cell's preferred transport cost changes with time. The solver assigns every pixel to a cell while approximating the prescribed areas. If a trial splits the gold cell, the code shortens the attempted extension and solves again. Rendering smooths the pixel boundaries. Measurements use the original labels. The files in public include image sheets, measured displacements, run times and area errors. Timings include the stepping loop and exclude rendering.

To update the browser notebook after editing explorer.py, run `marimo export html-wasm explorer.py -o notebook --mode run --no-show-code --force`. The hosted notebook reads the common image sheets from ../public. GitHub Pages serves the root of the gh-pages branch.
