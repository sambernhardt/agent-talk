import {spawn} from 'node:child_process';
export function queueMessage(threadId, message, spawnImpl = spawn) {
  return new Promise((resolve,reject)=>{
    const child=spawnImpl(process.env.CODEX_BIN || 'codex',['queue','--thread',threadId,'--message',message]);
    let output='';
    child.stdout.on('data',()=>{});
    child.stderr.on('data',d=>{output=(output+d).slice(-4000);});
    child.on('error',reject);
    child.on('close',(code,signal)=>{
      if(code===0)return resolve();
      const error=new Error(output || (signal ? `Queue process ended by ${signal}; submission was not confirmed.` : `Queue exited ${code}`));
      error.exitCode=code;error.signal=signal;reject(error);
    });
  });
}
