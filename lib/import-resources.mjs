// Advisory thresholds for the human import dialog. AI/headless imports do not use these.
export const IMPORT_ADVISORIES={bytes:64*1024*1024,files:256,triangles:200000,cells:8000000,longestSide:512,candidates:20000000,occupied:300000,records:30000,texturePixels:1024*1024};
export function importResourceWarnings(values){
 const messages=[],number=n=>n.toLocaleString('en-US');
 if(values.bytes>IMPORT_ADVISORIES.bytes)messages.push('Large model bundle: '+(values.bytes/1024/1024).toFixed(1)+' MiB.');
 if(values.files>IMPORT_ADVISORIES.files)messages.push('Many model files: '+number(values.files)+'.');
 if(values.triangles>IMPORT_ADVISORIES.triangles)messages.push('Detailed mesh: '+number(values.triangles)+' triangles.');
 if(values.cells>IMPORT_ADVISORIES.cells)messages.push('Large grid: '+number(values.cells)+' cells.');
 if(values.longestSide>IMPORT_ADVISORIES.longestSide)messages.push('High resolution: '+number(values.longestSide)+' blocks on the longest side.');
 return messages.length?[messages.join(' ')+' Import may use significant memory and take longer.']:[];
}
export function acknowledgeImportResources(warnings,options){
 if(options.warnResources===true&&!options.acknowledgeResources&&warnings.length)throw Object.assign(Error(warnings.join(' ')),{code:'IMPORT_RESOURCE_WARNING',warning:warnings.join(' ')});
}
