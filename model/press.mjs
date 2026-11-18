// Prepare the identical input for the native Python solver or for a headless browser solve.
import fs from 'node:fs';
import {defaults,packing,schedule,simulate} from '../public/press/model.mjs';
const cfg=process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2],'utf8')) : defaults();
const output=process.argv.includes('--live') ? simulate(cfg) : {cfg,material:packing(cfg),schedule:schedule(cfg)};
console.log(JSON.stringify(output));
