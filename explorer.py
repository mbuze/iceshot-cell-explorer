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

    The gold cell follows a set path through 48 neighbours. Turn on **Starting borders**
    to see which neighbours move aside, or choose **Stay put** to watch the same sheet with the gold cell held in place.
    """)
    return


@app.cell
def _(assets, mo):
    mo.Html(f'<iframe src="{assets}/figure.html" title="Interactive tissue experiment" style="width:100%;max-width:1100px;height:650px;border:0;display:block"></iframe>')
    return


@app.cell
def _(assets, mo):
    mo.vstack([
        mo.md("""
        Sometimes a neighbour appears in two pieces. Click either piece and both light up.
        The simulation counts them as one cell.
        """),
        mo.accordion({
            "Watch a pigment cell reach between its neighbours": mo.Html(f'<video controls playsinline preload="none" style="width:100%;max-width:720px" src="{assets}/migration.mp4"></video>')
        }),
        mo.md("[Model and measurements](https://github.com/mbuze/iceshot-cell-explorer#the-experiment)")
    ])
    return


if __name__ == "__main__":
    app.run()
