import fs from 'node:fs';
import path from 'node:path';
export function loadIcons(game){const icons=new Map();
 for(const [folder,prefix,file]of [['Data','$GAME_DATA','IconMap'],['Survival','$SURVIVAL_DATA','IconMapSurvival'],['ChallengeData','$CHALLENGE_DATA','IconMapChallenge']]){
 const xml=path.join(game,folder,'Gui',file+'.xml');if(!fs.existsSync(xml))continue;
 for(const group of fs.readFileSync(xml,'utf8').matchAll(/<Group\b[^>]*texture="([^"]+)"[^>]*size="(\d+) (\d+)"[^>]*>([\s\S]*?)<\/Group>/g)){
 const png=path.join(game,folder,'Gui',group[1]);if(!fs.existsSync(png))continue;const bytes=fs.readFileSync(png),width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
 for(const match of group[4].matchAll(/<Index name="([\da-f-]{36})">\s*<Frame point="(\d+) (\d+)"/g))icons.set(match[1],{ref:prefix+'/Gui/'+group[1],x:Number(match[2]),y:Number(match[3]),w:Number(group[2]),h:Number(group[3]),width,height});
 }
 }
 return icons;
}
