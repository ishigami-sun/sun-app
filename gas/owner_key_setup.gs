/* =====================================================================
   SUN 日報アプリ — オーナー用の合言葉を作る（v24.9・1回だけ実行）
   -------------------------------------------------------------------
   owner_key.gs（オーナー用の合言葉の仕組み）とセット。コード.gs の一番下に貼って、
   関数「ownerKeySetup」を選んで ▶実行 する。デプロイのし直しは要らない（Webアプリからは呼ばれない）。

   やること
     1. スクリプト プロパティ OWNER_KEY が無ければ、ランダムな合言葉を作って登録する
        （すでにあれば作り直さない。何回実行しても同じ合言葉のまま）
     2. 実行した本人（スクリプトの持ち主）のGmailに、次の2つのリンクを送る
        ・管理画面の設定リンク   admin.html#k=<オーナー用>&s=<スタッフ用>
          （s= はスタッフに配るリンク・QRを管理画面で作るために使う）
        ・税理士さん用の閲覧専用リンク  admin.html?view=1#k=<オーナー用>
   合言葉の値はコード・画面・ログには出さない（メールだけ）。

   登録した瞬間から、スタッフ用の合言葉では給与・経費などが届かなくなる。
   管理画面（石上さんの携帯・パソコン）を、届いたリンクで切り替えるまでは給与・経費を編集しない。
   やめたい時は、プロジェクトの設定 → スクリプト プロパティ で OWNER_KEY を消すだけ（元の動きに戻る）。
   ===================================================================== */
function ownerKeySetup() {
  const APP_BASE = 'https://ishigami-sun.github.io/sun-app/';
  const props = PropertiesService.getScriptProperties();
  const staffKey = String(SECRET_KEY).trim();
  let k = String(props.getProperty('OWNER_KEY') || '').trim();
  const created = !k || k === staffKey;
  if (created) {
    k = 'SUN-' + Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
    props.setProperty('OWNER_KEY', k);
  }
  const to = Session.getEffectiveUser().getEmail();
  if (!to) throw new Error('送り先のメールアドレスが分かりませんでした');
  const adminLink = APP_BASE + 'admin.html#k=' + encodeURIComponent(k) + '&s=' + encodeURIComponent(staffKey);
  const viewLink = APP_BASE + 'admin.html?view=1#k=' + encodeURIComponent(k);
  const body =
    'SUNアプリ オーナー用の合言葉の設定リンクです（このメールは人に転送しないでください）。\n\n' +
    '■ 管理画面（石上さんの携帯・パソコン）\n' +
    '  ホーム画面のアプリの場合: 下のリンクを長押し→コピー → 管理画面を開く →\n' +
    '  給与集計などに出ている「📋 メールの設定リンクを貼り付ける」→ 貼り付けて「設定する」\n' +
    '  パソコンのブラウザの場合: 下のリンクをクリックするだけ\n\n' +
    adminLink + '\n\n' +
    '■ 税理士さん用（閲覧専用・給与と経費も見えます）\n' +
    viewLink + '\n\n' +
    '※ スタッフ用のリンクは今までどおり管理画面の「リンクを作る」で作れます（スタッフ用の合言葉が入ります）。\n' +
    '※ このメールを無くしても、Apps Script で ownerKeySetup をもう一度実行すれば同じ内容が届きます。';
  MailApp.sendEmail(to, 'SUNアプリ 管理画面の設定リンク（オーナー用）', body);
  Logger.log((created ? 'オーナー用の合言葉を登録しました。' : 'オーナー用の合言葉はすでに登録済みでした（作り直していません）。') +
             '設定リンクをメールで送りました（合言葉の値はここには出しません）。');
}
