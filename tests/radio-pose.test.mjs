import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {LoadingManager,Texture} from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {catalog,assetPath} from '../lib/assets.mjs';
import {dimensions} from '../lib/geometry.mjs';
import {correctAssetScale,alignNativePose,needsNativePoseAlignment} from '../lib/render-geometry.mjs';

test('radio activation preserves its mount and UVs while extending the native antenna',()=>{
 const def=catalog.get('dfefc9d7-db03-4d25-ad85-eae1d824d8c0'),manager=new LoadingManager();manager.addHandler(/.*/,{setPath(){},load(){return new Texture();}});
 const load=ref=>{const b=fs.readFileSync(assetPath(ref)),group=new FBXLoader(manager).parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');correctAssetScale(group,dimensions({},def));group.updateMatrixWorld(true);let mesh;group.traverse(o=>{if(o.isMesh)mesh={geometry:o.geometry.clone().applyMatrix4(o.matrixWorld),origin:o.matrixWorld.elements.slice(12,15)};});mesh.geometry.computeBoundingBox();return mesh;};
 const rest=load(def.render.lodList[0].mesh),on=load(def.render.lodList[0].pose0),uv=Array.from(on.geometry.attributes.uv.array),antennaTravel=on.geometry.boundingBox.max.y-rest.geometry.boundingBox.max.y;
 assert.ok(on.origin[0]<-2.6);assert.equal(needsNativePoseAlignment(def),true);
 alignNativePose(on.geometry,rest.geometry,def,on.origin,rest.origin);on.geometry.computeBoundingBox();
 for(const k of ['x','z'])for(const edge of ['min','max'])assert.ok(Math.abs(on.geometry.boundingBox[edge][k]-rest.geometry.boundingBox[edge][k])<1e-6,`${edge} ${k} must stay mounted`);
 assert.equal(on.geometry.boundingBox.min.y,rest.geometry.boundingBox.min.y);
 assert.ok(antennaTravel>.3&&antennaTravel<.4);assert.equal(on.geometry.boundingBox.max.y-rest.geometry.boundingBox.max.y,antennaTravel);
 assert.deepEqual(Array.from(on.geometry.attributes.uv.array),uv);
 rest.geometry.dispose();on.geometry.dispose();
});
