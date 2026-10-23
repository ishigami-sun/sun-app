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

### 1-2. main にマージする前に Engineering のレビューを通す

node tools/check_release.js と node tools/check-shared.js が合格したら、
git diff origin/main...HEAD を Engineering プラグインの code-review の観点（使えない環境では自分で）でレビューする。
加えて次を必ず確認する:
- 修正が staff.html と admin.html の両方に入っているか
- キー・合言葉の実値、給与の実額、本名がコード・テスト・コミットに入っていないか
- スタッフ版に管理項目・給与・P&L・技術的な説明が出ていないか。オーナー用/スタッフ用の合言葉の区別が崩れていないか
- 同期の順序（取り込み→日報送信→必要時のみマスタ）を崩していないか。未送信の日報が消える・二重になる経路がないか
- 白金台と恵比寿店（FC）のデータが混ざる経路がないか
レビュー結果は「判定／重大／注意／石上さんにスマホで確認してほしい画面」の形で、やさしい日本語で報告する。
重大が1つでもあれば、main にマージする前に直す。

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

### 7. 給与の実額・本名をコード・テスト・CLAUDE.md・コミットに書かない（公開リポジトリ）

検証用の値は `backups/payroll_fixture.json`（.gitignore 済み・非公開。形式 `{rows, fixedOnly, ex, grossPay, fixedOnlyTotal}`）に置く。
無い環境では `tools/test_pnl_payroll.js` はスキップする。チャット・報告にも実額を出さない。

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
- **`syncAll` の順序は 取り込み → 日報の送信 → （必要な時だけ）マスタ送信**（v23.6）。
  全件取得（getAll）は1回だけ: `syncFromCloud` が一覧を `window._lastCloudSnap` に控え、
  `pushAndSync(cb, silent, snap)` は60秒以内の控えがあれば getAll を呼ばない。
  マスタ（saveMasters）は `state._mastersDirty`（`save()` で立つ）か30分経過の時だけ、`fin` の後に非同期で送る
  （`_pushMastersIfNeeded`）。**日報の送信をマスタ送信の後ろに置かない**（詰まると日報が永久に送られない）。
  `callCloud` は30秒で打ち切る（AbortController）。応答が無いまま待ち続けない。

  > 過去の事故: 毎回「getAll → 全マスタ saveMasters → getAll → addRecord」と全件を2回取り、
  > マスタ送信が詰まると日報が送られず「1件がまだ届いていません」が消えなかった（お店のiPad、9/22）。
  > 回帰テスト: `node tools/test_sync_fast.js`
- **差分同期（v23.7）**: サーバー側 `gas/incremental_sync.gs`（doPost の置き換え＋末尾追加）とセット。
  `syncFromCloud` は dispatcher。`state.syncSince>0` かつ 24時間以内に全件済み かつ サーバーが getSince 対応なら
  `_syncFromCloudDelta`（`getSince(since)` → 追加/置換/削除だけ適用）、それ以外は `_syncFromCloudFull`
  （`getAll` → `_applyFullResponse`）。マスタの統合は両方 `_applyCloudMasters(masters)`。
  サーバー契約: `getAll` は `now`（サーバー時刻）を返す。`getSince` は `{noChange,now}` か
  `{records:[追加/変更], deleted:[id], masters?:…, now}` か `{full:true, …getAllと同形}`。
  `since` はサーバーの `now` を使う（端末の時計は使わない）。サーバーは 'changes' シートに
  `[ts, add|del|masters, id]` を残す。**サーバー側の関数名や doPost の action を変える時は gas/ の
  ファイルとこの契約を一緒に直す。** サーバーが未対応（unknown action）なら1時間は全件で動く。
  削除は `state._delConfirmed` で「届いた」ものを除き、差分モードでは `_pendingDeletes()` だけ送る。
  回帰テスト: `node tools/test_sync_incremental.js`
  石上さん側の手順（消さない・打ち替えない）: gas/incremental_sync.gs を**全部コピーしてコード.gs の一番下に貼る**
  → ⌘S → デプロイ→デプロイを管理→鉛筆→**新バージョン**→デプロイ（URLは変わらない）。
  古い doPost は残してよい（後ろに書いた同名の関数が有効になる）。
  案内ページ（コピーボタン付き・翻訳の影響を受けない）: https://claude.ai/artifact/EXo9CivytNMM1QCdgPqK57
  ※ Chrome の自動翻訳が GitHub のコード表示まで日本語にする（「関数」「戻る」）。GitHub からコピーさせない。
- **容量不足の端末は差分同期だけでは戻らない**（v23.8）。`_shrinkForQuota` の level2/3 で日報を外したら
  `state._lowStorage` を立て、`syncSince=0` / `lastFullPullAt=0` にして次は必ず全件から。
  端末が保持する日数は `_recordDays()`（通常は `LOCAL_RECORD_DAYS`、`_lowStorage` の端末は60日。admin の 0=全件 でも60）。
  `canDelta` は `state.records.length>0` を要求する。**同じ端末に admin と staff の両方を入れると localStorage を
  2重に使う**（石上さんの携帯）。回帰テスト: `node tools/test_low_storage.js`
- **容量不足でも画面用の `state.records` は減らさない**（v24.5）。`saveLocal` は保存に失敗したら state の写し（`_snap`）を作り、
  `_shrinkForQuota(level, _snap)` で**写しだけ**を軽くして保存する（level2: 60日＋未送信、level3: 未送信だけ＋写しの
  `syncSince=0`/`lastFullPullAt=0`、照合キャッシュ `_rcRows` は写しから外す）。`_lowStorage` は state にも立てる。
  `syncAll` は `lastFullPullAt` が 0 の時は60秒以内でも省略しない（保存できなかった端末は開き直したら必ず全件取り込む）。
  画面用の切り詰めは `_memRecordDays()`、保存用は `_recordDays()`（容量不足は60日）。admin は `MEM_KEEP_ALL_ON_LOW_STORAGE=true` で
  容量不足でも画面は全期間（締め・P&L に必要）。staff は false で、容量不足の端末は画面も60日（保存と揃い、開くたびの全件取り込みを避ける）。
  写しから日報を外した時は level2 でも写しの `syncSince=0`/`lastFullPullAt=0`（次に開いた時は全件から）。
  `_quotaLevel` はこの起動中に保存が通った段階で、次の保存はそこから始める（入力のたびに全体の保存を4回試さない）。

  > 過去の事故: 以前は state 本体から日報を外していたため、容量いっぱいの端末（admin と staff を同じ携帯に入れた石上さん）で
  > 同期のたびに画面の日報が0件になり、売上・人件費・給与集計が0、月の選択肢が今月だけになった（10/16）。
  > 回帰テスト: `node tools/test_quota_keeps_display.js`
- **マスタ送信（saveMasters）は必ず `_mastersPayload()` の全項目で送る**（v24.2）。サーバーの saveMasters は
  「送った項目だけ」で masters シート全体を置き換える。項目を減らして送る経路を1つでも作ると、
  経費・給与・laborSales・hpsTowel・staffTypes（admin 専用）がクラウドから消える。
  staff 版は受け取った admin 専用マスタを `state._adminMasters` に控えて、そのまま返す（`ADMIN_ONLY_MASTERS`）。

  > 過去の事故: staff のマスタ送信とブランド・メニュー編集が項目を減らして送っていたため、
  > スタッフ端末が同期するたびに P&L の経費・9月の技術売上・タオルがクラウドから消えた（10/7）。
  > 回帰テスト: `node tools/test_masters_keep.js`（saveMasters の呼び出しが全部 `_mastersPayload()` かを数える）
- **一度も取り込みに成功していない端末（`!state.lastFullSync`）は `saveMastersToCloud` でマスタを送らない**（v24.4）。
  印（`_mastersDirty`）だけ立てて、syncAll の「取り込み→日報→マスタ」で送らせる。コールバックには `{ok:false, deferred:true}`。

  > 見つかった不具合: 新しい端末・データを消した端末で開くと、起動時の移行処理（`fixProductIds` / `migrateStaffRoles`）が
  > `save()`→`saveMastersToCloud()` を呼び、取り込み前の空のマスタで saveMasters していた。模擬サーバーで
  > admin・staff とも、クラウドの経費・給与（月別）が消えることを再現（10/16）。
  > 回帰テスト: `node tools/test_new_device_no_push.js`
- **オーナー用の合言葉（v24.8・サーバー `gas/owner_key.gs`）**: スクリプト プロパティ `OWNER_KEY` を登録すると、
  `SECRET_KEY`（スタッフ用）の応答から管理者専用マスタ（`ADMIN_ONLY_MASTERS` と同じ5項目）を外し `adminOnlyHidden:true` を付ける。
  スタッフ用の saveMasters は管理者専用の項目をサーバーの今の値に差し替えて保存する（送った値は使わない・行が壊れていたら保存しない）。
  `OWNER_KEY` 未登録の間は従来どおり（SECRET_KEY で全部見える）。`whoami` アクションで role を確かめられる。
  アプリは `callCloud` の応答で `_noteAdminOnlyHidden()` を呼び、staff は `_adminMasters` を消す、admin は `state._ownerKeyNeeded` を立てて
  給与集計・人件費・P&L に「オーナー用の合言葉になっていません」を出す。管理画面の切り替えは設定リンク `admin.html#k=<オーナー用>`（`_probeKey` 経由）。
  **役割に関係なく、saveMasters で送られてこなかった管理者専用の項目はサーバーの値を残す**（owner は送った項目だけ置き換え、staff は常にサーバーの値）。
  マスタの保存は `LockService` で1件ずつ。`OWNER_KEY` がスタッフ用と同じなら未登録扱い（`whoami` の `ownerKeySameAsStaff`）。前後の空白は無視。
  **サーバーを owner_key.gs より前の doPost に戻してはいけない**（控えを消した staff v24.8 が空のまま送り、管理者専用マスタが消える）。
  無効にしたい時は `OWNER_KEY` を消すだけにする（この doPost のままなら、省いた項目は消えない）。
  回帰テスト: `node tools/test_owner_key_server.js`（模擬スプレッドシートで gas/ を実行）
- **スタッフにオーナー用の合言葉を渡さない**（v24.9）。オーナー用の登録は `gas/owner_key_setup.gs` の `ownerKeySetup()` を
  石上さんがエディタで実行（サーバーで合言葉を作り、本人のGmailに `admin.html#k=<オーナー用>&s=<スタッフ用>` と閲覧専用リンクを送る。
  値は画面・ログ・チャットに出さない。Claude は合言葉を入力欄に打ち込まない）。
  - admin: `state.staffKey`（`&s=` から。`*_conf` の `s` にも保存）。スタッフ用リンク・QR は `_staffKeyForLinks()` が `whoami` で決める
    （この端末がオーナー用なら staffKey を `role==='staff'` と確かめて使う／分からない時は作らない）。この端末がスタッフ用の時は閲覧専用リンクを出さない。
    オーナー用が2回続けて断られたら（OWNER_KEY を消した等）控えた staffKey で1回やり直す（`_staffKeyTried`）。
  - staff: `_staffRoleCheck()` が合言葉を入れた直後・起動時・同期成功後に `whoami` し、オーナー用（分割済み）なら
    `_altStaffKey`（`s=`）か同じ携帯の管理者版の控え（`sun_cloud_admin_conf.s`）をスタッフ用と確かめて切り替え、`_adminMasters` を捨てて全件取り込み直す。
    `adoptAdminConfigIfAny` は管理者版の staffKey を優先する。
  - 貼り付け欄（1行）は改行が消えるので、`s=` は ASCII の記号・英数字だけ読む。
  - **admin の `#k=` は、今の合言葉がオーナー用（分割済み）でリンクがスタッフ用なら入れ替えない**（v25.0）。石上さんはメモ帳に保存したURLから毎回開くため、
    スタッフ用の `#k=` が付いていると開くたびにオーナー用が上書きされる（スタッフ用も「通る」ので `_probeKey` では防げない）。
  回帰テスト: `node tools/test_owner_key_setup.js`
- 日報の重複は `dedupeRecordsById()` が同一IDを自動で1件に統合する
- **`state.records` からローカル分を落としてよいのは `_cs` 印が付いているものだけ**（v22.7）。
  `_cs` は「クラウドで実在を確認できた」印で、`syncFromCloud` / `pushAndSync` の取得結果と
  `callCloud` の `addRecord` 成功時に付く。印が無いものは未送信なので絶対に消さない。

  > 過去の事故: `syncFromCloud` が `state.records = クラウド全件 + 再送キューに載っているローカル分`
  > としていた。`unauthorized` は再送キューに積まない仕様なので、接続設定が壊れている間に
  > 打ち込んだ日報はキューに載らず、設定を直した直後の同期で消えていた。
  > `syncAll` は取り込み→送信の順なので、送信される前に消える。本人は打ち込んだのに
  > クラウドにもどの端末にも残らない状態になった（9月の東・かおる分）。
  > 回帰テスト: `node tools/test_sync_keep_unsent.js` / `node tools/test_sync_migrate.js`
- **合言葉（cloudKey）を入れ替える経路は、必ず `_probeKey()` でサーバーに確かめてから**（v23.2）。
  経路は3つ: URLの `#k=…`／設定リンクの貼り付け `applySetupKey()`／管理者版設定の取り込み
  `adoptAdminConfigIfAny()`。`unauthorized` なら入れ替えない。無条件で上書きする経路を増やさない。
  同期が通った合言葉は `state.lastGoodKey`（`*_conf` にも保存）に残し、
  `syncAll` の `fin` で unauthorized になったら1回だけそれに戻して再同期する（`_goodKeyTried`）。

  > 過去の事故: `#k=` ハンドラが無条件に上書きしていたため、古い設定リンクを保存した
  > ホーム画面アイコンから開くたびに正しい合言葉が古いものに戻り、貼り直しても翌日また
  > 「合言葉が違います」になった（お店のiPad、9/15）。
  > 回帰テスト: `node tools/test_key_selfheal.js`
- **認証エラーは1回で赤く出さない**（v23.5）。`syncAuthFailedRaw()`＝直前の応答が unauthorized（内部ロジック用:
  lastGoodKey への戻し・admin設定の取り込み）。`syncAuthFailed()`＝画面用で「3回連続 かつ 最後の成功から10分以上」。
  `fin` が `state.authFails` を数え、3回未満は60秒後に黙って再試行。判定の正規表現に「key」「認証」を入れない（誤検知）。
  スタッフ版の帯・トーストに技術的な診断文を出さない（診断は admin 版だけ）。
- 日報の**来店日・時刻・担当者は編集画面の「👤顧客」タブ**で直す（v22.9。`et_customer()`）。
  あとからまとめて打ち込むと打ち込んだ日の日付で登録されるため、この項目は必須。
- **金額一致だけを根拠に日報の日付を自動で書き換えてはいけない。**
  エアレジ照合の「④ 日付が最終日になっているかもしれない日報」は**候補の一覧表示のみ**。

  > 検証記録: 9月の実データ（バックアップ2391件＋「45件打ち込み・うち15件が最終日」を再現）で
  > 自動修正方式を試したところ、15件中5件しか当たらず、**正しい日付の日報3件を動かした**。
  > 同額の別のお客様と取り違えるため。候補提示方式は15件中15件を検出し、
  > 余分な候補は1件のみ、データは書き換えない。自動修正版はコミット前に破棄した。
- エアレジ照合の同日・同額マッチは**会計時間がいちばん近い日報**を選ぶ（v22.9）。
  まとめ入力した日報が同額の別会計を横取りするのを減らすため。
- **人件費の計算は `laborCostForMonth(ym)` 1か所**（v24.0）。管理タブ「人件費の見通し」と P&L の `pnlPayroll()` が
  これを使う。P&L の人件費合計＝給与合計（6名＋役員2名）×(1+`SOCIAL_INSURANCE_RATE`)。
  給与エクセル R8.9度 の入力で 6名の支給額が一致することを `node tools/test_pnl_payroll.js` で固定。
  早朝手当など給与エクセルで手入力する項目は含まない。旧 `pnlPayroll_old_`（概算式）は使わない。
- **管理タブの月の選択肢（給与集計・人件費）は、月の一覧が変わったら作り直す**（v24.6。`sel.dataset.filled` に一覧を控える。
  自分で選んだ月は残す）。`renderAll` は管理タブを開いている時も描き直す（入力中の欄がある時は除く）。
  > 過去の事故: 選択肢を最初の1回だけ作っていたため、取り込み前に作られると「今月だけ」で固まり、給与集計・人件費が0のままだった（10/16）。
  > 回帰テスト: `node tools/test_month_select_refresh.js`
- **アルバイトの出勤簿（v25.5）**: 名前は共有マスタ `state.partTimers`（admin 管理タブ「🧢 アルバイト」で登録、
  `_mastersPayload` / `_applyCloudMasters` に入れる。削除は `markMasterDeleted('partTimers',…)`）。日報の担当者には出さない。
  **出た日に本人が打刻するだけ**（石上さんの方針 10/22）: 社員の `attDefault`（毎日出勤を自動で入れる）は使わず、
  `attPtSet` が `pt:1` 付きの記録を作る。打刻の無い日は作らない・数えない。取り消しは `void:1`（削除は同期で戻る）。
  一覧・集計は `attPtDays` / `attPtMonth`。時給は admin の給与設定（`kind:'parttime'`・同じ名前）だけで、staff 版には出さない。
  admin の出勤簿「🧢 アルバイト」が名前・時給・時間・見込み（`attRenderPtTable`、`attPtWage`）。給与計算の `partTimeHours` も同じ記録を読む。
  時給・通勤費は管理タブの「🧢 アルバイト」で名前と一緒に入れる（v25.9・`_ptSetWage`）。給与設定の `_setup.rows` に
  `kind:'parttime'` の行として書く（同じ姓の行があれば更新）。給与設定が届いていない端末では作らない（savePayrollSetup と同じ10分ガード）。
  **名前の一覧（staff・partTimers）は `_pullReportsThenPush` でも統合してから送る**（v25.6）。
  > 過去の事故: 管理版で足した名前を、まだ受け取っていない端末が空の一覧で saveMasters して消した（10/23）。
  回帰テスト: `node tools/test_parttime_att.js`
- **目標タブの着地予想（v25.8）**: `calcFixedActual` が「今日より前」の実績 `before` と出勤日数 `daysBefore` も返す。
  `goalForecastDays()`＝月曜定休を除く営業日（昨日まで／今日から月末）、スタッフは残りの 1/6 を公休として引く（`staffEst`）。
  着地＝before＋(before÷daysBefore)×残り日数（`goalForecast`）。今日の途中の実績はペースに入れない。
  残り出勤日は `state.paceDays['YYYY-MM|姓']`（売上タブの分析と同じキー）で直せる。回帰テスト: `node tools/test_goal_forecast.js`
- 給与エクセル用の集計は admin の管理タブ（`renderPayrollExport()`）。
  H列=店販売値(税込)・I列=原価はアプリから自動、P列=ヒポポタマスのタオルは請求書を手入力

## エアレジ取込みでやれること・やれないこと

- **売上（メニュー）は取り込める。** `importAirregiMissing()` が金額・時刻をレジどおりに作る
- **物販は取り込めない。** CSVには税抜単価しか無く、`_airMenuByPrice()` は単価からの推測。
  同額ならメニューが優先されるので品目・原価がずれる＝**物販歩合が計算できない**。
  物販がある日報は必ず手入力してもらうこと
- 担当者は伝票名から推測できる分だけ自動（`_airGuessStaff()`。過去の日報で8割以上その人の時のみ）。
  残りは日報タブ「担当者なし」→「まとめて担当者に割り当てる」（`bulkAssignStaff()`）
- 二重取込みは `airNo`（取引No）で防いでいる。手入力済みの分は照合で一致するので対象外になる

## いまの宿題（2026-09-13 時点）

- **（済・10/17）オーナー用の合言葉を本番で登録**（GAS デプロイ バージョン6＝owner_key.gs、`ownerKeySetup` 実行済み）。
  スタッフ用の合言葉では管理者専用マスタが返らないことをサーバーで確認。石上さんの携帯の管理画面は切り替え済み。税理士さんには閲覧リンク未送付（アプリを見ていないため。必要になったら同じメールの2つ目のリンクを送る）。
- **（済・v24.7）給与のシード値を admin.html から削除**。過去の実額は公開リポジトリの git 履歴に残っている。
  → **（済・10/17）履歴を書き換えて実額・本名を全版から除去**（git-filter-repo、全ブランチを強制プッシュ）。
  GitHub サポートに古い版（SHA指定で見える分）の削除を依頼済み（10/17）。**古い履歴を持つクローンから push しない**（他のセッションは使わない）。
- **（済・v24.7）送信前の取り直しで月別マスタを統合**: `_pullReportsThenPush`（両ファイル同一）は報告・削除履歴に加えて、
  admin では `expenses`/`payroll`/`hpsTowel`/`laborSales`/`airegi` を `mergeByMonthKey` で統合してから送る（staff は `_adminMasters` の控えを更新）。
  以前は報告・削除履歴だけだったため、取り込み済みでも中身が古い端末が `save()` すると、古い経費・給与（月別）・給与設定で
  クラウドを戻していた（模擬で再現、v24.6 以前から）。**`_applyCloudMasters` を丸ごと呼んではいけない**: 研修動画（件数で置換）や
  ブランド（削除履歴なし）は、端末での削除・並べ替えがクラウドの古い値に戻されて送られる（レビューで指摘・v24.7 で回避）。
  回帰テスト: `node tools/test_new_device_no_push.js`
- 9月の締め: 東さんが打ち込み完了。**④の日付ちがい候補を本人が確認して直す**→
  再照合して①入力漏れ・④が減ったか確認→バックアップをもらって検算
- 8月の締め: 入力漏れ64件 ¥976,128 / 日報のみ21件。
  8月は複数スタッフ分が混ざるので「まとめて担当者」は使わず1件ずつ
- 全端末 v23.1 以降は自動更新（更新ボタンを押させない）。9/15時点で携帯・お店のiPadとも v23.2
- 接続キー（SECRET_KEY）の入れ替えは**やらない**（石上さんと合意・9/14）。
  入れ替えると全端末で貼り直しが発生し、スタッフの手間になるため。
  もし将来やる場合: GAS編集＋**新バージョンでデプロイ**＋リンク配り直し。値はチャットにもコミットにも出さない
- スタッフに「更新して」「貼り付けて」を頼まない方針。必要になる状況はアプリ側のバグとして直す
- 石上さん側: エアレジのHPBクーポンメニューの税区分を非課税→内税に直す。
  月 ¥357,058（税 ¥32,460）が10%標準の外にある件を税理士に確認

## 給与の仕組み（admin.html）

`payrollRows()` / `payrollFixedOnly()` / `techCommission()` / `payrollRate()` が実装。
**固定給（基本給・定額残業・役職手当・通勤費）と役員等の固定額は、公開コードに置かない**（v24.4）。
admin の管理タブ「⚙️ 給与設定」で編集し、`state.payroll._setup = {rows, fixedOnly, updatedAt}` に保存される。
これは既存の admin 専用マスタ `payroll` の中の1キーで、月キー（'2026-09' 等）と同じく `mergeByMonthKey` で
`updatedAt` の新しい方が勝つ。staff 版は `payroll` を `ADMIN_ONLY_MASTERS` としてそのまま返すので、
サーバー・staff のロジックは変えずに同期される。**`state.payroll` を月キーで列挙する処理を書く時は `_setup` を除外すること。**

- rows の項目: `app`（アプリ名・姓ベース）／`xls`（給与明細の氏名）／`row`（エクセル行）／`base`／`ot`／`post`／`postName`／`commute`／`assistant`
- fixedOnly の項目: `name`／`amount`（歩合なしの役員等）
- **v24.7 で初期値（シード）と起動時の自動投入（`_ensurePayrollSetup`）は削除済み。** `_setup` が無い端末は
  `payrollRows()`/`payrollFixedOnly()` が空配列を返し、`_payrollMissingHtml()` が「給与設定がまだこの端末に届いていません」を
  給与集計・人件費の見通し・P&L の人件費に出す。**空の `_setup` を自動で作ってはいけない**（同じ古い日時の本物を上書きしうる）。
  アシスタントの参考欄・役員の表示名も登録内容から作る（名前を直書きしない）。
  `savePayrollSetup` は、給与設定がまだ届いていない端末では直近10分以内に同期が通っていないと保存しない（新しい日時で本物を上書きしないため）。
  旧概算式の定数（`PNL_BASE` / `PNL_POST_*` / `PNL_OFFICER_PAY`）は 0（`pnlPayroll_old_` 専用・未使用）。
- 給与額に変更があったら「⚙️ 給与設定」で直す。コードは触らない。

**給与ルールと働き方（v25.1）** — 計算はすべて `laborCostForMonth(ym)` の中（P&L・人件費の見通し・給与エクセルが共通で使う）。
- お店共通のルール: `state.payroll._rules`（admin の「⚙️ 詳しい給与ルール」）。無い・壊れている時は `PAY_RULES_DEFAULT`＝白金台の決まり（v25.0 までと1円も変わらない。`tools/test_pay_rules.js` ①）。
- 1人ずつ（`_setup.rows[]`）: `kind` = 無し(社員)／`assistant`／`contractor`（業務委託・社会保険なし）／`parttime`（`wage`×出勤簿の時間 `partTimeHours`、手入力は `laborSales[ym][app+'#h']`）。
- 歩合の決め方 `tMode`: `'flat'`＝`tRate`%（業務委託は `cRate`）／`'tier'`＝`tTiers {mode:'tiered'|'whole', threshold, tiers:[{upto,rate}…最後 upto:0]}`／無し＝お店共通のルール。
  計算は `rowCommission(R, 税抜売上, kind)` 1か所。白金台の既存の行は tMode 無し＝共通ルールのまま。
- 売上は常に日報の税込→税抜（÷1.1）で計算する。画面で税込/税抜は選ばせない（石上さんの方針）。`cBasis:'inc'` は旧データ互換のみ。
- 給与設定画面の値を innerHTML に入れる時は必ず `h()` で囲む（クラウドから来た値）。0 は `h(0)` が空になるので `h(String(x))`。

**技術歩合（特別技術手当）** — 税抜売上に対する段階積み上げ。**50万円未満は歩合ゼロ**（大きな段差）。
50万まで13.5% ／ 〜100万15% ／ 〜150万30% ／ 〜200万35% ／ 〜300万40% ／ 300万超45%。各段は切り捨て。
アシスタントはヘッドスパ等の売上 × 20%。

**物販歩合（一般物販手当）** — 利益（売値−原価）に応じた率を**利益の全額に**かける。
3万未満20% ／ 5万未満30% ／ 8万未満35% ／ 8万以上40%。境目を越えると一気に増える。

**HPS物販手当** — ヒポポタマスのタオル売上（税込・毎月PDFの請求書）から
`ROUNDUP(税抜 × 10%) × 0.8`。請求書の値は管理タブで手入力（`state.hpsTowel`）。

検証: 給与明細・給与集計表・給与エクセルと、アプリの式が全員1円まで一致することを確認済み。
実際の値での検算は `backups/payroll_fixture.json`（非公開）を使う `node tools/test_pnl_payroll.js`。
店販の売値・原価（H/I列）もクラウドの日報と一致。

**会社負担の社会保険 `SOCIAL_INSURANCE_RATE` = 0.116**（v24.1）。給与集計表の本人負担額から逆算した
（健保・介護・厚年・子育て支援は労使折半、雇用保険は会社分、子ども・子育て拠出金 0.36% を合算して支給合計の約11.6%）。
以前の 15.5% は仮置きで、人件費を多めに見ていた。料率が変わったらここと admin.html を直す。
