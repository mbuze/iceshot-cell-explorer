# Squeeze and release

[Open the notebook](https://mbuze.github.io/iceshot-cell-explorer/squeeze/) · [Open the chamber on its own](https://mbuze.github.io/iceshot-cell-explorer/public/press/)

The walls move, the cells respond. Thirty cells and the intervening empty space occupy a rectangular chamber. Each cell has a target area, preferred length-to-width ratio, fixed orientation and shape-resistance coefficient. The ten colours are editable materials. A packing seed sets the starting sites, orientations and shuffled order for assigning types. The share controls set type counts by largest remainder. Changing relative area redistributes a fixed total occupied area. Changing material properties can change the settled starting outlines even with the same seed.

## The first three trials

The initial packing filled 72% of the chamber and had 32 touching pairs. Each native ICeShOT trial used seed 17, the same three materials, 24 closing steps, 12 steps at maximum compression, 24 opening steps and 16 steps at full width after opening. Counts compare the last frame with the settled first frame.

| Trial | Reduction in chamber width | Pairs at maximum compression (end of hold) | Starting pairs lost after release | New pairs after release |
| --- | ---: | ---: | ---: | ---: |
| No squeeze | 0% | 32 | 0 | 0 |
| Gentle | 6.16% | 34 | 0 | 2 |
| Strong | 23.24% | 52 | 2 | 20 |

With the stronger squeeze the mean long-to-short axis ratio of the jade cells increased by 0.18 at the end of the hold. The iris cells became rounder on average (change −0.11). The types differ in size and preferred elongation as well as resistance. Change just one property and replay to isolate its effect. Empty space can reappear around the outside when the walls withdraw. Cells have no attractive bond that pulls them away from newly acquired neighbours. Counts after release describe this observation time.

## Equations and checks

A point at offset **v** from cell *i* has cost **v**ᵀMᵢ**v**, where the eigenvalues of Mᵢ are *k/a* and *ka*. Here *k* is the shape-resistance coefficient and *a* the preferred length-to-width ratio. A shared additive weight per cell is adjusted to give it the specified area. Void has fixed zero cost. The rectangle is 9 × 6 model units before compression. The squeeze slider removes a fraction of the initially empty area by moving both side walls equally. At its maximum the chamber still has room for the prescribed areas.

At each step the site moves by 0.17 Mᵢ (**centroid** − **site**), descent of the normalised quadratic transport energy with fixed mobility. Changing *k* also changes the relaxation rate at this mobility. There is no prescribed cell trajectory, adhesion, or spring to the initial sites. The single-cell sample shows the equilibrium elliptical territory clipped by a rigid wall at a common applied load. Its unloaded area scales with the type’s relative size. The dotted ellipse has the same area and orientation as the unloaded sample. The slider is dimensionless.

Both backends use a 168 × 112 grid fitted to the moving walls and 120 settling steps. A pair touches when its common interface spans at least four grid edges. Cell elongation is the square root of the eigenvalue ratio of the second central moment of its pixels. Fine contact counts depend on resolution. The canvas draws the same weighted cost diagram on a finer grid. The viewer rejects a trajectory if a cell misses its area by more than 6% or more than 1.5% of a cell falls outside its largest four-connected component. Single-pixel slivers can occur.

**Native reference.** The three original runs use the vendored [Diez–Feydy ICeShOT solver](https://github.com/antoinediez/ICeShOT), including its L-BFGS dual and Laguerre allocation with void. Worst individual area error over all 231 displayed reference frames was 1.14% or less. The largest detached pixel fraction was 0.37% or less.

**Browser solver.** For edited settings a JavaScript worker balances the same quadratic costs, cell areas and zero-cost void using damped dual updates. It runs locally on GitHub Pages. We checked the browser allocation against the native reference weights at every frame of all three runs. Both counted the same neighbours at every checked frame. Solving the complete trajectories independently from the native settled starting state gave the same final contact counts (32, 34, 50) and a maximum centroid difference under 0.035 model units. Those checks cover the reference packing. Save a custom run's settings to repeat it with native ICeShOT.

## Reproduce

The native notebook opens with `marimo run squeeze.py` (marimo 0.23.5). Serving the repository with `python -m http.server` also serves the exported notebook and standalone figure.

With Node.js and the scientific Python environment described in the [repository README](README.md), run the following from the repository root. The first command prepares the deterministic sites, material assignments and wall schedule; the second runs ICeShOT natively. Use the JSON downloaded with **Save run settings**, or omit the JSON input to use the default strong squeeze.

```sh
node model/press.mjs press-17.json > /tmp/press-input.json
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python model/press.py /tmp/press-input.json /tmp/press-result.json
```

To regenerate the exported notebook, export to a temporary directory and place the resulting HTML next to the existing marimo runtime assets:

```sh
marimo export html-wasm squeeze.py -o /tmp/press-export --mode run --no-show-code --force
cp /tmp/press-export/index.html notebook/squeeze.html
```
