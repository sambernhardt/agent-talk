import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

export function handoffWriter() {
  let directory;
  return async ({id, text}) => {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw Error('Invalid handoff identifier');
    if (typeof text !== 'string') throw Error('Missing handoff text');
    directory ??= mkdtemp(path.join(tmpdir(), 'codex-voice-handoffs-'));
    const file = path.join(await directory, `handoff-${id}.txt`);
    await writeFile(file, text, {mode:0o600});
    return file;
  };
}
