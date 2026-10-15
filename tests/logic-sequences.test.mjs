import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog} from '../lib/assets.mjs';
import {enrichEngineAssets} from '../lib/engine-assets.mjs';
import {MotionPreview} from '../lib/simulation.mjs';
import {logicOutput} from '../lib/logic.mjs';
import {applyPartSetting,partSettingDescriptors} from '../lib/part-settings.mjs';
import {pistonFixture} from './fixtures/piston.mjs';
import {validate} from '../lib/validate.mjs';
import {placePart} from '../lib/placement.mjs';
import {checkMotionCollisions} from '../lib/motion-collisions.mjs';
enrichEngineAssets(catalog);
const gate='9f0f56e8-2c31-4d83-996c-d00a9b296c3f',gas='3091926a-9340-46d9-83d6-4fd7c68ad950';
const part=(shapeId,id,controller={})=>({shapeId,pos:{x:id*3,y:0,z:0},xaxis:1,zaxis:3,color:'FFFFFF',controller:{id,controllers:[],joints:[],...controller}});

test('all six installed gate rules cover every combination of three linked triggers',()=>{
 for(let mode=0;mode<6;mode++)for(let bits=0;bits<8;bits++){
  const states=[!!(bits&1),!!(bits&2),!!(bits&4)],n=states.filter(Boolean).length,expected=[n===3,n>0,n===1,n!==3,n===0,n%2===0][mode];
  assert.equal(logicOutput(mode,states),expected);
  const bp={version:4,bodies:[{childs:[...states.map((active,i)=>part('7cf717d7-d167-4f2d-a6e7-6b2c70aa3986',i+1,{active,controllers:[{id:4}]})),part(gate,4,{mode})]}],joints:[]};
  const p=new MotionPreview(bp,catalog);p.step(0);assert.equal(p.states.get(4),expected);
 }
});

test('nested logic propagates into lights, engines, thrusters and controller piston rows without editing saved JSON',()=>{
 const bp=pistonFixture(),base=bp.bodies[0].childs;const lampID=[...catalog.values()].find(d=>d.spotlight)?.uuid;
 base[1].controller.controllers=[{id:40}];base.push(part(gate,40,{mode:0,controllers:[{id:41}]}),part(gate,41,{mode:1,controllers:[{id:21},{id:43},{id:44},{id:45}]}),part(lampID,43,{luminance:50}),part(gas,44,{gear:5}),part('5e96037a-a338-490a-a76f-6b4d820f8e46',45,{level:4}));bp.joints[0].childB=base.length;
 const original=structuredClone(bp),p=new MotionPreview(bp,catalog);p.step(0);assert.equal(p.engines.get(44).powered,false);assert.equal(p.states.get(43),false);
 p.setInput(20,true);p.step(.5);assert.equal(p.states.get(43),true);assert.equal(p.states.get(45),true);assert.equal(p.engines.get(44).powered,true);assert.equal(p.pistons.get(1).extension,1.5);
 p.setInput(20,false);p.step(.5);assert.equal(p.states.get(43),false);assert.equal(p.engines.get(44).powered,false);assert.equal(p.pistons.get(1).extension,0);assert.deepEqual(bp,original);
});

test('gate settings batch edit preserves IDs and wiring and rejects invalid mode',()=>{
 const bp={version:4,bodies:[{childs:[part(gate,10,{mode:0,controllers:[{id:11}]}),part(gate,11,{mode:2})]}],joints:[]};
 assert.equal(partSettingDescriptors(bp.bodies[0].childs,catalog,bp).find(d=>d.key==='mode').mixed,true);
 const out=applyPartSetting(bp,[0,1],'mode',5,catalog);assert.deepEqual(out.bodies[0].childs.map(s=>s.controller.mode),[5,5]);assert.deepEqual(out.bodies[0].childs.map(s=>s.controller.id),[10,11]);assert.deepEqual(out.bodies[0].childs[0].controller.controllers,[{id:11}]);assert.throws(()=>applyPartSetting(bp,[0,1],'mode',6,catalog));
 out.bodies[0].childs[0].controller.mode=6;assert.ok(validate(out,catalog).errors.some(e=>e.code==='LOGIC_MODE'));
});

test('a shared controller timeline stages bearing then piston then bearing and returns through the same steps',()=>{
 const bp=pistonFixture(),c=bp.bodies[0].childs[2].controller;c.joints=[{id:2,index:0,reverse:false,startAngle:0,endAngle:135,frames:[{targetAngle:0},{targetAngle:90},{targetAngle:0},{targetAngle:45}]}];c.controllers[0].index=1;c.controllers[0].frames=[0,0,3,3].map(setting=>({setting}));
 const p=new MotionPreview(bp,catalog);p.setInput(20,true);p.step(.5);assert.equal(p.angles.get(2),-45);assert.equal(p.pistons.get(1).extension,0);p.step(.5);assert.equal(p.angles.get(2),-90);assert.equal(p.pistons.get(1).extension,0);
 p.step(.5);assert.equal(p.angles.get(2),-90);assert.equal(p.pistons.get(1).extension,1.5);p.step(.5);assert.equal(p.angles.get(2),-90);assert.equal(p.pistons.get(1).extension,3);
 p.step(.5);assert.equal(p.angles.get(2),-112.5);assert.equal(p.pistons.get(1).extension,3);p.step(.5);assert.equal(p.angles.get(2),-135);
 p.setInput(20,false);p.step(1);assert.equal(p.angles.get(2),-90);assert.equal(p.pistons.get(1).extension,3);p.step(1);assert.equal(p.pistons.get(1).extension,0);p.step(1);assert.equal(p.angles.get(2),0);
});

test('native loop mode 2 repeats a rotation without ping-pong or a one-cycle reset',()=>{
 const bp=pistonFixture(),c=bp.bodies[0].childs[2].controller;c.playMode=2;c.timePerFrame=.1;c.controllers=[];c.joints=[{id:2,index:0,reverse:false,frames:[{targetAngle:0},{targetAngle:360}]}];
 const p=new MotionPreview(bp,catalog);p.setInput(20,true);p.step(.15);assert.ok(Math.abs(p.angles.get(2)+540)<1e-7);p.step(.15);assert.ok(Math.abs(p.angles.get(2)+1080)<1e-7);
});

test('sequence editor can add later steps and synchronizes native endpoints; placement accounts for piston interactable IDs',()=>{
 const bp=pistonFixture(),c=bp.bodies[0].childs[2].controller;c.joints=[{id:2,index:0,reverse:false,startAngle:0,endAngle:90,frames:[{targetAngle:0},{targetAngle:90}]}];c.controllers[0].index=1;
 let out=applyPartSetting(bp,[2],'frame:0:5',45,catalog);assert.equal(out.bodies[0].childs[2].controller.joints[0].endAngle,135);assert.equal(out.bodies[0].childs[2].controller.joints[0].frames.length,11);out=applyPartSetting(out,[2],'timePerFrame',.001,catalog);assert.equal(out.bodies[0].childs[2].controller.timePerFrame,.001);
 const placed=placePart(bp,catalog.get(gate),{body:0,pos:{x:10,y:0,z:0}},catalog);assert.ok(placed.blueprint.bodies[0].childs.at(-1).controller.id>30);
});
test('oscillating logic feedback cannot produce a complete clear motion verdict',()=>{
 const bp=pistonFixture();for(let i=0;i<3;i++)bp.bodies[0].childs.push(part(gate,40+i,{mode:4,controllers:[{id:40+(i+1)%3}]}));bp.joints[0].childB=6;
 const r=checkMotionCollisions(bp,catalog,{maxSamplesPerPhase:20});assert.equal(r.complete,false);assert.ok(r.cases.some(c=>c.unsupported&&c.warnings.some(w=>w.includes('Logic feedback'))));
});
