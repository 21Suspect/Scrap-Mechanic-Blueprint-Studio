import {basis,dimensions,shapeBox,inverse,axis,rotate,vec,add} from './geometry.mjs';
function facePolygon(shape,def,k,sign){
 const box=shapeBox(shape,def),axes=[0,1,2].filter(i=>i!==k),plane=box[sign<0?'min':'max'][k];
 if(def?.kind!=='wedge')return [[box.min[axes[0]],box.min[axes[1]]],[box.max[axes[0]],box.min[axes[1]]],[box.max[axes[0]],box.max[axes[1]]],[box.min[axes[0]],box.max[axes[1]]]];
 const [w,d,h]=dimensions(shape,def),R=basis(shape.xaxis,shape.zaxis);
 const points=[[0,0,0],[w,0,0],[0,d,0],[w,d,0],[0,0,h],[w,0,h]].map(p=>add(vec(shape.pos),rotate(R,p))).filter(p=>Math.abs(p[k]-plane)<1e-6).map(p=>axes.map(i=>p[i]));
 if(points.length<3)return [];
 const center=points.reduce((a,p)=>a.map((v,i)=>v+p[i]/points.length),[0,0]);return points.sort((a,b)=>Math.atan2(a[1]-center[1],a[0]-center[0])-Math.atan2(b[1]-center[1],b[0]-center[0]));
}
function polygonIntersection(subject,clip){
 if(subject.length<3||clip.length<3)return 0;let output=subject;
 for(let i=0;i<clip.length;i++){
 const a=clip[i],b=clip[(i+1)%clip.length],signed=p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]),input=output;output=[];
 for(let j=0;j<input.length;j++){const p=input[j],q=input[(j+1)%input.length],P=signed(p),Q=signed(q);if(P>=-1e-7)output.push(p);if((P<0)!==(Q<0)){const t=P/(P-Q);output.push(p.map((v,k)=>v+(q[k]-v)*t));}}
 }
 return Math.abs(output.reduce((n,p,i)=>{const q=output[(i+1)%output.length];return n+p[0]*q[1]-q[0]*p[1];},0)/2);
}
export function stickyFace(shape,def,worldAxis,sign){
 if(def?.kind==='block')return true;
 if(typeof def?.sticky!=='string')return null;
 const local=inverse(basis(shape.xaxis,shape.zaxis),axis((worldAxis+1)*sign)),k=local.findIndex(v=>v!==0);
 return def.sticky.includes((local[k]>0?'+':'-')+'XYZ'[k]);
}
// Positive-area face contact only. Edge/corner contact never joins components.
// Bounds for curved/hull shapes are conservative; this is not collision simulation.
export function attachmentAudit(bp,catalog){
 const groups=[],overlaps=[];let offset=0;
 for(const [bi,body] of bp.bodies.entries()){
 const shapes=body.childs,boxes=shapes.map(s=>shapeBox(s,catalog.get(s.shapeId))),parent=shapes.map((_,i)=>i),root=i=>{let r=i;while(parent[r]!==r)r=parent[r];while(parent[i]!==i){const n=parent[i];parent[i]=r;i=n;}return r;};
 const faces=new Map();
 boxes.forEach((box,i)=>{for(let k=0;k<3;k++)for(const sign of [-1,1]){const p=box[sign<0?'min':'max'][k],key=k+':'+p;if(!faces.has(key))faces.set(key,[]);faces.get(key).push({i,k,sign});}});
 for(const list of faces.values()){
 const tangents=[0,1,2].filter(k=>k!==list[0].k);
 const spread=k=>{let lo=Infinity,hi=-Infinity;for(const f of list){lo=Math.min(lo,boxes[f.i].min[k]);hi=Math.max(hi,boxes[f.i].min[k]);}return hi-lo;};
 const sweep=spread(tangents[0])>=spread(tangents[1])?tangents[0]:tangents[1];
 list.sort((a,b)=>boxes[a.i].min[sweep]-boxes[b.i].min[sweep]);
 for(let a=0;a<list.length;a++)for(let b=a+1;b<list.length;b++){
 if(boxes[list[b].i].min[sweep]>=boxes[list[a].i].max[sweep])break;
 const x=list[a],y=list[b];if(x.i===y.i||x.sign===y.sign)continue;
 const A=boxes[x.i],B=boxes[y.i];if(![0,1,2].filter(k=>k!==x.k).every(k=>Math.min(A.max[k],B.max[k])-Math.max(A.min[k],B.min[k])>1e-6))continue;
 if(stickyFace(shapes[x.i],catalog.get(shapes[x.i].shapeId),x.k,x.sign)===false||stickyFace(shapes[y.i],catalog.get(shapes[y.i].shapeId),y.k,y.sign)===false)continue;
 const dx=catalog.get(shapes[x.i].shapeId),dy=catalog.get(shapes[y.i].shapeId);
 if((dx?.kind==='wedge'||dy?.kind==='wedge')&&polygonIntersection(facePolygon(shapes[x.i],dx,x.k,x.sign),facePolygon(shapes[y.i],dy,y.k,y.sign))<1e-6)continue;
 parent[root(x.i)]=root(y.i);
 }
 }
 const components=new Map();shapes.forEach((_,i)=>{const r=root(i);if(!components.has(r))components.set(r,[]);components.get(r).push(i+offset);});
 groups.push({body:bi,components:[...components.values()].sort((a,b)=>b.length-a.length)});offset+=shapes.length;
 }
 return {bodies:groups,disconnected:groups.filter(g=>g.components.length>1),approximation:'Positive-area box faces and native wedge polygons, with sticky directions. Other hull/curved contacts and unspecified definitions require native engine verification.'};
}


