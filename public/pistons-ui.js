import {isPiston,pistonRestExtension} from '/lib/pistons.mjs';
export function createPistons(ctx){let slots=[],generation=0;
 function clear(){generation++;slots=[];}
 async function rebuild(){clear();const token=generation;
  for(const e of ctx.entries())if(e.joint&&isPiston(e.def)){
   const [closed,extended]=await Promise.all([ctx.model(e.def,false),ctx.model(e.def,true)]);if(token!==generation)return;
   for(let i=0;i<(e.pistonSlots||[]).length;i++){
    const rest=closed[i]?.geometry,end=extended[i]?.geometry,inst=e.pistonSlots[i].inst;
    if(!rest||!end||rest.attributes.position.count!==end.attributes.position.count){ctx.failure('Piston pose topology mismatch: '+e.def.title);continue;}
    const geometry=rest.clone();inst.geometry=geometry;inst.userData.ownedGeometry=true;slots.push({e,inst,geometry,rest,end,last:null});
   }
  }
  update();
 }
 function update(states={}){for(const slot of slots){const {e,geometry,rest,end,inst}=slot,extension=states[e.shape.id]?.extension??pistonRestExtension(e.shape);if(slot.last===extension)continue;slot.last=extension;
  const weight=Math.max(0,Math.min(1,extension/e.def.pistonModel.poseExtension));
  for(const name of ['position','normal']){const source=rest.attributes[name],target=end.attributes[name],output=geometry.attributes[name];if(!source||!target||!output||source.count!==target.count)continue;for(let i=0;i<output.array.length;i++)output.array[i]=source.array[i]+(target.array[i]-source.array[i])*weight;output.needsUpdate=true;}
  geometry.normalizeNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();inst.computeBoundingBox();inst.computeBoundingSphere();
 }}
 return {clear,rebuild,update};
}
