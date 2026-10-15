import fs from 'node:fs';
import {Vector3} from 'three';
import {ConvexGeometry} from 'three/addons/geometries/ConvexGeometry.js';
import {assetPath} from './assets.mjs';
// OBJ collision files are often convex point clouds, rather than triangle meshes.
// ConvexGeometry reconstructs their hull. Margin and engine scaling stay disclosed.
export function enrichMassAssets(catalog){for(const d of catalog.values())if(d.hull?.col?.endsWith('.obj'))try{
 const source=fs.readFileSync(assetPath(d.hull.col),'utf8');const vertices=[...source.matchAll(/^v\s+([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)/gm)].map(m=>new Vector3(...m.slice(1).map(Number)));if(vertices.length<4)continue;
 // Some native collision OBJs (screws and plates) are planar point clouds.
 // QuickHull cannot enclose them: the former fallback became a full block-sized
 // cube, grounding axle screws and jamming wheels. Give only those surfaces a
 // 1 mm total numerical thickness; retain the separate, estimated bounds mass.
 let plane=null;
 for(let i=1;i<vertices.length-1&&!plane;i++){const n=vertices[i].clone().sub(vertices[0]).cross(vertices[i+1].clone().sub(vertices[0]));if(n.lengthSq()>1e-12)plane=n.normalize();}
 const planar=plane&&vertices.every(p=>Math.abs(p.clone().sub(vertices[0]).dot(plane))<1e-6);
 const hullPoints=planar?vertices.flatMap(p=>[-.002,.002].map(t=>p.clone().addScaledVector(plane,t))):vertices;
 const g=new ConvexGeometry(hullPoints),a=g.attributes.position;let volume=0,c=[0,0,0];const points=new Map(),normals=new Map(),edges=new Map();
 const direction=(map,v)=>{if(v.lengthSq()<1e-12)return;v.normalize();const first=v.toArray().find(n=>Math.abs(n)>1e-7);if(first<0)v.negate();map.set(v.toArray().map(n=>n.toFixed(6)).join(','),v.toArray());};
 for(let i=0;i<a.count;i+=3){const p=new Vector3().fromBufferAttribute(a,i),q=new Vector3().fromBufferAttribute(a,i+1),r=new Vector3().fromBufferAttribute(a,i+2),v=p.dot(q.clone().cross(r))/6;volume+=v;for(const point of [p,q,r])points.set(point.toArray().join(','),point.toArray());direction(normals,q.clone().sub(p).cross(r.clone().sub(p)));for(const [u,w]of [[p,q],[q,r],[r,p]])direction(edges,w.clone().sub(u));const sum=p.clone().add(q).add(r).multiplyScalar(v/4);c=c.map((n,k)=>n+sum.getComponent(k));}
 g.dispose();if(Math.abs(volume)>1e-8){if(!planar)d.massGeometry={volume:Math.abs(volume),center:c.map(n=>n/volume),approximate:true};d.collisionHull={vertices:[...points.values()],normals:[...normals.values()],edges:[...edges.values()],...(planar?{surfaceThicknessBlocks:.004}:{})};}
 }catch{}return catalog;}
