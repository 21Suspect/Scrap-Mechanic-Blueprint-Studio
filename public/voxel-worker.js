import {voxelize} from '/lib/voxelize.mjs';
self.onmessage=({data})=>{try{const result=voxelize(data.model,data.options,progress=>self.postMessage({progress}));self.postMessage({result});}catch(e){self.postMessage({error:e.message,code:e.code,warning:e.warning});}};
