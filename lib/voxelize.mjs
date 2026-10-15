// Shared by the browser worker and Node. No rendering, filesystem or AI service.
import {IMPORT_ADVISORIES,importResourceWarnings,acknowledgeImportResources} from './import-resources.mjs';
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const fail=s=>{throw Error(s);};
function barycentric(p,a,b,c){
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return [1,0,0];
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return [0,1,0];
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return [1-v,v,0];}
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return [0,0,1];
 const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return [1-w,0,w];}
 const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/(d4-d3+d5-d6);return [0,1-w,w];}
 const den=1/(va+vb+vc),v=vb*den,w=vc*den;return [1-v-w,v,w];
}
function wrap(v,mode){if(mode===1000)return v-Math.floor(v);if(mode===1002){const n=Math.floor(v);return Math.abs(n%2)===1?1-(v-n):v-n;}return clamp(v,0,1);}
function sample(tri,weights,textures,fallback,useColor){
 if(!useColor)return fallback;
 let rgb=[0,1,2].map(k=>weights.reduce((s,w,i)=>s+w*(tri.colors?.[i*3+k]??1),0)*(tri.color?.[k]??1));
 const t=textures[tri.texture];if(t&&tri.uv){let u=weights.reduce((s,w,i)=>s+w*tri.uv[i*2],0),v=weights.reduce((s,w,i)=>s+w*tri.uv[i*2+1],0);const m=t.matrix||[1,0,0,0,1,0,0,0,1];[u,v]=[m[0]*u+m[3]*v+m[6],m[1]*u+m[4]*v+m[7]];u=wrap(u,t.wrapS);v=wrap(v,t.wrapT);if(t.flipY)v=1-v;const i=(clamp(Math.floor(v*t.height),0,t.height-1)*t.width+clamp(Math.floor(u*t.width),0,t.width-1))*4;rgb=rgb.map((c,k)=>c*t.pixels[i+k]/255);}
 return rgb;
}
export function voxelize(model,options={},progress=()=>{}){
 if(!Array.isArray(model.triangles)||!model.triangles.length)fail('The model contains no mesh triangles.');
 const longest=options.longestSide??64;if(!Number.isSafeInteger(longest)||longest<1)fail('Longest side must be a positive whole number of blocks.');
 const fill=options.fill??'surface';if(!['surface','solid'].includes(fill))fail('Choose surface or solid filling.');
 const up=options.up??'Y';if(!['X','Y','Z'].includes(up))fail('Up axis must be X, Y or Z.');
 const turns=options.turns??0;if(!Number.isInteger(turns)||turns<0||turns>3)fail('Rotation must be 0, 1, 2 or 3 quarter turns.');
 const levels=options.colorLevels??16;if(!Number.isInteger(levels)||levels<2||levels>256)fail('Color levels must be 2–256.');
 const offset=options.offset??[0,0,0];if(!Array.isArray(offset)||offset.length!==3||!offset.every(Number.isInteger))fail('Offset must contain three integer block coordinates.');
 const paint=(options.color??'E7E9E7').replace('#','');if(!/^[0-9a-f]{6}$/i.test(paint))fail('Paint must be a six-digit hex color.');const fallback=[0,2,4].map(i=>parseInt(paint.slice(i,i+2),16)/255);
 const rotate=p=>{let q=up==='Y'?[p[0],-p[2],p[1]]:up==='X'?[-p[2],p[1],p[0]]:p;for(let i=0;i<turns;i++)q=[-q[1],q[0],q[2]];return q;};
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 const triangles=model.triangles.map(t=>{if(!Array.isArray(t.positions)||t.positions.length!==9||!t.positions.every(Number.isFinite))fail('Invalid mesh coordinates.');const p=[0,3,6].map(i=>rotate(t.positions.slice(i,i+3)));for(const v of p)for(let k=0;k<3;k++){min[k]=Math.min(min[k],v[k]);max[k]=Math.max(max[k],v[k]);}return {...t,p};});
 const span=max.map((v,i)=>v-min[i]),extent=Math.max(...span);if(!Number.isFinite(extent)||extent<=1e-10)fail('Model has no measurable size.');const scale=longest/extent,size=span.map(v=>Math.max(1,Math.ceil(v*scale-1e-8))),[nx,ny,nz]=size,total=nx*ny*nz;
 if(!Number.isSafeInteger(total))fail('Grid coordinates exceed JavaScript integer precision.');
 const resourceWarnings=options.warnResources===true?importResourceWarnings({triangles:triangles.length,cells:total,longestSide:longest}):[];
 acknowledgeImportResources(resourceWarnings,options);
 const noticed=new Set(),notice=(name,count,message)=>{if(options.warnResources===true&&count>IMPORT_ADVISORIES[name]&&!noticed.has(name)){noticed.add(name);resourceWarnings.push(message);progress({stage:'warning',message});}};
 const key=(x,y,z)=>x+nx*(y+ny*z),coords=i=>[i%nx,Math.floor(i/nx)%ny,Math.floor(i/(nx*ny))],occupied=new Map();let candidates=0,degenerate=0;
 for(let ti=0;ti<triangles.length;ti++){
  const tri=triangles[ti],p=tri.p.map(v=>v.map((n,k)=>(n-min[k])*scale)),edges=[sub(p[1],p[0]),sub(p[2],p[1]),sub(p[0],p[2])],normal=cross(edges[0],sub(p[2],p[0]));if(dot(normal,normal)<1e-16){degenerate++;continue;}
  const axes=[normal,...edges.flatMap(e=>[[0,e[2],-e[1]],[-e[2],0,e[0]],[e[1],-e[0],0]])].filter(a=>dot(a,a)>1e-16).map(a=>({a,lo:Math.min(...p.map(v=>dot(a,v))),hi:Math.max(...p.map(v=>dot(a,v))),r:a.reduce((s,v)=>s+Math.abs(v),0)*.5}));
  const lo=[0,1,2].map(k=>clamp(Math.floor(Math.min(...p.map(v=>v[k]))+1e-9),0,size[k]-1)),hi=[0,1,2].map(k=>clamp(Math.max(lo[k],Math.ceil(Math.max(...p.map(v=>v[k]))-1e-9)-1),0,size[k]-1));
  // On exact grid planes choose the inward cell for outward-wound faces.
  // This avoids an extra exterior layer on aligned interior objects.
  for(let k=0;k<3;k++)if(Math.max(...p.map(v=>v[k]))-Math.min(...p.map(v=>v[k]))<1e-8&&Math.abs(p[0][k]-Math.round(p[0][k]))<1e-8)lo[k]=hi[k]=clamp(Math.round(p[0][k])-(normal[k]>0?1:0),0,size[k]-1);
  candidates+=(hi[0]-lo[0]+1)*(hi[1]-lo[1]+1)*(hi[2]-lo[2]+1);notice('candidates',candidates,'Large rasterization workload; conversion may take longer.');
  for(let z=lo[2];z<=hi[2];z++)for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++){
   const center=[x+.5,y+.5,z+.5];if(axes.some(({a,lo,hi,r})=>{const d=dot(a,center);return d+r<lo-1e-8||d-r>hi+1e-8;}))continue;
   const w=barycentric(center,...p),point=[0,1,2].map(k=>w.reduce((s,v,i)=>s+v*p[i][k],0)),dist=dot(sub(center,point),sub(center,point)),id=key(x,y,z),old=occupied.get(id);
   if(old&&old.distance<=dist)continue;
   const rgb=sample(tri,w,model.textures||[],fallback,options.colors!==false),color=rgb.map(v=>Math.round(clamp(v,0,1)*(levels-1))*255/(levels-1)).map(v=>Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase();occupied.set(id,{color,distance:dist});notice('occupied',occupied.size,'Many occupied voxels; conversion and editing may use significant memory.');
  }
  if(ti%1000===0)progress({stage:'surface',fraction:ti/triangles.length});
 }
 if(!occupied.size)fail('No non-degenerate surfaces could be voxelized.');const surfaceVoxels=occupied.size;
 const neighbors=i=>{const [x,y,z]=coords(i),n=[];if(x)n.push(i-1);if(x<nx-1)n.push(i+1);if(y)n.push(i-nx);if(y<ny-1)n.push(i+nx);if(z)n.push(i-nx*ny);if(z<nz-1)n.push(i+nx*ny);return n;};
 let interiorVoxels=0;if(fill==='solid'){
  progress({stage:'fill',fraction:0});const mask=new Uint8Array(total),queue=[];for(const i of occupied.keys())mask[i]=1;let head=0;for(let i=0;i<total;i++){if(mask[i])continue;const [x,y,z]=coords(i);if(x===0||x===nx-1||y===0||y===ny-1||z===0||z===nz-1){mask[i]=2;queue.push(i);}}
  while(head<queue.length)for(const n of neighbors(queue[head++]))if(!mask[n]){mask[n]=2;queue.push(n);}
  const innerColor=fallback.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('').toUpperCase();for(let i=0;i<total;i++)if(!mask[i]){occupied.set(i,{color:innerColor});mask[i]=1;interiorVoxels++;notice('occupied',occupied.size,'Many filled voxels; conversion and editing may use significant memory.');}
 }
 // Six-neighbor connectivity matches positive-area block face welding.
 progress({stage:'connectivity',fraction:0});const components=[],visited=new Set();for(const start of occupied.keys())if(!visited.has(start)){let head=0;const group=[start];visited.add(start);while(head<group.length){const i=group[head++];for(const n of neighbors(i))if(occupied.has(n)&&!visited.has(n)){visited.add(n);group.push(n);}}components.push(group);}components.sort((a,b)=>b.length-a.length);
 let removedVoxels=0;if(options.largestOnly&&components.length>1)for(const group of components.slice(1))for(const i of group){occupied.delete(i);removedVoxels++;}
 const remaining=new Map(occupied),blocks=[];progress({stage:'merge',fraction:0});
 for(const i of [...remaining.keys()].sort((a,b)=>a-b)){
  const value=remaining.get(i);if(!value)continue;const [x,y,z]=coords(i),color=value.color;let w=1,d=1,h=1;const same=(a,b,c)=>remaining.get(key(a,b,c))?.color===color;
  while(x+w<nx&&same(x+w,y,z))w++;
  while(y+d<ny&&Array.from({length:w},(_,a)=>same(x+a,y+d,z)).every(Boolean))d++;
  while(z+h<nz){let match=true;for(let a=0;a<w&&match;a++)for(let b=0;b<d;b++)if(!same(x+a,y+b,z+h)){match=false;break;}if(!match)break;h++;}
  for(let a=x;a<x+w;a++)for(let b=y;b<y+d;b++)for(let c=z;c<z+h;c++)remaining.delete(key(a,b,c));
  blocks.push({pos:[x+offset[0],y+offset[1],z+offset[2]],bounds:[w,d,h],color});notice('records',blocks.length,'Many block cuboids; the editor and game may take longer to load.');
 }
 return {blocks,stats:{triangles:triangles.length,degenerateTriangles:degenerate,grid:size,surfaceVoxels,interiorVoxels,voxels:occupied.size,cuboids:blocks.length,colors:new Set(blocks.map(b=>b.color)).size,components:options.largestOnly?1:components.length,componentSizes:components.map(g=>g.length),removedVoxels,sourceBounds:{min,max},scaleBlocksPerSourceUnit:scale},warnings:[...(model.warnings||[]),...resourceWarnings,...(components.length>1?[options.largestOnly?'Kept the largest island; '+removedVoxels+' voxels removed.':components.length+' face-disconnected islands remain. Bridge, delete or separate them before spawning.']:[]),...(fill==='solid'?['Solid fill requires a closed shell; holes can leak and enclosed cavities are filled.']:[]),'Static block geometry only. Animation, rigging, physics, doors and wiring are not converted.','Colors are sampled into block paint; transparency, PBR shading and exact textures are not preserved.'],engineVerified:false};
}
export function voxelBlueprint(result,shapeId){return {version:4,bodies:[{childs:result.blocks.map(s=>({shapeId,color:s.color,pos:{x:s.pos[0],y:s.pos[1],z:s.pos[2]},bounds:{x:s.bounds[0],y:s.bounds[1],z:s.bounds[2]},xaxis:1,zaxis:3}))}],joints:[]};}
