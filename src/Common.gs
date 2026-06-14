/**
 * Common.gs  ―  共通処理（エラーハンドリング）
 * ------------------------------------------------------------------
 * 定期実行はサイレントに失敗しがちなので、エラー時は管理者へ通知します。
 * ------------------------------------------------------------------
 */

/**
 * 例外を記録し、管理者へ通知します。
 * @param {string} where どの関数で失敗したか
 * @param {Error}  err   発生した例外
 */
function handleError_(where, err) {
  const message = '[' + where + '] ' + (err && err.stack ? err.stack : err);
  Logger.log(message);

  try {
    MailApp.sendEmail({
      to: CONFIG.ADMIN_EMAIL,
      subject: '【要確認】Gmail自動転記でエラーが発生しました',
      body: [
        'メールの自動転記中にエラーが発生しました。',
        '',
        '発生箇所: ' + where,
        '日時　　: ' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'),
        '',
        '--- 詳細 ---',
        message,
      ].join('\n'),
    });
  } catch (mailErr) {
    Logger.log('エラー通知メールの送信にも失敗: ' + mailErr);
  }
}
