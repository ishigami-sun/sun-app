# sun-app 開発ルール（必読）

美容室SUNの店舗管理アプリ。GitHub Pagesで公開している2つの単一HTMLファイル＋GAS/スプレッドシートのバックエンド。

- `staff.html` … スタッフ用（全スタッフの携帯でホーム画面に追加して使用）
- `admin.html` … 管理者用（石上さん専用）
- `version.json` … 公開中のバージョン。アプリが定期取得して更新バナーを出す
- バックエンド … Google Apps Script Webアプリ（`doPost`、`key`照合）＋スプレッドシート

## 絶対に守ること

### 1. リリース前チェックを必ず通す

```
node tools/check_release.js
```

**合格しないものはコミットしない。** `git commit` 時に pre-commit フックからも自動実行される。
コンテナが作り直されてフックが消えている場合は、必ず手動で実行すること。

フックを再設置するには:
```
printf '#!/bin/sh\nnode tools/check_release.js || exit 1\n' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

### 2. 修正は必ず staff.html と admin.html の両方に入れる

2ファイルはインラインJSがほぼ同一。片方だけ直すと端末ごとに挙動が変わる。
Pythonのマーカー置換で、**必ず `assert src.count(old) == 1` を書いてから**書き込む。
アンカーが一意でないまま置換すると意図しない箇所が壊れる。

### 3. バージョンは3か所を同時に上げる

リリースごとに +0.1。**`version.json` / `staff.html` の `APP_VERSION` / `admin.html` の `APP_VERSION` の3つを必ず揃える。**

> 過去の事故: v20.1で staff.html だけ20.0のまま公開し、スタッフの端末で
> 「新しいバージョンがあります」が更新しても永久に消えなくなった。
> これを機械的に防ぐのが `tools/check_release.js`。

### 4. スマホ作業前提。必ず main にマージしてプッシュする

石上さんは携帯・iPadから使うため、ブランチに置いたままでは反映されない。

```
git push -u origin claude/remote-control-v6emma
git checkout main && git merge claude/remote-control-v6emma --no-edit && git push origin main
git checkout claude/remote-control-v6emma
```

### 5. 接続キー（SECRET_KEY）を公開コードに書かない

`var CLOUD_KEY = "";` のまま。キー配布は管理者が `#k=` 付きリンクを渡す方式、
または画面上部バナーをタップして貼り付ける方式（`pasteSetupLink()`）。
**チャットやコミットにキーの実値を出力しない。**

### 6. スタッフ画面に管理・技術的な要素を出さない

スタッフ版には接続キーの入力欄・設定項目・技術的な説明を置かない。
What's New もスタッフ用は「使い方」だけにする（管理者向けの内容は admin.html 側だけ）。

## 検証のやり方

- 構文: インラインJSを抽出して `node --check`（`tools/check_release.js` が実施）
- ロジック: DOMとstateをスタブして関数を抽出し、実バックアップJSONでスモークテスト
- 売上の検算: `node tools/verify_sales.js <バックアップJSON> [YYYY-MM]`
- この環境から `script.google.com` へは到達できない（GAS作業は石上さんに手順を渡す）

## 設計の要点

- 金額はすべて**税込・割引後**で集計。`menuLineInc()` / `prodLineSell()` が基準
- エアレジ「商品別売上」画面に合わせる表示は `airRegiMenuLine()`（外税は税抜・内税は税込）
- スタッフ名は肩書きが変わる（例: 東（副店長）→東（数字リーダー））。
  集計は必ず `staffBase()` / `sameStaff()` で姓ベースに揃える。**厳密一致で比較しない**
- 定休日は月曜。スタッフは週休2日で、残り出勤日数は編集可能（`state.paceDays`）
- 同期は `syncAll()` のみが入口。個別の同期ボタンを増やさない（上部バナー1か所に集約する方針）
- 日報の重複は `dedupeRecordsById()` が同一IDを自動で1件に統合する
- 給与エクセル用の集計は admin の管理タブ（`renderPayrollExport()`）。
  H列=店販売値(税込)・I列=原価はアプリから自動、P列=ヒポポタマスのタオルは請求書を手入力
