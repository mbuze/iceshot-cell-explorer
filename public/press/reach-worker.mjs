import {settle,solveShape} from './reach-model.mjs';
let base, key,control;
self.onmessage=({data})=>{
  try{
    base??=settle(data.seed);
    const match=data.press+'-'+data.stretch;
    if(key!==match){
      control=solveShape(base,{...data,reach:0});
      key=match;
    }
    const result=data.reach?solveShape(base,data):control;
    self.postMessage({result,control,cfg:data});
  }catch(error){self.postMessage({error:error.message,cfg:data});}
};
