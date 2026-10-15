import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {ROOT} from '../lib/assets.mjs';
import path from 'node:path';
test('MCP stdio handshake, tools, live shape catalog and rotation sets',async()=>{
 const client=new Client({name:'studio-test',version:'1'}),transport=new StdioClientTransport({command:process.execPath,args:[path.join(ROOT,'mcp.mjs')],stderr:'pipe'});
 try{await client.connect(transport);const list=await client.listTools();for(const name of ['inspect_creation','calculate_center_of_mass','preview_controller_motion','get_part_template','check_motion_collisions'])assert.ok(list.tools.some(t=>t.name===name));const shapes=await client.callTool({name:'search_shapes',arguments:{query:'bearing',limit:5}});assert.ok(JSON.parse(shapes.content[0].text).some(s=>s.uuid==='4a1b886b-913e-4aad-b5b6-6e41b0db23a6'));const rotations=await client.callTool({name:'get_rotation_sets',arguments:{}});assert.ok(JSON.parse(rotations.content[0].text).rotationSet.length>0);}finally{await client.close();}
});
