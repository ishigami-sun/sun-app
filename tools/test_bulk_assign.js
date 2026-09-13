const fs=require('fs');
const src=fs.readFileSync('/home/user/sun-app/admin.html','utf8');
function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n);let d=0;
 for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
let toasts=[],sent=[];
global.showToast=t=>toasts.push(t);
global.confirm=()=>true;
global.saveLocal=()=>{}; global.renderAll=()=>{};
global.callCloud=(a,p,cb)=>{ if(a==='addRecord') sent.push(p.record.id); cb({ok:true}); };
global.state={ staff:['東（数字リーダー）','林（副店長）'], records:[
  {id:1, staff:'',  menus:[{name:'カット'}], products:[{name:'A'}]},
  {id:2, staff:'林（副店長）', menus:[{name:'カラー',menuStaff:'林（副店長）'}], products:[]},
  {id:3, staff:'',  menus:[{name:'パーマ'}], products:[]},
  {id:4, staff:'',  menus:[{name:'カット'}], products:[]}   // 画面に出ていない担当者なし
]};
global.window={_unassignedIds:[1,2,3]};   // 画面に出ているのは 1,2,3
eval(grab('bulkAssignStaff'));
bulkAssignStaff('東（数字リーダー）');
const g=id=>state.records.find(r=>r.id===id);
const checks=[
  ['担当者なしの1が東になる', g(1).staff==='東（数字リーダー）'],
  ['メニューの担当も入る',   g(1).menus[0].menuStaff==='東（数字リーダー）'],
  ['物販の担当も入る',       g(1).products[0].productStaff==='東（数字リーダー）'],
  ['既に林の2は変わらない',  g(2).staff==='林（副店長）'],
  ['3も東になる',            g(3).staff==='東（数字リーダー）'],
  ['画面外の4は変わらない',  g(4).staff===''],
  ['クラウドへ送るのは2件',  JSON.stringify(sent)==='[1,3]'],
  ['完了メッセージ',         /2件を「東（数字リーダー）」にしました/.test(toasts.join(''))]
];
checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
process.exit(checks.every(c=>c[1])?0:1);
