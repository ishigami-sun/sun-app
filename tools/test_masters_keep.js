// マスタ送信で管理者専用の項目が消えない（v24.2）:
//  サーバーの saveMasters は「送った項目だけ」でシート全体を置き換える。
//  ① staff/admin とも、saveMasters の呼び出しは全部 _mastersPayload()（項目を減らした送信が残っていない）
//  ② staff: クラウドから受け取った経費・給与・技術売上・タオル・staffTypes を控え、送信時にそのまま返す
//  ③ staff: 次の受信にその項目が無くても（別の端末が落としていても）控えを返し続ける
//  ④ admin: 送信に経費・給与・技術売上・タオル・staffTypes が入る
const fs=require('fs');
const checks=[];
function grabFrom(src,n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n);let d=0;
  for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
for(const f of ['staff.html','admin.html']){
  const src=fs.readFileSync('/home/user/sun-app/'+f,'utf8');
  const all=(src.match(/callCloud\('saveMasters'/g)||[]).length;
  const full=(src.match(/callCloud\('saveMasters', \{masters:_mastersPayload\(\)\}/g)||[]).length;
  checks.push([f+': saveMasters は全部 _mastersPayload()（'+full+'/'+all+'）', all>0 && all===full]);
}
// ② ③ staff
{
  const src=fs.readFileSync('/home/user/sun-app/staff.html','utf8');
  Object.assign(global,{ mergeMasterUnique:(a,b)=>b||a, mergeMasterById:(a,b)=>b||a, mergeInventory:(a,b)=>b||a, mergeByMonthKey:(a,b)=>b||a,
    attMerge:(a,b)=>b||a, mergeDeletedMasters(){}, delSetOf:()=>({}), _pushMastersNow(){}, dedupeMenus(){} });
  eval(src.slice(src.indexOf('var ADMIN_ONLY_MASTERS='), src.indexOf(';', src.indexOf('var ADMIN_ONLY_MASTERS='))+1));
  eval(grabFrom(src,'_applyCloudMasters')+'\n'+grabFrom(src,'_mastersPayload'));
  global.state={staff:['A'],menus:[],products:[]};
  _applyCloudMasters({staff:['A','B'],expenses:{'2026-09':{'広告費':1}},laborSales:{'2026-09':{'東':5}},hpsTowel:{'2026-09':{'東':7}},payroll:{x:1},staffTypes:{'A':'stylist'}});
  let p=_mastersPayload();
  checks.push(['staff: 受け取った経費・技術売上・タオル・給与・staffTypes を送信に含める',
    p.expenses&&p.expenses['2026-09']['広告費']===1 && p.laborSales['2026-09']['東']===5 && p.hpsTowel['2026-09']['東']===7 && p.payroll.x===1 && p.staffTypes.A==='stylist' && Array.isArray(p.staff)]);
  _applyCloudMasters({staff:['A','B'],menus:[]});   // 別の端末が落とした後の受信
  p=_mastersPayload();
  checks.push(['staff: 次の受信に無くても控えを返し続ける', p.expenses&&p.expenses['2026-09']['広告費']===1 && p.laborSales['2026-09']['東']===5]);
  global.state={staff:['A']};
  p=_mastersPayload();
  checks.push(['staff: 控えが無ければ余計な項目は付けない', p.expenses===undefined && p.laborSales===undefined && p.reports.length===0]);
}
// ④ admin
{
  const src=fs.readFileSync('/home/user/sun-app/admin.html','utf8');
  eval(grabFrom(src,'_mastersPayload'));
  global.state={expenses:{'2026-09':{'広告費':2}},payroll:{y:1},hpsTowel:{h:1},laborSales:{l:1},staffTypes:{B:'officer'},staff:['B']};
  const p=_mastersPayload();
  checks.push(['admin: 経費・給与・タオル・技術売上・staffTypes を送信に含める', p.expenses['2026-09']['広告費']===2 && p.payroll.y===1 && p.hpsTowel.h===1 && p.laborSales.l===1 && p.staffTypes.B==='officer' && p.staff[0]==='B']);
}
checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
const ok=checks.every(c=>c[1]); console.log('\n'+(ok?'すべて合格':'★失敗あり')); process.exit(ok?0:1);
