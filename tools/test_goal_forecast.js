// 目標タブの着地予想（v25.8）:
//  ① 昨日までの実績÷出勤日数＝1日のペース。今日の分はペースに入れない
//  ② 着地＝昨日までの実績＋ペース×残り日数。残り日数は今日を含み月曜定休を除く。スタッフは 1/6 を公休で引く
//  ③ 実績が無ければ着地は出さない（null）
//  ④ staff / admin で同じ
const fs=require('fs');
function grab(src,n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n);let d=0;
  for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
function run(file,label){
  const src=fs.readFileSync(file,'utf8');
  Object.assign(global,{ menuLineInc:(m)=>m.price, prodLineSell:(p)=>p.sell, num:(n)=>Number(n||0).toLocaleString('ja-JP') });
  eval(['calcFixedActual','goalForecastDays','goalForecast','goalForecastHtml'].map(n=>grab(src,n)).join('\n'));
  const checks=[];
  const n=new Date(), Y=n.getFullYear(), M=n.getMonth(), td=n.getDate();
  const ym=Y+'-'+String(M+1).padStart(2,'0');
  const at=(d,h)=>new Date(Y,M,d,h||12).toISOString();
  // 今日より前の3日（1日・2日・3日）に各10万、今日に5万（今日がその日と被る時は today 扱いになるので避ける）
  const days=[1,2,3].filter(d=>d<td);
  global.state={records:days.map(d=>({time:at(d),staff:'石上（代表）',menus:[{price:100000}],products:[]})).concat([{time:at(td),staff:'石上（代表）',menus:[{price:50000}],products:[]}])};
  const a=calcFixedActual('石上', ym);
  if(days.length===3){
    checks.push(['① 実績は今日の分も含む・ペース用は昨日まで（30万・3日）', a.total===350000 && a.before===300000 && a.daysBefore===3]);
    const FD=goalForecastDays();
    let bizBefore=0, bizLeft=0; for(let d=1;d<=new Date(Y,M+1,0).getDate();d++){ const wd=new Date(Y,M,d).getDay(); if(wd===1) continue; if(d<td) bizBefore++; else bizLeft++; }
    checks.push(['② 営業日の数え方（昨日まで '+bizBefore+'・残り '+bizLeft+'・月曜除く）', FD.bizBefore===bizBefore && FD.bizLeft===bizLeft && FD.staffEst===Math.max(0,bizLeft-Math.round(bizLeft/6))]);
    const fc=goalForecast(a.before, a.daysBefore, FD.staffEst);
    checks.push(['② 着地＝30万＋10万×残り'+FD.staffEst+'日', fc.pace===100000 && fc.forecast===300000+100000*FD.staffEst]);
    const html=goalForecastHtml(fc, 3000000, false);
    checks.push(['表示に着地額と目標比が出る', /着地/.test(html) && html.indexOf('¥'+num(fc.forecast))>=0 && /目標の/.test(html)]);
  } else {
    checks.push(['（月初なので実績3日分のテストはスキップ）', true]);
  }
  checks.push(['③ 実績なしなら出さない', goalForecast(0,0,10)===null && /まだ実績/.test(goalForecastHtml(null,100,false))]);
  console.log('=== '+label+' ==='); checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
  return checks.every(c=>c[1]);
}
const a=run('/home/user/sun-app/staff.html','staff.html'), b=run('/home/user/sun-app/admin.html','admin.html');
console.log('\n'+((a&&b)?'すべて合格':'★失敗あり')); process.exit(a&&b?0:1);
