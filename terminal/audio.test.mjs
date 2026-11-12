import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeAudio} from './audio.mjs';

test('playback accepts a burst of generated audio longer than three seconds', () => {
  const audio=new NativeAudio(()=>{},()=>{});const written=[];
  audio.player={stdin:{writableLength:0,write(pcm){this.writableLength+=pcm.length;written.push(pcm);}}};
  const frame=Buffer.alloc(2400,1);
  for(let i=0;i<200;i++)audio.play(frame);
  assert.equal(Buffer.concat(written).length,480000);
});

test('playback still bounds memory when an output device stops draining', () => {
  const audio=new NativeAudio(()=>{},()=>{});
  audio.player={stdin:{writableLength:24000*2*120,write(){assert.fail('overflow must not be written');}}};
  assert.throws(()=>audio.play(Buffer.alloc(2400)),/queue exceeded two minutes/);
});
