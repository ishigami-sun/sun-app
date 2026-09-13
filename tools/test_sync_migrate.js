// v22.6以前の端末が v22.7 に上がった直後の最初の同期を再現する
const fs=require('fs');
function run(file,label){
 const src=fs.readFileSync(file,'utf8');
 function grab(n){const i=src.indexOf('function '+n+'(');let d=0;
  for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
 Object.assign(global,{showToast(){},renderAll(){},updateCloudStatus(){},saveLocal(){},isOnline:true,
  LOCAL_RECORD_DAYS:0,syncQueue:[],mergeDeletedMasters(){},mergeMasterById:(a,b)=>b||a,
  mergeMasterUnique:(a,b)=>b||a,mergeInventory:(a,b)=>b||a,delSetOf:()=>({}),
  mergeByMonthKey:(a,b)=>b||a,dedupeRecordsById(){},ensureProductMasters(){}});
 const LAST=Date.parse('2026-09-13T00:00:00Z');
 // 端末のローカル: ①クラウドにもある日報 ②他端末で削除済み（古い） ③直近に打ち込んだ未送信
 global.state={cloudUrl:'https://x/exec',cloudKey:'K',lastSync:LAST,deletedIds:[],deletedMasters:{},
   records:[
     {id:Date.parse('2026-09-10T01:00:00Z'),staff:'林',total:1000},              // クラウドにもある
     {id:Date.parse('2026-09-11T01:00:00Z'),staff:'林',total:2000},              // 他端末で削除済み
     {id:Date.parse('2026-09-13T05:00:00Z'),staff:'東',total:3000}               // 未送信
   ]};
 const CLOUD=[{id:Date.parse('2026-09-10T01:00:00Z'),staff:'林',total:1000}];
 global.callCloud=(a,p,cb)=>a==='getAll'?cb({ok:true,records:JSON.parse(JSON.stringify(CLOUD)),masters:null}):cb({ok:true});
 eval(grab('syncFromCloud'));
 syncFromCloud(true,()=>{});
 const ids=state.records.map(r=>r.id);
 const keptSynced=ids.includes(Date.parse('2026-09-10T01:00:00Z'));
 const noZombie =!ids.includes(Date.parse('2026-09-11T01:00:00Z'));
 const keptUnsent=ids.includes(Date.parse('2026-09-13T05:00:00Z'));
 console.log('=== '+label+' ===');
 console.log((keptSynced?'✅':'❌')+' クラウドにある日報は残る');
 console.log((noZombie ?'✅':'❌')+' 他端末で削除済みの古い日報は復活しない');
 console.log((keptUnsent?'✅':'❌')+' 最後の通信より後に打ち込んだ未送信の日報は残る');
 return keptSynced&&noZombie&&keptUnsent;
}
const a=run('/home/user/sun-app/staff.html','staff.html');
const b=run('/home/user/sun-app/admin.html','admin.html');
console.log('\n'+((a&&b)?'すべて合格':'★失敗あり'));
process.exit(a&&b?0:1);
