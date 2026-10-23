// アルバイトの時給を管理タブで入れる（v25.9・admin）:
//  ① 名前と一緒に時給を入れると、給与設定（_setup.rows）に働き方＝アルバイトの行ができる。出勤簿の一覧（attPtWage）にも出る
//  ② 一覧の欄で時給・通勤費を直すと同じ行が更新される（行は増えない）
//  ③ 給与設定がまだ届いていない端末（同期も10分以内でない）では作らない（クラウドの本物を上書きしないため）
//  ④ オーナー用の合言葉になっていない端末では保存しない
const fs=require('fs');
const src=fs.readFileSync('/home/user/sun-app/admin.html','utf8');
function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n);let d=0;
  for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
let toasts=[];
Object.assign(global,{ showToast:(t)=>toasts.push(t), save(){}, renderAll(){}, renderLaborCost(){}, num:(n)=>Number(n||0).toLocaleString('ja-JP'), h:(s)=>s==null?'':String(s),
  unmarkMasterDeleted(){}, document:{getElementById:(id)=>global._els[id]||null}, _els:{} });
eval(['payrollSetup','payrollRows','staffBase','_ptSetWage','attPtWage','ptList','addPartTimer'].map(grab).join('\n'));
const checks=[];
// ① 既存の給与設定がある端末
global.state={partTimers:[], staff:['石上（代表）'], payroll:{_setup:{rows:[{app:'東',xls:'東',base:1,ot:0,post:0,commute:0}],fixedOnly:[],updatedAt:'2026-10-01T00:00:00.000Z'}}, lastFullSync:Date.now()};
global._els={newPartTimer:{value:'佐藤'}, newPartTimerWage:{value:'1200'}, newPartTimerCommute:{value:'500'}};
addPartTimer();
let R=payrollRows().filter(r=>r.app==='佐藤')[0];
checks.push(['① 名前と時給で登録 → アルバイトの行ができる（時給1200・通勤費500）', state.partTimers[0]==='佐藤' && R && R.kind==='parttime' && R.wage===1200 && R.commute===500 && payrollRows().length===2]);
checks.push(['① 出勤簿の一覧が同じ時給を読む', attPtWage('佐藤').wage===1200 && attPtWage('佐藤').commute===500]);
checks.push(['① 既存の社員の行はそのまま', payrollRows()[0].app==='東' && payrollRows()[0].base===1 && !payrollRows()[0].kind]);
// ②
_ptSetWage('佐藤','1350',null); _ptSetWage('佐藤',null,'0');
R=payrollRows().filter(r=>r.app==='佐藤')[0];
checks.push(['② 一覧の欄で直すと同じ行が更新される（1350・通勤費0・行は2つのまま）', R.wage===1350 && R.commute===0 && payrollRows().length===2]);
checks.push(['② 0円の時給は受け付けない', _ptSetWage('佐藤','0',null)===false && R.wage===1350]);
// ③
global.state={partTimers:[], staff:[], payroll:{}, lastFullSync:0}; toasts=[];
global._els={newPartTimer:{value:'田中'}, newPartTimerWage:{value:'1100'}, newPartTimerCommute:{value:''}};
addPartTimer();
checks.push(['③ 給与設定が届いていない・同期もまだ → 作らない（名前も追加しない）', !payrollSetup() && state.partTimers.length===0 && /同期/.test(toasts.join(''))]);
global.state.lastFullSync=Date.now(); addPartTimer();
checks.push(['③ 同期が通っていれば作る', payrollSetup() && payrollRows()[0].app==='田中' && payrollRows()[0].wage===1100 && state.partTimers[0]==='田中']);
// ④
global.state={partTimers:[], staff:[], payroll:{_setup:{rows:[],fixedOnly:[]}}, lastFullSync:Date.now(), _ownerKeyNeeded:true};
checks.push(['④ オーナー用の合言葉でない端末では保存しない', _ptSetWage('山田','1000',null)===false && payrollRows().length===0]);
checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
const ok=checks.every(c=>c[1]); console.log('\n'+(ok?'すべて合格':'★失敗あり')); process.exit(ok?0:1);
