import {driverSeats,driverCommand} from './driving.mjs';
import {physicsIslands} from './physics-islands.mjs';
import RAPIER from '@dimforge/rapier3d-compat';
import {Matrix4,Quaternion,Vector3} from 'three';
import {MotionPreview} from './simulation.mjs';
import {collisionSolid} from './collision-geometry.mjs';
import {shapeMass,measurementKey} from './mass.mjs';
import {axis,jointAnchor,jointOrigin,shapeCenter,basis,rotate,dimensions,sub,dot,obj,scale} from './geometry.mjs';
import {isPiston,pistonRestExtension} from './pistons.mjs';
import {isThruster,thrusterSetting} from './thrusters.mjs';

let initialized;
export const initPhysics=()=>initialized??=(RAPIER.init().then(()=>true));
const M=.25,H=1/120,identity={x:0,y:0,z:0,w:1};
// Native setMotorVelocity takes a maximum angular impulse, not torque.
// Convert a 40 Hz native tick budget into continuous torque for 120 Hz steps.
// The SI interpretation remains an estimate until measured in the game.
const ENGINE_HZ=40,MOTOR_SPEED_TOLERANCE=.1;
const v=a=>new Vector3(...a),array=p=>[p.x,p.y,p.z];
const transform=(p,rb)=>v(p).applyQuaternion(new Quaternion().copy(rb.rotation())).add(new Vector3().copy(rb.translation()));
// Reuse native signal/sequence interpretation without imposing its spanning-tree pose.
class Commands extends MotionPreview{pose(){}}

/** An independent, approximate SI rigid-body world. Never writes blueprint data. */
export class PhysicsPreview{
 constructor(bp,catalog,options={}){
  this.driverSeats=driverSeats(bp,catalog);this.driver=null;this.steeringTargets=new Map();this.originalBp=bp;this.islands=physicsIslands(bp,catalog,options.splitDisconnected!==false);bp=this.islands.blueprint;
  this.bp=bp;this.catalog=catalog;this.options=options;this.control=new Commands(bp,catalog,{logicMode:options.logicMode??'clocked'});
  for(const key of ['controllerTorque','steeringTorque','pistonForce','suspensionStrength'])if(options[key]!==undefined&&(!Number.isFinite(options[key])||options[key]<0))throw Error(key+' must be finite and nonnegative');
  for(const value of Object.values(options.thrusterForces||{}))if(!Number.isFinite(value)||value<0)throw Error('Thruster forces must be finite and nonnegative');
  this.warnings=new Set();this.elapsed=0;this.remainder=0;this.joints=[];this.thrusters=new Map();this.suspensions=new Map();
  const gravity=options.gravity??[0,0,-9.81];
  if(!Array.isArray(gravity)||gravity.length!==3||!gravity.every(Number.isFinite))throw Error('Gravity must be three finite metres/second² values');
  if(options.fixedBody!==undefined&&(!Number.isInteger(options.fixedBody)||options.fixedBody < -1||options.fixedBody>=this.originalBp.bodies.length))throw Error('Invalid fixed body');
  this.world=new RAPIER.World(obj(gravity));this.world.timestep=H;this.world.numSolverIterations=12;
  this.origins=bp.bodies.map(b=>b.childs.length?shapeCenter(b.childs[0],this.def(b.childs[0].shapeId)):[0,0,0]);
  let floor=Infinity,unknownMass=0,approximateColliders=0;
  this.bodies=bp.bodies.map((body,i)=>{
   const origin=this.origins[i],desc=i===this.islands.primary[options.fixedBody]?RAPIER.RigidBodyDesc.fixed():RAPIER.RigidBodyDesc.dynamic();
   const rb=this.world.createRigidBody(desc.setTranslation(...scale(origin,M)).setCcdEnabled(true));
   for(const s of body.childs){
    const d=this.def(s.shapeId),solid=collisionSolid(s,d),mass=shapeMass(s,d,options.measurements?.[measurementKey(s)]);if(!mass)unknownMass++;
    if(solid.approximate&&!d?.cylinder)approximateColliders++;
    for(const p of solid.vertices)floor=Math.min(floor,p[2]*M);
    const vertices=solid.vertices.flatMap(p=>scale(sub(p,origin),M));
    let collider;
    if(d?.cylinder){
     const center=scale(sub(shapeCenter(s,d),origin),M),localAxis=rotate(basis(s.xaxis,s.zaxis),axis('XYZ'.indexOf(d.cylinder.axis)+1)),rotation=new Quaternion().setFromUnitVectors(new Vector3(0,1,0),v(localAxis));
     collider=RAPIER.ColliderDesc.cylinder(d.cylinder.depth*M/2,d.cylinder.diameter*M/2).setTranslation(...center).setRotation(rotation);
    }else if(solid.method==='native box'){
     const lo=[0,1,2].map(k=>Math.min(...solid.vertices.map(p=>p[k]))),hi=[0,1,2].map(k=>Math.max(...solid.vertices.map(p=>p[k])));
     collider=RAPIER.ColliderDesc.cuboid(...hi.map((x,k)=>(x-lo[k])*M/2)).setTranslation(...hi.map((x,k)=>((x+lo[k])/2-origin[k])*M));
    }else collider=RAPIER.ColliderDesc.convexHull(new Float32Array(vertices));
    if(!collider)throw Error('Could not construct collision hull for '+s.shapeId);
    // Ratings-to-friction conversion is deliberately reported as an assumption.
    collider.setMass(mass?.massKg??1).setFriction(Math.max(.05,(d?.ratings?.friction??3)/5)).setRestitution(0);
    this.world.createCollider(collider,rb);
   }
   return rb;
  });
  this.warnings.add('Mass density ratings, friction, motor force units and damping are estimates, not calibrated native physics. Joint mass uses native density and collision volume; cargo, fuel and player mass still require measurements.');
  if(this.islands.extraBodies)this.warnings.add(`${this.islands.extraBodies} disconnected attachment islands were split into independent rigid bodies. Curved/hull weld contacts remain approximate.`);
  if(unknownMass)this.warnings.add(`${unknownMass} parts lack density metadata and use 1 kg each.`);
  if(approximateColliders)this.warnings.add(`${approximateColliders} collision shapes use approximate convex geometry.`);
  if(options.ground!==false&&Number.isFinite(floor)){
   const z=options.groundZ===undefined?floor:options.groundZ*M;if(!Number.isFinite(z))throw Error('Ground height must be finite');
   // A half-space avoids introducing a finite floor boundary for large creations.
   this.world.createCollider(new RAPIER.ColliderDesc(new RAPIER.HalfSpace({x:0,y:0,z:1})).setTranslation(0,0,z).setFriction(.8));
  }
  for(const j of bp.joints||[])this.addJoint(j);
  this.fragmentMatrices=bp.bodies.map(()=>new Matrix4());this.matrices=this.islands.primary.map(i=>this.fragmentMatrices[i]);this.partMatrices=this.islands.partFragments.map(i=>this.fragmentMatrices[i]);this.control.sensorMatrices=()=>{this.updatePose();return this.fragmentMatrices;};this.step(0);
 }
 def(id){return this.catalog instanceof Map?this.catalog.get(id):this.catalog[id];}
 get states(){return this.control.states;} get engines(){return this.control.engines;}
 get angles(){return this.control.angles;} get jointSpeeds(){return this.control.jointSpeeds;}
 get pistons(){return this.control.pistons;}
 setInput(id,on){this.control.setInput(id,on);return this.snapshot();}
 setEngine(id,drive){this.control.setEngine(id,drive);return this.snapshot();}
 setDriver(value={}){
  if(this.driverSeats.length!==1)throw Error('WASD driving requires exactly one driver seat or saddle');
  const command=driverCommand(value),seat=this.driverSeats[0];this.driver={id:seat.controller.id,...command};
  this.control.inputs.set(seat.controller.id,true);
  this.control.seatPower=new Map([[seat.controller.id,command.throttle]]);
  // Keyboard ownership clears temporary motor overrides, never saved settings.
  for(const link of seat.controller.controllers||[]){this.control.engineDrives.delete(link.id);this.control.inputs.delete(link.id);}
  return this.snapshot();
 }
 addJoint(j){
  const a=this.control.bodyOf[j.childA],b=this.control.bodyOf[j.childB],d=this.def(j.shapeId)||{};
  if(a===undefined||b===undefined||a===b)throw Error('Invalid physics joint endpoints: '+j.id);
  const A=jointAnchor(j,'A'),B=jointAnchor(j,'B'),n=axis(j.zaxisA),span=dot(sub(B,A),n);
  const anchorA=scale(sub(A,this.origins[a]),M),anchorB=scale(sub(B,this.origins[b]),M);
  const spring=d.spring||d.survivalSpring,piston=isPiston(d),bearing=!!d.bearing;
  let data;
  if(bearing)data=RAPIER.JointData.revolute(obj(anchorA),obj(anchorB),obj(n));
  else if(spring||piston){
   const guideB=sub(anchorB,scale(n,span*M));
   data=spring?.bearing?RAPIER.JointData.generic(obj(anchorA),obj(guideB),obj(n),2|4|16|32):RAPIER.JointData.prismatic(obj(anchorA),obj(guideB),obj(n));
  }else{
   this.warnings.add('Unsupported joint '+j.shapeId+' is held at its initial relative pose.');
   data=RAPIER.JointData.fixed(obj(anchorA),identity,obj(scale(sub(A,this.origins[b]),M)),identity);
  }
  // A collision-disabled mass shape contributes the joint's native density,
  // position and inertia to endpoint A. Physical rods are still not colliders.
  const jointShape={...j,pos:obj(jointOrigin(j.posA,j.xaxisA,j.zaxisA)),xaxis:j.xaxisA,zaxis:j.zaxisA},mass=shapeMass(jointShape,d);
  if(mass){const size=dimensions(jointShape,d),center=scale(sub(shapeCenter(jointShape,d),this.origins[a]),M),rotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(...basis(j.xaxisA,j.zaxisA).map(v)));
   this.world.createCollider(RAPIER.ColliderDesc.cuboid(...size.map(x=>x*M/2)).setTranslation(...center).setRotation(rotation).setMass(mass.massKg).setCollisionGroups(0),this.bodies[a]);}
  const joint=this.world.createImpulseJoint(data,this.bodies[a],this.bodies[b],true);joint.setContactsEnabled(true);
  const entry={j,a,b,n,anchorA,anchorB,span,joint,spring,piston,bearing,angle:0,previous:0,speed:0};
  if(spring){
   const table=d.spring?.stiffnessLevels||[0,7500,20000,37500,60000,87500,120000,157500,200000,247500,300000,357500,420000,487500,560000,637500,720000,807500,900000,997500];
   const level=this.options.suspensionLevels?.[j.id]??j.controller?.stiffnessLevel??d.spring?.defaultStiffnessLevel??2;
   const stiffness=table[level]?.stiffness??table[level];
   if(!Number.isInteger(level)||!Number.isFinite(stiffness)||stiffness<0)throw Error('Invalid suspension preview stiffness level');
   entry.nativeStiffness=stiffness;entry.strength=this.options.suspensionStrength??2;entry.stiffness=stiffness*entry.strength;entry.travel=Math.max(0,(spring.length-1)*M);
   if(!spring.bearing)joint.setLimits(-entry.travel,0);
   this.warnings.add('Suspension uses the creative stiffness table with an adjustable preview strength multiplier (default 2), estimated damping/travel and unverified SI units. Survival force and native load/compression still need calibration. Saved levels are unchanged.');
  }
  if(joint.configureMotorModel)joint.configureMotorModel(RAPIER.MotorModel.ForceBased);
  this.joints.push(entry);
 }
 step(dt){
  if(!Number.isFinite(dt)||dt<0)throw Error('Physics time must be finite and nonnegative');
  this.remainder+=dt;
  if(dt===0)this.control.step(0);
  while(this.remainder+1e-10>=H){this.control.step(H);this.forces();this.world.step();this.elapsed+=H;this.remainder=Math.max(0,this.remainder-H);this.measure();}
  this.updatePose();return this.snapshot();
 }
 forces(){
  for(const rb of this.bodies){rb.resetForces(true);rb.resetTorques(true);}
  if(this.driver){const seat=this.driverSeats[0],steer=this.driver.steering;
   for(const link of seat.controller.joints||[]){const e=this.joints.find(e=>e.j.id===link.id);if(!e?.bearing)continue;
    const settings=seat.controller.steering?.find(r=>r.id===link.id)||{},side=steer<0?'left':'right',limit=settings[side+'AngleLimit']??27;
    const target=steer*limit*(link.reverse?1:-1),previous=this.steeringTargets.get(link.id)??0;
    const nativeDelta=(target-previous)*(link.reverse?1:-1);
    const speed=settings[(nativeDelta<0?'left':'right')+'AngleSpeed']??4.244132;
    const next=previous+Math.sign(target-previous)*Math.min(Math.abs(target-previous),speed*180/Math.PI*H);
    this.steeringTargets.set(link.id,next);this.control.angles.set(link.id,next);
   }
  }
  for(const e of this.joints){
   const {joint,j,a,b,n,anchorA,anchorB,spring}=e,ra=this.bodies[a],rb=this.bodies[b];
   if(e.bearing){
    if(this.jointSpeeds.has(j.id)){
     const engine=[...this.engines].find(([id])=>this.control.parts.get(id).controller.joints?.some(l=>l.id===j.id));
     const command=engine?.[1],impulse=command?.torqueLimit??0,torque=impulse*ENGINE_HZ;
     // ForceBased damping=1 restricted torque to speed error (in rad/s),
     // making a loaded car barely crawl irrespective of its selected gear.
     // A tight velocity servo requests the available budget; Rapier caps the
     // actual torque and ground contacts alone turn wheel motion into traction.
     joint.configureMotorVelocity(this.jointSpeeds.get(j.id),torque/MOTOR_SPEED_TOLERANCE);joint.setMotorMaxForce(torque);
     if(command){command.nativeMaxImpulse=impulse;command.physicsTorqueLimitNm=torque;command.assumedNativeTickHz=ENGINE_HZ;}
     this.warnings.add('Engine maxImpulse is converted to torque assuming 40 native ticks/second and SI angular impulse. Native units remain uncalibrated.');
    }else if(this.angles.has(j.id)){
     // Track unwrapped angle: 360° sequence steps must not become zero turns.
     const steering=this.driver&&this.steeringTargets.has(j.id);
     const torque=steering?(this.options.steeringTorque??25000):(this.options.controllerTorque??1000);
     e.motorTorqueLimitNm=torque;
     joint.configureMotorVelocity((this.angles.get(j.id)*Math.PI/180-e.angle)*12,torque/MOTOR_SPEED_TOLERANCE);joint.setMotorMaxForce(torque);
     this.warnings.add(steering?'Seat steering torque is a preview estimate (25000 N·m unless steeringTorque is supplied), tuned for stationary Jeeep steering; not a measured native force.':'Controller torque limit is estimated (1000 N·m unless overridden); loaded timing can differ from native.');
    }
   }else if(e.piston){
    const p=this.pistons.get(j.id);if(!p)continue;
    joint.setLimits(-p.restExtension*M,(p.maxExtension-p.restExtension)*M);
    joint.configureMotorPosition((p.extension-p.restExtension)*M,10000,1000);joint.setMotorMaxForce(this.options.pistonForce??10000);
    this.warnings.add('Piston force is estimated (10000 N unless overridden); native speed commands feed a force-limited servo.');
   }else if(spring){
    const pa=transform(anchorA,ra),pb=transform(anchorB,rb),normal=v(n).applyQuaternion(new Quaternion().copy(ra.rotation()));
    const travel=pb.clone().sub(pa).dot(normal)-e.span*M;
    const rel=new Vector3().copy(rb.velocityAtPoint(pb)).sub(new Vector3().copy(ra.velocityAtPoint(pa))).dot(normal);
    const inverseMass=(ra.isFixed()?0:1/ra.mass())+(rb.isFixed()?0:1/rb.mass());
    const reduced=inverseMass>0?1/inverseMass:0;
    const damping=2*.7*Math.sqrt(e.stiffness*reduced);
    if(!spring.bearing){
     // Let the constraint solver integrate stiff springs implicitly alongside
     // ground contacts and travel limits, rather than explicit force kicks.
     joint.configureMotorPosition(0,e.stiffness,damping);
     joint.setMotorMaxForce(Number.MAX_VALUE);
    }else{
     // Generic rotating guides do not expose an axial motor in this Rapier API.
     // Backward-Euler force regularization prevents explicit-spring blow-ups.
     const f=(-e.stiffness*(travel+H*rel)-damping*rel)/(1+H*(damping+H*e.stiffness)*inverseMass);
     rb.addForceAtPoint(normal.clone().multiplyScalar(f),pb,true);ra.addForceAtPoint(normal.multiplyScalar(-f),pa,true);
    }
    if(spring.bearing)this.warnings.add('Combined rotating suspension has a free axial bearing but no calibrated bump-stop response.');
   }
  }
  this.thrusters.clear();
  for(const [id,s]of this.control.parts){const d=this.def(s.shapeId);if(!isThruster(d))continue;
   const setting=thrusterSetting(s,d);if(!setting.supported){this.warnings.add(setting.reason);continue;}
   const body=this.control.bodyOf[this.control.flat.indexOf(s)],rb=this.bodies[body];if(!rb)continue;
   const estimate=[2222.22,3333.33,5000,7500,11250,16875,25312.5][setting.level];
   const force=this.options.thrusterForces?.[id]??setting.averageForce??(this.options.estimateSurvivalThrust?estimate:null);
   if(setting.averageForce===null&&this.options.estimateSurvivalThrust&&!this.options.thrusterForces?.[id])this.warnings.add('Survival thrust uses the CREATIVE force table as an explicit estimate, not the native survival force.');
   if(!Number.isFinite(force)){this.warnings.add('Survival thruster '+id+' has no exposed native force table. Supply thrusterForces[id] in newtons to test a measured force.');continue;}
   const seatParent=(this.control.parents.get(id)||[]).find(p=>this.control.seatPower?.has(p));
   const active=seatParent===undefined?!!this.states.get(id):this.control.seatPower.get(seatParent)>0,direction=v(axis(s.zaxis).map(x=>-x)).applyQuaternion(new Quaternion().copy(rb.rotation()));
   const point=transform(scale(sub(shapeCenter(s,d),this.origins[body]),M),rb);
   if(seatParent!==undefined)this.states.set(id,active);
   if(active)rb.addForceAtPoint(direction.clone().multiplyScalar(force),point,true);
   this.thrusters.set(id,{active,forceNewtons:active?force:0,worldDirection:direction.toArray(),source:this.options.thrusterForces?.[id]!==undefined?'user-supplied force':setting.averageForce===null?'creative-table estimate':setting.source});
   this.warnings.add('Thruster force acts opposite the installed +Z exhaust, along local -Z; SI units and steady average force are assumed; native forces still need calibration. Fuel and native force variation are not simulated.');
  }
 }
 measure(){
  for(const e of this.joints){
   const qa=new Quaternion().copy(this.bodies[e.a].rotation()),qb=new Quaternion().copy(this.bodies[e.b].rotation()),relative=qa.clone().invert().multiply(qb);
   const raw=2*Math.atan2(relative.x*e.n[0]+relative.y*e.n[1]+relative.z*e.n[2],relative.w);
   let delta=raw-e.previous;delta=Math.atan2(Math.sin(delta),Math.cos(delta));e.angle+=delta;e.previous=raw;e.speed=delta/H;
   const pa=transform(e.anchorA,this.bodies[e.a]),pb=transform(e.anchorB,this.bodies[e.b]),span=pb.sub(pa).dot(v(e.n).applyQuaternion(qa))/M;
   if(e.spring)this.suspensions.set(e.j.id,{spanBlocks:span,compressionBlocks:e.span-span,stiffness:e.stiffness,nativeStiffness:e.nativeStiffness,strengthMultiplier:e.strength});
   if(e.piston&&this.pistons.has(e.j.id))this.pistons.get(e.j.id).extension=Math.max(0,span-1);
  }
  for(const [id,engine]of this.engines){const links=this.control.parts.get(id).controller.joints||[];engine.actualRpm=Object.fromEntries(links.map(l=>[l.id,(this.joints.find(e=>e.j.id===l.id)?.speed??0)*60/(2*Math.PI)]));}
 }
 updatePose(){this.bodies.forEach((rb,i)=>this.fragmentMatrices[i].compose(new Vector3().copy(rb.translation()).multiplyScalar(1/M),new Quaternion().copy(rb.rotation()),new Vector3(1,1,1)).multiply(new Matrix4().makeTranslation(...this.origins[i].map(x=>-x))));}
 snapshot(){return {...this.control.snapshot(),driver:this.driver,driverAvailable:this.driverSeats.length===1,steeringTargets:Object.fromEntries(this.steeringTargets),physics:true,engine:'Rapier 0.21',engineVerified:false,approximate:true,time:this.elapsed,bodyMatrices:this.matrices?.map(m=>m.toArray())||[],partMatrices:this.partMatrices?.map(m=>m.toArray())||[],bodies:this.bodies?.map((rb,i)=>({body:i,sourceBody:this.islands.fragments[i].sourceBody,parts:this.islands.fragments[i].parts,massKg:rb.mass(),positionMeters:array(rb.translation()),velocityMetersPerSecond:array(rb.linvel()),angularVelocityRadPerSecond:array(rb.angvel())})),joints:this.joints.map(e=>({id:e.j.id,angleRadians:e.angle,actualRadPerSecond:e.speed,motorTorqueLimitNm:e.motorTorqueLimitNm})),suspensions:Object.fromEntries(this.suspensions),thrusters:Object.fromEntries(this.thrusters),warnings:[...this.control.warnings,...this.warnings],limitations:['Independent rigid-body approximation; not the Scrap Mechanic engine.','Logic uses a 40 Hz synchronous gate model; exact native scheduling is not verified.','Sensors detect creation geometry; no terrain/character detection, native Lua, buoyancy, aerodynamic lift, fuel consumption or tire model.','Attachment islands use sticky faces and collision bounds; curved weld contacts need native verification.','Native driving/flight, suspension tuning and stability still need a real game test.']};}
 dispose(){this.world.free();}
}

export async function simulatePhysics(bp,catalog,{time=2,inputs={},engines={},options={},events=[],driver}={}){
 if(!Number.isFinite(time)||time<0)throw Error('Time must be finite and nonnegative');
 await initPhysics();const p=new PhysicsPreview(bp,catalog,options);
 const apply=e=>{if(e.driver)p.setDriver(e.driver);for(const [id,on]of Object.entries(e.inputs||{}))p.setInput(Number(id),on);for(const [id,drive]of Object.entries(e.engines||{}))p.setEngine(Number(id),drive);};
 try{apply({inputs,engines,driver});let t=0;for(const e of [...events].sort((a,b)=>a.time-b.time)){if(!Number.isFinite(e.time)||e.time<t||e.time>time)throw Error('Event time must fall within simulation duration');p.step(e.time-t);t=e.time;apply(e);}p.step(time-t);return p.snapshot();}finally{p.dispose();}
}
