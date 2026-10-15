import {basis,vec,sub,dot,axis,jointAnchor,onShapeFace,inverse,dimensions} from './geometry.mjs';
import {attachmentAudit,stickyFace} from './attachments.mjs';
import {checkBounds} from './shape-rules.mjs';
import {isThruster,thrusterSetting} from './thrusters.mjs';
import {isSequence} from './sequences.mjs';
import {isPiston,pistonSetting} from './pistons.mjs';
export function validate(bp,catalog){
 const errors=[],warnings=[],checks=[];
 const issue=(code,location,message)=>errors.push({code,location,message});
 if(!bp||bp.version!==4||!Array.isArray(bp.bodies))return {ok:false,errors:[{code:'SCHEMA',location:'$',message:'Expected version 4 and bodies array'}],warnings};
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const refs=v=>v==null||Array.isArray(v)&&v.every(object);
 const validShape=s=>object(s)&&refs(s.joints)&&(!s.controller||object(s.controller)&&refs(s.controller.controllers)&&refs(s.controller.joints)&&refs(s.controller.steering));
 if(!bp.bodies.every(b=>object(b)&&Array.isArray(b.childs)&&b.childs.every(validShape))||!refs(bp.joints)||(bp.joints||[]).some(j=>!validShape(j)))return {ok:false,errors:[{code:'SCHEMA',location:'$',message:'Malformed body, shape, joint, controller or reference array'}],warnings};
 const children=[],bodyOf=[];
 bp.bodies.forEach((b,bi)=>{if(!Array.isArray(b.childs))issue('BODY',`bodies[${bi}]`,'Missing childs array');else for(const c of b.childs){children.push(c);bodyOf.push(bi);}});
 const joints=bp.joints||[],ids=new Map(),controllers=new Map();
 const validVec=p=>p&&['x','y','z'].every(k=>Number.isSafeInteger(p[k]));
 function orientation(s,suffix,loc){try{basis(s['xaxis'+suffix],s['zaxis'+suffix]);return true;}catch(e){issue('ROTATION',loc,e.message);return false;}}
 function shape(s,loc,joint=false){
 if(!s||typeof s!=='object'){issue('SHAPE',loc,'Expected shape object');return;}
 const d=catalog.get(s.shapeId);if(!d)issue('UNKNOWN_SHAPE',loc,`Shape ${s.shapeId} is not in the installed game databases`);
 if(!/^[\da-f]{6}$/i.test(s.color||''))issue('COLOR',loc,'Color must contain six hex digits');
 if(!joint){orientation(s,'',loc);if(!validVec(s.pos))issue('POSITION',loc,'Position must have integer x/y/z');
 if(['block','wedge'].includes(d?.kind)&&!s.bounds)issue('BOUNDS',loc,'Block requires bounds');
 if(s.bounds&&(!validVec(s.bounds)||vec(s.bounds).some(n=>n<=0)))issue('BOUNDS',loc,'Bounds must be positive integers');
 if(d?.kind==='wedge'&&s.bounds)try{checkBounds(d,s.bounds);}catch(e){issue('WEDGE_SIZE',loc,e.message);}}
 if(s.controller){const id=s.controller.id;if(!Number.isSafeInteger(id)||id<0||controllers.has(id))issue('CONTROLLER_ID',loc,'Invalid or duplicate controller ID');else controllers.set(id,{shape:s,def:d,location:loc});}
 }
 children.forEach((c,i)=>shape(c,`child:${i}`));
 if(!Array.isArray(joints))return {ok:false,errors:[...errors,{code:'JOINTS',location:'joints',message:'Expected array'}],warnings};
 joints.forEach((j,i)=>{shape(j,`joint:${i}`,true);if(!Number.isSafeInteger(j.id)||j.id<0||ids.has(j.id))issue('JOINT_ID',`joint:${i}`,'Invalid or duplicate joint ID');else ids.set(j.id,j);});
 joints.forEach((j,i)=>{
 const loc=`joint:${i}`,d=catalog.get(j.shapeId);let complete=true;
 for(const side of ['A','B']){
 const idx=j['child'+side];
 if(side==='B'&&idx===-1){warnings.push({code:'OPEN_JOINT',location:loc,message:'Joint has no second attachment; engine verification required'});complete=false;continue;}
 if(!Number.isInteger(idx)||!children[idx]){issue('JOINT_CHILD',loc,`child${side} is not a flattened child index`);complete=false;continue;}
 if(!validVec(j['pos'+side])||!orientation(j,side,loc)){issue('JOINT_POSE',loc,`Invalid endpoint ${side}`);complete=false;continue;}
 const c=children[idx],def=catalog.get(c.shapeId);
 if(!(c.joints||[]).some(r=>r.id===j.id))issue('JOINT_REFERENCE',loc,`child${side} ${idx} does not reference joint ${j.id}`);
 try{
 const p=jointAnchor(j,side);if(!onShapeFace(p,c,def))issue('JOINT_POSITION',loc,`Endpoint ${side} [${p}] does not touch child ${idx}'s collision bounds`);
 // Check which side of the joint the support lies on, in the support's own frame.
 const q=inverse(basis(c.xaxis,c.zaxis),sub(p,vec(c.pos))),n=inverse(basis(c.xaxis,c.zaxis),axis(j['zaxis'+side])),size=dimensions(c,def);
 const k=n.findIndex(v=>v!==0),expected=(side==='A'?n[k]>0:n[k]<0)?size[k]:0;
 if(Math.abs(q[k]-expected)>1e-5)issue('JOINT_FACE',loc,`Endpoint ${side} is on the wrong face of child ${idx}`);
 const worldK=Math.abs(j['zaxis'+side])-1,worldSign=Math.sign(j['zaxis'+side])*(side==='A'?1:-1);
 if(stickyFace(c,def,worldK,worldSign)===false)issue('JOINT_STICKY_FACE',loc,`Endpoint ${side} touches a non-attachable face of child ${idx}`);
 if(def?.hull||def?.convexHull||def?.sticky&&def.sticky!=='-X+X-Y+Y-Z+Z'&&def.kind!=='block')warnings.push({code:'CONTACT_APPROXIMATION',location:loc,message:`Endpoint ${side} uses collision bounds; exact sticky/hull contact requires game validation`});
 }catch(e){issue('JOINT_POSITION',loc,e.message);}
 }
 if(complete){
 if(bodyOf[j.childA]===bodyOf[j.childB])issue('JOINT_BODY',loc,'Joint endpoints belong to the same body');
 const delta=sub(vec(j.posB),vec(j.posA)),z=axis(j.zaxisA),along=dot(delta,z),lateral=sub(delta,z.map(v=>v*along));
 if(j.zaxisA!==j.zaxisB||lateral.some(v=>v!==0)||along<0)issue('JOINT_ALIGNMENT',loc,'Rest-pose endpoints must share a forward axis and lie on its line');
 if(d?.bearing&&delta.some(v=>v!==0))issue('BEARING_SPAN',loc,'Bearing posA and posB must be identical in a generated rest pose');
 const spring=d?.spring||d?.survivalSpring;
 if(spring&&along!==spring.length)issue('SPRING_SPAN',loc,`Expected suspension endpoint spacing ${spring.length}, got ${along}`);
 if(!d?.bearing&&!spring)warnings.push({code:'JOINT_UNVERIFIED',location:loc,message:'This joint type needs in-game validation of travel and attachment semantics'});
 checks.push({id:j.id,childA:j.childA,childB:j.childB,anchorA:jointAnchor(j,'A'),anchorB:jointAnchor(j,'B')});
 }
 });
 children.forEach((c,i)=>{for(const r of c.joints||[]){const j=ids.get(r.id);if(!j||j.childA!==i&&j.childB!==i)issue('JOINT_REFERENCE',`child:${i}`,`Stale joint reference ${r.id}`);}});
 for(const [id,c]of controllers){
 const links=c.shape.controller.controllers||[],jointLinks=c.shape.controller.joints||[];
 if(isThruster(c.def)){const setting=thrusterSetting(c.shape,c.def);if(!setting.supported)issue('THRUSTER_LEVEL',c.location,setting.reason);}
 if(c.def?.logic&&(!Number.isInteger(c.shape.controller.mode??0)||(c.shape.controller.mode??0)<0||c.shape.controller.mode>5))issue('LOGIC_MODE',c.location,'Choose AND, OR, XOR, NAND, NOR or XNOR');
 if(isPiston(c.def)){const setting=pistonSetting(c.shape,c.def);if(!setting.supported)issue('PISTON_SETTING',c.location,setting.reason);}
 if(isSequence(c.def)){
  const settings=c.shape.controller;if(settings.timePerFrame!==undefined&&(!Number.isFinite(settings.timePerFrame)||settings.timePerFrame<=0))issue('SEQUENCE_TIMING',c.location,'Seconds per step must be positive');
  if(settings.playMode!==undefined&&![0,2].includes(settings.playMode))warnings.push({code:'SEQUENCE_MODE_UNVERIFIED',location:c.location,message:'Unrecognized native play mode; preserve it and test in game'});
  for(const row of [...jointLinks,...links])if(row.frames){if(!Array.isArray(row.frames)||row.frames.length>11||!row.frames.length)issue('SEQUENCE_FRAMES',c.location,'A native sequence row has 1–11 frames');else for(const frame of row.frames){const bearing=jointLinks.includes(row),value=frame?.[bearing?'targetAngle':'setting'],target=!bearing&&controllers.get(row.id),max=target?.def?.pistonModel?.maxExtension;if(!Number.isFinite(value)||bearing&&Math.abs(value)>360||!bearing&&(!Number.isInteger(value)||value<0||max!==undefined&&value>max))issue('SEQUENCE_FRAME_SETTING',c.location,'Invalid bearing angle or piston length');}}
 }
 if(new Set(links.map(r=>r.id)).size!==links.length||new Set(jointLinks.map(r=>r.id)).size!==jointLinks.length)issue('DUPLICATE_CONNECTION',c.location,'Duplicate connection targets');
 if(c.def?.connection?.maxChildren&&links.length+jointLinks.length>c.def.connection.maxChildren)issue('CONNECTION_LIMIT',c.location,'Exceeds script maxChildCount');
 for(const r of c.shape.controller.controllers||[]){const target=controllers.get(r.id);if(!target)issue('CONNECTION_TARGET',c.location,`Controller ${r.id} does not exist`);else if(id===r.id)issue('SELF_CONNECTION',c.location,'Controller cannot connect to itself');else{
 const out=c.def?.connection?.output?.filter(t=>t!=='none'),input=target.def?.connection?.input?.filter(t=>t!=='none');
 if(out&&input&&!out.some(t=>input.includes(t)))issue('CONNECTION_TYPE',c.location,`Incompatible connection to ${r.id}: ${out} → ${input}`);
 }}
 if(jointLinks.length&&c.def?.connection?.output&&!c.def.connection.output.includes('bearing'))issue('CONNECTION_TYPE',c.location,'This controller cannot drive bearings');
 const level=Number(c.def?.title?.match(/Level (\d)/)?.[1]);
 if(level&&/Engine/.test(c.def.title)&&jointLinks.length>level*2)issue('ENGINE_BEARING_LIMIT',c.location,'Engine level '+level+' supports '+level*2+' bearings');
 if(level&&/Seat/.test(c.def.title)&&links.length+jointLinks.length>[6,8,12,16,20][level-1])issue('SEAT_CONNECTION_LIMIT',c.location,'Seat level connection limit exceeded');
 for(const r of jointLinks){if(!ids.has(r.id))issue('CONNECTION_JOINT',c.location,`Joint ${r.id} does not exist`);if(r.reverse!==undefined&&![0,1,false,true].includes(r.reverse))issue('CONNECTION_REVERSE',c.location,'Joint reverse must be 0 or 1');}
 for(const r of c.shape.controller.steering||[])if(!ids.has(r.id)||!jointLinks.some(j=>j.id===r.id))issue('STEERING_REFERENCE',c.location,`Steering joint ${r.id} is not connected`);
 }
 for(const [id,c]of controllers){const incoming=[...controllers.values()].reduce((n,s)=>n+(s.shape.controller.controllers||[]).filter(r=>r.id===id).length,0),max=c.def?.connection?.maxParents;if(max!==null&&max!==undefined&&incoming>max)issue('PARENT_LIMIT',c.location,'Too many incoming connections');}
 const attachments=errors.length?null:attachmentAudit(bp,catalog);
 for(const g of attachments?.disconnected||[])warnings.push({code:'DISCONNECTED_BODY',location:'body:'+g.body,message:g.components.length+' separate face-contact groups; parts may fall off',components:g.components});
 return {ok:errors.length===0,engineVerified:false,errors,warnings,attachments,stats:{bodies:bp.bodies.length,shapes:children.length,joints:joints.length,controllers:controllers.size,connections:[...controllers.values()].reduce((n,c)=>n+(c.shape.controller.controllers?.length||0)+(c.shape.controller.joints?.length||0),0)},jointChecks:checks};
}


