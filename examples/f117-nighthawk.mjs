import fs from 'node:fs';
import {BlueprintBuilder,saveDraft} from '../lib/builder.mjs';
import {catalog,WORK} from '../lib/assets.mjs';
import {basis,rotate,sub,jointOrigin,shapeBox,dimensions} from '../lib/geometry.mjs';
import {weldBlockVolumes} from '../lib/blocks.mjs';
import {validate} from '../lib/validate.mjs';
import {wedgePieces} from '../lib/wedges.mjs';
const NAME='F117 Nighthawk True Scale',b=new BlueprintBuilder(),main=b.body(),grids=new Map(),reserved=new Map();
const ID={panel:'628b2d61-5ceb-43e9-8334-a4135566df7a',metal:'8aedf6c2-94e1-4506-89d4-a0227c552f1e',glass:'5f41af56-df4c-4837-9b3c-10781335757f',wedge:'bf3de51c-14c1-11ed-861d-0242ac120002',glassWedge:'3bb5dc9e-14bd-11ed-861d-0242ac120002',bearing:'4a1b886b-913e-4aad-b5b6-6e41b0db23a6',wheel:'69e362c3-32aa-4cd1-adc0-dcfc47b92c0d',seat:'ffa3a47e-fc0d-4977-802f-bd15683bbe5c',thruster:'5e96037a-a338-490a-a76f-6b4d820f8e46',engine:'3091926a-9340-46d9-83d6-4fd7c68ad950',switch:'7cf717d7-d167-4f2d-a6e7-6b2c70aa3986',button:'1e8d93a4-506b-470d-9ada-9c0a321e2db5',controller:'a092359d-5cea-484d-a274-470d9a567632',light:'ed27f5e2-cac5-4a32-a5d9-49f116acc6af',logic:'9f0f56e8-2c31-4d83-996c-d00a9b296c3f',sensor:'20dcd41c-0a11-4668-9b00-97f278ce21af',grid:'0a597f6d-eb45-4f93-91e5-130e19e0f1f5',pipe:'07232236-22eb-4912-8774-ab185f368bb9',largePipe:'53e8478f-517f-4ea0-be9c-f4a357400cc1',gauge:'0dba257b-b907-4919-baaf-2fefe19f4e24',radio:'dfefc9d7-db03-4d25-ad85-eae1d824d8c0'};
const C={black:'171A1D',facet:'22262A',edge:'30353B',belly:'202327',white:'8A9299',frame:'353B42',silver:'88949E',console:'262D32',green:'54B572',red:'C62E29',yellow:'D3B931'};
function grid(body){if(!grids.has(body))grids.set(body,new Map());return grids.get(body);}
function cell(body,x,y,z,color=C.black,material=ID.panel){const key=[x,y,z].join(',');if(reserved.get(body)?.has(key))return;grid(body).set(key,{x,y,z,color,material});}
function box(body,x,y,z,w,d,h,color=C.black,material=ID.panel){for(let a=x;a<x+w;a++)for(let c=y;c<y+d;c++)for(let e=z;e<z+h;e++)cell(body,a,c,e,color,material);}
function reserve(body,s){if(!reserved.has(body))reserved.set(body,new Set());const q=shapeBox(s,catalog.get(s.shapeId));for(let x=q.min[0];x<q.max[0];x++)for(let y=q.min[1];y<q.max[1];y++)for(let z=q.min[2];z<q.max[2];z++){const key=[x,y,z].join(',');reserved.get(body).add(key);grid(body).delete(key);}return s;}
function part(body,id,center,opts={}){return reserve(body,b.centered(body,id,center,opts));}
function wedge(body,pos,bounds,opts={}){const id=opts.glass?ID.glassWedge:ID.wedge,{pieces}=wedgePieces(catalog.get(id),pos,bounds,{color:C.black,...opts});return pieces.map(s=>reserve(body,b.part(body,s.shapeId,s.pos,s)))[0];}
function support(body,pos,bounds=[1,1,1],color=C.frame){return reserve(body,b.part(body,ID.metal,pos,{bounds,color}));}
function bearing(a,c,p,xaxis,zaxis){const cell=sub(sub(p,rotate(basis(xaxis,zaxis),[.5,.5,0])),jointOrigin([0,0,0],xaxis,zaxis));return b.joint(a,c,ID.bearing,cell,{xaxis,zaxis,color:C.frame});}
function lerp(points,y){for(let i=1;i<points.length;i++)if(y<=points[i][0]){const [a,v]=points[i-1],[c,w]=points[i];return v+(w-v)*(y-a)/(c-a);}return points.at(-1)[1];}
const half=y=>Math.round(lerp([[0,0],[8,2],[16,4],[26,7],[36,8],[62,8],[70,6],[79,3]],y));
const roof=y=>Math.round(lerp([[0,5],[8,7],[16,9],[27,10],[40,11],[56,10],[68,8],[79,6]],y));
const modules=[];
// Quarter-meter grid: 80 x 53 x 15 blocks = 20.00 x 13.25 x 3.75 m.
// Thin hollow shell, positive face-connected ribs, faceted shoulders and nose.
for(let y=0;y<80;y++){
 const h=half(y),top=roof(y),cockpit=y>=18&&y<34;
 for(let x=-h;x<=h;x++){
 const bay=y>=38&&y<53&&(x>=-3&&x<0||x>=1&&x<4),noseGear=y>=17&&y<23&&x>=-1&&x<2,mainGear=y>=53&&y<60&&Math.abs(x-.5)>5;
 if(!bay&&!noseGear&&!mainGear)cell(main,x,y,4,C.belly);
 if(!cockpit||x<-3||x>=4)cell(main,x,y,top-1,((y%9===0)&&(Math.abs(x)>3))?C.facet:C.black);
 }
 if(top>5){cell(main,-h,y,5,C.facet);cell(main,h,y,5,C.facet);box(main,-h,y,6,1,1,Math.max(0,top-6),C.facet);if(h>0)box(main,h,y,6,1,1,Math.max(0,top-6),C.facet);}
 // Longitudinal keel and transverse frames below the interior roof.
 if(y%7===0&&top>6)box(main,-h,y,5,2*h+1,1,1,C.frame);
 if(y<17||y>=34)cell(main,0,y,5,C.frame);
}
// Roof shoulder wedges remain hollow at the center; bottom faces sit on ribs.
for(let y=36;y<64;y+=4){const h=half(y),top=roof(y);if(h>=4&&!(y>=18&&y<34)){
 box(main,-h,y,5,2,4,1,C.facet);box(main,h-1,y,5,2,4,1,C.facet);
 wedge(main,[-h+2,y,6],[4,2,Math.max(1,top-6)],{xaxis:2,zaxis:3,color:C.facet});
 wedge(main,[h-1,y+4,6],[4,2,Math.max(1,top-6)],{xaxis:-2,zaxis:3,color:C.facet});
}}
// Broad swept wings: native resizable wedges, not voxel staircases.
for(const side of [-1,1]){
 const x=side<0?-8:9;
 box(main,side<0?-8:8,25,4,1,44,1,C.edge);
 wedge(main,[x,54,side<0?6:5],[1,28,18],{xaxis:side<0?-3:3,zaxis:side,color:C.black});
 wedge(main,[x,54,side<0?5:6],[1,14,18],{xaxis:side<0?3:-3,zaxis:side,color:C.facet});
 // Small native ramp strips form the elevon hinge-line detail.
 for(let j=0;j<7;j++){const xx=side<0?-19+j:13+j;box(main,xx,57,6,1,1,1,C.edge);}
}
modules.push({name:'Airframe',description:'80-block hollow faceted fuselage; swept native wedge wings; removable access panels'});
// Twin serrated inlet mouths with original ventilation meshes.
for(const side of [-1,1]){
 const x=side<0?-6:6;
 box(main,x-2,31,7,5,1,4,C.edge);box(main,x-2,30,6,5,3,1,C.black);
 part(main,ID.grid,[x+.5,30.5,8.5],{xaxis:1,zaxis:-2,color:C.black});
 for(let n=0;n<4;n++)box(main,x-2+n,29+(n%2),6,1,1,1,C.edge);
 box(main,x-2,34,5,5,1,3,C.frame);
 for(let y=35;y<65;y+=8){box(main,x-1,y,5,3,1,1,C.silver);}
 // Twin simulated internal F404 cases and accessible service details.
 part(main,ID.largePipe,[x+.5+(side<0?1:-1),43,6.5],{color:C.edge});
 part(main,ID.largePipe,[x+.5+(side<0?1:-1),51,6.5],{color:C.edge});
 box(main,x-1,42,4,3,10,1,C.frame);
}
// Cockpit floor and bulkheads, canopy seal, instrument panel and side consoles.
box(main,-3,18,6,7,16,1,C.console);box(main,-3,18,7,7,1,2,C.frame);box(main,-3,33,7,7,1,2,C.frame);
box(main,-3,20,7,1,11,1,C.console);box(main,3,20,7,1,11,1,C.console);
box(main,-3,20,8,7,1,2,C.console);box(main,-3,17,9,7,1,1,C.edge);box(main,-4,18,8,1,16,1,C.frame);box(main,4,18,8,1,16,1,C.frame);
const seat=part(main,ID.seat,[0,27,9],{xaxis:1,zaxis:-2,color:C.black,controller:{containers:null,steering:[]}});
for(const x of [-2.5,-.5,1.5,3.5])part(main,ID.gauge,[x,19.5,8.5],{xaxis:2,zaxis:3,color:C.silver});
box(main,-1,22,9,3,1,1,'487F68',ID.glass);box(main,-1,22,7,1,1,1,C.silver);box(main,1,22,7,1,1,1,C.silver);
// Ejection handles, harness hardware, circuit breakers and radio.
box(main,-2,30,8,1,1,2,C.yellow);box(main,2,30,8,1,1,2,C.yellow);box(main,-2,31,9,5,1,1,C.black);
part(main,ID.radio,[2,31,8.5],{color:C.console});box(main,1,30,7,2,2,1,C.frame);
for(let y=22;y<31;y+=2){cell(main,-3,y,7,C.silver);cell(main,3,y,7,C.edge);}
// Pilot numbered inputs, in connection order.
const controls=[];const labels=['Lift','Boost','Pitch up','Pitch down','Roll left','Roll right','Yaw left','Yaw right','Landing gear','Bay doors'];
for(let i=0;i<10;i++){const side=i<5?-2.5:3.5,y=22.5+(i%5),hold=i>=2&&i<=7;const c=part(main,hold?ID.button:ID.switch,[side,y,8.5],{xaxis:1,zaxis:-2,color:i<2?C.green:i<8?C.edge:C.yellow,controller:hold?{}:{active:false}});b.connect(seat,c);controls.push(c);}
// Animated canopy, built as a separate body; hinge contacts only metal cubes.
const canopy=b.body();box(canopy,-3,22,12,7,8,1,'53656A',ID.glass);
box(canopy,-3,22,9,1,8,3,'53656A',ID.glass);box(canopy,3,22,9,1,8,3,'53656A',ID.glass);
wedge(canopy,[4,22,10],[7,4,3],{xaxis:-1,zaxis:3,color:'53656A',glass:true});
wedge(canopy,[-3,30,10],[7,4,3],{color:'53656A',glass:true});
for(const x of [-3,3]){box(canopy,x,18,9,1,16,1,C.edge);box(canopy,x,22,10,1,1,3,C.edge);box(canopy,x,29,10,1,1,3,C.edge);}
box(canopy,-3,22,12,7,1,1,C.edge);box(canopy,-3,29,12,7,1,1,C.edge);box(canopy,-3,33,9,7,1,1,C.edge);
const ca=support(main,[-4,34,9]),cb=support(canopy,[-3,34,9]);const canopyJoint=bearing(ca,cb,[-3,34.5,9.5],2,1);
function sequence(name,center,links){const c=part(main,ID.controller,center,{color:C.console,controller:{playMode:0,timePerFrame:2}});c.controller.joints=links.map(({j,angle=90,reverse=false},i)=>({id:j.id,index:i,reverse:!reverse,startAngle:0,endAngle:angle,frames:Array.from({length:11},(_,n)=>({targetAngle:n===1?angle:0}))}));modules.push({name,controller:c.controller.id,joints:links.map(x=>x.j.id)});return c;}
const canopyControl=sequence('Canopy',[2,34.5,8.5],[{j:canopyJoint,reverse:true}]);box(main,1,34,7,2,1,1,C.frame);
const canopySwitch=part(main,ID.switch,[5.5,32.5,9.5],{xaxis:2,zaxis:3,color:C.yellow,controller:{active:false}});box(main,6,32,9,1,1,1,C.frame);b.connect(canopySwitch,canopyControl);
// Tricycle gear with three powered folding hinges, nose steering and free wheels.
const retract=[],wheelJoints=[];
const noseLeg=b.body(),na=support(main,[-2,19,4]),nl=support(noseLeg,[-1,19,2],[1,1,3]);const nj=bearing(na,nl,[-1,19.5,4.5],2,1);retract.push({j:nj});
const noseHub=b.body(),nh=support(noseHub,[-1,19,1]);const steering=bearing(nl,nh,[-.5,19.5,2],1,-3);
seat.controller.steering=[{id:steering.id,leftAngleLimit:25,rightAngleLimit:25,leftAngleSpeed:4.244132041931152,rightAngleSpeed:4.244132041931152,unlocked:true}];b.connect(seat,steering,{reverse:1});
const noseWheel=b.body(),nw=part(noseWheel,ID.wheel,[.5,19.5,1.5],{xaxis:2,zaxis:1,color:C.silver});wheelJoints.push({j:bearing(nh,nw,[0,19.5,1.5],2,1),reverse:1});
for(const side of [-1,1]){const x=side<0?-7:7,leg=b.body(),a=support(main,[x,55,4]),c=support(leg,[x,54,2],[1,1,3]);retract.push({j:bearing(a,c,[x+.5,55,4.5],1,-2),reverse:side>0});const hub=support(leg,[x,54,1]);box(leg,x,54,1,1,1,1,C.silver);box(leg,x+(side<0?1:-1),54,2,1,1,2,C.belly);const wheelBody=b.body(),face=side<0?x:x+1,w=part(wheelBody,ID.wheel,[face+side*.5,54.5,1.5],{xaxis:2,zaxis:side,color:C.silver});wheelJoints.push({j:bearing(hub,w,[face,54.5,1.5],2,side),reverse:side>0?1:0});}
const gearControl=sequence('Retractable landing gear',[-2,35.5,8.5],retract);box(main,-3,35,7,2,1,1,C.frame);b.connect(controls[8],gearControl);
// Taxi engine preserves the observed native saved Lua payload; gear 4 is moderate.
const taxi=part(main,ID.engine,[0,36,6],{xaxis:1,zaxis:-2,color:C.console,controller:{data:'8B1MVUEAAAABBQAAAAICAAAABQBmdWVsUG9pbnRzCAAEAAAAB2dlYXJJZHgIBA',containers:[{container:[{quantity:10,uuid:'d4d68946-aa03-4b8f-b1af-96b81ad4e305'}],filters:[{uuid:'d4d68946-aa03-4b8f-b1af-96b81ad4e305'}],id:0,slots:1,stackSize:10}]}});box(main,-1,35,4,2,2,1,C.frame);b.connect(seat,taxi);for(const {j,reverse}of wheelJoints)b.connect(taxi,j,{reverse});
// Functional internal bay doors and inert stores racks.
const doors=[];for(const side of [-1,1]){const x=side<0?-3:1,door=b.body();box(door,side<0?-2:1,38,3,2,14,1,C.belly);const a=support(main,[side<0?-3:3,52,3]),c=support(door,[side<0?-3:3,51,3]);doors.push({j:bearing(a,c,[side<0?-2.5:3.5,52,3.5],1,-2),reverse:side<0});
 box(main,x,37,4,3,1,4,C.frame);box(main,side<0?-4:4,38,3,1,14,1,C.belly);box(main,side<0?-3:3,37,3,1,1,2,C.frame);box(main,x,52,4,3,1,4,C.frame);
 part(main,ID.largePipe,[x+1.5,46,6.5],{color:C.edge});box(main,x,43,4,3,6,1,C.frame);box(main,x,41,5,3,1,1,C.yellow);box(main,x,49,5,3,1,1,C.yellow);
}
const bayControl=sequence('Internal stores bay',[3,37.5,8.5],doors);box(main,2,37,7,2,1,1,C.frame);b.connect(controls[9],bayControl);
// Continuous 45-degree V-tail plates: two complementary native prisms per
// height layer form a thin parallelogram, with full-area face adhesion.
for(const side of [-1,1]){
 box(main,side<0?-6:6,64,7,1,16,1,C.edge);
 for(let k=0;k<7;k++){const x=side<0?-6-k:6+k,y=64+k*2,len=80-y,zz=8+k;
 wedge(main,[side<0?x:x+1,side<0?80:y,zz],[len,1,1],{xaxis:side<0?-2:2,zaxis:3,color:C.black});
 wedge(main,[side<0?x:x+1,side<0?80:y,zz+1],[len,1,1],{xaxis:side<0?-2:2,zaxis:-3,color:C.black});
 }
}
// Low-observable exhaust troughs and heat shields; two native propulsion jets.
const forward=[];for(const side of [-1,1]){const x=side<0?-5:4;
 box(main,x-2,68,5,5,8,1,C.edge);box(main,x-2,75,6,5,1,1,C.silver);box(main,x-2,69,7,5,6,1,C.black);
 const jet=part(main,ID.thruster,[x,73,6],{xaxis:1,zaxis:2,color:C.black,controller:{level:6}});box(main,x-1,70,5,2,1,2,C.frame);b.connect(seat,jet);forward.push(jet);
 const booster=part(main,ID.thruster,[x+2,73,6],{xaxis:1,zaxis:2,color:C.black,controller:{level:4}});box(main,x+1,70,5,2,1,2,C.frame);b.connect(controls[1],booster);
}
// Native game has no aerodynamic lift: distributed hidden lift jets and torque
// couples supply actual force. No mod/API/controller payload is synthesized.
function jet(name,position,direction,source,level=6){const t=part(main,ID.thruster,position,{xaxis:Math.abs(direction)===1?2:1,zaxis:direction,color:C.black,controller:{level}});const q=shapeBox(t,catalog.get(ID.thruster)),k=Math.abs(direction)-1,sign=Math.sign(direction),lo=[...q.min],hi=[...q.max];if(sign>0){lo[k]--;hi[k]=q.min[k];}else{lo[k]=q.max[k];hi[k]++;}box(main,...lo,...hi.map((v,i)=>v-lo[i]),C.frame);b.connect(source,t);return t;}
// Local +Z is exhaust; force is opposite the nozzle axis.
for(const x of [-5,0,5])for(const y of [38,46,58,64])jet('Lift',[x, x===0&&y===38?35:x===0&&y===46?56:y,3],-3,controls[0],6);
for(const x of [-5,5]){jet('Pitch down aft',[x,70,3],-3,controls[3],4);jet('Pitch down nose',[x,36,8],3,controls[3],4);jet('Pitch up nose',[x,36,3],-3,controls[2],4);jet('Pitch up aft',[x<0?-3:3,64,8],3,controls[2],4);}
jet('Roll left right',[5,60,3],-3,controls[4],4);jet('Roll left left',[-5,60,8],3,controls[4],4);jet('Roll right left',[-5,60,3],-3,controls[5],4);jet('Roll right right',[5,60,8],3,controls[5],4);
jet('Yaw left nose',[0,40,6],1,controls[6],4);jet('Yaw left aft',[0,68,6],-1,controls[6],4);jet('Yaw right nose',[0,40,9],-1,controls[7],4);jet('Yaw right aft',[0,65,6],1,controls[7],4);
// Landing/navigation lamps, sight sensor, native circuit logic and status light.
for(const [p,z,color]of [[[0.5,17.5,3.5],-2,'EEE5CB'],[[-25.5,54.5,6.5],-1,'D93225'],[[26.5,54.5,6.5],1,'31B767'],[[.5,77.5,7.5],2,'EEEEEE']]){const lamp=part(main,ID.light,p,{xaxis:Math.abs(z)===1?2:1,zaxis:z,color,controller:{color,coneAngle:0,luminance:100}});b.connect(controls[0],lamp);}
const sensor=part(main,ID.sensor,[.5,13.5,3.5],{xaxis:1,zaxis:-2,color:C.black,controller:{range:20,colorMode:false,color:'EEEEEE',buttonMode:true,audioEnabled:false}});box(main,0,13,6,1,1,1,C.frame);
const warning=part(main,ID.light,[-2.5,20.5,8.5],{xaxis:1,zaxis:2,color:C.red,controller:{color:C.red,coneAngle:0,luminance:50}});box(main,-3,19,7,1,1,2,C.frame);b.connect(sensor,warning);
// Panel/rivet variation and subdued stencils paint existing connected cells.
for(const [body,g]of grids)for(const c of g.values())if(body===main&&c.z>=8&&c.y%13===0&&c.color===C.black)c.color=C.facet;

// Internal mounts connect lift platforms, control boxes, HUD and service cases.
for(let y=34;y<76;y++){box(main,-7,y,5,15,1,1,C.frame);cell(main,0,y,6,C.frame);}
for(let y=10;y<18;y++)box(main,-3,y,5,7,1,1,C.frame);
for(const x of [-1,1])box(main,x,22,7,1,1,3,C.frame);
box(main,-3,34,5,7,2,3,C.frame);box(main,-3,9,4,7,2,1,C.frame);
box(main,3,30,7,1,1,1,C.frame);
box(main,6,32,8,1,1,1,C.frame);
box(main,0,18,4,2,1,1,C.frame);box(main,0,77,6,1,1,1,C.frame);
for(const x of [-5,5])box(main,x-1,63,6,2,2,2,C.frame);
for(const x of [-10,11]){box(main,x-1,51,4,2,2,1,C.frame);box(main,x-1,51,6,2,2,1,C.frame);box(main,x-1,51,7,2,2,1,C.frame);}
// Smooth nose facets, tapered in plan and rising toward the canopy. Each
// installed wedge occupies its own X strip; the forward section has no joints.
for(const [key,c]of grid(main))if(c.y<18&&c.z>=4)grid(main).delete(key);
for(let x=-5;x<=5;x++){const first=Math.round(Math.abs(x)*2.5);wedge(main,[x+1,18,4],[1,18-first,5],{xaxis:-1,zaxis:3,color:C.black});}
// Flush dorsal shrouds cover attitude jets without changing their nozzle state.
for(const x of [-5,5]){box(main,x-1,35,10,2,2,1,C.black);box(main,x-1,35,7,2,2,1,C.frame);}
box(main,-3,39,7,6,2,1,C.frame);box(main,-1,39,10,2,2,1,C.black);
// Flush faceted attitude-jet housings, with empty interiors for native parts.
for(const cx of [-5,5]){box(main,cx-1,59,5,2,2,1,C.frame);box(main,cx-2,59,6,1,2,5,C.black);box(main,cx+1,59,6,1,2,5,C.black);box(main,cx-1,59,10,2,2,1,C.black);box(main,cx-1,58,6,2,1,5,C.black);box(main,cx-1,61,6,2,1,5,C.black);}
for(const cx of [-3,3]){box(main,cx-2,63,6,1,2,4,C.black);box(main,cx+1,63,6,1,2,4,C.black);box(main,cx-1,63,10,2,2,1,C.black);box(main,cx-1,62,6,2,1,5,C.black);box(main,cx-1,65,6,2,1,5,C.black);}
// Physical clearance envelopes for wheels/gear doors and bay hinge brackets.
for(const [key,c]of grid(main)){
 const nose=c.y>=20&&c.y<23&&c.x>=-1&&c.x<2&&c.z>=3&&c.z<6;
 const gear=c.y>=53&&c.y<57&&((c.x>=-8&&c.x<-2)||(c.x>=3&&c.x<9))&&c.z>=4&&c.z<7;
 const bayHinge=c.y===51&&((c.x>=-4&&c.x<-2)||(c.x>=3&&c.x<5))&&c.z>=3&&c.z<5;
 if(nose||gear||bayHinge)grid(main).delete(key);
}
for(const x of [-7,7])box(main,x,56,4,1,2,1,C.frame);
// Emit non-overlapping cell runs; preserve native part and joint references.
for(const [body,g]of grids){const ordered=[...g.values()].sort((a,b)=>a.z-b.z||a.y-b.y||a.x-b.x),runs=[];for(const c of ordered){const last=runs.at(-1);if(last&&last.id===c.material&&last.color===c.color&&last.y===c.y&&last.z===c.z&&last.x+last.w===c.x)last.w++;else runs.push({id:c.material,color:c.color,x:c.x,y:c.y,z:c.z,w:1});}for(const r of runs)b.part(body,r.id,[r.x,r.y,r.z],{bounds:[r.w,1,1],color:r.color});}
// Clear fixed block cells swept by the gear and canopy, including blocks
// emitted by wedge subdivision. Keep every actual joint support object intact.
const protectedSupports=new Set(b.joints.flatMap(j=>[j._a,j._b]));
function clearanceCell(x,y,z){return ((x===-3||x===3)&&y>=53&&y<57&&z===4)||((x===-3||x===3)&&y>=18&&y<34&&z===9)||(x>=-3&&x<4&&y>=33&&y<36&&z>=8&&z<12)||(x>=-1&&x<2&&y>=18&&y<25&&z>=3&&z<6);}
main.childs=main.childs.flatMap(s=>{if(protectedSupports.has(s)||catalog.get(s.shapeId).kind!=='block')return [s];const q=shapeBox(s,catalog.get(s.shapeId)),kept=[];let removed=false;for(let x=q.min[0];x<q.max[0];x++)for(let y=q.min[1];y<q.max[1];y++)for(let z=q.min[2];z<q.max[2];z++){if(clearanceCell(x,y,z)){removed=true;continue;}const extent=rotate(basis(s.xaxis,s.zaxis),[1,1,1]),p=[x,y,z].map((v,i)=>v+(extent[i]<0?1:0));kept.push({...s,pos:{x:p[0],y:p[1],z:p[2]},bounds:{x:1,y:1,z:1}});}return removed?kept:[s];});
const bp=weldBlockVolumes(b.build(),catalog),report=validate(bp,catalog);if(!report.ok||report.attachments.disconnected.length)throw Error(JSON.stringify({errors:report.errors,loose:report.attachments.disconnected.map(g=>({body:g.body,shapes:g.components.slice(1).flat().map(i=>bp.bodies.flatMap(b=>b.childs)[i])}))}));const result=saveDraft(NAME,bp);
const facts={name:NAME,scaleMetersPerBlock:.25,reference:{length:20.09,wingspan:13.21,height:3.78,url:'https://www.lockheedmartin.com/content/dam/lockheed-martin/aero/documents/F-117/F117%20Fast%20Facts_FINAL.pdf'},targetGrid:{length:80,span:53,height:15},modules,controls:{'W/S':'Forward jets and taxi engine; S does not provide reverse jet thrust','A/D':'Nosewheel steering',...Object.fromEntries(labels.map((label,i)=>[String((i+1)%10),label]))},canopy:'Exterior yellow switch at right rear cockpit opens canopy',limitations:['Not spawned or flown in the native game. Thrust, taxi directions, trim and stability need testing.','Stock game lacks aerodynamic lift; flight uses distributed concealed lift and attitude jets.','V-tail is a continuous native-wedge plate with a quarter-meter stepped leading outline. Wedge rendering is procedural and not engine shader parity.','No gyroscopic automatic stabilization or automatic landing.','Bay payloads are inert. No radar/stealth or working avionics simulation.'],validation:report};
facts.motionConvention='native-clockwise-sequence-v1';
fs.writeFileSync(WORK+'/'+NAME+'.design.json',JSON.stringify(facts,null,2));console.log(JSON.stringify({file:result.file,stats:report.stats,warnings:report.warnings,disconnected:report.attachments?.disconnected},null,2));








