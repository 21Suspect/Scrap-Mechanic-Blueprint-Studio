import {Matrix4,Vector3} from 'three';
import {collisionSolid} from './collision-geometry.mjs';
import {axis,shapeCenter,dimensions} from './geometry.mjs';
const identity=new Matrix4();
// Clip a ray against the convex collision solid's supporting planes.
function hit(solid,origin,direction,range){
 let enter=0,exit=range;
 for(const {normal,limit} of solid.planes){const distance=limit-origin.dot(normal),speed=direction.dot(normal);
  if(Math.abs(speed)<1e-9){if(distance<0)return null;continue;}
  const t=distance/speed;if(speed>0)exit=Math.min(exit,t);else enter=Math.max(enter,t);if(enter>exit)return null;
 }return exit>=0&&enter<=range?Math.max(0,enter):null;
}
export class SensorPreview{
 constructor(preview){this.p=preview;this.cache=new Map();this.history=new Map();this.readings=new Map();this.sensors=preview.flat.map((s,i)=>({s,i,d:preview.def(s.shapeId)})).filter(({s,d})=>s.controller&&(d?.sensor||d?.survivalSensor));}
 update(){const p=this.p;if(!this.sensors.length)return;const matrices=p.sensorMatrices?.()||p.matrices;
 for(const {s,i,d} of this.sensors){const c=s.controller,id=c.id,m=matrices?.[p.bodyOf[i]]||identity,dir=new Vector3(...axis(s.zaxis)),origin=new Vector3(...shapeCenter(s,d)).addScaledVector(dir,dimensions(s,d)[2]/2+1e-5).applyMatrix4(m);dir.transformDirection(m);const range=Math.max(0,Number(c.range??10));let nearest=null;
 for(let j=0;j<p.flat.length;j++){if(i===j)continue;const target=p.flat[j];let solid=this.cache.get(j);if(!solid){solid=collisionSolid(target,p.def(target.shapeId));solid.planes=solid.normals.flatMap(n=>[-1,1].map(sign=>{const normal=new Vector3(...n).multiplyScalar(sign);return {normal,limit:Math.max(...solid.vertices.map(v=>normal.x*v[0]+normal.y*v[1]+normal.z*v[2]))};}));this.cache.set(j,solid);}const inverse=(matrices?.[p.bodyOf[j]]||identity).clone().invert(),o=origin.clone().applyMatrix4(inverse),v=dir.clone().transformDirection(inverse),distance=hit(solid,o,v,range);if(distance!==null&&(!nearest||distance<nearest.distance))nearest={index:j,distance,color:target.color||p.def(target.shapeId)?.color,approximate:solid.approximate};}
 const detected=!!nearest&&(!c.colorMode||String(nearest.color).replace('#','').toLowerCase()===String(c.color).replace('#','').toLowerCase()),previous=this.history.get(id)||{detected:false,active:!!c.active};
 const active=c.buttonMode!==false?detected:detected&&!previous.detected?!previous.active:previous.active;
 this.history.set(id,{detected,active});this.readings.set(id,{detected,active,hit:nearest,origin:origin.toArray(),direction:dir.toArray(),range,manualOverride:p.inputs.has(id)});
 } }
}
