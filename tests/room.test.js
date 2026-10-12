import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {QUIZ} from '../quiz.js';
import {HOST_KEY,grade} from '../host-key.js';

// In-memory PeerJS wire protocol: separate simulated browser identities, connections
// and asynchronous delivery. No third-party service or browser access is required.
const peers=new Map(); let nextId=0;
class FakeConnection extends EventEmitter {
  constructor(peer){super();this.peer=peer;this.open=false;}
  send(msg){if(!this.open) throw new Error('connection closed');const clone=structuredClone(msg);queueMicrotask(()=>this.other.emit('data',clone));}
  close(){this.open=false;this.other.open=false;this.emit('close');this.other.emit('close');}
}
class FakePeer extends EventEmitter {
  constructor(id){super();this.id=id||`client-${++nextId}`;this.open=false;this.destroyed=false; if(peers.has(this.id))throw new Error('duplicate');peers.set(this.id,this);queueMicrotask(()=>{this.open=true;this.emit('open',this.id);});}
  connect(id){const receiver=peers.get(id);if(!receiver)throw new Error('missing host');const a=new FakeConnection(id),b=new FakeConnection(this.id);a.other=b;b.other=a;queueMicrotask(()=>{receiver.emit('connection',b);queueMicrotask(()=>{a.open=true;b.open=true;b.emit('open');a.emit('open');});});return a;}
  destroy(){this.destroyed=true;this.open=false;peers.delete(this.id);}
  reconnect(){}
}
globalThis.window={Peer:FakePeer,dispatchEvent:()=>{}};
globalThis.Peer=FakePeer;
globalThis.localStorage={getItem(){return null;},setItem(){}};
function storage(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};}
async function browser(i,url){
  globalThis.sessionStorage=storage();globalThis.location={href:url};
  const {makeBackend}=await import(`../backend.js?test-client=${i}`);
  return makeBackend();
}
const waitFor=async(pred,ms=3000)=>{const start=Date.now();while(!pred()){if(Date.now()-start>ms)throw new Error('timed out waiting for peer updates');await new Promise(r=>setTimeout(r,2));}};

test('25 players complete 18 synchronized questions without premature score publication',async()=>{
  const host=await browser('host','https://example.com/');
  const code=await host.createRoom();
  const participants=[];
  for(let i=0;i<25;i++){
    const client=await browser(i,`https://example.com/?join=${code}`);
    let current=null;
    client.watchRoom(code,r=>{if(r)current=r;});
    await waitFor(()=>current!==null);
    await client.joinRoom(code,`Player ${i+1}`);
    participants.push({client,getRoom:()=>current});
  }
  assert.equal((await host.getPlayers(code)).length,25);
  let previousScores={};
  for(let index=0; index<18;index++){
    const q=QUIZ[index],key=HOST_KEY[q.id];
    await host.updateRoom(code,{qIndex:index,qKey:q.id,questionType:q.type,phase:q.type==='person'?'reveal':'collect',revealCount:q.type==='person'?1:q.type==='fake'?4:0,scoreDone:'',publicAnswer:'',leaderboard:[]});
    await waitFor(()=>participants.every(p=>p.getRoom()?.qKey===q.id));
    await Promise.all(participants.map(({client},i)=>{
      const response=q.type==='fake'?(i%2===0?key.correct:'A'===key.correct?'B':'A'):q.type==='person'?(i%2===0?key.answer:'Unknown Celebrity'):(i%2===0?key.answer:'Unrelated nonsense');
      return client.submit(code,q.id,response,q.type==='person'?1:0);
    }));
    await host.gradeRound(code,q,grade,key.answer);
    await waitFor(()=>participants.every(p=>p.getRoom()?.phase==='result' && p.getRoom()?.qIndex===index));
    for(const p of participants){
      const room=p.getRoom();
      assert.equal(room.leaderboard.length,0,'no score table allowed before segment reveal');
      assert.equal(Object.hasOwn(room,'publishedScores'),false,'do not send previously unpublished point totals');
      const roster=await p.client.getPlayers(code);
      assert.equal(roster.length,25);
      assert.equal(Object.hasOwn(roster[0],'score'),false,'raw player scores must not leak to phones');
    }
    if ([5,11,17].includes(index)){
      const round=Math.ceil((index+1)/6);
      const scored=await host.getPlayers(code);
      const board=scored.map(p=>({...p,roundPoints:p.score-(previousScores[p.uid]||0)})).sort((a,b)=>b.score-a.score);
      previousScores=Object.fromEntries(board.map(p=>[p.uid,p.score]));
      await host.updateRoom(code,{phase:'leaderboard',roundBreak:round,leaderboard:board});
      await waitFor(()=>participants.every(p=>p.getRoom()?.phase==='leaderboard'&&p.getRoom()?.leaderboard?.length===25));
      assert.ok(participants.every(p=>p.getRoom().leaderboard.every(x=>x.roundPoints>=0)));
    }
  }
});
