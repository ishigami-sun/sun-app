// 容量いっぱいの端末で、設定が消えないことを確認する
const fs=require('fs');
function run(file,KEY,label){
 const src=fs.readFileSync(file,'utf8');
 function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n+' in '+file);let d=0;
  for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
 // 容量2KBだけの localStorage を用意する
 const store={};
 const LIMIT=2000;
 global.localStorage={
   getItem:k=>(k in store?store[k]:null),
   setItem:(k,v)=>{ const other=Object.entries(store).filter(([kk])=>kk!==k).reduce((s,[kk,vv])=>s+kk.length+vv.length,0);
     if(other+k.length+String(v).length>LIMIT){ const e=new Error('quota'); e.name='QuotaExceededError'; throw e; }
     store[k]=String(v); },
   removeItem:k=>{delete store[k];}
 };
 let toasts=[];
 global.showToast=t=>toasts.push(t);
 global._costCache={}; global.syncQueue=[]; global.LOCAL_RECORD_DAYS=150;
 global._quotaWarned=false;
 const big=[]; for(let i=0;i<400;i++) big.push({id:1000+i, time:'2026-09-01T00:00:00Z', total:10000, _cs:1, pad:'x'.repeat(50)});
 big.push({id:99999, time:'2026-09-14T00:00:00Z', total:8800, pad:'y'.repeat(50)});   // 未送信（_cs なし）
 global.state={ cloudUrl:'https://script.google.com/macros/s/AAA/exec', cloudKey:'TESTKEY',
   cloudUrlCustom:false, cloudKeyCustom:true, _csReady:1, records:big, deletedIds:[] };
 eval(grab('_shrinkForQuota')); eval(grab('_saveCloudConf')); eval(grab('_loadCloudConf')); eval(grab('saveLocal'));
 saveLocal();
 const confSaved = !!store[KEY+'_conf'];
 const unsentKept = (state.records||[]).some(r=>r.id===99999);
 // 端末を開き直す（本体は保存できていない想定）
 const saved=store[KEY];
 global.state={ cloudUrl:'', cloudKey:'', records:[] };
 try{ if(saved){ const p=JSON.parse(saved); for(const k in p) state[k]=p[k]; } }catch(e){}
 _loadCloudConf();
 const checks=[
   ['設定が別枠に保存される', confSaved],
   ['未送信の日報は端末に残る', unsentKept],
   ['開き直しても合言葉が残る', state.cloudKey==='TESTKEY'],
   ['開き直しても保存先が残る', state.cloudUrl.indexOf('/exec')>0]
 ];
 console.log('=== '+label+' ===');
 checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
 console.log('   本体の保存: '+(saved?'成功（縮小して通った）':'失敗（容量不足）')+' ／ 端末に残った日報: '+(state.records||[]).length+'件');
 return checks.every(c=>c[1]);
}
const a=run('/home/user/sun-app/staff.html','sun_cloud_staff','staff.html');
const b=run('/home/user/sun-app/admin.html','sun_cloud_admin','admin.html');
console.log('\n'+((a&&b)?'すべて合格':'★失敗あり'));
process.exit(a&&b?0:1);
