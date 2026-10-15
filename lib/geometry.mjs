export const vec=p=>Array.isArray(p)?p:[p.x,p.y,p.z];
export const obj=v=>({x:v[0],y:v[1],z:v[2]});
export const add=(a,b)=>a.map((v,i)=>v+b[i]);
export const sub=(a,b)=>a.map((v,i)=>v-b[i]);
export const scale=(v,s)=>v.map(x=>x*s);
export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function axis(n){if(!Number.isInteger(n)||n===0||Math.abs(n)>3)throw Error('Axis must be one of -3,-2,-1,1,2,3');return [1,2,3].map(i=>Math.abs(n)===i?Math.sign(n):0);}
export function basis(x,z){if(Math.abs(x)===Math.abs(z))throw Error('X and Z must be perpendicular');const X=axis(x),Z=axis(z);return [X,cross(Z,X),Z];}
export const rotate=(b,v)=>[0,1,2].map(i=>b.reduce((s,col,j)=>s+col[i]*v[j],0));
export const inverse=(b,v)=>b.map(col=>dot(col,v));
export const ROTATIONS=[-3,-2,-1,1,2,3].flatMap(x=>[-3,-2,-1,1,2,3].filter(z=>Math.abs(x)!==Math.abs(z)).map(z=>({xaxis:x,zaxis:z,basis:basis(x,z)})));
export function dimensions(shape,def){if(shape.bounds)return vec(shape.bounds);if(def?.box)return vec(def.box);if(def?.cylinder){const c=def.cylinder;return ['X','Y','Z'].map(k=>k===c.axis?c.depth:c.diameter);}if(def?.hull)return vec(def.hull);if(def?.wedge)return vec(def.wedge);return [1,1,1];}
// Shape positions are oriented corners. Joint positions are minimum corners of a
// rotated unit cell, requiring one unit of correction along each negative row.
export function jointOrigin(pos,x,z){const b=basis(x,z);return add(vec(pos),[0,1,2].map(i=>b.some(col=>col[i]<0)?1:0));}
export function shapeCenter(shape,def){return add(vec(shape.pos),rotate(basis(shape.xaxis,shape.zaxis),scale(dimensions(shape,def),.5)));}
export function shapeBox(shape,def){const b=basis(shape.xaxis,shape.zaxis),p=vec(shape.pos),d=rotate(b,dimensions(shape,def));return {min:p.map((v,i)=>Math.min(v,v+d[i])),max:p.map((v,i)=>Math.max(v,v+d[i]))};}
export function jointAnchor(j,side){const x=j['xaxis'+side],z=j['zaxis'+side],b=basis(x,z);return add(jointOrigin(j['pos'+side],x,z),rotate(b,[.5,.5,0]));}
export function onShapeFace(point,shape,def,tolerance=1e-5){const q=inverse(basis(shape.xaxis,shape.zaxis),sub(point,vec(shape.pos))),d=dimensions(shape,def);return q.every((v,i)=>v>=-tolerance&&v<=d[i]+tolerance)&&q.some((v,i)=>Math.abs(v)<tolerance||Math.abs(v-d[i])<tolerance);}
