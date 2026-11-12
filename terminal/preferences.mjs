import {readFile,mkdir,writeFile,rename,unlink} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export const preferencesFile=path.join(homedir(),'.config','agent-talk','ui.json');
export const defaults={showTranscript:false,showWaveforms:false};
export async function loadPreferences(file=preferencesFile){try{const saved=JSON.parse(await readFile(file,'utf8'));return Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,typeof saved?.[key]==='boolean'?saved[key]:value]));}catch{return {...defaults};}}
export async function savePreferences(settings,file=preferencesFile){await mkdir(path.dirname(file),{recursive:true,mode:0o700});const temp=`${file}.${randomUUID()}.tmp`;try{await writeFile(temp,JSON.stringify({showTranscript:Boolean(settings.showTranscript),showWaveforms:Boolean(settings.showWaveforms)})+'\n',{mode:0o600});await rename(temp,file);}finally{await unlink(temp).catch(()=>{});}}
