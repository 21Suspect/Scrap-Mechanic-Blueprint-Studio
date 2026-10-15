import {basis,rotate,vec,add,obj} from './geometry.mjs';
import {WEDGE_MAX} from './shape-rules.mjs';
// Tile an oversized prism on the native integer grid. Extrusion splits exactly.
// When the original slope has no integer vertices within 8 blocks, rounding its
// breakpoints introduces at most half a block of profile error; never silently
// claim exact geometry for such a slope. Rectangles beneath slopes use its block.
export function wedgePieces(def,position,bounds,options={}){
 const [w,d,h]=vec(bounds),R=basis(options.xaxis??1,options.zaxis??3),pieces=[];
 const count=Math.max(Math.ceil(d/WEDGE_MAX),Math.ceil(h/WEDGE_MAX));
 const nodes=Array.from({length:count+1},(_,i)=>[Math.round(i*d/count),Math.round(h*(1-i/count))]);
 if(nodes.some((v,i)=>i&&v[0]===nodes[i-1][0]))throw Error('Slope needs a native-game template; grid subdivision is too steep.');
 const put=(id,p,size)=>pieces.push({shapeId:id,pos:obj(add(vec(position),rotate(R,p))),xaxis:options.xaxis??1,zaxis:options.zaxis??3,color:options.color||def.color||'DF7F01',bounds:obj(size)});
 for(let x=0;x<w;x+=WEDGE_MAX){const width=Math.min(WEDGE_MAX,w-x);for(let i=1;i<nodes.length;i++){const [y,top]=nodes[i-1],[end,base]=nodes[i],depth=end-y,height=top-base;
  if(base>0)put(def.blockUuid,[x,y,0],[width,depth,base]);
  if(height>0)put(def.uuid,[x,y,base],[width,depth,height]);
 }}
 return {pieces,profileError:Math.max(...nodes.map(([y,z])=>Math.abs(z-h*(1-y/d))))};
}
