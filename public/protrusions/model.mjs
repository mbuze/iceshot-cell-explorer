import {armMetrics,metric} from '../press/arms.mjs';
const release=new URL(import.meta.url).search;
const [{W,H,balance,measure},{encode}]=await Promise.all([
  import('../press/model.mjs'+release),
  import('./raster.mjs'+release)
]);

export const ticks=64;
export const grid={nx:96,ny:64,diagonal:true};
export const hostNames=['Pebble','Ribbon','Fork','Oval','Fan','Spindle','Small round','Split tips','Wide oval','Long ribbon'];
export const palette=[[255,183,79],[73,151,155],[108,144,198],[163,123,195],[105,175,146],[218,141,154],
  [106,170,198],[179,149,119],[145,158,206],[133,179,129],[95,141,173]];
export const types=[
  ['round',1,.95,.90], ['spindle',2.35,1.10,1.04], ['fork',1.16,.86,1.12],
  ['round',1.55,1.04,1.26], ['fan',1,1.07,.82], ['spindle',1.6,1.18,1.0],
  ['round',1,.61,1.17], ['split',1.08,.98,.82], ['round',1.87,1.25,.95], ['spindle',2.7,.84,1.1]
];
const origin=[2.42,3.21], radius=.32, coreResistance=1.45;
const bound=(v,low,high)=>Math.min(high,Math.max(low,v));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export const defaultSettings={seed:38,life:11,interval:3,reach:1.64,fill:66,pull:.32,tether:.095,enabled:[0,1,2,3,5],overrides:{}};

function random(seed){
  let x=seed>>>0;
  return ()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296;};
}
export function proposals(cfg){
  const rng=random(cfg.seed^0x91a5),out=[];
  let tick=2,bearing=-.52;
  while(tick<ticks-3){
    // A sequence of turns with overlapping short and long probes. Only the
    // direction, lifetime and reach are shared between the two conditions.
    bearing+=1.6*(rng()-.5);
    const angle=bearing+(rng()-.5)*4.25;
    const life=Math.max(4,Math.round(cfg.life*(.64+.67*rng())));
    const length=cfg.reach*(.69+.50*rng());
    const bend=(rng()-.5)*.56;
    out.push({id:out.length,start:tick,life,angle,length,bend});
    tick+=Math.max(2,Math.round(cfg.interval*(.68+.64*rng())));
  }
  return out;
}
function makeTissue(cfg,fill){
  const rng=random((cfg.layoutSeed??defaultSettings.seed)^0x879e);
  const cells=[{x:origin[0],y:origin[1],type:0,area:1.06,k:coreResistance,xx:coreResistance,xy:0,yy:coreResistance}];
  const enabled=cfg.enabled.length?cfg.enabled:[0];
  const rows=6,cols=9,slots=[];
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const x=(i+.5+.52*(rng()-.5))*W/cols,y=(j+.5+.55*(rng()-.5))*H/rows;
    const d=distance([x,y],origin);
    if(d>.8)slots.push({x,y,rank:rng()+.06*d,id:slots.length});
  }
  slots.sort((a,b)=>a.rank-b.rank);
  // Increasing fill adds host identities from this order; individual
  // areas and shapes of hosts already present are preserved.
  let area=cells[0].area;
  const n=slots.length;
  for(let i=0;i<n && area<W*H*fill/100;i++){
    const {x,y,id}=slots[i],type=enabled[id%enabled.length],t=types[type];
    const override=cfg.overrides?.[type];
    const shape=override?.shape??t[0],aspect=t[1],size=t[2],k=override?.resistance??t[3];
    const angle=(rng()-.5)*(shape==='spindle'?1.42:Math.PI);
    const hostArea=size*(1+(.30*(rng()-.5)));
    if(area+hostArea>W*H*fill/100+.35)break;
    const m=metric(angle,k/aspect,k*aspect);
    cells.push({x,y,type:type+1,area:hostArea,k,...m,angle,shape,
      arms:shape==='round'?[]:armMetrics(shape,angle,k,.36)});
    area+=hostArea;
  }
  return {cells,occupancy:100*area/(W*H)};
}
function formProbes(started,cells,tick,scale){
  const {x,y}=cells[0];
  const out=[];
  for(const event of started){
    const age=tick-event.start;
    if(age<0 || age>=event.life)continue;
    const phase=age/event.life;
    const reach=scale*Math.max(0,Math.min(1,phase/.36,(1-phase)/.27));
    const dx=event.aim[0]-x,dy=event.aim[1]-y;
    const aim=[x+reach*dx,y+reach*dy];
    const bend=[x+reach*(.48*dx-event.bend*dy),y+reach*(.48*dy+event.bend*dx)];
    out.push({event,aim,bend,phase});
  }
  return out;
}
function browserSolve(cells,weights){
  return balance(cells,weights,W,{...grid,iterations:28,tolerance:.036,meanTolerance:.013});
}
async function allocateStep(cells,started,tick,weights,solve){
  const full=formProbes(started,cells,tick,1);
  const scales=full.some(p=>distance(p.aim,[cells[0].x,cells[0].y])>.12)?[1,.65,0]:[1];
  for(const scale of scales){
    const prepared=scale===1?full:formProbes(started,cells,tick,scale);
    const probes=prepared.map(p=>[...p.bend,...p.aim]);
    const trial=[{...cells[0],probes},...cells.slice(1)], f=weights.slice();
    const labels=await solve(trial,f);
    if(!trial.every((_,i)=>labels.includes(i)))continue;
    const m=measure(trial,labels,W,true,4,grid);
    if(m.fragments[0]>0 || m.maxError>.11)continue;
    if(m.fragmentFraction>.055 && scale!==0 && scales.length>1)continue;
    return {labels,prepared,measurements:m,weights:f,scale};
  }
  throw Error('The solver could not allocate this frame. Try less crowding or a shorter reach.');
}
function advanceHosts(cells,centres,tether){
  for(let i=1;i<cells.length;i++){
    const c=cells[i],[x,y]=centres[i];
    c.x+=.23*(x-c.x)+tether*(c.rest[0]-c.x);
    c.y+=.23*(y-c.y)+tether*(c.rest[1]-c.y);
  }
}
function segmentDistance(x,y,ax,ay,bx,by){
  const u=x-ax,v=y-ay,dx=bx-ax,dy=by-ay;
  const lengthSquared=dx*dx+dy*dy;
  const t=lengthSquared>0?bound((u*dx+v*dy)/lengthSquared,0,1):0;
  return (u-t*dx)**2+(v-t*dy)**2;
}
function findTips(labels,prepared,core){
  if(!prepared.length)return [];
  const tips=prepared.map(()=>({point:null,sq:Infinity}));
  for(let z=0;z<labels.length;z++){
    if(labels[z]!==0)continue;
    const x=(z%grid.nx+.5)*W/grid.nx,y=(Math.floor(z/grid.nx)+.5)*H/grid.ny;
    let low=coreResistance*((x-core[0])**2+(y-core[1])**2),winner=-1;
    for(const [i,{aim,bend}] of prepared.entries()){
      const d=Math.min(segmentDistance(x,y,...core,...bend),segmentDistance(x,y,...bend,...aim));
      const cost=coreResistance*(.16+6.5*d);
      if(cost<low){low=cost;winner=i;}
    }
    if(winner===-1)continue;
    const [tx,ty]=prepared[winner].aim,dist=(x-tx)**2+(y-ty)**2;
    if(dist<tips[winner].sq)tips[winner]={point:[x,y],sq:dist};
  }
  return prepared.map((proposal,i)=>{
    const tip=tips[i].point;
    return {...proposal,tip,extends:tip && distance(tip,core)>.55};
  });
}
function reachEvent(event,tick,core){
  if(event.caught===null && event.far && tick>event.peakTick && tick<event.start+event.life &&
    distance(core,event.far)<radius && distance(core,event.origin)>.35){
    event.caught=tick;event.reachedTarget=event.far;
  }
}
function advanceCore(cell,tips,measuredCentre,cfg){
  let u=0,v=0,n=0;
  for(const {phase,extends:visible,tip} of tips){
    if(phase<.22 || !visible)continue;
    u+=tip[0]-cell.x;v+=tip[1]-cell.y;n++;
  }
  const dx=cfg.pull*u/Math.max(1,n)+.045*(measuredCentre[0]-cell.x);
  const dy=cfg.pull*v/Math.max(1,n)+.045*(measuredCentre[1]-cell.y);
  cell.x=bound(cell.x+dx,.42,W-.42);cell.y=bound(cell.y+dy,.42,H-.42);
}
export async function simulate(cfg,fill,solve=browserSolve,progress=()=>{}){
  const {cells,occupancy}=makeTissue(cfg,fill), material=cells.map(c=>({...c}));
  for(const c of cells)c.rest=[c.x,c.y];
  let weights=cells.map(c=>c.area*c.k/Math.PI);
  for(let tick=0;tick<8;tick++){
    const settled=await allocateStep(cells,[],tick,weights,solve);
    advanceHosts(cells,settled.measurements.centres,cfg.tether);
    weights=settled.weights;
    if(tick===3)await progress(0,fill);
  }
  const plan=proposals(cfg),started=[],frames=[];
  let path=0,last=origin;
  for(let tick=0;tick<=ticks;tick++){
    const core=[cells[0].x,cells[0].y];
    for(const p of plan.filter(p=>p.start===tick)){
      const aim=[bound(core[0]+p.length*Math.cos(p.angle),.18,W-.18),
        bound(core[1]+p.length*Math.sin(p.angle),.18,H-.18)];
      started.push({...p,aim,origin:core,caught:null,far:null,peak:0,peakTick:tick});
    }
    const solved=await allocateStep(cells,started,tick,weights,solve);
    weights=solved.weights;
    const tips=findTips(solved.labels,solved.prepared,core);
    for(const p of started)reachEvent(p,tick,core);
    for(const {event,tip,extends:visible} of tips){
      const extended=visible?distance(tip,event.origin):0;
      if(extended>event.peak){
        event.peak=extended;event.far=tip;event.peakTick=tick;
      }
    }
    path+=distance(last,core);last=core;
    frames.push({width:W,sites:cells.map(c=>[c.x,c.y]),f:weights.slice(),path,
      probes:solved.prepared.map(p=>[...p.bend,...p.aim]),
      tips:tips.filter(p=>p.extends).map(p=>[p.event.id,...p.tip]),
      scale:solved.scale,
      raster:encode(solved.labels),areaError:solved.measurements.maxError,detached:solved.measurements.fragmentFraction});
    advanceHosts(cells,solved.measurements.centres,cfg.tether);
    advanceCore(cells[0],tips,solved.measurements.centres[0],cfg);
    if(tick%4===0)await progress(tick,fill);
  }
  return {frames,material,events:started,occupancy,grid};
}
