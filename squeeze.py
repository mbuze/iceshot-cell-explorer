import marimo

__generated_with = "0.23.5"
app = marimo.App(width="full", app_title="How far can a cell reach?")


@app.cell
def _():
    import marimo as mo
    import sys
    assets = "../public" if sys.platform == "emscripten" else "public"
    return assets, mo


@app.cell
def _(mo):
    mo.md("""
    # How far can a cell reach?

    Drag **Arm length**. The gold cells keep their area as their arms extend between neighbours.
    Switch to **Round control** to see the same tissue at the same wall spacing.
    """)
    return


@app.cell
def _(mo, assets):
    mo.Html(f'<iframe src="{assets}/press/index.html" title="Cell shape playground" style="display:block;width:100%;max-width:1120px;height:750px;border:0"></iframe>')
    return


@app.cell
def _(mo):
    mo.accordion({"What determines the outline?": mo.md("""
    The slider changes where a gold cell prefers to extend. Its neighbours compete for the
    same space. The model solves for the cell boundaries and lets the centres move.
    Mint outlines mark cells that touch the selected gold cell only when it has arms.
    The two small silhouettes are drawn at the same scale. Span is the larger of the outline’s width and height.

    Each setting starts from the same packing. The shapes are imposed preferences;
    contact and displacement are outcomes. This is a geometry experiment.
    [Simulation details](https://github.com/mbuze/iceshot-cell-explorer/blob/main/PRESS.md)
    """)})
    return


if __name__ == "__main__":
    app.run()
