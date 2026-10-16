import fs from 'node:fs';
import path from 'node:path';
const log=process.env.SM_DESKTOP_LOG;
if(log){fs.mkdirSync(path.dirname(log),{recursive:true});fs.writeFileSync(log,'Blueprint Studio desktop startup\n');for(const method of ['log','warn','error'])console[method]=(...values)=>fs.appendFileSync(log,values.map(v=>v instanceof Error?v.stack:typeof v==='string'?v:JSON.stringify(v)).join(' ')+'\n');}
try {await import('../server.mjs');}catch(error){console.error(error);process.exitCode=1;}
