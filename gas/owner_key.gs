/* =====================================================================
   SUN 日報アプリ — オーナー用の合言葉（v24.8 で追加）
   -------------------------------------------------------------------
   合言葉を2つに分ける。
     ・スタッフ用 … 今までの SECRET_KEY（スタッフの携帯・お店のiPad）
     ・オーナー用 … スクリプト プロパティ OWNER_KEY（石上さん・税理士さんの管理画面）
   スタッフ用の合言葉では、管理者専用のマスタ（経費・給与・給与設定・タオル・技術売上・スタッフ区分）を
   返さない。スタッフの端末がマスタを送ってきても、これらはサーバーにある値をそのまま守る。

   ■ 安全のための作り
     - 役割に関係なく、saveMasters で送られてこなかった管理者専用の項目はサーバーの値を残す（省いても消えない）。
     - マスタの保存は LockService で1件ずつ（全消し→書き直しの途中を他の端末が読まないように）。
     - OWNER_KEY がスタッフ用と同じ値なら「未登録」扱い（whoami の ownerKeySameAsStaff で分かる）。
     - OWNER_KEY が未登録の間は、今までとまったく同じ動き（SECRET_KEY で全部見える）。
       → このファイルを貼って新バージョンでデプロイしても、それだけでは何も変わらない。
     - OWNER_KEY を登録した瞬間から、スタッフ用の合言葉は上の項目が見えなくなる。
     - 合言葉の値はこのファイルにもチャットにも書かない（OWNER_KEY はスクリプト プロパティに置く）。

   ■ 入れ方（何も消さない・何も打ち替えない）
     1. このファイルを全部コピーして、コード.gs の「一番下」に貼る（gas/incremental_sync.gs の後ろ）
     2. 保存（⌘S）
     3. デプロイ → デプロイを管理 → いまアプリが使っているデプロイ → 鉛筆 → バージョン「新バージョン」→ デプロイ
        （URL は変わらない）
     ※ 下にある doPost が、上にある doPost より後に書かれているので、こちらが使われる。上の doPost は消さなくてよい。

   ■ 既存の関数への依存（中身は触らない）
     getAll / getSince / addRecord / updateRecord / deleteRecord / saveMasters / bulkImport /
     verifyPin / getUsers / saveUsers / logActivity / logChange_ / ensureSheets / jsonResponse / SECRET_KEY
   ===================================================================== */

// 管理者専用のマスタ（アプリ側 staff.html の ADMIN_ONLY_MASTERS と同じにする）
const ADMIN_ONLY_MASTERS_ = ['expenses', 'staffTypes', 'payroll', 'hpsTowel', 'laborSales'];

function ownerKey_() {
  let k = '';
  try { k = String(PropertiesService.getScriptProperties().getProperty('OWNER_KEY') || '').trim(); }
  catch (e) { k = ''; }
  // スタッフ用と同じ値が登録されていたら「未登録」と同じに扱う（分けたつもりで何も守られない事故を防ぐ。whoami で分かる）
  if (k && k === String(SECRET_KEY).trim()) return '';
  return k;
}
function ownerKeySameAsStaff_() {
  try { const k = String(PropertiesService.getScriptProperties().getProperty('OWNER_KEY') || '').trim(); return !!k && k === String(SECRET_KEY).trim(); }
  catch (e) { return false; }
}

// 'owner' / 'staff' / ''（不一致）
function roleOf_(key) {
  key = String(key || '').trim();
  if (!key) return '';
  const ok = ownerKey_();
  if (ok && key === ok) return 'owner';
  if (key === String(SECRET_KEY).trim()) return ok ? 'staff' : 'owner';   // オーナー用が未登録の間は今までどおり全部見える
  return '';
}

// スタッフ用の応答から管理者専用マスタを外し、外したことを知らせる
function hideAdminOnly_(res) {
  if (res && typeof res === 'object') {
    if (res.masters && typeof res.masters === 'object') {
      for (let i = 0; i < ADMIN_ONLY_MASTERS_.length; i++) delete res.masters[ADMIN_ONLY_MASTERS_[i]];
    }
    res.adminOnlyHidden = true;
  }
  return res;
}

// 保存する前に、管理者専用の項目をサーバーの今の値で補う
//   staff … 送ってきた値は使わず、必ずサーバーの値にする（サーバーに無い項目は送ってきても捨てる）
//   owner … 送ってきた項目はそのまま。送ってこなかった項目はサーバーの値を残す（省いただけで消えないように）
function keepServerAdminOnly_(masters, staff) {
  const out = {};
  if (masters && typeof masters === 'object') { for (const k in masters) out[k] = masters[k]; }
  if (staff) { for (let i = 0; i < ADMIN_ONLY_MASTERS_.length; i++) delete out[ADMIN_ONLY_MASTERS_[i]]; }
  const { mastersSheet } = ensureSheets();
  const last = mastersSheet.getLastRow();
  if (last > 1) {
    const rows = mastersSheet.getRange(2, 1, last - 1, 2).getValues();
    for (let i = 0; i < rows.length; i++) {
      const name = String(rows[i][0] || '');
      if (ADMIN_ONLY_MASTERS_.indexOf(name) < 0 || !rows[i][1]) continue;
      if (!staff && Object.prototype.hasOwnProperty.call(out, name)) continue;   // オーナーが送ってきた項目はそのまま
      try { out[name] = JSON.parse(rows[i][1]); }
      catch (e) { throw new Error('admin master unreadable: ' + name); }   // 読めない時は保存しない（消さないため）
    }
  }
  return out;
}

// ---------- 新しい doPost（上にある doPost より後ろにあるので、こちらが使われる） ----------
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const role = roleOf_(data.key);
    if (!role) return jsonResponse({ ok: false, error: 'unauthorized' });
    const staff = (role === 'staff');
    const action = data.action;
    switch (action) {
      case 'whoami': return jsonResponse({ ok: true, role: role, ownerKeySet: !!ownerKey_(), ownerKeySameAsStaff: ownerKeySameAsStaff_() });
      case 'getAll': { const r = getAll(); r.now = Date.now(); return jsonResponse(staff ? hideAdminOnly_(r) : r); }
      case 'getSince': { const r = getSince(data.since); return jsonResponse(staff ? hideAdminOnly_(r) : r); }
      case 'addRecord': { const r = addRecord(data.record); if (r && r.ok !== false) logChange_('add', data.record && data.record.id); return jsonResponse(r); }
      case 'updateRecord': { const r = updateRecord(data.record); if (r && r.ok !== false) logChange_('add', data.record && data.record.id); return jsonResponse(r); }
      case 'deleteRecord': { const r = deleteRecord(data.id); if (r && r.ok !== false) logChange_('del', data.id); return jsonResponse(r); }
      case 'saveMasters': {
        // 読む→書くの間に他の端末の保存が割り込まないように、スクリプト全体で1件ずつにする
        // （本番の saveMasters はシートを全消し→書き直すので、途中を読まれると管理者専用の行が無いように見える）
        const lock = LockService.getScriptLock();
        lock.waitLock(25000);
        try {
          const m = keepServerAdminOnly_(data.masters, staff);
          const r = saveMasters(m); if (r && r.ok !== false) logChange_('masters', '');
          return jsonResponse(staff ? Object.assign({}, r, { adminOnlyHidden: true }) : r);
        } finally { lock.releaseLock(); }
      }
      case 'bulkImport': { const r = bulkImport(data.records); if (r && r.ok !== false) { (data.records || []).forEach(function(x){ logChange_('add', x && x.id); }); } return jsonResponse(r); }
      case 'verifyPin': return jsonResponse(verifyPin(data.staffName, data.pin));
      case 'getUsers': return jsonResponse(getUsers());
      case 'saveUsers': return jsonResponse(saveUsers(data.users));
      case 'logActivity': return jsonResponse(logActivity(data.staff, data.activity, data.device));
      default: return jsonResponse({ ok: false, error: 'unknown action' });
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}
