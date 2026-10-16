// v24.4: 新しい端末（一度も取り込みに成功していない）では、saveMastersToCloud がマスタを送らないこと。
// saveMasters はクラウドのマスタを送った内容で丸ごと置き換えるため、取り込み前の空マスタを送ると
// 経費・給与などがクラウドから消える（模擬サーバーで admin / staff とも再現した不具合）。
const fs=require('fs');
function grab(src,n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n);let d=0;for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
const checks=[]; const t=(n,v)=>{checks.push([n,!!v]);};
for(const f of ['admin.html','staff.html']){
  const src=fs.readFileSync('/home/user/sun-app/'+f,'utf8');
  let calls=[], locals=0, cbRes=null;
  global.callCloud=(a,p,cb)=>{ calls.push(a); cb && cb({ok:true,masters:{}}); };
  global.saveLocal=()=>{ locals++; };
  global._mastersPayload=()=>({});
  global.mergeDeletedMasters=()=>{}; global.mergeMasterById=(a)=>a; global.delSetOf=()=>({});
  eval(grab(src,'saveMastersToCloud')); eval(grab(src,'_pullReportsThenPush')); eval(grab(src,'_pushMastersNow'));
  // 新しい端末
  global.state={cloudUrl:'u',cloudKey:'k',lastFullSync:0};
  saveMastersToCloud(r=>{cbRes=r;});
  t(f+': 新しい端末では通信しない（saveMasters を送らない）', calls.length===0);
  t(f+': 送信の印（_mastersDirty）を立てて端末に保存する', state._mastersDirty===true && locals===1);
  t(f+': コールバックには「保留」を返す', cbRes && cbRes.ok===false && cbRes.deferred===true);
  // 取り込み済みの端末（従来どおり：取得→送信）
  calls=[]; cbRes=null; global.state={cloudUrl:'u',cloudKey:'k',lastFullSync:Date.now()};
  saveMastersToCloud(r=>{cbRes=r;});
  t(f+': 取り込み済みの端末は従来どおり getAll → saveMasters', calls.join(',')==='getAll,saveMasters' && cbRes && cbRes.ok===true);
  // 接続設定が無い端末は何もしない（従来どおり）
  calls=[]; global.state={cloudUrl:'',cloudKey:'',lastFullSync:0}; saveMastersToCloud();
  t(f+': 接続設定が無ければ何もしない', calls.length===0 && !state._mastersDirty);
}
// admin と staff で同じ中身であること
const A=fs.readFileSync('/home/user/sun-app/admin.html','utf8'), S=fs.readFileSync('/home/user/sun-app/staff.html','utf8');
t('saveMastersToCloud は admin と staff で同一', grab(A,'saveMastersToCloud')===grab(S,'saveMastersToCloud'));
checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
const ok=checks.every(c=>c[1]); console.log('\n'+(ok?'すべて合格':'★失敗あり')); process.exit(ok?0:1);
