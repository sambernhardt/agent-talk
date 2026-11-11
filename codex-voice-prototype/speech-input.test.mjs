import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpeechInput } from './speech-input.mjs';
test('speech reaches Codex after a pause even when voice never delegates', async t => {
 t.mock.timers.enable({apis:['setTimeout']});
 const sent=[];const input=new SpeechInput(async text=>sent.push(text));
 input.append('What is ');t.mock.timers.tick(1200);input.append('this chat about?');
 t.mock.timers.tick(1599);await Promise.resolve();assert.deepEqual(sent,[]);
 t.mock.timers.tick(1);await input.chain;assert.deepEqual(sent,['What is this chat about?']);
});
test('delegation and silence do not send the same utterance twice', async t => {
 t.mock.timers.enable({apis:['setTimeout']});
 const sent=[];const input=new SpeechInput(async text=>sent.push(text));
 input.append('Hello');await input.flush('delegation');t.mock.timers.tick(5000);await input.chain;
 assert.deepEqual(sent,['Hello']);
});
test('ending voice cancels unsubmitted fragments', async t => {
 t.mock.timers.enable({apis:['setTimeout']});
 const sent=[];const input=new SpeechInput(async text=>sent.push(text));
 input.append('Partial');input.stop();t.mock.timers.tick(5000);await input.chain;
 assert.deepEqual(sent,[]);
});
