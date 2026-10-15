export const isSequence=d=>!!(d?.sequence||d?.survivalSequence);
export const SEQUENCE_MODES=[[0,'Once / return'],[2,'Loop']];
export function sequencePhase(progress,end,playMode){
 // Observed native saves use 0 (once) and 2 (Loop). Loop is not ping-pong.
 return playMode===2?{step:progress%end,cycles:Math.floor(progress/end)}:{step:Math.min(progress,end),cycles:0};
}
export function bearingFrameAngle(link,phase){
 let sum=0;const frames=link.frames?.length?link.frames.map(f=>sum+=Number(f.targetAngle??0)):[Number(link.startAngle||0),Number(link.endAngle||0)];
 const t=Math.min(phase.step,frames.length-1),i=Math.floor(t),angle=frames[i]+(frames[Math.min(i+1,frames.length-1)]-frames[i])*(t-i);
 return angle+phase.cycles*(frames.at(-1)-frames[0]);
}
export function pistonFrameLength(link,phase){
 const frames=link.frames.map(f=>Number(f.setting??0)),t=Math.min(phase.step,frames.length-1),i=Math.floor(t);
 return frames[i]+(frames[Math.min(i+1,frames.length-1)]-frames[i])*(t-i);
}
export function synchronizeBearingEndpoints(link){
 if(!link.frames?.length)return;
 link.startAngle=Number(link.frames[0].targetAngle??0);
 link.endAngle=link.frames.reduce((n,f)=>n+Number(f.targetAngle??0),0);
}
