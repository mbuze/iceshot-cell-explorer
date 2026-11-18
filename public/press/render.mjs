import {armMetrics} from './arms.mjs';
import {W,H,allocate,colours} from './model.mjs';
const rasterLayers=new WeakMap();
const rgb = colours.map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)));
function resample({labels,width,height},nx,ny){
  const mask=new Uint8Array(nx*ny);
  const cols=Array.from({length:nx},(_,x)=>Math.floor((x+.5)*width/nx));
  for(let y=0;y<ny;y++){
    const start=Math.floor((y+.5)*height/ny)*width;
    for(let x=0;x<nx;x++)mask[y*nx+x]=labels[start+cols[x]];
  }
  return mask;
}
export function draw(canvas,run,frame,links,style=null) {
  const ctx=canvas.getContext('2d'), cw=canvas.width, ch=canvas.height;
  const scale=(cw-28)/W, width=frame.width;
  const left=(cw-width*scale)/2, top=(ch-H*scale)/2;
  const nx=Math.round(width*scale), ny=Math.round(H*scale);
  const cells=run.material.map((c,i)=>({...c,x:frame.sites[i][0],y:frame.sites[i][1]}));
  if(frame.probes)cells[0].probes=frame.probes;
  if(frame.armScale<1)for(const c of cells){
    const t=run.cfg.types[c.type];
    c.arms=armMetrics(t.shape||'fork',c.angle,c.k,(t.reach||0)*frame.armScale/100);
  }
  const mask=style?.raster?resample(style.raster,nx,ny):allocate(cells,frame.f,width,nx,ny);
  const im=ctx.createImageData(nx,ny), depth=new Float32Array(mask.length).fill(32);
  // Distance to the visible outline controls edge shading only.
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const z=y*nx+x, i=mask[z];
    if(!x || !y || x+1===nx || y+1===ny ||
       i!==mask[z-1] || i!==mask[z+1] || i!==mask[z-nx] || i!==mask[z+nx])depth[z]=0;
    else depth[z]=Math.min(depth[z],depth[z-1]+1,depth[z-nx]+1,depth[z-nx-1]+1.414);
  }
  for(let y=ny-1;y>=0;y--)for(let x=nx-1;x>=0;x--){
    const z=y*nx+x,i=mask[z];
    if(x+1<nx && y+1<ny)depth[z]=Math.min(depth[z],depth[z+1]+1,depth[z+nx]+1,depth[z+nx+1]+1.414);
    const b=4*z;
    if(i===255){
      im.data[b]=21;im.data[b+1]=42;im.data[b+2]=48;
    }else{
      const tone=style?style.palette[cells[i].type]:rgb[cells[i].type], d=depth[z]*720/cw;
      const a=.72+.24*Math.min(1,d/17)+.035*Math.sin(17*i);
      const rim=43*Math.max(0,1-d/2);
      for(let k=0;k<3;k++){
        if(style){
          const fresh=style.newIds.has(i);
          const edge=style.selected===i?[255,242,201]:fresh?[172,255,217]:tone;
          const light=.54+.40*(1-Math.exp(-d/13))+.055*Math.sin(i*2.4);
          const inside=(fresh?[82,174,144][k]:tone[k])*light;
          const rim=Math.exp(-d/(fresh || i===style.selected?2.7:1.4));
          im.data[b+k]=inside+rim*(edge[k]*.90+7-inside);
        }else im.data[b+k]=tone[k]*a+rim;
      }
    }
    im.data[b+3]=255;
  }
  ctx.fillStyle=style?.noWalls?'#152a30':'#263a40';ctx.fillRect(0,0,cw,ch);
  if(!style?.noWalls){
    ctx.save();ctx.strokeStyle='#3b4d51';ctx.lineWidth=1;
    ctx.beginPath();for(let x=-ch;x<cw;x+=12){ctx.moveTo(x,0);ctx.lineTo(x+ch,ch);}ctx.stroke();ctx.restore();
  }
  if(style?.softEdges){
    let layer=rasterLayers.get(canvas);
    if(!layer){layer=canvas.ownerDocument.createElement('canvas');rasterLayers.set(canvas,layer);}
    if(layer.width!==nx || layer.height!==ny){layer.width=nx;layer.height=ny;}
    layer.getContext('2d').putImageData(im,0,0);
    ctx.save();ctx.filter='blur(1.35px)';
    ctx.drawImage(layer,Math.round(left),Math.round(top));
    ctx.restore();
  }else ctx.putImageData(im,Math.round(left),Math.round(top));
  ctx.fillStyle='#b8c6b7';
  if(!style?.noWalls)for(const x of [left-4,left+nx]) ctx.fillRect(Math.round(x),Math.round(top),4,ny);
  if(!links)return {mask,nx,ny,left:Math.round(left),top:Math.round(top),scale};
  const start=new Set(run.frames[0].contacts),now=new Set(frame.contacts),n=cells.length;
  function segment(pair,lost){
    const a=frame.centres[Math.floor(pair/n)],b=frame.centres[pair%n];
    ctx.lineWidth=lost?2:1.7;ctx.strokeStyle=lost?'#ff9da8':'#fff2c8';
    ctx.setLineDash(lost?[4,4]:[]);ctx.beginPath();
    ctx.moveTo(14+a[0]*scale,top+a[1]*scale);ctx.lineTo(14+b[0]*scale,top+b[1]*scale);ctx.stroke();
  }
  ctx.save();
  for(const p of now)if(!start.has(p))segment(p,false);
  for(const p of start)if(!now.has(p))segment(p,true);
  ctx.restore();
}

// Equilibrium of one elliptical quadratic-cost cell pressed against a vertical wall.
// Its portion left of the wall has the target area. The centroid offset balances the load.
export function sample(svg,t,colour) {
  const wall=113, scale=38, area=1.1*t.size, F=.24, freeX=Math.sqrt(area*t.aspect/Math.PI);
  let lo=-.99,hi=1;
  function geometry(cut) {
    const root=Math.sqrt(1-cut*cut);
    const share=(Math.asin(cut)+Math.PI/2+cut*root)/Math.PI;
    const rx=freeX/Math.sqrt(share);
    return {rx,ry:rx/t.aspect,force:t.resistance/t.aspect*rx*2*root**3/(3*Math.PI*share)};
  }
  for(let i=0;i<48;i++){
    const mid=(lo+hi)/2;
    if(geometry(mid).force>F)lo=mid;else hi=mid;
  }
  const cut=(lo+hi)/2,{rx,ry}=geometry(cut),theta=Math.acos(cut), points=[];
  for(let j=0;j<=96;j++){
    const a=theta+(2*Math.PI-2*theta)*j/96;
    points.push((wall+scale*rx*(Math.cos(a)-cut)).toFixed(2)+','+(40+scale*ry*Math.sin(a)).toFixed(2));
  }
  svg.innerHTML='<path fill="'+colour+'" stroke="#385a56" d="M'+points.join(' ')+'Z"/>'+
    '<ellipse cx="'+(wall-scale*freeX)+'" cy="40" rx="'+scale*freeX+'" ry="'+scale*freeX/t.aspect+'" fill="none" stroke="#264945" stroke-dasharray="3 3"/>'+
    '<path d="M114 3V77" stroke="#516a61" stroke-width="3"/>';
}
