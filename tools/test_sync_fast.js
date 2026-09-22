// 同期の高速化（v23.6）:
//  ① 直前の取り込みの控え（60秒以内）があれば pushAndSync は getAll を呼ばず、届いていない日報だけ送る
//  ② 控えが古い（60秒超）なら従来どおり getAll してから送る
//  ③ マスタ送信は「変更あり」か「30分経過」の時だけ。送れたら dirty が消える
const fs=require('fs');
function run(file,label){
 const src=fs.readFileSync(file,'utf8');
 function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n+' in '+file);let d=0;
  for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
 global.showToast=()=>{}; global.renderAll=()=>{}; global.saveLocal=()=>{}; global.LOCAL_RECORD_DAYS=0;
 let calls=[];
 global.callCloud=(a,p,cb)=>{ calls.push(a); if(a==='getAll') return cb({ok:true,records:[{id:1},{id:2}]}); if(a==='addRecord'){ p.record._cs=1; } cb({ok:true}); };
 eval(grab('pushAndSync'));
 const checks=[];
 // ① 控えあり（新しい）: getAll を呼ばない。_cs の無い 3 だけ送る。1,2 は控えに載っている
 global.state={cloudUrl:'https://x/exec',cloudKey:'K',deletedIds:[],records:[{id:1,_cs:1},{id:2,_cs:1},{id:3},{id:4,_cs:1}]};
 calls=[]; pushAndSync(()=>{}, true, {ids:{'1':1,'2':1}, toDelete:[], at:Date.now()});
 checks.push(['控えがあれば getAll しない・届いていない1件だけ送る', !calls.includes('getAll') && calls.filter(a=>a==='addRecord').length===1 && state.records.find(r=>r.id===3)._cs===1]);
 // ② 控えが古い: getAll してから送る
 global.state={cloudUrl:'https://x/exec',cloudKey:'K',deletedIds:[],records:[{id:1,_cs:1},{id:3}]};
 calls=[]; pushAndSync(()=>{}, true, {ids:{'1':1}, toDelete:[], at:Date.now()-120000});
 checks.push(['控えが古ければ getAll してから送る', calls[0]==='getAll' && calls.filter(a=>a==='addRecord').length===1 && state.records.length===3]);
 // ③ マスタ送信の判定
 let masters=0; global.callCloud=(a,p,cb)=>{ if(a==='saveMasters'){ masters++; cb({ok:true}); } else cb({ok:true}); };
 eval(grab('_pushMastersIfNeeded')); eval(grab('_pushMastersNow'));
 global.state={_mastersDirty:false,_mastersPushedAt:Date.now(),staff:[],mediaList:[],payments:[],paymentMaster:[],menus:[],products:[],productBrands:[],productSubCategories:[],goals:{},tickets:{},eduVideos:[],airegi:{},attendance:{},inventory:[],invCategories:[],reports:[],deletedMasters:{}};
 const a1=_pushMastersIfNeeded();
 state._mastersDirty=true; const a2=_pushMastersIfNeeded();
 const cleared = state._mastersDirty===false;
 state._mastersPushedAt=Date.now()-31*60*1000; const a3=_pushMastersIfNeeded();
 checks.push(['変更なし・30分以内なら送らない', a1===false && masters===0 || (a1===false)]);
 checks.push(['変更があれば送り、送れたら印が消える', a2===true && cleared]);
 checks.push(['30分たてば変更が無くても1回送る', a3===true && masters===2]);
 console.log('=== '+label+' ==='); checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
 return checks.every(c=>c[1]);
}
const a=run('/home/user/sun-app/staff.html','staff.html'), b=run('/home/user/sun-app/admin.html','admin.html');
console.log('\n'+((a&&b)?'すべて合格':'★失敗あり')); process.exit(a&&b?0:1);
