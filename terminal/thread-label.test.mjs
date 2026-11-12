import test from 'node:test';
import assert from 'node:assert/strict';
import {options, resolveThreadLabel} from './cli.mjs';
import {render} from './ui.mjs';

test('relay title is displayed while the selected thread ID is preserved',async()=>{
  const opts=options(['--thread','target-id']);const calls=[];
  const title=await resolveThreadLabel(opts,async(url,init)=>{
    calls.push({url,init});
    return calls.length===1 ? {ok:true,text:async()=>'<meta name="voice-token" content="local-test-token">'} :
      {ok:true,json:async()=>({threads:[{id:'other',name:'Wrong chat'},{id:'target-id',name:'Voice context design'}]})};
  });
  assert.equal(title,'Voice context design');assert.equal(opts.thread,'target-id');
  assert.equal(calls[1].init.headers.Authorization,'Bearer local-test-token');
  const frame=render({thread:opts.thread,threadLabel:title,state:'error',notice:'Device lost'},{rows:12});
  assert.match(frame,/Chat Voice context design/);assert.match(frame,/Device lost/);assert.ok(!frame.includes('target-id'));
});
test('explicit label and demo require no network',async()=>{
  const noFetch=()=>{assert.fail('No lookup expected');};
  assert.equal(await resolveThreadLabel(options(['--thread','id','--label','My chat']),noFetch),'My chat');
  assert.equal(await resolveThreadLabel(options(['--thread','id','--demo']),noFetch),'Voice preview');
});
test('unavailable title lookup uses a readable fallback without exposing the ID',async()=>{
  assert.equal(await resolveThreadLabel({thread:'id',relay:'http://127.0.0.1:4320'},async()=>{throw Error('offline');}),'Current chat');
  assert.ok(!render({thread:'private-thread-id',state:'idle'}).includes('private-thread-id'));
});
