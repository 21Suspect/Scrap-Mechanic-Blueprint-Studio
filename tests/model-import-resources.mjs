import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {localModelBundle} from '../lib/model-import.mjs';

const obj='mtllib model.mtl\nusemtl Paint\nv 0 0 0\nv 1 0 0\nv 0 1 0\nvt 0 0\nvt 1 0\nvt 0 1\nf 1/1 2/2 3/3\n';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:38799/?draft=Boeing%20747-8%20Grand%20Airliner&mode=edit');
 await page.waitForFunction(()=>window.studio?.ready,{},{timeout:120000});
 const original=await page.evaluate(()=>studio.blueprint());await page.click('#openModelImport');
 await page.evaluate(async obj=>{
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1;const c=canvas.getContext('2d');c.fillStyle='red';c.fillRect(0,0,1024,1);c.fillStyle='blue';c.fillRect(1024,0,1024,1);
  const image=await new Promise(resolve=>canvas.toBlob(resolve));
  window.resourceFiles=[new File([obj],'model.obj'),new File(['newmtl Paint\nKd 1 1 1\nmap_Kd texture.png\n'],'model.mtl'),new File([image],'texture.png'),new File([new Uint8Array(65*1024*1024)],'large.bin'),...Array.from({length:257},(_,i)=>new File([],`extra${i}.bin`))];
  await studio.modelImport.choose(resourceFiles,{warnResources:true});
 },obj);
 assert.equal(await page.locator('#modelGridWarning').isVisible(),true);
 assert.match(await page.locator('#modelGridMessage').textContent(),/65\.0 MiB/);
 assert.match(await page.locator('#modelGridMessage').textContent(),/261/);
 await page.screenshot({path:'captures/model-import-bundle-warning.png'});
 await page.click('#modelProceed');await page.waitForFunction(()=>!document.querySelector('#modelConvert').disabled);
 const textureSize=await page.evaluate(async()=>{const {readModel}=await import('/model-loader.js');const loaded=await readModel(resourceFiles,'model.obj');const size=loaded.model.textures.map(t=>[t.width,t.height]);loaded.root.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){m.map?.dispose();m.dispose();}});return size;});
 assert.deepEqual(textureSize,[[2048,1]]);
 await page.click('#modelConvert');await page.waitForFunction(()=>!document.querySelector('#modelUse').disabled);
 assert.ok(await page.evaluate(()=>studio.modelImport.result().stats.voxels>0));
 await page.click('#modelClose');assert.deepEqual(await page.evaluate(()=>studio.blueprint()),original);assert.deepEqual(errors,[]);
 console.log('User bundle >64 MiB / >256 files: warning, proceed and conversion passed; texture retained 2048 pixels.');
 const dir=fs.mkdtempSync(path.resolve('workspace/import-resource-test-')),deep=path.join(dir,'a/b/c/d');
 try{
  fs.mkdirSync(deep,{recursive:true});fs.writeFileSync(path.join(dir,'model.obj'),obj.replace('mtllib model.mtl\nusemtl Paint\n',''));
  fs.writeFileSync(path.join(deep,'buffer.bin'),Buffer.alloc(65*1024*1024));
  for(let i=0;i<257;i++)fs.writeFileSync(path.join(dir,`extra${i}.bin`),'');
  const bundle=localModelBundle(path.join(dir,'model.obj'));assert.equal(bundle.files.length,259);assert.ok(bundle.files.some(f=>f.name==='a/b/c/d/buffer.bin'));
  const payload=JSON.stringify({...bundle,options:{longestSide:1024}});assert.ok(Buffer.byteLength(payload)>64*1024*1024);
  const response=await fetch('http://127.0.0.1:38799/api/import-model',{method:'POST',headers:{'content-type':'application/json'},body:payload});
  assert.equal(response.status,200);const result=await response.json();assert.equal(result.report.ok,true);assert.ok(!result.warnings.some(w=>/Large model bundle|Large grid|High resolution|Many model files/.test(w)));
  console.log('AI folder >64 MiB / >256 files / deeply nested dependency and HTTP upload >64 MiB passed without resource warnings.');
 }finally{
  // Only remove the exact files and directories created by this test.
  fs.unlinkSync(path.join(dir,'model.obj'));fs.unlinkSync(path.join(deep,'buffer.bin'));
  for(let i=0;i<257;i++)fs.unlinkSync(path.join(dir,`extra${i}.bin`));
  for(const rel of ['a/b/c/d','a/b/c','a/b','a',''])fs.rmdirSync(path.join(dir,rel));
 }
}finally{await browser.close();}
