import { QUIZ, ROUND_NAMES, ROUND_DESCRIPTIONS } from './quiz.js';
import { makeBackend, IS_DEMO } from './backend.js';
const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const params = new URLSearchParams(location.search);
const view = params.has('host') ? 'host' : params.has('screen') ? 'screen' : params.has('join') ? 'player' : 'welcome';
let mode = view, code = (params.get(view === 'host' ? 'host' : view === 'screen' ? 'screen' : 'join') || '').toUpperCase();
let backend, room = null, players = [], submissions = [], own = null, joined = false, activeQKey = '', loading = false, hostKey = null, error = '', draft = '', picked = '', lastPhase = '', ready = false;
let unsubRoom = () => {}, unsubPlayers = () => {}, unsubSubs = () => {}, unsubOwn = () => {};
const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roundName = n => ROUND_NAMES[n] || '';
const qAt = () => QUIZ[Math.max(0,Math.min(17,Number(room?.qIndex)||0))];
const phaseDesc = p => ({lobby:'Lobby',intro:'Question on screen',reveal:'Revealing clues',collect:'Answers open',grading:'Checking answers',result:'Answer revealed',leaderboard:'Segment results',finished:'Game complete'})[p] || p;
const fmt = n => (n||0).toLocaleString('en-US');
const stamp = () => new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
const getLink = (kind, roomCode=code) => `${location.origin}${location.pathname}?${kind}=${roomCode}`;
const icon = (s) => `<span aria-hidden="true">${s}</span>`;
function flash(message) {toastEl.textContent=message;toastEl.classList.add('show');clearTimeout(flash.timer);flash.timer=setTimeout(()=>toastEl.classList.remove('show'),3500);}
function nav(nextMode, roomCode='') { mode=nextMode; code=roomCode; const part = nextMode==='welcome'?'':`?${nextMode==='player'?'join':nextMode}=${roomCode}`; history.pushState({},'',location.pathname+part); unsubscribe(); subscribe(); }
function unsubscribe() {unsubRoom();unsubPlayers();unsubSubs();unsubOwn();subscribedToPlayers=false;unsubRoom=unsubPlayers=unsubSubs=unsubOwn=()=>{};activeQKey='';room=null;players=[];submissions=[];own=null;joined=false;draft='';picked='';}
function baseHead(right='') { return `<header class="topbar"><a href="${location.pathname}" class="brand"><span class="brand-symbol">?</span> THE GREAT INDIAN <span class="logo-separator">WTF</span></a><span class="badge">${right||'18 QUESTIONS · 3 ROUNDS'}</span></header>`; }
function localBadge() {return backend?.demo?'<span class="badge demo-pill">REHEARSAL MODE · SAME BROWSER ONLY</span>':'<span class="badge"><i class="live-dot"></i> LIVE MULTIPLAYER</span>';}
function renderWelcome() {
 return `<div class="shell">${baseHead('25 IDIOTS. ONE WINNER.')}
 <section class="hero"><div class="eyebrow"><span class="live-dot"></span> AN UNREASONABLE GAME NIGHT EXPERIENCE</div>
 <h1 class="mega">THREE ROUNDS.<br><em>ZERO</em> COMMON SENSE.</h1>
 <p class="lede">The Great Indian WTF Quiz is a real-time game show for 25 friends. You control every dramatic reveal. They play on their phones. Nobody sees the scoreboard until the end of each round.</p>
 <div class="actions"><button class="button primary" data-action="create">${icon('⚡')} Host a new game</button><a class="button secondary" href="#join-section">Join a game ↗</a></div>
 <div style="margin-top:20px">${localBadge()}</div></section>
 <div class="grid cols3 feature-grid"><div class="round-card"><div class="small-label">ROUND 01 · 6 QUESTIONS</div><h2>3 TRUE.<br>1 BULLSHIT.</h2><p class="muted">One-click A, B, C, D reveals. Find the fake story.</p></div><div class="round-card"><div class="small-label">ROUND 02 · 6 QUESTIONS</div><h2>WHAT THE<br>ACTUAL FUCK?!</h2><p class="muted">Write in the unimaginable ending to real headlines.</p></div><div class="round-card"><div class="small-label">ROUND 03 · 6 QUESTIONS</div><h2>WHO THE<br>HELL AM I?</h2><p class="muted">Five clues. One celebrity. Risk it early for more points.</p></div></div>
 <section class="panel flat join-home" id="join-section"><div class="small-label">ALREADY HAVE A ROOM CODE?</div><form id="join-code-form" class="join-form"><input class="input" name="code" placeholder="Enter six-character code" maxlength="6" autocomplete="off" required/><button class="button pink" type="submit">Join party →</button></form></section>
 <footer class="footer">Host-driven presentation · 25-player friendly · Segment-only leaderboards · ${backend?.demo?'Demo tabs sync via BroadcastChannel':'Live peer-to-peer sync'}</footer></div>`;
}
function renderAwait() {return `<div class="shell narrow">${baseHead(code)}<div class="panel"><div class="waiting"><span class="spinner"></span><h2>Joining the madness…</h2><p class="muted">Connecting to room ${esc(code)}</p></div></div></div>`;}
function joinBox() {
 return `<div class="shell narrow">${baseHead(code)}<div class="panel join-panel"><div class="eyebrow">ROOM ${esc(code)} · YOU'VE BEEN INVITED</div><h1 class="title">WHO THE HELL ARE YOU?</h1><p class="muted">Pick a nickname the others will recognize. You don't need an account.</p><form id="nickname-form" class="stack"><input class="input" name="nickname" maxlength="22" minlength="2" placeholder="Your slightly embarrassing nickname" required autofocus/><button class="button primary block" type="submit">I'm in. Let's go →</button></form><p class="small-muted">Your responses stay hidden from other players until the host reveals results. Scores appear only at each segment break.</p></div><p class="center muted tiny">${backend.demo?'Demo mode only works across tabs in this browser.':'Live, synchronized game · Keep this tab open.'}</p></div>`;
}
function lobbyContent(isScreen=false) {
 const count = mode==='host'?players.length:(room?.playerCount||0);
 return `<div class="panel lobby-panel"><div class="eyebrow"><span class="live-dot"></span> LOBBY OPEN</div><h1 class="title ${isScreen?'large':''}">25 FRIENDS. <span class="accent">ONE BRAIN CELL.</span></h1>
 <p class="muted">Tell everyone to open this link and enter a nickname.</p>
 <div class="room-code">${esc(code)}</div><div class="join-url">${esc(getLink('join'))}</div>
 <div class="qr-wrap"><img class="join-qr" src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=6&data=${encodeURIComponent(getLink('join'))}" alt="QR code for players to join" loading="lazy"/><span class="small-muted">Scan to join · Or enter the room code manually</span></div>
 <div class="actions" style="margin-top:18px"><span class="score-pill">${count} player${count===1?'':'s'} connected</span>${mode==='host'?`<button class="button small secondary" data-action="copy-link">Copy join link</button><button class="button small secondary" data-action="open-screen">Open TV screen ↗</button>`:''}</div>
 ${mode==='host'?`<div class="names-list">${players.length?players.map(p=>`<span class="badge">${esc(p.name)}</span>`).join(''):'No players yet. Open a player tab to rehearse.'}</div><div class="actions"><button class="button primary" data-action="start" ${loading?'disabled':''}>Start the show →</button></div>`:isScreen?'<div class="waiting-icon" style="margin-top:22px">🎉</div>':'<p class="muted">Waiting for the host to begin…</p>'}</div>`;
}
function progress(q, count) {return `<div class="progress">${Array.from({length:count},(_,i)=>`<i class="${(q.type==='fake'?room.revealCount:room.revealCount)>i?'done':''}"></i>`).join('')}</div>`;}
function questionBlock(q, screen=false, result=false) {
 const n=Number(room.qIndex)+1, round=q.round;
 return `<div class="question-layout"><div class="row space"><span class="label">ROUND ${String(round).padStart(2,'0')} · ${roundName(round)}</span><span class="q-marker">QUESTION ${n} / 18</span></div>
 <h1 class="title ${screen?'wide-title':''}">${esc(q.title)}</h1><div class="question-body">${esc(q.stem)}</div>
 ${q.type==='fake'?`${progress(q,4)}<div class="stack" style="margin-top:14px">${q.options.slice(0,room.phase==='intro'?0:room.revealCount).map((v,i)=>`<div class="option ${result && hostKey && hostKey[q.id]?.correct===String.fromCharCode(65+i)?'correct':''}"><span class="option-letter">${String.fromCharCode(65+i)}</span><span class="option-text">${esc(v)}</span></div>`).join('')}</div>${room.revealCount===0?'<p class="muted">The first option is coming…</p>':''}`:''}
 ${q.type==='person'?`${progress(q,5)}<div class="stack" style="margin-top:16px">${q.clues.slice(0,room.revealCount).map((v,i)=>`<div class="clue"><div><div class="clue-number">${i+1}</div><div class="clue-points">${500-100*i} PTS</div></div><div class="clue-text">${esc(v)}</div></div>`).join('')}</div>${room.revealCount===0?'<p class="muted">Waiting for the first clue…</p>':''}`:''}
 ${room.phase==='collect'?'<span class="badge" style="margin-top:18px">✍ ANSWERS OPEN</span>':''}
 ${room.phase==='grading'?'<span class="badge" style="margin-top:18px">Checking responses…</span>':''}
 ${room.phase==='result'?`<div class="result-panel"><div class="small-label">THE REVEAL</div><div class="result-answer">${esc(room.publicAnswer||'')}</div>${mode==='host' && hostKey?.[q.id]?.explanation?`<p class="muted">${esc(hostKey[q.id].explanation)}</p>`:''}${mode==='host' && hostKey?.[q.id]?.joke?`<p class="small-muted">🎤 Host line: ${esc(hostKey[q.id].joke)}</p>`:''}</div>`:''}
 </div>`;
}
function leaderboardHTML() {
 const board=room?.leaderboard||[];
 const round=room?.roundBreak||qAt().round;
 // Projector: display all 25 player scores in two compact columns without scrolling.
 // Player phones: preserve the normal single-column list, highlighting that player.
 const tvGrid=mode==='screen' && board.length>9;
 const rows=Math.ceil(board.length/2);
 return `<div class="scoreboard"><div class="eyebrow">${room.phase==='finished'?'THE FINAL RESULTS':`ROUND ${round} COMPLETE`}</div><h1 class="title" style="font-size:clamp(40px,5vw,76px)">${room.phase==='finished'?'THE BIGGEST BRAIN CELL.':'SCOREBOARD UNLOCKED.'}</h1>
 <p class="muted">${esc(roundName(round))} · All scores revealed together. <b>+ROUND</b> = points earned in this segment; <b>TOTAL</b> = cumulative score.</p>
 <div class="stack leaderboard-list ${tvGrid?'tv-leaderboard':''}" ${tvGrid?`style="--leaderboard-rows:${rows}"`:''}>${board.length?board.map((p,i)=>`<div class="rank ${i===0?'champion':''} ${mode==='player'&&p.uid===backend.uid?'my-rank':''}"><span class="position">${i===0?'🏆':String(i+1).padStart(2,'0')}</span><span class="name">${esc(p.name)}</span><span class="round-gain">+${fmt(p.roundPoints)} ROUND</span><span class="score">${fmt(p.score)} <small>TOTAL</small></span></div>`).join(''):'<div class="waiting">No one joined yet.</div>'}</div>
 ${room.phase==='finished'?'<div class="final-confetti">🎊 🏆 🎊</div>':'<p class="small-muted">All 25 players stay on this screen until the host starts the next segment.</p>'}</div>`;
}
function playerControls(q) {
 if (!joined) return joinBox();
 if (room.phase==='lobby') return `<div class="shell narrow">${baseHead(code)}${lobbyContent()}</div>`;
 if (room.phase==='leaderboard'||room.phase==='finished') return `<div class="shell narrow">${baseHead(code)}<div class="panel">${leaderboardHTML()}</div></div>`;
 const answered=Boolean(own), accept = room.phase==='collect'||(q.type==='person'&&room.phase==='reveal'&&room.revealCount>0);
 return `<div class="shell narrow">${baseHead(code)}<div class="panel"><div class="row space"><span class="badge">${esc(phaseDesc(room.phase))}</span><span class="small-muted">Room ${esc(code)}</span></div>${questionBlock(q)}
 ${room.phase==='result'?'<p class="small-muted">Next question starts when the host advances. Scores are still hidden.</p>':''}
 ${!answered&&accept?`${q.type==='fake'?`<div class="row" style="margin-top:23px"><span class="label">LOCK IN THE FAKE STORY</span></div><div class="pick-grid">${['A','B','C','D'].map(k=>`<button class="pick ${picked===k?'selected':''}" data-action="pick" data-choice="${k}">${k}</button>`).join('')}</div>`:
 `<div class="row" style="margin-top:23px"><span class="label">${q.type==='twist'?'YOUR RIDICULOUS THEORY':'YOUR CELEBRITY GUESS'}</span><span class="small-muted">${q.type==='person'?`${600-room.revealCount*100} pts available`:'Type your answer'}</span></div><form id="answer-form" class="stack"><textarea id="guess-text" class="textarea" maxlength="240" placeholder="${q.type==='twist'?'What do you think really happened?':'Who is it? One guess only.'}">${esc(draft)}</textarea><button class="button primary block" ${loading?'disabled':''} type="submit">Lock answer ${q.type==='person'?`for ${600-room.revealCount*100} pts`:''} →</button></form>`}
 ${q.type==='fake'?`<button class="button primary block" style="margin-top:14px" data-action="submit-pick" ${!picked||loading?'disabled':''}>Lock in ${esc(picked||'my answer')} →</button>`:''}`:''}
 ${answered?`<div class="locked"><div class="lock-icon">✓</div><div><b>ANSWER LOCKED</b><p>${esc(own.response)}${q.type==='person'?` · Submitted at clue ${own.clueCount}`:''}</p><small>Wait for the host. No changing your mind now.</small></div></div>`:!accept&&room.phase!=='result'&&room.phase!=='grading'?'<div class="waiting-note">Keep your eyes on the big screen. The host is building the suspense…</div>':''}
 </div><div class="footer">Your points won't be displayed until the end of this round.</div></div>`;
}
function screenView() {
 if (!room) return renderAwait();
 if (room.phase==='lobby') return `<div class="shell screen-shell">${baseHead(code)}${lobbyContent(true)}</div>`;
 if (room.phase==='leaderboard'||room.phase==='finished') return `<div class="shell screen-shell">${baseHead('SEGMENT SCORE REVEAL')}<div class="panel">${leaderboardHTML()}</div></div>`;
 return `<div class="shell screen-shell">${baseHead(`ROUND ${qAt().round} · ${code}`)}<div class="panel screen-panel">${questionBlock(qAt(),true)}</div><div class="screen-footer"><span>${esc(ROUND_DESCRIPTIONS[qAt().round])}</span><span>${room.phase==='collect'?'VOTING OPEN':room.phase==='reveal'?'CLUE REVEAL':'HOST IN CONTROL'}</span></div></div>`;
}
function hostStatus(q) {
 if (room.phase==='lobby') return `Start the show`;
 if (room.phase==='intro') return q.type==='fake'?'Reveal option A':q.type==='twist'?'Open write-in answers':'Reveal clue 1 (500 pts)';
 if (room.phase==='reveal') return q.type==='fake'?(room.revealCount<4?`Reveal option ${'ABCD'[room.revealCount]}`:'Open voting'):q.type==='person'?(room.revealCount<5?`Reveal clue ${room.revealCount+1} (${500-room.revealCount*100} pts)`:'Reveal celebrity'):'Open answers';
 if (room.phase==='collect') return 'Close voting + reveal answer';
 if (room.phase==='result') return Number(room.qIndex)===5||Number(room.qIndex)===11||Number(room.qIndex)===17?'Reveal segment scoreboard':'Next question';
 if (room.phase==='leaderboard') return Number(room.qIndex)===17?'Finish game':'Start next segment';
 if (room.phase==='finished') return 'Finished';
 return 'Checking…';
}
function hostControls() {
 const q=qAt(), n=Number(room.qIndex)+1, isResult=room.phase==='result';
 return `<section class="panel host-controls"><div class="row space"><div class="round-marker"><span class="live-dot"></span><span class="label">HOST CONTROL PANEL</span></div><span class="badge">${n}/18</span></div>
 <h2 class="smalltitle" style="margin:16px 0 6px">${esc(q.title)}</h2><p class="small-muted">${esc(phaseDesc(room.phase))} · ${esc(roundName(q.round))}</p>
 ${room.phase==='lobby'?`<div class="room-code" style="font-size:43px;margin:12px 0">${esc(code)}</div><div class="share-row"><button class="button small secondary" data-action="copy-link">Copy player link</button><button class="button small secondary" data-action="open-screen">Open TV view ↗</button></div><div class="names-list">${players.map(p=>`<span class="badge">${esc(p.name)}</span>`).join('')}</div>`:''}
 <div class="actions" style="margin-top:24px"><button class="button primary block big-next" data-action="advance" ${loading||room.phase==='finished'?'disabled':''}>${esc(hostStatus(q))} <span>→</span></button></div>
 ${room.phase!=='lobby'&&room.phase!=='leaderboard'&&room.phase!=='finished'?`<div class="row space" style="margin-top:15px"><button class="button small ghost" data-action="undo" ${room.phase==='result'||loading?'disabled':''}>← Undo last reveal</button><span class="small-muted">${q.type==='fake'?`Options: ${room.revealCount}/4`:q.type==='person'?`Clues: ${room.revealCount}/5`:'Write-in question'}</span></div>`:''}
 <hr class="divider"/>
 <div class="grid cols2"><div class="mini-stat"><div class="small-label">CONNECTED</div><div class="player-count">${players.length}</div></div><div class="mini-stat"><div class="small-label">ANSWERED THIS Q</div><div class="player-count">${submissions.length}<span class="muted" style="font-size:14px"> / ${players.length}</span></div></div></div>
 <hr class="divider"/>
 <div class="row space"><span class="label">HOST TOOLS</span></div><div class="share-row"><button class="button small secondary" data-action="copy-link">Copy link</button><button class="button small secondary" data-action="open-screen">TV screen ↗</button><button class="button small secondary" data-action="fullscreen">Fullscreen</button></div>
 ${backend.demo?'<p class="mobile-warning">Rehearsal mode: tabs on the same browser sync; phones elsewhere will not connect until Firebase is configured.</p>':''}
 ${q.type==='twist'?'<p class="small-muted">For written answers: review automated scores below and override close answers before the segment scoreboard. 200 exact / 100 partial.</p>':''}
 </section>`;
}
function submissionsHost(q) {
 const items=[...submissions].sort((a,b)=>(a.submittedAt||0)-(b.submittedAt||0));
 const canAdjust = room.phase==='result';
 const findName=id=>players.find(p=>p.uid===id)?.name||'Guest';
 return `<div class="panel flat"><div class="row space"><h2 class="smalltitle">Live answers</h2><span class="badge">${submissions.length} / ${players.length}</span></div>
 <p class="small-muted">Hidden from everyone except you. You can read out the funniest wrong answers.</p>
 ${q.type==='fake'&&isFinishedVoting()?`<div class="counts">${'ABCD'.split('').map(k=>{const count=submissions.filter(s=>s.response===k).length;return `<div class="count-row"><b>${k}</b><div class="countbar"><i style="width:${players.length?100*count/players.length:0}%"></i></div><b>${count}</b></div>`}).join('')}</div>`:''}
 <div class="stack" style="max-height:540px;overflow-y:auto;margin-top:16px">${items.length?items.map(s=>`<div class="submission"><div style="min-width:0;flex:1"><div class="submission-name">${esc(findName(s.uid))} ${q.type==='person'?`· Clue ${s.clueCount}`:''}</div><div class="submission-text">${esc(s.response)}</div></div>
 ${canAdjust?`<div class="score-actions">${(q.type==='fake'?[0,100]:q.type==='twist'?[0,100,200]:[0,100,200,300,400,500]).map(pts=>`<button class="${s.points===pts?'active':''}" data-action="override" data-uid="${esc(s.uid)}" data-points="${pts}">${pts}</button>`).join('')}</div>`:'<span class="badge">Locked</span>'}</div>`).join(''):'<p class="muted">No answers submitted yet.</p>'}</div>
 ${room.phase==='result'?`<div class="row space" style="margin-top:15px"><span class="small-muted">Changes here affect the scoreboard at the end of the segment.</span></div>`:''}</div>`;
}
function isFinishedVoting() {return ['result','leaderboard','finished'].includes(room?.phase);}
function hostView() {
 if (!room) return renderAwait();
 if (room.hostUid!==backend.uid) return `<div class="shell narrow">${baseHead(code)}<div class="panel"><h1 class="title">Host access denied</h1><p class="muted">This room belongs to the browser that created it. Use the original host device, or join as a player.</p><a class="button secondary" href="${getLink('join')}">Join as a player</a></div></div>`;
 if (room.phase==='leaderboard'||room.phase==='finished') return `<div class="shell">${baseHead('HOST CONTROL')}<div class="host-layout"><section class="panel"><div class="small-label">ROUND ${room.roundBreak} · SCORE REVEAL</div>${leaderboardHTML()}</section>${hostControls()}</div></div>`;
 return `<div class="shell">${baseHead('YOU ARE THE QUIZMASTER')}<div class="host-layout"><div class="stack">${room.phase==='lobby'?lobbyContent():`<section class="panel">${questionBlock(qAt())}</section>`}${room.phase!=='lobby'?submissionsHost(qAt()):''}</div>${hostControls()}</div><div class="footer">Tip: press the <b>right arrow</b> or <b>space</b> to advance the game. Scores are published after Q6, Q12 and Q18 only.</div></div>`;
}
function render() {
 if (!ready) return;
 // Preserve mobile keyboard and cursor position when a live room update arrives
 // while the player is typing an answer.
 const focusedId=document.activeElement?.id;
 let selection=0;
 if(focusedId==='guess-text')selection=document.activeElement.selectionStart||0;
 if (error) {app.innerHTML=`<div class="shell narrow">${baseHead()}<div class="panel"><h1 class="title">Something went sideways.</h1><div class="error">${esc(error)}</div><div class="actions"><button class="button secondary" data-action="reset">Back to home</button></div></div></div>`;return;}
 app.innerHTML = mode==='welcome'?renderWelcome():!room?renderAwait():mode==='host'?hostView():mode==='screen'?screenView():playerControls(qAt());
 if(focusedId==='guess-text') {const field=document.getElementById('guess-text'); if(field){field.focus();field.setSelectionRange(selection,selection);}}
}
function watchSubmissions() {
 if (mode==='host' && room && room.hostUid===backend.uid && activeQKey!==room.qKey) {
  unsubSubs(); activeQKey=room.qKey; submissions=[];
  unsubSubs=backend.watchSubmissions(code,room.qKey, data=>{submissions=data||[];render();});
 }
 if (mode==='player' && joined && room && activeQKey!==room.qKey) {
  unsubOwn();activeQKey=room.qKey;own=null;picked='';draft='';
  unsubOwn=backend.watchOwnSubmission(code,room.qKey,s=>{own=s;render();});
 }
}
function subscribe() {
 if (mode==='welcome'){ready=true;render();return;}
 if (!code||!/^[A-Z2-9]{6}$/.test(code)){error='Please enter a valid six-character room code.';ready=true;render();return;}
 unsubRoom=backend.watchRoom(code,async state=>{
  const old=room?.phase;room=state;
  if (!state){error='This room does not exist, or the link is incorrect.';render();return;}
  if (mode==='host' && room.hostUid!==backend.uid){error='Host credentials not found in this browser. Return to the original host tab.';render();return;}
  if (mode==='player'&&!joined){try{const p=await backend.myPlayer(code); if(p){joined=true;}}catch(e){console.warn(e);}}
  if (mode==='host' && !hostKey){const mod=await import('./host-key.js');hostKey=mod.HOST_KEY;}
  if (mode==='host'&&!subscribedToPlayers){unsubPlayers=backend.watchPlayers(code, items=>{
    players=items||[]; render();
    if (room && (room.playerCount||0)!==players.length) backend.updateRoom(code,{playerCount:players.length}).catch(console.warn);
  }); subscribedToPlayers=true;}
  watchSubmissions();
  if (old!==room.phase && room.phase==='result' && mode==='screen') playSound('answer');
  ready=true;render();
 });
}
let subscribedToPlayers=false;
async function runAction(fn){if(loading)return;loading=true;try{await fn();}catch(e){console.error(e);flash(e.message||'Something went wrong.');}finally{loading=false;render();}}
async function advance() {
 const q=qAt(), phase=room.phase, cur=Number(room.qIndex);
 if(phase==='lobby') return backend.updateRoom(code,{phase:'intro',qIndex:0,qKey:QUIZ[0].id,questionType:QUIZ[0].type,revealCount:0,publicAnswer:'',scoreDone:''});
 if(phase==='intro') return backend.updateRoom(code,q.type==='twist'?{phase:'collect',revealCount:0}:{phase:'reveal',revealCount:1});
 if(phase==='reveal') {
   if(q.type==='fake' && room.revealCount<4) return backend.updateRoom(code,{revealCount:room.revealCount+1});
   if(q.type==='person' && room.revealCount<5) return backend.updateRoom(code,{revealCount:room.revealCount+1});
   if(q.type==='fake') return backend.updateRoom(code,{phase:'collect'});
   if(q.type==='person') return revealAnswer(q);
 }
 if(phase==='collect'||phase==='grading')return revealAnswer(q);
 if(phase==='result') {
   if([5,11,17].includes(cur)) return publishLeaderboard(q.round);
   return nextQuestion(cur+1);
 }
 if(phase==='leaderboard')return cur===17?backend.updateRoom(code,{phase:'finished'}):nextQuestion(cur+1);
}
async function revealAnswer(q) {
 if(!hostKey)throw new Error('Host answer key unavailable.');
 const mod=await import('./host-key.js'), k=hostKey[q.id];
 await backend.gradeRound(code,q,mod.grade,q.type==='fake'?`${k.correct} — ${k.answer}`:k.answer);
}
async function nextQuestion(i){const next=QUIZ[i];if(!next)return;await backend.updateRoom(code,{phase:'intro',qIndex:i,qKey:next.id,questionType:next.type,revealCount:0,publicAnswer:'',scoreDone:'',responseCount:0,voteCounts:{},leaderboard:[]});}
async function publishLeaderboard(round) {
 const previous=room.publishedScores||{};
 const currentPlayers=await backend.getPlayers(code);
 const sorted=[...currentPlayers].map(p=>({uid:p.uid,name:p.name,score:p.score||0,roundPoints:Math.max(0,(p.score||0)-(previous[p.uid]||0))})).sort((a,b)=>b.score-a.score||b.roundPoints-a.roundPoints||a.name.localeCompare(b.name));
 const nextScores=Object.fromEntries(sorted.map(p=>[p.uid,p.score]));
 await backend.updateRoom(code,{phase:'leaderboard',roundBreak:round,leaderboard:sorted,publishedScores:nextScores});
}
async function undo(){ const phase=room.phase,q=qAt();if(phase==='reveal'){if(room.revealCount>1)return backend.updateRoom(code,{revealCount:room.revealCount-1});return backend.updateRoom(code,{phase:'intro',revealCount:0});}if(phase==='collect')return backend.updateRoom(code,q.type==='fake'?{phase:'reveal',revealCount:4}:{phase:'intro',revealCount:0});}
function playSound(type){try{const ctx=new (window.AudioContext||window.webkitAudioContext)(),osc=ctx.createOscillator(),vol=ctx.createGain();osc.connect(vol);vol.connect(ctx.destination);osc.frequency.value=type==='answer'?280:650;vol.gain.setValueAtTime(.09,ctx.currentTime);vol.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.17);osc.start();osc.stop(ctx.currentTime+.18);}catch{}}
function checkHost() {if(mode!=='host'||!room||room.hostUid!==backend.uid)throw new Error('Host only action.');}
app.addEventListener('click', async e=>{
 const el=e.target.closest('[data-action]');if(!el)return;
 const action=el.dataset.action;
 if(action==='create')return runAction(async()=>{const newCode=await backend.createRoom();subscribedToPlayers=false;nav('host',newCode);});
 if(action==='reset'){error='';subscribedToPlayers=false;return nav('welcome');}
 if(action==='copy-link'){try{await navigator.clipboard.writeText(getLink('join'));flash('Join link copied. Send it to your friends!');}catch{prompt('Copy this player link:',getLink('join'));}return;}
 if(action==='open-screen'){window.open(getLink('screen'),'_blank','noopener');return;}
 if(action==='fullscreen'){const el=document.documentElement;if(!document.fullscreenElement)el.requestFullscreen?.();else document.exitFullscreen?.();return;}
 if(action==='advance'||action==='start')return runAction(async()=>{checkHost();await advance();});
 if(action==='undo')return runAction(async()=>{checkHost();await undo();});
 if(action==='pick'){picked=el.dataset.choice;render();return;}
 if(action==='submit-pick')return runAction(async()=>{if(!picked)throw new Error('Choose A, B, C or D.');await backend.submit(code,room.qKey,picked,room.revealCount);});
 if(action==='override')return runAction(async()=>{checkHost();await backend.overrideScore(code,room.qKey,el.dataset.uid,Number(el.dataset.points));flash(`Awarded ${el.dataset.points} points.`);});
});
app.addEventListener('submit', e=>{
 if(e.target.id==='join-code-form'){e.preventDefault();const value=new FormData(e.target).get('code').toString().trim().toUpperCase();error='';nav('player',value);return;}
 if(e.target.id==='nickname-form'){e.preventDefault();const name=String(new FormData(e.target).get('nickname')||'').trim();if(name.length<2)return flash('Choose a nickname with at least 2 characters.');runAction(async()=>{await backend.joinRoom(code,name);joined=true;watchSubmissions();});return;}
 if(e.target.id==='answer-form'){e.preventDefault();draft=document.getElementById('guess-text').value.trim();if(!draft)return flash('Type a guess before locking in.');runAction(async()=>{await backend.submit(code,room.qKey,draft,room.revealCount);});return;}
});
app.addEventListener('input',e=>{if(e.target.id==='guess-text')draft=e.target.value;});
window.addEventListener('keydown',e=>{if(mode==='host'&&(e.key==='ArrowRight'||e.key===' ')&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();if(!loading&&room&&room.phase!=='finished')runAction(async()=>{checkHost();await advance();});}});
window.addEventListener('wtf-error',e=>flash(e.detail));
window.addEventListener('popstate',()=>location.reload());
(async()=>{try{backend=await makeBackend();ready=true;subscribe();if(mode==='welcome')render();}catch(e){error=e.message||String(e);ready=true;render();}})();
