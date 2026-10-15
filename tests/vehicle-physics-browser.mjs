import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:38799/');await page.waitForFunction(()=>window.studio?.ready,{},{timeout:120000});
 await page.evaluate(()=>studio.load({id:'33d1e5b1-9042-49af-b3b4-463f3ae739e6'}));
 assert.equal(await page.evaluate(()=>studio.error),null);
 const before=await page.evaluate(()=>studio.blueprint()),restPose=await page.evaluate(()=>studio.partPose(0));
 await page.click('#inspectToggle');await page.getByText('Simulation',{exact:true}).click();await page.selectOption('#simulationMode','physics');
 await page.screenshot({path:'captures/jeeep-physics-before.png'});
 // Use the same engine controls as the user, not just a backend-only fixture.
 await page.locator('.creation-input[data-controller="5"]').click();
 assert.equal(await page.locator('.creation-input[data-controller="10"]').getAttribute('aria-pressed'),'false','seat-linked second engine must not auto-run');
 await page.locator('.creation-input[data-controller="10"]').click();
 const forward=await page.evaluate(()=>studio.advance(2)),pose=await page.evaluate(()=>studio.partPose(0));
 assert.equal(forward.physics,true);assert.ok(pose[12]-restPose[12]<-8,'rendered chassis must travel over two metres toward the nose (-X)');
 assert.equal(forward.engines[5].powered,true);assert.equal(forward.engines[10].powered,true);
 await page.evaluate(()=>studio.frameSimulation());await page.screenshot({path:'captures/jeeep-physics-driving.png'});
 await page.click('#physicsReset');assert.deepEqual(await page.evaluate(()=>studio.blueprint()),before);assert.deepEqual(await page.evaluate(()=>studio.partPose(0)),restPose);
 // Test backend access too, including reverse with identical saved settings.
 const response=await page.request.post('http://127.0.0.1:38799/api/physics',{data:{blueprint:before,time:2,engines:{5:{power:-1},10:{power:-1}}}});
 assert.equal(response.status(),200);const reverse=await response.json();assert.ok(reverse.bodies[0].positionMeters[0]>-1.25);assert.equal(reverse.engineVerified,false);
 await page.selectOption('#simulationMode','kinematic');
 const mechanism=await page.evaluate(()=>{studio.driveEngine(5,{power:1});studio.driveEngine(10,{power:1});return studio.advance(.001);});
 assert.ok(mechanism.jointSpeedsRadPerSecond[8]<0);assert.ok(mechanism.jointSpeedsRadPerSecond[10]>0);
 await page.evaluate(()=>studio.simulate(false));assert.deepEqual(await page.evaluate(()=>studio.blueprint()),before);
 const report={forwardMeters:pose[12]/4-restPose[12]/4,reverseMeters:reverse.bodies[0].positionMeters[0]+3.25,forwardEngineRpm:Object.fromEntries(Object.entries(forward.engines).map(([id,e])=>[id,e.actualRpm])),errors,blueprintUnchanged:true};
 fs.writeFileSync('captures/jeeep-physics-report.json',JSON.stringify(report,null,2));
 assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{await browser.close();}
