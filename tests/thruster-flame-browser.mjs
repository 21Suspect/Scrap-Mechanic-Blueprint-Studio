import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:38799/?draft=Test&mode=edit');await page.waitForFunction(()=>studio.ready,{},{timeout:120000});
 const blueprint={version:4,bodies:[{childs:[{shapeId:'a736ffdf-22c1-40f2-8e40-988cab7c0559',pos:{x:0,y:0,z:0},xaxis:1,zaxis:3,color:'808080',controller:{id:5,level:6,active:false,controllers:[]}}]}],joints:[]};
 await page.evaluate(bp=>studio.editor.importBlueprint(bp),blueprint);
 await page.evaluate(()=>{studio.setInput(5,true);studio.advance(.5);});
 const on=await page.evaluate(()=>studio.thrusterFlames());assert.equal(on.length,1);assert.equal(on[0].on,true);assert.ok(on[0].texture.includes('thruster_animatedthruster'));
 const second=await page.evaluate(()=>{studio.advance(.1);return studio.thrusterFlames();});assert.notEqual(second[0].frame,on[0].frame);
 await page.evaluate(()=>studio.frameSimulation());await page.screenshot({path:'captures/thruster-flame.png'});
 await page.evaluate(()=>{studio.setInput(5,false);studio.advance(.05);});assert.equal((await page.evaluate(()=>studio.thrusterFlames()))[0].on,false);
 await page.evaluate(()=>studio.simulate(false));assert.deepEqual(await page.evaluate(()=>studio.blueprint()),blueprint);
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>studio.sceneInfo().failures),[]);
 // An isolated block must visibly fall in the renderer, not just in telemetry.
 await page.evaluate(()=>studio.editor.importBlueprint({version:4,bodies:[{childs:[{shapeId:'8aedf6c2-94e1-4506-89d4-a0227c552f1e',pos:{x:0,y:0,z:0},bounds:{x:1,y:1,z:1},xaxis:1,zaxis:3,color:'FFFFFF'},{shapeId:'8aedf6c2-94e1-4506-89d4-a0227c552f1e',pos:{x:3,y:0,z:0},bounds:{x:1,y:1,z:1},xaxis:1,zaxis:3,color:'FFFFFF'}]}],joints:[]}));
 const result=await page.evaluate(()=>{studio.physics({ground:false,fixedBody:0});return studio.advance(.5);});assert.equal(result.bodies.length,2);assert.ok(result.partMatrices[1][14]<-4);const pose=await page.evaluate(()=>studio.partPose(1));assert.ok(Math.abs(pose[14]-(result.partMatrices[1][14]+.5))<1e-4);await page.evaluate(()=>studio.simulate(false));assert.ok(Math.abs((await page.evaluate(()=>studio.partPose(1)))[14]-.5)<1e-6);
 console.log('Native flame atlas animation, on/off/reset, isolated body physics and unchanged blueprint passed.',JSON.stringify(on));
}finally{await browser.close();}
