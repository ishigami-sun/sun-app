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

// ---- ④ 働き方：業務委託（売上×%）とアルバイト（時給×時間） ----
(0,eval)(grab('attWorkMin'));
global.staffBase=x=>String(x||'').replace(/[（(].*$/,'').trim();
{
  const PR=[{app:'社員',xls:'社員',base:200000,ot:0,post:0,commute:0},
            {app:'委託',xls:'委託',kind:'contractor',cRate:40,cBasis:'exc'},
            {app:'委託込',xls:'委託込',kind:'contractor',cRate:50,cBasis:'inc',cProd:true},
            {app:'バイト',xls:'バイト',kind:'parttime',wage:1300,commute:5000},
            {app:'バイト保',xls:'バイト保',kind:'parttime',wage:1500,social:true}];
  const agg={'社員':{menuInc:0,sell:0,profit:0},'委託':{menuInc:1100000,sell:0,profit:0},'委託込':{menuInc:550000,sell:33000,profit:20000},'バイト':{menuInc:0,sell:0,profit:0},'バイト保':{menuInc:0,sell:0,profit:0}};
  const ovr={};
  global.state={payroll:{_setup:{rows:PR,fixedOnly:[],updatedAt:'x'}}, attendance:{
    'バイト（アルバイト）':{'2026-09-02':{status:'出勤',start:'10:00',end:'15:00',brk:60},'2026-09-03':{status:'出勤',start:'10:00',end:'14:30',brk:0},'2026-09-04':{status:'公休',start:'10:00',end:'19:00',brk:0},'2026-10-01':{status:'出勤',start:'10:00',end:'19:00',brk:0}},
    'バイト保':{'2026-09-05':{status:'出勤',start:'09:00',end:'17:00',brk:60}} }};
  global.laborAggregate=()=>agg; global.hpsMap=()=>({}); global.laborSalesMap=()=>ovr;
  global.payrollRows=()=>PR; global.payrollFixedOnly=()=>[];
  let L=laborCostForMonth('2026-09');
  const by=k=>L.rows.find(r=>r.R.app===k);
  t('④業務委託：税抜売上100万×40%＝400,000、社会保険なし', by('委託').pay===400000 && by('委託').social===false);
  t('④業務委託（税込・物販込み）：55万×50%＝275,000＋物販歩合（利益2万×20%＝4,000）', by('委託込').tech===275000 && by('委託込').prod===4000 && by('委託込').pay===279000);
  t('④アルバイト：出勤簿の記録だけ数える（4h＋4.5h＝8.5h、公休と翌月は数えない）', by('バイト').hours===8.5);
  t('④アルバイト：1,300円×8.5h＋通勤費5,000＝16,050', by('バイト').pay===16050);
  t('④アルバイト（社会保険あり）：7h×1,500＝10,500', by('バイト保').pay===10500 && by('バイト保').social===true);
  const g=200000+400000+279000+16050+10500, ns=400000+279000+16050;
  t('④会社負担の社会保険は社員と社会保険ありのアルバイトだけに掛かる', L.grossPay===g && L.company===Math.round((g-ns)*(1+socialRate()))+ns);
  ovr['バイト#h']=20;
  L=laborCostForMonth('2026-09');
  t('④アルバイトの時間を手入力すると、その時間で計算（20h×1,300＋5,000）', by('バイト').pay===31000 && by('バイト').hoursOver===true);
}
// ---- ⑤ 一人ずつの歩合%（tRate）：入っていれば売上（税抜）×%、空なら給与ルール ----
{
  const PR=[{app:'率',xls:'率',base:250000,ot:0,post:0,commute:10000,tRate:12},
            {app:'無',xls:'無',base:0,ot:0,post:0,commute:0},
            {app:'助',xls:'助',base:0,ot:0,post:0,commute:0,assistant:true,tRate:0}];
  const agg={'率':{menuInc:1100000,sell:0,profit:0},'無':{menuInc:880000,sell:0,profit:0},'助':{menuInc:330000,sell:0,profit:0}};
  global.state={payroll:{_setup:{rows:PR,fixedOnly:[],updatedAt:'x'}},attendance:{}};
  global.laborAggregate=()=>agg; global.laborSalesMap=()=>({}); global.payrollRows=()=>PR;
  const L=laborCostForMonth('2026-09'); const by=k=>L.rows.find(r=>r.R.app===k);
  t('⑤歩合12%：税込110万→税抜100万×12%＝120,000＋基本給＋通勤費', by('率').tech===120000 && by('率').pay===380000);
  t('⑤歩合が空なら給与ルール（段階制）で計算＝以前と同じ', by('無').tech===techCommission(800000));
  t('⑤アシスタントも歩合0%を入れれば0', by('助').tech===0);
}
// ---- ⑥ 一人ずつ「売上によって%が変わる」 ----
{
  global.state={payroll:{_rules:null}};
  const D=PAY_RULES_DEFAULT.tech;
  const same={tMode:'tier',tTiers:{mode:'tiered',threshold:D.threshold,tiers:D.tiers}};
  let eq=0; for(let k=0;k<3000;k++){ const x=Math.floor(Math.random()*4000000); if(rowCommission(same,x,'employee')===techCommission(x)) eq++; }
  t('⑥段階を白金台と同じに入れると、共通ルールと1円まで同じ（3000件）', eq===3000);
  const W={tMode:'tier',tTiers:{mode:'whole',threshold:0,tiers:[{upto:1000000,rate:10},{upto:0,rate:20}]}};
  t('⑥売上全体にその%：80万×10%＝80,000／120万×20%＝240,000', rowCommission(W,800000,'employee')===80000 && rowCommission(W,1200000,'employee')===240000);
  const S={tMode:'tier',tTiers:{mode:'tiered',threshold:300000,tiers:[{upto:1000000,rate:10},{upto:0,rate:20}]}};
  t('⑥超えた分だけ：120万＝100万×10%＋20万×20%＝140,000、30万未満は0', rowCommission(S,1200000,'employee')===140000 && rowCommission(S,299999,'employee')===0);
  const C={kind:'contractor',cRate:40,tMode:'tier',tTiers:{mode:'tiered',threshold:0,tiers:[{upto:500000,rate:40},{upto:0,rate:50}]}};
  t('⑥業務委託も段階にできる：80万＝50万×40%＋30万×50%＝350,000', rowCommission(C,800000,'contractor')===350000);
  t('⑥業務委託の一律%は今までどおり', rowCommission({kind:'contractor',cRate:40},1000000,'contractor')===400000);
  const bad=[{tMode:'tier',tTiers:{tiers:[{upto:0,rate:10}]}},{tMode:'tier',tTiers:{tiers:[{upto:500000,rate:10},{upto:300000,rate:20},{upto:0,rate:30}]}},{tMode:'tier',tTiers:{tiers:[{upto:500000,rate:150},{upto:0,rate:20}]}}];
  t('⑥段階が壊れていたら保存時に止める（問題を言葉で返す）', bad.every(b=>_rowTierProblems(b).length>0) && _rowTierProblems(S).length===0);
  t('⑥一律を選んで空なら0%（共通ルールにならない）', rowCommission({tMode:'flat'},1000000,'employee')===0);
  t('⑥何も選んでいない行は今までどおり共通ルール', rowCommission({},800000,'employee')===techCommission(800000));
}
checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
const ok=checks.every(c=>c[1]); console.log('\n'+(ok?'すべて合格':'★失敗あり')); process.exit(ok?0:1);
