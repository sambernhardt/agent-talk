import {mkdir, readFile, writeFile, stat, rename, unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {parse} from 'smol-toml';

export async function installAction(project = process.cwd()) {
  const root = path.resolve(project);
  if (!(await stat(root)).isDirectory()) throw Error(`Not a project directory: ${root}`);
  const file = path.join(root, '.codex', 'environments', 'environment.toml');
  let original = null, mode = 0o644;
  try { original = await readFile(file, 'utf8'); mode = (await stat(file)).mode & 0o777; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let config;
  try { config = original === null ? {version:1} : parse(original); }
  catch { throw Error(`Invalid TOML in ${file}; no changes made.`); }
  if (config.version !== 1) throw Error(`Unsupported environment version in ${file}; no changes made.`);
  if (config.actions !== undefined && !Array.isArray(config.actions)) throw Error(`Expected an actions array in ${file}; no changes made.`);
  const actions = config.actions || [];
  if (actions.some(action => action.command?.trim() === 'npx agent-talk')) return {file, installed:false};
  if (actions.some(action => action.name === 'Voice')) throw Error(`A different Voice action exists in ${file}; rename it before installing.`);
  const eol = original?.includes('\r\n') ? '\r\n' : '\n';
  const base = original ?? `version = 1\nname = ${JSON.stringify(path.basename(root))}\n\n[setup]\nscript = ""\n`.replaceAll('\n', eol);
  const addition = '\n[[actions]]\nname = "Voice"\nicon = "run"\ncommand = "npx agent-talk"\n'.replaceAll('\n', eol);
  const updated = base + (base.endsWith('\n') ? '' : eol) + addition;
  // Append rather than serialize: comments, scripts, and existing formatting survive.
  const validated = parse(updated);
  if (validated.actions?.at(-1)?.command !== 'npx agent-talk') throw Error(`Could not append Voice action to ${file}.`);
  await mkdir(path.dirname(file), {recursive:true});
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, updated, {flag:'wx', mode});
    let current = null;
    try { current = await readFile(file, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (current !== original) throw Error(`Configuration changed during installation: ${file}. Retry the command.`);
    await rename(temporary, file);
  } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  return {file, installed:true};
}

export async function installProjects(projects) {
  let failed = false;
  for (const project of [...new Set((projects.length ? projects : ['.']).map(p => path.resolve(p)))]) {
    try {
      const result = await installAction(project);
      console.log(`${result.installed ? 'Added Voice action' : 'Voice action already installed'}: ${result.file}`);
    } catch (error) { failed = true; console.error(`agent-talk: ${error.message}`); }
  }
  if (!failed) console.log('Open the project in Codex and choose Voice in the toolbar actions. If absent, select its local environment in project settings.');
  return failed ? 1 : 0;
}
