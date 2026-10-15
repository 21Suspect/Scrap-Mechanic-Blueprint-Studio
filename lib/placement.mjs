import {basis,ROTATIONS,rotate,vec,obj,add,dimensions,shapeBox,sub,jointOrigin,onShapeFace,jointAnchor} from './geometry.mjs';
import {flatten} from './editor.mjs';
import {checkBounds} from './shape-rules.mjs';
import {isPiston} from './pistons.mjs';
const jointDef=d=>d.bearing||d.spring||d.survivalSpring||d.piston||d.survivalPiston;
export function defaultController(d,template){
 let c=template?structuredClone(template):null;
 if(!c){if(d.lever||d.button)c={active:false};else if(d.logic)c={mode:0};else if(d.timer)c={seconds:0,ticks:0};else if(d.sensor||d.survivalSensor)c={range:10,buttonMode:false,colorMode:false,color:'FFFFFF'};else if(d.sequence||d.survivalSequence)c={playMode:0,timePerFrame:1};else if(d.spotlight)c={luminance:d.spotlight.defaultLuminance??50,coneAngle:45};else if(d.pointlight)c={luminance:d.pointlight.defaultLuminance??50};else if(d.seat||d.steering)c={steering:[]};else if(d.gasEngine||d.electricEngine)c={gear:0};else if(d.scripted&&d.connection)throw Error('Place this scripted item using an observed native controller template.');}
 if(!c&&(d.thruster||d.survivalThruster))c={level:0};
 if(c){delete c.id;c.controllers=[];c.joints=[];if(c.steering)c.steering=[];}
 return c;
}
export function placementAt(def,{shape,targetDef,point,normal,bounds={x:1,y:1,z:1},rotation,autoMount=true}){
 const k=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs))),sign=Math.sign(normal[k])||1,n=[0,0,0];n[k]=sign;
 const size=dimensions({bounds:['block','wedge'].includes(def.kind)?bounds:undefined},def);
 let r=rotation||{xaxis:1,zaxis:3};
 if(autoMount&&def.sticky){const local=def.sticky.match(/[+-][XYZ]/g)||[];const mount=local[0];if(mount){const a='XYZ'.indexOf(mount[1]),s=mount[0]==='-'?-1:1;r=ROTATIONS.find(r=>r.basis[a][k]*s===-sign)||r;}}
 const R=basis(r.xaxis,r.zaxis),extent=rotate(R,size),hit=shapeBox(shape,targetDef),min=point.map((v,i)=>i===k?Math.round(sign>0?hit.max[i]:hit.min[i])- (sign<0?Math.abs(extent[i]):0):Math.floor(v)-Math.floor(Math.abs(extent[i])/2));
 const pos=min.map((v,i)=>v+(extent[i]<0?Math.abs(extent[i]):0));
 return {pos:obj(pos),xaxis:r.xaxis,zaxis:r.zaxis};
}
export function placePart(bp,def,{body=0,newBody=false,pos={x:0,y:0,z:0},xaxis=1,zaxis=3,color,bounds={x:1,y:1,z:1},controller}={}){
 if(jointDef(def))throw Error('Select two separate-body supports and attach this joint.');
 basis(xaxis,zaxis);if(['block','wedge'].includes(def.kind))checkBounds(def,bounds);
 if(!['x','y','z'].every(k=>Number.isSafeInteger(pos[k])))throw Error('Placement must stay on the integer grid.');
 const out=structuredClone(bp),s={shapeId:def.uuid,pos:structuredClone(pos),xaxis,zaxis,color:(color||def.color||'DF7F01').replace('#','').toUpperCase()};
 if(['block','wedge'].includes(def.kind))s.bounds=structuredClone(bounds);
 const c=defaultController(def,controller);if(c){const ids=[...flatten(bp).map(s=>s.controller?.id??0),...(bp.joints||[]).flatMap(j=>[j.id,j.controller?.id??0])];s.controller={...c,id:Math.max(0,...ids)+1};}
 if(newBody||!out.bodies.length){out.bodies.push({childs:[]});body=out.bodies.length-1;}
 if(!out.bodies[body])throw Error('Choose a body.');
 const insertion=out.bodies.slice(0,body+1).reduce((n,b)=>n+b.childs.length,0);out.bodies[body].childs.push(s);
 for(const j of out.joints||[])for(const side of ['A','B'])if(j['child'+side]>=insertion)j['child'+side]++;
 return {blueprint:out,selection:[insertion]};
}
export function attachJoint(bp,def,indices,catalog){
 if(indices.length!==2)throw Error('Select exactly two supports in separate bodies.');if(!def.bearing&&!def.spring&&!def.survivalSpring&&!isPiston(def))throw Error('This joint requires a native template.');
 const out=structuredClone(bp),flat=flatten(out),[a,b]=indices.map(i=>flat[i]);let at=0;const bodies=[];out.bodies.forEach((body,bi)=>body.childs.forEach(()=>bodies[at++]=bi));if(bodies[indices[0]]===bodies[indices[1]])throw Error('Supports must belong to separate bodies (use New body when placing a support).');
 const A=shapeBox(a,catalog.get(a.shapeId)),B=shapeBox(b,catalog.get(b.shapeId)),length=isPiston(def)?1:(def.spring||def.survivalSpring)?.length||0;
 for(let k=0;k<3;k++)for(const sign of [1,-1]){const p=[0,0,0];p[k]=A[sign>0?'max':'min'][k];const end=p[k]+sign*length;if(Math.abs(end-B[sign>0?'min':'max'][k])>1e-6)continue;let valid=true;for(let i=0;i<3;i++)if(i!==k){const lo=Math.max(A.min[i],B.min[i]),hi=Math.min(A.max[i],B.max[i]);if(hi-lo<1){valid=false;break;}p[i]=Math.floor(lo)+.5;}if(!valid)continue;
  const zaxis=sign*(k+1),xaxis=[1,2,3].find(x=>x!==k+1),R=basis(xaxis,zaxis),cell=sub(sub(p,rotate(R,[.5,.5,0])),jointOrigin([0,0,0],xaxis,zaxis));
  const id=Math.max(0,...flat.map(s=>s.controller?.id??0),...(out.joints||[]).flatMap(j=>[j.id,j.controller?.id??0]))+1;
  const j={id,shapeId:def.uuid,color:def.color||'DF7F01',childA:indices[0],childB:indices[1],posA:obj(cell),posB:obj(add(cell,rotate(R,[0,0,length]))),xaxisA:xaxis,xaxisB:xaxis,zaxisA:zaxis,zaxisB:zaxis};
  if(isPiston(def))j.controller={id:id+1,controllers:[],joints:[],length:def.pistonModel.defaultRange,speed:def.pistonModel.defaultSpeedIndex};
  if(!onShapeFace(jointAnchor(j,'A'),a,catalog.get(a.shapeId))||!onShapeFace(jointAnchor(j,'B'),b,catalog.get(b.shapeId)))continue;
  (a.joints??=[]).push({id});(b.joints??=[]).push({id});(out.joints??=[]).push(j);return {blueprint:out,selection:['j'+id]};
 }
 throw Error('Supports need opposite faces with a full block of overlap and the joint’s native spacing.');
}
