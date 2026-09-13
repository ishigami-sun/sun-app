const fs=require('fs');
function run(file,label){
 const src=fs.readFileSync(file,'utf8');
 function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n+' in '+file);let d=0;
  for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
 global.renderInlineEditor=()=>{};
 global.state={editBuf:{time:'2026-09-13T12:40:00.000Z', customerName:'テスト', staff:''}, staff:['東（数字リーダー）']};
 eval(grab('_p2')); eval(grab('editBufDate')); eval(grab('_editSetWhen'));
 eval(grab('editSetDate')); eval(grab('editSetTime')); eval(grab('editSetStaff'));
 const ymd=()=>{const d=new Date(state.editBuf.time);return d.getFullYear()+'-'+_p2(d.getMonth()+1)+'-'+_p2(d.getDate())+' '+_p2(d.getHours())+':'+_p2(d.getMinutes());};
 const before=ymd();
 editSetDate('2026-09-05');
 const afterDate=ymd();
 editSetTime('14:29');
 const afterTime=ymd();
 editSetStaff('東（数字リーダー）');
 const checks=[
   ['日付だけ変えても時刻は保たれる', afterDate.slice(0,10)==='2026-09-05' && afterDate.slice(11)===before.slice(11)],
   ['時刻を変えると反映される',       afterTime==='2026-09-05 14:29'],
   ['担当者が入る',                   state.editBuf.staff==='東（数字リーダー）'],
   ['おかしな日付は無視する',         (editSetDate('abc'), ymd()==='2026-09-05 14:29')]
 ];
 console.log('=== '+label+' ===');
 checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
 return checks.every(c=>c[1]);
}
const a=run('/home/user/sun-app/staff.html','staff.html');
const b=run('/home/user/sun-app/admin.html','admin.html');
console.log('\n'+((a&&b)?'すべて合格':'★失敗あり'));
process.exit(a&&b?0:1);
