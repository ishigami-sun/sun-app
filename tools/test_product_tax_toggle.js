// 物販の金額を税抜／税込で打てる（v25.4）:
//  ① 最初は税込（今までどおり。打った数字＝customSell）
//  ② 税抜に切り替えると、打った数字×1.1（四捨五入）が customSell になり、「→税込¥…」が出る
//  ③ 税抜で 2800 と打つと customSell 3080。税込に戻すと打った数字がそのまま customSell
//  ④ 集計（prodLineSell）は常に customSell（税込）を使う
//  ⑤ staff / admin で同じ
const fs=require('fs');
function run(file,label){
  const src=fs.readFileSync(file,'utf8');
  function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n+' in '+file);let d=0;
    for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
  let html='', texts={};
  global.document={getElementById:(id)=>{ if(id==='selectedProductSection') return {style:{}}; if(id==='selectedProductEdit') return {set innerHTML(v){html=v;}, get innerHTML(){return html;}}; return {set textContent(v){texts[id]=v;}, get textContent(){return texts[id];}}; }};
  Object.assign(global,{ renderSummary(){}, renderStaffMiniGrids(){}, resolveCost:(p)=>p.cost, num:(n)=>String(n), h:(s)=>s==null?'':String(s) });
  eval(['renderSelectedProductEdit','updateProductSell','setProductPriceMode','prodLineSell','prodLineProfit'].map(grab).join('\n'));
  const checks=[];
  global.state={selectedProducts:[{id:1,name:'スプレー',cost:1820,sell:3080,customSell:3080,qty:1,discountPct:0}],staff:[]};
  renderSelectedProductEdit();
  const p=state.selectedProducts[0];
  checks.push(['① 最初は税込で入力・customSell はそのまま', /税込で入力/.test(html) && p.customSell===3080 && !/→税込/.test(html.replace(/>→税込¥[^<]*</,''))]);
  setProductPriceMode(0,'exc');
  checks.push(['② 税抜に切り替えると ×1.1 になり →税込 が出る', p.priceMode==='exc' && p.customSell===3388 && /税抜で入力/.test(html) && /→税込¥3388/.test(html)]);
  updateProductSell(0,'2800');
  checks.push(['③ 税抜で 2800 → customSell 3080、表示も更新', p.customSell===3080 && texts['psinc_0']==='→税込¥3080' && texts['pprof_0']==='利益¥1260']);
  setProductPriceMode(0,'inc');
  checks.push(['③ 税込に戻すと打った数字がそのまま', p.customSell===2800 && p.priceMode==='inc']);
  updateProductSell(0,'3080'); setProductPriceMode(0,'exc'); updateProductSell(0,'2800'); p.qty=2;
  checks.push(['④ 集計は customSell（税込）×個数', prodLineSell(p)===6160 && prodLineProfit(p)===6160-1820*2]);
  console.log('=== '+label+' ==='); checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
  return checks.every(c=>c[1]);
}
const a=run('/home/user/sun-app/staff.html','staff.html'), b=run('/home/user/sun-app/admin.html','admin.html');
console.log('\n'+((a&&b)?'すべて合格':'★失敗あり')); process.exit(a&&b?0:1);
