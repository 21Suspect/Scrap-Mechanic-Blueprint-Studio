import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:38799/');await page.waitForFunction(()=>window.studio?.ready,{},{timeout:120000});
 await page.evaluate(()=>studio.load({id:'6fb715c8-a370-4766-8314-6cf1a6b95dcc'}));
 assert.equal(await page.evaluate(()=>studio.error),null);
 const before=await page.evaluate(()=>studio.blueprint());
 await page.click('#inspectToggle');await page.getByText('Simulation',{exact:true}).click();
 await page.selectOption('#simulationMode','physics');await page.check('#physicsThrustEstimate');
 await page.click('#physicsRun');
 const report=await page.evaluate(()=>{studio.setInput(4230,true);return studio.advance(2);});
 assert.equal(report.physics,true);assert.equal(report.engineVerified,false);assert.ok(report.bodyMatrices.flat().every(Number.isFinite));
 fs.writeFileSync('captures/physics-browser-report.json',JSON.stringify(report,null,2));
 await page.screenshot({path:'captures/physics-browser.png'});
 await page.click('#physicsReset');assert.equal(await page.evaluate(()=>studio.simulation()),undefined);assert.deepEqual(await page.evaluate(()=>studio.blueprint()),before);
 await page.selectOption('#simulationMode','kinematic');await page.click('#physicsRun');assert.equal(await page.evaluate(()=>studio.simulation().physics),false);await page.click('#physicsReset');
 const response=await page.request.post('http://127.0.0.1:38799/api/physics',{data:{blueprint:before,time:.1,options:{estimateSurvivalThrust:true}}});assert.equal(response.status(),200);assert.equal((await response.json()).engineVerified,false);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({bodies:report.bodies.length,joints:report.joints.length,thrusters:report.thrusters,warnings:report.warnings,errors}));
}finally{await browser.close();}
