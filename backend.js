// Peer-to-peer version. The host browser is the authority. No Firebase account.
// The default public PeerJS signaling server is an external free service.
export const IS_DEMO = false;
const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), n => letters[n % letters.length]).join('');
const uid = (() => { let id=sessionStorage.getItem('wtf-p2p-uid'); if(!id){id='p_'+crypto.randomUUID();sessionStorage.setItem('wtf-p2p-uid',id);}return id;})();
const hostPeerId = code => `wtf-quiz-${code.toLowerCase()}`;
const defaultRoom=(code)=>({code,hostUid:uid,qIndex:0,qKey:'q01',questionType:'fake',phase:'lobby',revealCount:0,publicAnswer:'',scoreDone:'',voteCounts:{},responseCount:0,createdAtMs:Date.now(),stateRevision:0,playerCount:0,leaderboard:[],publishedScores:{},roundBreak:0});
export async function makeBackend(){
  if(!window.Peer)throw new Error('Live connection library could not load. Check internet connectivity, then refresh.');
  const url = new URL(location.href), roomCode=(url.searchParams.get('host')||url.searchParams.get('screen')||url.searchParams.get('join')||'').toUpperCase();
  const isHostRoute=url.searchParams.has('host');
  const listeners={room:new Map(),players:new Map(),subs:new Map(),own:new Map()};
  const watchers=(type, key,cb)=>{if(!listeners[type].has(key))listeners[type].set(key,new Set());listeners[type].get(key).add(cb);return()=>listeners[type].get(key)?.delete(cb);};
  const emit=(type,key,value)=>(listeners[type].get(key)||[]).forEach(cb=>cb(value));
  let ownRoom=null, roster=[], answers={}, remoteRoom=null, remotePlayers=[], remoteSubmission=null;
  let hostPeer=null, clientPeer=null, link=null, connectingCode='', reconnectTimer=null;
  const clients=new Map(), pending=new Map(); let msgNo=0;
  const roomStorage=code=>`wtf-p2p-host-${code}`;
  const save=()=>{if(ownRoom)try{localStorage.setItem(roomStorage(ownRoom.code),JSON.stringify({room:ownRoom,roster,answers}));}catch{}};
  const emitHost=()=>{if(!ownRoom)return;save();emit('room',ownRoom.code,ownRoom);emit('players',ownRoom.code,[...roster]);Object.keys(answers).forEach(k=>emit('subs',`${ownRoom.code}-${k}`,[...answers[k]]));};
  // Player/TV snapshots must never contain unpublished scores or answer grades.
  // Sending the raw roster used to leak scores after every question even though
  // the visible leaderboard remained hidden until the end of the segment.
  function publicSnapshot(){
    const {hostUid, publishedScores, ...visibleRoom}=ownRoom;
    return visibleRoom;
  }
  function sendSnapshot(conn){
    if(!conn.open||!ownRoom)return;
    const meta=clients.get(conn.peer)||{};
    const mine=(answers[ownRoom.qKey]||[]).find(s=>s.uid===meta.uid)||null;
    const publicPlayers=roster.map(({uid,name,joinedAt})=>({uid,name,joinedAt}));
    const ownSubmission=mine?{uid:mine.uid,qKey:mine.qKey,response:mine.response,clueCount:mine.clueCount,submittedAt:mine.submittedAt}:null;
    conn.send({type:'snapshot',room:publicSnapshot(),players:publicPlayers,ownSubmission});
  }
  function broadcast(){emitHost();for(const conn of clients.values()){sendSnapshot(conn.conn);}}
  function hostCheck(code){if(!ownRoom||ownRoom.code!==code||ownRoom.hostUid!==uid)throw new Error('Only the original host tab can change the game.');}
  function safeAnswer(sub){return sub?{uid:sub.uid,qKey:sub.qKey,response:sub.response,clueCount:sub.clueCount,submittedAt:sub.submittedAt}:null;}
  function hostHandle(conn,m){
    if(!m||typeof m!=='object')return;
    let rec=clients.get(conn.peer);if(!rec)return;
    if(m.type==='hello') {rec.uid=String(m.uid||'').slice(0,90);rec.role=m.role==='screen'?'screen':'player';sendSnapshot(conn);return;}
    if(m.type!=='request'||!m.reqId)return;
    const reply=(ok,data)=>conn.open&&conn.send({type:'response',reqId:m.reqId,ok,data:ok?data:undefined,error:ok?undefined:String(data)});
    try{
      if(m.action==='join'){
        const name=String(m.name||'').trim().slice(0,22);
        if(!rec.uid||name.length<2)throw new Error('Please enter a nickname of at least two characters.');
        if(roster.some(p=>p.uid!==rec.uid&&p.name.toLocaleLowerCase()===name.toLocaleLowerCase()))throw new Error('That nickname is taken. Please choose another.');
        if(!roster.some(p=>p.uid===rec.uid)){
          if(roster.length>=30)throw new Error('Room full. The host has reached the player capacity.');
          roster.push({uid:rec.uid,name,score:0,joinedAt:Date.now()});
        }
        reply(true,true);broadcast();return;
      }
      if(m.action==='submit'){
        const qKey=String(m.qKey||''); if(!rec.uid||!roster.some(p=>p.uid===rec.uid))throw new Error('Join the room first.');
        if(qKey!==ownRoom.qKey||!(ownRoom.phase==='collect'||(ownRoom.phase==='reveal'&&ownRoom.questionType==='person')))throw new Error('Answers are closed.');
        if(ownRoom.questionType==='person'&&Number(m.clueCount)!==ownRoom.revealCount)throw new Error('A new clue appeared; please retry your submission.');
        if(ownRoom.questionType==='fake'&&!['A','B','C','D'].includes(m.response))throw new Error('Invalid answer.');
        if(String(m.response||'').trim().length<1||String(m.response).length>240)throw new Error('Enter an answer under 240 characters.');
        if((answers[qKey]||[]).some(s=>s.uid===rec.uid))throw new Error('You already locked your answer.');
        const item={uid:rec.uid,qKey,response:String(m.response),clueCount:Number(m.clueCount),points:0,submittedAt:Date.now()};
        (answers[qKey]||=([])).push(item);reply(true,safeAnswer(item));broadcast();return;
      }
      throw new Error('Unknown request.');
    }catch(e){reply(false,e.message||String(e));}
  }
  async function openHost(code, restored){
    let peer = new Peer(hostPeerId(code),{debug:0});
    await new Promise((resolve,reject)=>{
      const t=setTimeout(()=>{peer.destroy();reject(new Error('Host connection timed out.'))},14000);
      const onError=e=>{clearTimeout(t);peer.destroy();reject(new Error(e.type==='unavailable-id'?'This room code is taken. Try hosting again.':e.message||'Unable to open host connection.'));};
      peer.once('error',onError);
      peer.once('open',()=>{clearTimeout(t);peer.removeListener('error',onError);resolve();});
    });
    hostPeer=peer;
    peer.on('connection',conn=>{
      clients.set(conn.peer,{conn,uid:'',role:'player'});
      conn.on('data',m=>hostHandle(conn,m));
      conn.on('open',()=>sendSnapshot(conn));
      conn.on('close',()=>clients.delete(conn.peer));
      conn.on('error',()=>clients.delete(conn.peer));
    });
    peer.on('disconnected',()=>{if(!peer.destroyed)peer.reconnect();});
    if(restored){ownRoom=restored.room;roster=restored.roster||[];answers=restored.answers||{};}
    else {ownRoom=defaultRoom(code);roster=[];answers={};}
    emitHost();return code;
  }
  async function beginClient(code){
    if(ownRoom?.code===code)return;
    if(connectingCode===code&&link?.open)return;
    connectingCode=code;
    if(!clientPeer||clientPeer.destroyed){clientPeer=new Peer(undefined,{debug:0});await new Promise((resolve,reject)=>{
      if(clientPeer.open)return resolve();
      const t=setTimeout(()=>reject(new Error('Connection timed out.')),14000);
      clientPeer.once('open',()=>{clearTimeout(t);resolve();});
      clientPeer.once('error',e=>{clearTimeout(t);reject(e);});
    });}
    if(link?.open)link.close();
    link=clientPeer.connect(hostPeerId(code),{reliable:true,serialization:'json'});
    return new Promise((resolve,reject)=>{
      let done=false;
      const t=setTimeout(()=>{if(!done){done=true;reject(new Error('Could not find the host. Check the room code and keep the host page open.'));}},11000);
      link.on('open',()=>{
        link.send({type:'hello',uid,role:url.searchParams.has('screen')?'screen':'player'});
        if(!done){done=true;clearTimeout(t);resolve();}
      });
      link.on('data',m=>{
        if(m?.type==='snapshot'){
          remoteRoom=m.room;remotePlayers=m.players||[];remoteSubmission=m.ownSubmission||null;
          emit('room',code,remoteRoom);emit('players',code,[...remotePlayers]);emit('own',`${code}-${remoteRoom.qKey}`,remoteSubmission);
        } else if(m?.type==='response'){
          const item=pending.get(m.reqId);if(!item)return;clearTimeout(item.t);pending.delete(m.reqId);m.ok?item.resolve(m.data):item.reject(new Error(m.error||'Host declined the request.'));
        }
      });
      link.on('close',()=>{
        if(reconnectTimer)clearTimeout(reconnectTimer);
        if(!hostPeer){reconnectTimer=setTimeout(()=>{beginClient(code).catch(()=>{});},2200);}
      });
      link.on('error',e=>{if(!done){done=true;clearTimeout(t);reject(e);}});
    });
  }
  function sendRequest(code,action,data){
    return new Promise(async (resolve,reject)=>{
      try{
        if(!link?.open)await beginClient(code);
        const reqId=`r${++msgNo}`;
        const t=setTimeout(()=>{pending.delete(reqId);reject(new Error('Host did not respond. Check the connection.'));},9000);
        pending.set(reqId,{resolve,reject,t});link.send({type:'request',reqId,action,...data});
      }catch(e){reject(e);}
    });
  }
  if(isHostRoute&&roomCode){
    try{
      const restored=JSON.parse(localStorage.getItem(roomStorage(roomCode))||'null');
      if(restored?.room?.hostUid===uid)await openHost(roomCode,restored);
      else throw new Error('This host session belongs to the browser that created the room. Return to that browser.');
    }catch(e){throw e;}
  }
  return {
    uid,demo:false,
    async createRoom(){for(let i=0;i<5;i++){const code=randomId();try{return await openHost(code,false);}catch(e){if(!e.message.includes('taken'))throw e;}}throw new Error('Unable to get a free room code.');},
    async room(code){if(ownRoom?.code===code)return ownRoom;await beginClient(code);return remoteRoom;},
    async myPlayer(code){if(ownRoom?.code===code)return roster.find(p=>p.uid===uid)||null;if(!remoteRoom)await beginClient(code);return remotePlayers.find(p=>p.uid===uid)||null;},
    async getPlayers(code){if(ownRoom?.code===code)return [...roster];return [...remotePlayers];},
    watchRoom(code,cb){const off=watchers('room',code,cb);if(ownRoom?.code===code)cb(ownRoom);else if(remoteRoom?.code===code)cb(remoteRoom);else beginClient(code).catch(e=>{window.dispatchEvent(new CustomEvent('wtf-error',{detail:e.message}));cb(null);});return off;},
    watchPlayers(code,cb){const off=watchers('players',code,cb);if(ownRoom?.code===code)cb([...roster]);else if(remoteRoom?.code===code)cb([...remotePlayers]);return off;},
    watchSubmissions(code,qKey,cb){const key=`${code}-${qKey}`,off=watchers('subs',key,cb);if(ownRoom?.code===code)cb([...(answers[qKey]||[])]);return off;},
    watchOwnSubmission(code,qKey,cb){const key=`${code}-${qKey}`,off=watchers('own',key,cb);if(remoteRoom?.code===code&&remoteRoom.qKey===qKey)cb(remoteSubmission);return off;},
    async joinRoom(code,name){return sendRequest(code,'join',{name});},
    async updateRoom(code,patch){hostCheck(code);ownRoom={...ownRoom,...patch,stateRevision:ownRoom.stateRevision+1};broadcast();},
    async submit(code,qKey,response,clueCount){return sendRequest(code,'submit',{qKey,response,clueCount});},
    async gradeRound(code,q,grading,answer){hostCheck(code);if(ownRoom.scoreDone===q.id)return;
      ownRoom.phase='grading';broadcast();
      const subs=answers[q.id]||[];
      roster=roster.map(p=>({...p,score:p.score+grading(q,subs.find(s=>s.uid===p.uid))}));
      answers[q.id]=subs.map(s=>({...s,points:grading(q,s)}));
      const counts=q.type==='fake'?Object.fromEntries('ABCD'.split('').map(l=>[l,subs.filter(s=>s.response===l).length])):{};
      ownRoom={...ownRoom,phase:'result',scoreDone:q.id,publicAnswer:answer,voteCounts:counts,responseCount:subs.length,stateRevision:ownRoom.stateRevision+1};broadcast();
    },
    async overrideScore(code,qKey,playerUid,newPoints){hostCheck(code);const sub=(answers[qKey]||[]).find(s=>s.uid===playerUid);if(!sub)throw new Error('No submitted answer to grade.');
      const delta=newPoints-(sub.points||0);sub.points=newPoints;roster=roster.map(p=>p.uid===playerUid?{...p,score:p.score+delta}:p);broadcast();
    }
  };
}
