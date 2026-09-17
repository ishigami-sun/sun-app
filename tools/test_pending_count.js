// 未送信バナーの件数（v23.4）:
//  ① 届いた日報（_cs印あり）がキューに残っていても数えない・キューから外す
//  ② 送れた時は、送った控えが別オブジェクトでも本体に印が付き、キューから外れる
//  ③ 本当に届いていないものだけを数える
const fs=require('fs');
function run(file,label){
 const src=fs.readFileSync(file,'utf8');
 function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n+' in '+file);let d=0;
  for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
 global._isMutation=a=>a==='addRecord'||a==='deleteRecord'||a==='saveMasters'||a==='bulkImport';
 global.state={ _csReady:1, cloudUrl:'https://script.google.com/macros/s/X/exec', cloudKey:'K',
   records:[ {id:1,total:100,_cs:1}, {id:2,total:200}, {id:3,total:300,_cs:1} ] };
 // 1は届いているのにキューに残っている／2は本当に未送信／9は削除（deletedIdsで送るのでキュー不要）
 global.syncQueue=[ {action:'addRecord',payload:{record:{id:1}}}, {action:'addRecord',payload:{record:{id:2}}}, {action:'deleteRecord',payload:{id:9}} ];
 eval(grab('_queueRecId')); eval(grab('_markDelivered')); eval(grab('_pruneDeliveredQueue'));
 eval(grab('unsentRecordCount')); eval(grab('syncPendingCount'));
 const checks=[];
 const n1=syncPendingCount();
 checks.push(['届いている分・削除分は数えない（本当の未送信1件だけ）', n1===1 && syncQueue.length===1 && String(_queueRecId(syncQueue[0]))==='2']);
 // ② callCloud 成功: 送った控えは別オブジェクト（キューから復元した想定）
 global.isOnline=true; global.normalizeCloudConfig=()=>false; global.saveLocal=()=>{}; global.updateCloudStatus=()=>{};
 global._enqueueRetry=()=>{}; global.IS_VIEW_ONLY=false; global.VIEW_ONLY_READS={getAll:1};
 global.fetch=()=>Promise.resolve({ status:200, text:()=>Promise.resolve(JSON.stringify({ok:true})) });
 eval(grab('callCloud'));
 return new Promise(res=>{
   callCloud('addRecord', {record:{id:2,total:200}}, function(){
     const rec2=state.records.find(r=>r.id===2);
     checks.push(['送れたら本体にも印が付く（控えが別物でも）', rec2._cs===1]);
     checks.push(['送れたらキューから外れて件数0', syncPendingCount()===0 && syncQueue.length===0]);
     console.log('=== '+label+' ==='); checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
     res(checks.every(c=>c[1]));
   });
 });
}
(async()=>{
 const a=await run('/home/user/sun-app/staff.html','staff.html');
 const b=await run('/home/user/sun-app/admin.html','admin.html');
 console.log('\n'+((a&&b)?'すべて合格':'★失敗あり')); process.exit(a&&b?0:1);
})();
