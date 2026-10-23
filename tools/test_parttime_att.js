// アルバイトの出勤簿（v25.5）:
//  ① 出勤打刻だけなら「出勤時刻あり・退勤なし」で実働0h。退勤打刻で実働が出る。社員のような既定の退勤時刻は入らない
//  ② 打刻の無い日は一覧に出ない・数えない。取り消した日も出ない
//  ③ 打ち忘れた日は足せる（表示中の月だけ）
//  ④ admin: 時給は給与設定（アルバイト・同じ名前）から。見込み＝時間×時給＋通勤費。partTimeHours（給与計算）も同じ時間
//  ⑤ マスタ送信・取り込みに partTimers が入る（両ファイル）
const fs=require('fs');
function grab(src,n){const i=src.indexOf('function '+n+'(');if(i<0)throw new Error(n);let d=0;
  for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}}
function run(file,label){
  const src=fs.readFileSync(file,'utf8');
  Object.assign(global,{ showToast(){}, renderAttendance(){}, save(){}, saveLocal(){}, h:(s)=>s==null?'':String(s), num:(n)=>Number(n||0).toLocaleString('ja-JP'),
    ATT_WD:['日','月','火','水','木','金','土'], document:{getElementById:(id)=>global._els[id]||null}, _els:{} });
  eval(['ptList','isPartTimer','attPtSet','attPtPunch','attPtVoid','attPtAddDay','attPtDays','attPtMonth','attPtCard','attRenderPtCalendar','attWorkMin','attHours','attTodayYMD'].map(n=>grab(src,n)).join('\n'));
  const checks=[];
  const today=attTodayYMD(), ym=today.slice(0,7);
  global.state={partTimers:['サトウ'], staff:['石上（代表）'], attendance:{}, attMonth:ym};
  // ①
  attPtPunch('サトウ', today, 'in');
  const r1=state.attendance['サトウ'][today];
  checks.push(['① 出勤打刻: 出勤時刻だけ入り、退勤は空・実働0h', !!r1.start && r1.end==='' && attWorkMin(r1)===0 && r1.pt===1]);
  state.attendance['サトウ'][today].start='10:00'; attPtPunch('サトウ', today, 'out'); state.attendance['サトウ'][today].end='19:00';
  checks.push(['① 退勤打刻で実働が出る（10:00〜19:00 休憩60 → 8h）', attHours(attWorkMin(state.attendance['サトウ'][today]))===8]);
  // ②
  const other=ym+'-01'===today?ym+'-02':ym+'-01';
  checks.push(['② 打刻の無い日は一覧に出ない', attPtDays('サトウ',ym).length===1 && attPtMonth('サトウ',ym).days===1]);
  attPtSet('サトウ', other, {start:'12:00', end:'15:00', brk:0});
  checks.push(['② 2日目を足すと2日・11h', attPtMonth('サトウ',ym).days===2 && attHours(attPtMonth('サトウ',ym).min)===11]);
  attPtVoid('サトウ', other);
  checks.push(['② 取り消した日は出ない・数えない', attPtMonth('サトウ',ym).days===1 && state.attendance['サトウ'][other].void===1]);
  // ③
  global._els={attPtAddDate:{value:'2000-01-01'}}; attPtAddDay('サトウ');
  checks.push(['③ 別の月の日付は足せない', !state.attendance['サトウ']['2000-01-01']]);
  global._els={attPtAddDate:{value:other}}; attPtAddDay('サトウ');
  checks.push(['③ 表示中の月の日付は足せる（取り消しも解除）', attPtDays('サトウ',ym).length===2 && state.attendance['サトウ'][other].void===0]);
  const html=attRenderPtCalendar('サトウ');
  checks.push(['画面: 集計・今日の打刻ボタン・打ち忘れを足すボタン', /月間集計/.test(html) && /出勤打刻/.test(html) && /打ち忘れた日を足す/.test(html)]);
  // ⑤
  const payload=grab(src,'_mastersPayload');
  checks.push(['⑤ マスタ送信に partTimers', /partTimers:\s*state\.partTimers/.test(payload)]);
  checks.push(['⑤ 取り込みで partTimers を統合', /res\.masters\.partTimers\)\s*state\.partTimers\s*=\s*mergeMasterUnique/.test(grab(src,'_applyCloudMasters'))]);
  checks.push(['⑤ 送る前の取り直しでも partTimers・staff を統合（空の一覧で上書きしない・v25.6）', /res\.masters\.partTimers\)\s*state\.partTimers\s*=\s*mergeMasterUnique/.test(grab(src,'_pullReportsThenPush')) && /res\.masters\.staff\)\s*state\.staff\s*=\s*mergeMasterUnique/.test(grab(src,'_pullReportsThenPush'))]);
  // ④ admin だけ
  if(/function attRenderPtTable\(/.test(src)){
    eval(grab(src,'attPtWage')+'\n'+grab(src,'attRenderPtTable')+'\n'+grab(src,'staffBase')+'\n'+grab(src,'partTimeHours'));
    global.payrollRows=()=>[{app:'サトウ',kind:'parttime',wage:1250,commute:500},{app:'東',base:1}];
    const t=attRenderPtTable();
    const hrs=attHours(attPtMonth('サトウ',ym).min); const expect=Math.round(attPtMonth('サトウ',ym).min/60*1250)+500;
    checks.push(['④ 一覧: 時給¥1,250・見込み '+expect+'（'+hrs+'h×1250＋通勤費500）', t.indexOf('¥1,250')>=0 && t.indexOf('¥'+num(expect))>=0]);
    checks.push(['④ 給与計算の partTimeHours も同じ時間', partTimeHours(ym,'サトウ')===hrs]);
    global.payrollRows=()=>[];
    checks.push(['④ 時給が未設定なら赤く案内', /未設定/.test(attRenderPtTable())]);
  }
  console.log('=== '+label+' ==='); checks.forEach(([n,v])=>console.log((v?'✅':'❌')+' '+n));
  return checks.every(c=>c[1]);
}
const a=run('/home/user/sun-app/staff.html','staff.html'), b=run('/home/user/sun-app/admin.html','admin.html');
console.log('\n'+((a&&b)?'すべて合格':'★失敗あり')); process.exit(a&&b?0:1);
