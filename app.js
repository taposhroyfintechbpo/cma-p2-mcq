/* ============================================================
   CMA Part 2 — MCQ Practice App  ·  v2.0
   Vanilla JS · offline · localStorage
   Features: practice, section/custom/full mock tests, timer,
   navigator, notes, search, streak calendar, achievements,
   weak-area analysis, export/import.
   ============================================================ */
(function(){
"use strict";

const DATA = window.CMA_DATA;
const LS_PROGRESS = "cma_p2_progress_v1";
const LS_SETTINGS = "cma_p2_settings_v1";

/* ---------- Flat index ---------- */
const INDEX=[], SECTIONS=[], BYID={};
DATA.volumes.forEach(vol=>vol.sections.forEach(sec=>{
  const s={vol:vol.id, volName:vol.name, su:sec.su, sut:sec.sut, sub:sec.sub, subt:sec.subt,
           key:`${vol.id}.${sec.su}.${sec.sub}`, refs:[]};
  sec.qs.forEach(q=>{
    const ref={vol:vol.id, su:sec.su, sut:sec.sut, sub:sec.sub, subt:sec.subt, n:q.n, q, id:`${vol.id}.${sec.su}.${sec.sub}.${q.n}`};
    INDEX.push(ref); s.refs.push(ref); BYID[ref.id]=ref;
  });
  SECTIONS.push(s);
}));
function studyUnits(){
  const m=new Map();
  SECTIONS.forEach(s=>{ const k=`${s.vol}.${s.su}`; if(!m.has(k)) m.set(k,{vol:s.vol,su:s.su,sut:s.sut,subs:[]}); m.get(k).subs.push(s); });
  return [...m.values()];
}
const ANSWERABLE = INDEX.filter(r=>r.q.ans);

/* ---------- State ---------- */
let progress = load(LS_PROGRESS, {answers:{},flagged:{},notes:{},tests:[],activity:{},conf:{},last:null,ach:{}});
let settings = load(LS_SETTINGS, {mode:"instant",theme:"auto",font:"m",shuffle:"off",pace:"1.5"});
let session=null;   // practice
let test=null;      // active mock test
let timerHandle=null;

function load(k,def){ try{return Object.assign({},def,JSON.parse(localStorage.getItem(k)||"{}"));}catch(e){return {...def};} }
function saveProgress(){ localStorage.setItem(LS_PROGRESS, JSON.stringify(progress)); refreshGlobal(); }
function saveSettings(){ localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); }

/* ---------- Stats ---------- */
function stat(refs){
  let answered=0,correct=0,flagged=0;
  refs.forEach(r=>{ const a=progress.answers[r.id]; if(a){answered++; if(a.c)correct++;} if(progress.flagged[r.id])flagged++; });
  return {total:refs.length,answered,correct,incorrect:answered-correct,flagged,
    pct:refs.length?Math.round(answered/refs.length*100):0, acc:answered?Math.round(correct/answered*100):0};
}
const overall=()=>stat(INDEX);

/* ---------- activity / streak ---------- */
function todayKey(d){ d=d||new Date(); return d.toISOString().slice(0,10); }
function logActivity(correct){
  const k=todayKey(); const a=progress.activity[k]||{answered:0,correct:0};
  a.answered++; if(correct) a.correct++; progress.activity[k]=a;
}
function streak(){
  let s=0; const d=new Date();
  for(;;){ if(progress.activity[todayKey(d)]){ s++; d.setDate(d.getDate()-1); } else break; }
  // allow today-not-done but yesterday done to still show yesterday streak? keep simple:
  if(s===0){ const y=new Date(); y.setDate(y.getDate()-1); /* no-op */ }
  return s;
}

/* ---------- DOM utils ---------- */
const $=s=>document.querySelector(s);
const view=$("#view");
function el(tag,attrs,kids){
  const e=document.createElement(tag);
  if(attrs) for(const k in attrs){
    if(k==="class") e.className=attrs[k];
    else if(k==="html") e.innerHTML=attrs[k];
    else if(k.startsWith("on")) e.addEventListener(k.slice(2),attrs[k]);
    else if(attrs[k]!=null) e.setAttribute(k,attrs[k]);
  }
  (kids||[]).forEach(c=>{ if(c==null)return; e.appendChild(typeof c==="string"?document.createTextNode(c):c); });
  return e;
}
function esc(s){ return (s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function segHTML(segs, hl){
  if(!segs) return "";
  return segs.map(s=>{
    if(s.t!=null){ let t=esc(s.t); if(hl) t=t.replace(hl,m=>`<span class="hl">${m}</span>`); return t; }
    if(s.i!=null){ const w=Math.max(45,Math.min(100,Math.round((s.w||1)*125))); return `<img class="tbl-img" loading="lazy" src="${s.i}" alt="data table" style="width:${w}%">`; }
    return "";
  }).join(" ");
}
function segText(segs){ return (segs||[]).map(s=>s.t!=null?s.t:" [table] ").join(" "); }
function toast(m){ const t=$("#toast"); t.textContent=m; t.hidden=false; clearTimeout(t._t); t._t=setTimeout(()=>t.hidden=true,1800); }
function mount(n){ view.innerHTML=""; view.appendChild(n); }
function fmtTime(sec){ sec=Math.max(0,Math.round(sec)); const m=Math.floor(sec/60), s=sec%60; return (m<10?"0":"")+m+":"+(s<10?"0":"")+s; }
function fmtDur(sec){ const m=Math.round(sec/60); return m<60?m+" min":Math.floor(m/60)+"h "+(m%60)+"m"; }

/* ---------- Router ---------- */
let route={name:"home"};
function go(r,opts){ route=r; document.body.classList.toggle("subview",!!(opts&&opts.sub)); window.scrollTo(0,0); render(); syncNav(); }
function syncNav(){
  const active = ["unit","section"].includes(route.name)?"browse"
    : ["testbuilder","testrun","testresult","testhistory"].includes(route.name)?"tests"
    : ["search"].includes(route.name)?"":route.name;
  document.querySelectorAll(".bottomnav button, .desk-nav button").forEach(b=>b.classList.toggle("active",b.dataset.nav===active));
}

/* ============================================================ VIEWS ============================================================ */
function render(){
  const r=route.name;
  if(r==="home") return renderHome();
  if(r==="browse") return renderBrowse();
  if(r==="unit") return renderUnit(route.vol,route.su);
  if(r==="section") return renderSectionIntro(route.key);
  if(r==="practice") return renderPractice();
  if(r==="tests") return renderTestsHub();
  if(r==="testbuilder") return renderTestBuilder(route.cfg);
  if(r==="testrun") return renderTestRun();
  if(r==="testresult") return renderTestResult(route.result);
  if(r==="testhistory") return renderTestHistory();
  if(r==="review") return renderReview();
  if(r==="stats") return renderStats();
  if(r==="search") return renderSearch();
}

/* ---------- HOME ---------- */
function renderHome(){
  const o=overall(); const last=progress.last&&BYID[progress.last.id]; const st=streak();
  const wrap=el("div");
  wrap.appendChild(el("div",{class:"hero"},[el("div",{class:"ring"}),el("div",{class:"ring two"}),
    el("h1",null,[DATA.title]), el("p",null,["Practice anywhere — progress saved on this device."])]));

  const g=el("div",{class:"stat-grid"});
  g.appendChild(statCard(o.total,"Questions","accent"));
  g.appendChild(statCard(o.answered,"Answered",""));
  g.appendChild(statCard(o.correct,"Correct","good"));
  g.appendChild(statCard(o.acc+"%","Accuracy",o.acc>=70?"good":o.acc>0?"bad":""));
  wrap.appendChild(g);

  if(st>0){
    const sr=el("div",{style:"margin-top:16px"});
    sr.appendChild(el("div",{class:"streak-row"},[
      el("div",{class:"streak-badge"},[el("span",{class:"fire"},["🔥"]), el("span",null,[st+" day streak"])]),
      el("div",{class:"muted", style:"font-size:13px"},["Keep it going — answer at least one question today."])
    ]));
    wrap.appendChild(sr);
  }

  const cta=el("div",{class:"cta"});
  if(last) cta.appendChild(el("button",{class:"btn green",onclick:resumeLast},["▶ Resume · SU"+last.su+"."+last.sub+" Q"+last.n]));
  cta.appendChild(el("button",{class:"btn",onclick:()=>go({name:"tests"})},["◈ Mock tests"]));
  cta.appendChild(el("button",{class:"btn ghost",onclick:startMixed},["⚄ Quick 20"]));
  wrap.appendChild(cta);

  // recent test
  if(progress.tests.length){
    const t=progress.tests[0];
    wrap.appendChild(el("div",{class:"section-title"},["Last test"]));
    const c=el("div",{class:"card"});
    c.appendChild(rowItem({idx:Math.round(t.correct/t.total*100)+"%", title:t.name,
      sub:`${t.correct}/${t.total} · ${fmtDur(t.timeSpent)} · ${new Date(t.date).toLocaleDateString()}`,
      onclick:()=>go({name:"testresult", result:t},{sub:true})}));
    wrap.appendChild(c);
  }

  wrap.appendChild(el("div",{class:"section-title"},["Volumes"]));
  const card=el("div",{class:"card"});
  DATA.volumes.forEach(v=>{ const refs=INDEX.filter(r=>r.vol===v.id); const s=stat(refs);
    card.appendChild(rowItem({idx:"V"+v.id,title:v.name,sub:`${refs.length} questions · ${s.answered} done`,pct:s.pct,onclick:()=>go({name:"browse"})})); });
  wrap.appendChild(card);
  mount(wrap);
}
function statCard(num,lbl,cls){ return el("div",{class:"stat "+(cls||"")},[el("div",{class:"num"},[String(num)]),el("div",{class:"lbl"},[lbl])]); }

/* ---------- BROWSE ---------- */
function renderBrowse(){
  const units=studyUnits(); const wrap=el("div"); let curVol=null;
  wrap.appendChild(el("div",{class:"section-title"},["Study Units"]));
  units.forEach(u=>{
    if(curVol!==u.vol){ curVol=u.vol; wrap.appendChild(el("div",{class:"section-title",style:"margin-top:18px"},[DATA.volumes.find(v=>v.id===u.vol).name])); }
    const refs=[]; u.subs.forEach(s=>refs.push(...s.refs)); const s=stat(refs);
    const card=el("div",{class:"card",style:"margin-bottom:12px"});
    card.appendChild(rowItem({idx:u.su,title:"Study Unit "+u.su+": "+u.sut,sub:`${u.subs.length} subunits · ${refs.length} questions`,pct:s.pct,mini:s,onclick:()=>go({name:"unit",vol:u.vol,su:u.su},{sub:true})}));
    wrap.appendChild(card);
  });
  mount(wrap);
}
function renderUnit(vol,su){
  const u=studyUnits().find(x=>x.vol===vol&&x.su===su); const wrap=el("div");
  wrap.appendChild(el("div",{class:"section-title"},["Study Unit "+su]));
  wrap.appendChild(el("h2",{style:"margin:2px 4px 8px;font-size:20px"},[u.sut]));
  const refs=[]; u.subs.forEach(s=>refs.push(...s.refs));
  const cta=el("div",{class:"cta",style:"margin-bottom:6px"});
  cta.appendChild(el("button",{class:"btn ghost sm",onclick:()=>go({name:"testbuilder",cfg:{scope:"unit",vol,su,name:"SU"+su+" mock"}})},["◈ Test this unit"]));
  wrap.appendChild(cta);
  const card=el("div",{class:"card"});
  u.subs.forEach(sec=>{ const s=stat(sec.refs);
    card.appendChild(rowItem({idx:sec.sub,title:"Subunit "+sec.sub+": "+sec.subt,sub:`${sec.refs.length} questions`,pct:s.pct,mini:s,onclick:()=>go({name:"section",key:sec.key},{sub:true})})); });
  wrap.appendChild(card);
  mount(wrap);
}
function renderSectionIntro(key){
  const sec=SECTIONS.find(s=>s.key===key); const s=stat(sec.refs); const wrap=el("div");
  wrap.appendChild(el("div",{class:"section-title"},["SU"+sec.su+" · Subunit "+sec.sub]));
  wrap.appendChild(el("h2",{style:"margin:2px 4px 6px;font-size:21px"},[sec.subt]));
  wrap.appendChild(el("p",{class:"muted",style:"margin:0 4px 16px"},[sec.sut]));
  const g=el("div",{class:"stat-grid"});
  g.appendChild(statCard(sec.refs.length,"Questions","accent"));
  g.appendChild(statCard(s.answered,"Answered",""));
  g.appendChild(statCard(s.correct,"Correct","good"));
  g.appendChild(statCard(s.acc+"%","Accuracy",s.acc>=70?"good":s.acc>0?"bad":""));
  wrap.appendChild(g);
  const cta=el("div",{class:"cta"});
  cta.appendChild(el("button",{class:"btn green block",onclick:()=>startSession(sec.refs.slice(),{title:sec.subt,key})},[s.answered?"▶ Continue practice":"▶ Start practice"]));
  wrap.appendChild(cta);
  const c2=el("div",{class:"cta"});
  c2.appendChild(el("button",{class:"btn ghost",onclick:()=>go({name:"testbuilder",cfg:{scope:"section",key,name:sec.subt+" test"}})},["◈ Timed test"]));
  if(sec.refs.length-s.answered) c2.appendChild(el("button",{class:"btn ghost",onclick:()=>startSession(sec.refs.filter(r=>!progress.answers[r.id]),{title:sec.subt+" · unanswered",key})},["Only unanswered ("+(sec.refs.length-s.answered)+")"]));
  if(s.incorrect) c2.appendChild(el("button",{class:"btn ghost",onclick:()=>startSession(sec.refs.filter(r=>progress.answers[r.id]&&!progress.answers[r.id].c),{title:sec.subt+" · redo wrong",key})},["Redo incorrect ("+s.incorrect+")"]));
  wrap.appendChild(c2);
  mount(wrap);
}

/* ============================================================ PRACTICE ============================================================ */
function orderChoices(q,id){
  const keys=Object.keys(q.ch);
  if(settings.shuffle!=="on") return keys;
  // deterministic shuffle per question id so it stays stable within a view
  let seed=0; for(const ch of id) seed=(seed*31+ch.charCodeAt(0))>>>0;
  const arr=keys.slice();
  for(let i=arr.length-1;i>0;i--){ seed=(seed*1103515245+12345)>>>0; const j=seed%(i+1); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  return arr;
}
function startSession(refs,meta){
  if(!refs.length){ toast("Nothing to practice here 🎉"); return; }
  session={refs,i:0,meta:meta||{},revealed:{},picks:{}};
  const firstUn=refs.findIndex(r=>!progress.answers[r.id]);
  if(firstUn>0&&meta&&meta.key) session.i=firstUn;
  go({name:"practice"});
}
function startMixed(){ startSession(ANSWERABLE.slice().sort(()=>Math.random()-.5).slice(0,20),{title:"Quick 20 · mixed",mixed:true}); }
function resumeLast(){ const ref=BYID[progress.last.id]; if(!ref)return; const sec=SECTIONS.find(s=>s.key===`${ref.vol}.${ref.su}.${ref.sub}`); startSession(sec.refs.slice(),{title:ref.subt,key:sec.key}); session.i=sec.refs.findIndex(r=>r.id===ref.id); render(); }

function renderPractice(){
  const S=session, ref=S.refs[S.i], q=ref.q;
  progress.last={id:ref.id}; saveProgress();
  const wrap=el("div");
  const head=el("div",{class:"practice-head"});
  head.appendChild(el("div",{class:"meta"},[el("div",{class:"k"},[S.meta.mixed?"Mixed practice":"SU"+ref.su+" · Subunit "+ref.sub]),el("div",{class:"titl"},[S.meta.title||ref.subt])]));
  head.appendChild(el("div",{class:"counter"},[(S.i+1)+" / "+S.refs.length]));
  wrap.appendChild(head);
  wrap.appendChild(el("div",{class:"pbar"},[el("div",{class:"fill",style:`width:${(S.i+1)/S.refs.length*100}%`})]));

  const card=el("div",{class:"qcard"});
  if(q.fact) card.appendChild(el("div",{class:"fact"},[el("div",{class:"lab"},["Fact pattern"]),el("div",{html:segHTML(q.fact)})]));
  card.appendChild(el("div",{class:"qstem",html:`<span class="qn">Q${q.n}.</span> `+segHTML(q.stem)}));

  const saved=progress.answers[ref.id];
  const revealed=S.revealed[ref.id]||(settings.mode==="instant"&&saved);
  const picked=S.picks[ref.id]||(saved&&saved.p);
  const choices=el("div",{class:"choices"});
  orderChoices(q,ref.id).forEach(L=>{
    const c=el("button",{class:"choice","data-key":L});
    c.appendChild(el("span",{class:"key"},[L]));
    c.appendChild(el("span",{class:"txt",html:segHTML(q.ch[L])}));
    const mark=el("span",{class:"mark"}); c.appendChild(mark);
    if(revealed){ c.classList.add("disabled");
      if(q.ans&&L===q.ans){c.classList.add("correct");mark.textContent="✓";}
      if(picked===L&&L!==q.ans){c.classList.add("incorrect");mark.textContent="✗";}
    } else { if(picked===L)c.classList.add("selected"); c.addEventListener("click",()=>pick(ref,L)); }
    choices.appendChild(c);
  });
  card.appendChild(choices);

  if(revealed){
    const correct=q.ans&&picked===q.ans;
    const exp=el("div",{class:"explain "+(correct?"":"wrong")});
    exp.appendChild(el("div",{class:"lab"},[q.ans?(correct?"Correct ✓ — Answer "+q.ans:"Answer: "+q.ans):"Answer not provided in source"]));
    if(q.exp&&q.exp.length) exp.appendChild(el("div",{class:"body",html:segHTML(q.exp)}));
    else if(q.ans) exp.appendChild(el("div",{class:"body no-answer"},["No explanation text in the source for this question."]));
    // confidence
    const cf=el("div",{class:"confbar"});
    ["Guessed","Unsure","Confident"].forEach((lb,idx)=>{
      const sel=progress.conf[ref.id]===idx;
      cf.appendChild(el("button",{class:sel?"sel":"",onclick:()=>{progress.conf[ref.id]=idx;saveProgress();render();}},[lb]));
    });
    exp.appendChild(cf);
    card.appendChild(exp);
  }
  // note chip
  if(progress.notes[ref.id]) card.appendChild(el("div",{class:"note-chip"},["📝 ",progress.notes[ref.id].slice(0,80)]));
  wrap.appendChild(card);

  const bar=el("div",{class:"action-bar"});
  const fl=!!progress.flagged[ref.id];
  bar.appendChild(el("button",{class:"flag-btn"+(fl?" on":""),title:"Flag",onclick:()=>{ if(fl)delete progress.flagged[ref.id]; else progress.flagged[ref.id]=1; saveProgress(); render(); }},["⚑"]));
  bar.appendChild(el("button",{class:"flag-btn",title:"Note",onclick:()=>openNote(ref)},["📝"]));
  bar.appendChild(el("button",{class:"nav-btn",disabled:S.i===0?"":null,onclick:()=>{if(S.i>0){S.i--;render();}}},["‹"]));
  bar.appendChild(el("div",{class:"spacer"}));
  if(settings.mode==="exam"&&!revealed&&picked) bar.appendChild(el("button",{class:"btn accent",onclick:()=>{S.revealed[ref.id]=true;commit(ref,picked);render();}},["Check"]));
  const last=S.i===S.refs.length-1;
  bar.appendChild(el("button",{class:"btn",onclick:()=>{ if(last)finishSession(); else{S.i++;render();} }},[last?"Finish ✓":"Next ›"]));
  wrap.appendChild(bar);

  wrap.appendChild(el("div",{class:"hintbar"},[kb("A–D","choose"),kb("←/→","navigate"),kb("F","flag"),kb("N","note"),kb("Enter","next")]));
  mount(wrap);
}
function kb(k,l){ const s=el("span"); s.innerHTML=`<span class="kbd">${k}</span> ${l}`; return s; }
function pick(ref,L){ const S=session; S.picks[ref.id]=L; if(settings.mode==="instant"){S.revealed[ref.id]=true;commit(ref,L);} render(); }
function commit(ref,L){ const q=ref.q; const correct=q.ans?(L===q.ans):null;
  const prev=progress.answers[ref.id];
  progress.answers[ref.id]={p:L,c:!!correct,ts:Date.now()};
  if(!prev) logActivity(!!correct); checkAch(); saveProgress(); }
function finishSession(){
  const S=session; const correct=S.refs.filter(r=>progress.answers[r.id]&&progress.answers[r.id].c).length;
  const wrap=el("div"); wrap.appendChild(el("div",{class:"section-title"},["Session complete"]));
  const sum=el("div",{class:"summary"});
  sum.appendChild(el("div",{class:"score"},[correct+" / "+S.refs.length]));
  sum.appendChild(el("div",{class:"sub"},["Correct · "+(S.refs.length?Math.round(correct/S.refs.length*100):0)+"%"]));
  const wrong=S.refs.filter(r=>progress.answers[r.id]&&!progress.answers[r.id].c);
  const cta=el("div",{class:"cta",style:"justify-content:center;margin-top:20px"});
  if(wrong.length) cta.appendChild(el("button",{class:"btn danger",onclick:()=>startSession(wrong.slice(),{title:"Redo incorrect"})},["Redo "+wrong.length+" incorrect"]));
  cta.appendChild(el("button",{class:"btn",onclick:()=>go({name:"browse"})},["Topics"]));
  cta.appendChild(el("button",{class:"btn ghost",onclick:()=>go({name:"stats"})},["Stats"]));
  sum.appendChild(cta); wrap.appendChild(sum); session=null; document.body.classList.remove("subview"); mount(wrap); syncNav();
}

/* ============================================================ MOCK TESTS ============================================================ */
function renderTestsHub(){
  const wrap=el("div");
  wrap.appendChild(el("div",{class:"section-title"},["Mock tests"]));

  wrap.appendChild(optCard("◈","","Section test","Pick any subunit and take a timed test.",()=>{
    // choose section
    go({name:"testbuilder",cfg:{scope:"pick-section",name:"Section test"}});
  }));
  wrap.appendChild(optCard("◆","violet","Study-unit test","A timed test across a whole study unit.",()=>{
    go({name:"testbuilder",cfg:{scope:"pick-unit",name:"Study-unit test"}});
  }));
  wrap.appendChild(optCard("⚙","amber","Custom test","Choose topics, question count, and timer.",()=>{
    go({name:"testbuilder",cfg:{scope:"custom",name:"Custom test"}});
  }));
  wrap.appendChild(optCard("★","green","Full mock exam","100 questions, 2.5 hours — exam simulation.",()=>{
    startTest(buildFullExam(), {name:"Full mock exam", limit:150*60});
  }));

  wrap.appendChild(el("div",{class:"section-title"},["History"]));
  if(!progress.tests.length){
    wrap.appendChild(el("div",{class:"empty"},[el("div",{class:"em"},["◈"]),el("div",null,["No tests yet. Start one above."])]));
  } else {
    const card=el("div",{class:"card"});
    progress.tests.slice(0,6).forEach(t=>card.appendChild(testRow(t)));
    wrap.appendChild(card);
    if(progress.tests.length>6) wrap.appendChild(el("div",{class:"cta"},[el("button",{class:"btn ghost block",onclick:()=>go({name:"testhistory"},{sub:true})},["View all "+progress.tests.length+" tests"])]));
  }
  mount(wrap);
}
function optCard(ico,cls,title,desc,onclick){
  return el("div",{class:"opt-card",onclick},[el("div",{class:"oc-top"},[
    el("div",{class:"oc-ico "+cls},[ico]),
    el("div",null,[el("h3",null,[title]),el("p",null,[desc])])
  ])]);
}
function testRow(t){
  const pct=Math.round(t.correct/t.total*100);
  return rowItem({idx:pct+"%",title:t.name,sub:`${t.correct}/${t.total} · ${fmtDur(t.timeSpent)} · ${new Date(t.date).toLocaleDateString()}`,onclick:()=>go({name:"testresult",result:t},{sub:true})});
}
function renderTestHistory(){
  const wrap=el("div"); wrap.appendChild(el("div",{class:"section-title"},["All tests ("+progress.tests.length+")"]));
  const card=el("div",{class:"card"}); progress.tests.forEach(t=>card.appendChild(testRow(t))); wrap.appendChild(card); mount(wrap);
}

/* ---- builder ---- */
function renderTestBuilder(cfg){
  const wrap=el("div");
  wrap.appendChild(el("div",{class:"section-title"},["Configure test"]));
  wrap.appendChild(el("h2",{style:"margin:2px 4px 14px;font-size:21px"},[cfg.name]));
  const state={count:20, limitPace:parseFloat(settings.pace), picks:{}, section:null, unit:null};

  // scope-specific pickers
  if(cfg.scope==="section" || cfg.scope==="pick-section"){
    if(cfg.key){ state.section=cfg.key; }
    else {
      wrap.appendChild(field("Choose a subunit", buildSectionSelect(state)));
    }
  }
  if(cfg.scope==="unit"){ state.unit={vol:cfg.vol,su:cfg.su}; }
  if(cfg.scope==="pick-unit"){ wrap.appendChild(field("Choose a study unit", buildUnitSelect(state))); }
  if(cfg.scope==="custom"){ wrap.appendChild(field("Include study units", buildUnitChecks(state))); }

  // question count
  const countField=el("div",{class:"seg"});
  [10,20,30,50,100].forEach(n=>countField.appendChild(el("button",{class:n===state.count?"active":"","data-n":n,onclick:e=>{state.count=n;[...countField.children].forEach(b=>b.classList.toggle("active",+b.dataset.n===n));}},[String(n)])));
  wrap.appendChild(field("Number of questions", countField));

  // timer
  const timerField=el("div",{class:"seg"});
  [["1","1.0 min/Q"],["1.5","1.5 min/Q"],["2","2.0 min/Q"],["0","No timer"]].forEach(([v,lb])=>{
    timerField.appendChild(el("button",{class:parseFloat(v)===state.limitPace?"active":"","data-v":v,onclick:()=>{state.limitPace=parseFloat(v);[...timerField.children].forEach(b=>b.classList.toggle("active",parseFloat(b.dataset.v)===state.limitPace));}},[lb]));
  });
  wrap.appendChild(field("Time limit", timerField));

  wrap.appendChild(el("div",{class:"cta"},[el("button",{class:"btn green block",onclick:()=>{
    const pool=resolvePool(cfg,state);
    if(!pool.length){ toast("Pick at least one topic"); return; }
    const refs=pool.slice().sort(()=>Math.random()-.5).slice(0,state.count);
    const limit = state.limitPace>0 ? Math.round(refs.length*state.limitPace*60) : 0;
    let name=cfg.name;
    if(state.section){ const s=SECTIONS.find(x=>x.key===state.section); name=s.subt+" test"; }
    if(state.unit){ name="SU"+state.unit.su+" mock"; }
    startTest(refs,{name, limit});
  }},["Start test →"])]));
  mount(wrap);
}
function field(label,node){ const f=el("div",{class:"field"}); f.appendChild(el("label",null,[label])); f.appendChild(node); return f; }
function buildSectionSelect(state){
  const list=el("div",{class:"check-list"});
  SECTIONS.forEach(s=>{
    const row=el("label",{class:"check-row"});
    const rb=el("input",{type:"radio",name:"sec"}); rb.addEventListener("change",()=>state.section=s.key);
    row.appendChild(rb);
    row.appendChild(el("span",{class:"t"},["SU"+s.su+"."+s.sub+" — "+s.subt]));
    row.appendChild(el("span",{class:"c"},[s.refs.length+" Q"]));
    list.appendChild(row);
  });
  return list;
}
function buildUnitSelect(state){
  const list=el("div",{class:"check-list"});
  studyUnits().forEach(u=>{ const refs=[];u.subs.forEach(s=>refs.push(...s.refs));
    const row=el("label",{class:"check-row"});
    const rb=el("input",{type:"radio",name:"unit"}); rb.addEventListener("change",()=>state.unit={vol:u.vol,su:u.su});
    row.appendChild(rb); row.appendChild(el("span",{class:"t"},["SU"+u.su+" — "+u.sut])); row.appendChild(el("span",{class:"c"},[refs.length+" Q"]));
    list.appendChild(row);
  });
  return list;
}
function buildUnitChecks(state){
  const list=el("div",{class:"check-list"});
  studyUnits().forEach(u=>{ const refs=[];u.subs.forEach(s=>refs.push(...s.refs));
    const row=el("label",{class:"check-row"});
    const cb=el("input",{type:"checkbox"}); cb.addEventListener("change",()=>{ if(cb.checked)state.picks[u.vol+"."+u.su]=1; else delete state.picks[u.vol+"."+u.su]; });
    row.appendChild(cb); row.appendChild(el("span",{class:"t"},["SU"+u.su+" — "+u.sut])); row.appendChild(el("span",{class:"c"},[refs.length+" Q"]));
    list.appendChild(row);
  });
  return list;
}
function resolvePool(cfg,state){
  if(state.section){ const s=SECTIONS.find(x=>x.key===state.section); return s.refs.filter(r=>r.q.ans); }
  if(state.unit){ return INDEX.filter(r=>r.vol===state.unit.vol&&r.su===state.unit.su&&r.q.ans); }
  if(cfg.scope==="custom"){
    const keys=Object.keys(state.picks); if(!keys.length) return [];
    return INDEX.filter(r=>state.picks[r.vol+"."+r.su]&&r.q.ans);
  }
  return [];
}
function buildFullExam(){
  // Weighted-ish: sample across all study units proportionally, answerable only.
  const byU={}; ANSWERABLE.forEach(r=>{ const k=r.vol+"."+r.su; (byU[k]=byU[k]||[]).push(r); });
  const keys=Object.keys(byU); const target=100; const out=[];
  const perU=Math.max(1,Math.floor(target/keys.length));
  keys.forEach(k=>{ const arr=byU[k].slice().sort(()=>Math.random()-.5); out.push(...arr.slice(0,perU)); });
  // fill remainder
  const rest=ANSWERABLE.filter(r=>!out.includes(r)).sort(()=>Math.random()-.5);
  while(out.length<target && rest.length) out.push(rest.pop());
  return out.sort(()=>Math.random()-.5).slice(0,target);
}

/* ---- runner ---- */
function startTest(refs,meta){
  if(!refs.length){ toast("No questions to test"); return; }
  test={refs,i:0,picks:{},flag:{},meta,started:Date.now(),elapsed:0,remaining:meta.limit||0,paused:false,submitted:false};
  $("#examBar").hidden=false; $("#ebName").textContent=meta.name;
  startTimer();
  go({name:"testrun"});
}
function startTimer(){
  stopTimer();
  timerHandle=setInterval(()=>{
    if(!test||test.paused||test.submitted) return;
    test.elapsed++;
    if(test.meta.limit){ test.remaining--; if(test.remaining<=0){ test.remaining=0; submitTest(true); return; } }
    updateExamBar();
  },1000);
  updateExamBar();
}
function stopTimer(){ if(timerHandle){clearInterval(timerHandle);timerHandle=null;} }
function updateExamBar(){
  if(!test){return;}
  const t=$("#ebTimer");
  if(test.meta.limit){ t.textContent=fmtTime(test.remaining); t.classList.toggle("warn",test.remaining<=300&&test.remaining>60); t.classList.toggle("crit",test.remaining<=60); }
  else { t.textContent=fmtTime(test.elapsed); }
  const answered=Object.keys(test.picks).length;
  $("#ebCount").textContent=answered+"/"+test.refs.length;
}
function renderTestRun(){
  const T=test, ref=T.refs[T.i], q=ref.q;
  const wrap=el("div");
  const head=el("div",{class:"practice-head"});
  head.appendChild(el("div",{class:"meta"},[el("div",{class:"k"},["Question "+(T.i+1)+" of "+T.refs.length]),el("div",{class:"titl"},["SU"+ref.su+"."+ref.sub+" · "+ref.subt])]));
  head.appendChild(el("button",{class:"navigator-open",onclick:openNavigator},["▦ Navigator"]));
  wrap.appendChild(head);
  wrap.appendChild(el("div",{class:"pbar"},[el("div",{class:"fill",style:`width:${(T.i+1)/T.refs.length*100}%`})]));

  const card=el("div",{class:"qcard"});
  if(q.fact) card.appendChild(el("div",{class:"fact"},[el("div",{class:"lab"},["Fact pattern"]),el("div",{html:segHTML(q.fact)})]));
  card.appendChild(el("div",{class:"qstem",html:`<span class="qn">Q${T.i+1}.</span> `+segHTML(q.stem)}));
  const picked=T.picks[ref.id];
  const choices=el("div",{class:"choices"});
  orderChoices(q,ref.id).forEach(L=>{
    const c=el("button",{class:"choice"+(picked===L?" selected":"")});
    c.appendChild(el("span",{class:"key"},[L])); c.appendChild(el("span",{class:"txt",html:segHTML(q.ch[L])}));
    c.addEventListener("click",()=>{ T.picks[ref.id]=L; updateExamBar(); render(); });
    choices.appendChild(c);
  });
  card.appendChild(choices);
  wrap.appendChild(card);

  const bar=el("div",{class:"action-bar"});
  const fl=!!T.flag[ref.id];
  bar.appendChild(el("button",{class:"flag-btn"+(fl?" on":""),onclick:()=>{ if(fl)delete T.flag[ref.id]; else T.flag[ref.id]=1; render(); }},["⚑"]));
  bar.appendChild(el("button",{class:"nav-btn",disabled:T.i===0?"":null,onclick:()=>{if(T.i>0){T.i--;render();}}},["‹ Prev"]));
  bar.appendChild(el("div",{class:"spacer"}));
  if(T.i===T.refs.length-1) bar.appendChild(el("button",{class:"btn green",onclick:()=>{ if(confirm("Submit test now?")) submitTest(false); }},["Submit ✓"]));
  else bar.appendChild(el("button",{class:"btn",onclick:()=>{T.i++;render();}},["Next ›"]));
  wrap.appendChild(bar);
  mount(wrap);
}
function openNavigator(){
  const grid=$("#navGrid"); grid.innerHTML="";
  test.refs.forEach((r,idx)=>{
    const cell=el("button",{class:"nav-cell"+(test.picks[r.id]?" answered":"")+(test.flag[r.id]?" flagged":"")+(idx===test.i?" current":"")},[String(idx+1)]);
    cell.addEventListener("click",()=>{ test.i=idx; $("#navModal").hidden=true; render(); });
    grid.appendChild(cell);
  });
  $("#navModal").hidden=false;
}
function submitTest(auto){
  if(!test||test.submitted) return;
  test.submitted=true; stopTimer(); $("#examBar").hidden=true;
  let correct=0; const detail=[];
  test.refs.forEach(r=>{ const p=test.picks[r.id]||null; const c=r.q.ans?(p===r.q.ans):false; if(c)correct++;
    detail.push({id:r.id,su:r.su,sub:r.sub,subt:r.subt,n:r.n,pick:p,ans:r.q.ans,correct:c});
    // also fold test answers into overall progress (as attempts)
    if(p){ const prev=progress.answers[r.id]; progress.answers[r.id]={p,c,ts:Date.now()}; if(!prev)logActivity(c); }
  });
  const result={id:"t"+Date.now(),name:test.meta.name,total:test.refs.length,correct,
    timeSpent:test.elapsed,limit:test.meta.limit||0,date:Date.now(),auto:!!auto,detail};
  progress.tests.unshift(result); if(progress.tests.length>50)progress.tests.pop();
  checkAch(); saveProgress();
  test=null; document.body.classList.remove("subview");
  go({name:"testresult",result},{sub:true});
}
function renderTestResult(t){
  const pct=Math.round(t.correct/t.total*100); const pass=pct>=72; // CMA scaled pass ~ 72%
  const wrap=el("div");
  const hero=el("div",{class:"result-hero"});
  hero.appendChild(el("div",{class:"big"},[pct+"%"]));
  hero.appendChild(el("div",{class:"lbl"},[t.correct+" of "+t.total+" correct · "+fmtDur(t.timeSpent)+(t.auto?" · auto-submitted":"")]));
  hero.appendChild(el("div",{class:"verdict "+(pass?"pass":"fail")},[pass?"On track to pass ✓":"Below target — keep practicing"]));
  wrap.appendChild(hero);

  const rg=el("div",{class:"rgrid"});
  rg.appendChild(statCard(t.correct,"Correct","good"));
  rg.appendChild(statCard(t.total-t.correct,"Wrong/blank","bad"));
  rg.appendChild(statCard(t.limit?fmtTime(t.limit-t.timeSpent):"—","Time left","accent"));
  wrap.appendChild(rg);

  // per-unit breakdown
  const byU={}; (t.detail||[]).forEach(d=>{ const k="SU"+d.su; (byU[k]=byU[k]||{c:0,n:0}); byU[k].n++; if(d.correct)byU[k].c++; });
  if(Object.keys(byU).length>1){
    wrap.appendChild(el("div",{class:"section-title"},["By study unit"]));
    const card=el("div",{class:"card",style:"padding:14px 16px"});
    Object.keys(byU).sort((a,b)=>+a.slice(2)-+b.slice(2)).forEach(k=>{ const u=byU[k]; const p=Math.round(u.c/u.n*100);
      card.appendChild(weakRow(k,p,u.c+"/"+u.n)); });
    wrap.appendChild(card);
  }

  const cta=el("div",{class:"cta",style:"margin-top:16px"});
  const wrong=(t.detail||[]).filter(d=>!d.correct).map(d=>BYID[d.id]).filter(Boolean);
  if(wrong.length) cta.appendChild(el("button",{class:"btn danger",onclick:()=>startSession(wrong,{title:t.name+" · review wrong"})},["Review "+wrong.length+" wrong"]));
  cta.appendChild(el("button",{class:"btn ghost",onclick:()=>go({name:"tests"})},["New test"]));
  wrap.appendChild(cta);

  // answer review
  if(t.detail){
    wrap.appendChild(el("div",{class:"section-title"},["Answer review"]));
    t.detail.forEach((d,idx)=>{
      const ref=BYID[d.id]; if(!ref)return; const q=ref.q;
      const it=el("div",{class:"ans-item"});
      it.appendChild(el("div",{class:"ai-head"},[
        el("span",{class:"ai-q"},["Q"+(idx+1)+" · SU"+d.su+"."+d.sub]),
        d.correct?el("span",{class:"pill green"},["✓"]):el("span",{class:"pill red"},[d.pick?"✗":"blank"])
      ]));
      it.appendChild(el("div",{class:"ai-body",html:segHTML(q.stem)}));
      ["A","B","C","D"].forEach(L=>{ if(!q.ch[L])return;
        let cls="opt"; if(q.ans===L)cls+=" correct"; else if(d.pick===L)cls+=" chosen-wrong";
        it.appendChild(el("div",{class:cls,html:`<b>${L}.</b> `+segHTML(q.ch[L])}));
      });
      wrap.appendChild(it);
    });
  }
  mount(wrap);
}
function weakRow(label,pct,right){
  const color=pct>=70?"var(--green)":pct>=50?"var(--amber)":"var(--red)";
  return el("div",{class:"weak-item"},[
    el("div",{style:"width:64px;font-weight:700;font-size:13px"},[label]),
    el("div",{class:"wbar"},[el("div",{class:"f",style:`width:${pct}%;background:${color}`})]),
    el("div",{class:"wpct",style:`color:${color}`},[pct+"%"]),
    right?el("div",{class:"c",style:"width:44px;text-align:right;color:var(--muted);font-size:12px"},[right]):null
  ]);
}

/* ============================================================ REVIEW ============================================================ */
let reviewFilter="flagged";
function renderReview(){
  const wrap=el("div"); wrap.appendChild(el("div",{class:"section-title"},["Review"]));
  const chips=el("div",{class:"chips"});
  [["flagged","⚑ Flagged"],["incorrect","✗ Incorrect"],["unanswered","○ Unanswered"],["notes","📝 Notes"],["correct","✓ Correct"]].forEach(([k,lbl])=>{
    chips.appendChild(el("button",{class:"chip"+(reviewFilter===k?" active":""),onclick:()=>{reviewFilter=k;render();}},[lbl]));
  });
  wrap.appendChild(chips);

  // weak areas quick card
  if(reviewFilter==="incorrect"){
    const weak=weakAreas().slice(0,5);
    if(weak.length){
      wrap.appendChild(el("div",{class:"section-title"},["Weakest topics"]));
      const card=el("div",{class:"card",style:"padding:12px 16px 4px"});
      weak.forEach(w=>{ const row=weakRow("SU"+w.su+"."+w.sub,w.acc,w.correct+"/"+w.answered);
        row.style.cursor="pointer"; row.addEventListener("click",()=>{ const sec=SECTIONS.find(s=>s.key===w.key); startSession(sec.refs.filter(r=>progress.answers[r.id]&&!progress.answers[r.id].c),{title:w.subt+" · redo",key:w.key}); });
        card.appendChild(row); });
      wrap.appendChild(card);
    }
  }

  let refs;
  if(reviewFilter==="flagged")refs=INDEX.filter(r=>progress.flagged[r.id]);
  else if(reviewFilter==="incorrect")refs=INDEX.filter(r=>progress.answers[r.id]&&!progress.answers[r.id].c);
  else if(reviewFilter==="correct")refs=INDEX.filter(r=>progress.answers[r.id]&&progress.answers[r.id].c);
  else if(reviewFilter==="notes")refs=INDEX.filter(r=>progress.notes[r.id]);
  else refs=INDEX.filter(r=>!progress.answers[r.id]);

  if(!refs.length){ wrap.appendChild(el("div",{class:"empty"},[el("div",{class:"em"},["🗂️"]),el("div",null,["Nothing here yet."])])); return mount(wrap); }
  const cta=el("div",{class:"cta",style:"margin:2px 0 14px"});
  cta.appendChild(el("button",{class:"btn green",onclick:()=>startSession(refs.slice(),{title:"Review · "+reviewFilter})},["▶ Practice these ("+refs.length+")"]));
  wrap.appendChild(cta);
  const card=el("div",{class:"card"});
  refs.slice(0,400).forEach(r=>{ const a=progress.answers[r.id];
    const pill=a?(a.c?el("span",{class:"pill green"},["✓"]):el("span",{class:"pill red"},["✗"])):el("span",{class:"pill amber"},["○"]);
    const row=el("div",{class:"row",onclick:()=>{ const sec=SECTIONS.find(s=>s.key===`${r.vol}.${r.su}.${r.sub}`); startSession(sec.refs.slice(),{title:sec.subt,key:sec.key}); session.i=sec.refs.findIndex(x=>x.id===r.id); render(); }});
    row.appendChild(el("div",{class:"idx",style:"font-size:12px"},["SU"+r.su+"."+r.sub]));
    row.appendChild(el("div",{class:"body"},[el("div",{class:"t"},["Q"+r.n+". "+segText(r.q.stem).slice(0,90)]),el("div",{class:"s"},[progress.notes[r.id]?"📝 "+progress.notes[r.id].slice(0,60):r.subt])]));
    row.appendChild(pill); card.appendChild(row);
  });
  wrap.appendChild(card); mount(wrap);
}
function weakAreas(){
  return SECTIONS.map(s=>{ const st=stat(s.refs); return {key:s.key,su:s.su,sub:s.sub,subt:s.subt,answered:st.answered,correct:st.correct,acc:st.acc}; })
    .filter(x=>x.answered>=3).sort((a,b)=>a.acc-b.acc);
}

/* ============================================================ STATS ============================================================ */
function renderStats(){
  const o=overall(); const wrap=el("div");
  wrap.appendChild(el("div",{class:"section-title"},["Your progress"]));
  const donutWrap=el("div",{class:"card",style:"padding:22px"});
  const dw=el("div",{class:"donut-wrap"});
  const donut=el("div",{class:"donut",style:`--p:${o.pct};--c:var(--accent)`});
  donut.appendChild(el("div",{class:"hole"},[el("div",null,[el("div",{class:"big"},[o.pct+"%"]),el("div",{class:"cap"},["completed"])])]));
  dw.appendChild(donut);
  const legend=el("div",{class:"legend"});
  legend.appendChild(li("var(--accent)",o.answered+" answered of "+o.total));
  legend.appendChild(li("var(--green)",o.correct+" correct"));
  legend.appendChild(li("var(--red)",o.incorrect+" incorrect"));
  legend.appendChild(li("var(--amber)",o.flagged+" flagged"));
  legend.appendChild(li("var(--line-strong)",(o.total-o.answered)+" remaining"));
  dw.appendChild(legend); donutWrap.appendChild(dw); wrap.appendChild(donutWrap);

  const g=el("div",{class:"stat-grid",style:"margin-top:14px"});
  g.appendChild(statCard(o.acc+"%","Accuracy",o.acc>=70?"good":o.acc>0?"bad":""));
  g.appendChild(statCard(streak(),"Day streak","accent"));
  g.appendChild(statCard(progress.tests.length,"Tests taken",""));
  g.appendChild(statCard(o.flagged,"Flagged","accent"));
  wrap.appendChild(g);

  // activity calendar (last 8 weeks)
  wrap.appendChild(el("div",{class:"section-title"},["Activity (last 8 weeks)"]));
  wrap.appendChild(calendar());

  // achievements
  wrap.appendChild(el("div",{class:"section-title"},["Achievements"]));
  wrap.appendChild(achGrid());

  // by study unit
  wrap.appendChild(el("div",{class:"section-title"},["By study unit"]));
  const card=el("div",{class:"card",style:"padding:12px 16px 4px"});
  studyUnits().forEach(u=>{ const refs=[];u.subs.forEach(s=>refs.push(...s.refs)); const s=stat(refs);
    const row=weakRow("SU"+u.su,s.acc||0,s.answered+"/"+s.total); row.style.cursor="pointer";
    row.addEventListener("click",()=>go({name:"unit",vol:u.vol,su:u.su},{sub:true})); card.appendChild(row); });
  wrap.appendChild(card);
  mount(wrap);
}
function li(c,l){ return el("div",{class:"li"},[el("span",{class:"dot",style:"background:"+c}),l]); }
function calendar(){
  const wrap=el("div",{class:"card",style:"padding:16px"});
  const days=56; const cells=[];
  const today=new Date(); today.setHours(0,0,0,0);
  // align to weeks: go back to most recent Sunday
  const end=new Date(today);
  for(let i=days-1;i>=0;i--){ const d=new Date(end); d.setDate(end.getDate()-i); const a=progress.activity[todayKey(d)];
    const n=a?a.answered:0; let lvl=n===0?0:n<5?1:n<15?2:n<30?3:4; cells.push({d,lvl,n}); }
  const head=el("div",{class:"cal-head"}); ["S","M","T","W","T","F","S"].forEach(x=>head.appendChild(el("div",null,[x]))); wrap.appendChild(head);
  const grid=el("div",{class:"cal"});
  cells.forEach(c=>{ const cell=el("div",{class:"cell"+(c.lvl?" l"+c.lvl:""),title:todayKey(c.d)+" · "+c.n+" answered"}); grid.appendChild(cell); });
  wrap.appendChild(grid);
  return wrap;
}
const ACHS=[
  {id:"first",em:"🎯",nm:"First steps",ds:"Answer 1 question",test:o=>o.answered>=1},
  {id:"fifty",em:"⚡",nm:"Warming up",ds:"Answer 50",test:o=>o.answered>=50},
  {id:"hund",em:"💯",nm:"Century",ds:"Answer 100",test:o=>o.answered>=100},
  {id:"fivehund",em:"🚀",nm:"Grinder",ds:"Answer 500",test:o=>o.answered>=500},
  {id:"acc80",em:"🎓",nm:"Sharp",ds:"80%+ accuracy (100+)",test:o=>o.answered>=100&&o.acc>=80},
  {id:"streak7",em:"🔥",nm:"On fire",ds:"7-day streak",test:()=>streak()>=7},
  {id:"test1",em:"◈",nm:"Test taker",ds:"Finish a mock test",test:()=>progress.tests.length>=1},
  {id:"pass",em:"🏆",nm:"Exam ready",ds:"Score 72%+ on a test",test:()=>progress.tests.some(t=>t.correct/t.total>=0.72)},
  {id:"complete",em:"👑",nm:"Completionist",ds:"Answer every question",test:o=>o.answered>=o.total},
];
function checkAch(){ const o=overall(); ACHS.forEach(a=>{ if(!progress.ach[a.id]&&a.test(o)){ progress.ach[a.id]=Date.now(); toast(a.em+" Achievement: "+a.nm); } }); }
function achGrid(){ const o=overall(); const g=el("div",{class:"ach-grid"});
  ACHS.forEach(a=>{ const on=!!progress.ach[a.id]||a.test(o); if(on&&!progress.ach[a.id])progress.ach[a.id]=Date.now();
    g.appendChild(el("div",{class:"ach"+(on?" on":"")},[el("div",{class:"em"},[a.em]),el("div",{class:"nm"},[a.nm]),el("div",{class:"ds"},[a.ds])])); });
  return g;
}

/* ============================================================ SEARCH ============================================================ */
let searchQ="";
function renderSearch(){
  const wrap=el("div"); wrap.appendChild(el("div",{class:"section-title"},["Search questions"]));
  const box=el("div",{class:"search-box"});
  const input=el("input",{type:"search",placeholder:"Search stems, choices, explanations…",value:searchQ});
  input.addEventListener("input",e=>{ searchQ=e.target.value; renderResults(); });
  box.appendChild(input); wrap.appendChild(box);
  const results=el("div",{id:"searchResults"}); wrap.appendChild(results);
  mount(wrap);
  setTimeout(()=>{ try{input.focus();}catch(e){} },0);
  renderResults();
  function renderResults(){
    const res=$("#searchResults"); res.innerHTML="";
    const qq=searchQ.trim().toLowerCase();
    if(qq.length<2){ res.appendChild(el("div",{class:"empty"},[el("div",{class:"em"},["⌕"]),el("div",null,["Type at least 2 characters."])])); return; }
    const hl=new RegExp("("+qq.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","ig");
    const matches=[];
    for(const r of INDEX){ const hay=(segText(r.q.stem)+" "+Object.values(r.q.ch).map(segText).join(" ")+" "+segText(r.q.exp)).toLowerCase();
      if(hay.includes(qq)){ matches.push(r); if(matches.length>=60)break; } }
    if(!matches.length){ res.appendChild(el("div",{class:"empty"},[el("div",{class:"em"},["🔍"]),el("div",null,["No matches."])])); return; }
    res.appendChild(el("div",{class:"muted",style:"font-size:13px;margin-bottom:10px"},[matches.length+(matches.length>=60?"+":"")+" results"]));
    const card=el("div",{class:"card"});
    matches.forEach(r=>{ const row=el("div",{class:"row",onclick:()=>{ const sec=SECTIONS.find(s=>s.key===`${r.vol}.${r.su}.${r.sub}`); startSession(sec.refs.slice(),{title:sec.subt,key:sec.key}); session.i=sec.refs.findIndex(x=>x.id===r.id); render(); }});
      row.appendChild(el("div",{class:"idx",style:"font-size:12px"},["SU"+r.su+"."+r.sub]));
      row.appendChild(el("div",{class:"body"},[el("div",{class:"t",html:"Q"+r.n+". "+esc(segText(r.q.stem).slice(0,110)).replace(hl,'<span class="hl">$1</span>')}),el("div",{class:"s"},[r.subt])]));
      row.appendChild(el("div",{class:"chev"},["›"])); card.appendChild(row); });
    res.appendChild(card);
  }
}

/* ---------- shared row ---------- */
function rowItem({idx,title,sub,pct,mini,onclick}){
  const row=el("div",{class:"row",onclick});
  row.appendChild(el("div",{class:"idx"},[String(idx)]));
  const body=el("div",{class:"body"}); body.appendChild(el("div",{class:"t"},[title]));
  if(sub)body.appendChild(el("div",{class:"s"},[sub]));
  if(mini)body.appendChild(el("div",{class:"mini"},[el("div",{class:"fill",style:`width:${pct}%`})]));
  row.appendChild(body);
  if(pct!=null)row.appendChild(el("div",{class:"pct"},[pct+"%"]));
  row.appendChild(el("div",{class:"chev"},["›"]));
  return row;
}
function refreshGlobal(){ const o=overall(); $("#globalProgress").innerHTML=`<div class="fill" style="width:${o.pct}%"></div>`; }

/* ============================================================ Notes modal ============================================================ */
let noteRef=null;
function openNote(ref){ noteRef=ref; $("#noteQ").textContent="Q"+ref.n+" · SU"+ref.su+"."+ref.sub; $("#noteText").value=progress.notes[ref.id]||""; $("#noteModal").hidden=false; }
$("#closeNote").addEventListener("click",()=>$("#noteModal").hidden=true);
$("#saveNote").addEventListener("click",()=>{ if(noteRef){ const v=$("#noteText").value.trim(); if(v)progress.notes[noteRef.id]=v; else delete progress.notes[noteRef.id]; saveProgress(); } $("#noteModal").hidden=true; if(route.name==="practice")render(); toast("Note saved"); });
$("#delNote").addEventListener("click",()=>{ if(noteRef)delete progress.notes[noteRef.id]; saveProgress(); $("#noteModal").hidden=true; if(route.name==="practice")render(); });
$("#closeNav").addEventListener("click",()=>$("#navModal").hidden=true);

/* ============================================================ Chrome ============================================================ */
function back(){
  if(route.name==="practice"){ if(session&&session.meta&&session.meta.key)go({name:"section",key:session.meta.key},{sub:true}); else go({name:"browse"}); return; }
  if(route.name==="testrun"){ if(confirm("Leave test? Progress in this test will be lost.")){ stopTimer(); test=null; $("#examBar").hidden=true; go({name:"tests"}); } return; }
  if(route.name==="testresult"){ go({name:"tests"}); return; }
  if(route.name==="testbuilder"){ go({name:"tests"}); return; }
  if(route.name==="testhistory"){ go({name:"tests"}); return; }
  if(route.name==="section"){ const s=SECTIONS.find(x=>x.key===route.key); go({name:"unit",vol:s.vol,su:s.su},{sub:true}); return; }
  if(route.name==="unit"){ go({name:"browse"}); return; }
  go({name:"home"});
}
$("#backBtn").addEventListener("click",back);
$("#brandBtn").addEventListener("click",()=>go({name:"home"}));
$("#searchBtn").addEventListener("click",()=>go({name:"search"},{sub:true}));

document.querySelectorAll(".bottomnav button, .desk-nav button").forEach(b=>{ b.dataset.nav=b.getAttribute("data-nav");
  b.addEventListener("click",()=>{ const n=b.dataset.nav; go({name:n}); }); });

/* theme + font */
function applyTheme(){ let t=settings.theme; if(t==="auto")t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"; document.documentElement.setAttribute("data-theme",t); }
function applyFont(){ const map={s:.92,m:1,l:1.12}; document.documentElement.style.setProperty("--fs",map[settings.font]||1); }
$("#themeBtn").addEventListener("click",()=>{ settings.theme=(document.documentElement.getAttribute("data-theme")==="dark")?"light":"dark"; saveSettings(); applyTheme(); });
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{ if(settings.theme==="auto")applyTheme(); });

/* settings modal */
const modal=$("#settingsModal");
function openSettings(){ $("#modeSelect").value=settings.mode; $("#themeSelect").value=settings.theme; $("#fontSelect").value=settings.font; $("#shuffleSelect").value=settings.shuffle; $("#paceSelect").value=settings.pace; $("#qCount").textContent=INDEX.length; modal.hidden=false; }
$("#settingsBtn").addEventListener("click",openSettings);
$("#closeSettings").addEventListener("click",()=>modal.hidden=true);
modal.addEventListener("click",e=>{ if(e.target===modal)modal.hidden=true; });
$("#modeSelect").addEventListener("change",e=>{settings.mode=e.target.value;saveSettings();if(route.name==="practice")render();});
$("#themeSelect").addEventListener("change",e=>{settings.theme=e.target.value;saveSettings();applyTheme();});
$("#fontSelect").addEventListener("change",e=>{settings.font=e.target.value;saveSettings();applyFont();});
$("#shuffleSelect").addEventListener("change",e=>{settings.shuffle=e.target.value;saveSettings();if(route.name==="practice")render();});
$("#paceSelect").addEventListener("change",e=>{settings.pace=e.target.value;saveSettings();});

/* export / import / reset */
$("#exportBtn").addEventListener("click",()=>{ const blob=new Blob([JSON.stringify({progress,settings,exported:new Date().toISOString()},null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="cma-p2-progress-"+new Date().toISOString().slice(0,10)+".json"; a.click(); toast("Progress exported"); });
$("#importFile").addEventListener("change",e=>{ const f=e.target.files[0]; if(!f)return; const rd=new FileReader();
  rd.onload=()=>{ try{ const d=JSON.parse(rd.result);
    if(d.progress){ progress=Object.assign({answers:{},flagged:{},notes:{},tests:[],activity:{},conf:{},last:null,ach:{}},d.progress); saveProgress(); }
    if(d.settings){ settings=Object.assign(settings,d.settings); saveSettings(); applyTheme(); applyFont(); }
    toast("Progress imported ✓"); modal.hidden=true; go({name:"home"});
  }catch(err){ toast("Could not read that file"); } };
  rd.readAsText(f); e.target.value=""; });
$("#resetBtn").addEventListener("click",()=>{ if(confirm("Reset ALL progress on this device? This cannot be undone.")){ progress={answers:{},flagged:{},notes:{},tests:[],activity:{},conf:{},last:null,ach:{}}; saveProgress(); toast("Progress reset"); modal.hidden=true; go({name:"home"}); } });

/* exam bar buttons */
$("#ebPause").addEventListener("click",()=>{ if(!test)return; test.paused=!test.paused; $("#ebPause").textContent=test.paused?"▶":"⏸"; toast(test.paused?"Paused":"Resumed"); });
$("#ebSubmit").addEventListener("click",()=>{ if(test&&confirm("Submit test now?"))submitTest(false); });

/* keyboard */
document.addEventListener("keydown",e=>{
  if(e.target.tagName==="SELECT"||e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")return;
  if(route.name==="practice"&&session){ const S=session,ref=S.refs[S.i],q=ref.q,k=e.key.toUpperCase();
    if(["A","B","C","D"].includes(k)&&q.ch[k]){ if(!(S.revealed[ref.id]||(settings.mode==="instant"&&progress.answers[ref.id])))pick(ref,k); }
    else if(e.key==="ArrowRight"||e.key==="Enter"){ if(S.i<S.refs.length-1){S.i++;render();}else finishSession(); }
    else if(e.key==="ArrowLeft"){ if(S.i>0){S.i--;render();} }
    else if(k==="F"){ if(progress.flagged[ref.id])delete progress.flagged[ref.id]; else progress.flagged[ref.id]=1; saveProgress(); render(); }
    else if(k==="N"){ openNote(ref); }
  }
  if(route.name==="testrun"&&test){ const T=test,ref=T.refs[T.i],q=ref.q,k=e.key.toUpperCase();
    if(["A","B","C","D"].includes(k)&&q.ch[k]){ T.picks[ref.id]=k; updateExamBar(); render(); }
    else if(e.key==="ArrowRight"){ if(T.i<T.refs.length-1){T.i++;render();} }
    else if(e.key==="ArrowLeft"){ if(T.i>0){T.i--;render();} }
    else if(k==="F"){ if(T.flag[ref.id])delete T.flag[ref.id]; else T.flag[ref.id]=1; render(); }
  }
});

/* desktop nav */
(function deskNav(){ const nav=el("div",{class:"desk-nav"});
  [["home","Home"],["browse","Browse"],["tests","Tests"],["review","Review"],["stats","Stats"]].forEach(([n,l])=>{ const b=el("button",{"data-nav":n},[l]); b.dataset.nav=n; b.addEventListener("click",()=>go({name:n})); nav.appendChild(b); });
  $("#brandBtn").after(nav);
})();

/* service worker */
if("serviceWorker" in navigator){ window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{})); }

/* debug hook */
window.CMA_APP={go,startMixed,startSession,startTest,buildFullExam,submitTest,resumeLast,INDEX,SECTIONS,ANSWERABLE,overall,weakAreas,get route(){return route;},get test(){return test;},get session(){return session;}};

/* boot */
// Safety net: ensure every modal starts hidden regardless of cached CSS
document.querySelectorAll(".modal-backdrop").forEach(m=>{ m.hidden=true; });
$("#examBar").hidden=true;
applyTheme(); applyFont(); refreshGlobal(); checkAch(); go({name:"home"});

})();
