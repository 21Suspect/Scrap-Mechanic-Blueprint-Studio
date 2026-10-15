import {engineGear,flatten} from './editor.mjs';
import {isEngine} from './engines.mjs';
import {isThruster,thrusterSetting,setThrusterLevel} from './thrusters.mjs';
import {isPiston} from './pistons.mjs';
import {LOGIC_MODES} from './logic.mjs';
import {isSequence,SEQUENCE_MODES,synchronizeBearingEndpoints} from './sequences.mjs';
export const editableShape=(blueprint,index)=>typeof index==='string'&&index.startsWith('j')?blueprint.joints?.find(j=>j.id===Number(index.slice(1))):flatten(blueprint)[index];

export function partSettingDescriptors(parts,catalog,blueprint){
 if(!parts.length||parts.some(s=>s.shapeId!==parts[0].shapeId||!s.controller))return [];
 const d=catalog instanceof Map?catalog.get(parts[0].shapeId):catalog[parts[0].shapeId],controllers=parts.map(s=>s.controller),settings=[];
 const add=(key,label,values,options={})=>settings.push({key,label,value:values[0],mixed:values.some(v=>v!==values[0]),...options});
 if(isEngine(d)){
  const values=controllers.map(c=>engineGear(structuredClone(c)));
  if(values.every(v=>v!==null)){const native=d.gasEngine?.gears||d.electricEngine?.gears,level=Number(d.title.match(/Level (\d)/)?.[1]),min=d.engineModel?.gearBase??(native?0:1),max=d.engineModel?.gears?.length?min+d.engineModel.gears.length-1:native?native.length-1:level?[5,7,9,11,13][level-1]:13;
   add('engineGear','Engine gear ('+min+' = off)',values,{min,max});}
 }
 if(isThruster(d)){const values=parts.map(s=>thrusterSetting(s,d));add('thrusterLevel','Thruster power',controllers.map(c=>c.level??0),{options:Array.from({length:(values[0].maxLevel??6)+1},(_,i)=>[i,String(i+1)])});}
 if(d.spring||d.survivalSpring)add('stiffnessLevel','Suspension stiffness',controllers.map(c=>c.stiffnessLevel??d.spring?.defaultStiffnessLevel??2),{min:0,max:d.survivalSpring?.stiffnessLimit??d.spring.stiffnessLevels.length-1});
 if(isPiston(d)){add('length','Piston extension',controllers.map(c=>c.length??d.pistonModel.defaultRange),{min:0,max:d.pistonModel.maxExtension});add('speed','Piston speed',controllers.map(c=>c.speed??d.pistonModel.defaultSpeedIndex),{options:d.pistonModel.speedLevels.map((_,i)=>[i,String(i+1)])});}
 for(const [key,label,min,max,step]of [['range','Sensor range',1,20,1],['seconds','Timer seconds',0,59,1],['ticks','Timer ticks',0,39,1],['luminance','Light brightness',0,100,1],['coneAngle','Light cone angle',0,180,1]])if(controllers.every(c=>key in c))add(key,label,controllers.map(c=>c[key]),{min,max,step});
 if(isSequence(d)){add('timePerFrame','Seconds per step',controllers.map(c=>c.timePerFrame??1),{min:.001,max:60,step:.001});add('playMode','Playback',controllers.map(c=>c.playMode??0),{options:SEQUENCE_MODES});}
 for(const [key,label]of [['buttonMode','Sensor button mode'],['colorMode','Sensor color filter'],['audioEnabled','Sound enabled'],['active','Active state']])if(controllers.every(c=>key in c))add(key,label,controllers.map(c=>c[key]),{type:'checkbox'});
 if(controllers.every(c=>'color' in c))add('color','Controller color',controllers.map(c=>'#'+c.color),{type:'color'});
 if(d.logic)add('mode','Logic mode',controllers.map(c=>c.mode??0),{options:LOGIC_MODES.map((label,i)=>[i,label])});
 // Rows are matched by the native controller index, never by joint IDs.
 // Only rows/frames shared by every selected controller are batch editable.
 if(isSequence(d)){
 for(const [row,first]of (controllers[0].controllers||[]).entries())if(first.frames){const index=first.index??row,links=controllers.map(c=>(c.controllers||[]).find((j,i)=>(j.index??i)===index));if(links.some(j=>!j?.frames))continue;const targets=blueprint?[...flatten(blueprint),...(blueprint.joints||[])]:[],max=Math.min(...links.map(link=>{const s=targets.find(s=>s.controller?.id===link.id),d=s&&(catalog instanceof Map?catalog.get(s.shapeId):catalog[s.shapeId]);return d?.pistonModel?.maxExtension??15;}));for(let frame=0;frame<11;frame++)add('pistonframe:'+index+':'+frame,'Piston row '+(index+1)+' · step '+frame,links.map(j=>j.frames[frame]?.setting??j.frames.at(-1)?.setting??0),{min:0,max});}
 for(const [row,first]of (controllers[0].joints||[]).entries()){
  const index=first.index??row,links=controllers.map(c=>(c.joints||[]).find((j,i)=>(j.index??i)===index));if(links.some(j=>!j))continue;
  add('reverse:'+index,'Bearing row '+(index+1)+' reverse',links.map(j=>!!j.reverse),{type:'checkbox'});
  for(let frame=0;frame<11;frame++)add('frame:'+index+':'+frame,'Row '+(index+1)+' · step '+frame,links.map(j=>j.frames?.[frame]?.targetAngle??(!j.frames?frame===0?j.startAngle??0:frame===1?(j.endAngle??0)-(j.startAngle??0):0:0)),{min:-360,max:360});
 }}
 return settings;
}

export function applyPartSetting(blueprint,indices,key,value,catalog){
 const out=structuredClone(blueprint),parts=indices.map(i=>editableShape(out,i));
 if(parts.some(s=>!s))throw Error('Select matching interactive parts');
 const descriptor=partSettingDescriptors(parts,catalog,out).find(s=>s.key===key);if(!descriptor)throw Error('This setting is not shared by the selected parts');
 const type=descriptor.type||'number';
 if(type==='number'&&(!Number.isFinite(value)||descriptor.min!==undefined&&value<descriptor.min||descriptor.max!==undefined&&value>descriptor.max||!descriptor.step&&!Number.isInteger(value)||descriptor.step===1&&!Number.isInteger(value)))throw Error(descriptor.label+' is out of range');
 if(descriptor.options&&!descriptor.options.some(([v])=>v===value))throw Error('Invalid setting');
 if(type==='checkbox'&&typeof value!=='boolean')throw Error('Choose on or off');
 if(type==='color'&&!/^#[\da-f]{6}$/i.test(value))throw Error('Invalid color');
 const d=catalog instanceof Map?catalog.get(parts[0].shapeId):catalog[parts[0].shapeId];
 for(const s of parts){const c=s.controller;
  if(key==='engineGear')engineGear(c,value);
  else if(key==='thrusterLevel')setThrusterLevel(c,d,value);
  else if(key.startsWith('reverse:')||key.startsWith('frame:')||key.startsWith('pistonframe:')){const [kind,row,frame]=key.split(':'),link=(kind==='pistonframe'?c.controllers:c.joints).find((j,i)=>(j.index??i)===Number(row));if(kind==='reverse')link.reverse=typeof link.reverse==='boolean'?value:Number(value);else{const property=kind==='pistonframe'?'setting':'targetAngle';link.frames??=[{targetAngle:link.startAngle??0},{targetAngle:(link.endAngle??0)-(link.startAngle??0)}];while(link.frames.length<11)link.frames.push({[property]:kind==='pistonframe'?link.frames.at(-1)?.setting??0:0});link.frames[Number(frame)][property]=value;if(kind==='frame')synchronizeBearingEndpoints(link);}}
  else c[key]=type==='color'?value.slice(1).toUpperCase():value;
 }
 return out;
}

function driveLinks(blueprint,ids){return flatten(blueprint).flatMap(s=>(s.controller?.joints||[]).filter(j=>ids.includes(j.id)));}
export function bearingSettingDescriptors(blueprint,ids){
 const links=driveLinks(blueprint,ids);if(!ids.length||ids.some(id=>!links.some(j=>j.id===id)))return [];
 const settings=[],add=(key,label,values,options={})=>settings.push({key,label,value:values[0],mixed:values.some(v=>v!==values[0]),...options});
 add('reverse','Reverse rotation',links.map(j=>!!j.reverse),{type:'checkbox'});
 if(links.every(j=>j.frames))for(let frame=0;frame<Math.min(...links.map(j=>j.frames.length));frame++)add('frame:'+frame,'Step '+frame,links.map(j=>j.frames[frame].targetAngle),{min:-360,max:360});
 return settings;
}
export function applyBearingSetting(blueprint,ids,key,value){
 const setting=bearingSettingDescriptors(blueprint,ids).find(s=>s.key===key);if(!setting)throw Error('No shared bearing drive setting');
 if(key==='reverse'&&typeof value!=='boolean'||key!=='reverse'&&(!Number.isInteger(value)||value<setting.min||value>setting.max))throw Error('Invalid bearing setting');
 const out=structuredClone(blueprint);for(const link of driveLinks(out,ids))if(key==='reverse')link.reverse=typeof link.reverse==='boolean'?value:Number(value);else{link.frames[Number(key.split(':')[1])].targetAngle=value;synchronizeBearingEndpoints(link);}
 return out;
}
