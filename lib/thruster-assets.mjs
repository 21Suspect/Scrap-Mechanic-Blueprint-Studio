import fs from 'node:fs';
import {assetPath} from './assets.mjs';
import {isThruster} from './thrusters.mjs';
// Read original emitter data once; no game textures are copied or modified.
export function enrichThrusterAssets(catalog){
 const effects=JSON.parse(fs.readFileSync(assetPath('$GAME_DATA/Effects/Database/EffectSets/thrusters.effectset'),'utf8'));
 for(const d of catalog.values())if(isThruster(d)){
  const tier=Number(d.title?.match(/Level (\d)/)?.[1]||1),effectName=d.thruster?.effect||`Thruster - Level ${tier}`;
  const effect=effects[effectName]?.effectList.find(e=>e.type==='particle'&&e.name.endsWith(`afterburner_lvl${tier}`));
  if(!effect)continue;
  const source=`$GAME_DATA/Particles/thruster/${effect.name}.json`,system=JSON.parse(fs.readFileSync(assetPath(source),'utf8')).system;
  const emitter=system.emitters.find(e=>e.category==='Flame'&&e.tiles),animator=emitter?.effects.find(e=>e.name==='TextureAnimator');if(!emitter)continue;
  const curve=emitter.effects.find(e=>e.name==='Color')?.control_point;const color=curve?.find(([time,color])=>time>=.1&&color[3]>.5)?.[1]||emitter.color||[.25,.7,1,1];
  const mean=v=>Array.isArray(v)?v[0]:v;
  d.thrusterVisual={source,effect:effectName,texture:emitter.diffuse.startsWith('$')?emitter.diffuse:'$GAME_DATA/Particles/'+emitter.diffuse,tiles:[emitter.tiles[1],emitter.tiles[0]],fps:animator?.fps||30,color,widthMeters:mean(emitter.width)||.5,lengthMeters:mean(emitter.height)||1,offsetMeters:effect.offset||[0,0,.5],exhaustAxis:3};
 }
 return catalog;
}
