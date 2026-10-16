// 給与設定（v24.4）: 固定給はクラウドの admin 専用マスタ state.payroll._setup に置く。ダミー値のみ使う。
const fs=require('fs');
const A=fs.readFileSync('/home/user/sun-app/admin.html','utf8');
const S=fs.readFileSync('/home/user/sun-app/staff.html','utf8');
function grab(src,n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n);let d=0;for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
function grabLine(src,start){const i=src.indexOf(start);if(i<0)throw new Error(start);return src.slice(i,src.indexOf(';',i)+1);}
const checks=[]; const t=(n,v)=>checks.push([n,!!v]);

// ダミーのシード（本物の値は使わない）
global._PAYROLL_SEED_ROWS=[{app:'甲',xls:'甲野一郎',row:7,base:100,ot:10,post:5,postName:'手当',commute:1},
                           {app:'乙',xls:'乙川二郎',row:8,base:200,ot:20,post:0,postName:'',commute:2,assistant:true}];
global._PAYROLL_SEED_FIXED=[{name:'丙',amount:300}];
eval(grabLine(A,"var PAYROLL_SEED_AT="));
let saves=0;
global.save=()=>{ saves++; }; let locals=0; global.saveLocal=()=>{ locals++; };
global.window=global; global.toasts=[]; global.showToast=m=>toasts.push(m);
global.renderPayrollExport=()=>{}; global.renderLaborCost=()=>{};
global.h=s=>String(s==null?'':s);
eval(grab(A,'staffBase'));
for(const f of ['payrollSetup','payrollRows','payrollFixedOnly','_ensurePayrollSetup','_psNum','_psVal','_psRead','savePayrollSetup']) eval(grab(A,f));
eval(grab(A,'mergeByMonthKey'));

// a. _setup 無し
global.state={payroll:{}};
t('a: _setup 無し → payrollRows はシード', payrollRows()===_PAYROLL_SEED_ROWS && payrollFixedOnly()===_PAYROLL_SEED_FIXED && payrollSetup()===null);
_ensurePayrollSetup();
t('a: _ensure で _setup ができる', payrollSetup() && payrollSetup().rows.length===2 && payrollSetup().fixedOnly.length===1);
t('a: updatedAt は固定の古い日時', state.payroll._setup.updatedAt==='2026-09-10T00:00:00.000Z');
t('a: 起動時は save() を呼ばない（取り込み前にマスタを送らない）', saves===0);
t('a: saveLocal で端末に保存し、マスタ送信の印を立てる', locals===1 && state._mastersDirty===true);
t('a: シードのディープコピー（同一参照でない）', state.payroll._setup.rows!==_PAYROLL_SEED_ROWS && state.payroll._setup.rows[0]!==_PAYROLL_SEED_ROWS[0]);
state.payroll={}; saves=0; global.state.payroll=null; _ensurePayrollSetup();
t('a: state.payroll が null でも落ちない', payrollSetup()!==null);

// b. _setup 有り
global.state={payroll:{_setup:{rows:[{app:'丁',xls:'丁山',row:9,base:1,ot:2,post:3,postName:'',commute:4}],fixedOnly:[],updatedAt:'2026-10-01T00:00:00.000Z'}}};
saves=0; _ensurePayrollSetup();
t('b: _setup 有りなら何もしない（save 0回）', saves===0 && !state._mastersDirty);
t('b: payrollRows は _setup の値', payrollRows().length===1 && payrollRows()[0].app==='丁');
t('b: fixedOnly が空配列でもそれを使う', payrollFixedOnly().length===0);

// c. mergeByMonthKey
const seedLocal={_setup:{rows:[{app:'旧'}],fixedOnly:[],updatedAt:'2026-09-10T00:00:00.000Z'},'2026-09':{甲:{gross:1,sell:2},updatedAt:'2026-10-02T00:00:00.000Z'}};
const cloudNew={_setup:{rows:[{app:'新'}],fixedOnly:[],updatedAt:'2026-10-10T00:00:00.000Z'}};
let m=mergeByMonthKey(seedLocal,cloudNew);
t('c: クラウドの新しい編集がローカルのシードに勝つ', m._setup.rows[0].app==='新');
t('c: 月キーの値は壊れない', m['2026-09'] && m['2026-09'].甲.gross===1);
m=mergeByMonthKey(seedLocal,{'2026-08':{updatedAt:'2026-09-01T00:00:00.000Z'}});
t('c: クラウドに _setup が無ければローカルが残る', m._setup.rows[0].app==='旧' && m['2026-08']);
m=mergeByMonthKey({_setup:{rows:[{app:'ローカル編集'}],fixedOnly:[],updatedAt:'2026-10-12T00:00:00.000Z'}},cloudNew);
t('c: ローカルの新しい編集はクラウドの古い値に勝つ', m._setup.rows[0].app==='ローカル編集');

// d. 識別子
t('d: admin.html に PAYROLL_ROWS / PAYROLL_FIXED_ONLY が残っていない', !/(^|[^_A-Z])PAYROLL_(ROWS|FIXED_ONLY)\b/.test(A));
t('d: staff.html に給与設定の関数が無い', !/payrollSetup|_ensurePayrollSetup|savePayrollSetup/.test(S));

// e. staff の素通し
const mm=S.match(/var ADMIN_ONLY_MASTERS=\[([^\]]*)\]/);
t('e: staff の ADMIN_ONLY_MASTERS に payroll', mm && /'payroll'/.test(mm[1]));

// f. 数値化と保存
t('f: 全角・カンマ', _psNum('１２３,４５０')===123450);
t('f: ¥とカンマ', _psNum('¥10,000')===10000);
t('f: 負数は0', _psNum('-5000')===0 && _psNum('－５０００')===0 && _psNum('−5')===0);
t('f: 空・文字は0', _psNum('')===0 && _psNum('abc')===0 && _psNum(null)===0);
t('f: 円・全角カンマ', _psNum('１，０００円')===1000);

function mkDom(rows,fixed){
  const els={};
  rows.forEach((r,i)=>{ els['ps_app_'+i]={value:r.app}; els['ps_xls_'+i]={value:r.xls}; els['ps_row_'+i]={value:r.row||'0'};
    els['ps_base_'+i]={value:r.base||'0'}; els['ps_ot_'+i]={value:r.ot||'0'}; els['ps_post_'+i]={value:r.post||'0'};
    els['ps_pn_'+i]={value:r.pn||''}; els['ps_com_'+i]={value:r.com||'0'}; els['ps_as_'+i]={checked:!!r.as}; });
  fixed.forEach((r,i)=>{ els['ps_fname_'+i]={value:r.name}; els['ps_famt_'+i]={value:r.amt}; });
  global.document={getElementById:id=>els[id]||null};
}
global.state={payroll:{}}; saves=0; toasts.length=0;
mkDom([{app:'甲（店長）',xls:'甲野',row:'７',base:'１２３,４５０',ot:'12,345',post:'-1',com:'¥10,000',as:true},
       {app:'',xls:'空行'},{app:'乙',xls:''},{app:'丙',xls:'丙川',base:'1'}],
      [{name:'役員',amt:'¥1,000'},{name:'',amt:'5'}]);
savePayrollSetup();
const sv=state.payroll._setup;
t('f: 保存できる（空のapp/xls行は捨てる）', sv && sv.rows.length===2 && sv.fixedOnly.length===1 && saves===1);
t('f: 数値化が反映', sv && sv.rows[0].base===123450 && sv.rows[0].ot===12345 && sv.rows[0].post===0 && sv.rows[0].commute===10000 && sv.rows[0].row===7);
t('f: app は staffBase で肩書きを外す', sv && sv.rows[0].app==='甲');
t('f: assistant フラグ', sv && sv.rows[0].assistant===true && !sv.rows[1].assistant);
t('f: 固定のみの金額', sv && sv.fixedOnly[0].amount===1000);
t('f: updatedAt は新しい日時', sv && new Date(sv.updatedAt).getTime()>Date.parse('2026-10-16T00:00:00Z'));
// 重複
global.state={payroll:{}}; saves=0; toasts.length=0;
mkDom([{app:'甲',xls:'甲野'},{app:'甲（副店長）',xls:'別人'}],[]);
savePayrollSetup();
t('f: app 重複は拒否（保存しない・トースト）', !state.payroll._setup && saves===0 && toasts.length===1);
mkDom([{app:'',xls:''}],[]); toasts.length=0; savePayrollSetup();
t('f: 有効な行が0なら保存しない', !state.payroll._setup && toasts.length===1);

checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
const ok=checks.every(c=>c[1]); console.log('\n'+(ok?'すべて合格':'★失敗あり')); process.exit(ok?0:1);
