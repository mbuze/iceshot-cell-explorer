const model=import('./model.mjs'+new URL(import.meta.url).search);
self.onmessage=async ({data:{cfg,skipOpen}})=>{
  try {
    const {simulate}=await model;
    const progress=(tick,fill)=>self.postMessage({progress:{tick,fill}});
    const open=skipOpen?null:await simulate(cfg,0,undefined,progress);
    const mixed=cfg.fill===0?open:await simulate(cfg,cfg.fill,undefined,progress);
    self.postMessage({open,mixed,cfg});
  } catch (error) {
    self.postMessage({error:error.message});
  }
};
