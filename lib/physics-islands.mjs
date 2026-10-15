import {attachmentAudit} from './attachments.mjs';

export function physicsIslands(blueprint,catalog,split=true){
 const map=catalog instanceof Map?catalog:new Map(Object.entries(catalog)),flat=blueprint.bodies.flatMap(b=>b.childs);
 let offset=0;
 const groups=split?attachmentAudit(blueprint,map).bodies:blueprint.bodies.map((b,body)=>({body,components:[b.childs.map(()=>offset++)]}));
 const bodies=[],fragments=[],oldToNew=[],partFragments=[],primary=[];let index=0;
 for(const group of groups){const components=group.components.length?group.components:[[]];primary[group.body]=bodies.length;
  for(const parts of components){const fragment=bodies.length;fragments.push({sourceBody:group.body,parts});bodies.push({childs:parts.map(old=>{oldToNew[old]=index++;partFragments[old]=fragment;return flat[old];})});}
 }
 const joints=(blueprint.joints||[]).map(j=>({...j,childA:oldToNew[j.childA],childB:oldToNew[j.childB]}));
 return {blueprint:{...blueprint,bodies,joints},fragments,primary,partFragments,extraBodies:bodies.length-blueprint.bodies.length};
}
