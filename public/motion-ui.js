export function createMotionInspection(ctx){
 const button=document.getElementById('checkMotion'),result=document.getElementById('motionResult');let report=null,generation=0;
 const element=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 function clear(){generation++;report=null;result.replaceChildren();result.hidden=true;button.disabled=false;button.textContent='Check motion';}
 async function check(options={}){
  const token=++generation;button.disabled=true;button.textContent='Checking…';
  try{
   const next=await ctx.post('/api/check-motion',{blueprint:ctx.blueprint(),options});if(token!==generation)return next;report=next;
   result.replaceChildren();result.hidden=false;
   const status=element('p',next.collisionCount?next.collisionCount+' intersections':next.baseline.length?'No new intersections · '+next.baseline.length+' rest contacts':'No intersections detected');
   status.className=next.collisionCount?'fail':'pass';status.title=next.limitations.join('\n');result.append(status);
   const detail=element('small',(next.complete?'Sampled':'Incomplete')+' · '+next.cases.length+' motion tests · approximate');result.append(detail);
   for(const scenario of next.cases){if(!scenario.collisions.length&&!scenario.truncated&&!scenario.unsupported)continue;const group=element('details');group.append(element('summary',scenario.label+' · '+scenario.collisions.length+(scenario.truncated?' · incomplete':'')+(scenario.unsupported?' · unsupported motion':'')));
    for(const hit of scenario.collisions){const b=element('button',hit.titleA+' ↔ '+hit.titleB+' · '+hit.phase+' '+hit.time.toFixed(2)+' s');b.className='motion-hit';b.onclick=()=>ctx.inspect(scenario,hit);b.title='Inspect this collision pose';group.append(b);}result.append(group);
   }
   const download=element('button','Download motion report');download.className='motion-download';download.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=element('a');a.href=url;a.download='motion-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};result.append(download);
   return next;
  }finally{if(token===generation){button.disabled=false;button.textContent='Check motion';}}
 }
 button.onclick=()=>check().catch(e=>ctx.toast(e.message));
 return {check,clear,report:()=>report};
}
