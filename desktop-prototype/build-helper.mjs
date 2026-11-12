import {mkdir,copyFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('.',import.meta.url));
await mkdir(new URL('.build/module-cache/',import.meta.url),{recursive:true});
const result=spawnSync('swiftc',['native/CodexWindow.swift','-O','-module-cache-path','.build/module-cache','-o','.build/codex-window-helper'],{cwd,stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);

const native=spawnSync('clang++',['-shared','-fPIC','-fobjc-arc','-I/opt/homebrew/include/node','-framework','AppKit','-framework','QuartzCore','-undefined','dynamic_lookup','native/WindowOrder.mm','-o','.build/window-order.node'],{cwd,stdio:'inherit'});
if(native.status!==0)process.exit(native.status||1);
