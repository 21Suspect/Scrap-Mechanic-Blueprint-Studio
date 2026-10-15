import {BlueprintBuilder} from '../../lib/builder.mjs';

// Original game assets, four independently mounted wheels, no artificial drive
// force. Used by Node and browser regressions without saving a user's draft.
export function driveCar(engineId='3091926a-9340-46d9-83d6-4fd7c68ad950',gear=5){
 const b=new BlueprintBuilder(),body=b.body();
 const chassis=b.part(body,'8aedf6c2-94e1-4506-89d4-a0227c552f1e',[0,0,2],{bounds:{x:5,y:12,z:1}});
 const engine=b.part(body,engineId,[1,5,3],{controller:{gear}});
 for(const y of [2.5,9.5])for(const side of [-1,1]){
  const wheel=b.centered(b.body(),'69e362c3-32aa-4cd1-adc0-dcfc47b92c0d',[side<0?-.5:5.5,y,2.5],{xaxis:3,zaxis:side});
  const joint=b.joint(chassis,wheel,'4a1b886b-913e-4aad-b5b6-6e41b0db23a6',[side<0?-1:5,y-.5,2],{xaxis:3,zaxis:side});
  b.connect(engine,joint,{reverse:side<0?1:0});
 }
 return {blueprint:b.build(),engineId:engine.controller.id};
}
