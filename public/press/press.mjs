import {W,names,colours,defaults,packing} from './model.mjs';
import {draw,sample} from './render.mjs';
const $=id=>document.getElementById(id);
const cfg=defaults(), refs=new Map(), slots={}, typeButtons=[];
let editing=0, run=null, previous=null, generation=0, worker=null, timer=null;
if(window.top===window)$('solo').hidden=false;
function slider(group,key,title,min,max,step,format) {
  const row=document.createElement('label');row.className='slider';
  const text=document.createElement('span');text.textContent=title;
  const value=document.createElement('output'),input=document.createElement('input');
  input.type='range';input.min=min;input.max=max;input.step=step;input.id=key;
  input.setAttribute('aria-label',title);row.append(text,value,input);$(group).append(row);
  const perType=group==='materialInputs', slot={input,value,format,perType};slots[key]=slot;
  input.oninput=()=>{
    (perType?cfg.types[editing]:cfg)[key]=Number(input.value);
    edit();
  };
}
slider('pressInputs','fill','Initial space filled',45,85,1,v=>v+'%');
slider('pressInputs','squeeze','Squeeze',0,95,1,v=>((1-cfg.fill/100)*v).toFixed(1)+'% narrower');
slider('pressInputs','pace','Closing time',12,48,6,v=>v+' steps');
slider('pressInputs','cycles','Cycles',1,3,1,v=>v);
slider('materialInputs','share','Share of mixture',0,6,1,v=>v+' parts');
slider('materialInputs','size','Relative area',.65,1.65,.05,v=>v.toFixed(2)+'×');
slider('materialInputs','aspect','Preferred length / width',1,2,.05,v=>v.toFixed(2));
slider('materialInputs','resistance','Shape resistance',.5,2,.05,v=>v.toFixed(2)+'×');
function editingControls() {
  for(const [key,s] of Object.entries(slots)){
    const val=(s.perType?cfg.types[editing]:cfg)[key];
    s.input.value=val;s.value.textContent=s.format(val);
  }
  for(const [i,b] of typeButtons.entries()){
    b.setAttribute('aria-pressed',String(editing===i));
    b.classList.toggle('absent',!cfg.types[i].share);
  }
  $('materialName').textContent=names[editing];
  let n=0;
  if(cfg.types.some(t=>t.share))n=packing(cfg).filter(c=>c.type===editing).length;
  $('population').textContent=n+' of 30 cells';
  $('all').textContent=cfg.types.every(t=>t.share>0)?'Use first three':'Use all ten';
  sample($('sample'),cfg.types[editing],colours[editing]);
}
function cancel() {
  generation++;
  if(worker){worker.terminate();worker=null;}
}
function edit(){
  cancel();stop();editingControls();
  $('run').disabled=!cfg.types.some(t=>t.share);
  $('new').disabled=$('run').disabled;
  $('status').textContent=$('run').disabled?'Give at least one type a share.':'Settings changed. Run to see the result.';
}
names.forEach((name,i)=>{
  const b=document.createElement('button');b.style.setProperty('--tone',colours[i]);
  b.innerHTML='<i></i>'+name;b.setAttribute('aria-label','Edit '+name);
  b.onclick=()=>{editing=i;editingControls();shapeStat();};
  $('types').append(b);typeButtons.push(b);
});
$('all').onclick=()=>{const all=cfg.types.every(t=>t.share>0);cfg.types.forEach((t,i)=>{t.share=all && i>=3?0:1;});edit();};
document.querySelectorAll('[data-squeeze]').forEach(b=>b.onclick=()=>{cfg.squeeze=Number(b.dataset.squeeze);edit();solve();});
function stop(){clearInterval(timer);timer=null;$('play').textContent='Play';}
function contactDelta(result,k) {
  const first=new Set(result.frames[0].contacts),now=new Set(result.frames[k].contacts);
  return [Array.from(first).filter(v=>!now.has(v)).length,Array.from(now).filter(v=>!first.has(v)).length];
}
function summary(result) {
  const c=result.cfg;return 'Packing '+c.seed+' · '+c.fill+'% initially filled · '+
    ((1-c.fill/100)*c.squeeze).toFixed(1)+'% maximum narrowing · '+c.pace+' closing steps · '+c.cycles+' cycle'+(c.cycles===1?'':'s');
}
function changes(old,next){
  const list=[];
  for(const [i,name] of names.entries()){
    for(const [key,label] of Object.entries({share:'parts',size:'area',aspect:'length / width',resistance:'resistance'})){
      const a=old.types[i][key], b=next.types[i][key];
      if(a!==b)list.push(name+' '+label+' '+a+' → '+b);
    }
  }
  return list.join(' · ');
}
function matchingFrame(old,current,k){
  const f=current.frames[k], phase=f.phase, cycle=Math.min(old.cfg.cycles,f.cycle);
  const inPhase=(r,c)=>r.frames.map((v,i)=>v.phase===phase && v.cycle===c?i:-1).filter(i=>i>=0);
  const a=inPhase(current,f.cycle),b=inPhase(old,cycle);
  return b[Math.round(a.indexOf(k)/Math.max(1,a.length-1)*(b.length-1))]??0;
}
function shapeStat(){
  if(!run)return;
  const members=run.material.map((t,i)=>t.type===editing?i:-1).filter(i=>i>=0);
  const mean=f=>(members.reduce((sum,i)=>sum+f.aspect[i],0)/members.length).toFixed(2);
  $('shapeStat').textContent=members.length?names[editing]+' cells · average length / width '+mean(run.frames[0])+' at start, '+mean(run.frames[+$('frame').value])+' now.':'';
}
function show(){
  if(!run)return;
  const k=Number($('frame').value),f=run.frames[k],links=$('links').checked;
  draw($('field'),run,f,links);shapeStat();
  $('phase').textContent=f.phase+' · cycle '+f.cycle+' of '+run.cfg.cycles;
  $('time').textContent=k+' / '+(run.frames.length-1);
  $('fillNow').textContent=Math.round(run.cfg.fill*W/f.width)+'%';
  const [lost,gained]=contactDelta(run,k);$('lost').textContent=lost;$('gained').textContent=gained;
  $('legend').hidden=!links;
  const compare=Boolean(previous && $('compare').checked);$('comparison').hidden=!compare;
  if(compare){
    const i=matchingFrame(previous,run,k),d=contactDelta(previous,i),g=previous.frames[i];
    draw($('oldField'),previous,g,links);
    $('oldValue').textContent=g.phase+' · '+d[0]+' lost, '+d[1]+' new';
    $('oldSummary').textContent=[summary(previous),changes(previous.cfg,run.cfg)].filter(Boolean).join('. ');
  }
}
function play(){
  if(timer){stop();return;}
  if(!run)return;
  if(+$('frame').value===run.frames.length-1)$('frame').value=0;
  $('play').textContent='Pause';show();
  timer=setInterval(()=>{
    $('frame').value=Number($('frame').value)+1;show();
    if(+$('frame').value===run.frames.length-1)stop();
  },90);
}
function present(result,first) {
  const fragment=Math.max(...result.frames.map(f=>f.fragmentFraction));
  const areaError=Math.max(...result.frames.map(f=>f.maxError));
  if(areaError>.06 || fragment>.015) {
    throw Error('This setting '+(areaError>.06?'missed a cell’s target area':'split a cell into separate pieces')+'. Try a gentler squeeze or less contrast between cell types.');
  }
  if(run && JSON.stringify(run.cfg)!==JSON.stringify(result.cfg)){
    previous=run;$('compareLabel').hidden=false;
  }
  run=result;stop();
  $('play').disabled=$('rewind').disabled=$('frame').disabled=false;
  $('frame').max=result.frames.length-1;
  $('frame').value=first?result.frames.findIndex(f=>f.phase==='Hold')+6:0;
  $('runInfo').textContent=summary(result)+' · '+(result.backend==='native'?'ICeShOT reference run':'Browser OT solve');
  $('status').textContent='';
  show();
  if(!first && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)play();
}
async function reference(strength){
  if(!refs.has(strength)){
    refs.set(strength,fetch('reference-'+strength+'.json').then(r=>{if(!r.ok)throw Error('Reference run unavailable.');return r.json();})
      .catch(e=>{refs.delete(strength);throw e;}));
  }
  return refs.get(strength);
}
async function solve(first=false){
  if(!cfg.types.some(t=>t.share))return;
  cancel();stop();const token=generation,chosen=structuredClone(cfg);
  $('status').textContent='Solving…';
  try{
    const base=defaults(),nativePacking=chosen.seed===base.seed && chosen.fill===base.fill && JSON.stringify(chosen.types)===JSON.stringify(base.types);
    const nativePreset=nativePacking && chosen.cycles===1 && chosen.pace===base.pace && [0,22,83].includes(chosen.squeeze);
    if(nativePreset){
      const result=await reference(chosen.squeeze);
      if(token===generation)present(result,first);
    }else{
      let initial=null;
      if(nativePacking)initial=(await reference(83)).frames[0];
      if(token!==generation)return;
      worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
      worker.onmessage=({data})=>{
        if(token!==generation)return;
        if(data.progress){$('status').textContent='Solving step '+data.progress+'…';return;}
        worker.terminate();worker=null;
        try{
          if(data.error)throw Error(data.error);
          present(data.result,first);
        }catch(e){$('status').textContent=e.message;}
      };
      worker.onerror=e=>{if(token===generation){cancel();$('status').textContent='The solve stopped. '+e.message;}};
      worker.postMessage({cfg:chosen,initial});
    }
  }catch(e){if(token===generation)$('status').textContent=e.message;}
}
$('save').onclick=()=>{
  if(!run)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(run.cfg,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='press-'+run.cfg.seed+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
};
$('run').onclick=()=>solve();
$('new').onclick=()=>{cfg.seed=(cfg.seed*1664525+1013904223)>>>0;edit();solve();};
$('rewind').onclick=()=>{stop();$('frame').value=0;show();};
$('play').onclick=play;
$('frame').oninput=()=>{stop();show();};
$('links').onchange=$('compare').onchange=show;
editingControls();solve(true);
if(window.frameElement)new ResizeObserver(()=>{
  window.frameElement.style.height=document.querySelector('main').offsetHeight+4+'px';
}).observe(document.querySelector('main'));
