import {loadIcons} from './icons.mjs';
import {enrichPistonAssets} from './pistons.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from 'jsonc-parser';
import {resolveStudioPaths} from './paths.mjs';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const PATHS=resolveStudioPaths(ROOT);
export const GAME=PATHS.game;
export const BLUEPRINTS=PATHS.blueprints;
export const WORK=PATHS.work;
fs.mkdirSync(WORK,{recursive:true});
export function readJSON(p){const errors=[];const v=parse(fs.readFileSync(p,'utf8'),errors,{allowTrailingComma:true});if(errors.length)throw Error(`Invalid JSON: ${p}`);return v;}
export function assetPath(ref){
 const aliases={'$GAME_DATA':'Data','$SURVIVAL_DATA':'Survival','$CHALLENGE_DATA':'ChallengeData'};
 const key=Object.keys(aliases).find(k=>ref.startsWith(k+'/'));
 if(!key)throw Error(`Unsupported asset root: ${ref}`);
 const base=path.resolve(GAME,aliases[key]),p=path.resolve(base,ref.slice(key.length+1));
 if(!p.startsWith(base+path.sep))throw Error('Asset path escapes root');return p;
}
export const rotations=readJSON(path.join(GAME,'Data/Objects/Database/rotationsets.json'));
const titles={...readJSON(path.join(GAME,'Data/Gui/Language/English/InventoryItemDescriptions.json')),...readJSON(path.join(GAME,'Survival/Gui/Language/English/inventoryDescriptions.json'))};
export const catalog=new Map();
export const assetWarnings=[];
function connectionMeta(def){
 const s=def.scripted;if(!s){
 // Native interactables expose their class in the shape definition rather than Lua.
 if(def.lever||def.button)return {input:['seated'],output:['logic'],color:'df00ff',source:'native shape definition'};
 if(def.sensor||def.survivalSensor)return {input:[],output:['logic'],color:'df00ff',maxParents:0,source:'native shape definition'};
 if(def.timer)return {input:['logic'],output:['logic'],color:'df00ff',maxParents:1,source:'native shape definition'};
 if(def.sequence||def.survivalSequence)return {input:['logic'],output:['bearing','logic'],color:'df00ff',maxParents:1,source:'native shape definition'};
 if(def.logic)return {input:['logic'],output:['logic'],color:'df00ff',source:'native shape definition'};
 if(def.spotlight||def.pointlight)return {input:['logic'],output:[],color:'df00ff',source:'native shape definition'};
 if(def.bearing)return {input:['bearing'],output:[],color:'df7f01',source:'native shape definition'};
 if(def.piston||def.survivalPiston)return {input:['logic'],output:[],color:'df00ff',maxParents:1,source:'native shape definition'};
 if(def.gasEngine||def.electricEngine)return {input:['logic','power'],output:['bearing'],color:'ff8000',source:'native shape definition'};
 if(def.thruster||def.survivalThruster)return {input:['logic','power'],output:[],color:'df00ff',maxParents:1,source:'native shape definition'};
 if(def.seat||def.steering)return {input:[],output:['seated','power','bearing'],color:'80ff00',source:'native shape definition'};
 return null;
 }
 try{
 const src=fs.readFileSync(assetPath(s.filename),'utf8'),classes=[],visited=new Set();let current=s.classname;
 // DriverSaddle inherits DriverSeat's power/bearing outputs in this file.
 // Ignoring that inheritance made a seated engine look unconnected and auto-run.
 while(current&&!visited.has(current)){visited.add(current);const cls=current.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');classes.push(cls);current=src.match(new RegExp('\\b'+cls+'\\s*=\\s*class\\(\\s*(\\w+)\\s*\\)'))?.[1];}
 const assignment=k=>classes.map(cls=>src.match(new RegExp(cls+'\\.'+k+'\\s*=([^\\r\\n]+)'))?.[1]).find(value=>value!==undefined);
 const types=k=>assignment(k)===undefined?undefined:[...assignment(k).matchAll(/connectionType\.(\w+)/g)].map(x=>x[1]);
 return {script:s.filename,className:s.classname,input:types('connectionInput'),output:types('connectionOutput'),color:assignment('colorNormal')?.match(/0x([\da-f]{6})/i)?.[1],maxParents:Number(assignment('maxParentCount'))||null,maxChildren:Number(assignment('maxChildCount'))||null};
 }catch(e){return {script:s.filename,error:e.message};}
}
// Follow active databases; do not index example mods or unrelated unused files.
for(const folder of ['Data','Survival','ChallengeData']){
 const db=readJSON(path.join(GAME,folder,'Objects/Database/shapesets.json'));
 for(const ref of db.shapeSetList||[]){try{
 const set=readJSON(assetPath(ref));
 for(const kind of ['block','part','wedge'])for(const def of set[kind+'List']||[]){
 let render=null;try{render=typeof def.renderable==='string'?readJSON(assetPath(def.renderable)):def.renderable;}catch(e){assetWarnings.push(e.message);}
 catalog.set(def.uuid,{...def,kind,title:titles[def.uuid]?.title||def.name,source:ref,render,connection:connectionMeta(def)});
 }
 }catch(e){assetWarnings.push(e.message);}}
}
// Resizable wedges are native procedural shapes, saved with the same bounds and
// signed axes as blocks. Use their installed parent-block textures for surfaces.
for(const d of catalog.values())if(d.kind==='wedge'){
 const parent=catalog.get(d.blockUuid);d.dif=parent?.dif;d.nor=parent?.nor;d.asg=parent?.asg;
 d.glass=parent?.glass||d.material==='Glass';d.sticky='-X+X-Y-Z';d.rotationSet='PropFull';
}
enrichPistonAssets(catalog);
const itemIcons=loadIcons(GAME);for(const [id,d] of catalog){d.icon=itemIcons.get(id)||null;for(const [folder,prefix] of [['Survival','$SURVIVAL_DATA'],['Data','$GAME_DATA']])if(!d.icon&&fs.existsSync(path.join(GAME,folder,'Gui/VoxelMeshIcons',id+'.png')))d.icon={ref:prefix+'/Gui/VoxelMeshIcons/'+id+'.png'};}
export function listBlueprints(){return (fs.existsSync(BLUEPRINTS)?fs.readdirSync(BLUEPRINTS,{withFileTypes:true}):[]).filter(d=>d.isDirectory()).flatMap(d=>{
 try{const desc=readJSON(path.join(BLUEPRINTS,d.name,'description.json'));return [{id:d.name,name:desc.name||d.name}];}catch{return [];}
}).sort((a,b)=>a.name.localeCompare(b.name));}
export function blueprintPath(id){if(typeof id!=='string'||!(/^[\da-f-]{36}$/i.test(id)||/^Blueprint\d+-\d+$/.test(id)))throw Error('Invalid blueprint ID');return path.join(BLUEPRINTS,id,'blueprint.json');}
export function draftPath(name){if(!/^[\w -]{1,100}$/.test(name))throw Error('Use a simple draft name');return path.join(WORK,name+'.json');}
export function listDrafts(){return fs.readdirSync(WORK).filter(f=>f.endsWith('.json')).filter(f=>{try{const bp=readJSON(path.join(WORK,f));return bp.version===4&&Array.isArray(bp.bodies);}catch{return false;}}).map(f=>f.slice(0,-5));}
