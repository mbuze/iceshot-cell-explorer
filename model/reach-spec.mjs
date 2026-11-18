// Export the shared starting packing and actual shape costs for native ICeShOT.
import {initial,settle,configure,attempts as limits} from '../public/press/reach-model.mjs';
import {W} from '../public/press/model.mjs';
const cfg={...initial,...JSON.parse(process.argv[2]||'{}')};
const base=settle(cfg.seed),steps=[];
for(let j=1;j<=34;j++){
  const t=Math.min(1,j/24);
  const attempts=limits.map(([extension,stretch])=>{
    configure(base.cells,cfg,t,extension,stretch);
    return {applied:cfg.reach*extension*t,effectiveStretch:1+t*stretch*(cfg.stretch-1),costs:base.cells.map(c=>[c.xx,c.xy,c.yy,c.arms||[]])};
  });
  steps.push({width:W*(1-.35*cfg.press*t/100),attempts});
}
console.log(JSON.stringify({cfg,base,steps}));
