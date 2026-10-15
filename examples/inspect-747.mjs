import fs from 'node:fs';import path from'node:path';import assert from'node:assert/strict';import{chromium}from'playwright';import{capture}from'../capture.mjs';import{WORK,ROOT,catalog}from'../lib/assets.mjs';import{shapeBox}from'../lib/geometry.mjs';
const name='Boeing 747-8 Grand Airliner',out=path.join(ROOT,'captures',name),bp=JSON.parse(fs.readFileSync(path.join(WORK,name+'.json'))),facts=JSON.parse(fs.readFileSync(path.join(WORK,name+'.design.json')));
for(const connections of [false,true]){const r=await capture({draft:name,output:connections?path.join(out,'connections'):out,connections});assert.equal(r.browserErrors.length,0);assert.equal(r.render.failures.length,0);console.log('Captured seven views',connections?'with connections':'exterior');}
const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:38799/?draft='+encodeURIComponent(name));await page.waitForFunction(()=>window.studio?.ready,{},{timeout:120000});
 const result=await page.evaluate(facts=>{
  const s=window.studio,results=[];for(const c of facts.controls){s.simulate(false);s.setInput(c.id,true);const on=s.advance(6),lights=s.lightStates().filter(l=>l.on).length;s.setInput(c.id,false);const off=s.advance(6);results.push({id:c.id,label:c.label,on:on.states[c.id],off:off.states[c.id],angles:on.angles,returnAngles:off.angles,lampsOn:lights,lampsAfterRelease:s.lightStates().filter(l=>l.on).length,engines:on.engines});}
  s.simulate(false);const engineTests=[];for(const id of [128,129,130])for(const power of [1,-1]){s.driveEngine(id,{power,gear:3});const state=s.advance(1);engineTests.push({id,power,state:state.engines[id]});s.driveEngine(id,{power:0});s.advance(.5);}s.simulate(false);
  return{inputs:results,engineTests,mass:s.mass(),assets:s.sceneInfo()};
 },facts);
 for(const r of result.inputs){assert.equal(r.on,true);assert.equal(r.off,false);if(r.label.includes('lights')){assert.ok(r.lampsOn>0);assert.equal(r.lampsAfterRelease,0);}if(/doors|gear|flaps|hatch/.test(r.label)){const mech=facts.mechanisms.find(m=>m.label.toLowerCase().includes(r.label==='Retract landing gear'?'landing gear':r.label.toLowerCase()));assert.ok(mech);for(const j of mech.joints){assert.ok(Math.abs(r.angles[j]||0)>1);assert.ok(Math.abs(r.returnAngles[j]||0)<1e-8);}}}
 const f=bp.bodies.flatMap(b=>b.childs);
 for(const [label,z,minY,maxY]of [['main-cabin',40,58,165],['upper-deck',51,20,85],['cargo-hold',29,72,150]]){
  const ids=f.map((s,i)=>({s,i,q:shapeBox(s,catalog.get(s.shapeId))})).filter(v=>v.q.min[1]>=minY&&v.q.max[1]<=maxY&&v.q.min[2]>=z-10&&v.q.max[2]<=z&&Math.abs(v.q.min[0])<12).map(v=>v.i);
  await page.evaluate(async({ids,z})=>{await studio.section(z);studio.focus(ids);studio.render();},{ids,z});await page.screenshot({path:path.join(out,label+'.png')});
 }
 await page.evaluate(async()=>{await studio.section(null);studio.setInput(94,true);studio.setInput(95,true);studio.setInput(96,true);studio.setInput(97,true);studio.advance(6);studio.setView('bottom');});await page.screenshot({path:path.join(out,'mechanisms-active.png')});
 await page.evaluate(()=>studio.simulate(false));assert.deepEqual(await page.evaluate(()=>studio.blueprint()),bp);const thumbnail=await page.evaluate(()=>studio.thumbnail());fs.writeFileSync(path.join(WORK,name+'.png'),Buffer.from(thumbnail.split(',')[1],'base64'));
 result.browserErrors=errors;assert.equal(errors.length,0);fs.writeFileSync(path.join(out,'controls-and-interiors.json'),JSON.stringify(result,null,2));assert.deepEqual(JSON.parse(fs.readFileSync(path.join(WORK,name+'.json'))),bp);
 console.log(JSON.stringify({controls:result.inputs.map(x=>({id:x.id,label:x.label,on:x.on,off:x.off,lamps:x.lampsOn})),engineTests:result.engineTests,errors}));
}finally{await browser.close();}
