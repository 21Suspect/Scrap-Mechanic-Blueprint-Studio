import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {LoadingManager,Texture,Vector3} from 'three';
import {catalog,assetPath} from '../lib/assets.mjs';
import {ROTATIONS,axis,dimensions} from '../lib/geometry.mjs';
import {transformBlueprint} from '../lib/transform.mjs';
import {MotionPreview} from '../lib/simulation.mjs';
import {pistonFixture} from './fixtures/piston.mjs';
import {sequenceEndFrame} from '../lib/pistons.mjs';
import {applyPartSetting} from '../lib/part-settings.mjs';
import {copySelection,deleteSelection,flatten} from '../lib/editor.mjs';
import {validate} from '../lib/validate.mjs';
import {correctAssetScale,alignNativePose} from '../lib/render-geometry.mjs';
import {checkMotionCollisions} from '../lib/motion-collisions.mjs';
import {BlueprintBuilder} from '../lib/builder.mjs';
import {attachJoint} from '../lib/placement.mjs';

test('native absolute piston rows translate the child body correctly in all 24 rotations, retract and preserve serialization',()=>{
 for(const rotation of ROTATIONS){const bp=transformBlueprint(pistonFixture(),catalog,{xaxis:rotation.xaxis,zaxis:rotation.zaxis}),before=structuredClone(bp),p=new MotionPreview(bp,catalog);p.setInput(20,true);p.step(.5);assert.equal(p.snapshot().pistons[1].extension,1.5);p.step(.5);assert.equal(p.snapshot().pistons[1].extension,3);const moved=new Vector3().applyMatrix4(p.matrices[1]).toArray();assert.deepEqual(moved,axis(bp.joints[0].zaxisA).map(v=>v*3));p.setInput(20,false);p.step(1);assert.equal(p.snapshot().pistons[1].extension,0);assert.deepEqual(bp,before);}
});
test('direct switch piston drive uses saved range and speed; zero length is a meaningful controller step',()=>{
 const bp=pistonFixture(false);bp.joints[0].controller.length=6;bp.joints[0].controller.speed=0;const p=new MotionPreview(bp,catalog);p.setInput(20,true);p.step(.25);assert.equal(p.snapshot().pistons[1].extension,.5);p.step(.75);assert.equal(p.snapshot().pistons[1].extension,2);p.setInput(20,false);p.step(1);assert.equal(p.snapshot().pistons[1].extension,0);
 assert.equal(sequenceEndFrame({controllers:[{frames:[{setting:4},{setting:4},{setting:0},{setting:0}]}]}),2);
});
test('copy and deletion preserve and remap piston controller IDs and native length rows; shared settings work on joints',()=>{
 const bp=pistonFixture(),result=copySelection(bp,[0,1,2,3],{translation:[10,0,0]}).blueprint,j=result.joints[1],c=flatten(result).find(s=>s.controller?.id!==21&&s.shapeId===bp.bodies[0].childs[2].shapeId);assert.notEqual(j.controller.id,30);assert.equal(c.controller.controllers[0].id,j.controller.id);assert.equal(validate(result,catalog).ok,true,JSON.stringify(validate(result,catalog).errors));
 const edited=applyPartSetting(result,['j1','j'+j.id],'length',5,catalog);assert.ok(edited.joints.every(j=>j.controller.length===5));assert.equal(edited.joints[1].controller.id,j.controller.id);
 const removed=deleteSelection(result,[0]);assert.equal(removed.joints.length,1);assert.equal(flatten(removed).find(s=>s.controller?.id===21).controller.controllers.length,0);assert.equal(flatten(removed).find(s=>s.controller?.id===c.controller.id).controller.controllers[0].id,j.controller.id);
});
test('native piston pose meshes have matching topology and a full fifteen-block shaft displacement',()=>{
 const d=catalog.get('260b4597-f1ac-409c-8e6b-90c998c5fe94'),manager=new LoadingManager();manager.addHandler(/.*/,{setPath(){},load(){return new Texture();}});
 const load=ref=>{const bytes=fs.readFileSync(assetPath(ref)),group=new FBXLoader(manager).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');correctAssetScale(group,dimensions({},d));let g;group.updateMatrixWorld(true);group.traverse(o=>{if(o.isMesh)g=o.geometry.clone().applyMatrix4(o.matrixWorld);});g.computeBoundingBox();return g;};
 const rest=load(d.render.lodList[0].mesh),end=load(d.render.lodList[0].pose0);assert.equal(rest.attributes.position.count,end.attributes.position.count);assert.ok(Math.abs(end.boundingBox.max.z-rest.boundingBox.max.z-15)<.002);rest.dispose();end.dispose();
});
test('warehouse spotlight on-pose author offset is removed without changing UVs or scale',()=>{
 const d=catalog.get('695d66c8-b937-472d-8bc2-f3d72dd92879'),manager=new LoadingManager();manager.addHandler(/.*/,{setPath(){},load(){return new Texture();}});
 const load=ref=>{const bytes=fs.readFileSync(assetPath(ref)),group=new FBXLoader(manager).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');assert.equal(correctAssetScale(group,dimensions({},d)),10);group.updateMatrixWorld(true);let geometry,origin;group.traverse(o=>{if(o.isMesh){geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);origin=o.matrixWorld.elements.slice(12,15);}});return {geometry,origin};};
 const rest=load(d.render.lodList[0].mesh),on=load(d.render.lodList[0].pose0),uv=Array.from(on.geometry.attributes.uv.array);assert.ok(Math.abs(on.origin[0]-3)<1e-8);const before=on.geometry.attributes.position.getX(0);alignNativePose(on.geometry,rest.geometry,d,on.origin,rest.origin);assert.ok(Math.abs(on.geometry.attributes.position.getX(0)-before+3)<1e-6);assert.deepEqual(Array.from(on.geometry.attributes.uv.array),uv);rest.geometry.dispose();on.geometry.dispose();
});
test('automated collision sweep includes piston extension and release paths',()=>{const bp=pistonFixture(),report=checkMotionCollisions(bp,catalog);assert.ok(report.cases.some(c=>c.joints.includes(1)));assert.ok(report.cases[0].phases.some(p=>p.phase==='release'));assert.equal(report.complete,true);});
test('piston constructors use observed one-block closed spacing, unique interactable IDs and native absolute controller rows',()=>{
 const fixture=pistonFixture(false),placed=attachJoint({version:4,bodies:[{childs:[fixture.bodies[0].childs[0]]},{childs:fixture.bodies[1].childs}],joints:[]},catalog.get('260b4597-f1ac-409c-8e6b-90c998c5fe94'),[0,1],catalog).blueprint;assert.equal(placed.joints[0].posB.z-placed.joints[0].posA.z,1);
 const b=new BlueprintBuilder(),a=b.body(),c=b.body(),supportA=b.part(a,'8aedf6c2-94e1-4506-89d4-a0227c552f1e',[0,0,0]),supportB=b.part(c,'8aedf6c2-94e1-4506-89d4-a0227c552f1e',[0,0,2]),controller=b.part(a,'a092359d-5cea-484d-a274-470d9a567632',[4,0,0],{controller:{timePerFrame:1,playMode:0}}),piston=b.joint(supportA,supportB,'260b4597-f1ac-409c-8e6b-90c998c5fe94',[0,0,1]);b.connect(controller,piston);const bp=b.build();assert.equal(validate(bp,catalog).ok,true,JSON.stringify(validate(bp,catalog).errors));assert.equal(controller.controller.controllers[0].id,piston.controller.id);assert.equal(controller.controller.controllers[0].frames[1].setting,3);assert.notEqual(piston.id,piston.controller.id);
});
