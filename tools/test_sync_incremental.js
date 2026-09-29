// 差分同期（v23.7）:
//  ① 初回（syncSince=0）は全件 getAll。サーバーの now を次回の起点にする
//  ② 2回目以降は getSince。追加・置換・削除だけを適用し、起点を進める
//  ③ noChange なら何も変えず、起点だけ進める（getAll は呼ばない）
//  ④ サーバーが getSince を知らない（unknown action）→ 全件に戻り、1時間は全件で動く
//  ⑤ 最後の全件から24時間たったら全件を取り直す
//  ⑥ 差分にマスタ（報告など）が含まれていれば統合される
//  ⑦ サーバーが full:true で全件を返してきたら全件として扱う
const fs=require('fs');
function run(file,label){
 const src=fs.readFileSync(file,'utf8');
 function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n+' in '+file);let d=0;
  for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
 Object.assign(global,{ showToast(){}, renderAll(){}, saveLocal(){}, dedupeRecordsById(){}, LOCAL_RECORD_DAYS:0, syncQueue:[], window:{},
   mergeMasterUnique:(a,b)=>b||a, mergeMasterById:(a,b)=>b||a, mergeInventory:(a,b)=>b||a, mergeByMonthKey:(a,b)=>b||a,
   attMerge:(a,b)=>b||a, mergeDeletedMasters(){}, delSetOf:()=>({}), _pushMastersNow(){}, dedupeMenus(){} });
 // 関数宣言をこの run() のスコープに置くため、まとめて1回の eval にする（コールバック内の eval だと外から見えない）
 eval(['_pendingDeletes','_confirmDeletesAgainst','syncFromCloud','_syncFromCloudDelta','_syncFromCloudFull','_applyFullResponse','_applyCloudMasters'].map(grab).join('\n'));
 let calls=[], script=[];
 global.callCloud=(a,p,cb)=>{ calls.push({a,p}); const r=script.shift(); cb(typeof r==='function'?r(a,p):r); };
 const checks=[], ids=()=>state.records.map(r=>r.id).sort();
 // ①
 global.state={cloudUrl:'https://x/exec',cloudKey:'K',records:[],deletedIds:[],syncSince:0};
 calls=[]; script=[{ok:true,records:[{id:1},{id:2}],masters:null,now:1000}];
 syncFromCloud(true,()=>{});
 checks.push(['初回は全件 getAll、起点=サーバーの now', calls[0].a==='getAll' && String(ids())==='1,2' && state.records.every(r=>r._cs===1) && state.syncSince===1000 && state.lastFullPullAt>0]);
 // ②
 calls=[]; script=[{ok:true,now:2000,records:[{id:3},{id:2,total:99}],deleted:['1']}];
 syncFromCloud(true,()=>{});
 checks.push(['2回目は getSince(since=前回)。追加・置換・削除だけ適用', calls[0].a==='getSince' && calls[0].p.since===1000 && String(ids())==='2,3' && state.records.find(r=>r.id===2).total===99 && state.syncSince===2000 && state._delConfirmed['1']===1]);
 // ③
 calls=[]; script=[{ok:true,noChange:true,now:3000}];
 syncFromCloud(true,()=>{});
 checks.push(['変化なしなら何も変えず起点だけ進める', calls.length===1 && calls[0].a==='getSince' && String(ids())==='2,3' && state.syncSince===3000]);
 // ⑥ マスタ入り差分
 calls=[]; script=[{ok:true,now:3500,records:[],deleted:[],masters:{reports:[{id:'r1'}]}}];
 syncFromCloud(true,()=>{});
 checks.push(['差分に報告が入っていれば統合される', state.reports && state.reports[0] && state.reports[0].id==='r1' && state.syncSince===3500]);
 // ④
 calls=[]; script=[{ok:false,error:'unknown action'},{ok:true,records:[{id:2},{id:3}],masters:null}];
 syncFromCloud(true,()=>{});
 checks.push(['サーバーが未対応なら全件に戻る', calls[0].a==='getSince' && calls[1].a==='getAll' && state._noGetSince>0]);
 calls=[]; script=[{ok:true,records:[{id:2},{id:3}],masters:null,now:4000}];
 syncFromCloud(true,()=>{});
 checks.push(['未対応と分かった後1時間は全件で動く', calls[0].a==='getAll']);
 // ⑤
 state._noGetSince=0; state.syncSince=4000; state.lastFullPullAt=Date.now()-25*3600*1000;
 calls=[]; script=[{ok:true,records:[{id:2},{id:3}],masters:null,now:5000}];
 syncFromCloud(true,()=>{});
 checks.push(['24時間たったら全件を取り直す', calls[0].a==='getAll' && state.syncSince===5000]);
 // ⑦
 calls=[]; script=[{ok:true,full:true,records:[{id:7}],masters:null,now:6000}];
 syncFromCloud(true,()=>{});
 checks.push(['full:true が返れば全件として扱う', calls[0].a==='getSince' && String(ids())==='7' && state.syncSince===6000]);
 console.log('=== '+label+' ==='); checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
 return checks.every(c=>c[1]);
}
const a=run('/home/user/sun-app/staff.html','staff.html'), b=run('/home/user/sun-app/admin.html','admin.html');
console.log('\n'+((a&&b)?'すべて合格':'★失敗あり')); process.exit(a&&b?0:1);
