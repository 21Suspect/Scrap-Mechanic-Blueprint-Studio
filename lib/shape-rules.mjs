// Native drag-sized wedges have an 8-block limit on each local dimension.
// Kept separately from render bounds: an oversized imported shape is still drawn
// for diagnosis, but cannot be resized, placed, generated or saved as valid.
export const WEDGE_MAX=8;
export function checkBounds(def,bounds){
 if(!bounds)return;
 const values=['x','y','z'].map(k=>bounds[k]);
 if(values.some(n=>!Number.isSafeInteger(n)||n<1))throw Error('Size must use positive whole blocks.');
 if(def?.kind==='wedge'&&values.some(n=>n>WEDGE_MAX))throw Error(`Wedges are limited to ${WEDGE_MAX} × ${WEDGE_MAX} × ${WEDGE_MAX} blocks.`);
}
