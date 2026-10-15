import {BlueprintBuilder} from '../lib/builder.mjs';
import {catalog} from '../lib/assets.mjs';
// A generated kinetic display: eight independently rotating arms and one engine.
// Geometry is generated from scratch; no existing blueprint is modified.
const builder=new BlueprintBuilder(),base=builder.body();
const metal='8aedf6c2-94e1-4506-89d4-a0227c552f1e',bearing='4a1b886b-913e-4aad-b5b6-6e41b0db23a6';
const floor=builder.part(base,metal,[0,0,0],{bounds:[21,9,1],color:'222A35'});
for(const y of [0,8])builder.part(base,metal,[0,y,1],{bounds:[21,1,1],color:'DF7F01'});
const engine=builder.part(base,'d5e36413-b3c1-4636-8447-3410c352ec7b',[1,3,1],{controller:{active:true,gear:2},color:'DF7F01'});
for(let i=0;i<8;i++){
 const x=5+i*2,body=builder.body(),arm=builder.part(body,metal,[x,4,1],{bounds:[1,1,2+i%4],color:['DF7F01','2CB8C7','EEEEEE','C53A49'][i%4]});
 const j=builder.joint(floor,arm,bearing,[x,4,1]);builder.connect(engine,j,{reverse:i%2});
}
console.log(JSON.stringify(builder.save('Kinetic Array'),null,2));
