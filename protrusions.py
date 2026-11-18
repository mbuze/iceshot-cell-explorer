import marimo

__generated_with = "0.23.5"
app = marimo.App(width="full", app_title="Protrusions and neighbours")


@app.cell
def _():
    import sys
    import marimo as mo
    assets = "../public" if sys.platform == "emscripten" else "public"
    return assets, mo


@app.cell
def _(mo):
    mo.md("""
    # Protrusions and neighbours

    Both gold cells try the same sequence of protrusions. Play them together, or pick an attempt and see whether the body reaches its earlier tip before the arm retracts.
    """)
    return


@app.cell
def _(assets, mo):
    mo.Html(f'<iframe src="{assets}/protrusions/index.html?v=cell-editor-4" title="Protrusion experiment" style="display:block;width:100%;max-width:1160px;height:900px;border:0"></iframe>')
    return


@app.cell
def _(mo):
    mo.accordion({"How the cells move": mo.md("""
    At each step the gold cell and its neighbours share space while keeping roughly the same area. A protrusion grows towards a proposed point, holds, then retracts. After a delay, the body moves towards the part of the arm it actually managed to extend. Several tips can pull in different directions.

    The short preview keeps each neighbour’s chosen shape preference. The captions flag a shortened gold arm or a split outline in the allocation.

    The opening pair runs through ICeShOT's native solver. Edited settings solve the same allocation in the browser. [Model and measurements](https://github.com/mbuze/iceshot-cell-explorer/blob/main/PROTRUSIONS.md)
    """)})
    return


if __name__ == "__main__":
    app.run()
