export const isThruster=def=>!!(def?.thruster||def?.survivalThruster);

// Native thrusters serialize a zero-based force setting, distinct from the
// survival item's upgrade tier. The creative force table has seven settings;
// survival saves use the same 0–6 field, but their force is engine-managed.
export function thrusterSetting(shape,def){
 if(!isThruster(def))return {supported:false,reason:'Choose a thruster'};
 const levels=def.thruster?.levels,maxLevel=(levels?.length||7)-1;
 const level=shape.controller?.level??0;
 if(!Number.isInteger(level)||level<0||level>maxLevel)return {supported:false,reason:'Thruster level must be 0–'+maxLevel,minLevel:0,maxLevel};
 return {supported:true,level,minLevel:0,maxLevel,displayLevel:level+1,averageForce:levels?.[level]?.averageForce??null,forceVariation:levels?.[level]?.forceVariation??null,source:levels?'native shape force table':'native survival level field; force is engine-managed'};
}

export function setThrusterLevel(controller,def,level){
 const setting=thrusterSetting({controller:{level}},def);
 if(!setting.supported)throw Error(setting.reason);
 controller.level=level;
 return level;
}
