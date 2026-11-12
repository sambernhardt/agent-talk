import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {render,layout,Controls,controlsRow} from './ui.mjs';
import {changeChat} from './cli.mjs';
import {loadPreferences,savePreferences} from './preferences.mjs';

test('layout anchors controls and places Change beside title across sizes',()=>{
 for(const columns of [35,80,120])for(const rows of [12,24,40]){
 const s={state:'idle',threadLabel:'Voice orb'},options={columns,rows};
 const frame=render(s,options),lines=frame.split('\n'),hits=layout(s,options).hits;
 assert.equal(lines.length,rows-1);assert.match(lines[1],/\[H Change\]/);
 assert.ok(lines[1].indexOf('[H Change]')>lines[1].indexOf('Codex'));
 assert.match(lines[controlsRow(rows)-1],/\[S Start\]/);assert.ok(lines.every(l=>l.length<columns));
 for(const key of ['c','h','s']){const hit=hits.find(h=>h.key===key),actions=[];new Controls(k=>actions.push(k),null,()=>hits).feed(`\x1b[<0;${hit.x+1};${hit.y+1}M`);assert.deepEqual(actions,[key]);}
 }
});
test('transcript defaults off, waveform toggle controls both rows, Config reports settings',()=>{
 const session={state:'idle',notice:'Press S to start',messages:[{label:'You',text:'private transcript'}]};
 const basic=render(session);assert.ok(!basic.includes('private transcript'));assert.ok(!basic.includes('Press S'));assert.ok(!basic.includes('  IN '));assert.ok(!basic.includes('  OUT '));const waves=render(session,{showWaveforms:true});assert.match(waves,/  IN /);assert.match(waves,/  OUT /);
 const toggled=render(session,{showTranscript:true,showWaveforms:false,configOpen:true});assert.match(toggled,/private transcript/);assert.ok(!toggled.includes('  IN '));assert.ok(!toggled.includes('  OUT '));assert.match(toggled,/\[T\] Transcript  On/);assert.match(toggled,/\[W\] Waveforms   Off/);
});
test('config keys and escape do not dispatch voice actions',()=>{const keys=[];const c=new Controls(k=>keys.push(k));c.feed('chtw');c.feed('\x1b');assert.deepEqual(keys,['c','h','t','w','escape']);});
test('display settings persist without changing unrelated config',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'agent-talk-ui-')),file=path.join(dir,'ui.json');
 assert.deepEqual(await loadPreferences(file),{showTranscript:false,showWaveforms:false});
 await savePreferences({showTranscript:true,showWaveforms:false},file);assert.deepEqual(await loadPreferences(file),{showTranscript:true,showWaveforms:false});assert.equal((await stat(file)).mode&0o777,0o600);
 await writeFile(file,'{"showTranscript":"yes","showWaveforms":false}');assert.deepEqual(await loadPreferences(file),{showTranscript:false,showWaveforms:false});
 await writeFile(file,'bad json');assert.deepEqual(await loadPreferences(file),{showTranscript:false,showWaveforms:false});
});
function session(){return {thread:'old',threadLabel:'Original',state:'listening',messages:[{text:'old transcript'}],handoff:{id:'old'},cost:{},stops:0,stop(){this.stops++;this.state='ended';}};}
test('changing chat stops audio and clears context without starting the new session',async()=>{
 const s=session(),answers=[{id:'codex'},{id:'new',name:'New chat'}];
 const changed=await changeChat(s,{relay:'fixture',pick:async()=>answers.shift(),list:async()=>[{id:'new',name:'New chat'}]});
 assert.equal(changed,true);assert.equal(s.stops,1);assert.equal(s.thread,'new');assert.equal(s.threadLabel,'New chat');assert.equal(s.state,'idle');assert.deepEqual(s.messages,[]);assert.equal(s.handoff,null);assert.equal(s.cost,null);
});
test('cancelling either picker or reselecting the same chat preserves the active call',async()=>{
 for(const answers of [[null],[{id:'codex'},null],[{id:'codex'},{id:'old',name:'Original'}]]){const s=session();assert.equal(await changeChat(s,{pick:async()=>answers.shift(),list:async()=>[]}),false);assert.equal(s.stops,0);assert.equal(s.state,'listening');assert.equal(s.thread,'old');assert.equal(s.messages.length,1);}
});
test('unsupported agent never binds or starts a Claude session',async()=>{const s=session();assert.equal(await changeChat(s,{pick:async()=>({id:'claude'}),list:()=>assert.fail('No chat lookup for unsupported agent')}),false);assert.equal(s.thread,'old');assert.equal(s.stops,0);assert.match(s.notice,/Coming soon/i);});

test('transcript replaces orb and uses the full content area; switching off restores orb',()=>{
 const s={state:'listening',messages:Array.from({length:30},(_,i)=>({label:'You',text:`Message ${i}`}))};
 const transcript=render(s,{rows:32,color:true,showTranscript:true});
 assert.ok(!transcript.includes('\x1b[38;2;'));assert.match(transcript,/Message 29/);assert.match(transcript,/Message 10/);
 const orb=render(s,{rows:32,color:true,showTranscript:false});assert.match(orb,/\x1b\[38;2;/);assert.ok(!orb.includes('Message 29'));
 const empty=render({...s,messages:[]},{rows:32,color:true,showTranscript:true});assert.ok(!empty.includes('\x1b[38;2;'));
});
