import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import {jointAnchor} from '../lib/geometry.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initPhysics,PhysicsPreview,simulatePhysics} from '../lib/physics.mjs';
import {catalog} from '../lib/assets.mjs';
import {enrichEngineAssets} from '../lib/engine-assets.mjs';
await initPhysics();enrichEngineAssets(catalog);
const defs={block:{kind:'block',density:1000},bearing:{bearing:{}},spring:{spring:{length:3,defaultStiffnessLevel:0,stiffnessLevels:[5000]}},thruster:{box:{x:1,y:1,z:1},density:1000,thruster:{levels:[{averageForce:100}]}}};
const cube=(x=0,y=0,z=0,bounds={x:1,y:1,z:1})=>({shapeId:'block',pos:{x,y,z},xaxis:1,zaxis:3,bounds});
const joint=(id,a,b,posA,posB=posA,shapeId='bearing')=>({id,childA:a,childB:b,posA,posB,xaxisA:1,zaxisA:3,xaxisB:1,zaxisB:3,shapeId});
const step=(p,t)=>{try{return p.step(t);}finally{p.dispose();}};
test('gravity integrates SI acceleration; ground supports the body and no JSON is mutated',()=>{
 const bp={bodies:[{childs:[cube(0,0,8)]}]},before=structuredClone(bp);
 const falling=step(new PhysicsPreview(bp,defs,{ground:false}),1);
 assert.ok(Math.abs(falling.bodies[0].velocityMetersPerSecond[2]+9.81)<.001);
 assert.ok(falling.bodies[0].positionMeters[2]<-2.7);
 const resting=step(new PhysicsPreview(bp,defs),2);
 assert.ok(Math.abs(resting.bodies[0].positionMeters[2]-2.125)<.002);
 assert.deepEqual(bp,before);assert.equal(resting.engineVerified,false);
});
test('a driven bearing transmits motion through a passive bearing chain with constrained anchors',()=>{
 const gas='3091926a-9340-46d9-83d6-4fd7c68ad950';
 const bp={bodies:[{childs:[cube(),{...cube(-3),shapeId:gas,controller:{id:20,gear:2,joints:[{id:1}]}}]},{childs:[cube(0,0,1,{x:4,y:1,z:1})]},{childs:[cube(3,0,2,{x:4,y:1,z:1})]}],joints:[joint(1,0,2,{x:0,y:0,z:1}),joint(2,2,3,{x:3,y:0,z:2})]};
 const p=new PhysicsPreview(bp,{...defs,[gas]:catalog.get(gas)},{fixedBody:0,ground:false,gravity:[0,-9.81,0]});
 try{p.setEngine(20,{power:1});const result=p.step(1);
  assert.ok(Math.abs(result.joints[0].angleRadians)>.1);
  assert.ok(Math.abs(result.joints[1].angleRadians)>.05,'passive bearing must rotate instead of being welded');
  assert.ok(result.bodies[2].velocityMetersPerSecond.some(x=>Math.abs(x)>.01));
  assert.ok(Number.isFinite(result.engines[20].actualRpm[1]));
  assert.notEqual(result.engines[20].actualRpm[1],result.engines[20].rpm);
  for(const e of p.joints){const a=new Vector3(...jointAnchor(e.j,'A')).applyMatrix4(p.fragmentMatrices[e.a]),b=new Vector3(...jointAnchor(e.j,'B')).applyMatrix4(p.fragmentMatrices[e.b]);assert.ok(a.distanceTo(b)<.05,'joint anchor drift');}
 }finally{p.dispose();}
});
test('suspension compresses under load, settles, and rebounds when gravity is removed',()=>{
 const bp={bodies:[{childs:[cube()]},{childs:[cube(0,0,4)]}],joints:[joint(1,0,1,{x:0,y:0,z:1},{x:0,y:0,z:4},'spring')]};
 const p=new PhysicsPreview(bp,defs,{fixedBody:0,ground:false});
 try{const loaded=p.step(2);assert.ok(loaded.suspensions[1].compressionBlocks>.05);assert.ok(loaded.suspensions[1].compressionBlocks<.3);
  p.world.gravity={x:0,y:0,z:0};const released=p.step(2);assert.ok(Math.abs(released.suspensions[1].compressionBlocks)<.005);
 }finally{p.dispose();}
});
test('thruster input accelerates at F/m; release stops acceleration and preserves momentum',async()=>{
 const bp={bodies:[{childs:[{...cube(),shapeId:'thruster',controller:{id:5,level:0}}]}]},before=structuredClone(bp);
 const r=await simulatePhysics(bp,defs,{time:2,options:{ground:false,gravity:[0,0,0]},inputs:{5:true},events:[{time:1,inputs:{5:false}}]});
 assert.ok(Math.abs(r.bodies[0].velocityMetersPerSecond[2]+6.4)<.001);assert.equal(r.thrusters[5].forceNewtons,0);assert.deepEqual(bp,before);
});
test('off-centre thruster produces torque as well as translation',()=>{
 const bp={bodies:[{childs:[cube(),{...cube(1),shapeId:'thruster',controller:{id:5,level:0}}]}]};
 const p=new PhysicsPreview(bp,defs,{ground:false,gravity:[0,0,0]});p.setInput(5,true);const r=step(p,.5);
 assert.ok(Math.abs(r.bodies[0].angularVelocityRadPerSecond[1])>.1);
});
test('controller tracks a full negative 360 degree native step and returns without changing saved frames',()=>{
 const bp={bodies:[{childs:[cube(),{...cube(-3),shapeId:'sequence',controller:{id:20,timePerFrame:1,playMode:0,joints:[{id:1,frames:[{targetAngle:0},{targetAngle:360}]}]}}]},{childs:[cube(0,0,1)]}],joints:[joint(1,0,2,{x:0,y:0,z:1})]},before=structuredClone(bp);
 const p=new PhysicsPreview(bp,{...defs,sequence:{kind:'block',density:1000,sequence:{}}},{fixedBody:0,gravity:[0,0,0],ground:false});
 try{p.setInput(20,true);assert.ok(p.step(2).joints[0].angleRadians < -6);p.setInput(20,false);assert.ok(Math.abs(p.step(2).joints[0].angleRadians)<.05);assert.deepEqual(bp,before);}finally{p.dispose();}
});
test('force-limited piston extends and retracts along its guide',()=>{
 const piston={piston:{},pistonModel:{minSpan:1,maxExtension:5,defaultRange:2,defaultSpeedIndex:0,speedLevels:[4],speedUnitsVerified:false}};
 const j={...joint(1,0,1,{x:0,y:0,z:1},{x:0,y:0,z:2},'piston'),controller:{id:20,length:2,speed:0}};
 const bp={bodies:[{childs:[cube()]},{childs:[cube(0,0,2)]}],joints:[j]},p=new PhysicsPreview(bp,{...defs,piston},{fixedBody:0,ground:false});
 try{p.setInput(20,true);assert.ok(Math.abs(p.step(2).pistons[1].extension-2)<.1);p.setInput(20,false);assert.ok(p.step(2).pistons[1].extension<.1);}finally{p.dispose();}
});
test('survival force is not silently invented; an estimate or measured override is explicit',()=>{
 const bp={bodies:[{childs:[{...cube(),shapeId:'survival',controller:{id:5,level:2}}]}]},catalog={...defs,survival:{density:1000,box:{x:1,y:1,z:1},survivalThruster:{}}};
 const p=new PhysicsPreview(bp,catalog,{ground:false,gravity:[0,0,0]});p.setInput(5,true);const unsupported=step(p,.1);assert.equal(unsupported.bodies[0].velocityMetersPerSecond[2],0);assert.ok(unsupported.warnings.some(w=>w.includes('no exposed native force')));
 const q=new PhysicsPreview(bp,catalog,{ground:false,gravity:[0,0,0],estimateSurvivalThrust:true});q.setInput(5,true);const estimate=step(q,.1);assert.equal(estimate.thrusters[5].source,'creative-table estimate');assert.ok(estimate.bodies[0].velocityMetersPerSecond[2]<-1);
 const r=new PhysicsPreview(bp,catalog,{ground:false,gravity:[0,0,0],thrusterForces:{5:10}});r.setInput(5,true);assert.equal(step(r,.1).thrusters[5].forceNewtons,10);
});
test('disconnected blocks fall independently while the anchored attachment island stays fixed',()=>{
 const bp={bodies:[{childs:[cube(),cube(3)]}]},before=structuredClone(bp),p=new PhysicsPreview(bp,defs,{fixedBody:0,ground:false});
 try{const r=p.step(.5);assert.equal(r.bodies.length,2);assert.ok(Math.abs(r.partMatrices[0][14])<1e-6);assert.ok(r.partMatrices[1][14]<-4);assert.deepEqual(bp,before);}finally{p.dispose();}
});
test('wheel colliders use analytic cylinders, and joint-connected bodies keep contact response',()=>{
 const wheel={density:1000,cylinder:{axis:'Z',depth:1,diameter:1},sticky:'-Z+Z'};
 const bp={bodies:[{childs:[cube()]},{childs:[{...cube(0,0,1),shapeId:'wheel'}]}],joints:[joint(1,0,1,{x:0,y:0,z:1})]},p=new PhysicsPreview(bp,{...defs,wheel},{fixedBody:0});
 try{assert.equal(p.joints[0].joint.contactsEnabled(),true);assert.equal(p.bodies[1].collider(0).shape instanceof RAPIER.Cylinder,true);assert.ok(!p.snapshot().warnings.some(w=>w.includes('collision shapes use')));}finally{p.dispose();}
});

test('a loaded controller reaches and holds its target rather than sagging with damping 1',()=>{
 const base=cube(0,0,-1),arm=cube(0,0,1,{x:4,y:1,z:1});
 const bp={bodies:[{childs:[base,{...cube(-1,0,-1),shapeId:'sequence',controller:{id:20,timePerFrame:1,playMode:0,joints:[{id:1,frames:[{targetAngle:0},{targetAngle:90}]}]}}]},{childs:[arm]}],joints:[joint(1,0,2,{x:0,y:0,z:1})]},before=structuredClone(bp);
 const p=new PhysicsPreview(bp,{...defs,sequence:{kind:'block',density:1000,sequence:{}}},{fixedBody:0,ground:false,gravity:[0,-9.81,0]});
 try{p.setInput(20,true);const r=p.step(3);assert.ok(Math.abs(r.joints[0].angleRadians+Math.PI/2)<.03,`loaded angle ${r.joints[0].angleRadians}`);p.setInput(20,false);assert.ok(Math.abs(p.step(3).joints[0].angleRadians)<.03,'must hold rest against gravity');assert.deepEqual(bp,before);}finally{p.dispose();}
});

test('highest native suspension stiffness stays stable with a lightweight load',()=>{
 const spring=catalog.get('a481138b-fae9-47c9-9bc2-91b6d2e2bf52');
 const bp={bodies:[{childs:[cube()]},{childs:[cube(0,0,4)]}],joints:[{...joint(1,0,1,{x:0,y:0,z:1},{x:0,y:0,z:4},'spring'),controller:{stiffnessLevel:spring.spring.stiffnessLevels.length-1}}]};
 const p=new PhysicsPreview(bp,{...defs,block:{kind:'block',density:100},spring},{fixedBody:0,ground:false});
 try{p.bodies[1].setLinvel({x:0,y:0,z:-1},true);const r=p.step(3);assert.ok(Math.abs(r.bodies[1].velocityMetersPerSecond[2])<.02,'spring must settle');assert.ok(r.suspensions[1].compressionBlocks>=-.002);assert.ok(r.suspensions[1].compressionBlocks<.01,'stiff spring must support the load');}finally{p.dispose();}
});

test('controller torque override remains a real force limit under gravity',()=>{
 const bp={bodies:[{childs:[cube(0,0,-1),{...cube(-1,0,-1),shapeId:'sequence',controller:{id:20,timePerFrame:1,playMode:0,joints:[{id:1,frames:[{targetAngle:0},{targetAngle:90}]}]}}]},{childs:[cube(0,0,1,{x:4,y:1,z:1})]}],joints:[joint(1,0,2,{x:0,y:0,z:1})]};
 const p=new PhysicsPreview(bp,{...defs,sequence:{kind:'block',density:1000,sequence:{}}},{fixedBody:0,ground:false,gravity:[0,9.81,0],controllerTorque:0});
 try{p.setInput(20,true);assert.ok(p.step(.5).joints[0].angleRadians>0,'unpowered arm must fall against the commanded negative rotation');}finally{p.dispose();}
});

test('suspension strength scales equilibrium support without changing saved levels',()=>{const bp={bodies:[{childs:[cube()]},{childs:[cube(0,0,4)]}],joints:[joint(1,0,1,{x:0,y:0,z:1},{x:0,y:0,z:4},'spring')]},before=structuredClone(bp),compressions=[];for(const strength of [1,2,4]){const p=new PhysicsPreview(bp,defs,{fixedBody:0,ground:false,suspensionStrength:strength});try{const r=p.step(3),spring=r.suspensions[1];compressions.push(spring.compressionBlocks);assert.equal(spring.stiffness,5000*strength);assert.equal(spring.strengthMultiplier,strength);assert.ok(Math.abs(spring.compressionBlocks-(15.625*9.81/(5000*strength))/.25)<.005);}finally{p.dispose();}}assert.ok(Math.abs(compressions[1]/compressions[0]-.5)<.03);assert.deepEqual(bp,before);assert.throws(()=>new PhysicsPreview(bp,defs,{suspensionStrength:-1}),/nonnegative/);});
