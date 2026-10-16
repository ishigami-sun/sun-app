// v24.6: 管理タブの月の選択肢（給与集計・人件費）が、取り込み前に作られて「今月だけ」で固まらないこと
const fs=require('fs'); const A=fs.readFileSync('/home/user/sun-app/admin.html','utf8');
function g(n){const i=A.indexOf('function '+n+'(');let d=0;for(let k=A.indexOf('{',i);k<A.length;k++){if(A[k]==='{')d++;else if(A[k]==='}'){d--;if(!d)return A.slice(i,k+1);}}}
const c=[]; const t=(n,v)=>c.push([n,!!v]);
t('一度きりの作成（!sel.dataset.filled）が残っていない', !/!sel\.dataset\.filled/.test(A));
t('給与集計は月の一覧が変わったら作り直す', /sel\.dataset\.filled!==months\.join\(','\)/.test(g('renderPayrollExport')));
t('人件費も月の一覧が変わったら作り直す', /sel\.dataset\.filled!==months\.join\(','\)/.test(g('renderLaborCost')));
t('同期後の renderAll が管理タブを描き直す（入力中は除く）', /page-admin/.test(g('renderAll')) && /renderPayrollExport\(\)/.test(g('renderAll')) && /activeElement/.test(g('renderAll')));
// 動きの確認（DOM を最小限スタブ）
const sel={value:'',dataset:{},options:[],set innerHTML(h){ this._h=h; this.options=[...h.matchAll(/value="([^"]+)"/g)].map(m=>({value:m[1]})); }, get innerHTML(){return this._h;}};
global.document={getElementById:id=>id==='payrollMonth'?sel:(id==='payrollExport'?{set innerHTML(v){}}:null)};
global.state={records:[]}; global.h=s=>String(s); global.staffBase=s=>s; global.recYMD=r=>r.d;
eval(g('payrollMonthList')); eval(g('payrollDefaultMonth'));
const src=g('renderPayrollExport'); const head=src.slice(0, src.indexOf('var ym='));
eval(head.replace('function renderPayrollExport(){','function _fill(){')+'}');
_fill(); const first=sel.options.length;
state.records=[{d:'2026-08-03'},{d:'2026-09-10'}]; _fill();
t('取り込み後に作り直されて過去の月が増える', first===1 && sel.options.length===3);
sel.value='2026-08'; state.records.push({d:'2026-07-01'}); _fill();
t('自分で選んだ月は作り直しても残る', sel.value==='2026-08' && sel.options.length===4);
c.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n)); const ok=c.every(x=>x[1]); console.log('\n'+(ok?'すべて合格':'★失敗あり')); process.exit(ok?0:1);
