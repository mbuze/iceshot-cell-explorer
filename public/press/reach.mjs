import {initial} from './reach-model.mjs';
import {draw} from './render.mjs';
const $=id=>document.getElementById(id), cfg={...initial};
const palette=[[62,130,126],[255,178,77],[113,146,149]];
const worker=new Worker(new URL('./reach-worker.mjs',import.meta.url),{type:'module'});
let sweeping=false,direction=1,sweepTimer=null;
let busy=false,queued=null,selected=21,round=false,display=null,nativePair=null,map;
function neighbours(result){
  const n=result.material.length,ids=new Set();
  for(const edge of result.frame.contacts){
    const a=Math.floor(edge/n),b=edge%n;
    if(a===selected)ids.add(b);
    if(b===selected)ids.add(a);
  }
  return ids;
}
function silhouette(canvas,m) {
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);
  let x0=m.nx,y0=m.ny,x1=-1,y1=-1;
  for(let y=0;y<m.ny;y++)for(let x=0;x<m.nx;x++)if(m.mask[y*m.nx+x]===selected){
    x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
  }
  if(x1<x0)return;
  const img=ctx.createImageData(w,h),unit=24/m.scale;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const xx=Math.round((x-w/2)/unit+(x0+x1)/2),yy=Math.round((y-h/2)/unit+(y0+y1)/2);
    if(xx<0||xx>=m.nx||yy<0||yy>=m.ny||m.mask[yy*m.nx+xx]!==selected)continue;
    const z=(y*w+x)*4;img.data.set([175,100,37,255],z);
  }
  ctx.putImageData(img,0,0);
}
const offscreen=document.createElement('canvas');
offscreen.width=336;offscreen.height=220;
function render(){
  if(!display)return;
  const {result,control,cfg:shown}=display;
  const now=neighbours(result),before=neighbours(control);
  const fresh=new Set([...now].filter(i=>!before.has(i)));
  const style={palette,selected,newIds:$('highlight').checked&&!round?fresh:new Set()};
  const active=round?control:result,alternate=round?result:control;
  map=draw($('tissue'),active,active.frame,false,style);
  const otherMap=draw(offscreen,alternate,alternate.frame,false,style);
  silhouette($('before'),round?map:otherMap);
  silhouette($('after'),round?otherMap:map);
  const a=control.frame.spans[selected],b=result.frame.spans[selected];
  $('result').textContent='Span '+(b/a).toFixed(2)+'× the round control. Touching '+now.size+
    (now.size===1?' cell':' cells')+' here, '+before.size+' in the control.';
  const limited=result.frame.applied<shown.reach-.1 || result.frame.effectiveStretch<shown.stretch-.01;
  $('limit').textContent=limited?'To keep cells together: '+Math.round(result.frame.applied)+'% arm length, '+result.frame.effectiveStretch.toFixed(2)+'× background elongation.':'';
  $('current').setAttribute('aria-pressed',!round);$('round').setAttribute('aria-pressed',round);
  $('tissue').dataset.solved=JSON.stringify(shown);
}
function sync(){
  for(const key of ['reach','press','stretch'])$(key).value=cfg[key];
  $('reachValue').textContent=cfg.reach+'%';
  $('pressValue').textContent=(.35*cfg.press).toFixed(1)+'% narrower';
  $('stretchValue').textContent=cfg.stretch.toFixed(2)+'×';
  for(const b of document.querySelectorAll('[data-shape]'))b.setAttribute('aria-pressed',b.dataset.shape===cfg.shape);
}
function stopSweep(){
  sweeping=false;clearTimeout(sweepTimer);$('sweep').textContent='Sweep arm length';
}
function continueSweep(){
  clearTimeout(sweepTimer);
  if(!sweeping || busy || queued)return;
  sweepTimer=setTimeout(()=>{
    if(cfg.reach===100)direction=-1;
    if(cfg.reach===0 && direction<0){stopSweep();return;}
    cfg.reach+=5*direction;change();
  },65);
}
$('sweep').onclick=()=>{
  if(sweeping){stopSweep();return;}
  sweeping=true;direction=1;cfg.reach=0;$('sweep').textContent='Stop sweep';change();
};
function next(){
  if(busy || !queued)return;
  const wanted=queued;queued=null;
  if(nativePair && Object.keys(initial).every(k=>wanted[k]===initial[k])){
    display=nativePair;render();$('state').textContent='';continueSweep();return;
  }
  busy=true;worker.postMessage(wanted);
}
function change(){
  sync();queued={...cfg};round=false;
  $('state').textContent='Updating tissue…';next();
}
worker.onmessage=({data})=>{
  busy=false;
  if(!data.error){display=data;render();}
  $('state').textContent=queued?'Updating tissue…':(data.error||'');
  if(data.error)stopSweep();
  next();continueSweep();
};
worker.onerror=e=>{stopSweep();busy=false;$('state').textContent='Could not update the tissue. '+e.message;};
for(const k of ['reach','press','stretch'])$(k).oninput=()=>{stopSweep();cfg[k]=+$(k).value;change();};
for(const b of document.querySelectorAll('[data-shape]'))b.onclick=()=>{stopSweep();cfg.shape=b.dataset.shape;change();};
$('reset').onclick=()=>{stopSweep();Object.assign(cfg,initial);selected=21;$('cell').value='21';change();};
$('round').onclick=()=>{stopSweep();round=true;render();};
$('current').onclick=()=>{round=false;render();};
$('highlight').onchange=render;
$('cell').onchange=()=>{selected=+$('cell').value;render();};
$('tissue').onclick=e=>{
  if(!map)return;
  const rect=$('tissue').getBoundingClientRect();
  const x=Math.floor((e.clientX-rect.left)*$('tissue').width/rect.width-map.left);
  const y=Math.floor((e.clientY-rect.top)*$('tissue').height/rect.height-map.top);
  if(x<0||y<0||x>=map.nx||y>=map.ny)return;
  const id=map.mask[y*map.nx+x];if(display.result.material[id]?.type!==1)return;
  selected=id;$('cell').value=id;render();
};
if(window===window.top)$('solo').hidden=false;
sync();
Promise.all(['native','control'].map(async name=>{
  const r=await fetch('reach-'+name+'.json');if(!r.ok)throw Error('missing reference');return r.json();
})).then(([result,control])=>{nativePair={result,control,cfg:{...initial}};if(!display&&!busy)change();})
  .catch(()=>{if(!display&&!busy)change();});
if(window.frameElement)new ResizeObserver(()=>{
  window.frameElement.style.height=document.querySelector('main').offsetHeight+4+'px';
}).observe(document.querySelector('main'));
