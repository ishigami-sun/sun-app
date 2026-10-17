// P&L の人件費（v24.0）: 給与エクセルの入力（技術売上税抜・物販利益・タオル税込）を与えると、
// 6名の支給見込と給与合計がエクセルと一致する。
// 給与の実額・本名は公開リポジトリに置かない（v24.4）。検証用の値は backups/payroll_fixture.json（非公開）から読む。
//   形式: {rows, fixedOnly, ex, grossPay, fixedOnlyTotal}
const fs=require('fs');
const FX='/home/user/sun-app/backups/payroll_fixture.json';
if(!fs.existsSync(FX)){ console.log('⚠️ フィクスチャが無いのでスキップ（backups/payroll_fixture.json）'); process.exit(0); }
const fx=JSON.parse(fs.readFileSync(FX,'utf8'));
const src=fs.readFileSync('/home/user/sun-app/admin.html','utf8');
function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n);let d=0;for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
eval(src.slice(src.indexOf('var SOCIAL_INSURANCE_RATE='), src.indexOf(';', src.indexOf('var SOCIAL_INSURANCE_RATE='))+1));
// v25.1: 給与ルール（設定値）の計算部分をまとめて読み込む
(0,eval)(src.slice(src.indexOf('/* ===== ⚙️ 給与ルール（v25.1）'), src.indexOf('function hpsMap(')));
eval(grab('laborCostForMonth')); eval(grab('pnlPayroll'));
eval(grab('payrollSetup')); eval(grab('payrollRows')); eval(grab('payrollFixedOnly'));
const EX=fx.ex;
global.laborAggregate=()=>{ const o={}; for(const k in EX) o[k]={menuInc:0,sell:0,profit:EX[k].profit}; return o; };
global.hpsMap=()=>{ const o={}; for(const k in EX) o[k]=EX[k].towel; return o; };
global.laborSalesMap=()=>{ const o={}; for(const k in EX) o[k]=EX[k].sales; return o; };
global.pnlMonthKeys=()=>({keys:['2026-09'],single:true});
global.state={payroll:{_setup:{rows:fx.rows, fixedOnly:fx.fixedOnly, updatedAt:'2026-10-01T00:00:00.000Z'}}};
const pay=pnlPayroll([]);
const checks=[];
let n=0;
for(const r of pay.rows){ if(r.officer) continue; n++; const k=fx.rows.find(x=>x.xls===r.name).app; checks.push(['行'+n+' 支給見込がエクセルと一致', r.sum===EX[k].pay]); }
checks.push(['6名分が全員チェックされた', n===fx.rows.length]);
checks.push(['役員等（固定のみ）が含まれ、合計が一致', pay.rows.filter(r=>r.officer).length===fx.fixedOnly.length && pay.fixedOnly===fx.fixedOnlyTotal]);
checks.push(['給与合計＝エクセルの支給合計（手入力手当を除く）', pay.grossPay===fx.grossPay]);
checks.push(['人件費合計＝給与合計×(1+会社負担率 '+SOCIAL_INSURANCE_RATE+')', pay.total===Math.round(fx.grossPay*(1+SOCIAL_INSURANCE_RATE)) && pay.insurance===pay.total-pay.grossPay]);
checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
const ok=checks.every(c=>c[1]); console.log('\n'+(ok?'すべて合格':'★失敗あり')); process.exit(ok?0:1);
