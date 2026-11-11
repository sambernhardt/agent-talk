import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speechChunks } from './speech-chunks.mjs';
test('sentence mode starts with first sentence and preserves the exact full answer',()=>{
 const text='Here is a short answer.\n\n'+'More detail follows with a long explanation. '.repeat(100);
 const chunks=speechChunks(text,'sentences');
 assert.equal(chunks[0],'Here is a short answer.\n\n');
 assert.equal(chunks.join(''),text);assert.ok(chunks[0].length<=240);assert.ok(chunks.every(c=>c.length<=600));
});
test('both modes handle empty, unpunctuated and multilingual answers without dropping text',()=>{
 for(const text of ['', 'a'.repeat(6500), '你好。 This is an answer!\nMore words'])for(const mode of ['whole','sentences'])assert.equal(speechChunks(text,mode).join(''),text);
});
