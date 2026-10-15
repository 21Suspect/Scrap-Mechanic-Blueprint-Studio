import fs from 'node:fs';
import {BlueprintBuilder,saveDraft} from '../lib/builder.mjs';
import {weldBlockVolumes} from '../lib/blocks.mjs';
import {catalog,readJSON,blueprintPath} from '../lib/assets.mjs';
import {basis,rotate,sub,jointOrigin} from '../lib/geometry.mjs';
const NAME='Ironfield 840 Tractor';
const b=new BlueprintBuilder(), main=b.body();
const ID={metal:'8aedf6c2-94e1-4506-89d4-a0227c552f1e',panel:'628b2d61-5ceb-43e9-8334-a4135566df7a',glass:'5f41af56-df4c-4837-9b3c-10781335757f',bearing:'4a1b886b-913e-4aad-b5b6-6e41b0db23a6',rear:'79f63a7c-276e-4488-88d4-af7b0390a35f',front:'4d974692-e011-4556-952c-d50da68dd961',seat:'ffa3a47e-fc0d-4977-802f-bd15683bbe5c',engine:'3091926a-9340-46d9-83d6-4fd7c68ad950',switch:'7cf717d7-d167-4f2d-a6e7-6b2c70aa3986',light:'ed27f5e2-cac5-4a32-a5d9-49f116acc6af',horn:'818f4e15-ff51-4fed-b874-723a25d62e1c',pipe:'07232236-22eb-4912-8774-ab185f368bb9'};
const C={green:'386D27',yellow:'E9B52C',dark:'242A2E',silver:'9DA6AD',red:'C32A24',cream:'E4DFCA'};
const source=readJSON(blueprintPath('92fd9cee-1e3d-4610-8031-2e11e2347af9')).bodies.flatMap(x=>x.childs);
function state(id){const v=structuredClone(source.find(x=>x.shapeId===id)?.controller||{});delete v.steering;return v;}
function box(x,y,z,w,d,h,color=C.green,body=main,material=ID.panel){return b.part(body,material,[x,y,z],{bounds:[w,d,h],color});}
function part(id,center,opts={},body=main){return b.centered(body,id,center,opts);}
function bearing(a,c,p,xaxis,zaxis){const cell=sub(sub(p,rotate(basis(xaxis,zaxis),[.5,.5,0])),jointOrigin([0,0,0],xaxis,zaxis));return b.joint(a,c,ID.bearing,cell,{xaxis,zaxis,color:C.silver});}
// Forward -Y; six native tires, two driven rear axles; front wheels free-roll. All dimensions are game blocks.
box(-1,-10,3,3,19,1,C.dark,main,ID.metal);
box(-3,-2,4,7,11,1,C.dark,main,ID.metal);
const rearAxle=box(-3,7,3,7,1,1,C.dark,main,ID.metal);

const drive=[],steer=[];
for(const s of [-1,1]){
 const outer=s<0?-3:4, body=b.body();
 const wheel=part(ID.rear,[outer+s*1.5,7.5,3.5],{xaxis:2,zaxis:s,color:C.yellow},body);
 part(ID.rear,[outer+s*4.5,7.5,3.5],{xaxis:2,zaxis:s,color:C.yellow},body);
 drive.push({j:bearing(rearAxle,wheel,[outer,7.5,3.5],2,s),reverse:s>0?1:0});
 const knuckle=b.body(), x=s<0?-5:5;
 const frontAxle=box(s<0?-5:3,-7,5,3,1,1,C.dark,main,ID.metal);
 const hub=box(x,-7,2,1,1,3,C.dark,knuckle,ID.metal);
 steer.push(bearing(frontAxle,hub,[x+.5,-6.5,5],1,-3));
 const tireBody=b.body(), face=s<0?x:x+1;
 const tire=part(ID.front,[face+s,-6.5,2.5],{xaxis:2,zaxis:s,color:C.yellow},tireBody);
 bearing(hub,tire,[face,-6.5,2.5],2,s);
}
// Hollow sculpted hood, radiator, bumper and front ballast.
box(-2,-10,4,5,10,1);box(-2,-10,5,1,10,2);box(2,-10,5,1,10,2);
box(-1,-10,5,3,1,3,C.dark);box(-1,-9,7,3,9,1);box(-2,-9,8,5,8,1);
for(const x of [-2,2])box(x,-9,7,1,8,1,C.yellow);
for(let z=5;z<8;z++)for(let x=-1;x<2;x++)box(x,-11,z,1,1,1,z===6?C.silver:C.dark);
box(-4,-12,3,9,2,1,C.dark,main,ID.metal);
for(let x=-2;x<=2;x++)box(x,-13,3,1,1,2,x%2?C.silver:C.dark,main,ID.metal);
box(-3,-10,6,1,1,1,C.dark);box(3,-10,6,1,1,1,C.dark);
// Cab platform, rear fenders and open doorways; native glass windshield.
box(-3,0,5,7,8,1,C.dark);
for(const x of [-3,3])for(const y of [0,7])box(x,y,6,1,1,7,C.green);
box(-2,0,9,5,1,3,'BEDAE0',main,ID.glass);
box(-2,7,8,5,1,4,'BEDAE0',main,ID.glass);
box(-2,7,6,5,1,2);
box(-4,-1,13,9,10,1);box(-3,0,14,7,8,1,C.cream);
for(const s of [-1,1]){
 const x=s<0?-9:4;
 box(x,4,8,6,8,1);box(s<0?-3:3,4,5,1,7,3);
 box(x,11,7,6,1,1,C.yellow);
 // Two access steps, brackets and side service strips.
 box(s<0?-5:4,1,4,2,3,1,C.dark,main,ID.metal);
 box(s<0?-6:5,1,3,1,3,1,C.silver,main,ID.metal);
 box(s<0?-3:3,-8,5,1,6,1,C.yellow);
 for(let y=-7;y<=-3;y+=2)box(s<0?-3:3,y,6,1,1,1,C.dark);
}
const seat=part(ID.seat,[0,3,8],{xaxis:1,zaxis:-2,color:C.dark,controller:state(ID.seat)});
const ec=state(ID.engine);ec.containers[0].container=[{quantity:10,uuid:'d4d68946-aa03-4b8f-b1af-96b81ad4e305'}];
const engine=part(ID.engine,[0,-4,6],{controller:ec,color:C.dark});b.connect(seat,engine);
for(const {j,reverse} of drive)b.connect(engine,j,{reverse});
seat.controller.steering=steer.map(j=>({id:j.id,leftAngleLimit:25,rightAngleLimit:25,leftAngleSpeed:4.244132041931152,rightAngleSpeed:4.244132041931152,unlocked:true}));
for(const j of steer)b.connect(seat,j,{reverse:1});
const lightSwitch=part(ID.switch,[-2.5,1.5,6.5],{xaxis:1,zaxis:-2,controller:{active:false},color:C.yellow});b.connect(seat,lightSwitch);
const hornSwitch=part(ID.switch,[2.5,1.5,6.5],{xaxis:1,zaxis:-2,controller:{active:false},color:C.red});b.connect(seat,hornSwitch);
const horn=part(ID.horn,[2.5,5.5,15.5],{xaxis:1,zaxis:-2,controller:{},color:C.silver});b.connect(hornSwitch,horn);
for(const [x,y,z,direction,color] of [[-2.5,-10.5,6.5,-2,'FFF0BF'],[3.5,-10.5,6.5,-2,'FFF0BF'],[-2.5,-.5,12.5,-2,'FFF0BF'],[3.5,-.5,12.5,-2,'FFF0BF'],[-7.5,12.5,8.5,2,'FF2525'],[8.5,12.5,8.5,2,'FF2525']]){
 const lamp=part(ID.light,[x,y,z],{xaxis:1,zaxis:direction,color,controller:{color,coneAngle:0,luminance:100}});b.connect(lightSwitch,lamp);
}
// Exhaust stack and intake, mirrors, handrails and rear drawbar.
box(2,-3,9,1,1,1,C.dark);for(const z of [11.5,14.5])part(ID.pipe,[2.5,-2.5,z],{xaxis:1,zaxis:-2,color:C.dark});
box(2,-4,16,1,2,1,C.dark);
box(-2,-2,9,1,1,3,C.dark);box(-3,-2,12,2,1,1,C.silver);
for(const s of [-1,1]){box(s<0?-5:4,0,11,2,1,1,C.dark);box(s<0?-6:6,0,10,1,1,2,C.silver);box(s<0?-4:4,1,5,1,1,5,C.silver);}
box(-1,9,3,3,4,1,C.dark,main,ID.metal);box(-1,12,4,1,2,1,C.silver,main,ID.metal);box(1,12,4,1,2,1,C.silver,main,ID.metal);box(0,13,4,1,1,1,C.yellow,main,ID.metal);
for(const x of [-2,2]){box(x,9,4,1,3,1,C.silver,main,ID.metal);box(x,11,5,1,1,1,C.yellow);}
box(-5,1,3,1,3,1,C.dark,main,ID.metal);
const result=saveDraft(NAME,weldBlockVolumes(b.build(),catalog));fs.writeFileSync(new URL('../workspace/Ironfield 840 Tractor.validation.json',import.meta.url),JSON.stringify(result.report,null,2));console.log(JSON.stringify(result,null,2));






