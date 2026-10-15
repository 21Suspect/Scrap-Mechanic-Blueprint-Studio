import fs from'node:fs';import{catalog,WORK}from'../lib/assets.mjs';import{enrichMassAssets}from'../lib/mass-assets.mjs';import{enrichEngineAssets}from'../lib/engine-assets.mjs';import{MotionPreview}from'../lib/simulation.mjs';import{collisionScene}from'../lib/collision-geometry.mjs';
const name='Boeing 747-8 Grand Airliner',bp=JSON.parse(fs.readFileSync(WORK+'/'+name+'.json')),facts=JSON.parse(fs.readFileSync(WORK+'/'+name+'.design.json'));enrichMassAssets(catalog);enrichEngineAssets(catalog);const scene=collisionScene(bp,catalog),results=[];
for(const angle of [-25,25]){
 const p=new MotionPreview(bp,catalog);for(const id of [128,129,130])p.setEngine(id,{power:1,gear:3});p.setInput(95,true);const hits=new Map();
 for(let i=0;i<=480;i++){if(i===240)p.setInput(95,false);p.step(.025);p.angles.set(facts.steering,angle);p.pose();for(const h of scene.intersections(p.matrices,{movingOnly:true,tolerance:.005,limit:100}).collisions)hits.set(h.a+':'+h.b,{...h,time:i*.025});}
 results.push({label:'Taxi + gear activate/return + nose steering '+angle,steeringDegrees:angle,samples:481,duration:12,collisions:[...hits.values()]});
}
fs.writeFileSync(WORK+'/'+name+'.extra-motion.json',JSON.stringify({physics:false,approximate:true,steeringInjectedKinematically:true,cases:results},null,2));console.log(results.map(r=>({label:r.label,hits:r.collisions.length,first:r.collisions.slice(0,2)})));
