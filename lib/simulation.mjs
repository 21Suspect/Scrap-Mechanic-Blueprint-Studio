import {SensorPreview} from './sensors.mjs';
import {SignalClock} from './signal-clock.mjs';
import {Matrix4,Vector3} from 'three';
import {jointAnchor,axis} from './geometry.mjs';
import {engineSetting,isEngine} from './engines.mjs';
import {isPiston,pistonSetting,pistonRestExtension,sequenceEndFrame} from './pistons.mjs';
import {logicOutput} from './logic.mjs';
import {sequencePhase,bearingFrameAngle,pistonFrameLength} from './sequences.mjs';
// Calibrated against the user's native switch → sequence → bearing test:
// sequence target angles use clockwise rotation around endpoint A's +Z.
// Three.js and Rapier use the right-hand convention. The user's native engine
// test also establishes clockwise positive drive about endpoint A's +Z.
export const sequenceRotationSign=reverse=>reverse?1:-1;
export const engineRotationSign=reverse=>reverse?1:-1;
export class MotionPreview{
 constructor(bp,catalog,options={}){this.logicMode=options.logicMode??'settled';if(!['clocked','settled'].includes(this.logicMode))throw Error('Unknown logic mode');this.bp=bp;this.catalog=catalog;this.flat=bp.bodies.flatMap(b=>b.childs);this.parts=new Map([...this.flat,...(bp.joints||[])].filter(s=>s.controller).map(s=>[s.controller.id,s]));this.parents=new Map();for(const [id,s]of this.parts)for(const link of s.controller.controllers||[]){if(!this.parents.has(link.id))this.parents.set(link.id,[]);this.parents.get(link.id).push(id);}this.inputs=new Map();this.states=new Map();this.progress=new Map();this.timerHistory=new Map();this.angles=new Map();this.engineDrives=new Map();this.enginePower=new Map();this.engineAngles=new Map();this.engines=new Map();this.jointSpeeds=new Map();this.lengthTargets=new Map();this.pistonLengths=new Map();this.pistons=new Map();this.time=0;this.warnings=new Set();this.bodyOf=[];bp.bodies.forEach((b,bi)=>b.childs.forEach(()=>this.bodyOf.push(bi)));this.reset();}
 def(id){return this.catalog instanceof Map?this.catalog.get(id):this.catalog[id];}
 reset(){this.sensors=new SensorPreview(this);this.signalClock=new SignalClock(this);this.logicRemainder=0;this.time=0;this.states.clear();this.progress.clear();this.timerHistory.clear();this.angles.clear();this.enginePower.clear();this.engineAngles.clear();this.engines.clear();this.jointSpeeds.clear();this.lengthTargets.clear();this.pistons.clear();this.pistonLengths=new Map((this.bp.joints||[]).filter(j=>isPiston(this.def(j.shapeId))).map(j=>[j.id,pistonRestExtension(j)]));this.warnings.clear();for(const [id,s]of this.parts)this.states.set(id,!!s.controller.active);this.matrices=this.bp.bodies.map(()=>new Matrix4());return this.snapshot();}
 setInput(id,value){if(!this.parts.has(id))throw Error('Unknown controller input');if(value===null)this.inputs.delete(id);else this.inputs.set(id,!!value);return this.snapshot();}
 setEngine(id,drive){const s=this.parts.get(id),d=s&&this.def(s.shapeId);if(!s||!isEngine(d))throw Error('Choose a gas/electric engine');const next={...this.engineDrives.get(id),...drive};if(next.power!==undefined&&(!Number.isFinite(next.power)||Math.abs(next.power)>1))throw Error('Engine power must be −1 to 1');if(next.gear!==undefined){const setting=engineSetting(s,d,next.gear);if(!Number.isInteger(next.gear)||!setting.supported)throw Error(setting.reason||'Invalid gear');}this.engineDrives.set(id,next);return this.snapshot();}
 toggle(id){this.setInput(id,!(this.inputs.get(id)??this.states.get(id)));return this.inputs.get(id);}
 step(dt){
 if(this.logicMode!=='clocked')return this.stepSlice(dt);
 if(!Number.isFinite(dt)||dt<0||dt>10)throw Error('Preview step must be between 0 and 10 seconds.');
 this.signalClock.inputs();let left=dt;
 while(left>1e-10){const slice=Math.min(left,.025-this.logicRemainder);this.stepSlice(slice);this.logicRemainder+=slice;left-=slice;if(this.logicRemainder>=.025-1e-10){this.signalClock.advance();this.logicRemainder=0;}}
 this.stepSlice(0);return this.snapshot();
 }
 stepSlice(dt){if(!Number.isFinite(dt)||dt<0||dt>10)throw Error('Preview step must be between 0 and 10 seconds.');this.time+=dt;this.sensors.update();
 if(this.logicMode!=='clocked'){let stable=false;for(let pass=0;pass<this.parts.size+2;pass++){let changed=false;const next=new Map(this.states);for(const [id,s]of this.parts){const d=this.def(s.shapeId)||{},c=s.controller,parents=this.parents.get(id)||[],values=parents.map(p=>!!this.states.get(p)),any=values.some(Boolean);let active;
  if(this.inputs.has(id))active=this.inputs.get(id);
  else if(d.logic){active=logicOutput(c.mode??0,values);if(!parents.length)this.warnings.add('Unconnected logic gates use the installed truth-rule descriptions; verify empty-input behavior in game.');}
  else if(d.timer){const delay=(c.seconds||0)+(c.ticks||0)/40;const history=this.timerHistory.get(id)||[];if(!history.length||history.at(-1).value!==any)history.push({time:this.time,value:any});while(history.length>1&&history[1].time<=this.time-delay)history.shift();this.timerHistory.set(id,history);active=history[0]?.time<=this.time-delay?history[0].value:false;}
  else if(d.sensor||d.survivalSensor)active=this.sensors.readings.get(id)?.active??false;
  else if(d.lever||d.button)active=!!c.active;
  else if(d.spotlight||d.pointlight)active=parents.length?any:true;
  else active=parents.length?any:!!c.active;
  if(d.scripted&&c.data)this.warnings.add('Opaque scripted controller storage is preserved; its Lua behavior is not executed.');
  next.set(id,active);changed||=active!==this.states.get(id);
 }this.states=next;if(!changed){stable=true;break;}}
 if(!stable)this.warnings.add('Logic feedback did not settle; combinational loops need native-game testing.');}
 this.angles.clear();this.lengthTargets.clear();for(const [id,s]of this.parts){const d=this.def(s.shapeId)||{},c=s.controller;if(!d.sequence&&!d.survivalSequence)continue;const active=!!this.states.get(id),duration=Math.max(.001,c.timePerFrame||1);let progress=this.progress.get(id)||0;const end=sequenceEndFrame(c);progress=Math.max(0,progress+(active?1:-1)*dt/duration);if(c.playMode!==2)progress=Math.min(progress,end);this.progress.set(id,progress);
  if(c.playMode!==undefined&&c.playMode!==0&&c.playMode!==2)this.warnings.add('Unknown native controller play mode; preview uses a single sequence.');
  const phase=sequencePhase(progress,end,c.playMode);
  for(const link of c.joints||[]){const angle=bearingFrameAngle(link,phase);if(this.angles.has(link.id))this.warnings.add('Multiple controllers drive the same joint; preview uses the last drive.');this.angles.set(link.id,angle===0?0:angle*sequenceRotationSign(link.reverse));}
  for(const link of c.controllers||[]){const target=this.parts.get(link.id),joint=(this.bp.joints||[]).find(j=>j.controller?.id===link.id);if(!joint||!isPiston(this.def(target?.shapeId))||!link.frames?.length)continue;this.lengthTargets.set(joint.id,pistonFrameLength(link,phase));}
 }
 this.driveEngines(dt);this.drivePistons(dt);this.pose();return this.snapshot();
 }
 driveEngines(dt){this.engines.clear();this.jointSpeeds.clear();for(const [id,s]of this.parts){const d=this.def(s.shapeId);if(!isEngine(d))continue;const override=this.engineDrives.get(id)||{},setting=engineSetting(s,d,override.gear);if(!setting.supported){this.warnings.add(setting.reason);continue;}let power=1;const parents=(this.parents.get(id)||[]).filter(id=>this.def(this.parts.get(id)?.shapeId)?.connection?.output?.some(t=>t==='logic'||t==='power'));for(const parent of parents){const p=this.parts.get(parent),pd=this.def(p.shapeId);power=pd.connection.output.includes('power')?(this.seatPower?.get(parent)??(this.states.get(parent)?1:0)):(this.states.get(parent)?1:0);}if(this.inputs.has(id))power=this.inputs.get(id)?1:0;if(override.power!==undefined)power=override.power;
  const previous=this.enginePower.get(id)||0,ramp=setting.rampPerSecond,step=ramp*dt;const current=setting.type==='electric'&&step>0?previous+Math.sign(power-previous)*Math.min(Math.abs(power-previous),step):setting.type==='electric'&&dt===0?previous:power;this.enginePower.set(id,current);const rampTime=ramp?Math.min(dt,Math.abs(power-previous)/ramp):0,integratedPower=setting.type==='electric'&&ramp?(previous+current)*rampTime/2+current*(dt-rampTime):current*dt;const velocity=setting.targetRadPerSecond*current,enabled=setting.torqueLimit>0&&setting.targetRadPerSecond!==0;this.engines.set(id,{...setting,power:current,direction:power,rpm:velocity*60/(2*Math.PI),powered:enabled&&current!==0});
  if(!setting.verifiedUnits)this.warnings.add('Legacy shape-defined engine speeds assume degrees/second; verify conversion in game.');
  for(const link of s.controller.joints||[]){const j=this.bp.joints?.find(j=>j.id===link.id);if(!j||!this.def(j.shapeId)?.bearing||link.enabled===false)continue;if(this.jointSpeeds.has(j.id)){this.warnings.add('Multiple engines drive one bearing; native physics must resolve the conflict.');continue;}const sign=engineRotationSign(link.reverse),speed=enabled?velocity*sign:0,angle=(this.engineAngles.get(j.id)||0)+(enabled?setting.targetRadPerSecond*integratedPower*sign*180/Math.PI:0);this.engineAngles.set(j.id,angle);if(this.angles.has(j.id))this.warnings.add('An engine and controller drive the same joint; native physics must resolve the conflict.');this.angles.set(j.id,angle);this.jointSpeeds.set(j.id,speed);}
 }}
 drivePistons(dt){this.pistons.clear();for(const j of this.bp.joints||[]){const d=this.def(j.shapeId);if(!isPiston(d))continue;const setting=pistonSetting(j,d);if(!setting.supported){this.warnings.add(setting.reason);continue;}const requested=this.lengthTargets.get(j.id)??(this.states.get(j.controller?.id)?setting.range:0),target=Math.max(0,Math.min(setting.maxExtension,requested));if(target!==requested)this.warnings.add('Piston controller target exceeds native travel; preview clamps it.');const previous=this.pistonLengths.get(j.id)??setting.restExtension,extension=previous+Math.sign(target-previous)*Math.min(Math.abs(target-previous),setting.speedBlocksPerSecond*dt);this.pistonLengths.set(j.id,extension);this.pistons.set(j.id,{...setting,controller:j.controller?.id,targetExtension:target,extension});if(!setting.speedUnitsVerified)this.warnings.add('Piston travel is kinematic; speed uses the native table as blocks/second. Verify survival timing and loads in game.');}}
 pose(){
  const edges=this.bp.bodies.map(()=>[]);
  for(const j of this.bp.joints||[]){const a=this.bodyOf[j.childA],b=this.bodyOf[j.childB];if(a===undefined||b===undefined||a===b)continue;edges[a].push({j,to:b,forward:true});edges[b].push({j,to:a,forward:false});}
  const visited=new Set(),used=new Set();this.matrices=this.bp.bodies.map(()=>new Matrix4());
  const order=this.bp.bodies.map((b,i)=>i).sort((a,b)=>this.bp.bodies[b].childs.length-this.bp.bodies[a].childs.length);
  for(const root of order){if(visited.has(root))continue;visited.add(root);const queue=[root];
   while(queue.length){const from=queue.shift();for(const {j,to,forward}of edges[from]){
    if(used.has(j.id))continue;used.add(j.id);const d=this.def(j.shapeId)||{};let delta=new Matrix4();
    if(isPiston(d)){const extension=(this.pistonLengths.get(j.id)??pistonRestExtension(j))-pistonRestExtension(j);delta.makeTranslation(...axis(j.zaxisA).map(v=>v*extension));}
    else if(d.bearing){const p=jointAnchor(j,'A'),angle=(this.angles.get(j.id)||0)*Math.PI/180;delta.makeTranslation(...p).multiply(new Matrix4().makeRotationAxis(new Vector3(...axis(j.zaxisA)),angle)).multiply(new Matrix4().makeTranslation(...p.map(v=>-v)));}
    else if(this.angles.has(j.id))this.warnings.add('Suspension drive and elastic motion require native physics.');
    if(!forward)delta.invert();const candidate=this.matrices[from].clone().multiply(delta);
    if(visited.has(to)){if(candidate.elements.some((v,i)=>Math.abs(v-this.matrices[to].elements[i])>1e-5))this.warnings.add('Closed joint loop has incompatible targets; the preview uses a spanning tree.');continue;}
    this.matrices[to].copy(candidate);visited.add(to);queue.push(to);
   }}
  }
 }
 snapshot(){return {sensors:Object.fromEntries(this.sensors?.readings||[]),logic:{mode:this.logicMode,ticks:this.signalClock.tick,tickHz:40,nativeVerified:false},time:this.time,states:Object.fromEntries(this.states),angles:Object.fromEntries(this.angles),engines:Object.fromEntries(this.engines),jointSpeedsRadPerSecond:Object.fromEntries(this.jointSpeeds),pistons:Object.fromEntries(this.pistons),bodyMatrices:this.matrices.map(m=>m.toArray()),warnings:[...this.warnings],physics:false,limitations:['Clocked logic uses synchronous 40 Hz propagation; native gate scheduling and empty inputs need reference traces.','Kinematic preview: no gravity, collision response, torque/load response, fuel depletion, aerodynamics, inventory mass or arbitrary gameplay Lua.','Engine values are commanded motor speeds; actual loaded bearing speed requires native physics.','Sensors raycast creation convex geometry along local +Z; terrain, characters and exact native detection require a game check.']};}
}
