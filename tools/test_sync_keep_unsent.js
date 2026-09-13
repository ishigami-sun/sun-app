const fs=require('fs');
function run(file,label){
 const src=fs.readFileSync(file,'utf8');
 function grab(name){ const i=src.indexOf('function '+name+'(');
  if(i<0) throw new Error('not found: '+name+' in '+file);
  let d=0; for(let k=src.indexOf('{',i);k<src.length;k++){ if(src[k]==='{')d++; else if(src[k]==='}'){d--; if(!d) return src.slice(i,k+1);} } }
 const g={ showToast(){}, renderAll(){}, updateCloudStatus(){}, saveLocal(){}, isOnline:true,
   LOCAL_RECORD_DAYS:0, syncQueue:[], mergeDeletedMasters(){}, mergeMasterById:(a,b)=>b||a,
   mergeMasterUnique:(a,b)=>b||a, mergeInventory:(a,b)=>b||a, delSetOf:()=>({}),
   mergeByMonthKey:(a,b)=>b||a, dedupeRecordsById(){}, ensureProductMasters(){},
   _isMutation:a=>a==='addRecord'||a==='deleteRecord' };
 Object.assign(global,g);
 global.state={cloudUrl:'https://x/exec',cloudKey:'K',records:[],deletedIds:[],deletedMasters:{}};
 let CLOUD=[{id:1,time:'2026-09-04T02:00:00Z',staff:'東',total:8800}];
 let AUTH=true;
 global.callCloud=function(action,payload,cb){
   if(!AUTH) return cb({ok:false,error:'unauthorized'});
   if(action==='getAll') return cb({ok:true,records:JSON.parse(JSON.stringify(CLOUD)),masters:null});
   if(action==='addRecord'){ CLOUD=CLOUD.filter(r=>String(r.id)!==String(payload.record.id)); CLOUD.push(payload.record); payload.record._cs=1; return cb({ok:true}); }
   if(action==='deleteRecord'){ CLOUD=CLOUD.filter(r=>String(r.id)!==String(payload.id)); return cb({ok:true}); }
   cb({ok:true});
 };
 eval(grab('syncFromCloud')); eval(grab('pushAndSync'));
 eval(grab('unsentRecordCount')); eval(grab('syncPendingCount'));
 const ok=[];
 // ① 正常同期
 syncFromCloud(true,()=>{});
 ok.push(['① 初回同期', JSON.stringify(state.records.map(r=>r.id))==='[1]']);
 // ② 合言葉が違う状態で打ち込む（unauthorizedは再送キューに積まれない）
 AUTH=false;
 state.records.push({id:99,time:'2026-09-05T02:00:00Z',staff:'東',total:12100});
 ok.push(['② 未送信件数が出る', syncPendingCount()===1]);
 // ③ 設定が直って同期 → 消えないこと
 AUTH=true;
 syncFromCloud(true,()=>{});
 ok.push(['③ 同期後も残っている', state.records.some(r=>r.id===99)]);
 // ④ 送信されてクラウドに乗ること
 pushAndSync(()=>{},true);
 ok.push(['④ クラウドに届いた', CLOUD.some(r=>r.id===99)]);
 ok.push(['⑤ 未送信件数が0に戻る', syncPendingCount()===0]);
 // ⑥ 他端末で削除された日報は復活しないこと
 CLOUD=CLOUD.filter(r=>r.id!==99);
 syncFromCloud(true,()=>{});
 ok.push(['⑥ 他端末の削除は復活しない', !state.records.some(r=>r.id===99)]);
 console.log('=== '+label+' ===');
 ok.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
 return ok.every(x=>x[1]);
}
const a=run('/home/user/sun-app/staff.html','staff.html');
const b=run('/home/user/sun-app/admin.html','admin.html');
console.log('\n'+((a&&b)?'すべて合格':'★失敗あり'));
process.exit(a&&b?0:1);
