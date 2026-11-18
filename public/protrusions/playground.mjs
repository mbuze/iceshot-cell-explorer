import {defaultSettings,hostNames,palette,ticks,types} from './model.mjs';
import {draw} from '../press/render.mjs';
import {decode} from './raster.mjs';

const $=id=>document.getElementById(id);
const controls=[], typeButtons=[], conditions=['open','mixed'];
let cfg=structuredClone(defaultSettings), runs=null, displayedCfg=null, worker=null, waiting=null;
let time=0, selection=null, timer=null, request=0, solving=false;

function slider(parent,id,label,min,max,step,value,onInput,format){
  const row=document.createElement('label');
  row.className='slider';
  const name=document.createElement('span');
  name.textContent=label;
  const output=document.createElement('output'), input=document.createElement('input');
  Object.assign(input,{id,type:'range',min,max,step});
  input.setAttribute('aria-label',label);
  row.append(name,output,input);
  $(parent).append(row);
  function update(){input.value=value();output.textContent=format(+input.value);}
  controls.push(update);
  input.oninput=()=>{onInput(+input.value);update();scheduleRun();};
}
function setting(parent,id,label,min,max,step,format){
  slider(parent,id,label,min,max,step,()=>cfg[id],value=>{
    cfg[id]=value;
    if(id==='fill' && value>0 && !cfg.enabled.length){cfg.enabled=defaultSettings.enabled.slice();sync();}
  },format);
}
setting('protrusionSettings','life','Protrusion lifetime',4,18,1,v=>v+' steps');
setting('protrusionSettings','interval','Steps between attempts',2,8,1,v=>'about '+v);
setting('protrusionSettings','reach','Attempted reach',.85,1.95,.01,v=>v.toFixed(2));
setting('protrusionSettings','pull','Body pull',.05,.49,.01,v=>v.toFixed(2));
setting('tissueSettings','fill','Occupied area',0,88,1,v=>v+'%');
setting('tissueSettings','tether','Hold neighbours in place',0,.25,.005,v=>v===0?'Off':v.toFixed(3));

hostNames.forEach((name,i)=>{
  const button=document.createElement('button');
  button.type='button';
  const dot=document.createElement('i');
  dot.style.setProperty('--cell-colour','rgb('+palette[i+1].join(',')+')');
  button.append(dot,name);
  button.onclick=()=>{
    cfg.enabled=cfg.enabled.includes(i)?cfg.enabled.filter(v=>v!==i):[...cfg.enabled,i].sort((a,b)=>a-b);
    if(!cfg.enabled.length)cfg.fill=0;
    if(cfg.enabled.length===1 && cfg.fill===0)cfg.fill=defaultSettings.fill;
    sync();scheduleRun();
  };
  $('types').append(button);typeButtons.push(button);
  $('editType').add(new Option(name,String(i)));
});
function selectedType(){return +$('editType').value;}
function typeValue(prop,fallback){
  const id=selectedType();
  return cfg.overrides[id]?.[prop]??types[id][fallback];
}
function editType(prop,value){
  const id=selectedType(),[shape,,,resistance]=types[id];
  cfg.overrides[id]??={shape,resistance};
  cfg.overrides[id][prop]=value;
  if(!cfg.enabled.includes(id))cfg.enabled=[...cfg.enabled,id].sort((a,b)=>a-b);
  if(cfg.fill===0)cfg.fill=defaultSettings.fill;
  sync();scheduleRun();
}
slider('typeSettings','resistance','Shape resistance',.55,1.85,.01,
  ()=>typeValue('resistance',3),value=>editType('resistance',value),String);
$('editType').onchange=sync;
$('outline').onchange=()=>editType('shape',$('outline').value);

function sync(){
  for(const update of controls)update();
  typeButtons.forEach((b,i)=>b.setAttribute('aria-pressed',cfg.enabled.includes(i)));
  $('outline').value=typeValue('shape',0);
  $('allTypes').textContent=cfg.enabled.length===10?'Use opening mixture':'Use all ten types';
}
$('allTypes').onclick=()=>{
  cfg.enabled=cfg.enabled.length===10?defaultSettings.enabled.slice():hostNames.map((_,i)=>i);
  if(cfg.fill===0)cfg.fill=defaultSettings.fill;
  sync();scheduleRun();
};
$('newAttempts').onclick=()=>{cfg.seed=(cfg.seed+113)>>>0;scheduleRun();};
$('newTissue').onclick=()=>{cfg.layoutSeed=((cfg.layoutSeed??defaultSettings.seed)+541)>>>0;scheduleRun();};
$('reset').onclick=()=>{cfg=structuredClone(defaultSettings);sync();launch(true);};

function pause(){
  clearInterval(timer);timer=null;$('play').textContent='Play';
}
function seek(t){
  time=Math.max(0,Math.min(ticks,t));$('time').value=time;
  render();
}
$('time').oninput=()=>{pause();seek(+$('time').value);};
$('play').onclick=()=>{
  if(timer){pause();return;}
  if(time>=ticks)seek(0);
  $('play').textContent='Pause';
  timer=setInterval(()=>{seek(time+1);if(time>=ticks)pause();},87);
};
$('restart').onclick=()=>{pause();seek(0);};
$('trail').onchange=render;
$('event').onchange=()=>{
  selection=$('event').value===''?null:+$('event').value;
  if(selection===null){render();return;}
  pause();
  const a=runs.open.events[selection],b=runs.mixed.events[selection];
  seek(Math.max(a.peakTick,b.peakTick));
};
$('inspect-result').onclick=()=>{
  if(selection===null)return;
  const e=runs.open.events[selection];
  pause();seek(e.start+e.life);
};

function describe(run){
  if(selection!==null){
    const {id,start,life,caught,far}=run.events[selection];
    const name='Attempt '+(id+1)+' · ';
    if(time<start)return name+'Waiting to start';
    if(caught!==null && time>=caught)return name+'Body reached the earlier tip';
    if(time<start+life)return name+'Protrusion active';
    return name+(far?'Retracted before the body arrived':'No distinct arm formed');
  }
  const ended=run.events.filter(e=>e.start+e.life<=time);
  const followed=run.events.filter(e=>e.caught!==null && e.caught<=time).length;
  const retracted=ended.filter(e=>e.far && e.caught===null).length;
  const active=run.frames[time].tips.length;
  const parts=[active+' visible '+(active===1?'tip':'tips')];
  if(followed || ended.length)parts.push(followed+' followed',retracted+' retracted before arrival');
  const noArm=ended.filter(e=>!e.far).length;
  if(noArm)parts.push(noArm+' without an arm');
  return parts.join(' · ');
}

function drawPatch(which){
  const run=runs[which],frame=run.frames[time],canvas=$(which);
  const ctx=canvas.getContext('2d');
  const {nx,ny}=run.grid;
  const raster={width:nx,height:ny,labels:decode(frame.raster,nx*ny)};
  const map=draw(canvas,run,frame,false,{palette,selected:0,newIds:new Set(),noWalls:true,raster,softEdges:true});
  const point=p=>[map.left+p[0]*map.scale,map.top+p[1]*map.scale];
  const dot=(xy,r,fill,stroke)=>{
    ctx.beginPath();ctx.arc(...point(xy),r,0,Math.PI*2);
    ctx.fillStyle=fill;ctx.fill();
    ctx.strokeStyle=stroke;ctx.lineWidth=1.35;ctx.stroke();
  };
  if($('trail').checked && time>0){
    const history=run.frames.slice(0,time+1).map(f=>point(f.sites[0]));
    ctx.beginPath();ctx.moveTo(...history[0]);
    for(const pt of history.slice(1))ctx.lineTo(...pt);
    ctx.lineWidth=3.4;ctx.strokeStyle='#202d32';ctx.stroke();
    ctx.lineWidth=1.5;ctx.strokeStyle='#ede4bb';ctx.stroke();
  }
  if(selection!==null){
    const e=run.events[selection],target=e.caught!==null && time>=e.caught?e.reachedTarget:e.far;
    if(target&&(time>=e.peakTick || (e.caught!==null && time>=e.caught))){
      dot(target,5.2,'#274944b5','#b7f4c8');
    }
  }
  for(const [id,x,y] of frame.tips){
    const active=id===selection;
    dot([x,y],active?5:2.9,active?'#b7ffce':'#fff3bd','#243333');
  }
  dot(frame.sites[0],4.25,'#fff1bd','#75472e');
  let note=describe(run);
  if(frame.scale<1 && frame.probes.length)note+=' · Reach shortened by the solver';
  if(frame.detached>.055)note+=' · A neighbour has a split outline';
  $(which+'-outcome').textContent=note;
  $(which+'-occupancy').textContent=which==='open'?'1 cell':(run.material.length-1)+' neighbours · '+Math.round(run.occupancy)+'% filled';
}
function render(){
  if(!runs)return;
  $('step').textContent=time+' / '+ticks;
  for(const which of conditions)drawPatch(which);
  $('inspect-result').disabled=selection===null;
  $('key').hidden=false;
}
function present(pair,settings,first=false){
  pause();
  runs=pair;displayedCfg=settings;
  const events=pair.open.events;
  $('event').replaceChildren(new Option('All protrusions',''),...events.map(e=>new Option('Attempt '+(e.id+1)+' · step '+e.start,String(e.id))));
  if(selection!==null && selection>=events.length)selection=null;
  $('event').value=selection===null?'':String(selection);
  $('time').max=ticks;
  const early=pair.open.frames.findIndex((frame,i)=>frame.tips.length>=3 && pair.mixed.frames[i].tips.length>=3);
  const start=early>=0?early:pair.open.frames.findIndex(frame=>frame.tips.length>0);
  for(const id of ['play','restart','time','event','save'])$(id).disabled=false;
  $('status').textContent=isOpening(settings)?'Opening runs solved with ICeShOT.':'Both views updated.';
  seek(first?start:time);
}
const moverKey=s=>[s.seed,s.life,s.interval,s.reach,s.pull].join('/');
const isOpening=s=>JSON.stringify(s)===JSON.stringify(defaultSettings);
let reference=null;
async function opening(){
  if(!reference)reference=Promise.all(conditions.map(async condition=>{
    const r=await fetch(condition+'.json');if(!r.ok)throw Error('Could not load opening runs.');
    const run=await r.json();
    if(run.frames.length!==ticks+1 || !run.grid)throw Error('Opening runs are being updated.');
    return run;
  })).then(([open,mixed])=>({open,mixed})).catch(e=>{reference=null;throw e;});
  return reference;
}
function cancel(){
  request++;
  if(solving){worker.terminate();worker=null;solving=false;}
  clearTimeout(waiting);pause();
}
function scheduleRun(){
  cancel();$('status').textContent='Recalculating both views…';
  waiting=setTimeout(()=>launch(false),45);
}
async function launch(first){
  cancel();
  const token=request,settings=structuredClone(cfg);
  $('status').textContent='Recalculating both views…';
  if(isOpening(settings)){
    try{
      const pair=await opening();
      if(token===request)present(pair,settings,first);
      return;
    }catch(e){
      if(token!==request)return;
    }
  }
  const skipOpen=Boolean(runs && moverKey(displayedCfg)===moverKey(settings));
  if(skipOpen && settings.fill===0){
    present({open:runs.open,mixed:runs.open},settings,first);
    return;
  }
  worker??=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
  solving=true;
  worker.onmessage=({data})=>{
    if(token!==request)return;
    if(data.progress){
      $('status').textContent=(data.progress.fill?'Neighbours':'Open space')+' · calculating step '+data.progress.tick+' of '+ticks;
      return;
    }
    solving=false;
    if(data.error){
      $('status').textContent=data.error+(runs?' The earlier run is still shown.':'');
      return;
    }
    present({open:data.open??runs.open,mixed:data.mixed},settings,first);
  };
  worker.onerror=e=>{
    if(token!==request)return;
    solving=false;worker.terminate();worker=null;
    $('status').textContent='The simulation stopped. '+e.message;
  };
  worker.postMessage({cfg:settings,skipOpen});
}
$('save').onclick=()=>{
  if(!displayedCfg)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(displayedCfg,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='protrusions-'+displayedCfg.seed+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};
if(window.top===window)$('standalone').hidden=false;
sync();launch(true);
if(window.frameElement)new ResizeObserver(()=>{
  window.frameElement.style.height=document.querySelector('main').offsetHeight+4+'px';
}).observe(document.querySelector('main'));
