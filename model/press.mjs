// Prepare the identical input for the native Python solver or for a headless browser solve.
import fs from 'node:fs';
import {reachLimits,armMetrics} from '../public/press/arms.mjs';
import {defaults,packing,schedule,simulate} from '../public/press/model.mjs';
const cfg=process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2],'utf8')) : defaults();
const output=process.argv.includes('--live') ? simulate(cfg) : {cfg,material:packing(cfg),schedule:schedule(cfg)};
if(output.schedule && output.material.some(c=>c.arms.length)){
  output.attempts=reachLimits.map(scale=>({scale,arms:output.material.map(c=>{
    const t=cfg.types[c.type];
    return armMetrics(t.shape||'fork',c.angle,c.k,(t.reach||0)*scale/100);
  })}));
}
console.log(JSON.stringify(output));
