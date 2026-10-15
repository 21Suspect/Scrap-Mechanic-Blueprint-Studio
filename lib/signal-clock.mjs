import {logicOutput} from './logic.mjs';

// Fixed-update cadence used by the installed scripts. Native C++ gate scheduling
// is not exposed: one synchronous gate stage per tick is an explicit model.
export class SignalClock{
 constructor(preview){this.p=preview;this.tick=0;this.histories=new Map();}
 inputs(){this.p.sensors.update();for(const [id,s]of this.p.parts){const d=this.p.def(s.shapeId)||{};if(this.p.inputs.has(id))this.p.states.set(id,this.p.inputs.get(id));else if(d.sensor||d.survivalSensor)this.p.states.set(id,this.p.sensors.readings.get(id)?.active??false);else if(d.lever||d.button)this.p.states.set(id,!!s.controller.active);}}
 advance(){
  this.inputs();const p=this.p,previous=new Map(p.states),next=new Map(previous);this.tick++;
  for(const [id,s]of p.parts){
   if(p.inputs.has(id))continue;
   const d=p.def(s.shapeId)||{},c=s.controller,parents=p.parents.get(id)||[],values=parents.map(id=>!!previous.get(id)),any=values.some(Boolean);
   if(d.logic){next.set(id,logicOutput(c.mode??0,values));if(!parents.length)p.warnings.add('Unconnected gate behavior requires a native reference trace.');}
   else if(d.timer){
    const delay=Math.max(0,Math.round((c.seconds||0)*40+(c.ticks||0))),history=this.histories.get(id)||[];
    if(!history.length||history.at(-1).value!==any)history.push({tick:this.tick,value:any});
    while(history.length>1&&history[1].tick<=this.tick-delay)history.shift();
    next.set(id,history[0]?.tick<=this.tick-delay?history[0].value:false);this.histories.set(id,history);
   }
  }
  // Outputs consume the updated gates once, without iterating feedback to a
  // fictitious steady state. This makes oscillator behavior order-independent.
  for(const [id,s]of p.parts){const d=p.def(s.shapeId)||{};if(p.inputs.has(id)||d.logic||d.timer||d.lever||d.button||d.sensor||d.survivalSensor)continue;const parents=p.parents.get(id)||[];next.set(id,parents.length?parents.some(id=>!!next.get(id)):d.spotlight||d.pointlight?true:!!s.controller.active);}
  p.states=next;
 }
}
