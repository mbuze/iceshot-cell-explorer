import marimo

__generated_with = "0.23.5"
app = marimo.App(width="full", app_title="One cell crossing a tissue")


@app.cell
def _():
    import marimo as mo
    import sys
    assets = "../public" if sys.platform == "emscripten" else "public"
    return assets, mo


@app.cell
def _(mo):
    mo.md("""
    # One cell crossing a tissue

    Pick a background cell and watch where it goes as the gold cell passes.
    Switch to **Stay put** to see the same tissue with the gold cell held in place.
    """)
    return


@app.cell
def _(assets, mo):
    mo.Html(f'<iframe src="{assets}/figure.html" title="Interactive tissue experiment" style="width:100%;max-width:1100px;height:650px;border:0;display:block"></iframe>')
    return


@app.cell
def _(assets, mo):
    mo.accordion({
        "What do the borders and tracks show?": mo.md("""
        The solid borders show which part of the sheet belongs to each cell. The dashed starting borders stay fixed so you can see a boundary move or a pair of neighbours separate. Each track follows the centre of the cell’s **area**. The open ring marks the selected cell’s starting centre. One cell width is the square root of the average cell area.

        The contact count compares the current frame with the first frame. Two background cells count as touching when at least four raster edges meet. A contact can disappear and later return. The initial selection highlights the background cell with the largest excursion in the crossing run. You can select any of the 49 cells.
        """),
        "What did we change in the simulation?": mo.md("""
        The gold cell has just over twice the average background cell area. We prescribe a path 3.5 cell widths across the tissue. The background cells can change shape and shift their centres, with a weak pull towards their starting positions. ICeShOT allocates space to every cell at each step. This gives displacement and changes of neighbours. It does not measure a pushing force.

        The three sheets have different arrangements or size distributions. The aligned sheet also favours horizontal elongation. The controls load 30 precomputed runs. In each matched **Stay put** run the gold cell’s anchor stays still while its shape preference follows the same schedule.
        """),
        "Earlier migration film": mo.Html(f'<video controls playsinline preload="none" style="width:100%;max-width:720px" src="{assets}/migration.mp4"></video>')
    })
    return


if __name__ == "__main__":
    app.run()
