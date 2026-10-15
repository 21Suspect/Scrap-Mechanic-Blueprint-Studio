import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {catalog,readJSON,blueprintPath,assetPath} from '../lib/assets.mjs';
import {ROTATIONS,rotate,inverse,dot,cross,jointOrigin,scale,jointAnchor} from '../lib/geometry.mjs';
import {validate} from '../lib/validate.mjs';
import {BlueprintBuilder} from '../lib/builder.mjs';
import {parseOgre} from '../public/ogre.js';
import {transformBlueprint} from '../lib/transform.mjs';
const metal='8aedf6c2-94e1-4506-89d4-a0227c552f1e',bearing='4a1b886b-913e-4aad-b5b6-6e41b0db23a6';
function assembly(r,joint=bearing){const b=new BlueprintBuilder(),d=catalog.get(joint),length=d.bearing?0:(d.spring||d.survivalSpring).length;
 const a=b.part(b.body(),metal,rotate(r.basis,[0,0,-1]),r),c=b.part(b.body(),metal,rotate(r.basis,[0,0,length]),r);
 const offset=jointOrigin({x:0,y:0,z:0},r.xaxis,r.zaxis);b.joint(a,c,joint,scale(offset,-1),r);return b.build();}
test('24 unique proper orthonormal rotations, exact inverse, no reflections',()=>{assert.equal(ROTATIONS.length,24);assert.equal(new Set(ROTATIONS.map(r=>JSON.stringify(r.basis))).size,24);for(const r of ROTATIONS){assert.equal(dot(cross(r.basis[0],r.basis[1]),r.basis[2]),1);assert.deepEqual(inverse(r.basis,rotate(r.basis,[3,-7,11])),[3,-7,11]);}});
for(const r of ROTATIONS)test(`bearing and suspension attachment at x=${r.xaxis}, z=${r.zaxis}`,()=>{
 for(const joint of [bearing,'52855106-a95c-4427-9970-3f227109b66d']){const bp=assembly(r,joint),v=validate(bp,catalog);assert.equal(v.ok,true,JSON.stringify(v.errors));const j=bp.joints[0];assert.deepEqual(jointAnchor(j,'A'),rotate(r.basis,[.5,.5,0]));const broken=structuredClone(bp);broken.joints[0].posA.x+=3;assert.equal(validate(broken,catalog).ok,false);}
});
test('user mini jeep: 153 shapes, all 12 joints, all 11 connections',()=>{const bp=readJSON(blueprintPath('92fd9cee-1e3d-4610-8031-2e11e2347af9')),r=validate(bp,catalog);assert.equal(r.ok,true,JSON.stringify(r.errors));assert.deepEqual(r.stats,{bodies:13,shapes:153,joints:12,controllers:10,connections:11});assert.equal(r.engineVerified,false);});
test('reject missing references, bad axes, stale indices, same-body joints and colors',()=>{for(const mutate of [bp=>bp.bodies[0].childs[0].joints=[],bp=>bp.bodies[0].childs[0].xaxis=3,bp=>bp.joints[0].childB=99,bp=>{bp.bodies[0].childs.push(...bp.bodies[1].childs);bp.bodies.pop();},bp=>bp.bodies[0].childs[0].color='red']){const bp=assembly(ROTATIONS.find(r=>r.xaxis===1&&r.zaxis===3));mutate(bp);assert.equal(validate(bp,catalog).ok,false);}});
test('reject dangling and duplicate controller ids',()=>{const bp=assembly(ROTATIONS[0]);bp.bodies[0].childs[0].controller={id:5,controllers:[{id:999}]};assert.equal(validate(bp,catalog).ok,false);bp.bodies[1].childs[0].controller={id:5};assert.equal(validate(bp,catalog).ok,false);});
test('game asset paths cannot escape their roots',()=>{assert.throws(()=>assetPath('$GAME_DATA/../../outside'));assert.throws(()=>assetPath('C:/Windows/file'));});
test('OGRE license plate: original mesh, including exporter length discrepancy',()=>{const b=fs.readFileSync(assetPath('$SURVIVAL_DATA/Objects/Mesh/vehicle/obj_vehicle_license_plate.mesh'));const g=parseOgre(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));assert.equal(g.children[0].geometry.attributes.position.count,516);assert.equal(g.children[0].geometry.index.count,516);});
test('25,000 blocks have no artificial part-count cutoff',()=>{const bp={version:4,bodies:[{childs:Array.from({length:25000},(_,i)=>({shapeId:metal,color:'DF7F01',pos:{x:i,y:0,z:0},bounds:{x:1,y:1,z:1},xaxis:1,zaxis:3}))}],joints:[]};assert.equal(validate(bp,catalog).ok,true);});
test('rotate full mini jeep through all 24 orientations with negative translation',()=>{const bp=readJSON(blueprintPath('92fd9cee-1e3d-4610-8031-2e11e2347af9'));for(const r of ROTATIONS){const v=validate(transformBlueprint(bp,{...r,translation:[-137,25,-64]}),catalog);assert.equal(v.ok,true,JSON.stringify(v.errors));}});
test('malformed JSON structures return diagnostics instead of throwing',()=>{for(const bp of [null,{}, {version:4,bodies:[null]}, {version:4,bodies:[{childs:[null]}]}, {version:4,bodies:[],joints:[null]}, {version:4,bodies:[{childs:[{controller:{controllers:{}}}]}]}])assert.equal(validate(bp,catalog).ok,false);});
