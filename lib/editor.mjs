import {basis,axis,rotate,vec,obj,add,sub,scale,dimensions,jointAnchor,jointOrigin} from './geometry.mjs';
import {checkBounds} from './shape-rules.mjs';
import {storageGear} from './lua-storage.mjs';
export const flatten=bp=>bp.bodies.flatMap(b=>b.childs);
export function separateSelection(bp,indices){
 const out=structuredClone(bp),flat=flatten(out),selected=new Set(indices);if(!selected.size||[...selected].some(i=>!Number.isInteger(i)||!flat[i]))throw Error('Select ordinary blocks or parts to separate.');
 const oldIndex=new Map(flat.map((s,i)=>[s,i]));const bodies=out.bodies.filter(b=>b.childs.some(s=>selected.has(oldIndex.get(s))));if(bodies.length!==1)throw Error('Select parts from one body.');if(bodies[0].childs.every(s=>selected.has(oldIndex.get(s))))throw Error('These parts already form a complete body.');
 const moving=flat.filter((s,i)=>selected.has(i));bodies[0].childs=bodies[0].childs.filter(s=>!selected.has(oldIndex.get(s)));out.bodies.push({childs:moving});const next=flatten(out),newIndex=new Map(next.map((s,i)=>[s,i])),mapping=new Map(flat.map((s,i)=>[i,newIndex.get(s)]));
 for(const j of out.joints||[]){j.childA=mapping.get(j.childA);j.childB=mapping.get(j.childB);}return {blueprint:out,selection:moving.map(s=>newIndex.get(s))};
}
const encode=v=>(v.findIndex(x=>Math.abs(x)>.5)+1)*Math.sign(v.find(x=>Math.abs(x)>.5));
export function transformSelection(bp,indices,catalog,{translation=[0,0,0],rotation=null,mirror=null,pivot=[0,0,0],gridSnap=false}={}){
 const out=structuredClone(bp),selected=new Set(indices),parts=flatten(out),R=rotation?basis(...rotation):basis(1,3);
 const direction=v=>{const w=rotate(R,v);if(mirror!==null)w[mirror]*=-1;return w;};
 const point=p=>add(add(pivot,direction(sub(p,pivot))),translation);
 for(const i of selected){const s=parts[i];if(!s)throw Error('Select ordinary parts to transform. Bearings follow their attachment parts.');const old=basis(s.xaxis,s.zaxis);let p=point(vec(s.pos));const X=direction(old[0]),Z=direction(old[2]);if(mirror!==null){p=add(p,scale(X,dimensions(s,catalog.get(s.shapeId))[0]));X.forEach((_,k)=>X[k]*=-1);}s.pos=obj(p);s.xaxis=encode(X);s.zaxis=encode(Z);}
 for(const j of out.joints||[])for(const side of ['A','B'])if(selected.has(j['child'+side])){
 const anchor=point(jointAnchor(j,side)),X=direction(axis(j['xaxis'+side])),Z=direction(axis(j['zaxis'+side]));if(mirror!==null)X.forEach((_,k)=>X[k]*=-1);const x=encode(X),z=encode(Z);
 j['pos'+side]=obj(sub(sub(anchor,rotate(basis(x,z),[.5,.5,0])),jointOrigin([0,0,0],x,z)));j['xaxis'+side]=x;j['zaxis'+side]=z;
 }
 if(mirror!==null)for(const s of parts)for(const r of s.controller?.joints||[]){const j=out.joints.find(j=>j.id===r.id);if(j&&selected.has(j.childA)&&selected.has(j.childB))r.reverse=typeof r.reverse==='boolean'?!r.reverse:(r.reverse?0:1);}
 if(gridSnap&&selected.size){const p=vec(parts[[...selected][0]].pos),offset=p.map(v=>Math.round(v)-v);for(const i of selected)parts[i].pos=obj(add(vec(parts[i].pos),offset));for(const j of out.joints||[])for(const side of ['A','B'])if(selected.has(j['child'+side]))j['pos'+side]=obj(add(vec(j['pos'+side]),offset));}
 if(flatten(out).some(s=>vec(s.pos).some(n=>!Number.isInteger(n))))throw Error('Transform must stay on the integer block grid.');
 return out;
}
export function copySelection(bp,indices,{translation=[1,0,0]}={}){
 const out=structuredClone(bp),selected=new Set(indices),flat=flatten(bp),map=new Map(),controllerIds=new Map(),jointIds=new Map(),clones=[];
 let next=1;for(const s of flat)next=Math.max(next,(s.controller?.id||0)+1);for(const j of bp.joints||[])next=Math.max(next,j.id+1,(j.controller?.id||0)+1);let index=flat.length,oldIndex=0;
 for(const body of bp.bodies){const copied=[];for(const s of body.childs){if(selected.has(oldIndex)){const c=structuredClone(s);map.set(oldIndex,index++);if(c.controller){controllerIds.set(c.controller.id,next);c.controller.id=next++;}c.pos=obj(add(vec(c.pos),translation));copied.push(c);clones.push(c);}oldIndex++;}if(copied.length)out.bodies.push({childs:copied});}
 const joints=(bp.joints||[]).filter(j=>selected.has(j.childA)&&selected.has(j.childB)).map(j=>{const c=structuredClone(j);jointIds.set(j.id,next);c.id=next++;if(c.controller){controllerIds.set(c.controller.id,next);c.controller.id=next++;}c.childA=map.get(j.childA);c.childB=map.get(j.childB);c.posA=obj(add(vec(c.posA),translation));c.posB=obj(add(vec(c.posB),translation));return c;});
 for(const c of [...clones,...joints]){if(c.joints)c.joints=c.joints.filter(r=>jointIds.has(r.id)).map(r=>({...r,id:jointIds.get(r.id)}));if(c.controller)for(const k of ['controllers','joints','steering'])if(c.controller[k]){const ids=k==='controllers'?controllerIds:jointIds;c.controller[k]=c.controller[k].filter(r=>ids.has(r.id)).map(r=>({...r,id:ids.get(r.id)}));}}
 out.joints=[...(out.joints||[]),...joints];return {blueprint:out,selection:[...map.values()]};
}
export function deleteSelection(bp,indices){
 const out=structuredClone(bp),selected=new Set(indices),map=new Map();let old=0,n=0;
 for(const b of out.bodies)b.childs=b.childs.filter(()=>{const i=old++;if(selected.has(i))return false;map.set(i,n++);return true;});out.bodies=out.bodies.filter(b=>b.childs.length);
 out.joints=(out.joints||[]).filter(j=>map.has(j.childA)&&map.has(j.childB)).map(j=>({...j,childA:map.get(j.childA),childB:map.get(j.childB)}));
 const flat=flatten(out),all=[...flat,...out.joints],jointIds=new Set(out.joints.map(j=>j.id)),controllerIds=new Set(all.filter(s=>s.controller).map(s=>s.controller.id));
 for(const s of all){if(s.joints)s.joints=s.joints.filter(r=>jointIds.has(r.id));if(s.controller)for(const [k,set]of [['controllers',controllerIds],['joints',jointIds],['steering',jointIds]])if(s.controller[k])s.controller[k]=s.controller[k].filter(r=>set.has(r.id));}return out;
}
export function engineGear(controller,value){
 if('gear' in controller){if(value!==undefined)controller.gear=value;return controller.gear;}
 return storageGear(controller,value);
}
export function controllerFamily(d){if(d.thruster||d.survivalThruster)return 'thruster';return d.scripted?.classname||(['sensor','survivalSensor','logic','timer','engine','electricEngine','gasEngine','controller','survivalController','sequence','survivalSequence','lever','button','spotlight','seat'].find(k=>d[k])||'');}
export function replaceParts(bp,indices,id,catalog){
 const out=structuredClone(bp),d=catalog.get(id);if(!d||d.bearing||d.spring||d.survivalSpring||d.piston||d.survivalPiston)throw Error('Choose an ordinary block or part.');
 for(const i of indices){const s=flatten(out)[i],old=catalog.get(s.shapeId);if((s.controller||d.connection)&&controllerFamily(old)!==controllerFamily(d))throw Error('Interactive replacements must use the same controller family to preserve native state.');s.shapeId=id;if(['block','wedge'].includes(d.kind)){s.bounds??={x:1,y:1,z:1};checkBounds(d,s.bounds);}else delete s.bounds;}
 return out;
}


