const net=require('node:net');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const fs=require('node:fs/promises');
function socketPath(root){return path.join(os.tmpdir(),`codex-voice-${process.getuid()}-${crypto.createHash('sha256').update(path.resolve(root)).digest('hex').slice(0,12)}`,'control.sock');}
function validate(request){
 if(!request||!['show','start','stop','status'].includes(request.action))throw Error('Expected show, start, stop, or status.');
 if(request.threadId!==undefined&&(typeof request.threadId!=='string'||!request.threadId.trim()||request.threadId.length>256||/[\x00-\x20]/.test(request.threadId)))throw Error('Invalid threadId.');
 if(request.action==='start'&&!request.threadId)throw Error('start requires --thread-id.');
 return request;
}
function request(socket,command,timeout=25000){try{validate(command);}catch(error){return Promise.reject(error);}return new Promise((resolve,reject)=>{
 const connection=net.createConnection(socket);let buffer='';
 connection.setTimeout(timeout,()=>connection.destroy(Error('Desktop control timed out.')));
 connection.on('connect',()=>connection.write(JSON.stringify(validate(command))+'\n'));
 connection.on('data',chunk=>{buffer+=chunk;if(buffer.length>65536)return connection.destroy(Error('Oversized control response.'));if(buffer.includes('\n')){try{const result=JSON.parse(buffer.split('\n')[0]);connection.end();result.ok?resolve(result):reject(Error(result.error));}catch(error){reject(error);connection.destroy();}}});
 connection.on('error',reject);connection.on('end',()=>{if(!buffer.includes('\n'))reject(Error('Desktop closed without a response.'));});
 });}
async function serve(socket,handle){
 await fs.mkdir(path.dirname(socket),{recursive:true,mode:0o700});
 await fs.chmod(path.dirname(socket),0o700);
 // Only called by the Electron single-instance owner, so stale endpoints are safe to remove.
 await fs.rm(socket,{force:true});
 const server=net.createServer(connection=>{let buffer='',received=false;connection.setTimeout(30000,()=>connection.destroy());connection.on('error',()=>{});connection.on('data',async chunk=>{
 if(received)return;buffer+=chunk;if(buffer.length>4096){received=true;connection.end(JSON.stringify({ok:false,error:'Oversized control request.'})+'\n');return;}
 if(!buffer.includes('\n'))return;received=true;
 try{const result=await handle(validate(JSON.parse(buffer.split('\n')[0])));connection.end(JSON.stringify({ok:true,...result})+'\n');}catch(error){connection.end(JSON.stringify({ok:false,error:error.message})+'\n');}
 });});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(socket,resolve);});
 await fs.chmod(socket,0o600);return server;
}
class VoiceControl{
 constructor(send,show,{timeout=20000}={}){this.send=send;this.show=show;this.timeout=timeout;this.state={active:false,phase:'idle',threadId:null,error:null};this.pending=null;this.sequence=0;}
 update(patch){
 const next={};for(const key of ['active','phase','threadId','error'])if(Object.hasOwn(patch,key))next[key]=patch[key];
 if(next.active!==undefined&&typeof next.active!=='boolean')return;
 if(next.phase!==undefined&&!['idle','starting','active','stopping'].includes(next.phase))return;
 if(next.threadId!==undefined&&next.threadId!==null&&typeof next.threadId!=='string')return;
 if(next.error!==undefined&&next.error!==null&&typeof next.error!=='string')return;
 Object.assign(this.state,next);const p=this.pending;if(!p)return;
 if(this.state.error){p.finish(Error(this.state.error));return;}
 if(p.action==='start'&&this.state.phase==='active'&&this.state.active&&this.state.threadId===p.threadId)p.finish();
 if(p.action==='stop'&&this.state.phase==='idle'&&!this.state.active)p.finish();
 }
 async handle(command){
 validate(command);if(command.action==='status')return {...this.state,pending:this.pending?.action||null};
 if(command.action==='show'){if(command.threadId&&this.state.phase!=='idle'&&command.threadId!==this.state.threadId)throw Error('Stop voice before binding a different thread.');if(command.threadId)this.state.threadId=command.threadId;this.show(this.state.threadId);if(command.threadId)this.send({id:String(++this.sequence),action:'show',threadId:command.threadId});return {...this.state};}
 if(this.pending&&command.action==='stop'&&this.pending.action==='start'){this.pending.finish(Error('Start cancelled by stop.'));this.state.phase='stopping';}
 else if(this.pending)throw Error('A voice command is pending. Check status before retrying.');
 if(command.action==='start'&&this.state.phase==='active'&&command.threadId===this.state.threadId){this.show(command.threadId);return {...this.state};}
 if(command.action==='start'&&this.state.phase!=='idle')throw Error('Stop voice before starting another thread.');
 if(command.action==='stop'&&this.state.phase==='idle'&&!this.state.active)return {...this.state};
 this.state.error=null;
 if(command.action==='start'){this.state.threadId=command.threadId;this.show(command.threadId);}
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>this.pending?.finish(Error('Renderer did not confirm voice state. Check status; do not blindly retry start.')),this.timeout);
 this.pending={...command,finish:error=>{clearTimeout(timer);this.pending=null;error?reject(error):resolve();}};
 try{this.send({id:String(++this.sequence),action:command.action,...(command.threadId?{threadId:command.threadId}:{})});}catch(error){this.pending.finish(error);}
 });return {...this.state};
 }
}
module.exports={socketPath,validate,request,serve,VoiceControl};
