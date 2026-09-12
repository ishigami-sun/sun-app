#!/usr/bin/env node
/*
 * リリース前チェック（sun-app）
 * 使い方: node tools/check_release.js
 *
 * これに合格しないものは絶対にコミット・公開しない。
 * 過去に実際に起きた事故を機械的に防ぐためのもの：
 *   - staff.html だけバージョンを上げ忘れ → 更新バナーが永久に出続けた（v20.1）
 *   - 片方のファイルにしか修正が入らない → 端末ごとに挙動が違う
 *   - インラインJSの構文エラー → 画面が真っ白
 *   - 接続キーの実値がコードに混入 → 公開リポジトリから漏れる
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const FILES = ['staff.html', 'admin.html'];
let errors = [];
let warns = [];
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// ---- 1. バージョンが3か所で一致しているか ----
let verJson = null;
try {
  verJson = JSON.parse(read('version.json')).version;
} catch (e) {
  errors.push('version.json が読めません: ' + e.message);
}
const appVers = {};
for (const f of FILES) {
  const m = read(f).match(/var APP_VERSION\s*=\s*"([^"]+)"/);
  if (!m) { errors.push(`${f}: APP_VERSION が見つかりません`); continue; }
  appVers[f] = m[1];
}
if (verJson) {
  for (const f of Object.keys(appVers)) {
    if (appVers[f] !== verJson) {
      errors.push(`バージョン不一致: version.json=${verJson} だが ${f}=${appVers[f]}`
        + `（このまま公開すると「新しいバージョンがあります」が消えなくなります）`);
    }
  }
}

// ---- 2. インラインJSの構文チェック ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sunchk-'));
for (const f of FILES) {
  const scripts = read(f).match(/<script>([\s\S]*?)<\/script>/g) || [];
  if (!scripts.length) { errors.push(`${f}: <script> が見つかりません`); continue; }
  scripts.forEach((block, i) => {
    const body = block.replace(/^<script>/, '').replace(/<\/script>$/, '');
    const p = path.join(tmp, `${f.replace('.html', '')}_${i}.js`);
    fs.writeFileSync(p, body);
    try {
      execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' });
    } catch (e) {
      errors.push(`${f} の${i + 1}番目の<script>に構文エラー:\n` + String(e.stderr || e.message).split('\n').slice(0, 6).join('\n'));
    }
  });
}

// ---- 3. 接続キーの実値が混入していないか ----
for (const f of FILES) {
  const src = read(f);
  // 本物のキーは SUN- で始まる長い英数字。プレースホルダや説明文は許容
  const hits = (src.match(/SUN-[A-Za-z0-9_-]{16,}/g) || []).filter(s => !/^SUN-(XXXX|你的|ここに|YOUR)/.test(s));
  if (hits.length) errors.push(`${f}: 接続キーらしい文字列がコードに含まれています（${hits.length}件）。CLOUD_KEY は空にしてください`);
  if (!/var CLOUD_KEY = "";/.test(src)) errors.push(`${f}: CLOUD_KEY が空ではありません`);
}

// ---- 4. 両ファイルに同じ修正が入っているか（主要な関数の存在確認） ----
const MUST_HAVE_BOTH = [
  'function syncAll(', 'function dedupeRecordsById(', 'function pasteSetupLink(',
  'function renderCustSearch(', 'function renderEnteredTodayChips(', 'function _verNum('
];
for (const name of MUST_HAVE_BOTH) {
  const missing = FILES.filter(f => read(f).indexOf(name) < 0);
  if (missing.length) warns.push(`${name} が ${missing.join('・')} にありません（片方だけ実装になっていないか確認）`);
}

// ---- 5. 撤去したはずの散らばった同期ボタンが復活していないか ----
for (const f of FILES) {
  const src = read(f);
  if (/onclick="syncFromCloud\(\)"/.test(src)) warns.push(`${f}: 個別の同期ボタンが残っています（同期は上部バナー1か所に集約する方針）`);
  if (/onclick="pushAndSync\(\)"/.test(src)) warns.push(`${f}: 「打ち終わったら更新」ボタンが残っています`);
}

// ---- 結果 ----
console.log('=== リリース前チェック ===');
console.log(`バージョン: version.json=${verJson} / staff=${appVers['staff.html']} / admin=${appVers['admin.html']}`);
if (warns.length) {
  console.log('\n⚠️ 警告（内容を確認してください）');
  warns.forEach(w => console.log('  - ' + w));
}
if (errors.length) {
  console.log('\n❌ エラー（このままコミットしないこと）');
  errors.forEach(e => console.log('  - ' + e));
  process.exit(1);
}
console.log('\n✅ チェック合格（コミットしてよい状態です）');
process.exit(0);
