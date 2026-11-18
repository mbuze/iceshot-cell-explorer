import {metric,armMetrics,moveSites} from './arms.mjs';
import {W,H,NX,NY,defaults,packing,balance,measure} from './model.mjs';

export const initial={seed:17,reach:80,press:36,stretch:1.35,shape:'fork'};
const GOLD=1;
export function makePatch(seed){
  const cfg=defaults();cfg.seed=seed;cfg.fill=63;
  cfg.types.forEach((t,i)=>{
    t.share=i===0?5:i===1?1:i===2?2:0;
    t.size=i===1?2.45:i===2?.68:1;
    t.aspect=1;t.resistance=i===1?1.45:1;
  });
  const cells=packing(cfg);
  // Three marked interior sites keep the branching cells in view as the walls close.
  const marked=[7,10,21];
  const host=cells.find(c=>c.type===0),violet=cells.find(c=>c.type===2),gold=cells.find(c=>c.type===1);
  const specimens=[host,violet,gold].map(c=>({...c}));
  let area=0;
  for(const [i,c] of cells.entries()){
    const material=specimens[marked.includes(i)?2:(c.type===2?1:0)];
    Object.assign(c,{type:material.type,k:material.k,area:material.area,xx:material.k,xy:0,yy:material.k});
    area+=c.area;
  }
  for(const c of cells)c.area*=W*H*cfg.fill/(100*area);
  return cells;
}
export const attempts=[
  ...[1,.92,.82,.70,.55,.35,0].map(extension=>[extension,1]),
  ...[.82,.55,0].flatMap(stretch=>[1,.7,.35,0].map(extension=>[extension,stretch]))
];
export function configure(cells,cfg,t,extension=1,stretch=1){
  for(const c of cells){
    if(c.type===GOLD){
      const s=t*cfg.reach*extension/100;
      c.arms=armMetrics(cfg.shape,c.angle,c.k,s);
    }else{
      const aspect=1+t*stretch*(cfg.stretch-1);
      Object.assign(c,metric(.18+.22*Math.sin(c.angle*2),c.k/aspect,c.k*aspect));
    }
  }
}
function relax(cells,m,labels,width){
  moveSites(cells,m,labels,width,c=>c.type===GOLD?.16:.55);
}
export function settle(seed){
  const cells=makePatch(seed),weights=cells.map(c=>c.k*c.area/Math.PI);
  for(let j=0;j<80;j++){
    const lab=balance(cells,weights,W),m=measure(cells,lab,W,false);
    relax(cells,m,lab,W);
  }
  return {cells,weights};
}
export function solveShape(base,cfg){
  const cells=base.cells.map(c=>({...c})), f=base.weights.slice();
  let frame;
  for(let j=1;j<=34;j++){
    const t=Math.min(1,j/24),width=W*(1-.35*cfg.press*t/100);
    let lab,m,applied,effectiveStretch;
    const weights=f.slice();
    for(const [extension,stretch] of attempts){
      configure(cells,cfg,t,extension,stretch);
      effectiveStretch=1+t*stretch*(cfg.stretch-1);
      for(let i=0;i<f.length;i++)f[i]=weights[i];
      lab=balance(cells,f,width);
      m=measure(cells,lab,width,true,5);
      applied=cfg.reach*extension*t;
      if(m.fragmentFraction<=.008 && m.maxError<=.04)break;
    }
    if(m.fragmentFraction>.008 || m.maxError>.04)
      throw Error('This wall position splits a cell on the solver grid. Open the walls slightly.');
    if(j===34){
      const spans=cells.map(()=>[NX,NY,-1,-1]);
      lab.forEach((id,z)=>{
        if(id===255)return;
        const box=spans[id],x=z%NX,y=Math.floor(z/NX);
        box[0]=Math.min(box[0],x);box[1]=Math.min(box[1],y);
        box[2]=Math.max(box[2],x);box[3]=Math.max(box[3],y);
      });
      frame={...m,width,applied,effectiveStretch,spans:spans.map(([l,b,r,h])=>Math.max((r-l+1)*width/NX,(h-b+1)*H/NY)),
        sites:cells.map(c=>[c.x,c.y]),f};
    }
    else relax(cells,m,lab,width);
  }
  return {material:cells,frame};
}
