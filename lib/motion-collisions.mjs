import {Matrix4} from 'three';
import {MotionPreview} from './simulation.mjs';
import {collisionScene} from './collision-geometry.mjs';
import {isEngine,engineSetting} from './engines.mjs';
import {isPiston,pistonSetting,sequenceEndFrame} from './pistons.mjs';

const key=hit=>[hit.a,hit.b].sort((a,b)=>a-b).join(':');
const lastFrame=sequenceEndFrame;
const number=(value,fallback,min,max,name)=>{value=value??fallback;if(!Number.isFinite(value)||value<min||value>max)throw Error(name+' must be '+min+'–'+max);return value;};

export function checkMotionCollisions(blueprint,catalog,options={}){
 const def=id=>catalog instanceof Map?catalog.get(id):catalog[id];
 const step=number(options.stepSeconds,.05,.001,.1,'Sample interval');
 const angleStep=number(options.angleStepDegrees,5,.5,15,'Angular interval');
 const maxDuration=number(options.maxDuration,30,.05,60,'Duration limit');
 const maxSamples=Math.floor(number(options.maxSamplesPerPhase,600,10,5000,'Sample limit'));
 const maxCases=Math.floor(number(options.maxCases,40,1,100,'Case limit'));
 const maxPairs=Math.floor(number(options.maxPairs,100,1,1000,'Collision limit'));
 const tolerance=number(options.toleranceBlocks,.005,0,.05,'Collision tolerance');
 const flat=blueprint.bodies.flatMap(b=>b.childs),parts=new Map([...flat,...(blueprint.joints||[])].filter(s=>s.controller).map(s=>[s.controller.id,s]));
 const inputs=[...parts].filter(([,s])=>def(s.shapeId)?.lever||def(s.shapeId)?.button).map(([id,s])=>({id,title:def(s.shapeId).title}));
 const engines=[...parts].filter(([,s])=>isEngine(def(s.shapeId))).map(([id])=>id);
 function reach(ids){const seen=new Set(),queue=[...ids];while(queue.length){const id=queue.shift();if(seen.has(id)||!parts.has(id))continue;seen.add(id);queue.push(...(parts.get(id).controller.controllers||[]).map(c=>c.id));}return seen;}
 function timing(reached){let duration=.05,velocity=0,linearVelocity=0,delay=0;const joints=new Set();
  for(const id of reached){const s=parts.get(id),d=def(s.shapeId),c=s.controller;
   if(d.sequence||d.survivalSequence){const interval=Math.max(.001,c.timePerFrame||1);duration=Math.max(duration,lastFrame(c)*interval*(c.playMode===2?2:1));for(const j of c.joints||[]){joints.add(j.id);velocity+=Math.max(0,...(j.frames||[]).map(f=>Math.abs(f.targetAngle||0)))/interval*Math.PI/180;}}
   if(isEngine(d)){const setting=engineSetting(s,d);for(const j of c.joints||[])joints.add(j.id);if(setting.supported&&setting.targetRadPerSecond){const speed=Math.abs(setting.targetRadPerSecond);velocity+=speed;duration=Math.max(duration,(setting.rampPerSecond?1/setting.rampPerSecond:0)+2*Math.PI/speed);}}
   if(isPiston(d)){const setting=pistonSetting(s,d);joints.add(s.id);if(setting.supported){linearVelocity+=setting.speedBlocksPerSecond;duration=Math.max(duration,setting.maxExtension/setting.speedBlocksPerSecond);}}
   if(d.timer)delay+=(c.seconds||0)+(c.ticks||0)/40;
  }
  return {duration:duration+delay,velocity,linearVelocity,joints:[...joints]};
 }
 const planned=[],covered=new Set(),nonMechanical=[];
 for(const input of inputs){const reached=reach([input.id]),motion=timing(reached);if(!motion.joints.length){nonMechanical.push(input);continue;}planned.push({label:input.title+' '+input.id,ids:[input.id],reached,motion});for(const id of reached)covered.add(id);}
 for(const [id,s]of parts){const d=def(s.shapeId),sequence=d.sequence||d.survivalSequence,hasRows=s.controller.joints?.length||s.controller.controllers?.some(c=>c.frames);if(covered.has(id)||(!sequence&&!isEngine(d)&&!isPiston(d))||!hasRows&&!isPiston(d))continue;const reached=reach([id]);planned.push({label:d.title+' '+id,ids:isEngine(d)?[]:[id],engine:isEngine(d)?id:null,reached,motion:timing(reached)});}
 // Test each reachable mechanism and simultaneous inputs. Do not pretend this
 // is exhaustive enumeration of 2^N logic combinations.
 const mechanicalInputs=planned.filter(c=>c.ids.length===1&&inputs.some(i=>i.id===c.ids[0]));
 if(mechanicalInputs.length>1){const ids=mechanicalInputs.flatMap(c=>c.ids),reached=reach(ids);planned.push({label:'All mechanical inputs',ids,reached,motion:timing(reached)});}
 const scene=collisionScene(blueprint,catalog),rest=scene.intersections(blueprint.bodies.map(()=>new Matrix4()),{movingOnly:false,tolerance,limit:maxPairs});
 const baseline=new Map(rest.collisions.map(hit=>[key(hit),hit])),cases=[];let complete=planned.length<=maxCases&&!rest.truncated;
 for(const plan of planned.slice(0,maxCases)){
  const preview=new MotionPreview(blueprint,catalog);
  for(const input of inputs)preview.setInput(input.id,false);
  for(const id of engines)preview.setEngine(id,{power:0});
  for(const id of plan.reached)if(engines.includes(id))preview.engineDrives.delete(id);
  if(plan.engine)preview.setEngine(plan.engine,{power:1});
  preview.step(0);for(const id of plan.ids)preview.setInput(id,true);
  const duration=Math.min(maxDuration,plan.motion.duration),dt=Math.min(step,plan.motion.velocity?angleStep*Math.PI/180/plan.motion.velocity:step,plan.motion.linearVelocity ? .1/plan.motion.linearVelocity : step);
  const hits=new Map();let samples=0,truncated=plan.motion.duration>maxDuration;
  const phases=[];
  for(const phase of ['activate','release']){
   if(phase==='release'){for(const id of plan.ids)preview.setInput(id,false);if(plan.engine)preview.setEngine(plan.engine,{power:0});}
   preview.step(0);let elapsed=0,count=0;
   while(true){
    const sample=scene.intersections(preview.matrices,{tolerance,limit:maxPairs});
    for(const hit of sample.collisions){const original=baseline.get(key(hit)),previous=hits.get(key(hit));
     // Existing rest-pose contacts are listed separately. Surface contact does
     // not count, and unchanged conservative hull overlaps are not new hits.
     if(original&&hit.depthBlocks<=original.depthBlocks+.02)continue;
     if(!previous)hits.set(key(hit),{...hit,phase,time:elapsed,absoluteTime:preview.time,existingAtRest:!!original,peakDepthBlocks:hit.depthBlocks});
     else previous.peakDepthBlocks=Math.max(previous.peakDepthBlocks,hit.depthBlocks);
    }
    samples++;count++;
    if(sample.truncated||hits.size>=maxPairs){truncated=true;break;}
    if(elapsed>=duration-1e-8)break;
    if(count>=maxSamples){truncated=true;break;}
    const advance=Math.min(dt,duration-elapsed);preview.step(advance);elapsed+=advance;
   }
   phases.push({phase,duration:elapsed,samples:count});
  }
  const unsupported=[...preview.warnings].some(w=>/incompatible targets|Suspension drive|Logic feedback did not settle|Unknown native controller play mode/.test(w));if(truncated||unsupported)complete=false;
  cases.push({label:plan.label,inputs:Object.fromEntries(plan.ids.map(id=>[id,true])),inputIds:inputs.map(i=>i.id),enginesOff:engines.filter(id=>!plan.reached.has(id)),engine:plan.engine??null,joints:plan.motion.joints,requestedDuration:plan.motion.duration,sampleInterval:dt,phases,samples,truncated,unsupported,collisions:[...hits.values()],warnings:[...preview.warnings]});
 }
 const count=cases.reduce((n,c)=>n+c.collisions.length,0);
 return {engineVerified:false,physics:false,approximate:true,complete,clearWithinSampledGeometry:complete&&count===0&&rest.collisions.length===0,collisionCount:count,baseline:rest.collisions,cases,nonMechanicalInputs:nonMechanical,untestedCases:planned.slice(maxCases).map(c=>c.label),geometry:{shapes:scene.objects.length,approximatedShapes:scene.objects.filter(o=>o.approximate).length,toleranceBlocks:tolerance},limits:{stepSeconds:step,angleStepDegrees:angleStep,maxDuration,maxSamplesPerPhase:maxSamples,maxCases,maxPairs},limitations:['Sampled kinematic intersections, not native physics or collision response. Contacts between parts in the same welded body are excluded.','Native boxes and wedges are analytical; cylinders are conservative polygons. OBJ hull scale/margins and missing collision shapes remain approximate.','Tests independent inputs, their release, standalone drives and all mechanical inputs together. Other logic combinations, sensors, seat steering, incompatible loops and load-dependent motion need separate testing.','Finite temporal/angular samples can miss very thin collisions. Any duration, sample or case limit is reported as incomplete.']};
}

export function replayMotionCollision(blueprint,catalog,scenario,hit){
 const preview=new MotionPreview(blueprint,catalog);
 for(const id of scenario.inputIds)preview.setInput(id,false);
 for(const id of scenario.enginesOff)preview.setEngine(id,{power:0});
 if(scenario.engine)preview.setEngine(scenario.engine,{power:1});
 preview.step(0);for(const id of Object.keys(scenario.inputs))preview.setInput(Number(id),true);preview.step(0);
 const advance=duration=>{let time=0;while(time<duration-1e-8){const dt=Math.min(scenario.sampleInterval,duration-time);preview.step(dt);time+=dt;}};
 if(hit.phase==='release'){advance(scenario.phases[0].duration);for(const id of Object.keys(scenario.inputs))preview.setInput(Number(id),false);if(scenario.engine)preview.setEngine(scenario.engine,{power:0});preview.step(0);}
 advance(hit.time);
 return preview;
}
