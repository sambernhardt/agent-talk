import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {parse} from 'smol-toml';
import {installAction} from './install.mjs';

async function fixture(t, content) {
  const root = await mkdtemp(path.join(tmpdir(), 'agent-talk-install-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const file=path.join(root,'.codex/environments/environment.toml');
  if(content !== undefined){await mkdir(path.dirname(file),{recursive:true});await writeFile(file,content);}
  return {root,file};
}
test('new project gets a usable action; repeated install changes nothing',async t=>{
  const {root,file}=await fixture(t);
  assert.equal((await installAction(root)).installed,true);
  const first=await readFile(file,'utf8');
  assert.deepEqual(JSON.parse(JSON.stringify(parse(first).actions)),[{name:'Voice',icon:'run',command:'npx agent-talk'}]);
  assert.equal((await installAction(root)).installed,false);
  assert.equal(await readFile(file,'utf8'),first);
});
test('preserves multiline setup, comments, platform config, actions, and CRLF',async t=>{
  const original=`# Project configuration\r\nversion = 1\r\nname = "example"\r\n[setup]\r\nscript = '''\r\necho "build"\r\nnpm ci\r\n'''\r\n[[actions]]\r\nname = "Run"\r\ncommand = "npm start"\r\n[actions.platforms.macos]\r\ncommand = "npm run mac"`;
  const {root,file}=await fixture(t,original);
  await installAction(root);
  const result=await readFile(file,'utf8');
  assert.ok(result.startsWith(original));
  const before=parse(original),after=parse(result);
  assert.deepEqual(after.setup,before.setup);
  assert.deepEqual(after.actions[0],before.actions[0]);
  assert.equal(after.actions[1].command,'npx agent-talk');
  assert.ok(!/(?<!\r)\n/.test(result));
});
test('invalid, unsupported, and conflicting configurations are untouched',async t=>{
  for(const content of ['version = [','version = 2','version = 1\nactions = "bad"','version = 1\n[[actions]]\nname = "Voice"\ncommand = "custom voice"']){
    const {root,file}=await fixture(t,content);
    await assert.rejects(installAction(root));
    assert.equal(await readFile(file,'utf8'),content);
  }
});
test('CLI install accepts multiple projects without a TTY or credentials',async t=>{
  const a=await fixture(t),b=await fixture(t);
  const result=spawnSync(process.execPath,['bin/agent-talk.mjs','install-codex-voice-action',a.root,b.root],{encoding:'utf8',env:{...process.env,AI_GATEWAY_API_KEY:''}});
  assert.equal(result.status,0,result.stderr);
  for(const {file} of [a,b])assert.equal(parse(await readFile(file,'utf8')).actions[0].name,'Voice');
  assert.doesNotMatch(result.stdout,/Starting local voice relay|Paste your AI Gateway token/);
});
test('CLI defaults to current project and reports partial failures with nonzero exit',async t=>{
  const {root,file}=await fixture(t);
  const cli=new URL('./agent-talk.mjs',import.meta.url).pathname;
  const result=spawnSync(process.execPath,[cli,'install-codex-voice-action'],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.equal(parse(await readFile(file,'utf8')).version,1);
  const failure=spawnSync(process.execPath,[cli,'install-codex-voice-action',root,path.join(root,'missing')],{encoding:'utf8'});
  assert.equal(failure.status,1);
  assert.match(failure.stdout,/already installed/);
});
