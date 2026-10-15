import {basis,rotate,dimensions,vec,add,scale,jointOrigin} from './geometry.mjs';
export const BLOCK_METERS=.25;
export function shapeMass(shape,def,measurement){
 if(!def)return null;
 const dim=dimensions(shape,def),R=basis(shape.xaxis,shape.zaxis);
 const density=Number.isFinite(def.density)?def.density:Number.isFinite(def.ratings?.density)?def.ratings.density*125:null;
 let volume=dim.reduce((a,b)=>a*b,1),local=dim.map(v=>v/2),source='collision bounds',approximate=true;
 if(def.kind==='block'){source='block volume';approximate=false;}
 else if(def.kind==='wedge'){volume/=2;local=[dim[0]/2,dim[1]/3,dim[2]/3];source='wedge volume and centroid';approximate=false;}
 else if(def.cylinder){volume*=Math.PI/4;source='cylinder volume';approximate=false;}
 else if(def.massGeometry){volume=def.massGeometry.volume;local=add(dim.map(v=>v/2),def.massGeometry.center);source='native collision convex hull';approximate=def.massGeometry.approximate;}
 let mass=density===null?null:density*volume*BLOCK_METERS**3;
 let exact=!approximate&&Number.isFinite(def.density);
 if(measurement){if(Number.isFinite(measurement.massKg)&&measurement.massKg>=0&&Array.isArray(measurement.localCenter)&&measurement.localCenter.length===3&&measurement.localCenter.every(Number.isFinite)){mass=measurement.massKg;local=measurement.localCenter;source='native engine measurement';exact=true;}}
 if(mass===null)return null;
 const origin=shape.pos?vec(shape.pos):jointOrigin(shape.posA,shape.xaxis,shape.zaxis);
 return {massKg:mass,center:add(origin,rotate(R,local)),localCenter:local,volumeM3:volume*BLOCK_METERS**3,densityKgM3:density,exact,source,approximate,shapeId:def.uuid};
}
export function measurementKey(shape){return shape.shapeId+':'+(shape.bounds?['x','y','z'].map(k=>shape.bounds[k]).join('x'):'part');}
export function centerOfMass(bp,catalog,{measurements={},bodyTransforms}={}){
 const get=id=>catalog instanceof Map?catalog.get(id):catalog[id],items=[],missing=[],bodies=bp.bodies.map(()=>({massKg:0,weighted:[0,0,0]}));let index=0;
 for(let bi=0;bi<bp.bodies.length;bi++)for(const shape of bp.bodies[bi].childs){const def=get(shape.shapeId),p=shapeMass(shape,def,measurements[measurementKey(shape)]);if(p)items.push({...p,body:bi,index:index++});else missing.push(index++);}
 const flat=bp.bodies.flatMap(b=>b.childs),bodyOf=[];bp.bodies.forEach((b,bi)=>b.childs.forEach(()=>bodyOf.push(bi)));
 for(const j of bp.joints||[]){const def=get(j.shapeId);try{const s={...j,pos:undefined,xaxis:j.xaxisA,zaxis:j.zaxisA};const p=shapeMass(s,def,measurements[measurementKey(s)]);if(p)items.push({...p,body:bodyOf[j.childA]??0,index:'j'+j.id});else missing.push('j'+j.id);}catch{missing.push('j'+j.id);}}
 let total=0,weighted=[0,0,0];for(const p of items){const c=bodyTransforms?.[p.body]?bodyTransforms[p.body](p.center):p.center;total+=p.massKg;for(let k=0;k<3;k++){weighted[k]+=c[k]*p.massKg;bodies[p.body].weighted[k]+=c[k]*p.massKg;}bodies[p.body].massKg+=p.massKg;}
 const exact=missing.length===0&&items.every(p=>p.exact);
 return {massKg:total,center:total>0?weighted.map(n=>n/total):null,bodies:bodies.map(b=>({massKg:b.massKg,center:b.massKg?b.weighted.map(n=>n/b.massKg):null})),exact,engineVerified:false,measurementBacked:items.length>0&&items.every(p=>p.source==='native engine measurement'),missing,coverage:items.length/(items.length+missing.length||1),items,limitations:exact?['Declared/imported mass and centroid data have not been independently verified in the native engine.']:['Density ratings use the 125 kg/m³-per-level mapping; not verified against this engine build.','Hull margins, joint mass allocation, inventories, players and opaque controller storage can change native mass.','Import engine mass/centroid measurements for a measurement-backed result.']};
}
export function validateMeasurements(input){if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Expected a mass measurement map.');for(const [key,m]of Object.entries(input)){if(!/^[\da-f-]{36}:(part|\d+x\d+x\d+)$/i.test(key)||!Number.isFinite(m?.massKg)||m.massKg<0||!Array.isArray(m.localCenter)||m.localCenter.length!==3||!m.localCenter.every(Number.isFinite))throw Error('Each measurement needs a UUID:size key, massKg and localCenter [x,y,z] in block units from the oriented corner.');}return input;}
