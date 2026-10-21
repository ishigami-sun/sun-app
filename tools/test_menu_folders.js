// メニュー選択のフォルダ分け（v25.3）:
//  ① 名前からの自動振り分けが想定どおり（カット／カラー／組み合わせ／ホットペッパー／トリートメント／パーマ・ストレート／その他）
//  ② マスタに cat があればそれが優先。知らない cat は無視して自動に戻る
//  ③ staff / admin で同じ結果
//  ④ フォルダ未選択なら種類の一覧、選択中ならそのフォルダのメニューだけ。無いフォルダを選んでいたら一覧に戻る
const fs=require('fs');
const CASES=[
  ['カット','カット類'],['前髪カット','カット類'],['子供カット','カット類'],['メンズカット','カット類'],['眉カット','カット類'],
  ['カラー','カラー類'],['ハイライト','カラー類'],['ダブルカラー','カラー類'],['ブリーチ','カラー類'],['ケアブリーチ','カラー類'],
  ['白髪染めを使わない白髪染め','カラー類'],['ヴィーガンアロマカラー','カラー類'],['眉カラー','カラー類'],
  ['カラー＋カット','組み合わせ類'],['パーマ＋カット','組み合わせ類'],['カット＋ストレート','組み合わせ類'],
  ['【HOT】カット＋炭酸','ホットペッパー類'],['【HOT】平日カットカラー','ホットペッパー類'],['【hot】カラー','ホットペッパー類'],
  ['トリートメント','トリートメント類'],['ヘッドスパ','トリートメント類'],['炭酸マーブ','トリートメント類'],['前処理','トリートメント類'],
  ['パーマ','パーマ・ストレート類'],['デジタルパーマ','パーマ・ストレート類'],['ストレート','パーマ・ストレート類'],['縮毛矯正','パーマ・ストレート類'],
  ['シャンプーブロー','その他'],['ヘアセット','その他'],['個室料金','その他'],['ネイル','その他'],['送料','その他'],['ロング料金','その他'],['早朝料金','その他']
];
function run(file,label){
  const src=fs.readFileSync(file,'utf8');
  function grab(n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n+' in '+file);let d=0;
    for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
  const vs=src.indexOf('var MENU_FOLDERS='); eval(src.slice(vs, src.indexOf(';',vs)+1));
  eval(grab('menuFolderOf')+'\n'+grab('setMenuFolder')+'\n'+grab('renderMenuList')+'\n'+grab('findById')+'\n'+grab('h'));
  global.num=n=>String(n);
  const checks=[];
  // ①
  const bad=CASES.filter(([n,f])=>menuFolderOf({name:n})!==f).map(([n,f])=>n+'→'+menuFolderOf({name:n})+'（期待 '+f+'）');
  checks.push(['名前からの自動振り分け（'+CASES.length+'件）'+(bad.length?'  NG: '+bad.join(', '):''), bad.length===0]);
  // ②
  checks.push(['マスタの cat が優先・知らない cat は無視', menuFolderOf({name:'カット',cat:'その他'})==='その他' && menuFolderOf({name:'カット',cat:'謎'})==='カット類']);
  // ④
  let html='';
  global.document={getElementById:()=>({set innerHTML(v){html=v;}, get innerHTML(){return html;}})};
  global.state={menus:[{id:1,name:'カット',price:10000},{id:3,name:'カラー',price:8000},{id:12,name:'トリートメント',price:0}],selectedMenus:[{id:1,qty:2}],records:[],menuFolder:''};
  renderMenuList();
  checks.push(['未選択なら種類の一覧（カット類・カラー類・トリートメント類）。選択数のバッジが出る', /カット類/.test(html)&&/カラー類/.test(html)&&/トリートメント類/.test(html)&&!/組み合わせ類/.test(html)&&!/menu-add-btn/.test(html)&&/>2</.test(html)]);
  setMenuFolder('カラー類');
  checks.push(['フォルダを選ぶとそのメニューだけ＋戻るボタン', /← 戻る/.test(html)&&/カラー/.test(html)&&!/menu-name">カット</.test(html)&&/addMenuItem\(3\)/.test(html)]);
  state.menuFolder='パーマ・ストレート類'; renderMenuList();
  checks.push(['無いフォルダを選んでいたら一覧に戻る', state.menuFolder===''&&/種類を選んでください/.test(html)]);
  console.log('=== '+label+' ==='); checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
  return {ok:checks.every(c=>c[1]), map:CASES.map(([n])=>menuFolderOf({name:n})).join('|')};
}
const a=run('/home/user/sun-app/staff.html','staff.html'), b=run('/home/user/sun-app/admin.html','admin.html');
const same=a.map===b.map; console.log((same?'✅':'❌')+' staff と admin で同じ振り分け');
const ok=a.ok&&b.ok&&same; console.log('\n'+(ok?'すべて合格':'★失敗あり')); process.exit(ok?0:1);
