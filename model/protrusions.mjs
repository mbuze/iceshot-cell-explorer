// Use the native ICeShOT allocation with the same event loop as the browser.
import {spawn} from 'node:child_process';
import {writeFile,readFile} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {defaultSettings,grid,simulate} from '../public/protrusions/model.mjs';

const [condition,out,config]=process.argv.slice(2);
if(!['open','mixed'].includes(condition)||!out)throw Error('Usage: node model/protrusions.mjs open|mixed OUTPUT [SETTINGS]');
const cfg=config?JSON.parse(await readFile(config,'utf8')):defaultSettings;
const fill=condition==='open'?0:cfg.fill;
const child=spawn(process.env.ICESHOT_PYTHON||'python3',[fileURLToPath(new URL('./protrusion_solver.py',import.meta.url)),String(grid.nx),String(grid.ny)],
  {stdio:['pipe','pipe','inherit'],env:{...process.env,OPENBLAS_NUM_THREADS:'1',OMP_NUM_THREADS:'1'}});
const lines=createInterface({input:child.stdout})[Symbol.asyncIterator]();
async function solve(cells,f){
  child.stdin.write(JSON.stringify({cells,weights:f})+'\n');
  let record;
  // KeOps prints its CPU warning during import.
  do{
    record=await lines.next();
    if(record.done)throw Error('The ICeShOT solver stopped.');
  }while(!record.value.startsWith('{'));
  const result=JSON.parse(record.value);
  result.weights.forEach((weight,i)=>{f[i]=weight;});
  return Buffer.from(result.raster,'hex');
}
try{
  const r=await simulate(cfg,fill,solve,tick=>{if(tick%24===0)console.error(condition,tick);});
  await writeFile(out,JSON.stringify({...r,backend:'ICeShOT CPU',cfg}));
}finally{
  child.stdin.end();
}
