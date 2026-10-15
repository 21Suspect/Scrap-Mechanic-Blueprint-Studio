import * as T from 'three';
import {basis,rotate} from '/lib/geometry.mjs';
import {isThruster,thrusterSetting} from '/lib/thrusters.mjs';

export function createThrusterFlames(ctx){
 let slots=[],generation=0;
 function clear(){generation++;for(const s of slots){s.group.removeFromParent();s.texture.dispose();s.material.dispose();s.geometry.dispose();}slots=[];}
 async function rebuild(){clear();const token=generation;
  await Promise.all(ctx.entries().filter(e=>isThruster(e.def)&&e.def.thrusterVisual).map(async e=>{
   const visual=e.def.thrusterVisual,base=await ctx.texture(visual.texture);if(token!==generation||!base)return;
   const texture=base.clone();texture.repeat.set(1/visual.tiles[0],1/visual.tiles[1]);texture.needsUpdate=true;
   const material=new T.MeshBasicMaterial({map:texture,color:new T.Color(...visual.color.slice(0,3)),transparent:true,blending:T.AdditiveBlending,side:T.DoubleSide,depthWrite:false,toneMapped:false});
   // Two crossing textured sheets form an axial plume, rooted at the native
   // effect offset. The native particle engine's turbulence is not emulated.
   const geometry=new T.PlaneGeometry(1,1);geometry.translate(0,.5,0);geometry.rotateX(Math.PI/2);
   const group=new T.Group(),a=new T.Mesh(geometry,material),b=new T.Mesh(geometry,material);b.rotation.z=Math.PI/2;group.add(a,b);
   const R=basis(e.shape.xaxis,e.shape.zaxis);group.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(...R.map(v=>new T.Vector3(...v))));
   group.position.copy(e.center).add(new T.Vector3(...rotate(R,visual.offsetMeters.map(v=>v*4))));group.visible=false;ctx.bodies()[e.body].add(group);
   group.updateMatrix();slots.push({e,visual,group,texture,material,geometry,baseMatrix:group.matrix.clone(),frame:0,on:false});
  }));
 }
 function update(states={},time=0){for(const s of slots){const {e,visual,group,texture}=s,on=!!states[e.shape.controller?.id];group.visible=on;s.on=on;if(!on)continue;
   const power=(thrusterSetting(e.shape,e.def).level+1)/7,frame=Math.floor(time*visual.fps)% (visual.tiles[0]*visual.tiles[1]);s.frame=frame;
   texture.offset.set((frame%visual.tiles[0])/visual.tiles[0],1-(Math.floor(frame/visual.tiles[0])+1)/visual.tiles[1]);
   const pulse=1+.06*Math.sin(time*43+e.shape.controller.id);group.matrixAutoUpdate=false;group.matrix.copy(ctx.entryLocalMatrix(e)).multiply(s.baseMatrix).multiply(new T.Matrix4().makeScale(visual.widthMeters*4,visual.widthMeters*4,visual.lengthMeters*4*(.4+.6*power)*pulse));group.matrixWorldNeedsUpdate=true;
   s.material.opacity=.65+.3*power;
  }}
 function info(){return slots.map(s=>({id:s.e.shape.controller.id,on:s.on,frame:s.frame,texture:s.visual.texture,effect:s.visual.effect,position:s.group.getWorldPosition(new T.Vector3()).toArray(),exhaustAxis:s.visual.exhaustAxis}));}
 return {clear,rebuild,update,info};
}
