import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {catalog,readJSON,blueprintPath} from '../lib/assets.mjs';
import {enrichEngineAssets} from '../lib/engine-assets.mjs';
import {enrichMassAssets} from '../lib/mass-assets.mjs';
import {initPhysics,PhysicsPreview} from '../lib/physics.mjs';
import {validate} from '../lib/validate.mjs';
import {collisionSolid} from '../lib/collision-geometry.mjs';
import {driveCar} from './fixtures/drive-car.mjs';
import {MotionPreview} from '../lib/simulation.mjs';
import {shapeCenter} from '../lib/geometry.mjs';
enrichEngineAssets(catalog);enrichMassAssets(catalog);await initPhysics();

for(const [type,id,gear]of [['gas','3091926a-9340-46d9-83d6-4fd7c68ad950',2],['electric','22f3e797-82f5-4819-a085-c3cc28ec9025',4]]){
 test(`${type} engine propels a valid four-wheel car through ground contact, in both directions`,()=>{
  const {blueprint:bp,engineId}=driveCar(id,gear),before=structuredClone(bp);
  const validation=validate(bp,catalog);assert.deepEqual(validation.errors,[]);assert.deepEqual(validation.attachments.disconnected,[]);
  for(const power of [0,1,-1]){const p=new PhysicsPreview(bp,catalog);
   try{assert.equal(p.bodies.length,5);p.setEngine(engineId,{power});const r=p.step(2),dy=r.bodies[0].positionMeters[1]-1.5;
    if(power===0)assert.ok(Math.abs(dy)<.02,'engine off must not drive');
    else{assert.ok(dy*power > .5,'chassis must translate in the commanded direction');assert.ok(r.bodies[0].velocityMetersPerSecond[1]*power > .3);}
    assert.equal(r.engines[engineId].physicsTorqueLimitNm,r.engines[engineId].nativeMaxImpulse*40);
    assert.equal(r.engineVerified,false);
   }finally{p.dispose();}
  }
  assert.deepEqual(bp,before);
 });
}

test('airborne wheel motors conserve linear momentum instead of applying fake chassis thrust',()=>{
 const {blueprint,engineId}=driveCar(),p=new PhysicsPreview(blueprint,catalog,{ground:false,gravity:[0,0,0]});
 try{p.setEngine(engineId,{power:1});p.step(1);
  const momentum=p.bodies.reduce((v,rb)=>v.addScaledVector(new Vector3().copy(rb.linvel()),rb.mass()),new Vector3());
  assert.ok(momentum.length()<.1);assert.ok(Math.abs(p.snapshot().engines[engineId].actualRpm[2])>100);
 }finally{p.dispose();}
});

test('Jeeep drives forward and backward with its original engines, joints, and suspension',{skip:!fs.existsSync(blueprintPath('33d1e5b1-9042-49af-b3b4-463f3ae739e6'))},()=>{
 const bp=readJSON(blueprintPath('33d1e5b1-9042-49af-b3b4-463f3ae739e6')),before=structuredClone(bp);
 const idle=new PhysicsPreview(bp,catalog);
 try{assert.equal(idle.snapshot().engines[5].powered,false);assert.equal(idle.snapshot().engines[10].powered,false);}finally{idle.dispose();}
 for(const power of [0,1,-1]){const p=new PhysicsPreview(bp,catalog);
  try{for(const id of [5,10])p.setEngine(id,{power});const start=p.snapshot().bodies[0].positionMeters;const r=p.step(2),dx=r.bodies[0].positionMeters[0]-start[0];
   // User's native Jeeep reference: forward is toward its nose, world -X.
   if(power===0)assert.ok(Math.abs(dx)<.1);else assert.ok(dx*power < -2,`Jeeep must travel toward its nose, got ${dx} m at power ${power}`);
   assert.ok(r.bodyMatrices.flat().every(Number.isFinite));
  }finally{p.dispose();}
 }
 assert.deepEqual(bp,before);
});

test('Jeeep wheel tread moves opposite the forward chassis direction in Mechanisms mode',{skip:!fs.existsSync(blueprintPath('33d1e5b1-9042-49af-b3b4-463f3ae739e6'))},()=>{
 const bp=readJSON(blueprintPath('33d1e5b1-9042-49af-b3b4-463f3ae739e6')),before=structuredClone(bp);
 for(const power of [1,-1]){
  const p=new MotionPreview(bp,catalog);for(const id of [5,10])p.setEngine(id,{power});p.step(.001);
  for(const id of [8,10,14,16]){
   const j=bp.joints.find(j=>j.id===id),wheel=p.flat[j.childB],center=shapeCenter(wheel,catalog.get(wheel.shapeId));
   const bottom=new Vector3(center[0],center[1],center[2]-1.5),moved=bottom.clone().applyMatrix4(p.matrices[p.bodyOf[j.childB]]);
   assert.ok((moved.x-bottom.x)*power>0,'bottom tread must move +X when the chassis drives -X');
  }
 }
 assert.deepEqual(bp,before);
});

test('flat native screw collision surfaces and native staircase wedges do not become solid cubes',()=>{
 const screw=catalog.get('c5e56da5-bc3f-4519-91c2-b307d36e15aa');
 assert.equal(screw.collisionHull.surfaceThicknessBlocks,.004);
 const ys=screw.collisionHull.vertices.map(p=>p[1]);assert.ok(Math.max(...ys)-Math.min(...ys)<.005);
 const wedge=catalog.get('e02620a5-371b-4d63-be35-fd8a0552eba9');
 const solid=collisionSolid({pos:{x:0,y:0,z:0},xaxis:1,zaxis:3},wedge);
 assert.equal(solid.method,'native wedge');assert.equal(solid.vertices.length,6);
});
