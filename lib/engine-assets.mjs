import fs from 'node:fs';
import {assetPath} from './assets.mjs';
export function enrichEngineAssets(catalog){
 const scripts=new Map();for(const d of catalog.values()){
  const native=d.gasEngine||d.electricEngine;if(native){d.engineModel={type:d.gasEngine?'gas':'electric',gearBase:0,gears:native.gears.map(g=>({power:g.power,velocityRad:g.velocity*Math.PI/180})),source:'native shape definition',verifiedUnits:false};continue;}
  if(!['GasEngine','ElectricEngine'].includes(d.scripted?.classname))continue;
  try{let source=scripts.get(d.scripted.filename);if(!source){source=fs.readFileSync(assetPath(d.scripted.filename),'utf8').replace(/--\[\[[\s\S]*?\]\]/g,'');scripts.set(d.scripted.filename,source);}
   const table=name=>source.match(new RegExp('local '+name+' = \\{([\\s\\S]*?)\\n\\}'))?.[1];
   const level=source.match(new RegExp('\\[tostring\\(ITEMS\\.'+d.name+'\\)\\] = \\{([\\s\\S]*?)\\n\\t\\}'))?.[1];
   const gearsName=level?.match(/gears\s*=\s*(\w+)/)?.[1]||(/scrap/.test(d.name)?'ScrapGears':'Gears');
   const gears=[...(table(gearsName)||'').matchAll(/\{\s*power\s*=\s*([\d.]+)(?:\s*,\s*velocity\s*=\s*math\.rad\(\s*([\d.]+)\s*\))?\s*\}/g)].map(m=>({power:Number(m[1]),velocityRad:m[2]?Number(m[2])*Math.PI/180:0}));
   const count=Number(level?.match(/gearCount\s*=\s*(\d+)/)?.[1])||gears.length;
   d.engineModel={type:d.scripted.classname==='GasEngine'?'gas':'electric',gearBase:1,gears:gears.slice(0,count),source:d.scripted.filename,verifiedUnits:true,velocityRad:Number(source.match(/local RadPerSecond_100KmPerHourOn3BlockDiameterTyres\s*=\s*([\d.]+)/)?.[1])||0,rampPerSecond:Number(source.match(/local PoweringUpFactor\s*=\s*([\d.]+)/)?.[1])||0};
  }catch(e){d.engineModel={error:e.message};}
 }
 return catalog;
}
