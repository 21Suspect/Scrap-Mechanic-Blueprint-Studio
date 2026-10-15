import fs from 'node:fs';
import path from 'node:path';
import {launchBrowser} from './browser.mjs';
import {catalog,draftPath} from './assets.mjs';
import {voxelBlueprint} from './voxelize.mjs';
import {validate} from './validate.mjs';
import {saveDraft} from './builder.mjs';
const allowed=new Set(['.glb','.gltf','.obj','.mtl','.stl','.ply','.fbx','.dae','.3mf','.3ds','.bin','.png','.jpg','.jpeg','.webp','.tga','.bmp']);
export function localModelBundle(file){
 const full=path.resolve(file);if(!fs.statSync(full).isFile())throw Error('Choose a model file.');const base=path.dirname(full),files=[];
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.isSymbolicLink())continue;const p=path.join(dir,e.name);if(e.isDirectory()){walk(p);continue;}if(!e.isFile()||!allowed.has(path.extname(p).toLowerCase()))continue;files.push({name:path.relative(base,p).replaceAll('\\','/'),data:fs.readFileSync(p).toString('base64')});}};
 walk(base);return {files,entry:path.basename(full)};
}
export async function importModel({file,files,entry,options={},blockId='628b2d61-5ceb-43e9-8334-a4135566df7a',name,port=Number(process.env.PORT||38799)}){
 if(catalog.get(blockId)?.kind!=='block')throw Error('Choose an installed native block UUID.');
 if(name&&fs.existsSync(draftPath(name)))throw Error('A draft with this name already exists. Choose another name to preserve it.');
 const bundle=file?localModelBundle(file):{files,entry};if(!Array.isArray(bundle.files)||!bundle.files.length)throw Error('Supply a local model file or files [{name,data:base64}].');
 if(bundle.files.some(f=>typeof f.name!=='string'||typeof f.data!=='string'))throw Error('Model bundle requires filenames and base64 data.');
 const browser=await launchBrowser();try{const page=await browser.newPage();
  // Model dependencies must come from the supplied bundle. No model-triggered internet requests.
  await page.route('**/*',route=>{const u=new URL(route.request().url());return u.origin==='http://127.0.0.1:'+port?route.continue():route.abort();});
  await page.goto('http://127.0.0.1:'+port+'/import-model.html');await page.waitForFunction(()=>window.convertModelBundle,{},{timeout:15000});
  const result=await page.evaluate(({bundle,options})=>window.convertModelBundle(bundle,options),{bundle,options:{...options,warnResources:false}});
  const blueprint=voxelBlueprint(result,blockId),report=validate(blueprint,catalog);if(!report.ok)throw Error('Converted blueprint failed validation: '+JSON.stringify(report.errors.slice(0,5)));
  const output={blueprint,stats:result.stats,warnings:result.warnings,source:result.source,report,engineVerified:false};
  if(name){if(fs.existsSync(draftPath(name)))throw Error('Draft name was created during conversion. Choose another name.');output.file=saveDraft(name,blueprint).file;fs.writeFileSync(draftPath(name).replace(/\.json$/,'.import-report.json'),JSON.stringify({...output,blueprint:undefined,options,blockId,sourceFile:file?path.resolve(file):null},null,2));}
  return output;
 }finally{await browser.close();}
}
