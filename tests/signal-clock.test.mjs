import test from 'node:test';
import assert from 'node:assert/strict';
import {MotionPreview} from '../lib/simulation.mjs';
const catalog={switch:{lever:{}},gate:{logic:{}},timer:{timer:{}},light:{spotlight:{}}};
const part=(id,shapeId,links=[],extra={})=>({shapeId,pos:{x:id*2,y:0,z:0},xaxis:1,zaxis:3,controller:{id,active:false,controllers:links.map(id=>({id})),...extra}});
const preview=parts=>new MotionPreview({bodies:[{childs:parts}],joints:[]},catalog,{logicMode:'clocked'});
test('clocked gate chains advance one stage per tick independently of part order',()=>{
 const parts=[part(1,'switch',[2]),part(2,'gate',[3],{mode:1}),part(3,'gate',[4],{mode:1}),part(4,'light')];
 for(const list of [parts,[...parts].reverse()]){const p=preview(list);p.setInput(1,true);p.step(0);assert.equal(p.states.get(2),false);p.step(.025);assert.equal(p.states.get(2),true);assert.equal(p.states.get(3),false);p.step(.025);assert.equal(p.states.get(3),true);assert.equal(p.states.get(4),true);}
});
test('feedback oscillates with elapsed ticks rather than solver iteration count',()=>{
 const p=preview([part(1,'gate',[1],{mode:4})]);const trace=[];for(let i=0;i<6;i++){p.step(.025);trace.push(p.states.get(1));}assert.deepEqual(trace,[true,false,true,false,true,false]);assert.ok(!p.snapshot().warnings.some(w=>w.includes('did not settle')));
});
test('timer delays both edges of a short pulse by the exact requested clock ticks',()=>{
 const p=preview([part(1,'switch',[2]),part(2,'timer',[3],{ticks:3}),part(3,'light')]);
 p.setInput(1,true);p.step(.025);p.setInput(1,false);p.step(.05);assert.equal(p.states.get(2),false);p.step(.025);assert.equal(p.states.get(2),true);p.step(.025);assert.equal(p.states.get(2),false);
});
test('signal timing is independent of frame chunking and records its unverified scheduling model',()=>{
 const parts=[part(1,'gate',[1],{mode:4})],a=preview(parts),b=preview(parts);a.step(.125);for(let i=0;i<15;i++)b.step(1/120);assert.deepEqual(a.snapshot().logic,b.snapshot().logic);assert.deepEqual(a.snapshot().states,b.snapshot().states);assert.equal(a.snapshot().logic.nativeVerified,false);
});
