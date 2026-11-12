import {fileURLToPath} from 'node:url';
import {appendFile, readFile, rename, stat} from 'node:fs/promises';
export function failureDetails(error, phase) {
  const details = {phase};
  if (Number.isInteger(error.exitCode)) details.exitCode = error.exitCode;
  if (/^SIG[A-Z0-9]+$/.test(error.signal || '')) details.signal = error.signal;
  if (/^[A-Z][A-Z0-9_]{1,40}$/.test(error.code || '')) details.errorCode = error.code;
  if (Number.isInteger(error.httpStatus)) details.httpStatus = error.httpStatus;
  details.reason = details.signal ? 'process-terminated' : details.exitCode != null ? 'process-exit'
    : details.errorCode ? 'process-error' : details.httpStatus ? 'http-error'
    : error.name === 'TimeoutError' || /timed out/.test(error.message || '') ? 'timeout'
    : phase === 'preparation' ? 'preparation-rejected' : 'operation-failed';
  details.hint = phase === 'queue' ? 'Check the Codex process and desktop chat before retrying; submission may have occurred.'
    : phase === 'baseline-read' ? 'Check the local app-server history reader; no queue call was made.'
    : phase === 'preparation' ? 'Check Gateway availability or structured handoff validation; no queue call was made.'
    : 'Inspect the preceding stages and local voice connection.';
  return details;
}
export class Diagnostics {
  constructor(path, maxBytes = 1024 * 1024) { this.path = path instanceof URL ? fileURLToPath(path) : path; this.maxBytes = maxBytes; this.chain = Promise.resolve(); this.writeFailed = false; }
  record(event) {
    // Explicit allowlist: never persist messages, audio, stderr, API keys, or tokens.
    const clean = {};
    for (const key of ['at','stage','threadId','sessionId','delegationId','jobId','action','status','phase','reason','hint','signal','exitCode','errorCode','httpStatus']) {
      const value = event[key];
      if (typeof value === 'string') clean[key] = value.slice(0,300);
      else if (typeof value === 'number' && Number.isFinite(value)) clean[key] = value;
    }
    this.chain = this.chain.then(async () => {
      const size = await stat(this.path).then(s=>s.size).catch(e=>{if(e.code==='ENOENT')return 0;throw e;});
      if (size >= this.maxBytes) await rename(this.path,this.path+'.1');
      await appendFile(this.path,JSON.stringify(clean)+'\n',{mode:0o600});
      this.writeFailed = false;
    }).catch(()=>{this.writeFailed=true;console.error('Voice diagnostics could not be persisted; use /api/session for in-memory stages.');});
  }
  async read(threadId = null) {
    await this.chain;
    const chunks = await Promise.all([this.path+'.1',this.path].map(p=>readFile(p,'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;})));
    const events = chunks.join('\n').split('\n').filter(Boolean).flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});
    return events.filter(e=>!threadId||e.threadId===threadId).slice(-200);
  }
}
