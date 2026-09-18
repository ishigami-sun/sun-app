// 合言葉の自己修復（v23.2）:
//  ① 古い #k= リンクで開いても、動いている合言葉が上書きされない
//  ② 合言葉が無い端末なら #k= をそのまま採用する
//  ③ 貼り付けた合言葉がサーバーに断られたら保存しない
//  ④ unauthorized になったら「前に通った合言葉」に戻して1回だけやり直す
const fs=require('fs');
function run(file,label){
 const src=fs.readFileSync(file,'utf8');
 function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n+' in '+file);let d=0;
  for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
 // サーバー: 正しい合言葉は GOOD だけ
 const GOOD='SUN-good', OLD='SUN-old';
 global.fetch=(u,o)=>{ const b=JSON.parse(o.body); const ok=(b.key===GOOD);
   return Promise.resolve({ text:()=>Promise.resolve(JSON.stringify(ok?{ok:true,records:[]}:{ok:false,error:'unauthorized'})) }); };
 global.CLOUD_URL='https://script.google.com/macros/s/X/exec';
 global._cleanCloudUrl=u=>{const m=String(u||'').match(/https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec/);return m?m[0]:'';};
 let toasts=[]; global.showToast=t=>toasts.push(t);
 global.saveLocal=()=>{}; global.updateCloudStatus=()=>{}; global.syncFromCloud=()=>{};
 let syncAllCalls=0; global.syncAll=()=>{syncAllCalls++;};
 global.setTimeout=(fn,ms)=>{ if(ms<1000) fn(); return 1; };   // 12秒のタイムアウトは無視
 global.history={replaceState(){}}; global.location={hash:'',pathname:'/staff.html',search:''};
 global.syncAuthFailed=()=>/unauthorized/i.test(String(global.state.lastSyncError||''));
 global.syncAuthFailedRaw=global.syncAuthFailed;   // v23.5 で fin は生判定を使う
 eval('var _goodKeyTried=false; var _syncAllBusy=false;');
 eval(grab('_probeKey')); eval(grab('applySetupKey'));
 const tick=()=>new Promise(r=>setImmediate(r));
 return (async()=>{
  const checks=[];
  // ① 動いている端末（GOOD）で、古いリンク #k=OLD を開く → 上書きされない
  global.state={cloudKey:GOOD, cloudUrl:CLOUD_URL, lastSyncError:''};
  global.location.hash='#k='+OLD;
  // #k= ハンドラは即時実行ブロックなので、if(...){ ... } を波かっこの対応で切り出して評価する
  const hs=src.indexOf("if(location.hash && location.hash.indexOf('#k=')===0){");
  let he=src.indexOf('{',hs), depth=0;
  for(let k=he;k<src.length;k++){ if(src[k]==='{')depth++; else if(src[k]==='}'){depth--; if(!depth){ he=k+1; break; }} }
  eval('try{'+src.slice(hs, he)+'}catch(e){}');
  await tick(); await tick();
  checks.push(['古いリンクで開いても動いている合言葉は残る', state.cloudKey===GOOD && toasts.some(t=>/古いので使いません/.test(t))]);
  // ② 合言葉が無い端末では #k= をそのまま採用
  global.state={cloudKey:'', cloudUrl:'', lastSyncError:''}; global.location.hash='#k='+OLD; toasts=[];
  eval('try{'+src.slice(hs, he)+'}catch(e){}');
  await tick();
  checks.push(['合言葉が無い端末は #k= をそのまま採用', state.cloudKey===OLD]);
  // ③ 貼り付けた合言葉が断られたら保存しない
  global.state={cloudKey:GOOD, cloudUrl:CLOUD_URL, lastSyncError:''}; toasts=[];
  applySetupKey(OLD, CLOUD_URL);
  await tick(); await tick();
  checks.push(['断られる合言葉は貼り付けても保存しない', state.cloudKey===GOOD && toasts.some(t=>/断られました/.test(t))]);
  // ③b 正しい合言葉なら保存して同期する
  global.state={cloudKey:OLD, cloudUrl:CLOUD_URL, lastSyncError:''}; syncAllCalls=0;
  applySetupKey(GOOD, CLOUD_URL);
  await tick(); await tick();
  checks.push(['通る合言葉は保存して同期する', state.cloudKey===GOOD && syncAllCalls===1]);
  // ④ fin(false,'unauthorized') で lastGoodKey に戻して1回だけやり直す
  const fs2=src.indexOf('  var fin=function(ok, err){'); const fe=src.indexOf('  };', fs2)+4;
  global.state={cloudKey:OLD, cloudUrl:CLOUD_URL, lastGoodKey:GOOD, lastGoodUrl:CLOUD_URL, lastSyncError:''};
  syncAllCalls=0; toasts=[];
  eval('var silent=true; var _finDone=false; var _adoptTried=false; var _goodKeyTried=false;'+src.slice(fs2,fe)+'; fin(false,"unauthorized");');
  checks.push(['断られたら前に通った合言葉に戻してやり直す', state.cloudKey===GOOD && syncAllCalls===1 && state.lastSyncError==='']);
  // ④b 2回目は往復しない（同じ状態でもう一度 fin(false) → 戻さない）
  global.state={cloudKey:OLD, cloudUrl:CLOUD_URL, lastGoodKey:GOOD, lastGoodUrl:CLOUD_URL, lastSyncError:''}; syncAllCalls=0;
  eval('var silent=true; var _finDone=false; var _adoptTried=false; var _goodKeyTried=true;'+src.slice(fs2,fe)+'; fin(false,"unauthorized");');
  checks.push(['戻すのは1回だけ（無限に往復しない）', state.cloudKey===OLD && syncAllCalls===0]);
  console.log('=== '+label+' ==='); checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
  return checks.every(c=>c[1]);
 })();
}
(async()=>{
 const a=await run('/home/user/sun-app/staff.html','staff.html');
 const b=await run('/home/user/sun-app/admin.html','admin.html');
 console.log('\n'+((a&&b)?'すべて合格':'★失敗あり')); process.exit(a&&b?0:1);
})();
