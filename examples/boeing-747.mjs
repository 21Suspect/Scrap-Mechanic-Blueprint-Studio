import fs from 'node:fs';
import {BlueprintBuilder,saveDraft} from '../lib/builder.mjs';
import {catalog,WORK} from '../lib/assets.mjs';
import {basis,rotate,sub,jointOrigin,shapeBox,dimensions} from '../lib/geometry.mjs';
import {validate} from '../lib/validate.mjs';
import {enrichEngineAssets} from '../lib/engine-assets.mjs';
const NAME='Boeing 747-8 Grand Airliner',b=new BlueprintBuilder(),main=b.body(),grids=new Map(),reserved=new Map();
const ID={panel:'628b2d61-5ceb-43e9-8334-a4135566df7a',metal:'8aedf6c2-94e1-4506-89d4-a0227c552f1e',glass:'5f41af56-df4c-4837-9b3c-10781335757f',wedge:'bf3de51c-14c1-11ed-861d-0242ac120002',bearing:'4a1b886b-913e-4aad-b5b6-6e41b0db23a6',wheel:'db66f0b1-0c50-4b74-bdc7-771374204b1f',seat:'ffa3a47e-fc0d-4977-802f-bd15683bbe5c',passenger:'3b972f2f-30c7-4a5e-a100-5e257e62295d',engine:'6546c293-a5aa-4442-80d5-a2819f077746',switch:'7cf717d7-d167-4f2d-a6e7-6b2c70aa3986',button:'1e8d93a4-506b-470d-9ada-9c0a321e2db5',controller:'a092359d-5cea-484d-a274-470d9a567632',light:'ed27f5e2-cac5-4a32-a5d9-49f116acc6af',logic:'9f0f56e8-2c31-4d83-996c-d00a9b296c3f',sink:'3fa0afca-7715-459e-86fa-2a81cf3027b8',toilet:'ca003562-fde7-463c-969e-f8334ae54387',gauge:'0dba257b-b907-4919-baaf-2fefe19f4e24',radio:'dfefc9d7-db03-4d25-ad85-eae1d824d8c0',grid:'0a597f6d-eb45-4f93-91e5-130e19e0f1f5'};
const C={white:'E7E9E7',navy:'193750',blue:'287FA1',gold:'CCA85C',silver:'A4ADB1',dark:'293138',floor:'646B70',seat:'35556F',red:'D44236',green:'36BE78',glass:'87C8DD'};
const controls=[],mechanisms=[],seats=[];
function grid(body){if(!grids.has(body))grids.set(body,new Map());return grids.get(body);}
function cell(body,x,y,z,color=C.white,material=ID.panel){const k=[x,y,z].join(',');if(!reserved.get(body)?.has(k))grid(body).set(k,{x,y,z,color,material});}
function box(body,x,y,z,w,d,h,color=C.white,material=ID.panel){for(let a=x;a<x+w;a++)for(let c=y;c<y+d;c++)for(let e=z;e<z+h;e++)cell(body,a,c,e,color,material);}
function reserve(body,s){if(!reserved.has(body))reserved.set(body,new Set());const q=shapeBox(s,catalog.get(s.shapeId));for(let x=q.min[0];x<q.max[0];x++)for(let y=q.min[1];y<q.max[1];y++)for(let z=q.min[2];z<q.max[2];z++){const k=[x,y,z].join(',');reserved.get(body).add(k);grid(body).delete(k);}return s;}
function part(body,id,p,o={}){return reserve(body,b.centered(body,id,p,o));}
function support(body,p,size=[1,1,1],color=C.silver){return reserve(body,b.part(body,ID.metal,p,{bounds:size,color}));}
function bearing(a,c,p,xaxis,zaxis){return b.joint(a,c,ID.bearing,sub(sub(p,rotate(basis(xaxis,zaxis),[.5,.5,0])),jointOrigin([0,0,0],xaxis,zaxis)),{xaxis,zaxis,color:C.silver});}
function wedge(body,p,size,o={}){if(size.some(v=>v>8))throw Error('Oversized wedge');return reserve(body,b.part(body,ID.wedge,p,{bounds:size,color:C.white,...o}));}
function lerp(points,y){for(let i=1;i<points.length;i++)if(y<=points[i][0]){const [a,v]=points[i-1],[c,w]=points[i];return v+(w-v)*(y-a)/(c-a);}return points.at(-1)[1];}
const radius=y=>lerp([[0,1],[6,4],[16,9],[30,13],[244,13],[265,10],[290,5],[305,1]],y);
const cz=y=>lerp([[0,32],[30,34],[244,34],[305,43]],y);
function inside(x,y,z,shrink=0){const r=radius(y)-shrink;return r>0&&((x+.5)/r)**2+((z+.5-cz(y))/(r*1.1))**2<=1;}
const gearBays=(x,y,z)=>z<27&&((Math.abs(x)<5&&y>=39&&y<65)||(Math.abs(x)<12&&y>=181&&y<207));
const doorStations=[52,89,140,173,231];
const doorOpening=(x,y,z)=>Math.abs(x)>=11&&doorStations.some(d=>y>=d-1&&y<d+7)&&z>=31&&z<40;
for(let y=0;y<306;y++)for(let x=-14;x<14;x++)for(let z=18;z<60;z++){
 if(!inside(x,y,z))continue;
 const boundary=!inside(x-2,y,z)||!inside(x+2,y,z)||!inside(x,y,z-2)||!inside(x,y,z+2)||y===0||y===305;
 if(!boundary||gearBays(x,y,z)||doorOpening(x,y,z))continue;
 const window=y>=35&&y<244&&y%6>=1&&y%6<=2&&z>=36&&z<=38&&Math.abs(x)>=11;
 const cockpit=y>=12&&y<=28&&z>=41&&z<=44&&Math.abs(x)>=5;
 cell(main,x,y,z,window||cockpit?C.glass:z<30?C.navy:z===34?C.gold:z===35?C.blue:C.white,window||cockpit?ID.glass:ID.panel);
}
// Decks, keel, bulkhead frames, cargo floor.
for(let y=18;y<282;y++)for(let x=-12;x<12;x++){
 if(inside(x,y,30))cell(main,x,y,30,Math.abs(x)<2?C.blue:C.floor);
 if(inside(x,y,24)&&!gearBays(x,y,24))cell(main,x,y,24,C.floor);
 if(y%24===0)for(let z=25;z<30;z++)if(inside(x,y,z)&&Math.abs(x)>10)cell(main,x,y,z,C.silver);
}
// Upper deck hump joined to main barrel, with curved shoulder steps.
for(let y=16;y<116;y++){
 const rx=Math.round(lerp([[16,4],[30,9],[80,9],[100,6],[115,1]],y)),top=Math.round(lerp([[16,45],[30,56],[80,56],[100,51],[115,47]],y));
 for(let x=-rx;x<rx;x++){
  box(main,x,y,43,1,1,1,C.floor);
  const roof=top-Math.floor(Math.abs(x+.5)/3);
  box(main,x,y,roof-1,1,1,2,C.white);
  if(x===-rx||x===rx-1)for(let z=44;z<roof;z++)cell(main,x,y,z,(y%7<2&&y>34&&y<85&&z>=48&&z<50)?C.glass:C.white,(y%7<2&&y>34&&y<85&&z>=48&&z<50)?ID.glass:ID.panel);
 }
}
// Remove main barrel ceiling inside upper deck and stairwell.
for(const [k,c]of grid(main))if(c.y>=30&&c.y<96&&Math.abs(c.x)<7&&c.z>=44&&c.z<49)grid(main).delete(k);
for(let n=0;n<13;n++)box(main,-2,96+n,30+n,4,1,2,C.gold);
for(let y=96;y<110;y++)for(let z=31;z<44;z++)if(z<31+y-96)box(main,-3,y,z,1,1,1,C.white);
// Wings: airfoil volumes, swept outline, leading-edge native wedges and panel seams.
function wingEdge(x){const a=Math.abs(x+.5);return {front:Math.round(131+(a-12)*.65),back:Math.round(209+(a-12)*.16),z:26+Math.floor(Math.max(0,a-20)/25)};}
const flapRegions=[];
for(const side of [-1,1])for(const [lo,hi]of [[30,60],[82,112]])flapRegions.push({side,lo,hi,y:side,links:[]});
for(let x=-137;x<137;x++){
 if(Math.abs(x+.5)<10)continue;
 const {front,back,z}=wingEdge(x),a=Math.abs(x+.5),flap=flapRegions.find(f=>Math.sign(x+.5)===f.side&&a>=f.lo&&a<f.hi);
 for(let y=front;y<back;y++){
  if(flap&&y>=back-7)continue;
  const thick=y<front+4?1:y>back-10?1:3;
  box(main,x,y,z,1,1,thick,y===front+6||y===back-10?C.silver:C.white);
 }
 // Legal 1x4x2 ramp on top of leading edge; square underside has full support.
 wedge(main,[x+1,front+4,z+1],[1,4,2],{xaxis:-1,zaxis:3,color:C.silver});
}
// Tailplane with swept leading edges.
for(let x=-54;x<54;x++)if(Math.abs(x+.5)>=4){const a=Math.abs(x+.5),front=252+Math.floor(a*.53),back=296+Math.floor(a*.13);box(main,x,front,43+Math.floor(a/30),1,back-front,2,C.white);}
for(let z=44;z<78;z++){
 const front=Math.round(248+(z-44)*1.15),back=305-Math.floor((z-44)*.16),width=z<55?4:2;
 box(main,-width/2,front,z,width,back-front,1,C.navy);
}
// Tail registration is painted into existing blocks, with no floating decals.
const glyphs={'7':['111','001','010','010','010'],'4':['101','101','111','001','001']};
for(const [digit,char]of [...'747'].entries())for(let row=0;row<5;row++)for(let col=0;col<3;col++)if(glyphs[char][row][col]==='1')
 for(let yy=0;yy<2;yy++)for(let zz=0;zz<2;zz++)for(const x of [-1,0]){
  const c=grid(main).get([x,278+digit*8+col*2+yy,70-row*2+zz].join(','));if(c)c.color=C.white;
 }
// Tail white/gold stripes painted into existing fin blocks.
for(const c of grid(main).values())if(c.z>=60&&c.y>=301&&c.y<303)c.color=C.gold;
// Upper flight-deck glazing and forward-facing windshield band.
for(const c of grid(main).values())if(c.y>=24&&c.y<32&&c.z>=48&&c.z<51&&Math.abs(c.x)>=5){c.material=ID.glass;c.color=C.glass;}
// Native usable seats face forward, local -Y welded down.
function passenger(x,y,z,color=C.seat){const s=part(main,ID.passenger,[x,y,z+2],{xaxis:1,zaxis:-2,color,controller:{}});seats.push(s);return s;}
for(let y=66;y<228;y+=7)if(!(y>=94&&y<111)&&!(y>=163&&y<175))for(const x of [-8,-4,4,8])passenger(x,y,31,y<94?C.navy:C.seat);
for(let y=43;y<84;y+=7)for(const x of [-5,5])passenger(x,y,44,C.navy);
// Seats behind nose, 2 pilots; controls on overhead panel.
const pilot=part(main,ID.seat,[-3,29,46],{xaxis:1,zaxis:-2,color:C.dark,controller:{steering:[]}});
part(main,ID.passenger,[3,29,46],{xaxis:1,zaxis:-2,color:C.dark,controller:{}});
box(main,-7,23,44,14,2,2,C.dark);
for(let x=-6;x<=6;x+=3)box(main,x,24,46,2,1,1,C.blue,ID.glass);
const labels=['Fan motors','Cabin lights','Navigation / landing lights','Passenger doors','Retract landing gear','Takeoff flaps','Cargo hatch'];
for(let i=0;i<labels.length;i++){
 const s=part(main,ID.switch,[-5.5+i*2,34.5,45.5],{xaxis:1,zaxis:-2,color:i===4?C.gold:C.dark,controller:{active:false}});
 box(main,-6+i*2,34,44,1,1,1,C.dark);b.connect(pilot,s);controls.push(s);
}
function sequence(label,links,source,seconds=3){
 const n=mechanisms.length,c=part(main,ID.controller,[-8+3*(n%6),115.5+2*Math.floor(n/6),27.5],{controller:{playMode:0,timePerFrame:seconds},color:C.dark});
 box(main,-9+3*(n%6),114+2*Math.floor(n/6),24,2,2,3,C.dark);
 c.controller.joints=links.map(({j,angle=90,reverse=true,frame=1},index)=>({id:j.id,index,reverse,startAngle:0,endAngle:angle,frames:Array.from({length:11},(_,i)=>({targetAngle:i===frame?angle:0}))}));
 b.connect(source,c);mechanisms.push({label,controller:c.controller.id,joints:links.map(r=>r.j.id)});return c;
}
function engine(p,links,source,gear){const e=part(main,ID.engine,p,{color:C.silver,controller:{gear}});const q=shapeBox(e,catalog.get(ID.engine));box(main,...[q.min[0],q.min[1],q.min[2]-1],q.max[0]-q.min[0],q.max[1]-q.min[1],1,C.dark);b.connect(source,e);for(const {j,reverse=0}of links)b.connect(e,j,{reverse});return e;}
// Lavatories and galleys, with actual toilet/sink meshes. Floor-mounted toilet -Y.
for(const y of [59,238])for(const side of [-1,1]){
 const x=side<0?-10:6;box(main,x,y,31,4,1,9,C.white);box(main,x,y+7,31,4,1,9,C.white);
 part(main,ID.toilet,[x+1.5,y+3.5,33],{xaxis:1,zaxis:-2,color:C.white});
 part(main,ID.sink,[x+2,y+6.5,32],{color:C.silver});
}
for(const y of [46,167,250])for(const x of [-10,5]){
 box(main,x,y,31,5,5,4,C.white);box(main,x,y,35,5,5,1,C.silver);
 for(let n=0;n<4;n++)box(main,x+n,y-1,32,1,1,2,n%2?C.dark:C.silver);
}
for(let y=64;y<229;y+=7)for(const side of [-1,1])box(main,side<0?-10:6,y,41,4,6,1,C.white);
// Cargo containers below cabin, service corridor down center.
for(let y=76;y<228;y+=12)if(y<177||y>207)for(const x of [-8,4]){box(main,x,y,25,4,8,3,C.silver);box(main,x,y,28,4,8,1,C.gold);}
// Four hollow nacelles, fan blades on independent bearing bodies, no propulsion devices.
const fans=[];
for(const side of [-1,1])for(const [a,fy]of [[48,143],[87,174]]){
 const cx=side*a,zc=18.5,fan=b.body();
 for(let y=fy;y<fy+25;y++)for(let x=cx-7;x<cx+7;x++)for(let z=11;z<26;z++){
  const r=Math.hypot(x+.5-cx,z+.5-zc),outer=y>fy+18?6:7;
  if(r<=outer&&r>=outer-1.6)cell(main,x,y,z,y<fy+2?C.silver:C.white);
 }
 box(main,cx-1,fy+12,24,2,16,5,C.navy); // pylon joins wing
 const a0=support(main,[cx-1,fy+7,18],[2,2,1]),hub=support(fan,[cx-1,fy+6,18],[2,1,1]);
 box(main,cx-1,fy+8,18,2,1,7,C.dark);
 // 12 stepped swept radial blades, united through a central disc.
 for(let x=cx-5;x<cx+5;x++)for(let z=14;z<23;z++){
  const dx=x+.5-(cx-.5),dz=z+.5-zc,r=Math.hypot(dx,dz),theta=Math.atan2(dz,dx);
  if(r<=3.9)cell(fan,x,fy+6,z,((theta+Math.PI)*6/Math.PI+r*.1)%1<.6?C.silver:C.dark);
 }
 const j=bearing(a0,hub,[cx-.5,fy+7,18.5],1,-2);fans.push({j});
 // Exhaust nozzle cone represented by native legal wedges / ribs.
 for(const dx of [-2,1])wedge(main,[cx+dx,fy+24,17],[1,4,3],{color:C.dark});
 box(main,cx-1,fy+24,17,2,1,8,C.dark);box(main,cx-2,fy+24,16,4,1,1,C.dark);box(main,cx-2,fy+24,17,1,1,4,C.dark);box(main,cx+1,fy+24,17,1,1,4,C.dark);
}
engine([0,121,26.5],fans,controls[0],5);
// Landing gear: four retracting 4-wheel bogies + steerable two-wheel nose gear.
const retract=[],drives=[];
function wheel(leg,x,y,z,side){
 const a=support(leg,[x,y-1,z-1],[1,3,2]),wbody=b.body(),face=side>0?x+1:x;
 const w=part(wbody,ID.wheel,[face+side,y+.5,z+.5],{xaxis:2,zaxis:side,color:C.silver});
 const j=bearing(a,w,[face,y+.5,z+.5],2,side);drives.push({j,reverse:side<0?1:0});
}
for(const [x,y]of [[-21,171],[20,171],[-8,183],[7,183]]){
 const leg=b.body(),a=support(main,[x-1,y,20]),root=support(leg,[x,y,20]);
 box(main,x-1,y,21,1,2,9,C.silver);
 box(leg,x,y,3,1,1,17,C.silver);box(leg,x,y-3,2,1,7,2,C.dark);
 const j=bearing(a,root,[x,y+.5,20.5],2,1);retract.push({j,angle:90,reverse:true});
 for(const yy of [y-3,y+3])for(const s of [-1,1])wheel(leg,x,yy,2,s);
}
const nose=b.body(),na=support(main,[-1,40,20]),nr=support(nose,[0,40,20]);
box(main,-2,39,21,2,2,9,C.silver);box(nose,0,40,7,1,1,13,C.silver);
retract.push({j:bearing(na,nr,[0,40.5,20.5],2,1),angle:90,reverse:true});
const steerBody=b.body(),ns=support(nose,[0,40,6]),st=support(steerBody,[0,40,5]);
const sj=bearing(ns,st,[.5,40.5,6],1,-3);box(steerBody,0,40,2,1,1,3,C.silver);
for(const s of [-1,1])wheel(steerBody,0,40,2,s);
pilot.controller.steering=[{id:sj.id,leftAngleLimit:25,rightAngleLimit:25,leftAngleSpeed:4.244132041931152,rightAngleSpeed:4.244132041931152,unlocked:true}];b.connect(pilot,sj,{reverse:1});
sequence('Landing gear: rearward folding bogies',retract,controls[4],5);
for(let i=0;i<drives.length;i+=6)engine([-6+i,127,26.5],drives.slice(i,i+6),pilot,3);
// Two pairs of independently hinged passenger doors, opening outward 85 degrees.
const doorLinks=[];
for(const side of [-1,1])for(const y of doorStations){
 const x=side<0?-13:12,door=b.body(),a=support(main,[x,y-1,31]),d=support(door,[x,y,31]);
 box(door,x,y,32,1,6,8,C.white);box(door,x,y+1,36,1,2,2,C.glass,ID.glass);
 // Vertical hinge needs stacked end pads so rotation clears the shell.
 // Put bearing at bottom of door, extending pillar from the connected sill.
 main.childs.pop();reserved.get(main).delete([x,y-1,31].join(',')); // replaced below
 const fixed=support(main,[x,y,30]);
 doorLinks.push({j:bearing(fixed,d,[x+.5,y+.5,31],1,3),angle:85,reverse:side<0});
 box(main,x,y-2,30,1,1,11,C.white);
}
sequence('Passenger doors',doorLinks,controls[3],3);
// Trailing-edge flaps rotate downward into clear space.
const flaps=[];
for(const f of flapRegions){
 const x0=f.side<0?-f.hi:f.lo,x1=f.side<0?-f.lo:f.hi,mid=Math.floor((x0+x1)/2),edge=wingEdge(mid),y=edge.back-7,z=edge.z,body=b.body();
 // Keep one constant hinge line; trim stationary wing for the whole span.
 for(const [key,c]of grid(main))if(c.x>=x0&&c.x<x1&&c.y>=y-1&&c.y<Math.max(y+9,wingEdge(c.x).back)&&c.z>=z-2&&c.z<z+5)grid(main).delete(key);
 box(body,x0,y,z,x1-x0,6,1,C.white);
 const a=support(main,[x0-1,y,z]),d=support(body,[x0,y,z]);box(main,x0-1,y-3,z-1,1,3,2,C.white);
 flaps.push({j:bearing(a,d,[x0,y+.5,z+.5],2,1),angle:25,reverse:false});
}
sequence('Takeoff flaps',flaps,controls[5],3);
// Cargo side hatch, separate aft service access below passenger deck.
const cargo=b.body(),cx=11,cy=212;
for(const [k,c]of grid(main))if(c.x>=10&&c.x<13&&c.y>=cy&&c.y<cy+8&&c.z>=25&&c.z<30)grid(main).delete(k);
box(cargo,cx,cy,25,1,8,5,C.navy);
const ca=support(main,[cx,cy-1,29]),cb=support(cargo,[cx,cy,29]);
const cj=bearing(ca,cb,[cx+.5,cy,29.5],1,2);
box(main,10,cy-1,24,2,1,6,C.navy);
sequence('Cargo hatch', [{j:cj,angle:85,reverse:false}],controls[6],3);
for(const [k,c]of grid(main))if(c.x>=11&&c.x<13&&c.y>=cy&&c.y<cy+8&&c.z===30)grid(main).delete(k);
// Cabinet-mounted cabin lights; native white lamps emit down into aisles.
const lightIds=[];
function lamp(p,axis,color,source){const s=part(main,ID.light,p,{xaxis:Math.abs(axis)===1?2:1,zaxis:axis,color,controller:{color,coneAngle:50,luminance:70}});const q=shapeBox(s,catalog.get(ID.light)),lo=[...q.min];const k=Math.abs(axis)-1;lo[k]=axis>0?q.min[k]-1:q.max[k];box(main,...lo,1,1,1,C.white);b.connect(source,s);lightIds.push(s.controller.id);return s;}
for(let y=64;y<230;y+=14){lamp([-.5,y+.5,42.5],-3,'FFF1D3',controls[1]);box(main,-10,y,43,20,1,1,C.white);}
for(const [p,z,col]of [[[-136.5,209.5,31.5],-1,C.red],[[136.5,209.5,31.5],1,C.green],[[.5,304.5,44.5],2,C.white],[[.5,18.5,39.5],-2,C.white]])lamp(p,z,col,controls[2]);
// Connect navigation mount pads to wings/tail and landing lamp to nose.
box(main,-137,208,30,2,3,1,C.white);box(main,135,208,30,2,3,1,C.white);box(main,0,301,43,1,4,1,C.white);box(main,0,19,35,1,1,5,C.white);
box(main,112,220,28,8,1,1,C.white);box(main,119,220,29,1,5,2,C.white);box(main,0,19,31,1,1,4,C.white);
// Panel lines, wing walk markings and registration stripes are paint, not floating decals.
for(const c of grid(main).values()){
 if(c.z>=26&&c.z<=32&&Math.abs(c.x)>18&&c.y%22===0&&c.color===C.white)c.color='CFD3D4';
 if(c.z===29&&Math.abs(c.x)>=15&&Math.abs(c.x)<18&&c.y>128&&c.y<195)c.color=C.dark;
}
// Merge identical occupied cells into cuboids (X, then Y, then Z) for large-design efficiency.
for(const [body,g]of grids){
 const cells=[...g.values()].sort((a,b)=>a.z-b.z||a.y-b.y||a.x-b.x),runs=[];
 for(const c of cells){const r=runs.at(-1);if(r&&r.material===c.material&&r.color===c.color&&r.y===c.y&&r.z===c.z&&r.x+r.w===c.x)r.w++;else runs.push({...c,w:1,d:1,h:1});}
 const byY=new Map(),rows=[];for(const r of runs){const key=[r.material,r.color,r.x,r.w,r.z].join('/'),last=byY.get(key);if(last&&last.y+last.d===r.y)last.d++;else{rows.push(r);byY.set(key,r);}}
 rows.sort((a,b)=>a.z-b.z);const byZ=new Map(),solids=[];for(const r of rows){const key=[r.material,r.color,r.x,r.w,r.y,r.d].join('/'),last=byZ.get(key);if(last&&last.z+last.h===r.z)last.h++;else{solids.push(r);byZ.set(key,r);}}
 for(const r of solids)b.part(body,r.material,[r.x,r.y,r.z],{bounds:[r.w,r.d,r.h],color:r.color});
}
const bp=b.build();enrichEngineAssets(catalog);const report=validate(bp,catalog);
fs.writeFileSync(WORK+'/'+NAME+'.candidate',JSON.stringify(bp));
fs.writeFileSync(WORK+'/'+NAME+'.validation.json',JSON.stringify(report,null,2));
const facts={name:NAME,scale:.25,targetBlocks:{length:306,span:274,height:78},reference:'https://www.boeing.com/content/dam/boeing/boeingdotcom/company/about_bca/startup/pdf/historical/747-8I_-_passenger.pdf',controls:controls.map((s,i)=>({id:s.controller.id,label:labels[i]})),pilot:pilot.controller.id,steering:sj.id,mechanisms,passengerSeats:seats.length,lights:lightIds,noThrusters:true,limits:['Ground-operable mechanical model; stock parts provide no aerodynamic lift. No powered flight without thrusters or aerodynamic mods.','Bulky native 4-block seats require four-abreast main cabin and two-abreast upper cabin; seat count is below the real aircraft.','Kinematic preview does not certify native spawning, physics, loaded engine torque, braking, gear strength or steering.','Quarter-meter shell tessellation; original native wedge dimensions never exceed 8.']};
fs.writeFileSync(WORK+'/'+NAME+'.design.json',JSON.stringify(facts,null,2));
console.log(JSON.stringify({stats:report.stats,errors:report.errors.slice(0,15),disconnected:report.attachments?.disconnected.map(g=>({body:g.body,groups:g.components.map(x=>x.length)}))}));
if(report.ok&&!report.attachments.disconnected.length)console.log(saveDraft(NAME,bp).file);





