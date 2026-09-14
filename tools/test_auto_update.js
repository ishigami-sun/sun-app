// 自動更新: 入力中でなければ勝手に切り替わる／入力中なら待つ／同じ版で無限ループしない
const fs=require('fs');
function run(file,label){
 const src=fs.readFileSync(file,'utf8');
 function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n+' in '+file);let d=0;
  for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
 const ss={}; global.sessionStorage={getItem:k=>ss[k]||null,setItem:(k,v)=>{ss[k]=String(v);}};
 let navigated=[]; global.location={href:'https://x/staff.html#k=abc', reload(){navigated.push('reload');}};
 Object.defineProperty(global.location,'href',{get(){return 'https://x/staff.html';},set(v){navigated.push(v);}});
 let els={customerName:{value:''}}; let active={tagName:'BODY'};
 global.document={getElementById:id=>els[id]||null, get activeElement(){return active;}, visibilityState:'visible', body:{appendChild(){}}, createElement:()=>({style:{},remove(){}}), head:{appendChild(){}}};
 global.state={selectedMenus:[],selectedProducts:[],editInlineId:null};
 global.window={caches:undefined}; global.flushSave=()=>{}; global.showToast=()=>{};
 let banners=0; global.showUpdateBanner=()=>{banners++;};
 global.APP_VERSION='23.1'; global._verNum=v=>{const p=String(v).split('.');return (+p[0]||0)*10000+(+p[1]||0);};
 let timers=[]; global.setTimeout=(fn,ms)=>{timers.push(fn);return timers.length;};
 let response='{"version":"23.2"}';
 global.XMLHttpRequest=function(){ this.open=()=>{}; this.send=()=>{ this.status=200; this.responseText=response; this.onload(); }; };
 eval('var _pendingUpdateVer="";'); eval(grab('_isUserBusy')); eval(grab('applyUpdate')); eval(grab('_retryPendingUpdate')); eval(grab('checkForUpdate'));
 const flush=()=>{ const t=timers.slice(); timers=[]; t.forEach(f=>f()); };
 const checks=[];
 // ① 手が空いている → 自動で切り替わる（帯は出ない）
 checkForUpdate(); flush();
 checks.push(['手が空いていれば自動で切り替わる', navigated.length===1 && /\?v=/.test(navigated[0]) && banners===0]);
 // ② 同じ版をもう一度見つけても再リロードしない（ループ防止）
 checkForUpdate(); flush();
 checks.push(['同じ版で無限ループしない', navigated.length===1]);
 // ③ さらに新しい版・入力中 → 帯だけ出して待つ
 response='{"version":"23.3"}'; els.customerName.value='山田';
 checkForUpdate(); flush();
 checks.push(['入力中は切り替えず帯を出す', navigated.length===1 && banners===1 && _pendingUpdateVer==='23.3']);
 // ④ 入力が終わったら自動で当たる
 els.customerName.value=''; _retryPendingUpdate(); flush();
 checks.push(['入力が終わると自動で当たる', navigated.length===2 && _pendingUpdateVer==='']);
 // ⑤ 古い版・同じ版なら何もしない
 response='{"version":"23.1"}'; checkForUpdate(); flush();
 checks.push(['同じ版なら何もしない', navigated.length===2]);
 // ⑥ 画面が見えていない時は触らない
 response='{"version":"23.4"}'; document.visibilityState='hidden'; checkForUpdate(); flush();
 checks.push(['画面が見えていない時は待つ', navigated.length===2 && _pendingUpdateVer==='23.4']);
 console.log('=== '+label+' ==='); checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
 return checks.every(c=>c[1]);
}
const a=run('/home/user/sun-app/staff.html','staff.html'), b=run('/home/user/sun-app/admin.html','admin.html');
console.log('\n'+((a&&b)?'すべて合格':'★失敗あり')); process.exit(a&&b?0:1);
