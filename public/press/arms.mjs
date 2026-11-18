import {W,H,NX,NY} from './grid.mjs';
export const reachLimits=[1,.92,.82,.70,.55,.35,.18,0];
const fans={
  fork:[[.37,1,-.18],[-.52,.92,-.06],[2.92,.75,.24]],
  split:[[.15,1.28,-.49],[.15,1.12,.55],[2.95,1.06,.53],[2.95,.88,-.37]],
  spindle:[[0,1],[Math.PI,1]],
  fan:[[-1.22,.74,-.15],[-.67,1,-.12],[.03,1.10,-.07],[.65,.92,.03],[1.22,.67,.07]]
};
export function metric(angle,axial,lateral){
  const ex=Math.cos(angle),ey=Math.sin(angle);
  return {ex,ey,axial,lateral,xx:axial*ex*ex+lateral*ey*ey,xy:(axial-lateral)*ex*ey,yy:axial*ey*ey+lateral*ex*ex};
}
export function armMetrics(shape, angle, k, s){
  return s===0?[]:fans[shape].map(([offset,length,curve=0])=>{
        const r=1+2.85*s*length, width=1/(1+1.25*s);
        return {...metric(angle+offset,k/(r*r),k/(width*width)),bend:curve*s};
      });
}
export function moveSites(cells,m,labels,width,mobilityFor){
  // Gradient of the winning cost branch at each allocated pixel. A branched cell
  // generally cannot be advanced using its centroid and a single matrix.
  const grad=cells.map(()=>[0,0,0]);
  for(let z=0;z<labels.length;z++){
    const id=labels[z];if(id===255)continue;
    const c=cells[id],u=(W-width)/2+(z%NX+.5)*width/NX-c.x,v=(Math.floor(z/NX)+.5)*H/NY-c.y;
    if(!c.arms?.length)continue;
    let gx=c.xx*u+c.xy*v,gy=c.xy*u+c.yy*v,low=gx*u+gy*v;
    for(const a of c.arms){
      const z=u*a.ex+v*a.ey;
      if(z<0)continue;
      const side=v*a.ex-u*a.ey-a.bend*z*z;
      const cost=a.axial*z*z+a.lateral*side*side;
      if(cost<low){
        low=cost;
        const gs=a.lateral*side,ga=a.axial*z-2*a.bend*z*gs;
        gx=ga*a.ex-gs*a.ey;gy=ga*a.ey+gs*a.ex;
      }
    }
    grad[id][0]+=gx;grad[id][1]+=gy;grad[id][2]++;
  }
  cells.forEach((c,i)=>{
    const dx=m.centres[i][0]-c.x,dy=m.centres[i][1]-c.y,[gx,gy,n]=grad[i];
    const mobility=mobilityFor(c);
    c.x+=mobility*(n?gx/n:c.xx*dx+c.xy*dy);
    c.y+=mobility*(n?gy/n:c.xy*dx+c.yy*dy);
  });
}
