// 認証エラーの赤帯（v23.5）:
//  ① 1回・2回の unauthorized では赤く出さない（生判定は真）
//  ② 3回続き、最後の成功から10分以上たつと赤く出す
//  ③ 3回でも最後の成功が10分以内なら出さない
//  ④ 「key」「認証」を含むだけの別のエラーは認証エラー扱いにしない
//  ⑤ fin: 失敗ごとに authFails が増え、3回未満なら60秒後の再試行を予約。成功で0に戻る
const fs=require('fs');
function run(file,label){
 const src=fs.readFileSync(file,'utf8');
 function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n+' in '+file);let d=0;
  for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
 eval(grab('syncAuthFailedRaw')); eval(grab('syncAuthFailed'));
 const NOW=Date.now(), checks=[];
 global.state={lastSyncError:'unauthorized', authFails:1, lastFullSync:NOW-3600e3, lastSync:0};
 checks.push(['1回目は赤く出さない（生判定は真）', syncAuthFailedRaw()===true && syncAuthFailed()===false]);
 state.authFails=2; checks.push(['2回目も出さない', syncAuthFailed()===false]);
 state.authFails=3; checks.push(['3回続き・最後の成功が1時間前 → 出す', syncAuthFailed()===true]);
 state.lastFullSync=NOW-5*60e3; checks.push(['3回でも最後の成功が5分前なら出さない', syncAuthFailed()===false]);
 state={lastSyncError:'サーバー応答がJSONではありません keyboard 認証', authFails:5, lastFullSync:0, lastSync:0};
 checks.push(['「key」「認証」を含むだけの別エラーは認証扱いしない', syncAuthFailedRaw()===false && syncAuthFailed()===false]);
 // ⑤ fin
 const fs2=src.indexOf('  var fin=function(ok, err){'); const fe=src.indexOf('  };', fs2)+4;
 let timers=[]; global.setTimeout=(fn,ms)=>{timers.push(ms);return 1;};
 global.isOnline=true; global.saveLocal=()=>{}; global.updateCloudStatus=()=>{}; global.showToast=()=>{};
 global.syncAll=()=>{}; global.CLOUD_URL='https://x/exec';
 global.state={cloudKey:'K', cloudUrl:CLOUD_URL, lastGoodKey:'K', lastGoodUrl:CLOUD_URL, lastSyncError:'', authFails:0, records:[]};
 const mk=()=>eval('var silent=true; var _finDone=false; var _adoptTried=true; var _goodKeyTried=true; var _syncAllBusy=true;'+src.slice(fs2,fe)+'; fin');
 mk()(false,'unauthorized'); mk()(false,'unauthorized');
 checks.push(['失敗2回で authFails=2、60秒後の再試行を2回予約', state.authFails===2 && timers.filter(t=>t===60000).length===2]);
 mk()(false,'unauthorized');
 checks.push(['3回目は再試行を予約しない（5分ごとの自動同期に任せる）', state.authFails===3 && timers.filter(t=>t===60000).length===2]);
 mk()(true);
 checks.push(['成功したら authFails=0 に戻る', state.authFails===0 && state.lastSyncError==='']);
 console.log('=== '+label+' ==='); checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
 return checks.every(c=>c[1]);
}
const a=run('/home/user/sun-app/staff.html','staff.html'), b=run('/home/user/sun-app/admin.html','admin.html');
console.log('\n'+((a&&b)?'すべて合格':'★失敗あり')); process.exit(a&&b?0:1);
