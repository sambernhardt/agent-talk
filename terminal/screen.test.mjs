import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createScreen} from './screen.mjs';
class Output extends EventEmitter{chunks=[];ready=true;write(chunk){this.chunks.push(chunk);return this.ready;}}
test('animation updates do not blank the screen or repaint unchanged footer rows',()=>{
 const out=new Output(),screen=createScreen(out);screen.draw('Header\n orb one\n[S Start]',80);out.chunks=[];
 screen.draw('Header\n orb two\n[S Start]',80);const packet=out.chunks.join('');
 assert.ok(!packet.includes('\x1b[2J'),'animation must not clear the screen');
 assert.ok(!packet.includes('[S Start]'),'unchanged controls must not redraw');
 assert.ok(packet.startsWith('\x1b[?2026h'));assert.ok(packet.endsWith('\x1b[?2026l'));
 assert.ok(packet.includes('orb two'));
});
test('identical frames emit nothing; shrinking text erases its tail after drawing',()=>{
 const out=new Output(),screen=createScreen(out);screen.draw('Long text\nStatus',80);out.chunks=[];screen.draw('Long text\nStatus',80);assert.equal(out.chunks.length,0);
 screen.draw('Hi\n',80);const packet=out.chunks.join('');assert.ok(packet.includes('Hi\x1b[0m\x1b[K'));assert.ok(!packet.includes('Long text'));
});
test('slow terminal skips queued frames until drain, then paints the newest state',()=>{
 const out=new Output(),screen=createScreen(out);out.ready=false;screen.draw('one',80);const count=out.chunks.length;screen.draw('two',80);screen.draw('three',80);assert.equal(out.chunks.length,count);
 out.ready=true;out.emit('drain');screen.draw('four',80);assert.match(out.chunks.at(-1),/four/);assert.ok(!out.chunks.slice(1).join('').includes('two'));
});
test('return from picker invalidates screen and repaints all rows',()=>{const out=new Output(),screen=createScreen(out);screen.draw('Header\nFooter',80);out.chunks=[];screen.invalidate();screen.draw('Header\nFooter',80);assert.match(out.chunks.join(''),/Header/);assert.match(out.chunks.join(''),/Footer/);});
