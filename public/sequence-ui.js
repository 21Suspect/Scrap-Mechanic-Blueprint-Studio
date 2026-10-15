import {partSettingDescriptors,applyPartSetting} from '/lib/part-settings.mjs';
import {isSequence} from '/lib/sequences.mjs';
// Shared columns match native frames. Empty bearing steps hold position;
// piston settings are absolute lengths, so repeated lengths hold position.
export function sequenceEditor({selected,blueprint,catalog,commit,element,button,field}){
 if(!selected.length||!isSequence(selected[0].def))return null;
 const dialog=element('dialog',undefined,'sequence-dialog');
 const title=element('div',undefined,'panel-title');title.append(element('span',selected.length>1?'Controller sequences · '+selected.length:'Controller sequence'),button('×',()=>dialog.close()));dialog.append(title);
 const settings=partSettingDescriptors(selected.map(e=>e.shape),catalog,blueprint);
 const edits=new Map();
 const header=element('div',undefined,'sequence-settings');
 for(const key of ['timePerFrame','playMode']){const d=settings.find(s=>s.key===key);if(d)field(header,d.label,d.value,v=>{edits.set(key,v);if(key==='timePerFrame')updateTimes(v);},d);}
 dialog.append(header);
 const scroll=element('div',undefined,'sequence-scroll'),table=element('table',undefined,'sequence-table'),head=element('tr');head.append(element('th','Part'),element('th','Reverse'));
 const seconds=[];for(let n=0;n<11;n++){const th=element('th'),time=element('small');th.append(element('span',String(n)),time);seconds.push(time);head.append(th);}table.append(head);
 function updateTimes(value){seconds.forEach((e,n)=>e.textContent=Number((n*value).toFixed(3))+' s');}
 updateTimes(settings.find(d=>d.key==='timePerFrame')?.value??1);
 const rows=new Map();
 for(const d of settings){if(!/^(frame|pistonframe):/.test(d.key))continue;const [kind,index,step]=d.key.split(':'),key=kind+':'+index;if(!rows.has(key))rows.set(key,{kind,index,frames:[]});rows.get(key).frames[Number(step)]=d;}
 for(const row of [...rows.values()].sort((a,b)=>Number(a.index)-Number(b.index))){const tr=element('tr'),source=selected[0].shape.controller,link=(row.kind==='frame'?source.joints:source.controllers).find((l,i)=>(l.index??i)===Number(row.index));
  tr.append(element('th',(row.kind==='frame'?'Bearing ':'Piston ')+(selected.length===1?link.id:Number(row.index)+1)));
  const reverse=element('td'),d=settings.find(s=>s.key==='reverse:'+row.index);if(d&&row.kind==='frame')field(reverse,'Reverse row '+(Number(row.index)+1),d.value,v=>edits.set(d.key,v),d);else reverse.textContent='—';tr.append(reverse);
  for(let n=0;n<11;n++){const td=element('td'),d=row.frames[n];if(d)field(td,(row.kind==='frame'?'Bearing':'Piston')+' row '+(Number(row.index)+1)+' step '+n,d.value,v=>edits.set(d.key,v),d);else td.textContent='—';tr.append(td);}table.append(tr);
 }
 scroll.append(table);dialog.append(scroll,element('small','Same column = together · Later column = later · Bearings: added degrees · Pistons: absolute blocks'));
 const actions=element('div',undefined,'edit-actions');actions.append(button('Cancel',()=>dialog.close()),button('Apply',async()=>{let next=blueprint;for(const [key,value]of edits)next=applyPartSetting(next,selected.map(e=>e.index),key,value,catalog);if(edits.size)await commit(next);dialog.close();}));dialog.append(actions);
 dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();return dialog;
}
