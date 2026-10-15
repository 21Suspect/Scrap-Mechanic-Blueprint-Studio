import {Matrix4} from 'three';
import {dimensions,basis,rotate,vec,add,dot,cross} from './geometry.mjs';

const identity=new Matrix4();
const normalize=a=>{const n=Math.hypot(...a);return n>1e-8?a.map(v=>v/n):null;};
const sameMatrix=(a,b)=>a.elements.every((v,i)=>Math.abs(v-b.elements[i])<1e-8);
const point=(p,m)=>{const e=m.elements;return [e[0]*p[0]+e[4]*p[1]+e[8]*p[2]+e[12],e[1]*p[0]+e[5]*p[1]+e[9]*p[2]+e[13],e[2]*p[0]+e[6]*p[1]+e[10]*p[2]+e[14]];};
const direction=(p,m)=>{const e=m.elements;return [e[0]*p[0]+e[4]*p[1]+e[8]*p[2],e[1]*p[0]+e[5]*p[1]+e[9]*p[2],e[2]*p[0]+e[6]*p[1]+e[10]*p[2]];};
const axes=[[1,0,0],[0,1,0],[0,0,1]];

export function collisionSolid(shape,def){
 const [w,d,h]=dimensions(shape,def),size=[w,d,h];
 let vertices,normals=axes,edges=axes,approximate=false,method='native box';
 if(def?.kind==='wedge'||def?.wedge?.bottom==='-Y'&&def?.wedge?.back==='-Z'){
  vertices=[[0,0,0],[w,0,0],[0,d,0],[w,d,0],[0,0,h],[w,0,h]];
  normals=[...axes,normalize([0,h,d])];edges=[...axes,normalize([0,d,-h])];method='native wedge';
 }else if(def?.collisionHull){
  vertices=def.collisionHull.vertices.map(p=>p.map((v,i)=>v+size[i]/2));
  normals=def.collisionHull.normals;edges=def.collisionHull.edges;approximate=true;method='native OBJ convex hull';
 }else if(def?.cylinder){
  const k='XYZ'.indexOf(def.cylinder.axis),u=(k+1)%3,v=(k+2)%3,n=64,r=def.cylinder.diameter/2/Math.cos(Math.PI/n);
  vertices=[];normals=[axes[k]];edges=[axes[k]];
  for(let i=0;i<n;i++){
   const angle=2*Math.PI*i/n,normal=[0,0,0],edge=[0,0,0];normal[u]=Math.cos(angle+Math.PI/n);normal[v]=Math.sin(angle+Math.PI/n);edge[u]=-normal[v];edge[v]=normal[u];normals.push(normal);edges.push(edge);
   for(const end of [0,size[k]]){const p=size.map(s=>s/2);p[k]=end;p[u]+=r*Math.cos(angle);p[v]+=r*Math.sin(angle);vertices.push(p);}
  }
  approximate=true;method='conservative 64-sided native cylinder';
 }else{
  vertices=[0,w].flatMap(x=>[0,d].flatMap(y=>[0,h].map(z=>[x,y,z])));
  approximate=!!def?.hull||!def||(!def.box&&def.kind!=='block');
  if(approximate)method='conservative collision bounds';
 }
 const R=basis(shape.xaxis,shape.zaxis),origin=vec(shape.pos);
 return {vertices:vertices.map(p=>add(origin,rotate(R,p))),normals:normals.map(p=>rotate(R,p)),edges:edges.map(p=>rotate(R,p)),approximate,method};
}

function transformSolid(s,m){
 const vertices=s.vertices.map(p=>point(p,m)),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const p of vertices)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}
 return {...s,vertices,normals:s.normals.map(p=>direction(p,m)),edges:s.edges.map(p=>direction(p,m)),min,max};
}

// Positive-volume intersection: shared faces/edges are valid contact, not a hit.
export function convexIntersection(a,b,tolerance=.005){
 for(let k=0;k<3;k++)if(Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k])<=tolerance)return null;
 let depth=Infinity;
 const candidates=[...a.normals,...b.normals,...a.edges.flatMap(u=>b.edges.map(v=>cross(u,v)))];
 for(const candidate of candidates){const n=normalize(candidate);if(!n)continue;
  let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;
  for(const p of a.vertices){const t=dot(p,n);amin=Math.min(amin,t);amax=Math.max(amax,t);}
  for(const p of b.vertices){const t=dot(p,n);bmin=Math.min(bmin,t);bmax=Math.max(bmax,t);}
  const overlap=Math.min(amax,bmax)-Math.max(amin,bmin);if(overlap<=tolerance)return null;depth=Math.min(depth,overlap);
 }
 return {depthBlocks:depth,approximate:a.approximate||b.approximate};
}

export function collisionScene(blueprint,catalog){
 const lookup=id=>catalog instanceof Map?catalog.get(id):catalog[id];
 const bodies=blueprint.bodies.map(()=>[]),objects=[];let index=0;
 for(const [body,b]of blueprint.bodies.entries())for(const shape of b.childs){const def=lookup(shape.shapeId),o={...collisionSolid(shape,def),index:index++,body,title:def?.title||shape.shapeId,shapeId:shape.shapeId};objects.push(o);bodies[body].push(o);}
 const cached=blueprint.bodies.map(()=>({matrix:null,objects:[]}));
 return {objects,
  intersections(matrices,{movingOnly=true,tolerance=.005,limit=200}={}){
   const mats=matrices.map(m=>m instanceof Matrix4?m:new Matrix4().fromArray(m));
   const transformed=[];
   for(let body=0;body<bodies.length;body++){
    const c=cached[body],m=mats[body]||identity;if(!c.matrix||!sameMatrix(c.matrix,m)){c.matrix=m.clone();c.objects=bodies[body].map(o=>transformSolid(o,m));}transformed.push(...c.objects);
   }
   transformed.sort((a,b)=>a.min[0]-b.min[0]);const collisions=[];let truncated=false;
   outer:for(let i=0;i<transformed.length;i++)for(let j=i+1;j<transformed.length;j++){
    const a=transformed[i],b=transformed[j];if(b.min[0]>=a.max[0]-tolerance)break;
    if(a.body===b.body||movingOnly&&sameMatrix(mats[a.body]||identity,mats[b.body]||identity))continue;
    const hit=convexIntersection(a,b,tolerance);if(!hit)continue;
    collisions.push({a:a.index,b:b.index,bodyA:a.body,bodyB:b.body,titleA:a.title,titleB:b.title,methodA:a.method,methodB:b.method,...hit});
    if(collisions.length>=limit){truncated=true;break outer;}
   }
   return {collisions,truncated};
  }
 };
}
