import {simulate} from './model.mjs';
self.onmessage=async ({data:{cfg,skipOpen}})=>{
  try {
    const progress=(tick,fill)=>self.postMessage({progress:{tick,fill}});
    const open=skipOpen?null:await simulate(cfg,0,undefined,progress);
    const mixed=await simulate(cfg,cfg.fill,undefined,progress);
    self.postMessage({open,mixed,cfg});
  } catch (error) {
    self.postMessage({error:error.message});
  }
};
