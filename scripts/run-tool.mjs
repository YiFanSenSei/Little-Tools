import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const tools=JSON.parse(await readFile(path.join(root,'tools.json'),'utf8'));
const [id,command,...args]=process.argv.slice(2);
if(!id){for(const tool of tools)console.log(`${tool.id} — ${tool.name} (${tool.path}, port ${tool.defaultPort})`);}
else {
  const tool=tools.find(t=>t.id===id);
  if(!tool||!tool.commands.includes(command)){console.error('Unknown tool or command. Run npm run list, then npm run tool -- <id> <command>.');process.exitCode=1;}
  else {
    const cwd=path.resolve(root,tool.path);
    if(!cwd.startsWith(path.join(root,'tools')+path.sep))throw new Error('Tool must live inside tools/');
    const npm=process.env.npm_execpath;
    if(!npm)throw new Error('Run this launcher through npm run tool.');
    // npm runs with the tool directory as cwd: no root .env or shared runtime data.
    const child=spawn(process.execPath,[npm,'run',command,'--',...args],{cwd,stdio:'inherit'});
    child.on('error',()=>{console.error('Could not launch tool.');process.exitCode=1;});
    child.on('exit',code=>{process.exitCode=code??1;});
    process.on('SIGINT',()=>child.kill('SIGINT'));
  }
}
