import {shapeBox,jointAnchor,axis,add,scale,onShapeFace} from './geometry.mjs';
// Resolve overlapping generated block cuboids by painting their integer cells in
// recipe order, then merge X runs. Native parts remain untouched. Rebind bearing
// supports to the block that now owns the attachment cell.
export function weldBlockVolumes(bp,catalog){
 const out=structuredClone(bp),old=bp.bodies.flatMap(b=>b.childs),oldBodies=bp.bodies.flatMap((b,i)=>b.childs.map(()=>i)),partMap=new Map();let oldIndex=0;
 out.bodies=bp.bodies.map(body=>{const cells=new Map(),parts=[];
 for(const s of body.childs){const index=oldIndex++;if(catalog.get(s.shapeId)?.kind!=='block'){const c=structuredClone(s);delete c.joints;partMap.set(index,c);parts.push(c);continue;}const box=shapeBox(s,catalog.get(s.shapeId));
 for(let z=box.min[2];z<box.max[2];z++)for(let y=box.min[1];y<box.max[1];y++)for(let x=box.min[0];x<box.max[0];x++)cells.set([x,y,z].join(','),{x,y,z,shapeId:s.shapeId,color:s.color});}
 const ordered=[...cells.values()].sort((a,b)=>a.z-b.z||a.y-b.y||a.x-b.x),runs=[];for(const c of ordered){const last=runs.at(-1);if(last&&last.shapeId===c.shapeId&&last.color===c.color&&last.pos.y===c.y&&last.pos.z===c.z&&last.pos.x+last.bounds.x===c.x)last.bounds.x++;else runs.push({shapeId:c.shapeId,color:c.color,pos:{x:c.x,y:c.y,z:c.z},bounds:{x:1,y:1,z:1},xaxis:1,zaxis:3});}return {childs:[...runs,...parts]};});
 const flat=out.bodies.flatMap(b=>b.childs);
 for(const j of out.joints||[])for(const side of ['A','B']){const index=j['child'+side];let c=partMap.get(index);if(!c){const anchor=jointAnchor(j,side),point=add(anchor,scale(axis(j['zaxis'+side]),side==='A'?-.01:.01));c=out.bodies[oldBodies[index]].childs.find(s=>{if(catalog.get(s.shapeId)?.kind!=='block')return false;const b=shapeBox(s,catalog.get(s.shapeId));return point.every((v,i)=>v>b.min[i]&&v<b.max[i])&&onShapeFace(anchor,s,catalog.get(s.shapeId));});}if(!c)throw Error('No welded support for joint '+j.id+' endpoint '+side);j['child'+side]=flat.indexOf(c);(c.joints??=[]).push({id:j.id});}
 return out;
}
