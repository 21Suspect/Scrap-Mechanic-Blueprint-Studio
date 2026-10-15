import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {LoadingManager,Texture,Box3,Vector3} from 'three';
import {catalog,assetPath} from '../lib/assets.mjs';
import {dimensions} from '../lib/geometry.mjs';
import {correctAssetScale} from '../lib/render-geometry.mjs';
function load(id){const def=catalog.get(id),bytes=fs.readFileSync(assetPath(def.render.lodList[0].mesh));const manager=new LoadingManager();manager.addHandler(/.*/,{setPath(){},load(){return new Texture();}});return {def,model:new FBXLoader(manager).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')};}
test('actual warehouse ramp occupies its intended 1×1×2 blocks, not 0.1×0.1×0.2',()=>{const {def,model}=load('04733746-4090-4d63-aff1-47dafae506fd');assert.equal(correctAssetScale(model,dimensions({},def)),10);const size=new Box3().setFromObject(model).getSize(new Vector3()).toArray();size.forEach((n,i)=>assert.ok(Math.abs(n-[1,1,2][i])<.001));});
test('thin original pipe geometry is preserved rather than stretched to collision dimensions',()=>{const {def,model}=load('0dba257b-b907-4919-baaf-2fefe19f4e24');const before=new Box3().setFromObject(model).getSize(new Vector3());assert.equal(correctAssetScale(model,dimensions({},def)),1);assert.deepEqual(new Box3().setFromObject(model).getSize(new Vector3()),before);});
test('warehouse spotlight applies its declared FBX export units without inflating its thin mesh to a cube',()=>{const {def,model}=load('695d66c8-b937-472d-8bc2-f3d72dd92879');assert.equal(correctAssetScale(model,dimensions({},def)),10);const size=new Box3().setFromObject(model).getSize(new Vector3());assert.ok(Math.abs(size.x-2)<.001);assert.ok(Math.abs(size.y-1)<.001);assert.ok(size.z>.59&&size.z<.61);});
