import {launchBrowser} from './lib/browser.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT,WORK,listBlueprints,listDrafts} from './lib/assets.mjs';
export async function capture({draft,id,output,connections=false}={}){
 if(!draft&&!id){draft=listDrafts()[0];if(!draft)id=listBlueprints()[0]?.id;if(!draft&&!id)throw Error('No creations found. Create a draft first, or specify --draft / --id.');}
 output??=path.join(WORK,'captures',draft||id);
 fs.mkdirSync(output,{recursive:true});
 const browser=await launchBrowser({args:['--enable-webgl','--ignore-gpu-blocklist']});
 try{const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))errors.push(m.text());});
 await page.goto('http://127.0.0.1:'+(process.env.PORT||38799)+'/?'+(draft?'draft='+encodeURIComponent(draft):'id='+id));await page.waitForFunction(()=>window.studio?.ready||window.studio?.error,{},{timeout:120000});
 const error=await page.evaluate(()=>window.studio.error);if(error)throw Error(error);await page.evaluate(c=>window.studio.connections(c),connections);
 const files=[];for(const view of ['iso','front','back','left','right','top','bottom']){await page.evaluate(v=>window.studio.setView(v),view);await page.screenshot({path:path.join(output,view+'.png')});files.push(path.join(output,view+'.png'));}
 const sheet=await page.evaluate(()=>window.studio.contactSheet());fs.writeFileSync(path.join(output,'sheet.png'),Buffer.from(sheet.split(',')[1],'base64'));
 const result={output,files,sheet:path.join(output,'sheet.png'),report:await page.evaluate(()=>window.studio.report()),render:await page.evaluate(()=>window.studio.sceneInfo()),browserErrors:errors};fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(result,null,2));return result;
 }finally{await browser.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.join(ROOT,'capture.mjs')){const args=process.argv.slice(2);const result=await capture({draft:args.includes('--draft')?args[args.indexOf('--draft')+1]:undefined,id:args.includes('--id')?args[args.indexOf('--id')+1]:undefined,connections:args.includes('--connections')});console.log(JSON.stringify(result,null,2));}
