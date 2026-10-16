// v24.9: gas/owner_key_setup.gs（オーナー用の合言葉を作ってメールで送る）を模擬環境で確かめる。
const fs=require('fs'), vm=require('vm'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
const checks=[]; const t=(n,v)=>checks.push([n,!!v]);
function run(props){
  const mails=[], logs=[]; let n=0;
  const ctx={ PropertiesService:{ getScriptProperties:()=>({ getProperty:k=>props[k]||null, setProperty:(k,v)=>{ props[k]=v; } }) },
    Utilities:{ getUuid:()=>{ n++; return ('0000000'+n).slice(-8)+'-aaaa-bbbb-cccc-'+('dddddddddddd'+n).slice(-12); } },
    Session:{ getEffectiveUser:()=>({ getEmail:()=>'owner@example.com' }) },
    MailApp:{ sendEmail:(to,sub,body)=>mails.push({to,sub,body}) }, Logger:{ log:s=>logs.push(String(s)) },
    String, Error, encodeURIComponent };
  vm.createContext(ctx);
  vm.runInContext("const SECRET_KEY='SUN-STAFF123';\n"+fs.readFileSync(path.join(ROOT,'gas/owner_key_setup.gs'),'utf8')+'\nownerKeySetup();',ctx);
  return {mails,logs,props};
}
// 1. 未登録 → 作って登録・メール1通
let r=run({});
const k=r.props.OWNER_KEY;
t('1: OWNER_KEY を登録する', !!k && k!=='SUN-STAFF123' && /^SUN-[0-9a-z]{30,}$/.test(k));
t('1: 本人のアドレスに1通だけ送る', r.mails.length===1 && r.mails[0].to==='owner@example.com');
t('1: 管理画面のリンクに オーナー用(k) と スタッフ用(s) が入る', r.mails[0].body.includes('admin.html#k='+encodeURIComponent(k)+'&s='+encodeURIComponent('SUN-STAFF123')));
t('1: 閲覧専用リンクはオーナー用だけ（スタッフ用を含まない）', r.mails[0].body.includes('admin.html?view=1#k='+encodeURIComponent(k)+'\n'));
t('1: ログに合言葉の値を出さない', !r.logs.join('\n').includes(k) && !r.logs.join('\n').includes('SUN-STAFF123'));
t('1: スタッフ用(staff.html)のリンクは送らない', !/staff\.html#k=/.test(r.mails[0].body));
// 2. 登録済み → 作り直さない
r=run({OWNER_KEY:' SUN-EXISTING99 '});
t('2: 登録済みなら作り直さない', r.props.OWNER_KEY===' SUN-EXISTING99 ' && r.mails[0].body.includes('#k=SUN-EXISTING99&s='));
// 3. スタッフ用と同じ値が入っていた → 作り直す
r=run({OWNER_KEY:'SUN-STAFF123'});
t('3: スタッフ用と同じ値なら新しく作る', r.props.OWNER_KEY!=='SUN-STAFF123' && r.props.OWNER_KEY.startsWith('SUN-'));
// 4. ソースに実値を書いていない
const src=fs.readFileSync(path.join(ROOT,'gas/owner_key_setup.gs'),'utf8');
t('4: gas/owner_key_setup.gs に合言葉の実値を書いていない', !/SUN-[A-Za-z0-9]{8,}/.test(src));
let ok=true; for(const [n,v] of checks){ console.log((v?'✅ ':'❌ ')+n); if(!v) ok=false; }
console.log(ok?'\nすべて合格':'\n★失敗あり'); process.exit(ok?0:1);
