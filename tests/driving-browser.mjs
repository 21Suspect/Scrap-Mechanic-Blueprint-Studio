import assert from 'node:assert/strict';
import {launchBrowser} from '../lib/browser.mjs';
const browser=await launchBrowser();
try {
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:38799/?id=33d1e5b1-9042-49af-b3b4-463f3ae739e6');
 await page.waitForFunction(()=>studio.ready,{}, {timeout:120000});
 const before=await page.evaluate(()=>studio.blueprint());
 const stationary=await page.evaluate(()=>{studio.physics({ground:true});studio.drive({});studio.advance(1);const results=[];for(const steering of [1,-1,0]){studio.drive({steering});const r=studio.advance(2);results.push({steering,joints:r.joints.filter(j=>[11,12].includes(j.id)),power:r.engines[5].direction});}studio.simulate(false);return results;});
 for(const r of stationary){assert.equal(r.power,0);for(const j of r.joints)assert.ok(Math.abs(j.angleRadians*180/Math.PI-r.steering*27)<1,'stationary steering target');}

 await page.click('#inspectToggle');await page.getByText('Simulation',{exact:true}).click();
 await page.selectOption('#simulationMode','physics');await page.locator('#viewport canvas').click({position:{x:30,y:200}});
 await page.waitForTimeout(350);await page.keyboard.down('w');await page.keyboard.down('a');
 let r=await page.evaluate(()=>studio.advance(1));
 assert.equal(r.driver.throttle,1);assert.equal(r.driver.steering,-1);assert.equal(r.engines[5].direction,1);assert.ok(r.steeringTargets[12]<0);
 await page.keyboard.up('w');await page.keyboard.up('a');
 await page.keyboard.down('d');r=await page.evaluate(()=>studio.advance(.5));assert.equal(r.driver.steering,1);assert.ok(r.steeringTargets[12]>0);await page.keyboard.up('d');
 r=await page.evaluate(()=>studio.advance(.2));assert.equal(r.driver.throttle,0);assert.equal(r.driver.steering,0);
 await page.keyboard.down('s');r=await page.evaluate(()=>studio.advance(.1));assert.equal(r.engines[5].direction,-1);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.evaluate(()=>studio.simulation().driver.throttle),0);
 await page.keyboard.up('s');await page.locator('#request').focus();await page.keyboard.type('wasd');assert.equal(await page.evaluate(()=>studio.simulation().driver.throttle),0);
 await page.evaluate(()=>studio.simulate(false));assert.deepEqual(await page.evaluate(()=>studio.blueprint()),before);assert.deepEqual(errors,[]);
 console.log('WASD browser driving, steering, reverse, release, blur, typing and reset passed.');
} finally {await browser.close();}


