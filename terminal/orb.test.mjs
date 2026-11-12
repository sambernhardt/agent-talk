import test from 'node:test';
import assert from 'node:assert/strict';
import {asciiOrb,orbState} from './orb.mjs';
import {render,controlsRow} from './ui.mjs';

test('orb follows output audio before work status, and stops animating speech after stop',()=>{
  const s={state:'listening',handoff:{state:'working'}};
  assert.equal(orbState(s,0),'thinking');assert.equal(orbState(s,.5),'talking');
  assert.equal(orbState({...s,state:'ended'},.5),'idle');
  assert.equal(orbState({...s,handoff:{state:'completed'}},0),'idle');
});
test('character cell aspect ratio preserves circular outline while amplitude changes diameter',()=>{
  const quiet=asciiOrb({rows:14,columns:80,time:0});
  const loud=asciiOrb({rows:14,columns:80,time:0,state:'talking',amplitude:1});
  const points=quiet.flatMap((line,y)=>[...line].flatMap((c,x)=>c===' '?[]:[{x,y}]));
  const width=Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x))+1;
  const height=Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))+1;
  assert.ok(Math.abs(width/2-height)<=1);
  assert.ok(loud.join('').replace(/ /g,'').length>quiet.join('').replace(/ /g,'').length);
  assert.notEqual(asciiOrb({rows:14,time:0,color:true}).join('\n'),asciiOrb({rows:14,time:8,color:true}).join('\n'));
});
test('orb color is optional and every row fits terminal columns',()=>{
  for(const columns of [12,20,40,80]){
    const lines=asciiOrb({columns,rows:14,color:true});
    assert.ok(lines.every(l=>l.replace(/\x1b\[[0-9;]*m/g,'').length<columns));
  }
  assert.ok(!asciiOrb().join('').includes('\x1b'));
  assert.match(asciiOrb({color:true}).join(''),/\x1b\[38;2;/);
});
test('orb reserves transcript space and leaves mouse button rows unchanged',()=>{
  for(const rows of [12,24,40]){
    const frame=render({state:'listening',messages:[{label:'Voice',text:'Still visible'}]},{rows,columns:80,color:true,showTranscript:true});
    assert.equal(frame.split('\n')[controlsRow(rows)-1],'  [S Start]   [X Stop]   [M Mute]   [Q Quit]');
    assert.match(frame,/Voice: Still visible/);assert.ok(frame.split('\n').length<rows);
    assert.equal(frame.includes('\x1b[38;2;'),false);
    const orb=render({state:'listening'},{rows,columns:80,color:true});
    assert.equal(orb.includes('\x1b[38;2;'),rows>=24);
  }
});
test('character presets and custom ramps preserve colors and geometry',()=>{
 const base={rows:14,columns:80,time:2,color:true};
 const original=asciiOrb({...base,characterPreset:'original'}).join('\n');
 assert.equal(original,asciiOrb({...base,characterPreset:'original'}).join('\n'));
 const solid=asciiOrb({...base,characterPreset:'solid'}).join('\n');
 assert.match(solid,/█/);assert.doesNotMatch(solid.replace(/\x1b\[[0-9;]*m/g,''),/[^ █\n]/);
 const custom=asciiOrb({...base,characterPreset:'custom',customCharacters:'XO'}).join('\n');
 assert.doesNotMatch(custom.replace(/\x1b\[[0-9;]*m/g,''),/[^ XO\n]/);
 assert.deepEqual([...original.matchAll(/\x1b\[38;2;[0-9;]+m/g)].map(m=>m[0]),[...custom.matchAll(/\x1b\[38;2;[0-9;]+m/g)].map(m=>m[0]));
});
