import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionContext} from './session-context.mjs';
import {SessionCost} from './session-cost.mjs';
import {formatHandoff} from './handoff.mjs';
test('handoff carries exact timestamped application data without credentials or transcripts',()=>{
 const c={costSession:new SessionCost('session',0),threadId:'chat',closing:false,jobs:[{id:'job',started:true}]};
 c.costSession.usage(60,60000);
 const snapshot=sessionContext(c,62000);
 assert.equal(snapshot.seconds,62);assert.equal(snapshot.providerUsageSeconds,60);
 assert.equal(snapshot.sampledAt,'1970-01-01T00:01:02.000Z');assert.equal(snapshot.selectedChatId,'chat');
 assert.deepEqual(snapshot.pendingRequests,[{id:'job',state:'working'}]);
 const message=formatHandoff({task:'Report current session cost.',context:'',constraints:[]},snapshot);
 assert.ok(message.includes(JSON.stringify(snapshot)));assert.ok(message.includes('/api/session'));
 assert.equal(sessionContext({costSession:null}),null);
});
