import * as T from 'three';
// Rendered solid bounds, excluding glow/beam overlays, for asset and motion QA.
export function partVisualBounds(root,index){
 root.updateMatrixWorld(true);const box=new T.Box3(),matrix=new T.Matrix4(),vertex=new T.Vector3();
 root.traverse(o=>{if(!o.isInstancedMesh)return;const slot=o.userData.entries?.findIndex(e=>e.index===index);if(slot===undefined||slot<0)return;o.getMatrixAt(slot,matrix);matrix.premultiply(o.matrixWorld);const g=o.geometry,materials=Array.isArray(o.material)?o.material:[o.material],groups=g.groups.length?g.groups:[{start:0,count:g.index?.count??g.attributes.position.count,materialIndex:0}];
  for(const group of groups){if(materials[group.materialIndex]?.userData.lightGlow)continue;for(let i=group.start;i<group.start+group.count;i++){const v=g.index?g.index.getX(i):i;box.expandByPoint(vertex.fromBufferAttribute(g.attributes.position,v).applyMatrix4(matrix));}}
 });
 return box.isEmpty()?null:{min:box.min.toArray(),max:box.max.toArray(),center:box.getCenter(new T.Vector3()).toArray(),size:box.getSize(new T.Vector3()).toArray()};
}
