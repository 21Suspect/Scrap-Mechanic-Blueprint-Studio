// Mode order and rules from Data/Gui/Language/English/InterfaceTags.txt.
export const LOGIC_MODES=['AND','OR','XOR','NAND','NOR','XNOR'];
export function logicOutput(mode,inputs){
 const active=inputs.filter(Boolean).length,all=inputs.length>0&&active===inputs.length;
 return [all,active>0,active===1,!all,active===0,active%2===0][mode]??false;
}
