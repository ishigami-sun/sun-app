#!/usr/bin/env node
/*
 * 売上検算スクリプト（sun-app）
 * 使い方: node tools/verify_sales.js <バックアップJSON> [YYYY-MM]
 *   - バックアップJSON: admin/staffの「バックアップ（ファイルに保存）」で出力したファイル
 *   - YYYY-MM を指定するとその月のみ、省略時は全期間＋月別に検算
 *
 * 検算項目（アプリの計算式を忠実に再現）:
 *   1. スタッフ別売上（明細帰属）の総和 === 全体売上（明細再計算）
 *   2. スタッフ別客数（主担当）の総和 === 全体客数（会計件数）
 *   3. 全体客単価 === round(全体売上 ÷ 全体客数)
 *   4. 明細再計算の合計 === 保存済み record.total の合計（2系統クロスチェック）
 */
'use strict';
const fs = require('fs');

const file = process.argv[2];
const monthFilter = process.argv[3] || null;
if (!file) { console.error('使い方: node tools/verify_sales.js <バックアップJSON> [YYYY-MM]'); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const records = data.records || [];

// ---- アプリと同一の行計算（admin.html / staff.html と一致させること） ----
function menuInc(m){ const p = m.inputPrice || 0; return (m.taxMode === 'inc') ? Math.round(p) : Math.round(p * 1.1); }
function menuLineInc(m){
  if (!m) return 0;
  const inc = menuInc(m); let amt = inc * (m.qty || 1);
  if (m.discountPct > 0) amt -= Math.round(inc * m.discountPct / 100) * (m.qty || 1);
  if (m.pointDiscount) amt -= (m.pointDiscount || 0);
  return amt;
}
function prodLineSell(p){
  if (!p) return 0;
  const base = ((p.customSell !== undefined && p.customSell !== null ? p.customSell : p.sell) || 0) * (p.qty || 1);
  const d = (p.discountPct > 0) ? Math.round(base * p.discountPct / 100) : 0;
  return Math.max(0, base - d);
}
// 日付は日本時間基準（アプリはブラウザのローカルTZ＝JSTで集計）
function recYM(r){
  const d = new Date(r.time);
  if (isNaN(d.getTime())) return '';
  const j = new Date(d.getTime() + 9 * 3600 * 1000);
  return j.getUTCFullYear() + '-' + String(j.getUTCMonth() + 1).padStart(2, '0');
}

function verify(label, recs){
  let calc = 0, stored = 0, tech = 0, prod = 0, noStaff = 0;
  const byStaffSales = {}, byStaffClients = {};
  for (const r of recs) {
    let t = 0;
    for (const m of r.menus || []) {
      const v = menuLineInc(m); t += v; tech += v;
      const st = m.menuStaff || r.staff || '(未設定)';
      byStaffSales[st] = (byStaffSales[st] || 0) + v;
    }
    for (const p of r.products || []) {
      const v = prodLineSell(p); t += v; prod += v;
      const st = p.productStaff || r.staff || '(未設定)';
      byStaffSales[st] = (byStaffSales[st] || 0) + v;
    }
    calc += t; stored += (r.total || 0);
    const s = r.staff || '(未設定)';
    if (!r.staff) noStaff++;
    byStaffClients[s] = (byStaffClients[s] || 0) + 1;
  }
  const sumSales = Object.values(byStaffSales).reduce((a, b) => a + b, 0);
  const sumClients = Object.values(byStaffClients).reduce((a, b) => a + b, 0);
  const cl = recs.length;
  const unit = cl > 0 ? Math.round(calc / cl) : 0;
  const ok1 = sumSales === calc, ok2 = sumClients === cl, ok3 = unit === (cl > 0 ? Math.round(calc / cl) : 0), ok4 = calc === stored;
  const mark = b => b ? 'OK ' : 'NG!';
  console.log(`--- ${label}: ${cl}件 ---`);
  console.log(`  1) [${mark(ok1)}] スタッフ別売上総和 ${sumSales.toLocaleString()} === 全体 ${calc.toLocaleString()}`);
  console.log(`  2) [${mark(ok2)}] スタッフ別客数総和 ${sumClients} === 全体 ${cl}（主担当未設定 ${noStaff}件）`);
  console.log(`  3) [${mark(ok3)}] 客単価 round(${calc.toLocaleString()}/${cl}) = ${unit.toLocaleString()}（施術のみ ${cl > 0 ? Math.round(tech / cl).toLocaleString() : 0}）`);
  console.log(`  4) [${mark(ok4)}] 明細再計算 ${calc.toLocaleString()} === 保存済みtotal合計 ${stored.toLocaleString()}${ok4 ? '' : `（差 ${(calc - stored).toLocaleString()}）`}`);
  console.log(`      施術 ${tech.toLocaleString()} / 物販 ${prod.toLocaleString()}`);
  return ok1 && ok2 && ok3 && ok4 && noStaff === 0;
}

let allOk = true;
if (monthFilter) {
  allOk = verify(monthFilter, records.filter(r => recYM(r) === monthFilter));
} else {
  allOk = verify('全期間', records);
  const months = [...new Set(records.map(recYM).filter(Boolean))].sort();
  for (const ym of months) allOk = verify(ym, records.filter(r => recYM(r) === ym)) && allOk;
}
console.log(allOk ? '\n✅ すべての検算に合格しました' : '\n❌ 検算に不一致があります');
process.exit(allOk ? 0 : 1);
