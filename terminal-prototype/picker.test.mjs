import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {filterChats, pickChat} from './picker.mjs';
import {options, listChats} from './cli.mjs';
const chats = [{id:'one', name:'Voice context', cwd:'/work/companion'}, {id:'two',name:'Terminal UI',cwd:'/work/voice'}];

test('picker filters title and workspace using every word', () => {
  assert.deepEqual(filterChats(chats, 'VOICE terminal'), [chats[1]]);
  assert.deepEqual(filterChats(chats, 'missing'), []);
  assert.deepEqual(filterChats(chats, ''), chats);
});
test('no binding opens picker; explicit binding bypasses it unless requested', () => {
  assert.equal(options([]).pick, true);
  assert.equal(options(['--thread','one']).pick, undefined);
  assert.equal(options(['--pick','--thread','one','--start']).start, true);
  assert.equal(options(['--demo']).thread, 'preview');
  assert.throws(()=>options(['--demo','--pick']), /live relay/);
});
function terminal() {
  const input = new PassThrough(); input.isTTY = true; input.isRaw = false;
  input.setRawMode = value => {input.isRaw = value;};
  const output = new PassThrough(); output.isTTY = true; output.columns = 80; output.rows = 12;
  output.resume(); return {input,output};
}
test('typing a filter and Enter selects exact chat and restores input', async () => {
  const io = terminal(); const result = pickChat(chats, io);
  io.input.write('terminal'); io.input.write('\r');
  assert.equal((await result).id, 'two');
  assert.equal(io.input.isRaw, false);
  assert.equal(io.input.listenerCount('keypress'), 0);
});
test('arrow selection respects preferred chat and cancellation restores terminal', async () => {
  const io = terminal(); let result = pickChat(chats, {...io,preferredId:'two'});
  io.input.write('\r'); assert.equal((await result).id,'two');
  result = pickChat(chats, io); io.input.write('\x03');
  assert.equal(await result, null); assert.equal(io.input.isRaw, false);
});
test('authenticated chat lookup normalizes titles and reports relay errors', async () => {
  let count = 0;
  const result = await listChats('http://127.0.0.1:4320', async (url,init) => {
    if (!count++) return {ok:true,text:async()=>'<meta name="voice-token" content="test-only">'};
    assert.equal(init.headers.Authorization,'Bearer test-only');
    return {ok:true,json:async()=>({threads:[{id:'one',name:''},{name:'invalid'}]})};
  });
  assert.deepEqual(result,[{id:'one',name:'Untitled chat'}]);
  await assert.rejects(listChats('http://127.0.0.1:4320',async()=>({ok:false,status:503})), /503/);
});
