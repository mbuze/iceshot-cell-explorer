// Browser backend for the fixed-area, quadratic ICeShOT problem with a zero-cost void.
import {W,H,NX,NY,N} from './grid.mjs';
export {W,H,NX,NY,N} from './grid.mjs';
import {armMetrics,moveSites,reachLimits} from './arms.mjs';
export const names = ['Jade','Apricot','Iris','Lagoon','Rose','Lime','Ochre','Lilac','Glacier','Coral'];
export const colours = ['#57b7a1','#f1aa62','#9e91d5','#46a2c0','#de87ab','#abc974','#d8bd68','#bea1c2','#85cfda','#e28272'];
export function defaults() {
  const resistance = [.65,1.9,1.1,.8,1.3,2,.6,1.45,.9,1.7];
  return {seed:17,fill:72,squeeze:83,pace:24,cycles:1,types:names.map((_,i)=>({
    share:i<3?1:0, size:[1,1.4,.8][i%3], aspect:[1,1.2,1.65][i%3], resistance:resistance[i]
  }))};
}
function random(seed) {
  let x=seed>>>0;
  return ()=>{x=(Math.imul(1664525,x)+1013904223)>>>0; return x/4294967296;};
}
export function packing(cfg) {
  const rng=random(cfg.seed), sum=cfg.types.reduce((s,t)=>s+t.share,0);
  if (!sum) throw Error('Give at least one type a positive share.');
  const quotas=cfg.types.map(t=>N*t.share/sum), counts=quotas.map(Math.floor);
  const order=counts.map((_,i)=>i).sort((i,j)=>(quotas[j]-counts[j])-(quotas[i]-counts[i]));
  const left=N-counts.reduce((a,b)=>a+b,0);
  for(let i=0;i<left;i++) counts[order[i]]++;
  const slots=Array.from({length:N},(_,i)=>i);
  for(let i=N-1;i>0;i--){const j=Math.floor(rng()*(i+1)); [slots[i],slots[j]]=[slots[j],slots[i]];}
  const ids=new Uint8Array(N);
  let rank=0;
  counts.forEach((count,t)=>{for(let j=0;j<count;j++) ids[slots[rank++]]=t;});
  const total=counts.reduce((s,n,i)=>s+n*cfg.types[i].size,0);
  return Array.from(ids,(type,i)=>{
    const t=cfg.types[type], a=rng()*Math.PI, c=Math.cos(a),s=Math.sin(a);
    const p=t.resistance/t.aspect, q=t.resistance*t.aspect;
    const arms=t.reach?armMetrics(t.shape||'fork',a,t.resistance,t.reach/100):[];
    return {type, angle:a, arms, area:W*H*cfg.fill/100*t.size/total, k:t.resistance,
      x:W*((i%6)+.5+.56*(rng()-.5))/6,
      y:H*(Math.floor(i/6)+.5+.60*(rng()-.5))/5,
      xx:p*c*c+q*s*s, xy:(p-q)*c*s, yy:p*s*s+q*c*c};
  });
}
export function schedule(cfg) {
  const frames=[];
  const tight=W*(1-cfg.squeeze/100*(1-cfg.fill/100));
  frames.push({width:W,phase:'Start',cycle:1});
  for(let cycle=1;cycle<=cfg.cycles;cycle++){
    for(const [phase,n,from,to] of [['Closing',cfg.pace,W,tight],['Hold',12,tight,tight],
        ['Opening',cfg.pace,tight,W],['Released',16,W,W]]){
      for(let j=1;j<=n;j++)frames.push({width:from+(to-from)*j/n,phase,cycle});
    }
  }
  return frames;
}
// Each ellipse is bounded exactly by its zero-void contour. Outside it, void wins.
export function allocate(cells,f,width,nx=NX,ny=NY) {
  const dx=width/nx, dy=H/ny, x0=(W-width)/2;
  const best=new Float32Array(nx*ny), labels=new Uint8Array(nx*ny).fill(255);
  for(let i=0;i<cells.length;i++){
    const g=cells[i];
    if(f[i]<=0)continue;
    paint(g,i,false);
    if(g.arms)for(const arm of g.arms)paint(arm,i,true);
    if(g.probes)for(const probe of g.probes){
      paintSegment(i,g.x,g.y,probe[0],probe[1]);
      paintSegment(i,probe[0],probe[1],probe[2],probe[3]);
    }
  }
  function paint(metric,i,half){
    const g=cells[i], det=metric.xx*metric.yy-metric.xy*metric.xy;
    const bent=half && metric.bend;
    const pad=bent?Math.abs(metric.bend)*f[i]/metric.axial:0;
    const rx=Math.sqrt(f[i]*metric.yy/det)+(bent?Math.abs(metric.ey)*pad:0);
    const ry=Math.sqrt(f[i]*metric.xx/det)+(bent?Math.abs(metric.ex)*pad:0);
    const loX=Math.max(0,Math.ceil((g.x-rx-x0)/dx-.5)),hiX=Math.min(nx-1,Math.floor((g.x+rx-x0)/dx-.5));
    const loY=Math.max(0,Math.ceil((g.y-ry)/dy-.5)),hiY=Math.min(ny-1,Math.floor((g.y+ry)/dy-.5));
    for(let y=loY;y<=hiY;y++){
      const v=(y+.5)*dy-g.y, by=metric.yy*v*v-f[i],cross=2*metric.xy*v;
      for(let x=loX;x<=hiX;x++){
        const u=x0+(x+.5)*dx-g.x;
        if(half && u*metric.ex+v*metric.ey<0)continue;
        let cost=u*(metric.xx*u+cross)+by;
        if(bent){
          const along=u*metric.ex+v*metric.ey;
          const side=v*metric.ex-u*metric.ey-metric.bend*along*along;
          cost=metric.axial*along*along+metric.lateral*side*side-f[i];
        }
        const z=y*nx+x;
        if(cost<best[z]){best[z]=cost;labels[z]=i;}
      }
    }
  }
  function paintSegment(i,ax,ay,bx,by){
    const resistance=cells[i].k, weight=f[i]-.16*resistance;
    if(weight<=0)return;
    const r=Math.sqrt(weight/(6.5*resistance)),vx=bx-ax,vy=by-ay;
    const denom=vx*vx+vy*vy;
    if(denom<=1e-10)return;
    const xMin=Math.max(0,Math.ceil((Math.min(ax,bx)-r-x0)/dx-.5));
    const xMax=Math.min(nx-1,Math.floor((Math.max(ax,bx)+r-x0)/dx-.5));
    const yMin=Math.max(0,Math.ceil((Math.min(ay,by)-r)/dy-.5));
    const yMax=Math.min(ny-1,Math.floor((Math.max(ay,by)+r)/dy-.5));
    for(let y=yMin;y<=yMax;y++){
      const v=(y+.5)*dy-ay;
      for(let x=xMin;x<=xMax;x++){
        const u=x0+(x+.5)*dx-ax;
        const t=Math.max(0,Math.min(1,(u*vx+v*vy)/denom));
        const cost=6.5*resistance*((u-t*vx)**2+(v-t*vy)**2)-weight;
        const z=y*nx+x;
        if(cost<best[z]){best[z]=cost;labels[z]=i;}
      }
    }
  }
  return labels;
}
function countsOf(labels,n) {
  const counts=new Uint32Array(n);
  for(const id of labels)if(id!==255)counts[id]++;
  return counts;
}
export function balance(cells,f,width,{nx=NX,ny=NY,iterations=140,tolerance=.012,meanTolerance=.005}={}) {
  const pixel=width*H/(nx*ny), momentum=new Float64Array(cells.length);
  let bestError=Infinity, bestF, bestLabels;
  for(let step=0;step<iterations;step++){
    const labels=allocate(cells,f,width,nx,ny),counts=countsOf(labels,cells.length);
    let maxError=0, sum=0;
    const gaps=cells.map((c,i)=>{
      const gap=c.area-counts[i]*pixel, err=Math.abs(gap)/c.area;
      maxError=Math.max(maxError,err);sum+=err;
      return gap;
    });
    if(sum<bestError){bestError=sum;bestF=f.slice();bestLabels=labels;}
    if(maxError<tolerance && sum/cells.length<meanTolerance)return labels;
    for(let i=0;i<cells.length;i++){
      momentum[i]=.53*momentum[i]+.78*gaps[i]*cells[i].k/Math.PI;
      f[i]=Math.max(.001,f[i]+momentum[i]);
    }
    if(step>20 && maxError<.021 && sum/cells.length<.007)break;
  }
  bestF.forEach((v,i)=>{f[i]=v;});
  return bestLabels;
}
function detachedFractions(labels,sums,nx,diagonal) {
  const seen=new Uint8Array(labels.length),stack=new Int32Array(labels.length);
  const largest=new Uint32Array(sums.length);
  for(let z=0;z<labels.length;z++){
    const id=labels[z];
    if(id===255 || seen[z])continue;
    let count=0,top=1; stack[0]=z;seen[z]=1;
    while(top){
      const v=stack[--top];count++;
      const x=v%nx;
      visit(v-nx);visit(v+nx);
      if(x>0){
        visit(v-1);
        if(diagonal){visit(v-nx-1);visit(v+nx-1);}
      }
      if(x<nx-1){
        visit(v+1);
        if(diagonal){visit(v-nx+1);visit(v+nx+1);}
      }
    }
    largest[id]=Math.max(largest[id],count);
    function visit(w){
      if(labels[w]===id && !seen[w]){stack[top++]=w;seen[w]=1;}
    }
  }
  return sums.map((s,i)=>1-largest[i]/s[0]);
}
export function measure(cells,labels,width,inspect=true,minEdges=4,{nx=NX,ny=NY,diagonal=false}={}) {
  const n=cells.length, sums=Array.from({length:n},()=>[0,0,0,0,0,0]);
  const edges=new Uint16Array(n*n), dx=width/nx, dy=H/ny, left=(W-width)/2;
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const z=y*nx+x,i=labels[z]; if(i===255)continue;
    const s=sums[i],u=left+(x+.5)*dx,v=(y+.5)*dy;
    s[0]++;s[1]+=u;s[2]+=v;s[3]+=u*u;s[4]+=v*v;s[5]+=u*v;
    for(const j of [x+1<nx?labels[z+1]:255,y+1<ny?labels[z+nx]:255])
      if(j!==255 && j!==i) edges[Math.min(i,j)*n+Math.max(i,j)]++;
  }
  const contacts=[];
  edges.forEach((v,i)=>{if(v>=minEdges)contacts.push(i);});
  const centres=[],aspect=[],sizeError=[];
  sums.forEach(([count,x,y,xx,yy,xy],i)=>{
    if(!count)throw Error('A cell lost its area.');
    x/=count;y/=count;xx=xx/count-x*x;yy=yy/count-y*y;xy=xy/count-x*y;
    const d=Math.hypot(xx-yy,2*xy);
    centres.push([x,y]);aspect.push(Math.sqrt((xx+yy+d)/Math.max(1e-8,xx+yy-d)));
    sizeError.push(Math.abs(count*dx*dy/cells[i].area-1));
  });
  const fragments=inspect?detachedFractions(labels,sums,nx,diagonal):[];
  return {centres,aspect,contacts,maxError:Math.max(...sizeError),
    fragmentFraction:fragments.length?Math.max(...fragments):0,fragments};
}
function relax(cells,centres) {
  cells.forEach((c,i)=>{
    const dx=centres[i][0]-c.x,dy=centres[i][1]-c.y;
    c.x+=.17*(c.xx*dx+c.xy*dy);
    c.y+=.17*(c.xy*dx+c.yy*dy);
  });
}
export function simulate(cfg,progress=()=>{},initial=null) {
  const cells=packing(cfg), material=cells.map(c=>({...c})), f=cells.map(c=>c.area*c.k/Math.PI);
  const frames=[];
  const branched=cells.some(c=>c.arms?.length);
  function solveAt(width,inspect){
    const weights=f.slice();
    for(const factor of branched?reachLimits:[1]){
      if(branched)for(const [i,c] of cells.entries()){
        const type=cfg.types[c.type];
        c.arms=armMetrics(type.shape||'fork',c.angle,c.k,(type.reach||0)*factor/100);
        f[i]=weights[i];
      }
      const lab=balance(cells,f,width),m=measure(cells,lab,width,inspect||branched);
      if(!branched || (m.fragmentFraction<=.015 && m.maxError<=.06) || factor===0)
        return {lab,m,armScale:factor};
    }
  }
  function advance(lab,m,width){
    if(branched)moveSites(cells,m,lab,width,()=>.17);
    else relax(cells,m.centres);
  }
  if(initial){
    cells.forEach((c,i)=>{[c.x,c.y]=initial.sites[i];f[i]=initial.f[i];});
  }
  for(let step=0;!initial && step<120;step++){
    const {lab,m}=solveAt(W,false);advance(lab,m,W);
  }
  for(const entry of schedule(cfg)){
    const {lab,m,armScale}=solveAt(entry.width,true);
    frames.push({...entry,...m,armScale,sites:cells.map(c=>[c.x,c.y]),f:f.slice()});
    advance(lab,m,entry.width);
    if(frames.length%8===0)progress(frames.length);
  }
  return {cfg,material,frames};
}
