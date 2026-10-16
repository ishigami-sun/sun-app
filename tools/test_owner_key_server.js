// v24.8: サーバー（GAS）のオーナー用合言葉 gas/owner_key.gs を、スプレッドシートを模擬して確かめる。
// 既存のコード.gs の getAll / saveMasters などは、本物と同じ動き（masters シート: A列=名前, B列=JSON）を再現した模擬。
const fs=require('fs'), vm=require('vm'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
const checks=[]; const t=(n,v)=>checks.push([n,!!v]);

function makeEnv(ownerKey){
  const sheets={};
  function sheet(name){ if(!sheets[name]) sheets[name]={rows:[]}; const s=sheets[name];
    return {
      getLastRow:()=>s.rows.length,
      appendRow:r=>s.rows.push(r.slice()),
      getRange:(r,c,nr,nc)=>({
        getValues:()=>s.rows.slice(r-1,r-1+nr).map(row=>{ const o=[]; for(let j=0;j<nc;j++) o.push(row[c-1+j]===undefined?'':row[c-1+j]); return o; }),
        setValues:v=>{ v.forEach((row,i)=>{ const R=s.rows[r-1+i]||(s.rows[r-1+i]=[]); row.forEach((x,j)=>R[c-1+j]=x); }); },
        clearContent:()=>{ for(let i=0;i<nr;i++){ const R=s.rows[r-1+i]; if(R) for(let j=0;j<nc;j++) R[c-1+j]=''; } }
      }),
      deleteRows:(a,n)=>s.rows.splice(a-1,n)
    }; }
  const props={}; if(ownerKey) props.OWNER_KEY=ownerKey;
  const ctx={
    SpreadsheetApp:{ getActiveSpreadsheet:()=>({ getSheetByName:n=>sheets[n]?sheet(n):null, insertSheet:n=>{ sheets[n]={rows:[]}; return sheet(n);} }) },
    PropertiesService:{ getScriptProperties:()=>({ getProperty:k=>props[k]||null }) },
    ContentService:{ createTextOutput:s=>({s, setMimeType(){return this;}}), MimeType:{JSON:'json'} },
    Utilities:{ formatDate:()=>'' }, Date, JSON, Object, Number, String, Math, Error,
    _sheets:sheets, _sheet:sheet
  };
  // 既存コード.gs の必要部分の模擬（本物と同じ保存形式）
  const base=`
const SECRET_KEY = 'STAFF-KEY';
const SHEET_RECORDS='records', SHEET_MASTERS='masters';
function jsonResponse(o){ return o; }
function ensureSheets(){ const ss=SpreadsheetApp.getActiveSpreadsheet();
  let r=ss.getSheetByName(SHEET_RECORDS)||ss.insertSheet(SHEET_RECORDS); if(r.getLastRow()===0) r.appendRow(['h']);
  let m=ss.getSheetByName(SHEET_MASTERS)||ss.insertSheet(SHEET_MASTERS); if(m.getLastRow()===0) m.appendRow(['key','json']);
  return { recordsSheet:r, mastersSheet:m }; }
function getAll(){ const { recordsSheet, mastersSheet } = ensureSheets(); const records=[];
  const lr=recordsSheet.getLastRow(); if(lr>1){ recordsSheet.getRange(2,1,lr-1,18).getValues().forEach(function(x){ if(x[17]) records.push(JSON.parse(x[17])); }); }
  const masters={}; const ml=mastersSheet.getLastRow(); if(ml>1){ mastersSheet.getRange(2,1,ml-1,2).getValues().forEach(function(x){ try{ if(x[1]) masters[x[0]]=JSON.parse(x[1]); }catch(e){} }); }
  return { ok:true, records:records, masters:masters }; }
function saveMasters(masters){ const { mastersSheet } = ensureSheets(); const lr=mastersSheet.getLastRow();
  if(lr>1) mastersSheet.getRange(2,1,lr-1,2).clearContent(); const rows=[]; for(const k in masters) rows.push([k, JSON.stringify(masters[k])]);
  if(rows.length) mastersSheet.getRange(2,1,rows.length,2).setValues(rows); return { ok:true }; }
function addRecord(rec){ const { recordsSheet } = ensureSheets(); const row=new Array(18).fill(''); row[0]=rec.id; row[17]=JSON.stringify(rec); recordsSheet.appendRow(row); return { ok:true }; }
function updateRecord(rec){ return addRecord(rec); } function deleteRecord(){ return {ok:true}; } function bulkImport(){ return {ok:true}; }
function verifyPin(){ return {ok:true}; } function getUsers(){ return {ok:true,users:[]}; } function saveUsers(){ return {ok:true}; } function logActivity(){ return {ok:true}; }
function doPost(e){ return { ok:false, error:'OLD doPost should not be used' }; }
`;
  const code=base+'\n'+fs.readFileSync(path.join(ROOT,'gas/incremental_sync.gs'),'utf8')+'\n'+fs.readFileSync(path.join(ROOT,'gas/owner_key.gs'),'utf8');
  vm.createContext(ctx); vm.runInContext(code+'\nthis.__doPost=doPost; this.__saveMasters=saveMasters;',ctx);
  const call=(key,action,extra)=>ctx.__doPost({postData:{contents:JSON.stringify(Object.assign({key,action},extra||{}))}});
  // 初期データ
  ctx.__saveMasters({ menus:[{id:1,name:'カット'}], expenses:{'2026-09':{rent:999,updatedAt:'x'}}, payroll:{_setup:{rows:[{app:'甲'}]}}, hpsTowel:{}, laborSales:{}, staffTypes:{a:'stylist'} });
  return {call, ctx};
}

if(require.main!==module){ module.exports={makeEnv}; return; }
// 1. OWNER_KEY 未登録 → 今までどおり
let E=makeEnv('');
let r=E.call('STAFF-KEY','getAll');
t('未登録: 今までの合言葉で全部見える（経費・給与あり・印なし）', r.ok && r.masters.expenses && r.masters.payroll && !r.adminOnlyHidden);
t('未登録: whoami は owner・ownerKeySet=false', E.call('STAFF-KEY','whoami').role==='owner' && E.call('STAFF-KEY','whoami').ownerKeySet===false);
t('未登録: 違う合言葉は unauthorized', E.call('WRONG','getAll').error==='unauthorized');
E.call('STAFF-KEY','saveMasters',{masters:{menus:[]}});
t('未登録: saveMasters は今までどおり送った内容で置き換え（従来動作）', !E.call('STAFF-KEY','getAll').masters.expenses);

// 2. OWNER_KEY 登録後
E=makeEnv('OWNER-KEY');
r=E.call('OWNER-KEY','getAll');
t('登録後: オーナー用は全部見える', r.ok && r.masters.expenses && r.masters.payroll && r.masters.staffTypes && !r.adminOnlyHidden);
r=E.call('STAFF-KEY','getAll');
t('登録後: スタッフ用は経費・給与・タオル・技術売上・区分が見えない', r.ok && !r.masters.expenses && !r.masters.payroll && !r.masters.hpsTowel && !r.masters.laborSales && !r.masters.staffTypes && r.masters.menus && r.adminOnlyHidden===true);
t('登録後: スタッフ用でも日報・メニューは今までどおり', Array.isArray(r.records) && r.masters.menus.length===1);
t('登録後: whoami', E.call('STAFF-KEY','whoami').role==='staff' && E.call('OWNER-KEY','whoami').role==='owner');
// スタッフが管理者専用の項目なし/古い値で送ってきても、サーバーの値を守る
let s=E.call('STAFF-KEY','saveMasters',{masters:{menus:[{id:1},{id:2}], expenses:{'2026-09':{rent:1,updatedAt:'old'}}}});
r=E.call('OWNER-KEY','getAll');
t('登録後: スタッフの saveMasters でメニューは更新される', s.ok && r.masters.menus.length===2);
t('登録後: スタッフの古い経費では上書きされない', r.masters.expenses['2026-09'].rent===999);
t('登録後: スタッフが送らなかった給与設定・区分も消えない', r.masters.payroll._setup.rows[0].app==='甲' && r.masters.staffTypes.a==='stylist');
// オーナーは更新できる
E.call('OWNER-KEY','saveMasters',{masters:Object.assign({},r.masters,{expenses:{'2026-09':{rent:1234,updatedAt:'new'}}})});
t('登録後: オーナーの saveMasters で経費が更新される', E.call('OWNER-KEY','getAll').masters.expenses['2026-09'].rent===1234);
// 差分同期
E.call('STAFF-KEY','addRecord',{record:{id:'r1',time:'2026-10-16'}});
const g=E.call('STAFF-KEY','getSince',{since:1});
t('登録後: スタッフの差分同期にも管理者専用マスタは入らない', g.ok && (!g.masters || (!g.masters.expenses && !g.masters.payroll)) && g.adminOnlyHidden===true);
const go=E.call('OWNER-KEY','getSince',{since:1});
t('登録後: オーナーの差分同期は従来どおり', go.ok && !go.adminOnlyHidden);
// 管理者専用の行が読めない時は、スタッフの保存を止める（消さない）
const ms=E.ctx._sheets.masters.rows; const idx=ms.findIndex(x=>x[0]==='payroll'); ms[idx][1]='{壊れたJSON';
s=E.call('STAFF-KEY','saveMasters',{masters:{menus:[]}});
t('登録後: 管理者専用の行が壊れていたらスタッフの保存は失敗（何も消さない）', s.ok===false && E.ctx._sheets.masters.rows[idx][1]==='{壊れたJSON' && E.ctx._sheets.masters.rows.some(x=>x[0]==='menus'&&x[1]));

// 3. アプリ側と同じ項目一覧
const S=fs.readFileSync(path.join(ROOT,'staff.html'),'utf8');
const appList=(S.match(/var ADMIN_ONLY_MASTERS=\[([^\]]*)\]/)||[])[1].replace(/'|\s/g,'').split(',').sort().join(',');
const srvList=(fs.readFileSync(path.join(ROOT,'gas/owner_key.gs'),'utf8').match(/const ADMIN_ONLY_MASTERS_ = \[([^\]]*)\]/)||[])[1].replace(/'|\s/g,'').split(',').sort().join(',');
t('サーバーとアプリの管理者専用マスタの一覧が同じ', appList===srvList);
t('gas/owner_key.gs に合言葉の実値を書いていない', !/OWNER_KEY\s*=\s*['"][^'"]{6,}/.test(fs.readFileSync(path.join(ROOT,'gas/owner_key.gs'),'utf8')));

checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
const ok=checks.every(c=>c[1]); console.log('\n'+(ok?'すべて合格':'★失敗あり')); process.exit(ok?0:1);
