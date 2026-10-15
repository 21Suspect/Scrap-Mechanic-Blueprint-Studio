import assert from 'node:assert/strict';
import {BoxGeometry} from 'three';
import {chromium} from 'playwright';

const positions=new BoxGeometry(1,1,1).toNonIndexed().attributes.position.array;
let obj='',index=1;
for(const offset of [0,200])for(let i=0;i<positions.length;i+=9){
 for(let j=0;j<9;j+=3)obj+='v '+Array.from(positions.slice(i+j,i+j+3),v=>v+offset).join(' ')+'\n';
 obj+='f '+[index,index+1,index+2].join(' ')+'\n';index+=3;
}
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:38799/?draft=Boeing%20747-8%20Grand%20Airliner&mode=edit');
 await page.waitForFunction(()=>window.studio?.ready,{},{timeout:120000});
 const original=await page.evaluate(()=>studio.blueprint());
 await page.click('#openModelImport');
 await page.evaluate(obj=>studio.modelImport.choose([new File([obj],'large-grid.obj')]),obj);
 await page.fill('#modelSize','201');await page.click('#modelConvert');
 await page.waitForFunction(()=>!document.querySelector('#modelGridWarning').hidden);
 assert.match(await page.locator('#modelGridMessage').textContent(),/8,120,601 cells/);
 assert.equal(await page.locator('#modelUse').isDisabled(),true);
 await page.screenshot({path:'captures/model-import-grid-warning.png'});
 await page.click('#modelProceed');
 await page.waitForFunction(()=>!document.querySelector('#modelUse').disabled);
 const result=await page.evaluate(()=>studio.modelImport.result());
 assert.deepEqual(result.stats.grid,[201,201,201]);assert.equal(result.stats.voxels,2);
 assert.ok(result.warnings.some(w=>/Large grid/.test(w)));
 await page.fill('#modelSize','202');assert.equal(await page.locator('#modelGridWarning').isVisible(),false);
 assert.equal(await page.locator('#modelUse').isDisabled(),true);
 await page.click('#modelConvert');await page.waitForFunction(()=>!document.querySelector('#modelGridWarning').hidden);
 const cancelled=await page.evaluate(async()=>{const pending=studio.modelImport.convert({warnResources:true,acknowledgeResources:true}).catch(e=>e.message);document.querySelector('#modelCancel').click();return await pending;});
 assert.match(cancelled,/cancelled/);assert.equal(await page.evaluate(()=>studio.modelImport.result()),null);
 assert.equal(await page.locator('#modelGridWarning').isVisible(),false);
 await page.click('#modelClose');assert.deepEqual(await page.evaluate(()=>studio.blueprint()),original);
 assert.deepEqual(errors,[]);
 const payload={files:[{name:'large-grid.obj',data:Buffer.from(obj).toString('base64')}],entry:'large-grid.obj',options:{longestSide:201}};
 const warned=await fetch('http://127.0.0.1:38799/api/import-model',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
 assert.equal(warned.status,200);const automatic=await warned.json();assert.equal(automatic.stats.voxels,2);assert.ok(!automatic.warnings.some(w=>/Large grid/.test(w)));
 payload.options.longestSide=1024;
 const accepted=await fetch('http://127.0.0.1:38799/api/import-model',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
 assert.equal(accepted.status,200);const imported=await accepted.json();assert.equal(imported.report.ok,true);assert.ok(imported.stats.voxels>=2);
 console.log('Large-grid warning, proceed, setting invalidation, cancellation and HTTP override passed.');
}finally{await browser.close();}
