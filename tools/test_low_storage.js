// 容量不足×差分同期（v23.8）:
//  ① level3 で日報を外したら _lowStorage が立ち、syncSince / lastFullPullAt が 0 に戻る（次は全件から）
//  ② _recordDays(): 通常は LOCAL_RECORD_DAYS、容量不足の端末は 60（admin の 0=全件 でも 60）
//  ③ 端末の日報が0件なら、syncSince があっても getSince ではなく getAll から始める
const fs=require('fs');
function run(file,label,localDays){
 const src=fs.readFileSync(file,'utf8');
 function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n+' in '+file);let d=0;
  for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
 Object.assign(global,{ showToast(){}, renderAll(){}, saveLocal(){}, dedupeRecordsById(){}, syncQueue:[], window:{},
   mergeMasterUnique:(a,b)=>b||a, mergeMasterById:(a,b)=>b||a, mergeInventory:(a,b)=>b||a, mergeByMonthKey:(a,b)=>b||a,
   attMerge:(a,b)=>b||a, mergeDeletedMasters(){}, delSetOf:()=>({}), _pushMastersNow(){}, dedupeMenus(){} });
 global.LOCAL_RECORD_DAYS=localDays;
 eval(['_recordDays','_shrinkForQuota','_pendingDeletes','_confirmDeletesAgainst','syncFromCloud','_syncFromCloudDelta','_syncFromCloudFull','_applyFullResponse','_applyCloudMasters'].map(grab).join('\n'));
 const checks=[];
 // ①
 global.state={_csReady:1, syncSince:12345, lastFullPullAt:Date.now(), records:[{id:1,_cs:1},{id:2,_cs:1},{id:3}], deletedIds:[]};
 const shrunk=_shrinkForQuota(3);
 checks.push(['level3: 届いた日報を外し、未送信は残す', shrunk===true && state.records.length===1 && state.records[0].id===3]);
 checks.push(['level3: 次は全件から（syncSince=0, lastFullPullAt=0, _lowStorage あり）', state.syncSince===0 && state.lastFullPullAt===0 && state._lowStorage>0]);
 // ②
 global.state={};
 const normal=_recordDays();
 global.state={_lowStorage:Date.now()};
 const low=_recordDays();
 checks.push(['_recordDays: 通常は設定どおり（'+localDays+'）', normal===localDays]);
 checks.push(['_recordDays: 容量不足の端末は60日', low===60]);
 // ③
 let calls=[];
 global.callCloud=(a,p,cb)=>{ calls.push(a); cb({ok:true,records:[{id:9}],masters:null,now:777}); };
 global.state={cloudUrl:'https://x/exec',cloudKey:'K',records:[],deletedIds:[],syncSince:5000,lastFullPullAt:Date.now()};
 syncFromCloud(true,()=>{});
 checks.push(['端末が0件なら差分ではなく全件（getAll）から', calls[0]==='getAll' && state.records.length===1]);
 console.log('=== '+label+' ==='); checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
 return checks.every(c=>c[1]);
}
const a=run('/home/user/sun-app/staff.html','staff.html',150), b=run('/home/user/sun-app/admin.html','admin.html',0);
console.log('\n'+((a&&b)?'すべて合格':'★失敗あり')); process.exit(a&&b?0:1);
