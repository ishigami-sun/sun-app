// v24.5: 保存容量がいっぱいの端末でも、画面用の日報（state.records）を減らさないこと。
// 以前は保存のたびに state 本体から日報を外していたため、同期するたびに画面の日報が0件になり、
// 売上・人件費・給与集計が0、月の選択肢が今月だけになっていた（10/16、石上さんの携帯）。
const fs=require('fs');
function run(file,KEY,label){
 const src=fs.readFileSync(file,'utf8');
 function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n+' in '+file);let d=0;
  for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
 const checks=[]; const t=(n,v)=>checks.push([n,!!v]);
 function mkStore(LIMIT){ const store={}; global.localStorage={
   getItem:k=>(k in store?store[k]:null),
   setItem:(k,v)=>{ const other=Object.entries(store).filter(([kk])=>kk!==k).reduce((s,[kk,vv])=>s+kk.length+vv.length,0);
     if(other+k.length+String(v).length>LIMIT){ const e=new Error('quota'); e.name='QuotaExceededError'; throw e; } store[k]=String(v); },
   removeItem:k=>{delete store[k];} }; return store; }
 global.showToast=()=>{}; global._costCache={}; global.syncQueue=[]; global._quotaWarned=false; global._quotaLevel=0; global.MEM_KEEP_ALL_ON_LOW_STORAGE=true;
 eval(grab('_recordDays')); eval(grab('_memRecordDays')); eval(grab('_shrinkForQuota')); eval(grab('_saveCloudConf')); eval(grab('_loadCloudConf')); eval(grab('saveLocal'));
 const now=Date.now(), day=86400000;
 function mk(){ const a=[];
   for(let i=0;i<300;i++) a.push({id:'old'+i, time:new Date(now-200*day).toISOString(), total:1, _cs:1, pad:'x'.repeat(40)});   // 200日前（届いた）
   for(let i=0;i<100;i++) a.push({id:'new'+i, time:new Date(now-10*day).toISOString(), total:1, _cs:1, pad:'x'.repeat(40)});    // 10日前（届いた）
   a.push({id:'unsentOld', time:new Date(now-300*day).toISOString(), total:1, pad:'y'});   // 古いが未送信
   a.push({id:'unsent', time:new Date(now-1*day).toISOString(), total:1, pad:'y'});         // 未送信
   return a; }
 // A: 60日に切り詰めれば入る容量（level2 まで）
 global.LOCAL_RECORD_DAYS=0;
 let store=mkStore(14000);
 global.state={cloudUrl:'https://x/exec',cloudKey:'K',_csReady:1,records:mk(),syncSince:5,lastFullPullAt:now,_rcRows:[{a:'z'.repeat(500)}]};
 saveLocal();
 let saved=JSON.parse(store[KEY]||'null');
 t(label+' A: 画面用の日報は1件も減らない', state.records.length===402);
 t(label+' A: 保存は60日分＋未送信だけ（古い届いた分は保存から外す）', saved && saved.records.length===102 && saved.records.some(r=>r.id==='unsentOld'));
 t(label+' A: 容量不足の印が付く（以後60日）', state._lowStorage>0 && saved._lowStorage>0);
 t(label+' A: 保存から外した時は、次に開いた時に全件から（保存側 syncSince=0）。画面側は変えない', saved.syncSince===0 && saved.lastFullPullAt===0 && state.syncSince===5);
 t(label+' A: 照合結果の表示用キャッシュは保存しない', saved && saved._rcRows===undefined && state._rcRows && state._rcRows.length===1);
 // B: 届いた日報を全部外さないと入らない容量（level3）
 global.syncQueue=[]; global._quotaWarned=false; global._quotaLevel=0;
 store=mkStore(3000);
 global.state={cloudUrl:'https://x/exec',cloudKey:'K',_csReady:1,records:mk(),syncSince:5,lastFullPullAt:now};
 saveLocal();
 saved=JSON.parse(store[KEY]||'null');
 t(label+' B: 画面用の日報は1件も減らない', state.records.length===402);
 t(label+' B: 保存には未送信の日報だけ残る', saved && saved.records.length===2 && saved.records.every(r=>!r._cs));
 t(label+' B: 次に開いた時は全件から（保存側の syncSince=0・lastFullPullAt=0）', saved && saved.syncSince===0 && saved.lastFullPullAt===0);
 t(label+' B: 画面側の同期状態は変えない（この起動中は差分のまま正しい）', state.syncSince===5);
 t(label+' B: 設定は別枠に残る', !!store[KEY+'_conf']);
 // B2: 2回目の保存は、通った段階から始める（毎回全体を試して重くならない）
 let attempts=0; const origSet=localStorage.setItem; localStorage.setItem=(k,v)=>{ if(k===KEY) attempts++; return origSet(k,v); };
 saveLocal();
 t(label+' B2: 2回目は通った段階から1回で保存できる', attempts===1 && _quotaLevel===3);
 // C: 容量に余裕がある時は今までどおり全部保存（新しく開いた想定で段階は0から）
 global.syncQueue=[]; global._quotaLevel=0; store=mkStore(10000000);
 global.state={cloudUrl:'https://x/exec',cloudKey:'K',_csReady:1,records:mk(),syncSince:5,lastFullPullAt:now,_rcRows:[1]};
 saveLocal(); saved=JSON.parse(store[KEY]);
 t(label+' C: 余裕があれば全部保存（照合結果も残る）', saved.records.length===402 && saved._rcRows && !saved._lowStorage);
 return checks;
}
const all=[...run('/home/user/sun-app/admin.html','sun_cloud_admin','admin'), ...run('/home/user/sun-app/staff.html','sun_cloud_staff','staff')];
const A=fs.readFileSync('/home/user/sun-app/admin.html','utf8'), S=fs.readFileSync('/home/user/sun-app/staff.html','utf8');
function g(src,n){const i=src.indexOf('function '+n+'(');let d=0;for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
for(const [src,lbl,days] of [[A,'admin',0],[S,'staff',150]]){
  const m=src.match(/var LOCAL_RECORD_DAYS\s*=\s*(\d+)/); global.LOCAL_RECORD_DAYS=Number(m[1]);
  const f=src.match(/var MEM_KEEP_ALL_ON_LOW_STORAGE\s*=\s*(true|false)/); global.MEM_KEEP_ALL_ON_LOW_STORAGE=(f[1]==='true');
  global.state={_lowStorage:Date.now()}; eval(g(src,'_memRecordDays')); eval(g(src,'_recordDays'));
  const lowMem=_memRecordDays(); global.state={}; const normMem=_memRecordDays(); global.state={_lowStorage:Date.now()};
  if(lbl==='admin') all.push([lbl+': 容量不足でも画面は全期間（'+m[1]+'=全件）・保存は60日', lowMem===0 && normMem===0 && _recordDays()===60]);
  else all.push([lbl+': 容量不足の端末は画面も60日（開くたびの全件取り込みを避ける）・通常は'+m[1]+'日', lowMem===60 && normMem===Number(m[1])]);
  all.push([lbl+': syncAll は lastFullPullAt=0 なら60秒以内でも省略しない', /if\(silent && state\.lastFullSync && state\.lastFullPullAt && \(Date\.now\(\)-state\.lastFullSync\) < 60\*1000\) return;/.test(g(src,'syncAll'))]);
  all.push([lbl+': 画面の切り詰めに _recordDays を使っていない', !/if\(_recordDays\(\)>0\)/.test(src)]);
}
all.push(['_shrinkForQuota は admin と staff で同一', g(A,'_shrinkForQuota')===g(S,'_shrinkForQuota')]);
all.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
const ok=all.every(c=>c[1]); console.log('\n'+(ok?'すべて合格':'★失敗あり')); process.exit(ok?0:1);
