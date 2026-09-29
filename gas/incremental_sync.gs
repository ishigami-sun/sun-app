/* =====================================================================
   SUN 日報アプリ — 差分同期（v23.7 で追加）
   -------------------------------------------------------------------
   これまで「getAll」で毎回 日報を全部（2,400件・1.5MB）返していた。
   この追加で、アプリは「前回の同期以降に変わった分」だけを受け取る。

   ■ 使い方（Apps Script の編集画面で）
     1. コード.gs の  function doPost(e) { ... }  を、下の doPost で丸ごと置き換える
        （SECRET_KEY や SHEET_xxx の行、getAll・addRecord などの既存関数はそのまま）
     2. このファイルの「ここから下を末尾に追加」以降を、コード.gs の一番下に貼る
     3. デプロイ → デプロイを管理 → 鉛筆 → バージョン「新バージョン」→ デプロイ
        （URL は変わらない。これを忘れると反映されない）

   ■ 仕組み
     - 'changes' シートに「いつ・何が（add/del/masters）・どの id」を1行ずつ残す
       （シートは自動で作られる。手で用意しなくてよい）
     - getSince(since): since より後の行を読み、変わった分だけ返す。変化が無ければ noChange
     - 既存の getAll / addRecord / deleteRecord / saveMasters / bulkImport の中身は触らない
   ===================================================================== */

// ---------- ① doPost を丸ごとこれに置き換える ----------
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.key !== SECRET_KEY) {
      return jsonResponse({ ok: false, error: 'unauthorized' });
    }
    const action = data.action;
    switch(action) {
      case 'getAll': { const r = getAll(); r.now = Date.now(); return jsonResponse(r); }
      case 'getSince': return jsonResponse(getSince(data.since));
      case 'addRecord': { const r = addRecord(data.record); if (r && r.ok !== false) logChange_('add', data.record && data.record.id); return jsonResponse(r); }
      case 'updateRecord': { const r = updateRecord(data.record); if (r && r.ok !== false) logChange_('add', data.record && data.record.id); return jsonResponse(r); }
      case 'deleteRecord': { const r = deleteRecord(data.id); if (r && r.ok !== false) logChange_('del', data.id); return jsonResponse(r); }
      case 'saveMasters': { const r = saveMasters(data.masters); if (r && r.ok !== false) logChange_('masters', ''); return jsonResponse(r); }
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

// ---------- ② ここから下を末尾に追加 ----------
const SHEET_CHANGES = 'changes';   // 変更の記録（差分同期用）。自動で作られる

// 変更を1行残す: [時刻(ms), 種類(add/del/masters), id]
function logChange_(kind, id) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(SHEET_CHANGES);
    if (!sh) { sh = ss.insertSheet(SHEET_CHANGES); sh.appendRow(['ts', 'kind', 'id']); }
    sh.appendRow([Date.now(), String(kind || ''), String(id == null ? '' : id)]);
    // 大きくなりすぎたら古い行を捨てる（60日より前、かつ 5000行超の時だけ）
    const n = sh.getLastRow();
    if (n > 5000) {
      const cut = Date.now() - 60 * 24 * 3600 * 1000;
      const ts = sh.getRange(2, 1, n - 1, 1).getValues();
      let old = 0; for (let i = 0; i < ts.length; i++) { if (Number(ts[i][0]) < cut) old++; else break; }
      if (old > 0) sh.deleteRows(2, old);
    }
  } catch (e) { /* 記録に失敗しても本体の処理は止めない */ }
}

// since(ms) より後に変わった分だけ返す
function getSince(since) {
  since = Number(since) || 0;
  const now = Date.now();               // 読む前に時刻を取る（読んでいる最中の追加を次回に確実に拾うため）
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_CHANGES);
  if (!sh || sh.getLastRow() < 2) {
    // まだ記録が無い＝この仕組みを入れた直後。全件を返して次回から差分にする
    const all = getAll(); all.now = now; all.full = true; return all;
  }
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  const addIds = {}, delIds = {};
  let mastersChanged = false, any = false;
  for (let i = 0; i < rows.length; i++) {
    const ts = Number(rows[i][0]); if (!(ts > since)) continue;
    any = true;
    const kind = String(rows[i][1] || ''), id = String(rows[i][2] || '');
    if (kind === 'add') { addIds[id] = 1; delete delIds[id]; }
    else if (kind === 'del') { delIds[id] = 1; delete addIds[id]; }
    else if (kind === 'masters') { mastersChanged = true; }
  }
  if (!any) return { ok: true, noChange: true, now: now };
  const all = getAll();
  const recs = (all.records || []).filter(function(r){ return r && addIds[String(r.id)]; });
  const out = { ok: true, now: now, records: recs, deleted: Object.keys(delIds) };
  if (mastersChanged) out.masters = all.masters;
  return out;
}
