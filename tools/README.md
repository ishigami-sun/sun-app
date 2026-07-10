# tools/ — 開発補助ツール

## check-shared.js — admin/staff ズレ検知ガード

`admin.html` と `staff.html` は約8割のコードが共通です。過去、片方だけを直して
もう片方を直し忘れるバグ（例: `recYMD` が admin に無い、税計算が片方だけ古い）が
何度か起きました。これを防ぐためのチェックツールです。

### 何をするか
両ファイルに同じ名前で存在する関数を突き合わせ、
**「本来は同じはずなのに中身がズレたもの」** を検出します。
役割で意図的に違う関数（`renderRecords`, `saveLocal` など）は
`shared-allowlist.json` に登録済みで、そこに無い同名関数がズレたときだけ警告します。

### 使い方
```bash
# 検査（想定外のズレがあれば exit 1）
node tools/check-shared.js

# 意図的な差を増やしたとき等に、現状をベースラインとして取り込む
node tools/check-shared.js --update
```

### いつ使うか
- **admin か staff のどちらかの関数を編集したあと**に一度実行。
- 「❌ 想定外のズレ」に関数名が出たら、
  - もう片方も同じ内容に直す（＝直し忘れの発見）、または
  - 役割上わざと違うなら `--update` で allowlist に登録。

### 仕組みメモ
- 各HTMLの `<script>` から関数本体を抽出（文字列・コメント・正規表現リテラルを考慮）。
- 空白を正規化して同名関数を比較。
- `shared-allowlist.json` の `intentionallyDifferent` に載っている関数は警告しない。
