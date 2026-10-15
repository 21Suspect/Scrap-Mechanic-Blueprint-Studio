import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Matrix4,Vector3,LoadingManager,Texture} from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {catalog,assetPath} from '../lib/assets.mjs';
import {alignButtonPose,correctAssetScale} from '../lib/render-geometry.mjs';
import {dimensions,ROTATIONS,basis,rotate} from '../lib/geometry.mjs';
import {attachJoint} from '../lib/placement.mjs';
import {MotionPreview} from '../lib/simulation.mjs';
import {thrusterSetting} from '../lib/thrusters.mjs';
import {applyPartSetting,partSettingDescriptors} from '../lib/part-settings.mjs';
import {engineGear} from '../lib/editor.mjs';
import {collisionScene} from '../lib/collision-geometry.mjs';
import {checkMotionCollisions,replayMotionCollision} from '../lib/motion-collisions.mjs';
import {makeBlueprintBrief} from '../lib/generation-brief.mjs';

const ID={block:'8aedf6c2-94e1-4506-89d4-a0227c552f1e',wedge:'bf3de51c-14c1-11ed-861d-0242ac120002',bearing:'4a1b886b-913e-4aad-b5b6-6e41b0db23a6',switch:'7cf717d7-d167-4f2d-a6e7-6b2c70aa3986',button:'1e8d93a4-506b-470d-9ada-9c0a321e2db5',controller:'a092359d-5cea-484d-a274-470d9a567632',thruster:'5e96037a-a338-490a-a76f-6b4d820f8e46',engine:'3091926a-9340-46d9-83d6-4fd7c68ad950'};
const cube=(p=[0,0,0],size=[1,1,1])=>({shapeId:ID.block,pos:{x:p[0],y:p[1],z:p[2]},bounds:{x:size[0],y:size[1],z:size[2]},xaxis:1,zaxis:3,color:'FFFFFF'});

test('native pressed button remains laterally registered, with physical Y travel and untouched UVs',()=>{
 const d=catalog.get(ID.button),manager=new LoadingManager();manager.addHandler(/.*/,{setPath(){},load(){return new Texture();}});
 const load=ref=>{const bytes=fs.readFileSync(assetPath(ref)),g=new FBXLoader(manager).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');correctAssetScale(g,dimensions({},d));g.updateMatrixWorld(true);let geometry;g.traverse(o=>{if(o.isMesh)geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);});geometry.computeBoundingBox();return geometry;};
 const rest=load(d.render.lodList[0].mesh),pressed=load(d.render.lodList[0].pose0),uv=Array.from(pressed.attributes.uv.array),travel=pressed.boundingBox.max.y-rest.boundingBox.max.y;
 assert.ok(pressed.boundingBox.getCenter(new Vector3()).x>1);
 alignButtonPose(pressed,rest,d);pressed.computeBoundingBox();assert.ok(Math.abs(pressed.boundingBox.getCenter(new Vector3()).x)<1e-8);assert.equal(pressed.boundingBox.min.y,rest.boundingBox.min.y);
 assert.ok(travel<-.1&&travel>-.2);assert.equal(pressed.boundingBox.max.y-rest.boundingBox.max.y,travel);assert.deepEqual(Array.from(pressed.attributes.uv.array),uv);
 rest.dispose();pressed.dispose();
});

test('native clockwise sequence direction and reversal work for all 24 bearing axis pairs',()=>{
 for(const r of ROTATIONS)for(const reverse of [false,true]){
  const bp=attachJoint({version:4,bodies:[{childs:[cube()]},{childs:[cube([0,0,1])]}],joints:[]},catalog.get(ID.bearing),[0,1],catalog).blueprint,j=bp.joints[0];
  j.xaxisA=j.xaxisB=r.xaxis;j.zaxisA=j.zaxisB=r.zaxis;
  bp.bodies[0].childs.push({...cube([10,0,0]),shapeId:ID.controller,controller:{id:20,active:true,timePerFrame:1,joints:[{id:j.id,reverse,frames:[{targetAngle:0},{targetAngle:90}]}]}});j.childB=2;
  const p=new MotionPreview(bp,catalog);p.setInput(20,true);p.step(1);assert.equal(p.snapshot().angles[j.id],reverse?90:-90);
  const v=new Vector3(...rotate(basis(r.xaxis,r.zaxis),[1,0,0])).transformDirection(p.matrices[1]);
  const expected=rotate(basis(r.xaxis,r.zaxis),[0,reverse?1:-1,0]);v.toArray().forEach((n,i)=>assert.ok(Math.abs(n-expected[i])<1e-6));
 }
});

test('batch thruster, engine and sequence edits change settings while preserving per-part IDs, wiring and opaque state',()=>{
 const parts=[0,1].map(i=>({...cube([i*5,0,0]),shapeId:ID.thruster,controller:{id:10+i,level:i,controllers:[{id:70+i}],data:'untouched'+i}})),bp={version:4,bodies:[{childs:parts}],joints:[]};
 const descriptor=partSettingDescriptors(parts,catalog).find(s=>s.key==='thrusterLevel');assert.equal(descriptor.mixed,true);
 const result=applyPartSetting(bp,[0,1],'thrusterLevel',5,catalog);for(let i=0;i<2;i++){assert.equal(result.bodies[0].childs[i].controller.level,5);assert.equal(result.bodies[0].childs[i].controller.id,10+i);assert.deepEqual(result.bodies[0].childs[i].controller.controllers,parts[i].controller.controllers);assert.equal(result.bodies[0].childs[i].controller.data,'untouched'+i);}
 assert.equal(thrusterSetting(result.bodies[0].childs[0],catalog.get(ID.thruster)).displayLevel,6);assert.throws(()=>applyPartSetting(bp,[0,1],'thrusterLevel',7,catalog));assert.equal(bp.bodies[0].childs[0].controller.level,0);
 const engines={version:4,bodies:[{childs:[0,1].map(i=>({...cube([i*5,0,0]),shapeId:ID.engine,controller:{id:20+i,data:'8B1MVUEAAAABBQAAAAICAAAABQBmdWVsUG9pbnRzCAAEAAAAB2dlYXJJZHgIBA',joints:[{id:40+i,reverse:!!i}]}}))}],joints:[]};
 const edited=applyPartSetting(engines,[0,1],'engineGear',7,catalog);for(let i=0;i<2;i++){assert.equal(engineGear(edited.bodies[0].childs[i].controller),7);assert.deepEqual(edited.bodies[0].childs[i].controller.joints,engines.bodies[0].childs[i].controller.joints);}
 const controllers={version:4,bodies:[{childs:[0,1].map(i=>({...cube([i*5,0,0]),shapeId:ID.controller,controller:{id:30+i,timePerFrame:1,playMode:0,joints:[{id:50+i,index:0,reverse:!!i,frames:[{targetAngle:0},{targetAngle:90}]}]}}))}],joints:[]};
 const frames=applyPartSetting(controllers,[0,1],'frame:0:1',45,catalog);assert.ok(frames.bodies[0].childs.every(s=>s.controller.joints[0].frames[1].targetAngle===45));assert.equal(frames.bodies[0].childs[1].controller.joints[0].id,51);
});

function sweepFixture(obstacle=true){
 const base={...cube([-1,-1,-1],[2,2,1]),joints:[{id:1}]},bar={...cube([0,0,0],[3,1,1]),joints:[{id:1}]};
 const fixed=[base,{...cube([10,0,0]),shapeId:ID.switch,controller:{id:20,active:false,controllers:[{id:21}]}},{...cube([12,0,0]),shapeId:ID.controller,controller:{id:21,playMode:0,timePerFrame:1,joints:[{id:1,reverse:false,frames:[{targetAngle:0},{targetAngle:90}]}]}}];
 if(obstacle)fixed.push(cube([2,-1,0]));
 return {version:4,bodies:[{childs:fixed},{childs:[bar]}],joints:[{id:1,shapeId:ID.bearing,childA:0,childB:fixed.length,posA:{x:0,y:0,z:0},posB:{x:0,y:0,z:0},xaxisA:1,zaxisA:3,xaxisB:1,zaxisB:3,color:'FFFFFF'}]};
}

test('collision sweep catches a mid-travel obstacle missed by both endpoint poses and replays that exact pose',()=>{
 const bp=sweepFixture(),saved=structuredClone(bp),p=new MotionPreview(bp,catalog),scene=collisionScene(bp,catalog);p.setInput(20,true);p.step(0);assert.equal(scene.intersections(p.matrices).collisions.length,0);p.step(1);assert.equal(scene.intersections(p.matrices).collisions.length,0);
 const report=checkMotionCollisions(bp,catalog);assert.equal(report.complete,true);assert.ok(report.collisionCount>0);assert.equal(report.engineVerified,false);const scenario=report.cases[0],hit=scenario.collisions.find(h=>[h.a,h.b].includes(3));assert.ok(hit.time>0&&hit.time<1);const replay=replayMotionCollision(bp,catalog,scenario,hit);assert.ok(scene.intersections(replay.matrices).collisions.some(c=>[c.a,c.b].includes(3)));assert.deepEqual(bp,saved);
});

test('shared attachment faces are allowed and native wedge slope empty space is not a box collision',()=>{
 assert.equal(checkMotionCollisions(sweepFixture(false),catalog).collisionCount,0);
 const bp={version:4,bodies:[{childs:[{...cube([0,0,0],[2,2,2]),shapeId:ID.wedge}]},{childs:[cube([1,1,1])]}],joints:[]};
 assert.equal(collisionScene(bp,catalog).intersections([new Matrix4(),new Matrix4()],{movingOnly:false}).collisions.length,0);
});

test('motion limits are reported as incomplete rather than a clear verdict',()=>{const report=checkMotionCollisions(sweepFixture(false),catalog,{maxSamplesPerPhase:10,stepSeconds:.001});assert.equal(report.complete,false);assert.equal(report.clearWithinSampledGeometry,false);assert.equal(report.cases[0].truncated,true);});

test('AI brief carries native settings, attachment rules, collision testing, limitations and modification inventory',()=>{const brief=makeBlueprintBrief({idea:'Build a folding tractor',source:'Modify draft Test in workspace.',blueprint:sweepFixture(),catalog});for(const value of ['engines','thrusters','Sensors','sticky','targetAngle','check_motion_collisions','release/return','no paid API','engineVerified:false',ID.controller])assert.ok(brief.toLowerCase().includes(value.toLowerCase()),value);});
