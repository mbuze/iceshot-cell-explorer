"use strict";
const $ = id => document.getElementById(id);
const tissues = new Map();
let generation = 0, timer, activeTissue, selected = 0, loaded = false;
let moving, still;
let previousStrength = "100";
const svg = $("field");
const NS = "http://www.w3.org/2000/svg";
const palette = ["#598b8a","#6b9b96","#35686e","#56848b","#79a5a0","#467981","#659292","#49767a"];
const checked = name => document.querySelector('input[name="' + name + '"]:checked').value;
const distance = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1]);
const label = id => id === 0 ? "Gold cell" : "Background cell " + id;
function element(tag, attrs, parent = svg) {
  const node = document.createElementNS(NS,tag);
  for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
  parent.append(node);
  return node;
}
function stop() {
  clearInterval(timer);
  timer = null;
  $("play").textContent = "Play";
}
async function load(key) {
  if (!tissues.has(key)) {
    const request = (async () => {
      const response = await fetch("tissues/"+key+".json.gz");
      if (!response.ok) throw Error("Run unavailable: "+key);
      const bytes = await response.arrayBuffer();
      // Some hosts decompress .gz before delivery.
      if (new Uint8Array(bytes)[0] !== 31) return JSON.parse(new TextDecoder().decode(bytes));
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      return new Response(stream).json();
    })().catch(error => { tissues.delete(key); throw error; });
    tissues.set(key,request);
  }
  return tissues.get(key);
}
async function changeRun() {
  const token = ++generation;
  stop();
  loaded = false;
  svg.replaceChildren();
  $("play").disabled = true;
  $("readout").textContent = "Loading tissue…";
  const tissue = $("tissue").value;
  const shape = checked("shape");
  if (shape === "rounded") {
    if (!$("strength").disabled) previousStrength = $("strength").value;
    $("strength").value = "0";
    $("strength").disabled = true;
  } else if ($("strength").disabled) {
    $("strength").disabled = false;
    $("strength").value = previousStrength;
  }
  const amount = shape === "rounded" ? 0 : Number($("strength").value);
  const key = tissue + "-" + (amount ? shape : "rounded") + "-" + amount;
  try {
    const pair = await Promise.all([load(key+"-1"),load(key+"-0")]);
    if (token !== generation) return;
    [moving,still] = pair;
    if (activeTissue !== tissue) {
      // An explicit default selection; subsequent changes preserve the chosen identity.
      const start = moving.frames[0].centres;
      const peaks = start.map((p,id) => Math.max(...moving.frames.map(f=>distance(p,f.centres[id]))));
      selected = 1 + peaks.slice(1).indexOf(Math.max(...peaks.slice(1)));
      $("tracked").replaceChildren(...start.map((_,id)=>new Option(label(id),String(id))));
      activeTissue = tissue;
    }
    loaded = true;
    $("play").disabled = false;
    draw();
  } catch (err) {
    if (token === generation) $("readout").textContent = "Could not load this run. Reload the page to retry. " + err.message;
  }
}
function dot(p,r,attrs) {
  return element("circle",{cx:p[0],cy:700-p[1],r,...attrs});
}
function track(frames,k,id,attrs) {
  const points = frames.slice(0,k+1).map(f=>f.centres[id]).map(p=>p[0]+","+(700-p[1])).join(" ");
  element("polyline",{points,fill:"none","stroke-linecap":"round","stroke-linejoin":"round","pointer-events":"none",...attrs});
}
function draw() {
  if (!loaded) return;
  const k = Number($("frame").value);
  const crossing = checked("motion") === "1";
  const [run,control] = crossing ? [moving,still] : [still,moving];
  const f = run.frames[k], base = run.frames[0];
  svg.setAttribute("viewBox",$("full").checked ? "0 0 700 700" : "0 88 700 524");
  svg.replaceChildren();
  const defs = element("defs",{});
  for (const [i,color] of [...palette,"#ffbc56"].entries()) {
    const gradient = element("radialGradient",{id:"cell-tone-"+i,cx:".45",cy:".44",r:".69"},defs);
    element("stop",{offset:"30%","stop-color":color},gradient);
    element("stop",{offset:"98%","stop-color":i===palette.length ? "#ea984b" : "#284e59"},gradient);
  }
  for (const [id,d] of f.paths.entries()) {
    const tone = id===0 ? palette.length : (id*17+Math.floor(id/7)*3)%palette.length;
    const color = "url(#cell-tone-"+tone+")";
    element("path",{d,"fill-rule":"evenodd",fill:color,stroke:id===0 ? "#fce1a4" : "#87aba9","stroke-width":1.4,
                    "data-id":id,class:"cell","aria-label":label(id)});
  }
  if ($("borders").checked) {
    for (const d of base.paths) element("path",{d,fill:"none",stroke:"#e2f4ed","stroke-width":1.1,
        "stroke-dasharray":"3 4",opacity:.82,"pointer-events":"none"});
  }
  if ($("trails").checked) {
    f.centres.forEach((pos,id)=>{
      if (id === selected || id===0) return;
      track(run.frames,k,id,{stroke:"#dbefe6","stroke-width":1.7,opacity:.78});
      dot(pos,2.5,{fill:"#e2f4ed","pointer-events":"none"});
    });
  }
  element("path",{d:f.paths[selected],fill:"none",stroke:"#fff5cf","stroke-width":3.2,"pointer-events":"none"});
  track(run.frames,k,selected,{stroke:"#1a4041","stroke-width":5.4});
  track(run.frames,k,selected,{stroke:"#fff6d5","stroke-width":2.6});
  if ($("origin").checked) {
    dot(base.centres[selected],5.5,{fill:"none",stroke:"#163637","stroke-width":4,"pointer-events":"none"});
    dot(base.centres[selected],5.5,{fill:"none",stroke:"#fff6d5","stroke-width":2,"pointer-events":"none"});
  }
  dot(f.centres[selected],4.3,{fill:"#fff6d5",stroke:"#163637","stroke-width":1.5,"pointer-events":"none"});
  if ($("origin").checked) {
    const target = dot(base.centres[selected],9,{fill:"transparent",cursor:"pointer","data-start":"true"});
    element("title",{},target).textContent = "Go to this cell’s starting centre";
  }
  $("tracked").value = String(selected);
  $("count").textContent = k + " / 48";
  $("distance").textContent = (distance(base.centres[selected],f.centres[selected])/100).toFixed(2)+" cell widths";
  $("other").textContent = (distance(control.frames[0].centres[selected],control.frames[k].centres[selected])/100).toFixed(2)+" cell widths";
  $("otherLabel").textContent = crossing ? "With gold held still" : "With gold crossing";
  $("readout").textContent = "Background contacts since the start: "+f.lost+" lost, "+f.gained+" gained.";
}
svg.addEventListener("click",e=>{
  if (!loaded) return;
  if (e.target.hasAttribute("data-start")) {
    $("first").click();
    return;
  }
  if (!e.target.hasAttribute("data-id")) return;
  selected = Number(e.target.getAttribute("data-id")); draw();
});
$("tracked").onchange = ()=>{selected=Number($("tracked").value); draw();};
$("first").onclick = ()=>{stop(); $("frame").value=0; draw();};
$("frame").oninput = ()=>{stop(); draw();};
$("play").onclick = ()=>{
  if (!loaded) return;
  if (timer) return stop();
  if (Number($("frame").value)===48) $("frame").value=0;
  $("play").textContent="Pause"; draw();
  timer=setInterval(()=>{
    $("frame").value=Number($("frame").value)+1; draw();
    if (Number($("frame").value)===48) stop();
  },135);
};
for (const el of document.querySelectorAll('[name="motion"], .layers input')) el.onchange=draw;
for (const el of document.querySelectorAll('[name="shape"], #strength, #tissue')) el.onchange=changeRun;
changeRun();

// Fit the notebook output to the actual figure, including on narrow screens.
if (window.frameElement) {
  new ResizeObserver(() => {
    window.frameElement.style.height = document.querySelector("main").offsetHeight + 4 + "px";
  }).observe(document.querySelector("main"));
}
