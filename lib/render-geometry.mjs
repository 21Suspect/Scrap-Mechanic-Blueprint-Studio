import {Box3,BoxGeometry,Vector3,BufferGeometry,Float32BufferAttribute} from 'three';

// Native resizable triangular prism: bottom -Z, back -Y, slope descends +Y.
// Geometry is procedural in the game; surfaces use its installed block textures.
export function wedgeGeometry([w,d,h]){
 const p=[],uv=[];
 const tri=(a,b,c)=>{const n=new Vector3(...c).sub(new Vector3(...a)).cross(new Vector3(...b).sub(new Vector3(...a)));const normal=n.toArray().map(Math.abs),drop=normal.indexOf(Math.max(...normal)),axes=[0,1,2].filter(k=>k!==drop);for(const v of [a,c,b]){p.push(...v);uv.push(v[axes[0]]*.25,v[axes[1]]*.25);}};
 const A=[0,0,0],B=[w,0,0],C=[0,d,0],D=[w,d,0],E=[0,0,h],F=[w,0,h];
 tri(A,C,E);tri(B,F,D);tri(A,B,D);tri(A,D,C);tri(A,E,F);tri(A,F,B);tri(E,C,D);tri(E,D,F);
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.computeVertexNormals();g.translate(-w/2,-d/2,-h/2);return g;
}

// Native block atlases repeat four times per UV unit. One quarter UV per block face.
export function blockGeometry(dims,hiddenFaces=[]){
 const g=new BoxGeometry(...dims),uv=g.attributes.uv;
 const axes=[[2,1],[2,1],[0,2],[0,2],[0,1],[0,1]];
 for(let f=0;f<6;f++)for(let i=0;i<4;i++){
  const k=f*4+i;uv.setXY(k,uv.getX(k)*dims[axes[f][0]]*.25,uv.getY(k)*dims[axes[f][1]]*.25);
 }
 if(hiddenFaces.length){const source=Array.from(g.index.array),indices=[];for(let f=0;f<6;f++)if(!hiddenFaces.includes(f))indices.push(...source.slice(f*6,f*6+6));g.setIndex(indices);g.clearGroups();g.addGroup(0,indices.length,0);}
 return g;
}

// Correct only clear decimal unit mismatches on ALL dimensions. Never stretch
// thin pipes, switches or other models to fill their collision boxes.
export function correctAssetScale(group,expected){
 group.updateMatrixWorld(true);
 // FBX GlobalSettings explicitly carries the export unit. Three's loader keeps
 // it in userData without applying it. Spotlight's mesh is thinner than its
 // hull, so a three-axis box comparison cannot detect its 10× unit mismatch.
 const unit=Number(group.userData.unitScaleFactor);
 if(Number.isFinite(unit)&&unit>0&&unit!==1){group.scale.multiplyScalar(unit);group.updateMatrixWorld(true);return unit;}
 const bounds=new Box3();
 // Rest-pose geometry is what the viewer renders. Avoid asking a Collada
 // SkinnedMesh to evaluate a skeleton which is not animated in this viewer.
 group.traverse(o=>{if(o.isMesh&&o.geometry){o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});
 const size=bounds.getSize(new Vector3()).toArray();
 const factor=[10,100,1000].find(f=>size.every((v,i)=>expected[i]>0&&Math.abs(v*f/expected[i]-1)<.035))||1;
 if(factor!==1){group.scale.multiplyScalar(factor);group.updateMatrixWorld(true);}
 return factor;
}

export function nativeUVs(geometry){
 // Opt-in for a verified top-left-origin mesh (license plate). FBX exports and
 // other existing assets keep their original UVs; they must not be flipped.
 for(const key of ['uv','uv1','uv2']){const uv=geometry.attributes[key];if(!uv)continue;for(let i=0;i<uv.count;i++)uv.setY(i,1-uv.getY(i));uv.needsUpdate=true;}
 return geometry;
}
export function assetUVs(geometry,def){
 const mesh=def.render?.lodList?.[0]?.mesh||'';
 if(def.uuid==='a7fb4293-f623-4a0f-9465-8bc640f0038b'||/\.mesh$/i.test(mesh)&&/^obj_fittings_pipe/.test(def.name||''))nativeUVs(geometry);
 return geometry;
}

// The stock button's pressed FBX has an authoring translation of +1.055 X.
// Register its lateral axes to the rest mesh, keeping the real local-Y press.
// This is deliberately limited to buttons; never recenter every pose/asset.
export function alignButtonPose(geometry,restGeometry,def){
 if(!def?.button||!restGeometry)return geometry;
 geometry.computeBoundingBox();restGeometry.computeBoundingBox();
 const current=geometry.boundingBox.getCenter(new Vector3()),rest=restGeometry.boundingBox.getCenter(new Vector3());
 geometry.translate(rest.x-current.x,0,rest.z-current.z);
 return geometry;
}

// Verified FBX authoring-node offsets; retain the actual vertex animation
// (including the radio's extending antenna) and original UVs.
const originAlignedPoses=new Set(['695d66c8-b937-472d-8bc2-f3d72dd92879','dfefc9d7-db03-4d25-ad85-eae1d824d8c0']);
export const needsNativePoseAlignment=def=>!!def?.button||originAlignedPoses.has(def?.uuid);
export function alignNativePose(geometry,restGeometry,def,origin=[0,0,0],restOrigin=[0,0,0]){
 if(originAlignedPoses.has(def.uuid))geometry.translate(...origin.map((v,i)=>restOrigin[i]-v));
 else alignButtonPose(geometry,restGeometry,def);
 return geometry;
}

