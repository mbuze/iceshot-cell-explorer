const byId = id => document.getElementById(id);
const shape = byId("shape");
const extent = byId("extent");
const frame = byId("frame");
let runs;
let clock;
function showFrame() {
  const k = Number(frame.value);
  const rounded = shape.value === "Rounded";
  const key = rounded || Number(extent.value) === 0 ? "rounded-0" : shape.value.toLowerCase() + "-" + extent.value;
  for (const [panel, run, label] of [["reference", "rounded-0", "distanceA"], ["comparison", key, "distanceB"]]) {
    const view = byId(panel);
    view.style.backgroundImage = 'url("public/' + run + '.webp")';
    view.style.backgroundPosition = (k % 8) * 100 / 7 + "% " + Math.floor(k / 8) * 100 / 7 + "%";
    if (runs) byId(label).textContent = runs[run].displacement[k].toFixed(2) + " widths from start";
  }
  extent.disabled = rounded;
  byId("extentLabel").textContent = rounded ? "—" : extent.value + "%";
  byId("caption").textContent = (key === "rounded-0" ? "Rounded" : shape.value) + " cell";
  byId("frameLabel").textContent = k + " / 60";
}
function stop() {
  clearInterval(clock);
  clock = null;
  byId("play").textContent = "Play";
}
byId("play").onclick = () => {
  if (clock) return stop();
  byId("play").textContent = "Pause";
  if (frame.value === frame.max) frame.value = 0;
  showFrame();
  clock = setInterval(() => {
    frame.value = Number(frame.value) + 1;
    showFrame();
    if (frame.value === frame.max) stop();
  }, 110);
};
shape.oninput = extent.oninput = showFrame;
frame.oninput = () => { stop(); showFrame(); };
showFrame();
fetch("public/runs.json").then(r => r.json()).then(data => { runs = data; showFrame(); }).catch(() => {
  byId("distanceA").textContent = "Distance data unavailable";
  byId("distanceB").textContent = "Distance data unavailable";
});
