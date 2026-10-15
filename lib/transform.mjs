import {basis,rotate,axis,vec,obj,add,sub,jointOrigin} from './geometry.mjs';
const encode=v=>{const i=v.findIndex(n=>n!==0);return (i+1)*Math.sign(v[i]);};
// Rigidly transform an entire assembly, preserving body ordering and references.
// Joint positions need a cell-corner correction before and after rotation.
export function transformBlueprint(bp,{xaxis=1,zaxis=3,translation=[0,0,0]}={}){
 const result=structuredClone(bp),R=basis(xaxis,zaxis),t=vec(translation);
 const axes=(x,z)=>[encode(rotate(R,axis(x))),encode(rotate(R,axis(z)))];
 for(const body of result.bodies)for(const s of body.childs){s.pos=obj(add(rotate(R,vec(s.pos)),t));[s.xaxis,s.zaxis]=axes(s.xaxis,s.zaxis);}
 for(const j of result.joints||[])for(const side of ['A','B']){if(j['child'+side]===-1)continue;const x=j['xaxis'+side],z=j['zaxis'+side],origin=jointOrigin(j['pos'+side],x,z),[nx,nz]=axes(x,z),offset=jointOrigin({x:0,y:0,z:0},nx,nz);j['pos'+side]=obj(sub(add(rotate(R,origin),t),offset));j['xaxis'+side]=nx;j['zaxis'+side]=nz;}
 return result;
}
