import {readFileSync} from 'node:fs';
const pkg = JSON.parse(readFileSync(new URL('../package.json',import.meta.url)));
// Tests and unrelated prototype files are excluded through .npmignore.
if (!pkg.bin['voice-mode']) throw Error('Missing CLI entry point');
