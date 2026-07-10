#!/usr/bin/env node
/*
 * check-shared.js — admin.html / staff.html のズレ検知ガード
 *
 * 目的: 両ファイルに同じ名前で存在する関数のうち、
 *   「本来は同じはずなのに中身がズレたもの」を検出する。
 *   （例: recYMD を admin だけ直し忘れる／税計算を片方だけ修正する 等の再発防止）
 *
 * 仕組み:
 *   - 各HTMLの<script>から関数本体を抽出し、同名関数を比較。
 *   - tools/shared-allowlist.json に「意図的に中身が違う関数名」を列挙しておく。
 *   - 「同名・中身違い・allowlist未登録」の関数があれば ❌ として exit 1。
 *
 * 使い方:
 *   node tools/check-shared.js            # 検査（差分があれば exit 1）
 *   node tools/check-shared.js --update   # 現在の差分関数をallowlistに取り込み(ベースライン更新)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FILES = ['admin.html', 'staff.html'];
const ALLOWLIST_PATH = path.join(__dirname, 'shared-allowlist.json');

function readJS(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  return blocks.join('\n');
}

// 文字列/コメント/正規表現リテラルを考慮した波括弧マッチでトップレベル関数を抽出
const REGEX_PREV = new Set(['(', ',', '=', ':', '[', '{', ';', '!', '&', '|', '?', '+', '-', '*', '%', '<', '>', '~', '^', '\n']);
function extractFunctions(src) {
  const fns = {};
  const re = /\bfunction\s+([A-Za-z0-9_$]+)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    const open = src.indexOf('{', re.lastIndex);
    if (open < 0) continue;
    let depth = 0, inStr = null, end = -1, prevSig = null;
    for (let j = open; j < src.length; j++) {
      const ch = src[j], prev = src[j - 1];
      if (inStr) { if (ch === inStr && prev !== '\\') inStr = null; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; prevSig = ch; continue; }
      if (ch === '/' && src[j + 1] === '/') { const nl = src.indexOf('\n', j); j = (nl < 0 ? src.length : nl); continue; }
      if (ch === '/' && src[j + 1] === '*') { const e = src.indexOf('*/', j + 2); j = (e < 0 ? src.length : e + 1); continue; }
      if (ch === '/' && (prevSig === null || REGEX_PREV.has(prevSig))) {
        // 正規表現リテラル: 文字クラス[]内の / は終端でない
        let k = j + 1, inClass = false;
        for (; k < src.length; k++) {
          const c = src[k];
          if (src[k - 1] === '\\') continue;
          if (c === '[') inClass = true;
          else if (c === ']') inClass = false;
          else if (c === '\n') break;
          else if (c === '/' && !inClass) break;
        }
        j = k; prevSig = '/'; continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { end = j; break; } }
      if (!/\s/.test(ch)) prevSig = ch;
    }
    if (end < 0) continue;
    const body = src.slice(open, end + 1).replace(/\s+/g, ' ').trim();
    (fns[name] = fns[name] || []).push(body);
    re.lastIndex = end + 1; // ネスト関数を二重カウントしない
  }
  return fns;
}

function loadAllowlist() {
  try { return new Set(JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8')).intentionallyDifferent || []); }
  catch (e) { return new Set(); }
}

const A = extractFunctions(readJS('admin.html'));
const S = extractFunctions(readJS('staff.html'));
const common = Object.keys(A).filter(n => S[n]);
const identical = [], different = [];
for (const n of common) {
  const a = A[n].join('\n<>\n'), s = S[n].join('\n<>\n');
  (a === s ? identical : different).push(n);
}
const adminOnly = Object.keys(A).filter(n => !S[n]);
const staffOnly = Object.keys(S).filter(n => !A[n]);

if (process.argv.includes('--update')) {
  fs.writeFileSync(ALLOWLIST_PATH, JSON.stringify({
    _comment: '意図的に admin/staff で中身が異なる関数名。ここに無い同名関数がズレたら check-shared.js が警告します。',
    intentionallyDifferent: different.sort()
  }, null, 2) + '\n');
  console.log('✅ allowlist を現状の差分 ' + different.length + ' 関数で更新しました: ' + path.relative(ROOT, ALLOWLIST_PATH));
  process.exit(0);
}

const allow = loadAllowlist();
const unexpected = different.filter(n => !allow.has(n));
const allowedButNowSame = [...allow].filter(n => identical.includes(n));

console.log('=== admin/staff 共通関数のズレ検知 ===');
console.log('共通関数: ' + common.length + ' （一致 ' + identical.length + ' / 相違 ' + different.length + '）');
console.log('admin専用: ' + adminOnly.length + ' / staff専用: ' + staffOnly.length);
console.log('意図的相違(allowlist): ' + allow.size);
if (allowedButNowSame.length) {
  console.log('\nℹ️ allowlist登録だが現在は一致（掃除候補）: ' + allowedButNowSame.join(', '));
}
if (unexpected.length) {
  console.log('\n❌ 想定外のズレ（本来同じはず。片方だけ直し忘れの可能性）: ' + unexpected.length + '件');
  unexpected.sort().forEach(n => console.log('   - ' + n));
  console.log('\n対応: どちらかに合わせて統一する、または意図的な差なら次で登録:');
  console.log('   node tools/check-shared.js --update');
  process.exit(1);
}
console.log('\n✅ 想定外のズレはありません。');
process.exit(0);
