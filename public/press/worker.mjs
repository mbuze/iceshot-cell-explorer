import {simulate} from './model.mjs';
self.onmessage=({data})=>{
  try {
    const result=simulate(data.cfg,n=>self.postMessage({progress:n}),data.initial);
    self.postMessage({result});
  } catch(error){self.postMessage({error:error.message});}
};
