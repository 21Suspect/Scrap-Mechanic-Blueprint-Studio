import test from 'node:test';import assert from 'node:assert/strict';import {Matrix4} from 'three';
import {MotionPreview} from '../lib/simulation.mjs';import {PhysicsPreview,initPhysics} from '../lib/physics.mjs';
const defs={sensor:{box:{x:1,y:1,z:1},sensor:{},density:1000},block:{kind:'block',density:1000},lamp:{box:{x:1,y:1,z:1},pointlight:{},density:1000}};
const part=(shapeId,pos,color='ff0000')=>({shapeId,pos,xaxis:1,zaxis:3,color,...(shapeId==='block'?{bounds:{x:1,y:1,z:1}}:{})});
function fixture(buttonMode=true){return {version:4,bodies:[{childs:[{...part('sensor',{x:0,y:0,z:0}),controller:{id:1,range:4,buttonMode,controllers:[{id:2}]}},{...part('lamp',{x:3,y:0,z:0}),controller:{id:2}}]},{childs:[part('block',{x:0,y:0,z:3})]}]};}
test('automatic sensor drives a connected light; range, orientation and nearest color occlusion',()=>{const bp=fixture(),before=structuredClone(bp),p=new MotionPreview(bp,defs,{logicMode:'clocked'});let r=p.step(.05);assert.equal(r.states[1],true);assert.equal(r.states[2],true);assert.equal(r.sensors[1].hit.index,2);assert.deepEqual(bp,before);
 bp.bodies[0].childs[0].controller.range=1;assert.equal(p.step(.05).states[1],false);
 bp.bodies[0].childs[0].controller.range=4;bp.bodies[0].childs[0].controller.colorMode=true;bp.bodies[0].childs[0].controller.color='00ff00';assert.equal(p.step(.05).states[1],false);
 bp.bodies[1].childs[0].color='00ff00';assert.equal(p.step(.05).states[1],true);
 bp.bodies[0].childs[0].zaxis=-3;assert.equal(p.step(.05).states[1],false);
});
test('switch sensor toggles once per entry, retains state on exit, manual input takes priority',()=>{const p=new MotionPreview(fixture(false),defs,{logicMode:'clocked'});let target=new Matrix4();p.sensorMatrices=()=>[new Matrix4(),target];assert.equal(p.step(.05).states[1],true);assert.equal(p.step(.5).states[1],true);target.makeTranslation(5,0,0);assert.equal(p.step(.05).states[1],true);target.identity();assert.equal(p.step(.05).states[1],false);p.setInput(1,true);assert.equal(p.step(.05).states[1],true);});
test('button sensor releases when a moving target leaves its ray',()=>{const p=new MotionPreview(fixture(),defs);let target=new Matrix4();p.sensorMatrices=()=>[new Matrix4(),target];assert.equal(p.step(0).states[1],true);target.makeTranslation(5,0,0);assert.equal(p.step(.1).states[1],false);});
test('physics sensors follow actual rigid-body poses instead of rest geometry',async()=>{await initPhysics();const bp=fixture(),before=structuredClone(bp),p=new PhysicsPreview(bp,defs,{ground:false,gravity:[0,0,0],fixedBody:0});try{assert.equal(p.step(.05).states[1],true);const target=p.bodies[p.islands.primary[1]];target.setTranslation({x:5,y:0,z:1},true);assert.equal(p.step(.05).states[1],false);assert.deepEqual(bp,before);}finally{p.dispose();}});

test('a nearer nonmatching surface hides a matching painted target',()=>{const bp=fixture();bp.bodies[0].childs[0].controller.colorMode=true;bp.bodies[0].childs[0].controller.color='ff0000';bp.bodies.push({childs:[part('block',{x:0,y:0,z:2},'00ff00')]});const p=new MotionPreview(bp,defs);const r=p.step(0);assert.equal(r.states[1],false);assert.equal(r.sensors[1].hit.index,3);});
