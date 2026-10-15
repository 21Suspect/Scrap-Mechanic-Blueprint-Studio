import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {draftPath,listDrafts} from '../lib/assets.mjs';

const name='New Draft QA '+Date.now(),second=name+' next',initial=new Set(listDrafts());
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:38799/');await page.waitForFunction(()=>window.studio?.ready,{},{timeout:120000});
 const original=await page.evaluate(()=>studio.blueprint());
 await page.click('#newDraft');await page.click('#cancelNewDraft');assert.deepEqual(await page.evaluate(()=>studio.blueprint()),original);
 await page.click('#newDraft');await page.fill('#newDraftName',name);await page.screenshot({path:'captures/new-draft-dialog.png'});await page.click('#createNewDraft');
 await page.waitForFunction(name=>document.querySelector('#title').textContent===name&&studio.ready&&document.querySelector('#newDraftDialog').open===false,name);
 assert.deepEqual(await page.evaluate(()=>studio.blueprint()),{version:4,bodies:[{childs:[]}],joints:[]});
 assert.equal(await page.locator('#partsPane').isVisible(),true);assert.ok(page.url().includes('draft='));assert.ok(fs.existsSync(draftPath(name)));
 await page.screenshot({path:'captures/new-draft-empty.png'});
 await page.click('#addPart');await page.fill('#itemSearch','Plastic Block');await page.click('.item-tile[data-uuid="628b2d61-5ceb-43e9-8334-a4135566df7a"]');await page.locator('#itemInfo').getByRole('button',{name:'Place',exact:true}).click();
 await page.locator('#placementBar').getByText('XYZ',{exact:true}).click();await page.locator('#placementBar').getByRole('button',{name:'Place at XYZ'}).click();
 await page.waitForFunction(()=>studio.ready&&!studio.editing&&studio.blueprint().bodies[0].childs.length===1);await page.locator('#placementBar').getByRole('button',{name:'Done',exact:true}).click();
 await page.click('#save');await page.click('#saveDraft');await page.waitForFunction(()=>!document.querySelector('#saveDialog').open);
 const saved=fs.readFileSync(draftPath(name),'utf8');assert.equal(JSON.parse(saved).bodies[0].childs.length,1);
 await page.reload();await page.waitForFunction(()=>studio.ready,{},{timeout:120000});assert.equal(await page.evaluate(()=>studio.blueprint().bodies[0].childs.length),1);
 await page.click('#newDraft');await page.fill('#newDraftName',name);await page.click('#createNewDraft');await page.waitForFunction(()=>document.querySelector('#newDraftStatus').textContent.includes('already exists'));
 assert.equal(fs.readFileSync(draftPath(name),'utf8'),saved);await page.click('#cancelNewDraft');
 const duplicate=await fetch('http://127.0.0.1:38799/api/create-draft',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name})});assert.equal(duplicate.status,400);assert.equal(fs.readFileSync(draftPath(name),'utf8'),saved);
 await page.evaluate(async()=>{studio.editor.select([0]);await studio.editor.transform({translation:[1,0,0]});});
 await page.click('#newDraft');await page.fill('#newDraftName',second);await page.click('#createNewDraft');await page.waitForFunction(name=>studio.ready&&document.querySelector('#title').textContent===name&&!document.querySelector('#newDraftDialog').open,second);
 assert.equal(fs.readFileSync(draftPath(name),'utf8'),saved);
 const backups=listDrafts().filter(n=>n.startsWith(name+' edit '));assert.equal(backups.length,1);assert.equal(JSON.parse(fs.readFileSync(draftPath(backups[0]),'utf8')).bodies[0].childs[0].pos.x,1);
 await page.click('#openLibrary');await page.fill('#search',second);assert.equal(await page.locator('#drafts .tile-name').textContent(),second);await page.click('#closeLibrary');
 assert.deepEqual(errors,[]);console.log('Create/cancel, blank editor, first-block placement, save/reopen, duplicate protection, gallery and unsaved-edit preservation passed.');
}finally{
 await browser.close();for(const n of listDrafts())if(!initial.has(n)&&n.startsWith(name)){const file=draftPath(n);for(const f of [file,file.slice(0,-5)+'.png'])if(fs.existsSync(f))fs.unlinkSync(f);}
}
