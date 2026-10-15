import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {catalog,BLUEPRINTS,draftPath,readJSON} from './assets.mjs';
import {basis,rotate,sub,add,scale,vec,obj,dimensions,axis,jointOrigin} from './geometry.mjs';
import {validate} from './validate.mjs';
import {checkBounds} from './shape-rules.mjs';
import {saveGameBlueprint} from './storage.mjs';
import {isPiston} from './pistons.mjs';
export class BlueprintBuilder{
 constructor(){this.bodies=[];this.joints=[];this.nextId=1;}
 body(){const b={childs:[]};this.bodies.push(b);return b;}
 part(body,shapeId,position,{xaxis=1,zaxis=3,color,bounds,controller}={}){
 const d=catalog.get(shapeId);if(!d)throw Error(`Unknown shape ${shapeId}`);basis(xaxis,zaxis);if(bounds)checkBounds(d,obj(vec(bounds)));
 const c={shapeId,pos:obj(vec(position)),xaxis,zaxis,color:(color||d.color||'DF7F01').replace('#','').toUpperCase()};
 if(bounds)c.bounds=obj(vec(bounds));if(['block','wedge'].includes(d.kind)&&!bounds)c.bounds={x:1,y:1,z:1};
 if(controller)c.controller={...controller,id:this.nextId++,controllers:[],joints:[]};body.childs.push(c);return c;
 }
 // Place by world-space center to avoid callers guessing rotated corner offsets.
 centered(body,shapeId,center,options={}){const d=catalog.get(shapeId),b=basis(options.xaxis??1,options.zaxis??3);return this.part(body,shapeId,sub(vec(center),rotate(b,scale(dimensions({bounds:options.bounds},d),.5))),options);}
 joint(a,b,shapeId,cell,{xaxis=1,zaxis=3,color='DF7F01'}={}){
 const d=catalog.get(shapeId);if(!d)throw Error('Unknown joint');basis(xaxis,zaxis);
 const length=d.bearing?0:isPiston(d)?1:(d.spring||d.survivalSpring)?.length;
 if(length===undefined)throw Error('Use an engine-verified template for unsupported joint types');
 const j={id:this.nextId++,shapeId,color,posA:obj(vec(cell)),posB:obj(add(vec(cell),scale(axis(zaxis),length))),xaxisA:xaxis,xaxisB:xaxis,zaxisA:zaxis,zaxisB:zaxis,_a:a,_b:b};
 if(isPiston(d))j.controller={id:this.nextId++,controllers:[],joints:[],length:d.pistonModel.defaultRange,speed:d.pistonModel.defaultSpeedIndex};
 (a.joints??=[]).push({id:j.id});(b.joints??=[]).push({id:j.id});this.joints.push(j);return j;
 }
 connect(source,target,{reverse=0}={}){if(!source.controller)throw Error('Source needs controller data');if(target._a&&!target.controller)source.controller.joints.push({id:target.id,reverse});else{if(!target.controller)throw Error('Target needs controller data');const d=catalog.get(source.shapeId),piston=target._a&&isPiston(catalog.get(target.shapeId)),sequence=d.sequence||d.survivalSequence,row=Math.max(-1,...[...source.controller.controllers,...source.controller.joints].map((r,i)=>r.index??i))+1;source.controller.controllers.push({id:target.controller.id,...(sequence&&piston?{index:row,frames:Array.from({length:11},(_,n)=>({setting:n===0?0:target.controller.length}))}:{})});}return this;}
 build(){const flat=this.bodies.flatMap(b=>b.childs);return {version:4,bodies:structuredClone(this.bodies),joints:this.joints.map(({_a,_b,...j})=>({...j,childA:flat.indexOf(_a),childB:flat.indexOf(_b)}))};}
 save(name){return saveDraft(name,this.build());}
}
export function saveDraft(name,bp){const report=validate(bp,catalog);if(!report.ok)throw Error(JSON.stringify(report.errors,null,2));const file=draftPath(name);fs.writeFileSync(file,JSON.stringify(bp,null,2));return {file,report};}
export function createDraft(name){
 const blueprint={version:4,bodies:[{childs:[]}],joints:[]},file=draftPath(name),report=validate(blueprint,catalog);
 try{fs.writeFileSync(file,JSON.stringify(blueprint,null,2),{flag:'wx'});}catch(e){if(e.code==='EEXIST')throw Error('A draft with this name already exists. Choose another name.');throw e;}
 return {name,file,blueprint,report};
}
export function installDraft(name,title=name,options={}){return saveGameBlueprint({name:title,blueprint:readJSON(draftPath(name)),...options});}
