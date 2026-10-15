import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const files=[...fs.readdirSync('.').filter(f=>f.endsWith('.mjs')),...['lib','public','examples','tests','scripts'].flatMap(walk)].filter(f=>/\.(mjs|js)$/.test(f));
for(const file of files){const r=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
console.log(`Syntax checked ${files.length} JavaScript files.`);
