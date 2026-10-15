import {jointAnchor,axis,sub,dot} from './geometry.mjs';
export const isPiston=def=>!!(def?.piston||def?.survivalPiston);
export function enrichPistonAssets(catalog){
 const creative=catalog.get('260b4597-f1ac-409c-8e6b-90c998c5fe94')?.piston;
 for(const d of catalog.values())if(isPiston(d)){
  const native=d.piston||creative,tier=Number(d.title?.match(/Level (\d)/)?.[1]);
  d.pistonModel={minSpan:1,maxExtension:d.piston?d.piston.length-1:tier?7+2*(tier-1):15,poseExtension:native.length-1,speedLevels:native.speedLevels.map(s=>s.speed),defaultRange:native.defaultRange,defaultSpeedIndex:native.defaultSpeedLevel,source:d.piston?'native shape travel/speed table':'survival tier travel profile and native creative speed table',speedUnitsVerified:false};
 }
 return catalog;
}
export function pistonRestExtension(joint){return Math.max(0,dot(sub(jointAnchor(joint,'B'),jointAnchor(joint,'A')),axis(joint.zaxisA))-1);}
export function pistonSetting(joint,def){
 const model=def?.pistonModel;if(!isPiston(def)||!model)return {supported:false,reason:'No native piston metadata'};
 const range=joint.controller?.length??model.defaultRange,speedIndex=joint.controller?.speed??model.defaultSpeedIndex;
 if(!Number.isInteger(range)||range<0||range>model.maxExtension||!Number.isInteger(speedIndex)||!model.speedLevels[speedIndex])return {supported:false,reason:'Piston length or speed is outside the supported range',...model};
 return {supported:true,range,speedIndex,speedBlocksPerSecond:model.speedLevels[speedIndex],restExtension:pistonRestExtension(joint),...model};
}
export function sequenceEndFrame(controller){
 const bearings=(controller.joints||[]).map(j=>j.frames?.reduce((last,f,i)=>Number(f.targetAngle)!==0?i:last,0)||0);
 // Piston settings are absolute lengths. A return-to-zero step is meaningful;
 // identical trailing settings are padding, unlike cumulative bearing angles.
 const pistons=(controller.controllers||[]).filter(c=>c.frames).map(c=>c.frames.reduce((last,f,i)=>i>0&&f.setting!==c.frames[i-1].setting?i:last,0));
 return Math.max(1,...bearings,...pistons);
}
