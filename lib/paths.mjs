import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';

// Steam's quoted KeyValues files, including escaped Windows paths.
export function parseVdf(source){
 const tokens=source.replace(/^\s*\/\/.*$/gm,'').match(/"(?:\\.|[^"\\])*"|[{}]/g)||[];let i=0;
 const word=t=>t.slice(1,-1).replace(/\\([\\"])/g,'$1');
 const object=()=>{const out={};while(i<tokens.length&&tokens[i]!=='}'){const key=word(tokens[i++]),value=tokens[i++];if(value==='{')out[key]=object();else if(value?.startsWith('"'))out[key]=word(value);else throw Error('Invalid Steam KeyValues file');}if(tokens[i]==='}')i++;return out;};return object();
}
const readVdf=file=>{try{return parseVdf(fs.readFileSync(file,'utf8'));}catch{return {};}};
const directories=dir=>{try{return fs.readdirSync(dir,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);}catch{return [];}};
export function resolveStudioPaths(root,{env=process.env,home=os.homedir(),platform=process.platform,registry=true}={}){
 const configFile=env.SM_CONFIG_FILE||path.join(root,'studio.config.json');let config={};
 if(fs.existsSync(configFile)){try{config=JSON.parse(fs.readFileSync(configFile,'utf8'));}catch{throw Error('Invalid JSON in '+configFile);}}
 const absolute=value=>path.resolve(root,value);
 const steamRoots=[env.SM_STEAM_ROOT,config.steamRoot];
 if(registry&&platform==='win32')try{const result=execFileSync('reg.exe',['query','HKCU\\Software\\Valve\\Steam','/v','SteamPath'],{encoding:'utf8',windowsHide:true,timeout:3000,stdio:['ignore','pipe','ignore']});steamRoots.push(result.match(/SteamPath\s+REG_SZ\s+(.+)/i)?.[1]?.trim());}catch{}
 steamRoots.push(...[env['ProgramFiles(x86)'],env.ProgramFiles].filter(Boolean).map(p=>path.join(p,'Steam')),path.join(home,'.steam','steam'),path.join(home,'.local','share','Steam'),path.join(home,'Library','Application Support','Steam'));
 const roots=[...new Set(steamRoots.filter(Boolean).map(absolute))],libraries=new Set(roots);
 for(const steam of roots){const data=readVdf(path.join(steam,'steamapps','libraryfolders.vdf')).libraryfolders||{};for(const [key,value]of Object.entries(data))if(/^\d+$/.test(key)){const p=typeof value==='string'?value:value.path;if(p)libraries.add(absolute(p));}}
 const validGame=p=>fs.existsSync(path.join(p,'Data','Objects','Database','shapesets.json'))&&fs.existsSync(path.join(p,'Survival','Objects','Database','shapesets.json'));
 const overrideGame=env.SM_GAME_ROOT||config.gameRoot;let game;
 if(overrideGame){game=absolute(overrideGame);if(!validGame(game))throw Error('Invalid Scrap Mechanic gameRoot: '+game);}
 else{
  const candidates=[];for(let p=root;;p=path.dirname(p)){candidates.push(p);if(path.dirname(p)===p)break;}
  for(const library of libraries){const manifest=readVdf(path.join(library,'steamapps','appmanifest_387990.acf')).AppState;candidates.push(path.join(library,'steamapps','common',manifest?.installdir||'Scrap Mechanic'));}
  game=candidates.find(validGame);
  if(!game)throw Error('Scrap Mechanic was not found. Set gameRoot in '+configFile+' or SM_GAME_ROOT to its installed folder.');
 }
 const userRoots=[path.join(env.APPDATA||path.join(home,'AppData','Roaming'),'Axolot Games','Scrap Mechanic','User')];
 if(platform!=='win32')for(const library of libraries)userRoots.push(path.join(library,'steamapps','compatdata','387990','pfx','drive_c','users','steamuser','AppData','Roaming','Axolot Games','Scrap Mechanic','User'));
 const profiles=userRoots.flatMap(dir=>directories(dir).filter(n=>/^User_\d+$/.test(n)).map(n=>({id:n.slice(5),path:path.join(dir,n,'Blueprints')})));
 const overrideBlueprints=env.SM_BLUEPRINT_ROOT||config.blueprintRoot;let blueprints;
 if(overrideBlueprints)blueprints=absolute(overrideBlueprints);
 else{
  const profileId=env.SM_PROFILE_ID||config.profileId;
  let selected=profileId?profiles.find(p=>p.id===String(profileId)):null;
  if(profileId&&!selected)throw Error('Scrap Mechanic profile '+profileId+' was not found. Available: '+profiles.map(p=>p.id).join(', '));
  if(!selected){const recent=new Set(roots.flatMap(r=>Object.entries(readVdf(path.join(r,'config','loginusers.vdf')).users||{}).filter(([,v])=>v.MostRecent==='1').map(([id])=>id)));const matches=profiles.filter(p=>recent.has(p.id));if(matches.length===1)selected=matches[0];}
  if(!selected&&profiles.length===1)selected=profiles[0];
  if(!selected)throw Error(profiles.length?'Multiple Scrap Mechanic profiles found: '+profiles.map(p=>p.id).join(', ')+'. Set profileId in '+configFile+' or SM_PROFILE_ID to choose the save destination.':'No Scrap Mechanic user profile found. Launch the game once, or set blueprintRoot in '+configFile+' / SM_BLUEPRINT_ROOT.');
  blueprints=selected.path;
 }
 const dataRoot=path.join(env.LOCALAPPDATA||env.XDG_DATA_HOME||path.join(home,'.local','share'),'BlueprintStudio');
 let work=absolute(env.SM_WORK_ROOT||config.workRoot||'workspace');
 try{fs.mkdirSync(work,{recursive:true});fs.accessSync(work,fs.constants.W_OK);}catch(e){if(env.SM_WORK_ROOT||config.workRoot)throw e;work=path.join(dataRoot,'workspace');fs.mkdirSync(work,{recursive:true});}
 return {game,blueprints,work,root,profiles,configFile};
}
