import * as T from 'three';
import {importResourceWarnings,acknowledgeImportResources,IMPORT_ADVISORIES} from '/lib/import-resources.mjs';
export const MODEL_FORMATS=['glb','gltf','obj','stl','ply','fbx','dae','3mf','3ds'];
const extension=name=>name.split('.').pop().toLowerCase();
const normalize=name=>decodeURIComponent(name).replaceAll('\\','/').replace(/^\.\//,'').toLowerCase();
export async function readModel(files,entry,options={}){
 if(!files.length)throw Error('Choose a model and its texture files.');
 const resourceWarnings=options.warnResources===true?importResourceWarnings({bytes:files.reduce((n,f)=>n+f.size,0),files:files.length}):[];acknowledgeImportResources(resourceWarnings,options);
 const primary=files.find(f=>(f.webkitRelativePath||f.name)===entry)||(!entry&&files.find(f=>MODEL_FORMATS.includes(extension(f.name))));if(!primary)throw Error('Choose GLB, glTF, OBJ, STL, PLY, FBX, DAE, 3MF or 3DS. Export other formats to GLB or OBJ first.');
 const ext=extension(primary.name);if(!MODEL_FORMATS.includes(ext))throw Error('Unsupported model format: '+ext);
 const warnings=[...resourceWarnings],urls=[],byPath=new Map(),byBase=new Map(),prefix=(primary.webkitRelativePath||primary.name).replace(/[^/]*$/,'');
 for(const f of files){const name=normalize(f.webkitRelativePath||f.name),url=URL.createObjectURL(f);urls.push(url);byPath.set(name,url);const base=name.split('/').pop();byBase.set(base,byBase.has(base)?null:url);}
 const missing=new Set(),manager=new T.LoadingManager();let waiters=0;
 manager.setURLModifier(url=>{if(url.startsWith('data:')||urls.includes(url)||url.startsWith('blob:'))return url;const clean=normalize(url).split(/[?#]/)[0];const result=byPath.get(clean)||byPath.get(normalize(prefix)+clean)||byBase.get(clean.split('/').pop());if(result)return result;missing.add(url);throw Error('Missing local dependency: '+url+'. Include its texture/material/buffer file.');});
 const originalStart=manager.itemStart.bind(manager),originalEnd=manager.itemEnd.bind(manager);manager.itemStart=url=>{waiters++;originalStart(url);};manager.itemEnd=url=>{waiters--;originalEnd(url);};manager.onError=url=>missing.add(url);
 let root;
 try{
  const {TGALoader}=await import('three/addons/loaders/TGALoader.js');manager.addHandler(/\.tga$/i,new TGALoader(manager));
  const buffer=await primary.arrayBuffer(),text=()=>new TextDecoder().decode(buffer);
  if(ext==='obj'){
   const {OBJLoader}=await import('three/addons/loaders/OBJLoader.js'),{MTLLoader}=await import('three/addons/loaders/MTLLoader.js');const loader=new OBJLoader(manager),source=text(),references=[...source.matchAll(/^mtllib\s+(.+)$/gm)].flatMap(m=>{const exact=m[1].trim();return files.some(f=>normalize(f.name)===normalize(exact))?[exact]:exact.split(/\s+/);});
   if(references.length){const creators=[];for(const ref of references){const f=files.find(f=>normalize(f.webkitRelativePath||f.name)===normalize(prefix+ref))||files.find(f=>normalize(f.name)===normalize(ref.split('/').pop()));if(!f)throw Error('Missing MTL file: '+ref);const creator=new MTLLoader(manager).parse(await f.text(),'');creator.preload();creators.push(creator);}loader.setMaterials({create:name=>{const c=creators.find(c=>c.materialsInfo[name]);return c?c.create(name):new T.MeshStandardMaterial();}});}
   root=loader.parse(source);
  }else if(ext==='glb'||ext==='gltf'){
   const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');try{const gltf=await new GLTFLoader(manager).parseAsync(buffer,'');root=gltf.scene;if(gltf.animations.length)warnings.push('Animation clips were ignored; the default mesh pose is used.');}catch(e){throw Error('glTF import: '+e.message+' Compressed Draco/Meshopt/KTX2 assets must be exported uncompressed.');}
  }else if(ext==='stl'||ext==='ply'){
   const Loader=ext==='stl'?(await import('three/addons/loaders/STLLoader.js')).STLLoader:(await import('three/addons/loaders/PLYLoader.js')).PLYLoader;const g=new Loader(manager).parse(buffer);root=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:!!g.getAttribute('color')}));
  }else if(ext==='fbx'){const {FBXLoader}=await import('three/addons/loaders/FBXLoader.js');root=new FBXLoader(manager).parse(buffer,'');
  }else if(ext==='dae'){const {ColladaLoader}=await import('three/addons/loaders/ColladaLoader.js');root=new ColladaLoader(manager).parse(text(),'').scene;
  }else if(ext==='3mf'){const {ThreeMFLoader}=await import('three/addons/loaders/3MFLoader.js');root=new ThreeMFLoader(manager).parse(buffer);
  }else{const {TDSLoader}=await import('three/addons/loaders/TDSLoader.js');root=new TDSLoader(manager).parse(buffer,'');}
  while(waiters>0)await new Promise(r=>setTimeout(r,20));if(missing.size)throw Error('Could not load: '+[...missing].join(', '));
  root.updateMatrixWorld(true);const triangles=[],textures=[],textureIds=new Map();let rigged=false,instanced=false;
  function textureData(map){if(!map)return undefined;if(textureIds.has(map))return textureIds.get(map);const image=map.image;if(!image?.width||!image?.height){warnings.push('An unreadable texture was replaced by its material color.');return undefined;}const w=image.width,h=image.height;if(options.warnResources===true&&w*h>IMPORT_ADVISORIES.texturePixels)warnings.push('Large texture: '+w+' × '+h+' pixels; full-resolution sampling uses more memory.');const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(image.data){const source=document.createElement('canvas');source.width=image.width;source.height=image.height;source.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(image.data),image.width,image.height),0,0);ctx.drawImage(source,0,0,w,h);}else ctx.drawImage(image,0,0,w,h);map.updateMatrix();const id=textures.length;textureIds.set(map,id);textures.push({width:w,height:h,pixels:ctx.getImageData(0,0,w,h).data,matrix:map.matrix.toArray(),flipY:map.flipY,wrapS:map.wrapS,wrapT:map.wrapT});return id;}
  root.traverseVisible(mesh=>{if(!mesh.isMesh)return;rigged||=!!mesh.isSkinnedMesh;instanced||=!!mesh.isInstancedMesh;const g=mesh.geometry,pos=g.getAttribute('position');if(!pos)return;const index=g.index,uv=g.getAttribute('uv'),colors=g.getAttribute('color'),count=index?.count??pos.count,groups=g.groups.length?g.groups:[{start:0,count,materialIndex:0}],instances=mesh.isInstancedMesh?mesh.count:1;
   for(let instance=0;instance<instances;instance++){const world=mesh.matrixWorld.clone();if(mesh.isInstancedMesh){const matrix=new T.Matrix4();mesh.getMatrixAt(instance,matrix);world.multiply(matrix);}for(const group of groups){const material=Array.isArray(mesh.material)?mesh.material[group.materialIndex]:mesh.material;if(material?.visible===false||material?.opacity===0)continue;const color=material?.color?.getRGB(new T.Color(),T.SRGBColorSpace),texture=textureData(material?.map);
    for(let i=group.start;i<Math.min(count,group.start+group.count);i+=3){if(i+2>=count)break;const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k),points=ids.map(j=>mesh.getVertexPosition(j,new T.Vector3()).applyMatrix4(world).toArray());const tri={positions:points.flat(),color:color?[color.r,color.g,color.b]:[1,1,1]};if(colors&&material?.vertexColors)tri.colors=ids.flatMap(j=>{const c=new T.Color().fromBufferAttribute(colors,j).convertLinearToSRGB();return [c.r,c.g,c.b];});if(uv&&texture!==undefined){tri.uv=ids.flatMap(j=>[uv.getX(j),uv.getY(j)]);tri.texture=texture;}triangles.push(tri);}
   }}
  });
  if(rigged)warnings.push('Skinned meshes use their default pose; bones are not imported.');if(instanced)warnings.push('Instanced objects were expanded using their transforms.');if(!triangles.length)throw Error('No visible triangle meshes found.');
  return {root,model:{triangles,textures,warnings},name:primary.name.replace(/\.[^.]+$/,''),format:ext};
 }finally{for(const url of urls)URL.revokeObjectURL(url);}
}
