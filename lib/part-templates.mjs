import {catalog,listBlueprints,blueprintPath,draftPath,listDrafts,readJSON} from './assets.mjs';
import {defaultController} from './placement.mjs';
const observed=new Map();let queue=null;
export function partTemplate(id){const d=catalog.get(id);if(!d)throw Error('Unknown part');
 // Blocks and known native scalar interactables need no disk-wide template scan.
 if(!d.scripted)return {controller:defaultController(d),source:'native shape fields'};
 if(!queue)queue=[...listDrafts().map(draftPath),...listBlueprints().map(x=>blueprintPath(x.id))];
 while(!observed.has(id)&&queue.length)try{const f=queue.shift();for(const s of readJSON(f).bodies?.flatMap(b=>b.childs)||[])if(s.controller&&!observed.has(s.shapeId))observed.set(s.shapeId,s.controller);}catch{}
 return {controller:defaultController(d,observed.get(id)),source:observed.has(id)?'observed native blueprint':'native shape fields'};
}
