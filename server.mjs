import {enrichThrusterAssets} from './lib/thruster-assets.mjs';
import http from 'node:http';
import {simulatePhysics} from './lib/physics.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT,WORK,PATHS,catalog,rotations,assetPath,assetWarnings,readJSON,listBlueprints,listDrafts,blueprintPath,draftPath} from './lib/assets.mjs';
import {validate} from './lib/validate.mjs';
import {saveDraft,createDraft,installDraft} from './lib/builder.mjs';
import {saveGameBlueprint,deleteDraft,saveDraftThumbnail,draftThumbnail,gameThumbnail} from './lib/storage.mjs';
import {centerOfMass,validateMeasurements} from './lib/mass.mjs';
import {enrichMassAssets} from './lib/mass-assets.mjs';
import {MotionPreview} from './lib/simulation.mjs';
import {checkMotionCollisions} from './lib/motion-collisions.mjs';
import {partTemplate} from './lib/part-templates.mjs';
import {enrichEngineAssets} from './lib/engine-assets.mjs';
import {importModel} from './lib/model-import.mjs';
enrichMassAssets(catalog);
enrichEngineAssets(catalog);
enrichThrusterAssets(catalog);
const port=Number(process.env.PORT||38799);
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.tga':'application/octet-stream','.fbx':'application/octet-stream'};
export const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,`http://127.0.0.1:${port}`),p=url.pathname;
 if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host))throw Error('Invalid host');
 const json=v=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(v));};
 if(req.method==='POST'){
 if(req.headers.origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin))throw Error('Cross-origin writes are blocked');
 if(!req.headers['content-type']?.startsWith('application/json'))throw Error('JSON required');
 const buf=[];for await(const c of req)buf.push(c);const body=JSON.parse(Buffer.concat(buf));
 if(p==='/api/validate')return json(validate(body,catalog));
 if(p==='/api/import-model')return json(await importModel({...body,port}));
 if(p==='/api/draft'){const result=saveDraft(body.name,body.blueprint);saveDraftThumbnail(body.name,body.thumbnail);return json(result);}
 if(p==='/api/create-draft')return json(createDraft(body.name));
 if(p==='/api/save')return json(saveGameBlueprint(body));
 if(p==='/api/delete-draft')return json(deleteDraft(body.name));
 if(p==='/api/mass')return json(centerOfMass(body.blueprint,catalog,{measurements:validateMeasurements(body.measurements||{})}));
 if(p==='/api/check-motion')return json(checkMotionCollisions(body.blueprint,catalog,body.options||{}));
 if(p==='/api/physics')return json(await simulatePhysics(body.blueprint,catalog,body));
 if(p==='/api/preview'){const duration=Number(body.time||0);if(!Number.isFinite(duration)||duration<0||duration>60)throw Error('Preview time must be 0–60 seconds');const preview=new MotionPreview(body.blueprint,catalog,{logicMode:body.logicMode??'clocked'});for(const [id,value]of Object.entries(body.inputs||{}))preview.setInput(Number(id),value);for(const [id,drive]of Object.entries(body.engines||{}))preview.setEngine(Number(id),drive);for(let t=0;t<duration;t+=.025)preview.step(Math.min(.025,duration-t));return json(preview.snapshot());}
 if(p==='/api/install')return json(installDraft(body.name,body.title));
 throw Error('Unknown operation');
 }
 if(req.method!=='GET')throw Error('Unsupported method');
 if(p==='/api/catalog')return json({shapes:Object.fromEntries(catalog),rotations,warnings:assetWarnings,paths:PATHS});
 if(p==='/api/part-template')return json(partTemplate(url.searchParams.get('id')));
 if(p==='/api/blueprints')return json(listBlueprints());
 if(p==='/api/drafts')return json(listDrafts());
 if(p==='/api/blueprint'||p==='/api/draft'){const bp=readJSON(p==='/api/blueprint'?blueprintPath(url.searchParams.get('id')):draftPath(url.searchParams.get('name')));return json({blueprint:bp,report:validate(bp,catalog)});}
 let file;
 if(p==='/api/thumbnail'){file=url.searchParams.has('id')?gameThumbnail(url.searchParams.get('id')):draftThumbnail(url.searchParams.get('name'));if(!file){res.writeHead(204);return res.end();}}
 else if(p==='/rapier.mjs')file=path.join(ROOT,'node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs');
 else if(p==='/asset'){file=assetPath(url.searchParams.get('ref')||'');if(!['.fbx','.dae','.mesh','.obj','.tga','.png','.jpg','.dds','.rend','.lua','.json'].includes(path.extname(file).toLowerCase()))throw Error('Unsupported asset');}
 else{const base=p.startsWith('/vendor/')?path.join(ROOT,'node_modules/three'):p.startsWith('/lib/')?ROOT:path.join(ROOT,'public');const rel=p.startsWith('/vendor/')?p.slice(8):p==='/'?'index.html':p.slice(1);file=path.resolve(base,rel);if(!file.startsWith(base+path.sep))throw Error('Invalid path');}
 const stat=fs.statSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':p==='/asset'?'private, max-age=3600':'no-cache'});fs.createReadStream(file).pipe(res);
 }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}
});
server.requestTimeout=0;
server.listen(port,'127.0.0.1',()=>console.log(`Blueprint Studio http://127.0.0.1:${port}`));
