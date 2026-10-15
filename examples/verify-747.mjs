import fs from 'node:fs';import {catalog,WORK} from '../lib/assets.mjs';import{enrichMassAssets}from'../lib/mass-assets.mjs';import{enrichEngineAssets}from'../lib/engine-assets.mjs';import{checkMotionCollisions}from'../lib/motion-collisions.mjs';import{centerOfMass}from'../lib/mass.mjs';
const name='Boeing 747-8 Grand Airliner',bp=JSON.parse(fs.readFileSync(WORK+'/'+name+'.json'));enrichMassAssets(catalog);enrichEngineAssets(catalog);
const report=checkMotionCollisions(bp,catalog,{maxSamplesPerPhase:1200,maxPairs:100,maxDuration:12});
fs.writeFileSync(WORK+'/'+name+'.motion.json',JSON.stringify(report,null,2));fs.writeFileSync(WORK+'/'+name+'.mass.json',JSON.stringify(centerOfMass(bp,catalog),null,2));
console.log(JSON.stringify({complete:report.complete,baseline:report.baseline.length,hits:report.collisionCount,cases:report.cases.map(c=>({name:c.label,hits:c.collisions.length,truncated:c.truncated,samples:c.samples}))}));
