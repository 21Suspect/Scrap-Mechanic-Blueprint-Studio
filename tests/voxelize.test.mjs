import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry} from 'three';
import {voxelize,voxelBlueprint} from '../lib/voxelize.mjs';
import {separateSelection} from '../lib/editor.mjs';
import {validate} from '../lib/validate.mjs';
import {catalog} from '../lib/assets.mjs';
const block='628b2d61-5ceb-43e9-8334-a4135566df7a';
function cube(offset=0){const g=new BoxGeometry(1,1,1).toNonIndexed(),a=g.attributes.position.array,t=[];for(let i=0;i<a.length;i+=9)t.push({positions:Array.from(a.slice(i,i+9),(v,k)=>k%3===0?v+offset:v),color:[1,0,0]});return t;}
test('closed shell versus solid fill, exact dimensions and cuboid coverage',()=>{const m={triangles:cube()},shell=voxelize(m,{longestSide:10,up:'Z'}),solid=voxelize(m,{longestSide:10,up:'Z',fill:'solid',color:'FF0000'});assert.deepEqual(shell.stats.grid,[10,10,10]);assert.equal(shell.stats.voxels,488);assert.equal(solid.stats.voxels,1000);assert.equal(solid.stats.interiorVoxels,512);assert.equal(solid.blocks.length,1);assert.equal(shell.stats.components,1);const seen=new Set();for(const s of shell.blocks)for(let x=0;x<s.bounds[0];x++)for(let y=0;y<s.bounds[1];y++)for(let z=0;z<s.bounds[2];z++){const k=[s.pos[0]+x,s.pos[1]+y,s.pos[2]+z].join(',');assert.ok(!seen.has(k));seen.add(k);}assert.equal(seen.size,488);assert.equal(validate(voxelBlueprint(shell,block),catalog).ok,true);});
test('open shell does not fabricate a solid interior',()=>{const triangles=cube().filter(t=>!t.positions.every((v,i)=>i%3!==2||v===.5));const r=voxelize({triangles},{longestSide:10,fill:'solid',up:'Z'});assert.equal(r.stats.interiorVoxels,0);});
test('up-axis, negative coordinates, offset and deterministic output',()=>{const model={triangles:cube().map(t=>({...t,positions:t.positions.map((v,i)=>v*(i%3===1?3:1)-10)}))};const options={longestSide:12,up:'Y',offset:[-3,7,2]};const a=voxelize(model,options);assert.deepEqual(a.stats.grid,[4,4,12]);assert.deepEqual(a,voxelize(model,options));assert.ok(a.blocks.every(b=>b.pos.every(Number.isInteger)));assert.equal(Math.min(...a.blocks.map(b=>b.pos[0])),-3);});
test('disconnected islands are reported and only explicitly removed',()=>{const model={triangles:[...cube(),...cube(3)]},r=voxelize(model,{longestSide:16}),largest=voxelize(model,{longestSide:16,largestOnly:true});assert.equal(r.stats.components,2);assert.equal(largest.stats.components,1);assert.equal(largest.stats.removedVoxels,56);assert.equal(r.stats.voxels,112);});
test('UV texture sampling and flipY preserve opposite color rows',()=>{const tri={positions:[0,0,0,4,0,0,0,4,0],uv:[0,0,1,0,0,1],texture:0,color:[1,1,1]},texture={width:1,height:2,pixels:new Uint8Array([255,0,0,255,0,0,255,255]),wrapS:1001,wrapT:1001};const model={triangles:[tri],textures:[texture]},a=voxelize(model,{longestSide:4,up:'Z'});texture.flipY=true;const b=voxelize(model,{longestSide:4,up:'Z'});const at=(r,x,y)=>r.blocks.find(v=>x>=v.pos[0]&&x<v.pos[0]+v.bounds[0]&&y>=v.pos[1]&&y<v.pos[1]+v.bounds[1]).color;assert.equal(at(a,0,0),'FF0000');assert.equal(at(b,0,0),'0000FF');assert.equal(at(a,0,3),'0000FF');});
test('invalid dimensions and geometry fail clearly',()=>{assert.throws(()=>voxelize({triangles:[]}),/no mesh/);assert.throws(()=>voxelize({triangles:cube()},{longestSide:0}),/positive whole/);assert.throws(()=>voxelize({triangles:[{positions:[0,0,0,1,0,0,2,0,0]}]}),/non-degenerate/);assert.throws(()=>voxelize({triangles:cube()},{offset:[.5,0,0]}),/integer/);assert.equal(voxelize({triangles:[{positions:[0,0,0,1,0,0,0,1,0]}]},{longestSide:4,up:'Z'}).stats.grid[2],1);});
test('separate a converted section preserves old joint and controller references',()=>{const part=x=>({shapeId:block,pos:{x,y:0,z:0},bounds:{x:1,y:1,z:1},xaxis:1,zaxis:3,color:'FFFFFF'}),bp={version:4,bodies:[{childs:[part(0),part(1)]},{childs:[part(2)]}],joints:[{id:7,childA:0,childB:2}]};bp.bodies[0].childs[0].controller={id:9,controllers:[{id:10}],joints:[{id:7}]};const before=JSON.stringify(bp),r=separateSelection(bp,[1]);assert.equal(JSON.stringify(bp),before);assert.equal(r.blueprint.bodies.length,3);assert.equal(r.blueprint.joints[0].childB,1);assert.deepEqual(r.selection,[2]);assert.deepEqual(r.blueprint.bodies[0].childs[0].controller,bp.bodies[0].childs[0].controller);assert.throws(()=>separateSelection(bp,[0,1]),/complete body/);});

test('large grid warning can be acknowledged without truncating the grid',()=>{
 const model={triangles:[...cube(),...cube().map(t=>({...t,positions:t.positions.map(v=>v+200)}))]},options={longestSide:201,up:'Z',warnResources:true};
 assert.throws(()=>voxelize(model,options),e=>e.code==='IMPORT_RESOURCE_WARNING'&&/8,120,601 cells/.test(e.warning));
 const result=voxelize(model,{...options,acknowledgeResources:true});assert.deepEqual(result.stats.grid,[201,201,201]);assert.equal(result.stats.voxels,2);assert.equal(result.stats.components,2);assert.ok(result.warnings.some(w=>/Large grid/.test(w)));
});

test('AI conversion uses sparse cells beyond former grid/resolution caps without resource warnings',()=>{
 const model={triangles:[...cube(),...cube().map(t=>({...t,positions:t.positions.map(v=>v+2047)}))]};
 const result=voxelize(model,{longestSide:2048,up:'Z'});assert.deepEqual(result.stats.grid,[2048,2048,2048]);assert.equal(result.stats.voxels,2);assert.equal(result.stats.components,2);assert.ok(!result.warnings.some(w=>/Large grid|High resolution/.test(w)));
});
test('solid conversion accepts more than the former occupied-voxel cap',()=>{
 const result=voxelize({triangles:cube()},{longestSide:68,fill:'solid',up:'Z',color:'FF0000'});assert.equal(result.stats.voxels,68**3);assert.equal(result.blocks.length,1);assert.ok(!result.warnings.some(w=>/Many.*voxels/.test(w)));
});
test('triangle count is advisory for users and unrestricted for AI',()=>{
 const degenerate={positions:[0,0,0,0,0,0,0,0,0]},triangles=[...Array(200000).fill(degenerate),{positions:[0,0,0,1,0,0,0,1,0]}];
 assert.throws(()=>voxelize({triangles},{longestSide:1,warnResources:true}),e=>e.code==='IMPORT_RESOURCE_WARNING'&&/200,001 triangles/.test(e.warning));
 const result=voxelize({triangles},{longestSide:1});assert.equal(result.stats.triangles,200001);assert.equal(result.stats.degenerateTriangles,200000);assert.equal(result.stats.voxels,1);
});
