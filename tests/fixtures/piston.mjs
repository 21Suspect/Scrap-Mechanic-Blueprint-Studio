export function pistonFixture(sequence=true){
 const cube=(x,y,z)=>({shapeId:'8aedf6c2-94e1-4506-89d4-a0227c552f1e',pos:{x,y,z},bounds:{x:1,y:1,z:1},xaxis:1,zaxis:3,color:'8A9299'});
 const base={...cube(0,0,0),joints:[{id:1}]},platform={...cube(0,0,2),joints:[{id:1}]};
 const button={shapeId:'7cf717d7-d167-4f2d-a6e7-6b2c70aa3986',pos:{x:3,y:0,z:0},xaxis:1,zaxis:3,color:'D3B931',controller:{id:20,active:false,controllers:[{id:sequence?21:30}],joints:[]}};
 const controller={shapeId:'a092359d-5cea-484d-a274-470d9a567632',pos:{x:5,y:0,z:0},xaxis:1,zaxis:3,color:'DF7F01',controller:{id:21,playMode:0,timePerFrame:1,joints:[],controllers:[{id:30,index:0,frames:Array.from({length:11},(_,i)=>({setting:i===0?0:3}))}]}};
 return {version:4,bodies:[{childs:[base,button,...(sequence?[controller]:[])]},{childs:[platform]}],joints:[{id:1,shapeId:'260b4597-f1ac-409c-8e6b-90c998c5fe94',color:'DF7F01',childA:0,childB:sequence?3:2,posA:{x:0,y:0,z:1},posB:{x:0,y:0,z:2},xaxisA:1,zaxisA:3,xaxisB:1,zaxisB:3,controller:{id:30,controllers:null,joints:null,length:3,speed:3}}]};
}
