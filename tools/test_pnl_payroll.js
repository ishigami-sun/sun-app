// P&L の人件費（v24.0）: 給与エクセル R8.9度 の入力（技術売上税抜・物販利益・タオル税込）を与えると、
// 6名の支給見込と給与合計がエクセルと一致する（林の早朝手当1,000円は手入力項目なので除く）
const fs=require('fs');
const src=fs.readFileSync('/home/user/sun-app/admin.html','utf8');
function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n);let d=0;for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
function grabVar(n){const i=src.indexOf('var '+n+'=');if(i<0)throw new Error(n);const j=src.indexOf('];',i);return src.slice(i,j+2);}
eval(grabVar('PAYROLL_ROWS')); eval(grabVar('PAYROLL_FIXED_ONLY'));
eval(src.slice(src.indexOf('var ASSISTANT_RATE='), src.indexOf(';', src.indexOf('var ASSISTANT_RATE='))+1));
eval(src.slice(src.indexOf('var SOCIAL_INSURANCE_RATE='), src.indexOf(';', src.indexOf('var SOCIAL_INSURANCE_RATE='))+1));
eval(grab('techCommission')); eval(grab('payrollRate')); eval(grab('laborCostForMonth')); eval(grab('pnlPayroll'));
// エクセル R8.9度 の入力値
const EX={ '花岡':{sales:1313755, profit:32381, towel:91300, pay:588680},
           '堀井':{sales:1652339, profit:33308, towel:12980, pay:640754},
           '東':  {sales:1904735, profit:33485, towel:27610, pay:730210},
           '梅田':{sales:71000,  profit:14693, towel:0,     pay:271138},
           'カノン':{sales:268700,profit:37640, towel:0,     pay:319032},
           '林':  {sales:1363040, profit:18384, towel:893,  pay:560154-1000} };  // 早朝手当1,000は除く
global.laborAggregate=()=>{ const o={}; for(const k in EX) o[k]={menuInc:0,sell:0,profit:EX[k].profit}; return o; };
global.hpsMap=()=>{ const o={}; for(const k in EX) o[k]=EX[k].towel; return o; };
global.laborSalesMap=()=>{ const o={}; for(const k in EX) o[k]=EX[k].sales; return o; };
global.pnlMonthKeys=()=>({keys:['2026-09'],single:true});
global.state={};
const pay=pnlPayroll([]);
const checks=[];
for(const r of pay.rows){ if(r.officer) continue; const k=PAYROLL_ROWS.find(x=>x.xls===r.name).app; checks.push([r.name+' 支給見込 '+r.sum.toLocaleString(), r.sum===EX[k].pay]); }
checks.push(['役員2名（固定）が含まれる', pay.rows.filter(r=>r.officer).length===2 && pay.fixedOnly===1685000]);
checks.push(['給与合計＝エクセルの支給合計（早朝手当除く）4,793,968', pay.grossPay===4793968]);
checks.push(['人件費合計＝給与合計×1.155', pay.total===Math.round(4793968*1.155) && pay.insurance===pay.total-pay.grossPay]);
checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
const ok=checks.every(c=>c[1]); console.log('\n'+(ok?'すべて合格':'★失敗あり')); process.exit(ok?0:1);
