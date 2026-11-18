import marimo

__generated_with = "0.23.5"
app = marimo.App(width="medium", app_title="One cell moving through skin")


@app.cell
def _():
    import sys
    import marimo as mo
    assets = "../public" if sys.platform == "emscripten" else "public"
    return assets, mo


@app.cell
def _(mo):
    mo.md("""
    # Does the moving cell push its neighbours?
    The gold cell takes the same route through a sheet of 48 skin cells in each run.
    The little ring marks where one neighbour started. The dot follows its centre.
    Switch the gold cell’s preferred shape and watch that neighbour.
    """)
    return


@app.cell
def _(mo):
    shape = mo.ui.radio(["Rounded", "Spindle", "Branched"], value="Branched", inline=True, label="Preferred shape")
    extent = mo.ui.slider(0, 100, step=50, value=100, show_value=True, label="Maximum shape change (%)")
    frame = mo.ui.slider(0, 60, value=30, show_value=True, label="Frame")
    mo.vstack([shape, extent, frame])
    return extent, frame, shape


@app.cell
def _(assets, extent, frame, mo, shape):
    _k = frame.value
    _kind = shape.value.lower()
    _key = "rounded-0" if _kind == "rounded" or extent.value == 0 else f"{_kind}-{extent.value}"
    _x, _y = (_k % 8)*100/7, (_k // 8)*100/7
    mo.Html(f'<div role="img" aria-label="{shape.value} cell at frame {_k}" style="width:100%;max-width:650px;aspect-ratio:3/2;background-image:url({assets}/{_key}.webp);background-size:800% 800%;background-position:{_x}% {_y}%"></div>')
    return


@app.cell
def _(mo):
    mo.md("""
    **What changes?** The model gives the gold cell a preference for a round body, a long thin body, or a body with branches. ICeShOT shares space between the cells while keeping each close to its target area. The neighbours can move and deform. With the rounded preference, the shape-change slider has no effect.

    These controls replay five saved simulations. Each uses the same starting tissue and a prescribed path for the gold cell. This lets us ask how shape affects the surrounding tissue. To see the earlier experiment in which protrusions guide the cell’s motion, open the [migration film](https://mbuze.github.io/iceshot-cell-explorer/public/migration.mp4).
    """)
    return


if __name__ == "__main__":
    app.run()
