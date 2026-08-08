/* 調整用設定：時刻（秒）と判定半径はここだけを変更すれば調整できます。 */
const SETTINGS = {
  centerRadius: 0.12,       // フィールド半径に対する中央判定半径
  outerInnerRadius: 0.72,   // 外周判定の内側境界
  outerOuterRadius: 0.98,   // 外周判定の外側境界
  laneCenterX: 0.55,        // 左右担当レーンの中心X座標（フィールド半径比）
  laneCenterY: 0.55,        // 左右担当レーンの中心Y座標（フィールド半径比）
  laneRadius: 0.18,         // 担当レーン判定の半径
  hourglassZoneRadius: 0.14,
  hourglasses: [
    { id:'north', label:'北', x:0, y:-0.54 },
    { id:'southLeft', label:'南左', x:-0.42, y:0.38 },
    { id:'southRight', label:'南右', x:0.42, y:0.38 }
  ],
  mechanics: {
    earlyFire: { name:'早ファイガ', steps:[{area:'担当外周',action:'担当砂時計の外周側でファイガを捨てる',checkAt:4},{area:'砂時計直下',action:'砂時計直下から1歩外にリターンを設置',checkAt:7},{area:'中央',action:'中央で頭割り',checkAt:10},{area:'ビーム誘導',action:'担当砂時計でビームを外周へ誘導',checkAt:13},{area:'中央',action:'中央で頭割り',checkAt:16},{area:'砂時計直下',action:'リターン後、外を向いて視線を回避',checkAt:19}] },
    middleFire: { name:'中ファイガ', steps:[{area:'中央',action:'中央で頭割り',checkAt:4},{area:'砂時計直下',action:'砂時計直下から1歩外にリターンを設置',checkAt:7},{area:'ビーム誘導',action:'砂時計手前でファイガを捨てる',checkAt:10},{area:'中央',action:'中央で頭割り',checkAt:13},{area:'ビーム誘導',action:'担当砂時計のビームを外周へ誘導',checkAt:16},{area:'砂時計直下',action:'リターン後、外を向いて視線を回避',checkAt:19}] },
    lateFire: {
      name: '遅ファイガ',
      steps: [
        {area:'中央',action:'中央で頭割り',checkAt:4},{area:'ビーム誘導',action:'担当砂時計のビームを外周へ誘導',checkAt:7},{area:'中央',action:'中央で頭割り',checkAt:10},{area:'中央',action:'中央の床模様にリターンを設置',checkAt:13},{area:'担当外周',action:'担当砂時計の外周側でファイガを捨てる',checkAt:16},{area:'中央',action:'リターン後、外を向いて視線を回避',checkAt:19}
      ]
    },
    blizzard: { name:'ブリザガ', steps:[{area:'中央',action:'中央で頭割り',checkAt:4},{area:'砂時計直下',action:'砂時計直下から1歩外にリターンを設置',checkAt:7},{area:'中央',action:'中央でドーナツ範囲を発動',checkAt:10},{area:'ビーム誘導',action:'担当砂時計のビームを外周へ誘導',checkAt:13},{area:'中央',action:'中央で頭割り',checkAt:16},{area:'砂時計直下',action:'リターン後、外を向いて視線を回避',checkAt:19}] }
  }
};

// DOM参照とギミック状態管理
const el = Object.fromEntries(['arena','player','ghostPlayer','comparisonOverlay','hourglasses','autoPlayers','modeSelect','mechanicSelect','mechanicControl','roleSelect','roleControl','laneSelect','startButton','resetButton','retryButton','replayButton','debuffName','phaseText','countdown','targetStatus','targetText','actionText','feedback','stepList','resultPanel','results','scoreText'].map(id => [id, document.getElementById(id)]));
let mechanic = SETTINGS.mechanics.lateFire;
const state = { running:false, startTime:0, nextStep:0, results:[], position:{x:0,y:0}, pointerId:null, raf:0, assignments:{}, autoPieces:[], trace:[], idealTrace:[], beamRecords:[], lastTraceAt:0, rotation:'右回り', liveBeam:null, replaying:false };

function arenaRadius() { return el.arena.clientWidth / 2; }
function setPlayerPosition(x, y) { // x/y はフィールド中心を0とした半径比
  const d = Math.hypot(x,y); const capped = d > .96 ? .96 / d : 1;
  state.position = { x:x*capped, y:y*capped };
  el.player.style.left = `${50 + state.position.x * 50}%`;
  el.player.style.top = `${50 + state.position.y * 50}%`;
}
function resetPosition() { setPlayerPosition(0,0); }
function currentMode() { return el.modeSelect.value; }
function isSimulation() { return currentMode() === 'simulation'; }
function isGhost() { return currentMode() === 'ghost'; }

// プレイヤー移動（Pointer Eventsのため、マウスとタッチの両方に拡張しやすい）
function moveFromPointer(event) {
  const rect = el.arena.getBoundingClientRect();
  setPlayerPosition((event.clientX - (rect.left + rect.width/2)) / (rect.width/2), (event.clientY - (rect.top + rect.height/2)) / (rect.height/2));
}
el.player.addEventListener('pointerdown', event => { state.pointerId=event.pointerId; el.player.setPointerCapture(event.pointerId); moveFromPointer(event); });
el.player.addEventListener('pointermove', event => { if (event.pointerId === state.pointerId) moveFromPointer(event); });
el.player.addEventListener('pointerup', event => { if (event.pointerId === state.pointerId) state.pointerId=null; });
el.player.addEventListener('pointercancel', () => { state.pointerId=null; });

// 判定処理：駒の中心が定義済みの判定エリアに入っているかを確認する。
function selectedLaneName() { return el.laneSelect.value === 'left' ? '左下レーン' : '右下レーン'; }
function targetHourglass(side=el.laneSelect.value) { return SETTINGS.hourglasses.find(h => h.id === (side === 'left' ? 'southLeft' : 'southRight')); }
function hourglassNearPosition(side) { const h=targetHourglass(side); return {x:h.x*1.12,y:h.y*1.12}; }
function hourglassBeamPosition(side) { const h=targetHourglass(side); return {x:h.x*1.28,y:h.y*1.28}; }
function inArea(area) {
  const d = Math.hypot(state.position.x, state.position.y);
  if (area === '中央') return d <= SETTINGS.centerRadius;
  if (area === '砂時計直下') { const p=hourglassNearPosition(); return Math.hypot(state.position.x-p.x,state.position.y-p.y) <= SETTINGS.hourglassZoneRadius; }
  if (area === 'ビーム誘導') { const p=hourglassBeamPosition(); return Math.hypot(state.position.x-p.x,state.position.y-p.y) <= SETTINGS.hourglassZoneRadius; }
  if (area === '担当外周') {
    const sign = el.laneSelect.value === 'left' ? -1 : 1;
    const dx = state.position.x - sign * SETTINGS.laneCenterX;
    const dy = state.position.y - SETTINGS.laneCenterY;
    return d >= SETTINGS.outerInnerRadius && d <= SETTINGS.outerOuterRadius && Math.hypot(dx,dy) <= SETTINGS.laneRadius;
  }
  return false;
}
function resultFor(stepIndex) {
  const step = mechanic.steps[stepIndex];
  if (inArea(step.area)) return '正解';
  const next = mechanic.steps[stepIndex+1]; const previous = mechanic.steps[stepIndex-1];
  if (next && inArea(next.area)) return '移動が早すぎる';
  if (previous && inArea(previous.area)) return '移動が遅すぎる';
  return '不正解';
}
function showFeedback(text, kind='') { el.feedback.textContent=text; el.feedback.className=`feedback ${kind}`; }
function updateSteps() { el.stepList.innerHTML=mechanic.steps.map(s=>`<li>${s.area === '担当外周' ? '担当外周' : s.area}：${s.action}</li>`).join(''); }
function explodeAt(position) { const fx=document.createElement('i'); fx.className='explosion'; fx.style.left=`${50+position.x*50}%`; fx.style.top=`${50+position.y*50}%`; el.arena.append(fx); setTimeout(()=>fx.remove(),800); }
function setLiveBeam(playerPosition) { const source=targetHourglass(); const dx=playerPosition.x-source.x, dy=playerPosition.y-source.y; const length=Math.hypot(dx,dy)*50; const angle=Math.atan2(dy,dx)*180/Math.PI; if(!state.liveBeam){ state.liveBeam=document.createElement('i'); state.liveBeam.className='beam'; el.arena.append(state.liveBeam); } state.liveBeam.style.left=`${50+source.x*50}%`; state.liveBeam.style.top=`${50+source.y*50}%`; state.liveBeam.style.width=`${length}%`; state.liveBeam.style.transform=`translateY(-50%) rotate(${angle}deg)`; return {source:{x:source.x,y:source.y},target:{...playerPosition},angle}; }
function removeLiveBeam() { state.liveBeam?.remove(); state.liveBeam=null; }
// 開始・初期位置復帰時に、前回の軌跡や演出を残さない。
function clearVisualEffects() {
  removeLiveBeam();
  el.arena.querySelectorAll('.explosion').forEach(effect => effect.remove());
  el.comparisonOverlay.replaceChildren();
  el.comparisonOverlay.hidden=true;
  el.ghostPlayer.hidden=true;
  state.trace=[]; state.idealTrace=[]; state.beamRecords=[];
}
function renderHourglasses() { el.hourglasses.replaceChildren(); SETTINGS.hourglasses.forEach(h=>{ const clock=document.createElement('div'); clock.className=`hourglass ${state.rotation==='右回り'?'cw':'ccw'}`; clock.style.left=`${50+h.x*50}%`; clock.style.top=`${50+h.y*50}%`; clock.innerHTML=`<i class="clock-arrow"></i><span class="clock-label">${h.label}</span>`; el.hourglasses.append(clock); }); }
function setGhostPosition(pos) { el.ghostPlayer.style.left=`${50+pos.x*50}%`; el.ghostPlayer.style.top=`${50+pos.y*50}%`; }
function renderComparison() { const points=items=>items.map(p=>`${50+p.x*50},${50+p.y*50}`).join(' '); const beams=state.beamRecords.map(b=>`<line class="ideal-beam" x1="${50+b.source.x*50}" y1="${50+b.source.y*50}" x2="${50+b.ideal.x*50}" y2="${50+b.ideal.y*50}"/><line class="actual-beam" x1="${50+b.source.x*50}" y1="${50+b.source.y*50}" x2="${50+b.actual.x*50}" y2="${50+b.actual.y*50}"/>`).join(''); el.comparisonOverlay.innerHTML=`<polyline class="ideal" points="${points(state.idealTrace)}"/><polyline class="actual" points="${points(state.trace)}"/>${beams}`; el.comparisonOverlay.hidden=false; }
function lanePosition(side) { return {x:(side === 'left' ? -1 : 1)*SETTINGS.laneCenterX,y:SETTINGS.laneCenterY}; }
function areaPosition(area, side) { if(area==='中央') return {x:0,y:0}; if(area==='砂時計直下') return hourglassNearPosition(side); if(area==='ビーム誘導') return hourglassBeamPosition(side); return lanePosition(side); }
function assignSimulation() {
  const roles=['MT','ST','H1','H2']; const playerRole=el.roleSelect.value;
  const keys=['earlyFire','middleFire','lateFire','blizzard'];
  const playerKey=keys.splice(Math.floor(Math.random()*keys.length),1)[0];
  mechanic=SETTINGS.mechanics[playerKey]; state.assignments={[playerRole]:playerKey};
  roles.filter(r=>r!==playerRole).forEach((role,i)=>state.assignments[role]=keys[i]);
  el.player.textContent=playerRole; el.autoPlayers.replaceChildren(); state.autoPieces=[];
  roles.filter(r=>r!==playerRole).forEach((role,i)=>{ const piece=document.createElement('div'); piece.className='auto-player'; piece.innerHTML=`<span class="debuff">${SETTINGS.mechanics[state.assignments[role]].name}</span>${role}`; el.autoPlayers.append(piece); const side=i%2?'right':'left'; const obj={piece,role,side}; state.autoPieces.push(obj); moveAutoPiece(obj,0); });
}
function moveAutoPiece(auto, stepIndex) { const data=SETTINGS.mechanics[state.assignments[auto.role]]; const step=data.steps[Math.min(stepIndex,data.steps.length-1)]; const pos=areaPosition(step.area,auto.side); auto.position=pos; auto.piece.style.left=`${50+pos.x*50}%`; auto.piece.style.top=`${50+pos.y*50}%`; }
function updateAutoPieces(stepIndex) { state.autoPieces.forEach(auto=>{ moveAutoPiece(auto,stepIndex); explodeAt(auto.position); }); }

// タイマー管理とUI表示
function renderStepList() { [...el.stepList.children].forEach((item,i) => item.className = i < state.nextStep ? 'done' : i === state.nextStep ? 'active' : ''); }
function update() {
  if (!state.running) return;
  const elapsed = (performance.now()-state.startTime)/1000;
  const step = mechanic.steps[state.nextStep];
  if (elapsed - state.lastTraceAt >= .1) { state.trace.push({...state.position,time:elapsed}); state.lastTraceAt=elapsed; }
  const ideal=areaPosition(step.area,el.laneSelect.value);
  if (isGhost()) setGhostPosition(ideal);
  if(!state.idealTrace.length || elapsed-state.idealTrace[state.idealTrace.length-1].time>=.1) state.idealTrace.push({...ideal,time:elapsed});
  if (step.area === 'ビーム誘導') setLiveBeam(state.position); else removeLiveBeam();
  const remain = Math.max(0, step.checkAt-elapsed);
  el.countdown.textContent = currentMode() === 'noCountdown' ? '非表示' : `${remain.toFixed(1)} 秒`;
  const displayArea = step.area === '担当外周' ? selectedLaneName() : step.area;
  el.phaseText.textContent = `${displayArea} 判定`; el.targetText.textContent = displayArea;
  el.actionText.textContent = step.action;
  if (elapsed >= step.checkAt) {
    const judgement = resultFor(state.nextStep);
    state.results.push({ ...step, displayArea, judgement, time:elapsed });
    showFeedback(`${displayArea}：${judgement}`, judgement === '正解' ? 'good' : 'bad');
    explodeAt(state.position);
    if (step.area === 'ビーム誘導') { const source=targetHourglass(); const ideal=areaPosition('ビーム誘導',el.laneSelect.value); state.beamRecords.push({source:{x:source.x,y:source.y},ideal,actual:{...state.position},result:judgement==='正解'?'成功':'失敗'}); showFeedback(`ビーム誘導：${judgement==='正解'?'成功':'失敗'}`,judgement==='正解'?'good':'bad'); }
    state.nextStep++;
    if (isSimulation()) updateAutoPieces(state.nextStep);
    if (state.nextStep >= mechanic.steps.length) { finish(); return; }
  }
  renderStepList(); state.raf=requestAnimationFrame(update);
}
function startPractice() {
  cancelAnimationFrame(state.raf); clearVisualEffects(); if(isSimulation()) assignSimulation(); else { mechanic=SETTINGS.mechanics[el.mechanicSelect.value]; el.player.textContent='H2'; el.autoPlayers.replaceChildren(); } state.running=true; state.replaying=false; state.startTime=performance.now(); state.nextStep=0; state.results=[]; state.trace=[{...state.position,time:0}]; state.lastTraceAt=0; state.rotation=Math.random()<.5?'右回り':'左回り'; renderHourglasses(); el.ghostPlayer.hidden=!isGhost();
  el.resultPanel.hidden=true; el.debuffName.textContent=mechanic.name; showFeedback('練習開始。');
  el.targetStatus.hidden = currentMode() === 'combat' || currentMode() === 'simulation';
  el.actionText.hidden = currentMode() === 'combat' || currentMode() === 'simulation';
  if(isGhost()) showFeedback(`成功ゴーストを表示中。砂時計は${state.rotation}です。`);
  updateSteps(); renderStepList(); update();
}
function finish() {
  state.running=false; removeLiveBeam(); el.countdown.textContent='完了'; el.phaseText.textContent='判定終了';
  const correct=state.results.filter(r=>r.judgement==='正解').length; const score=Math.round(correct/mechanic.steps.length*100);
  el.results.innerHTML=state.results.map(r=>`<div class="result-row"><span>${r.displayArea || r.area}</span><strong class="${r.judgement==='正解'?'ok':'ng'}">${r.judgement}（${r.time.toFixed(1)}秒）</strong></div>`).join('');
  el.scoreText.textContent=`Score: ${score} / 100`; el.resultPanel.hidden=false;
  if(isGhost() || state.beamRecords.length) renderComparison();
}
function replayGhost() {
  if(!state.trace.length || state.replaying) return;
  state.replaying=true; el.ghostPlayer.hidden=false; el.comparisonOverlay.hidden=true;
  const duration=Math.max(state.trace.at(-1)?.time||0,state.idealTrace.at(-1)?.time||0,1); const started=performance.now();
  const pointAt=(trace,time)=>trace.reduce((best,p)=>Math.abs(p.time-time)<Math.abs(best.time-time)?p:best,trace[0]);
  function frame() { const time=Math.min((performance.now()-started)/1000,duration); const actual=pointAt(state.trace,time); const ideal=pointAt(state.idealTrace,time); if(actual) setPlayerPosition(actual.x,actual.y); if(ideal) setGhostPosition(ideal); if(time<duration) requestAnimationFrame(frame); else { state.replaying=false; renderComparison(); } }
  requestAnimationFrame(frame);
}
el.startButton.addEventListener('click', startPractice); el.retryButton.addEventListener('click', startPractice); el.replayButton.addEventListener('click', replayGhost); el.resetButton.addEventListener('click', () => { cancelAnimationFrame(state.raf); state.running=false; state.replaying=false; clearVisualEffects(); resetPosition(); el.resultPanel.hidden=true; el.countdown.textContent='--'; el.phaseText.textContent='開始を待っています'; showFeedback('初期位置（中央）に戻しました。'); });
el.modeSelect.addEventListener('change', () => { const hidden=currentMode()==='combat'||currentMode()==='simulation'; el.targetStatus.hidden=hidden; el.actionText.hidden=hidden; el.roleControl.hidden=!isSimulation(); el.mechanicControl.hidden=isSimulation(); el.ghostPlayer.hidden=!isGhost(); });
el.mechanicSelect.addEventListener('change', () => { mechanic=SETTINGS.mechanics[el.mechanicSelect.value]; el.debuffName.textContent=mechanic.name; updateSteps(); });
el.roleSelect.addEventListener('change', () => { el.player.textContent=el.roleSelect.value; });
resetPosition();
renderHourglasses();
