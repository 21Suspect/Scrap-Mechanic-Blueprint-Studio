import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {BLUEPRINTS,WORK,ROOT,catalog,readJSON,blueprintPath,draftPath,listBlueprints} from './assets.mjs';
import {validate} from './validate.mjs';

const nameKey=s=>s.normalize('NFKC').trim().toLocaleLowerCase('en');
function title(value){if(typeof value!=='string'||!value.trim()||value.trim().length>100||/[\x00-\x1f]/.test(value))throw Error('Enter a name (1–100 characters).');return value.trim();}
function revision(id){const file=blueprintPath(id);return crypto.createHash('sha256').update(fs.readFileSync(file)).update(fs.readFileSync(path.join(path.dirname(file),'description.json'))).digest('hex');}
function atomic(file,bytes){const tmp=file+'.'+crypto.randomUUID()+'.tmp';try{fs.writeFileSync(tmp,bytes);fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}}
function previewBytes(data){if(!data)return null;if(!/^data:image\/png;base64,/.test(data)||data.length>12*1024*1024)throw Error('Invalid thumbnail');const bytes=Buffer.from(data.split(',')[1],'base64');if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Invalid PNG');return bytes;}
export function saveGameBlueprint({name,blueprint,replace,thumbnail}){
 name=title(name);const report=validate(blueprint,catalog);if(!report.ok)throw Error('Save blocked: fix blueprint validation errors.');const png=previewBytes(thumbnail);
 const matches=listBlueprints().filter(b=>nameKey(b.name)===nameKey(name));
 if(matches.length){
  const candidates=matches.map(b=>({...b,revision:revision(b.id)}));
  if(!replace)return {needsConfirmation:true,candidates};
  const match=candidates.find(b=>b.id===replace.id);if(!match||match.revision!==replace.revision)throw Error('The saved blueprint changed. Check it and confirm replacement again.');
  const dir=path.dirname(blueprintPath(match.id)),backup=path.join(WORK,'backups',match.id,Date.now()+'-'+crypto.randomUUID());fs.mkdirSync(backup,{recursive:true});
  for(const f of ['blueprint.json','description.json','icon.png'])if(fs.existsSync(path.join(dir,f)))fs.copyFileSync(path.join(dir,f),path.join(backup,f));
  const desc=readJSON(path.join(dir,'description.json'));const old=fs.readFileSync(path.join(dir,'blueprint.json'));
  try{atomic(path.join(dir,'blueprint.json'),JSON.stringify(blueprint));atomic(path.join(dir,'description.json'),JSON.stringify({...desc,name},null,2));if(png)atomic(path.join(dir,'icon.png'),png);}catch(e){atomic(path.join(dir,'blueprint.json'),old);atomic(path.join(dir,'description.json'),fs.readFileSync(path.join(backup,'description.json')));throw e;}
  return {id:match.id,directory:dir,replaced:true,backup,report};
 }
 if(replace)throw Error('Replacement target no longer exists. Save again.');
 const id=crypto.randomUUID(),dir=path.join(BLUEPRINTS,id);fs.mkdirSync(dir,{recursive:true});
 try{atomic(path.join(dir,'blueprint.json'),JSON.stringify(blueprint));atomic(path.join(dir,'description.json'),JSON.stringify({localId:id,name,description:'Created with Blueprint Studio. Verify behavior in game.',type:'Blueprint',version:0},null,2));if(png)atomic(path.join(dir,'icon.png'),png);}catch(e){for(const f of fs.readdirSync(dir))fs.unlinkSync(path.join(dir,f));fs.rmdirSync(dir);throw e;}
 return {id,directory:dir,replaced:false,report};
}
export function saveDraftThumbnail(name,thumbnail){const file=draftPath(name);const png=previewBytes(thumbnail);if(png)atomic(file.slice(0,-5)+'.png',png);}
export function draftThumbnail(name){const file=draftPath(name),local=file.slice(0,-5)+'.png',capture=path.join(WORK,'captures',name,'iso.png'),legacy=path.join(ROOT,'captures',name,'iso.png');return [local,capture,legacy].find(f=>fs.existsSync(f))||null;}
export function gameThumbnail(id){const file=path.join(path.dirname(blueprintPath(id)),'icon.png');return fs.existsSync(file)?file:null;}
export function deleteDraft(name){const file=draftPath(name);if(!fs.existsSync(file))throw Error('Draft not found');const bp=readJSON(file);if(bp.version!==4||!Array.isArray(bp.bodies))throw Error('Not a blueprint draft');
 // Deletion is recoverable and never touches game creations, recipes or captures.
 const dir=path.join(WORK,'deleted-drafts',Date.now()+'-'+crypto.randomUUID());fs.mkdirSync(dir,{recursive:true});fs.renameSync(file,path.join(dir,path.basename(file)));const image=file.slice(0,-5)+'.png';if(fs.existsSync(image))fs.renameSync(image,path.join(dir,path.basename(image)));return {deleted:name,recovery:dir};
}
