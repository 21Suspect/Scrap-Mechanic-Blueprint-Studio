import {basis,rotate,vec,obj,add,sub,scale,inverse,dimensions,jointAnchor,axis} from './geometry.mjs';
// Split only the clicked cell, keeping the rest in at most six compact slabs.
export function splitBlockCell(bp,index,cell,catalog){
 const original=bp.bodies.flatMap(b=>b.childs)[index],def=catalog.get(original?.shapeId);if(def?.kind!=='block'||original.controller)throw Error('Expected an ordinary block volume');
 const size=dimensions(original,def);if(!cell.every((v,k)=>Number.isInteger(v)&&v>=0&&v<size[k]))throw Error('Cell outside block');
 const chunks=[],R=basis(original.xaxis,original.zaxis);
 const push=(lo,hi)=>{const dims=hi.map((n,k)=>n-lo[k]);if(dims.some(n=>n<=0))return;const s=structuredClone(original);s.pos=obj(add(vec(original.pos),rotate(R,lo)));s.bounds=obj(dims);delete s.joints;chunks.push(s);};
 const [x,y,z]=cell,[w,d,h]=size;
 push([0,0,0],[x,d,h]);push([x+1,0,0],[w,d,h]);push([x,0,0],[x+1,y,h]);push([x,y+1,0],[x+1,d,h]);push([x,y,0],[x+1,y+1,z]);push([x,y,z+1],[x+1,y+1,h]);push(cell,cell.map(v=>v+1));
 const out=structuredClone(bp),map=new Map();let old=0,next=0;
 for(const body of out.bodies){const result=[];for(const s of body.childs){const list=old===index?chunks:[s];map.set(old++,list.map(()=>next++));result.push(...list);}body.childs=result;}
 for(const j of out.joints||[])for(const side of ['A','B']){const oldId=j['child'+side];if(oldId===-1)continue;if(oldId===index){const probe=add(jointAnchor(j,side),scale(axis(j['zaxis'+side]),side==='A'?-.001:.001));const i=chunks.findIndex(s=>{const p=inverse(R,sub(probe,vec(s.pos))),d=vec(s.bounds);return p.every((v,k)=>v>=0&&v<d[k]);});if(i<0)throw Error('Could not preserve bearing support');j['child'+side]=map.get(index)[i];(chunks[i].joints??=[]).push({id:j.id});}else j['child'+side]=map.get(oldId)[0];}
 return {blueprint:out,index:map.get(index).at(-1),remap:map};
}
export function hitCell(shape,def,point){const d=dimensions(shape,def),p=inverse(basis(shape.xaxis,shape.zaxis),sub(point,vec(shape.pos)));return p.map((v,k)=>Math.max(0,Math.min(d[k]-1,Math.floor(v))));}
