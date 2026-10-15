import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:38799/?draft=Test&mode=edit');await page.waitForFunction(()=>studio.ready,{},{timeout:120000});
 const blueprint={version:4,bodies:[{childs:[{shapeId:'8aedf6c2-94e1-4506-89d4-a0227c552f1e',pos:{x:0,y:-1,z:0},bounds:{x:5,y:1,z:1},xaxis:1,zaxis:3,color:'444444'},{shapeId:'dfefc9d7-db03-4d25-ad85-eae1d824d8c0',pos:{x:0,y:0,z:0},xaxis:1,zaxis:3,color:'DF7F01',controller:{id:8,active:false,controllers:[]}},{shapeId:'7cf717d7-d167-4f2d-a6e7-6b2c70aa3986',pos:{x:3,y:0,z:0},xaxis:1,zaxis:3,color:'DF7F01',controller:{id:9,active:false,controllers:[{id:8}]}}]}],joints:[]};
 await page.evaluate(bp=>studio.editor.importBlueprint(bp),blueprint);
 const rest=await page.evaluate(()=>studio.partVisualBounds(1));await page.screenshot({path:'captures/radio-off.png'});
 for(const physics of [false,true]){
  if(physics)await page.evaluate(()=>studio.physics({fixedBody:0,gravity:[0,0,0],ground:false}));
  for(let cycle=0;cycle<2;cycle++){
   await page.evaluate(()=>{studio.setInput(9,true);studio.advance(.05);});
   await page.waitForFunction(y=>studio.partVisualBounds(1).max[1]>y+.3,rest.max[1]);
   const on=await page.evaluate(()=>studio.partVisualBounds(1));
   for(const k of [0,2])for(const edge of ['min','max'])assert.ok(Math.abs(on[edge][k]-rest[edge][k])<1e-5,'radio must not shift sideways on activation');
   assert.ok(Math.abs(on.min[1]-rest.min[1])<1e-5);
   if(!physics&&cycle===0)await page.screenshot({path:'captures/radio-on.png'});
   await page.evaluate(()=>{studio.setInput(9,false);studio.advance(.05);});await page.waitForFunction(y=>Math.abs(studio.partVisualBounds(1).max[1]-y)<1e-5,rest.max[1]);
  }
  await page.evaluate(()=>studio.simulate(false));assert.deepEqual(await page.evaluate(()=>studio.blueprint()),blueprint);
 }
 assert.deepEqual(await page.evaluate(()=>studio.sceneInfo().failures),[]);assert.deepEqual(errors,[]);
 console.log('Radio on/off mount, native antenna travel, repeated activation, physics/mechanisms and unchanged blueprint passed.');
}finally{await browser.close();}
