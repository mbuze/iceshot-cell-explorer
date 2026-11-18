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

    Choose a cell type and change its shape. Press the mixture between the walls,
    then watch which cells are still touching after release.
    """)
    return


@app.cell
def _(mo, assets):
    mo.Html(f'<iframe src="{assets}/press/cycle.html" title="Ten-type cell mixer" style="display:block;width:100%;max-width:1120px;height:750px;border:0"></iframe>')
    return


if __name__ == "__main__":
    app.run()
