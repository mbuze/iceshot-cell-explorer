import marimo

__generated_with = "0.23.5"
app = marimo.App(width="full", app_title="Squeeze and release")


@app.cell
def _():
    import marimo as mo
    import sys
    assets = "../public" if sys.platform == "emscripten" else "public"
    return assets, mo


@app.cell
def _(mo):
    mo.md("""
    # Squeeze and release

    Two walls close on a mixture of cells, pause, and open again. Which cells still touch when the walls return? Try **Gentle** and **Strong** on the same packing, then turn on **Compare previous run**.
    """)
    return


@app.cell
def _(mo,assets):
    mo.Html(f'<iframe src="{assets}/press/index.html" title="Cell squeeze playground" style="display:block;width:100%;max-width:1180px;height:800px;border:0"></iframe>')
    return


@app.cell
def _(mo):
    mo.accordion({"How the cells move": mo.md("""
    Each cell keeps roughly the same area. The walls move inwards and reduce the empty space.
    Cells can deform and shift their centres. On release, cells can round up wherever there is room.
    A pair counts as touching when its shared edge spans at least four grid edges.

    Select a colour to edit that cell type. **Run same packing** keeps the starting sites and orientations.
    Editing the mixture changes how the cells settle around those sites. Relative areas are scaled so the
    whole population fills the percentage you chose. Shape resistance is a model parameter. The small
    drawing shows its effect on an isolated cell under a fixed push.

    The three preset runs for the original mixture were calculated with the ICeShOT CPU solver.
    Edited settings solve the same area-allocation problem in the browser.
    [Model and reproducibility notes](https://github.com/mbuze/iceshot-cell-explorer/blob/main/PRESS.md).
    """)})
    return


if __name__ == "__main__":
    app.run()
