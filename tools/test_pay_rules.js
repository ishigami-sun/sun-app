// v25.1: 給与ルールの設定化。
//  ① 設定が無い時（初期値）は、v25.0 までの計算式と1円も変わらないこと（ランダム入力で突き合わせ）
//  ② 設定を変えた時に、選んだ計算方式どおりに計算されること
//  ③ 壊れた設定は使わず初期値に戻ること
const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','admin.html'),'utf8');
function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n);let d=0;for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
global.num=x=>Number(x).toLocaleString('ja-JP');
global.state={payroll:{}};
(0,eval)(src.slice(src.indexOf('/* ===== ⚙️ 給与ルール（v25.1）'), src.indexOf('function hpsMap(')));
(0,eval)(grab('laborCostForMonth'));
const checks=[]; const t=(n,v)=>checks.push([n,!!v]);

// ---- v25.0 までの式（そのまま写したもの） ----
function oldTech(sales){
  var s=Math.max(0, Math.round(sales||0));
  if(s<500000) return 0;
  var t=0;
  t+=Math.floor(500000*0.135);
  t+=Math.floor(Math.min(Math.max(s-500000,0),500000)*0.15);
  t+=Math.floor(Math.min(Math.max(s-1000000,0),500000)*0.30);
  t+=Math.floor(Math.min(Math.max(s-1500000,0),500000)*0.35);
  t+=Math.floor(Math.min(Math.max(s-2000000,0),1000000)*0.40);
  t+=Math.floor(Math.max(s-3000000,0)*0.45);
  return t;
}
function oldRate(j){ if(!j) return 0; if(j<30000) return 0.2; if(j<50000) return 0.3; if(j<80000) return 0.35; return 0.4; }
function oldLabor(agg, towel, ovr, PR, FO){
  var rows=[], totalPay=0, totalSales=0;
  for(var pi=0;pi<PR.length;pi++){
    var R=PR[pi], a=agg[R.app]||{menuInc:0,sell:0,profit:0};
    var estSales=Math.round(a.menuInc/1.1);
    var sales=(ovr[R.app]!=null)?ovr[R.app]:estSales;
    var tech = R.assistant ? Math.floor(sales*0.2) : oldTech(sales);
    var profit=Math.round(a.profit), rate=oldRate(profit), prod=Math.floor(profit*rate);
    var tw=towel[R.app]||0, hps=Math.round(Math.ceil(tw/1.1*0.1)*0.8);
    var fixed=R.base+R.ot+R.post+R.commute;
    var pay=fixed+tech+prod+hps;
    totalPay+=pay; totalSales+=sales;
    rows.push({sales,tech,profit,rate,prod,hps,fixed,pay});
  }
  var fixedOnly=0; for(var fi=0;fi<FO.length;fi++) fixedOnly+=FO[fi].amount;
  var grossPay=totalPay+fixedOnly;
  return {rows,totalPay,totalSales,fixedOnly,grossPay,company:Math.round(grossPay*(1+0.116))};
}

// ---- ① 初期値は v25.0 と同じ ----
let seed=12345; const rnd=()=>{ seed=(seed*1103515245+12345)%2147483648; return seed/2147483648; };
const edges=[0,1,499999,500000,500001,999999,1000000,1500000,2000000,2999999,3000000,3000001,7654321];
let bad=0;
for(const s of edges) if(techCommission(s)!==oldTech(s)) bad++;
for(let i=0;i<20000;i++){ const s=Math.floor(rnd()*5000000); if(techCommission(s)!==oldTech(s)) bad++; }
t('①技術歩合：境目＋ランダム2万件で v25.0 と一致', bad===0);
bad=0;
for(const j of [0,1,-500,29999,30000,49999,50000,79999,80000,250000]){ if(productCommission(j).amount!==Math.floor(j*oldRate(j)) || productCommission(j).rate!==oldRate(j)) bad++; }
for(let i=0;i<20000;i++){ const j=Math.floor(rnd()*200000)-1000; if(productCommission(j).amount!==Math.floor(j*oldRate(j))) bad++; }
t('①物販歩合：境目＋ランダム2万件で v25.0 と一致（率も）', bad===0);
bad=0;
for(let i=0;i<20000;i++){ const tw=Math.floor(rnd()*300000); if(hpsPay(tw)!==Math.round(Math.ceil(tw/1.1*0.1)*0.8)) bad++; }
t('①タオル（HPS）手当：ランダム2万件で一致', bad===0);
t('①アシスタント率・社会保険率が以前の定数と同じ値', assistantRate()===0.2 && socialRate()===0.116);
// 人件費の月計算（スタッフ・売上・物販・タオル・手入力売上をランダムに）
bad=0;
for(let trial=0;trial<300;trial++){
  const PR=[], FO=[{name:'役員A',amount:Math.floor(rnd()*900000)}], agg={}, towel={}, ovr={};
  const n=1+Math.floor(rnd()*7);
  for(let k=0;k<n;k++){
    const app='S'+k;
    PR.push({app, xls:'X'+k, base:Math.floor(rnd()*300000), ot:Math.floor(rnd()*50000), post:Math.floor(rnd()*30000), commute:Math.floor(rnd()*20000), assistant:rnd()<0.25});
    agg[app]={menuInc:Math.floor(rnd()*3500000), sell:Math.floor(rnd()*150000), profit:Math.floor(rnd()*120000)};
    if(rnd()<0.5) towel[app]=Math.floor(rnd()*100000);
    if(rnd()<0.3) ovr[app]=Math.floor(rnd()*3000000);
  }
  global.state={payroll:{_setup:{rows:PR, fixedOnly:FO, updatedAt:'2026-10-01T00:00:00.000Z'}}};
  global.laborAggregate=()=>agg; global.hpsMap=()=>towel; global.laborSalesMap=()=>ovr;
  global.payrollRows=()=>PR; global.payrollFixedOnly=()=>FO;
  const A=laborCostForMonth('2026-09'), B=oldLabor(agg,towel,ovr,PR,FO);
  if(A.totalPay!==B.totalPay||A.grossPay!==B.grossPay||A.company!==B.company||A.totalSales!==B.totalSales) bad++;
  for(let r=0;r<A.rows.length;r++){ const a=A.rows[r], b=B.rows[r]; for(const f of ['sales','tech','profit','rate','prod','hps','fixed','pay']) if(a[f]!==b[f]) bad++; }
}
t('①人件費の月計算：ランダム300か月分で全項目が v25.0 と一致', bad===0);

// ---- ② 設定を変えると、選んだ方式で計算される ----
function withRules(mut){ const r=JSON.parse(JSON.stringify(PAY_RULES_DEFAULT)); mut(r); r.updatedAt='2026-10-17T00:00:00.000Z'; global.state={payroll:{_rules:r}}; }
withRules(r=>{ r.tech={basis:'exc',mode:'whole',threshold:0,round:'floor',tiers:[{upto:500000,rate:30},{upto:1000000,rate:40},{upto:0,rate:50}]}; });
t('②全額方式：40万→30%で120,000／80万→40%で320,000／120万→50%で600,000',
  techCommission(400000)===120000 && techCommission(800000)===320000 && techCommission(1200000)===600000);
const nt=nextTechTier(450000);
t('②全額方式：次の段階までの差額と増える額', nt && nt.need===50000 && nt.gain===(200000-135000));
withRules(r=>{ r.tech.threshold=0; r.tech.tiers=[{upto:0,rate:10}]; });
t('②1つの率（10%・足切りなし）：12,345→1,234', techCommission(12345)===1234);
withRules(r=>{ r.tech.round='round'; r.tech.threshold=0; r.tech.tiers=[{upto:0,rate:10}]; });
t('②端数を四捨五入：12,345→1,235', techCommission(12345)===1235);
withRules(r=>{ r.tech.basis='inc'; });
t('②税込で計算：施術110万(税込)の元の売上は110万', techBaseFromInc(1100000)===1100000 && techBasisLabel()==='税込');
withRules(r=>{});
t('②税抜で計算（初期値）：施術110万(税込)の元の売上は100万', techBaseFromInc(1100000)===1000000);
withRules(r=>{ r.product={basis:'sell_exc',mode:'tiered',threshold:0,round:'floor',tiers:[{upto:100000,rate:10},{upto:0,rate:20}]}; });
t('②物販：売上(税抜)×段階積み上げ：税込16.5万→税抜15万→10,000+10,000', productCommission(productBase(165000,999)).amount===20000);
t('②物販：積み上げ方式では「あと少しで率が上がる」は出さない', nextProductTier(90000)===null);
withRules(r=>{ r.hps.on=false; });
t('②タオル手当をオフにすると0円', hpsPay(110000)===0 && !hpsOn());
withRules(r=>{ r.combine='max'; });
t('②固定給と歩合の多い方：固定20万・歩合15万→20万／歩合25万→25万（＋タオル手当は別に足す）',
  payTotal(200000,100000,50000,0)===200000 && payTotal(200000,200000,50000,1000)===251000);
withRules(r=>{ r.assistant.rate=25; r.social=15; });
t('②アシスタント率25%・社会保険15%', assistantRate()===0.25 && socialRate()===0.15);

// ---- ③ 壊れた設定は使わない ----
const broken=[
  r=>{ r.tech.tiers=[]; },
  r=>{ r.tech.tiers=[{upto:500000,rate:10},{upto:400000,rate:20},{upto:0,rate:30}]; },  // 上限が逆順
  r=>{ r.tech.tiers=[{upto:500000,rate:10}]; },                                           // 最後に「上限なし」が無い
  r=>{ r.product.tiers[0].rate=150; },                                                    // 100%超
  r=>{ r.tech.mode='xxx'; },
  r=>{ r.combine='?'; },
  r=>{ r.social=-1; },
];
let fb=0;
for(const m of broken){ withRules(m); if(payRules()===PAY_RULES_DEFAULT && techCommission(800000)===oldTech(800000)) fb++; }
t('③壊れた設定（7種類）は使わず、初期値で計算する', fb===broken.length);
global.state={payroll:{_rules:null}};
t('③設定が無い時は初期値', payRulesIsDefault());

checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
const ok=checks.every(c=>c[1]); console.log('\n'+(ok?'すべて合格':'★失敗あり')); process.exit(ok?0:1);
